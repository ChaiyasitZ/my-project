/**
 * WebSocket Client - Connects to backend server
 */

const WebSocket = require('ws');
const { EventEmitter } = require('events');

class WebSocketClient extends EventEmitter {
  constructor(serverUrl) {
    super();
    this.serverUrl = serverUrl;
    this.ws = null;
    this.connected = false;
    this.reconnectInterval = 5000;
    this.reconnectTimer = null;
    this.pingInterval = null;
    this.agentId = this.generateAgentId();
  }

  /**
   * Generate unique agent ID
   */
  generateAgentId() {
    const os = require('os');
    const crypto = require('crypto');
    
    const hostname = os.hostname();
    const platform = os.platform();
    const hash = crypto.createHash('md5').update(hostname + platform).digest('hex').substring(0, 8);
    
    return `agent-${hash}`;
  }

  /**
   * Get WebSocket URL from server URL
   */
  getWsUrl() {
    const url = new URL(this.serverUrl);
    const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${url.host}/agent`;
  }

  /**
   * Connect to server
   */
  connect() {
    if (this.ws && this.connected) {
      return;
    }

    try {
      const wsUrl = this.getWsUrl();
      console.log(`Connecting to ${wsUrl}...`);
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.on('open', () => {
        console.log('WebSocket connected');
        this.connected = true;
        this.emit('connected');
        
        // Send registration
        this.send('register', {
          agentId: this.agentId,
          hostname: require('os').hostname(),
          platform: require('os').platform(),
          version: '1.0.0'
        });
        
        // Start ping interval
        this.startPing();
        
        // Clear reconnect timer
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      });
      
      this.ws.on('message', (data) => {
        this.handleMessage(data);
      });
      
      this.ws.on('close', () => {
        console.log('WebSocket disconnected');
        this.connected = false;
        this.emit('disconnected');
        this.stopPing();
        this.scheduleReconnect();
      });
      
      this.ws.on('error', (error) => {
        console.log('WebSocket connection failed - server may be offline');
        this.emit('error', error);
      });
    } catch (error) {
      console.log('Failed to connect - will retry');
      this.scheduleReconnect();
    }
  }

  /**
   * Handle incoming message
   */
  handleMessage(data) {
    try {
      const message = JSON.parse(data.toString());
      console.log('Received message:', message.type);
      
      switch (message.type) {
        case 'registered':
          console.log('Agent registered with server');
          this.emit('registered', message.data);
          break;
          
        case 'ping':
          this.send('pong', { timestamp: Date.now() });
          break;
          
        case 'command':
          this.emit('command', message.data);
          break;
          
        default:
          this.emit('message', message);
      }
    } catch (error) {
      console.error('Failed to parse message:', error.message);
    }
  }

  /**
   * Send message to server
   */
  send(type, data = {}) {
    if (!this.connected || !this.ws) {
      console.warn('Cannot send message: not connected');
      return false;
    }
    
    try {
      const message = JSON.stringify({
        type,
        data,
        agentId: this.agentId,
        timestamp: Date.now()
      });
      
      this.ws.send(message);
      return true;
    } catch (error) {
      console.error('Failed to send message:', error.message);
      return false;
    }
  }

  /**
   * Start ping interval
   */
  startPing() {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      if (this.connected) {
        this.send('heartbeat', { timestamp: Date.now() });
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Stop ping interval
   */
  stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    if (this.reconnectTimer) {
      return;
    }
    
    console.log(`Reconnecting in ${this.reconnectInterval / 1000} seconds...`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectInterval);
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    this.stopPing();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.connected = false;
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.connected;
  }

  /**
   * Update server URL and reconnect
   */
  updateServerUrl(newUrl) {
    this.serverUrl = newUrl;
    this.disconnect();
    this.connect();
  }
}

module.exports = { WebSocketClient };
