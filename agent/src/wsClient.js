/**
 * WebSocket Client - Connects agent to NetConfig cloud server
 * 
 * Protocol:
 * - Agent connects to server with auth token
 * - Server sends commands (ssh:connect, ssh:exec, netconf:connect, etc.)
 * - Agent executes locally and sends results back
 */

import { io } from 'socket.io-client';
import { EventEmitter } from 'events';
import os from 'os';

export class WebSocketClient extends EventEmitter {
  constructor({ serverUrl, agentToken, agentName, version, handlers }) {
    super();
    this.serverUrl = serverUrl;
    this.agentToken = agentToken;
    this.agentName = agentName;
    this.version = version;
    this.handlers = handlers;
    this.socket = null;
    this.sessionId = null;
    this.shellStreams = new Map(); // Track active shell sessions
  }

  /**
   * Connect to the server
   */
  async connect() {
    return new Promise((resolve, reject) => {
      this.socket = io(this.serverUrl, {
        path: '/agent-socket',
        auth: {
          token: this.agentToken,
          agentName: this.agentName,
          agentVersion: this.version,
          agentId: this.agentToken.split('.')[0] || 'unknown',
          platform: os.platform(),
          hostname: os.hostname()
        },
        reconnection: true,
        reconnectionDelay: 3000,
        reconnectionDelayMax: 30000,
        reconnectionAttempts: Infinity,
        timeout: 10000,
        transports: ['websocket', 'polling']
      });

      this.socket.on('connect', () => {
        this.sessionId = this.socket.id;
        this.emit('connected');
        resolve();
      });

      this.socket.on('connect_error', (err) => {
        this.emit('error', err);
        reject(err);
      });

      this.socket.on('disconnect', (reason) => {
        this.emit('disconnected', reason);
      });

      this.socket.on('reconnect', () => {
        this.sessionId = this.socket.id;
        this.emit('reconnected');
      });

      // Register command handlers
      this._registerHandlers();
    });
  }

  /**
   * Register all command handlers from the server
   */
  _registerHandlers() {
    // ─── SSH Commands ───
    
    this.socket.on('agent:ssh:connect', async (data, callback) => {
      this.emit('command', { type: 'ssh:connect', deviceId: data.deviceId });
      try {
        const result = await this.handlers.ssh.connect(data);
        callback({ success: true, ...result });
        this.emit('result', { type: 'ssh:connect', success: true });
      } catch (error) {
        callback({ success: false, error: error.message });
        this.emit('result', { type: 'ssh:connect', success: false });
      }
    });

    this.socket.on('agent:ssh:disconnect', async (data, callback) => {
      this.emit('command', { type: 'ssh:disconnect', deviceId: data.deviceId });
      try {
        this.handlers.ssh.disconnect(data.deviceId);
        callback({ success: true });
        this.emit('result', { type: 'ssh:disconnect', success: true });
      } catch (error) {
        callback({ success: false, error: error.message });
      }
    });

    this.socket.on('agent:ssh:exec', async (data, callback) => {
      this.emit('command', { type: 'ssh:exec', deviceId: data.deviceId });
      try {
        const result = await this.handlers.ssh.executeCommand(data.deviceId, data.command);
        callback({ success: true, ...result });
        this.emit('result', { type: 'ssh:exec', success: true });
      } catch (error) {
        callback({ success: false, error: error.message });
        this.emit('result', { type: 'ssh:exec', success: false });
      }
    });

    this.socket.on('agent:ssh:send-config', async (data, callback) => {
      this.emit('command', { type: 'ssh:send-config', deviceId: data.deviceId });
      try {
        const result = await this.handlers.ssh.sendConfig(data.deviceId, data.commands, data.enablePassword);
        callback({ success: true, ...result });
        this.emit('result', { type: 'ssh:send-config', success: true });
      } catch (error) {
        callback({ success: false, error: error.message });
        this.emit('result', { type: 'ssh:send-config', success: false });
      }
    });

    // ─── SSH Interactive Shell ───

    this.socket.on('agent:ssh:open-shell', async (data, callback) => {
      this.emit('command', { type: 'ssh:open-shell', deviceId: data.deviceId });
      try {
        const { sessionId, stream } = await this.handlers.ssh.openShell(
          data.deviceId,
          // onData: stream output to web app
          (output) => {
            this.socket.emit('agent:shell:data', { 
              deviceId: data.deviceId, 
              sessionId, 
              data: output 
            });
          },
          // onClose: notify web app
          () => {
            this.socket.emit('agent:shell:closed', { 
              deviceId: data.deviceId, 
              sessionId 
            });
            this.shellStreams.delete(sessionId);
          }
        );
        this.shellStreams.set(sessionId, { stream, deviceId: data.deviceId });
        callback({ success: true, sessionId });
        this.emit('result', { type: 'ssh:open-shell', success: true });
      } catch (error) {
        callback({ success: false, error: error.message });
        this.emit('result', { type: 'ssh:open-shell', success: false });
      }
    });

    this.socket.on('agent:ssh:shell-input', (data) => {
      try {
        this.handlers.ssh.writeToShell(data.sessionId, data.data);
      } catch (error) {
        // Session might be closed
      }
    });

    this.socket.on('agent:ssh:close-shell', (data) => {
      const entry = this.shellStreams.get(data.sessionId);
      if (entry) {
        try { entry.stream.end(); } catch (e) {}
        this.shellStreams.delete(data.sessionId);
      }
    });

    // ─── NETCONF Commands ───

    this.socket.on('agent:netconf:connect', async (data, callback) => {
      this.emit('command', { type: 'netconf:connect', deviceId: data.deviceId });
      try {
        const result = await this.handlers.netconf.connect(data);
        callback({ success: true, ...result });
        this.emit('result', { type: 'netconf:connect', success: true });
      } catch (error) {
        callback({ success: false, error: error.message });
        this.emit('result', { type: 'netconf:connect', success: false });
      }
    });

    this.socket.on('agent:netconf:disconnect', async (data, callback) => {
      this.emit('command', { type: 'netconf:disconnect', deviceId: data.deviceId });
      try {
        this.handlers.netconf.disconnect(data.deviceId);
        callback({ success: true });
        this.emit('result', { type: 'netconf:disconnect', success: true });
      } catch (error) {
        callback({ success: false, error: error.message });
      }
    });

    this.socket.on('agent:netconf:get-config', async (data, callback) => {
      this.emit('command', { type: 'netconf:get-config', deviceId: data.deviceId });
      try {
        const result = await this.handlers.netconf.getConfig(data.deviceId, data.filter);
        callback({ success: true, ...result });
        this.emit('result', { type: 'netconf:get-config', success: true });
      } catch (error) {
        callback({ success: false, error: error.message });
        this.emit('result', { type: 'netconf:get-config', success: false });
      }
    });

    this.socket.on('agent:netconf:edit-config', async (data, callback) => {
      this.emit('command', { type: 'netconf:edit-config', deviceId: data.deviceId });
      try {
        const result = await this.handlers.netconf.editConfig(data.deviceId, data.config);
        callback({ success: true, ...result });
        this.emit('result', { type: 'netconf:edit-config', success: true });
      } catch (error) {
        callback({ success: false, error: error.message });
        this.emit('result', { type: 'netconf:edit-config', success: false });
      }
    });

    this.socket.on('agent:netconf:rpc', async (data, callback) => {
      this.emit('command', { type: 'netconf:rpc', deviceId: data.deviceId });
      try {
        const result = await this.handlers.netconf.sendRPC(data.deviceId, data.rpcBody);
        callback({ success: true, ...result });
        this.emit('result', { type: 'netconf:rpc', success: true });
      } catch (error) {
        callback({ success: false, error: error.message });
        this.emit('result', { type: 'netconf:rpc', success: false });
      }
    });

    // ─── Status Commands ───

    this.socket.on('agent:status', (data, callback) => {
      callback({
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
        }
      });
    });

    this.socket.on('agent:ping', (data, callback) => {
      callback({ pong: true, timestamp: Date.now() });
    });
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}
