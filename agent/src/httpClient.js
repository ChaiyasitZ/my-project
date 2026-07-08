/**
 * HTTP Polling Client - Connects agent to NetConfig cloud via REST API
 * 
 * Replaces Socket.IO WebSocket with HTTP polling for Vercel serverless compatibility.
 * 
 * Protocol:
 * - Agent sends heartbeat every 5 seconds
 * - Agent polls for commands every 1 second
 * - Agent executes commands locally and posts results back
 */

import { EventEmitter } from 'events';
import os from 'os';

export class HttpPollingClient extends EventEmitter {
  constructor({ serverUrl, agentToken, agentName, version, handlers }) {
    super();
    this.serverUrl = serverUrl.replace(/\/$/, '');
    this.agentToken = agentToken;
    this.agentName = agentName;
    this.version = version;
    this.handlers = handlers;
    this.connected = false;
    this.pollInterval = null;
    this.heartbeatInterval = null;
    this.shellPollIntervals = new Map(); // sessionId -> intervalId
    this.shellStreams = new Map(); // sessionId -> { stream, deviceId }
  }

  /**
   * Connect to the server (start polling)
   */
  async connect() {
    // Send initial heartbeat to verify connection
    try {
      await this._sendHeartbeat();
      this.connected = true;
      this.sessionId = `poll-${Date.now()}`;
      this.emit('connected');

      // Start heartbeat (every 5 seconds)
      this.heartbeatInterval = setInterval(() => {
        this._sendHeartbeat().catch(err => {
          this.emit('error', err);
        });
      }, 5000);

      // Start command polling (every 1 second, was 2s) so SSH/deploy/console
      // actions started from the web app get picked up sooner.
      this.pollInterval = setInterval(() => {
        this._pollCommands().catch(err => {
          // Don't emit error for every poll failure, just log
          if (this.connected) {
            console.error('Poll error:', err.message);
          }
        });
      }, 1000);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Send heartbeat to server (includes serial port list for caching)
   */
  async _sendHeartbeat() {
    // Scan serial ports so the server can cache them for instant web access
    let serialPorts = [];
    try {
      if (this.handlers.console) {
        const portsResult = await this.handlers.console.listPorts();
        if (portsResult.success) {
          serialPorts = portsResult.ports;
        }
      }
    } catch (e) {
      // Serial port scan failed — send heartbeat without ports
    }

    const response = await this._fetch('/api/agent/poll/heartbeat', {
      method: 'POST',
      body: JSON.stringify({
        agentName: this.agentName,
        agentVersion: this.version,
        platform: os.platform(),
        hostname: os.hostname(),
        capabilities: {
          serialPorts
        }
      })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Heartbeat failed: ${response.status}`);
    }
  }

  /**
   * Poll for pending commands
   */
  async _pollCommands() {
    const response = await this._fetch('/api/agent/poll/commands', {
      method: 'GET'
    });

    if (!response.ok) return;

    const { commands } = await response.json();
    
    for (const cmd of commands) {
      this.emit('command', { type: cmd.event, deviceId: cmd.data?.deviceId });
      this._handleCommand(cmd);
    }
  }

  /**
   * Handle a single command from the server
   */
  async _handleCommand(cmd) {
    const { commandId, event, data } = cmd;
    
    try {
      let result;

      switch (event) {
        // ─── SSH Commands ───
        case 'agent:ssh:connect':
          result = await this.handlers.ssh.connect(data);
          break;

        case 'agent:ssh:disconnect':
          this.handlers.ssh.disconnect(data.deviceId);
          result = { success: true };
          break;

        case 'agent:ssh:exec':
          result = await this.handlers.ssh.executeCommand(data.deviceId, data.command);
          break;

        case 'agent:ssh:send-config':
          result = await this.handlers.ssh.sendConfig(data.deviceId, data.commands, data.enablePassword);
          break;

        case 'agent:ssh:deploy-config': {
          // All-in-one: auto-connect SSH + send config commands
          const deployDeviceId = data.deviceId;
          if (!this.handlers.ssh.isConnected(deployDeviceId) && data.host) {
            await this.handlers.ssh.connect({
              deviceId: deployDeviceId,
              host: data.host,
              port: data.port || 22,
              username: data.username,
              password: data.password
            });
          }
          result = await this.handlers.ssh.sendConfig(deployDeviceId, data.commands, data.enablePassword);
          break;
        }

        case 'agent:ssh:backup': {
          // All-in-one: connect → show running/startup config → disconnect
          // Uses a single shell session to avoid VTY line issues on Cisco devices
          const bk = data;
          try {
            await this.handlers.ssh.connect({ deviceId: bk.deviceId, host: bk.host, port: bk.port || 22, username: bk.username, password: bk.password });
            const effectiveType = bk.configType || 'both';
            const cleanConfig = (raw) => {
              let cleaned = raw.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '').replace(/\r/g, '');
              const lines = cleaned.split('\n');
              const start = lines.findIndex(l => l.includes('Current configuration') || l.includes('Using ') || /^version\s/.test(l.trim()));
              if (start < 0) return cleaned.trim();
              let end = lines.length;
              for (let i = lines.length - 1; i > start; i--) {
                const trimmed = lines[i].trim();
                if (trimmed === 'end') { end = i + 1; break; }
                if (trimmed && !trimmed.match(/^[A-Za-z0-9_\-\.]+[#>]\s*$/)) { end = i + 1; break; }
              }
              return lines.slice(start, end).join('\n').trim();
            };
            let runningConfig = '';
            let startupConfig = '';
            if (effectiveType === 'both') {
              const bothResult = await this.handlers.ssh.execBackupCommands(bk.deviceId, 'both');
              console.log(`📋 Backup split — running raw: ${(bothResult.runningOutput || '').length} chars, startup raw: ${(bothResult.startupOutput || '').length} chars`);
              runningConfig = cleanConfig(bothResult.runningOutput || '');
              startupConfig = cleanConfig(bothResult.startupOutput || '');
              console.log(`📋 Backup cleaned — running: ${runningConfig.length} chars, startup: ${startupConfig.length} chars`);
            } else {
              const singleResult = await this.handlers.ssh.execBackupCommands(bk.deviceId, effectiveType);
              console.log(`📋 Single backup (${effectiveType}) — raw: ${(singleResult.output || '').length} chars`);
              if (effectiveType === 'startup-config') {
                startupConfig = cleanConfig(singleResult.output || '');
                console.log(`📋 Cleaned startup: ${startupConfig.length} chars, starts with: ${startupConfig.substring(0, 80)}`);
              } else {
                runningConfig = cleanConfig(singleResult.output || '');
                console.log(`📋 Cleaned running: ${runningConfig.length} chars, starts with: ${runningConfig.substring(0, 80)}`);
              }
            }
            this.handlers.ssh.disconnect(bk.deviceId);
            result = {
              success: true,
              runningConfig,
              startupConfig,
              runningConfigSize: Buffer.byteLength(runningConfig),
              startupConfigSize: Buffer.byteLength(startupConfig),
              configType: effectiveType
            };
          } catch (bkErr) {
            try { this.handlers.ssh.disconnect(bk.deviceId); } catch (e) {}
            throw bkErr;
          }
          break;
        }

        case 'agent:ssh:open-shell': {
          const shellResult = await this._openShell(data);
          result = shellResult;
          break;
        }

        case 'agent:ssh:shell-input': {
          try {
            this.handlers.ssh.writeToShell(data.sessionId, data.data);
          } catch (e) { /* session might be closed */ }
          result = { success: true };
          break;
        }

        case 'agent:ssh:close-shell': {
          const entry = this.shellStreams.get(data.sessionId);
          if (entry) {
            try { entry.stream.end(); } catch (e) {}
            this.shellStreams.delete(data.sessionId);
            this._stopShellPolling(data.sessionId);
          }
          result = { success: true };
          break;
        }

        // ─── NETCONF Commands ───
        case 'agent:netconf:connect':
          result = await this.handlers.netconf.connect(data);
          break;

        case 'agent:netconf:disconnect':
          this.handlers.netconf.disconnect(data.deviceId);
          result = { success: true };
          break;

        case 'agent:netconf:get-config':
          if (!this.handlers.netconf.isConnected(data.deviceId) && data.host) {
            await this.handlers.netconf.connect(data);
          }
          result = await this.handlers.netconf.getConfig(data.deviceId, data.filter);
          break;

        case 'agent:netconf:edit-config':
          if (!this.handlers.netconf.isConnected(data.deviceId) && data.host) {
            await this.handlers.netconf.connect(data);
          }
          result = await this.handlers.netconf.editConfig(data.deviceId, data.config);
          break;

        case 'agent:netconf:rpc':
          if (!this.handlers.netconf.isConnected(data.deviceId) && data.host) {
            await this.handlers.netconf.connect(data);
          }
          result = await this.handlers.netconf.sendRPC(data.deviceId, data.rpcBody);
          break;

        // ─── Console Commands ───
        case 'agent:console:list-ports':
          result = await this.handlers.console.listPorts();
          break;

        case 'agent:console:connect':
          result = await this.handlers.console.connect(data);
          break;

        case 'agent:console:disconnect':
          this.handlers.console.disconnect(data.deviceId);
          result = { success: true };
          break;

        case 'agent:console:command':
          result = await this.handlers.console.sendCommand(data.deviceId, data.command, data.waitForPrompt);
          break;

        case 'agent:console:test':
          result = await this.handlers.console.testConnection(data);
          break;

        case 'agent:console:initial-config':
          result = await this.handlers.console.sendInitialConfig(data.deviceId, data.configCommands);
          break;

        // ─── Status Commands ───
        case 'agent:status': {
          const ollamaStatus = await this.handlers.ollama.getStatus().catch(() => ({ available: false }));
          result = {
            success: true,
            agent: {
              name: this.agentName,
              version: this.version,
              platform: os.platform(),
              hostname: os.hostname(),
              uptime: process.uptime(),
              memory: process.memoryUsage()
            },
            connections: {
              ssh: this.handlers.ssh.getStatus(),
              netconf: this.handlers.netconf.getStatus()
            },
            ollama: ollamaStatus
          };
          break;
        }

        case 'agent:ping':
          result = { success: true, pong: true, timestamp: Date.now() };
          break;

        // ─── Ollama / LLM Commands ───
        case 'agent:ollama:status':
          result = await this.handlers.ollama.getStatus();
          result.success = true;
          break;

        case 'agent:ollama:health':
          result = await this.handlers.ollama.checkHealth();
          result.success = result.available;
          break;

        case 'agent:ollama:models':
          result = {
            success: true,
            models: await this.handlers.ollama.listModels(),
            currentModel: this.handlers.ollama.getModel()
          };
          break;

        case 'agent:ollama:set-model':
          this.handlers.ollama.setModel(data.model);
          result = { success: true, model: data.model };
          break;

        case 'agent:ollama:chat': {
          // Main LLM generation endpoint - relays chat completion to local Ollama
          const chatResult = await this.handlers.ollama.chatCompletion({
            messages: data.messages,
            model: data.model,
            temperature: data.temperature,
            max_tokens: data.max_tokens,
            top_p: data.top_p,
            frequency_penalty: data.frequency_penalty,
            presence_penalty: data.presence_penalty,
            stop: data.stop
          });
          result = chatResult;
          break;
        }

        case 'agent:ollama:generate': {
          // Simple text generation
          const text = await this.handlers.ollama.generate(data.prompt, {
            model: data.model,
            temperature: data.temperature,
            max_tokens: data.max_tokens
          });
          result = { success: true, text };
          break;
        }

        default:
          result = { success: false, error: `Unknown event: ${event}` };
      }

      // Post result back to server
      await this._postResult(commandId, { success: true, ...result });
      this.emit('result', { type: event, success: true });

    } catch (error) {
      await this._postResult(commandId, { success: false, error: error.message });
      this.emit('result', { type: event, success: false });
    }
  }

  /**
   * Open an interactive shell session with HTTP polling for I/O
   */
  async _openShell(data) {
    const sessionId = `shell-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    
    // Create shell session on server
    await this._fetch('/api/agent/poll/shell-create', {
      method: 'POST',
      body: JSON.stringify({ sessionId, deviceId: data.deviceId })
    });

    const { stream } = await this.handlers.ssh.openShell(
      data.deviceId,
      // onData: push output to server
      async (output) => {
        try {
          await this._fetch('/api/agent/poll/shell-output', {
            method: 'POST',
            body: JSON.stringify({ sessionId, data: output })
          });
        } catch (e) {
          console.error('Failed to push shell output:', e.message);
        }
      },
      // onClose: notify server
      async () => {
        try {
          await this._fetch('/api/agent/poll/shell-closed', {
            method: 'POST',
            body: JSON.stringify({ sessionId })
          });
        } catch (e) {}
        this.shellStreams.delete(sessionId);
        this._stopShellPolling(sessionId);
      }
    );

    this.shellStreams.set(sessionId, { stream, deviceId: data.deviceId });

    // Start polling for shell input from the web app
    this._startShellInputPolling(sessionId);

    return { success: true, sessionId };
  }

  /**
   * Poll for shell input from the web app
   */
  _startShellInputPolling(sessionId) {
    const intervalId = setInterval(async () => {
      try {
        const response = await this._fetch(`/api/agent/poll/shell-input/${sessionId}`, {
          method: 'GET'
        });
        
        if (!response.ok) return;
        
        const { inputs, closed } = await response.json();
        
        if (closed) {
          this._stopShellPolling(sessionId);
          return;
        }

        // Write each input to the shell
        for (const input of inputs) {
          try {
            this.handlers.ssh.writeToShell(sessionId, input);
          } catch (e) { /* session might be closed */ }
        }
      } catch (e) {
        // Ignore poll errors for shell input
      }
    }, 300); // Poll every 300ms (was 500ms) for more responsive shell

    this.shellPollIntervals.set(sessionId, intervalId);
  }

  _stopShellPolling(sessionId) {
    const intervalId = this.shellPollIntervals.get(sessionId);
    if (intervalId) {
      clearInterval(intervalId);
      this.shellPollIntervals.delete(sessionId);
    }
  }

  /**
   * Post command result back to server
   */
  async _postResult(commandId, result) {
    try {
      await this._fetch(`/api/agent/poll/result/${commandId}`, {
        method: 'POST',
        body: JSON.stringify(result)
      });
    } catch (e) {
      console.error('Failed to post result:', e.message);
    }
  }

  /**
   * Make an HTTP request to the server
   */
  async _fetch(path, options = {}) {
    const url = `${this.serverUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Agent-Token': this.agentToken,
        ...(options.headers || {})
      }
    });
    return response;
  }

  /**
   * Disconnect from server (stop polling)
   */
  disconnect() {
    this.connected = false;
    
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Stop all shell polling
    for (const [sessionId, intervalId] of this.shellPollIntervals) {
      clearInterval(intervalId);
    }
    this.shellPollIntervals.clear();
  }
}
