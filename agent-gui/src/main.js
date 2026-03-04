/**
 * NetConfig Agent GUI - Electron Main Process
 * 
 * Creates a compact desktop app with:
 * - Connection settings (server URL, token, agent name)
 * - Status indicator (online/offline)
 * - Activity log
 * - System tray integration
 * - Ollama status
 */

const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, shell } = require('electron');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { EventEmitter } = require('events');

// ─── Config Store (simple JSON file) ───
const fs = require('fs');

class AgentConfig {
  constructor() {
    this.configDir = path.join(app.getPath('userData'));
    this.configPath = path.join(this.configDir, 'config.json');
    this.data = this._load();

    if (!this.data.agentId) {
      this.data.agentId = crypto.randomBytes(16).toString('hex');
      this._save();
    }
  }

  _load() {
    try {
      if (fs.existsSync(this.configPath)) {
        return JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
      }
    } catch (e) {
      console.error('Failed to load config:', e);
    }
    return {};
  }

  _save() {
    try {
      if (!fs.existsSync(this.configDir)) fs.mkdirSync(this.configDir, { recursive: true });
      fs.writeFileSync(this.configPath, JSON.stringify(this.data, null, 2));
    } catch (e) {
      console.error('Failed to save config:', e);
    }
  }

  get(key) { return this.data[key] || ''; }
  set(key, value) { this.data[key] = value; this._save(); }
  getAll() { return { ...this.data }; }
}

// ─── HTTP Polling Client (embedded, no external deps) ───

class HttpPollingClient extends EventEmitter {
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
    this.shellPollIntervals = new Map();
    this.shellStreams = new Map();
    this.cachedPorts = [];  // Cache detected serial ports for heartbeat
  }

  async connect() {
    await this._sendHeartbeat();
    this.connected = true;
    this.sessionId = `poll-${Date.now()}`;
    this.emit('connected');

    this.heartbeatInterval = setInterval(() => {
      this._sendHeartbeat().catch(err => this.emit('error', err));
    }, 5000);

    this.pollInterval = setInterval(() => {
      this._pollCommands().catch(() => {});
    }, 2000);

    // Refresh cached serial ports every 30s
    this.portRefreshInterval = setInterval(async () => {
      try {
        const result = await this.handlers.console.listPorts();
        if (result && result.ports) this.cachedPorts = result.ports;
      } catch (e) {}
    }, 30000);
  }

  async _sendHeartbeat() {
    const response = await this._fetch('/api/agent/poll/heartbeat', {
      method: 'POST',
      body: JSON.stringify({
        agentName: this.agentName,
        agentVersion: this.version,
        platform: os.platform(),
        hostname: os.hostname(),
        capabilities: {
          serialPorts: this.cachedPorts
        }
      })
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Heartbeat failed: ${response.status}`);
    }
  }

  async _pollCommands() {
    const response = await this._fetch('/api/agent/poll/commands', { method: 'GET' });
    if (!response.ok) return;
    const { commands } = await response.json();
    for (const cmd of commands) {
      this.emit('command', { type: cmd.event, deviceId: cmd.data?.deviceId });
      this._handleCommand(cmd);
    }
  }

  async _handleCommand(cmd) {
    const { commandId, event, data } = cmd;
    try {
      let result;
      switch (event) {
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
          // All-in-one: connect → send config → disconnect (single round trip for Vercel)
          const { deviceId, host, port, username, password, commands, enablePassword } = data;
          try {
            await this.handlers.ssh.connect({ deviceId, host, port: port || 22, username, password });
            result = await this.handlers.ssh.sendConfig(deviceId, commands, enablePassword);
            this.handlers.ssh.disconnect(deviceId);
          } catch (deployErr) {
            this.handlers.ssh.disconnect(deviceId);
            throw deployErr;
          }
          break;
        }
        case 'agent:ssh:backup': {
          // All-in-one: connect → show running/startup config → disconnect
          const bk = data;
          try {
            await this.handlers.ssh.connect({ deviceId: bk.deviceId, host: bk.host, port: bk.port || 22, username: bk.username, password: bk.password });
            
            // Use shell for backup to properly handle multi-command sequences
            const runResult = await this.handlers.ssh.execBackupCommands(bk.deviceId, 'running-config');
            let startupResult = { output: '' };
            if (bk.configType !== 'running-config') {
              try { startupResult = await this.handlers.ssh.execBackupCommands(bk.deviceId, 'startup-config'); } catch (e) {}
            }
            this.handlers.ssh.disconnect(bk.deviceId);
            // Clean config output (remove ANSI codes, command echo, and trailing prompts)
            const cleanConfig = (raw) => {
              // Strip ANSI escape sequences
              let cleaned = raw.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '').replace(/\r/g, '');
              const lines = cleaned.split('\n');
              // Find the start of actual config (e.g., "Current configuration" or "version ")
              const start = lines.findIndex(l => l.includes('Current configuration') || /^version\s/.test(l.trim()));
              if (start < 0) return cleaned.trim();
              // Find the end (last "end" line or line with device prompt like "Router#")
              let end = lines.length;
              for (let i = lines.length - 1; i > start; i--) {
                const trimmed = lines[i].trim();
                if (trimmed === 'end') { end = i + 1; break; }
                if (trimmed && !trimmed.match(/^[A-Za-z0-9_\-\.]+[#>]\s*$/)) { end = i + 1; break; }
              }
              return lines.slice(start, end).join('\n').trim();
            };
            const runningConfig = cleanConfig(runResult.output || '');
            const startupConfig = startupResult.output ? cleanConfig(startupResult.output) : '';
            result = {
              success: true,
              runningConfig,
              startupConfig,
              runningConfigSize: Buffer.byteLength(runningConfig),
              startupConfigSize: Buffer.byteLength(startupConfig),
              configType: bk.configType || 'both'
            };
          } catch (bkErr) {
            try { this.handlers.ssh.disconnect(bk.deviceId); } catch (e) {}
            throw bkErr;
          }
          break;
        }
        case 'agent:ssh:open-shell': {
          result = await this._openShell(data);
          break;
        }
        case 'agent:ssh:shell-input': {
          try { this.handlers.ssh.writeToShell(data.sessionId, data.data); } catch (e) {}
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
        case 'agent:netconf:connect':
          result = await this.handlers.netconf.connect(data);
          break;
        case 'agent:netconf:disconnect':
          this.handlers.netconf.disconnect(data.deviceId);
          result = { success: true };
          break;
        case 'agent:netconf:get-config':
          await this.handlers.netconf.ensureConnected(data);
          result = await this.handlers.netconf.getConfig(data.deviceId, data.filter);
          break;
        case 'agent:netconf:edit-config':
          await this.handlers.netconf.ensureConnected(data);
          result = await this.handlers.netconf.editConfig(data.deviceId, data.config);
          break;
        case 'agent:netconf:rpc':
          await this.handlers.netconf.ensureConnected(data);
          result = await this.handlers.netconf.sendRPC(data.deviceId, data.rpcBody);
          break;
        case 'agent:console:list-ports':
          result = await this.handlers.console.listPorts();
          // Cache ports for heartbeat
          if (result && result.ports) this.cachedPorts = result.ports;
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
        case 'agent:status': {
          const ollamaStatus = await this.handlers.ollama.getStatus().catch(() => ({ available: false }));
          result = {
            success: true,
            agent: { name: this.agentName, version: this.version, platform: os.platform(), hostname: os.hostname(), uptime: process.uptime(), memory: process.memoryUsage() },
            connections: { ssh: this.handlers.ssh.getStatus(), netconf: this.handlers.netconf.getStatus() },
            ollama: ollamaStatus
          };
          break;
        }
        case 'agent:netconf:sessions': {
          const sessions = this.handlers.netconf.getActiveSessions();
          result = { success: true, sessions };
          break;
        }
        case 'agent:ping':
          result = { success: true, pong: true, timestamp: Date.now() };
          break;
        case 'agent:ollama:status':
          result = await this.handlers.ollama.getStatus();
          result.success = true;
          break;
        case 'agent:ollama:health':
          result = await this.handlers.ollama.checkHealth();
          result.success = result.available;
          break;
        case 'agent:ollama:models':
          result = { success: true, models: await this.handlers.ollama.listModels(), currentModel: this.handlers.ollama.getModel() };
          break;
        case 'agent:ollama:set-model':
          this.handlers.ollama.setModel(data.model);
          result = { success: true, model: data.model };
          break;
        case 'agent:ollama:chat': {
          result = await this.handlers.ollama.chatCompletion({
            messages: data.messages, model: data.model, temperature: data.temperature,
            max_tokens: data.max_tokens, top_p: data.top_p, frequency_penalty: data.frequency_penalty,
            presence_penalty: data.presence_penalty, stop: data.stop
          });
          break;
        }
        case 'agent:ollama:generate': {
          const text = await this.handlers.ollama.generate(data.prompt, { model: data.model, temperature: data.temperature, max_tokens: data.max_tokens });
          result = { success: true, text };
          break;
        }
        default:
          result = { success: false, error: `Unknown event: ${event}` };
      }
      await this._postResult(commandId, { success: true, ...result });
      this.emit('result', { type: event, success: true });
    } catch (error) {
      await this._postResult(commandId, { success: false, error: error.message });
      this.emit('result', { type: event, success: false });
    }
  }

  async _openShell(data) {
    const sessionId = `shell-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    await this._fetch('/api/agent/poll/shell-create', { method: 'POST', body: JSON.stringify({ sessionId, deviceId: data.deviceId }) });
    const { stream } = await this.handlers.ssh.openShell(
      data.deviceId,
      async (output) => {
        try { await this._fetch('/api/agent/poll/shell-output', { method: 'POST', body: JSON.stringify({ sessionId, data: output }) }); } catch (e) {}
      },
      async () => {
        try { await this._fetch('/api/agent/poll/shell-closed', { method: 'POST', body: JSON.stringify({ sessionId }) }); } catch (e) {}
        this.shellStreams.delete(sessionId);
        this._stopShellPolling(sessionId);
      }
    );
    this.shellStreams.set(sessionId, { stream, deviceId: data.deviceId });
    this._startShellInputPolling(sessionId);
    return { success: true, sessionId };
  }

  _startShellInputPolling(sessionId) {
    const intervalId = setInterval(async () => {
      try {
        const response = await this._fetch(`/api/agent/poll/shell-input/${sessionId}`, { method: 'GET' });
        if (!response.ok) return;
        const { inputs, closed } = await response.json();
        if (closed) { this._stopShellPolling(sessionId); return; }
        for (const input of inputs) { try { this.handlers.ssh.writeToShell(sessionId, input); } catch (e) {} }
      } catch (e) {}
    }, 500);
    this.shellPollIntervals.set(sessionId, intervalId);
  }

  _stopShellPolling(sessionId) {
    const intervalId = this.shellPollIntervals.get(sessionId);
    if (intervalId) { clearInterval(intervalId); this.shellPollIntervals.delete(sessionId); }
  }

  async _postResult(commandId, result) {
    try {
      const resp = await this._fetch(`/api/agent/poll/result/${commandId}`, { method: 'POST', body: JSON.stringify(result) });
      if (!resp.ok) {
        console.error(`❌ _postResult failed: HTTP ${resp.status} for command ${commandId}`);
      }
    } catch (e) {
      console.error(`❌ _postResult error for command ${commandId}:`, e.message);
    }
  }

  async _fetch(urlPath, options = {}) {
    const url = `${this.serverUrl}${urlPath}`;
    return fetch(url, { ...options, headers: { 'Content-Type': 'application/json', 'X-Agent-Token': this.agentToken, ...(options.headers || {}) } });
  }

  disconnect() {
    this.connected = false;
    if (this.pollInterval) { clearInterval(this.pollInterval); this.pollInterval = null; }
    if (this.heartbeatInterval) { clearInterval(this.heartbeatInterval); this.heartbeatInterval = null; }
    if (this.portRefreshInterval) { clearInterval(this.portRefreshInterval); this.portRefreshInterval = null; }
    for (const [, intervalId] of this.shellPollIntervals) clearInterval(intervalId);
    this.shellPollIntervals.clear();
  }
}

// ─── SSH Handler ───
class SSHHandler {
  constructor() { this.connections = new Map(); this.shells = new Map(); }

  async connect(data) {
    const { Client } = require('ssh2');
    const { deviceId, host, port = 22, username, password } = data;
    return new Promise((resolve, reject) => {
      const conn = new Client();
      const timeout = setTimeout(() => { conn.end(); reject(new Error('Connection timeout (15s)')); }, 15000);
      conn.on('ready', () => {
        clearTimeout(timeout);
        this.connections.set(deviceId, conn);
        resolve({ success: true, message: `Connected to ${host}` });
      });
      conn.on('error', (err) => { clearTimeout(timeout); reject(err); });
      conn.connect({
        host, port, username, password, readyTimeout: 15000,
        hostVerifier: () => true,
        algorithms: {
          kex: ['ecdh-sha2-nistp256','ecdh-sha2-nistp384','ecdh-sha2-nistp521','diffie-hellman-group14-sha256','diffie-hellman-group14-sha1','diffie-hellman-group1-sha1'],
          cipher: ['aes128-ctr','aes192-ctr','aes256-ctr','aes128-cbc','aes192-cbc','aes256-cbc','3des-cbc','aes128-gcm','aes128-gcm@openssh.com','aes256-gcm','aes256-gcm@openssh.com'],
          hmac: ['hmac-sha2-256','hmac-sha1','hmac-sha2-512'],
          serverHostKey: ['ssh-rsa','ssh-dss','ecdsa-sha2-nistp256','ecdsa-sha2-nistp384','ecdsa-sha2-nistp521','ssh-ed25519','rsa-sha2-256','rsa-sha2-512']
        }
      });
    });
  }

  disconnect(deviceId) {
    const conn = this.connections.get(deviceId);
    if (conn) { try { conn.end(); } catch (e) {} this.connections.delete(deviceId); }
  }

  async executeCommand(deviceId, command) {
    const conn = this.connections.get(deviceId);
    if (!conn) throw new Error('Not connected');
    return new Promise((resolve, reject) => {
      conn.exec(command, (err, stream) => {
        if (err) return reject(err);
        let stdout = '', stderr = '';
        stream.on('data', (d) => { stdout += d.toString(); });
        stream.stderr.on('data', (d) => { stderr += d.toString(); });
        stream.on('close', () => resolve({ output: stdout, error: stderr }));
      });
    });
  }

  /**
   * Execute backup commands via interactive shell.
   * Uses shell to properly send 'terminal length 0' then 'show running/startup-config'
   * as separate commands, since SSH exec doesn't support multi-command sequences on Cisco.
   */
  async execBackupCommands(deviceId, configType = 'running-config') {
    const conn = this.connections.get(deviceId);
    if (!conn) throw new Error('Not connected');
    return new Promise((resolve, reject) => {
      conn.shell((err, stream) => {
        if (err) return reject(err);
        let output = '';
        let settled = false;
        const timeout = setTimeout(() => {
          if (!settled) { settled = true; stream.end(); resolve({ output }); }
        }, 20000);
        stream.on('data', (d) => {
          output += d.toString();
        });
        stream.on('close', () => {
          if (!settled) { settled = true; clearTimeout(timeout); resolve({ output }); }
        });
        // Wait for initial prompt, then send commands
        setTimeout(() => {
          stream.write('terminal length 0\n');
          setTimeout(() => {
            stream.write(`show ${configType}\n`);
            // Wait for output to complete, then close
            setTimeout(() => {
              if (!settled) { settled = true; clearTimeout(timeout); stream.end(); resolve({ output }); }
            }, 8000);
          }, 1000);
        }, 1000);
      });
    });
  }
  async sendConfig(deviceId, commands, enablePassword) {
    const conn = this.connections.get(deviceId);
    if (!conn) throw new Error('Not connected');
    return new Promise((resolve, reject) => {
      conn.shell({ term: 'xterm' }, (err, stream) => {
        if (err) return reject(err);
        let output = '';
        stream.on('data', (d) => { output += d.toString(); });
        stream.on('close', () => resolve({ output, success: true }));
        const allCommands = Array.isArray(commands) ? commands : commands.split('\n');
        if (enablePassword) {
          stream.write('enable\n');
          setTimeout(() => { stream.write(enablePassword + '\n'); setTimeout(() => { stream.write('configure terminal\n'); setTimeout(() => { allCommands.forEach(cmd => { const trimmed = cmd.trim(); if (trimmed) stream.write(trimmed + '\n'); }); setTimeout(() => { stream.write('end\n'); setTimeout(() => stream.end(), 500); }, 500); }, 500); }, 500); }, 500);
        } else {
          stream.write('configure terminal\n');
          setTimeout(() => { allCommands.forEach(cmd => { const trimmed = cmd.trim(); if (trimmed) stream.write(trimmed + '\n'); }); setTimeout(() => { stream.write('end\n'); setTimeout(() => stream.end(), 500); }, 500); }, 500);
        }
      });
    });
  }

  async openShell(deviceId, onData, onClose) {
    const conn = this.connections.get(deviceId);
    if (!conn) throw new Error('Not connected');
    return new Promise((resolve, reject) => {
      conn.shell({ term: 'xterm', cols: 120, rows: 40 }, (err, stream) => {
        if (err) return reject(err);
        const sessionId = `shell-${Date.now()}`;
        this.shells.set(sessionId, stream);
        stream.on('data', (d) => onData(d.toString()));
        stream.on('close', () => { this.shells.delete(sessionId); onClose(); });
        resolve({ sessionId, stream });
      });
    });
  }

  writeToShell(sessionId, data) {
    const stream = this.shells.get(sessionId);
    if (stream) stream.write(data);
  }

  getStatus() { return { activeConnections: this.connections.size, activeShells: this.shells.size }; }
  async disconnectAll() { for (const [id] of this.connections) this.disconnect(id); }
}

// ─── NETCONF Handler ───
class NetconfHandler {
  constructor() { this.connections = new Map(); }

  isConnected(deviceId) {
    return this.connections.has(deviceId);
  }

  async ensureConnected(data) {
    if (this.isConnected(data.deviceId)) return;
    if (!data.host) throw new Error('Not connected via NETCONF and no credentials provided for auto-connect');
    console.log(`🔄 Auto-connecting NETCONF to ${data.host} for device ${data.deviceId}...`);
    await this.connect(data);
  }

  async connect(data) {
    const { Client } = require('ssh2');
    const { deviceId, host, port = 830, username, password } = data;

    // Already connected — return existing session
    const existing = this.connections.get(deviceId);
    if (existing) {
      return { success: true, message: `Already connected to ${host}`, capabilities: existing.capabilities, alreadyConnected: true };
    }

    return new Promise((resolve, reject) => {
      const conn = new Client();
      const timeout = setTimeout(() => { conn.end(); reject(new Error('NETCONF connection timeout')); }, 30000);
      conn.on('ready', () => {
        clearTimeout(timeout);
        conn.subsys('netconf', (err, stream) => {
          if (err) { conn.end(); return reject(err); }
          let helloReceived = false, buffer = '';
          const helloTimeout = setTimeout(() => { stream.removeAllListeners('data'); conn.end(); reject(new Error('NETCONF hello exchange timeout')); }, 20000);
          stream.on('data', (d) => {
            buffer += d.toString();
            if (!helloReceived && buffer.includes(']]>]]>')) {
              helloReceived = true;
              clearTimeout(helloTimeout);
              const hello = '<?xml version="1.0" encoding="UTF-8"?><hello xmlns="urn:ietf:params:xml:ns:netconf:base:1.0"><capabilities><capability>urn:ietf:params:netconf:base:1.0</capability></capabilities></hello>]]>]]>';
              stream.write(hello);
              // Parse capabilities from server hello XML
              const capabilities = [];
              const capRegex = /<capability>([^<]+)<\/capability>/g;
              let match;
              while ((match = capRegex.exec(buffer)) !== null) {
                capabilities.push(match[1].trim());
              }
              this.connections.set(deviceId, { conn, stream, capabilities, connectedAt: new Date().toISOString() });
              resolve({ success: true, message: `NETCONF connected to ${host}`, capabilities });
            }
          });
          stream.on('close', () => { this.connections.delete(deviceId); });
        });
      });
      conn.on('error', (err) => { clearTimeout(timeout); reject(err); });
      conn.connect({
        host, port, username, password, readyTimeout: 30000,
        hostVerifier: () => true,
        algorithms: {
          kex: ['ecdh-sha2-nistp256','ecdh-sha2-nistp384','ecdh-sha2-nistp521','diffie-hellman-group14-sha256','diffie-hellman-group14-sha1','diffie-hellman-group1-sha1'],
          cipher: ['aes128-ctr','aes192-ctr','aes256-ctr','aes128-cbc','aes192-cbc','aes256-cbc','3des-cbc','aes128-gcm','aes128-gcm@openssh.com','aes256-gcm','aes256-gcm@openssh.com'],
          hmac: ['hmac-sha2-256','hmac-sha1','hmac-sha2-512'],
          serverHostKey: ['ssh-rsa','ssh-dss','ecdsa-sha2-nistp256','ecdsa-sha2-nistp384','ecdsa-sha2-nistp521','ssh-ed25519','rsa-sha2-256','rsa-sha2-512']
        }
      });
    });
  }

  disconnect(deviceId) {
    const entry = this.connections.get(deviceId);
    if (entry) { try { entry.conn.end(); } catch (e) {} this.connections.delete(deviceId); }
  }

  async getConfig(deviceId, filter) {
    return this._sendRpc(deviceId, `<get-config><source><running/></source>${filter ? `<filter>${filter}</filter>` : ''}</get-config>`);
  }

  async editConfig(deviceId, config) {
    return this._sendRpc(deviceId, `<edit-config><target><running/></target><config>${config}</config></edit-config>`);
  }

  async sendRPC(deviceId, rpcBody) { return this._sendRpc(deviceId, rpcBody); }

  async _sendRpc(deviceId, rpcContent) {
    const entry = this.connections.get(deviceId);
    if (!entry) throw new Error('Not connected via NETCONF');
    const msgId = Date.now();
    const rpc = `<?xml version="1.0" encoding="UTF-8"?><rpc message-id="${msgId}" xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">${rpcContent}</rpc>]]>]]>`;
    return new Promise((resolve, reject) => {
      let response = '';
      const onData = (d) => { response += d.toString(); if (response.includes(']]>]]>')) { entry.stream.removeListener('data', onData); clearTimeout(t); resolve({ success: true, response: response.replace(']]>]]>', ''), messageId: msgId }); } };
      const t = setTimeout(() => { entry.stream.removeListener('data', onData); reject(new Error('NETCONF RPC timeout')); }, 30000);
      entry.stream.on('data', onData);
      entry.stream.write(rpc);
    });
  }

  getStatus() { return { activeConnections: this.connections.size }; }
  getActiveSessions() {
    const sessions = [];
    for (const [deviceId, entry] of this.connections) {
      sessions.push({
        deviceId,
        isConnected: true,
        agentSession: true,
        capabilities: entry.capabilities?.length || 0,
        connectedAt: entry.connectedAt || null
      });
    }
    return sessions;
  }
  async disconnectAll() { for (const [id] of this.connections) this.disconnect(id); }
}

// ─── Console Handler ───
class ConsoleHandler {
  constructor() {
    this.connections = new Map();
    this.serialPortAvailable = false;
    // Verify serialport at construction
    try {
      const { SerialPort } = require('serialport');
      this.serialPortAvailable = !!SerialPort;
      console.log('✅ serialport module loaded successfully');
    } catch (e) {
      console.error('❌ serialport module failed to load:', e.message);
    }
  }

  async listPorts() {
    console.log('🔌 listPorts() called, serialPortAvailable:', this.serialPortAvailable);
    const { SerialPort } = require('serialport');
    const ports = await SerialPort.list();
    console.log(`🔌 SerialPort.list() found ${ports.length} ports:`, ports.map(p => p.path));
    const formatted = ports.map(port => {
      let displayName = port.path;
      if (port.manufacturer && !port.manufacturer.includes('Unknown')) {
        if (port.manufacturer.toLowerCase().includes('ftdi')) displayName = `${port.path} - FTDI USB Serial`;
        else if (port.manufacturer.toLowerCase().includes('prolific')) displayName = `${port.path} - Prolific USB Serial`;
        else if (port.manufacturer.toLowerCase().includes('silicon')) displayName = `${port.path} - Silicon Labs USB Serial`;
        else displayName = `${port.path} - ${port.manufacturer}`;
      } else if (port.friendlyName && port.friendlyName !== port.path) {
        let cleanName = port.friendlyName.replace(/\s*\([A-Z]+\d+\)\s*/g, '');
        cleanName = cleanName.replace('Standard Serial over Bluetooth link', 'Bluetooth Serial');
        cleanName = cleanName.replace('USB Serial Port', 'USB Serial');
        if (cleanName && cleanName !== port.path) displayName = `${port.path} - ${cleanName}`;
      }
      return { path: port.path, manufacturer: port.manufacturer || 'Unknown', serialNumber: port.serialNumber || 'N/A', vendorId: port.vendorId || 'N/A', productId: port.productId || 'N/A', friendlyName: displayName, isUSB: !!(port.vendorId || port.manufacturer?.toLowerCase().includes('usb') || (port.friendlyName && port.friendlyName.toLowerCase().includes('usb'))) };
    });
    return { success: true, ports: formatted, count: formatted.length };
  }

  async connect(config) {
    const { SerialPort } = require('serialport');
    const { deviceId, portPath, baudRate = 9600, dataBits = 8, parity = 'none', stopBits = 1 } = config;
    this.disconnect(deviceId);
    return new Promise((resolve, reject) => {
      const port = new SerialPort({ path: portPath, baudRate, dataBits, parity, stopBits, autoOpen: false });
      port.open((err) => { if (err) return reject(new Error(`Failed to open ${portPath}: ${err.message}`)); this.connections.set(deviceId, { port, portPath, createdAt: Date.now() }); resolve({ success: true, message: `Connected to ${portPath}`, deviceId }); });
      port.on('error', (err) => { console.error(`Serial port error (${portPath}):`, err.message); });
    });
  }

  async sendCommand(deviceId, command, waitForPrompt = true) {
    const entry = this.connections.get(deviceId);
    if (!entry) throw new Error('Device not connected via console');
    return new Promise((resolve, reject) => {
      let output = '';
      const timeout = setTimeout(() => { entry.port.removeListener('data', onData); resolve({ output: output || '(no response)', deviceId }); }, waitForPrompt ? 10000 : 2000);
      const onData = (data) => { output += data.toString(); if (waitForPrompt && /[#>$]\s*$/.test(output)) { clearTimeout(timeout); entry.port.removeListener('data', onData); resolve({ output, deviceId }); } };
      entry.port.on('data', onData);
      entry.port.write(command + '\r\n', (err) => { if (err) { clearTimeout(timeout); entry.port.removeListener('data', onData); reject(new Error(`Write failed: ${err.message}`)); } });
    });
  }

  async testConnection(config) {
    try { await this.connect(config); const r = await this.sendCommand(config.deviceId || `test_${Date.now()}`, '', true); this.disconnect(config.deviceId || `test_${Date.now()}`); return { success: true, message: 'Console connection test passed', response: r.output }; }
    catch (err) { return { success: false, message: err.message }; }
  }

  async sendInitialConfig(deviceId, configCommands) {
    const entry = this.connections.get(deviceId);
    if (!entry) throw new Error('Device not connected via console');
    const commands = configCommands.split('\n').map(c => c.trim()).filter(c => c);
    const results = [];
    for (const cmd of commands) { try { const r = await this.sendCommand(deviceId, cmd, true); results.push({ command: cmd, output: r.output, success: true }); } catch (err) { results.push({ command: cmd, output: err.message, success: false }); } }
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    return { success: failed === 0, results, summary: { total: commands.length, successful, failed }, fullOutput: results.map(r => `${r.command}\n${r.output}`).join('\n') };
  }

  getStatus(deviceId) { if (deviceId) { const e = this.connections.get(deviceId); return e ? { connected: true, portPath: e.portPath, connectedAt: e.createdAt } : { connected: false }; } return { activeSessions: this.connections.size }; }
  disconnect(deviceId) { const e = this.connections.get(deviceId); if (e) { try { e.port.close(); } catch (x) {} this.connections.delete(deviceId); } }
  async disconnectAll() { for (const [id] of this.connections) this.disconnect(id); }
}

// ─── Ollama Handler ───
class OllamaHandler {
  constructor() { this.baseUrl = 'http://localhost:11434'; this.model = 'qwen2.5-coder:7b'; }
  setModel(m) { this.model = m; }
  getModel() { return this.model; }

  async checkHealth() {
    try {
      const res = await fetch(`${this.baseUrl}/api/version`);
      if (!res.ok) return { available: false };
      const data = await res.json();
      return { available: true, version: data.version };
    } catch { return { available: false }; }
  }

  async listModels() {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.models || []).map(m => ({ name: m.name, size: m.size, modified: m.modified_at }));
    } catch { return []; }
  }

  async getStatus() {
    const health = await this.checkHealth();
    if (!health.available) return { available: false };
    const models = await this.listModels();
    return { available: true, version: health.version, models, currentModel: this.model, modelCount: models.length };
  }

  async chatCompletion({ messages, model, temperature = 0.7, max_tokens = 4096 }) {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: model || this.model, messages, stream: false, options: { temperature, num_predict: max_tokens } })
    });
    if (!res.ok) throw new Error(`Ollama chat failed: ${res.status}`);
    const data = await res.json();
    return { success: true, choices: [{ message: { role: 'assistant', content: data.message?.content || '' } }], usage: { prompt_tokens: data.prompt_eval_count || 0, completion_tokens: data.eval_count || 0 } };
  }

  async generate(prompt, { model, temperature = 0.7, max_tokens = 4096 } = {}) {
    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: model || this.model, prompt, stream: false, options: { temperature, num_predict: max_tokens } })
    });
    if (!res.ok) throw new Error(`Ollama generate failed: ${res.status}`);
    const data = await res.json();
    return data.response || '';
  }
}

// ═══════════════════════════════════════
// ELECTRON APP
// ═══════════════════════════════════════

const VERSION = '1.0.0';
let mainWindow = null;
let tray = null;
let config = null;
let client = null;
let sshHandler, netconfHandler, consoleHandler, ollamaHandler;
let isConnected = false;
let logs = [];

function addLog(type, message) {
  const entry = { time: new Date().toLocaleTimeString(), type, message };
  logs.push(entry);
  if (logs.length > 200) logs.shift();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('log', entry);
  }
}

function sendStatus() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('status', {
      connected: isConnected,
      serverUrl: config.get('serverUrl'),
      agentName: config.get('agentName'),
      hasToken: !!config.get('agentToken')
    });
  }
}

function createTrayIcon() {
  // Create a simple tray icon (16x16 green/gray circle)
  const iconColor = isConnected ? '#22c55e' : '#6b7280';
  const size = 16;
  const canvas = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="8" cy="8" r="7" fill="${iconColor}" stroke="white" stroke-width="1"/></svg>`;
  return nativeImage.createFromBuffer(Buffer.from(canvas));
}

function updateTray() {
  if (tray) {
    tray.setImage(createTrayIcon());
    tray.setToolTip(`NetConfig Agent - ${isConnected ? 'Connected' : 'Disconnected'}`);
  }
}

async function connectAgent() {
  const serverUrl = config.get('serverUrl');
  const agentToken = config.get('agentToken');
  const agentName = config.get('agentName') || `Agent-${os.hostname()}`;

  if (!serverUrl || !agentToken) {
    addLog('error', 'Server URL and token are required');
    return;
  }

  // Disconnect existing
  if (client) {
    client.disconnect();
    client = null;
  }

  addLog('info', `Connecting to ${serverUrl}...`);

  sshHandler = new SSHHandler();
  netconfHandler = new NetconfHandler();
  consoleHandler = new ConsoleHandler();
  ollamaHandler = new OllamaHandler();

  // Startup self-test: verify serialport works and cache ports for heartbeat
  let startupPorts = [];
  try {
    const testPorts = await consoleHandler.listPorts();
    startupPorts = testPorts.ports || [];
    addLog('info', `Serial ports detected: ${testPorts.count} (${testPorts.ports.map(p => p.path).join(', ') || 'none'})`);
  } catch (e) {
    addLog('error', `Serial port check failed: ${e.message}`);
  }

  const savedModel = config.get('ollamaModel');
  if (savedModel) ollamaHandler.setModel(savedModel);

  client = new HttpPollingClient({
    serverUrl,
    agentToken,
    agentName,
    version: VERSION,
    handlers: { ssh: sshHandler, netconf: netconfHandler, console: consoleHandler, ollama: ollamaHandler }
  });

  // Pre-populate cached ports from startup scan for heartbeat
  client.cachedPorts = startupPorts;

  client.on('connected', () => {
    isConnected = true;
    addLog('success', 'Connected to server (HTTP polling)');
    sendStatus();
    updateTray();
    checkOllama();
  });

  client.on('error', (err) => {
    addLog('error', `Connection error: ${err.message}`);
    isConnected = false;
    sendStatus();
    updateTray();
  });

  client.on('command', (cmd) => {
    addLog('command', `← ${cmd.type}${cmd.deviceId ? ` (${cmd.deviceId.substring(0, 8)}...)` : ''}`);
  });

  client.on('result', (result) => {
    addLog(result.success ? 'success' : 'error', `→ ${result.type} ${result.success ? '✓' : '✗'}`);
  });

  try {
    await client.connect();
  } catch (error) {
    addLog('error', `Failed: ${error.message}`);
    isConnected = false;
    sendStatus();
    updateTray();
  }
}

function disconnectAgent() {
  if (client) {
    client.disconnect();
    client = null;
  }
  if (sshHandler) sshHandler.disconnectAll();
  if (netconfHandler) netconfHandler.disconnectAll();
  if (consoleHandler) consoleHandler.disconnectAll();
  isConnected = false;
  addLog('info', 'Disconnected');
  sendStatus();
  updateTray();
}

async function checkOllama() {
  if (!ollamaHandler) return;
  const status = await ollamaHandler.getStatus();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('ollama-status', status);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 640,
    minWidth: 400,
    minHeight: 500,
    resizable: true,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('close', (e) => {
    // Minimize to tray instead of closing
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.webContents.on('did-finish-load', () => {
    sendStatus();
    mainWindow.webContents.send('config', {
      serverUrl: config.get('serverUrl'),
      agentName: config.get('agentName'),
      agentToken: config.get('agentToken')
    });
    mainWindow.webContents.send('logs', logs);

    // Auto-connect if we have config
    if (config.get('serverUrl') && config.get('agentToken') && !isConnected) {
      connectAgent();
    }
  });
}

app.whenReady().then(() => {
  config = new AgentConfig();

  // Create tray
  tray = new Tray(createTrayIcon());
  const trayMenu = Menu.buildFromTemplate([
    { label: 'Show Window', click: () => { mainWindow.show(); mainWindow.focus(); } },
    { type: 'separator' },
    { label: 'Connect', click: () => connectAgent() },
    { label: 'Disconnect', click: () => disconnectAgent() },
    { type: 'separator' },
    { label: 'Uninstall Agent', click: () => {
      if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
      mainWindow.webContents.send('trigger-uninstall');
    }},
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } }
  ]);
  tray.setContextMenu(trayMenu);
  tray.setToolTip('NetConfig Agent');
  tray.on('click', () => { mainWindow.show(); mainWindow.focus(); });

  createWindow();

  // ─── IPC Handlers ───

  ipcMain.handle('get-config', () => ({
    serverUrl: config.get('serverUrl'),
    agentName: config.get('agentName'),
    agentToken: config.get('agentToken')
  }));

  ipcMain.handle('save-config', (_, data) => {
    if (data.serverUrl !== undefined) config.set('serverUrl', data.serverUrl.replace(/\/$/, ''));
    if (data.agentName !== undefined) config.set('agentName', data.agentName);
    if (data.agentToken !== undefined) config.set('agentToken', data.agentToken);
    return true;
  });

  ipcMain.handle('connect', async () => {
    await connectAgent();
    return isConnected;
  });

  ipcMain.handle('disconnect', () => {
    disconnectAgent();
    return true;
  });

  ipcMain.handle('get-status', () => ({
    connected: isConnected,
    serverUrl: config.get('serverUrl'),
    agentName: config.get('agentName'),
    hasToken: !!config.get('agentToken')
  }));

  ipcMain.handle('get-logs', () => logs);

  ipcMain.handle('check-ollama', async () => {
    if (!ollamaHandler) ollamaHandler = new OllamaHandler();
    return ollamaHandler.getStatus();
  });

  ipcMain.handle('open-external', (_, url) => {
    shell.openExternal(url);
  });

  ipcMain.handle('minimize', () => mainWindow.minimize());
  ipcMain.handle('close', () => mainWindow.hide());

  // ─── Uninstall Agent ───
  ipcMain.handle('uninstall-agent', async () => {
    const { dialog } = require('electron');
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'Uninstall NetConfig Agent',
      message: 'Are you sure you want to uninstall NetConfig Agent?',
      detail: 'This will:\n• Disconnect from the server\n• Delete all saved settings and tokens\n• Remove application data\n• Close the application',
      buttons: ['Cancel', 'Uninstall'],
      defaultId: 0,
      cancelId: 0,
      noLink: true
    });

    if (result.response !== 1) return { cancelled: true };

    try {
      // 1. Disconnect from server
      disconnectAgent();
      addLog('info', 'Uninstalling agent...');

      // 2. Delete config data
      const configDir = config.configDir;
      if (fs.existsSync(configDir)) {
        fs.rmSync(configDir, { recursive: true, force: true });
      }

      // 3. Remove auto-launch registry (Windows)
      if (process.platform === 'win32') {
        try {
          const { execSync } = require('child_process');
          execSync('reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "NetConfigAgent" /f', { stdio: 'ignore' });
        } catch (e) { /* Key may not exist */ }
      }

      // 4. Clean up app data paths
      const appDataPaths = [
        path.join(app.getPath('appData'), 'netconfig-agent-gui'),
        path.join(app.getPath('appData'), 'NetConfig Agent'),
      ];
      for (const p of appDataPaths) {
        try {
          if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
        } catch (e) { /* ignore */ }
      }

      // 5. Quit the app
      app.isQuitting = true;
      app.quit();

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
});

app.on('activate', () => {
  if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
});

app.on('before-quit', () => {
  app.isQuitting = true;
  disconnectAgent();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
