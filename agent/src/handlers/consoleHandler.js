/**
 * Console Handler - Manages serial console connections (placeholder)
 * Only works when agent runs on machine with physical console cable
 */

export class ConsoleHandler {
  constructor() {
    this.connections = new Map();
  }

  async connect(config) {
    // SerialPort is optional - only available if hardware is connected
    throw new Error('Console connections require physical serial cable. Use SSH instead.');
  }

  isConnected(deviceId) {
    return this.connections.has(deviceId);
  }

  disconnect(deviceId) {
    this.connections.delete(deviceId);
  }

  async disconnectAll() {
    this.connections.clear();
  }

  getStatus() {
    return {};
  }
}
