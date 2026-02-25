/**
 * Console Handler - Manages serial console connections to network devices
 * Uses serialport module to communicate with devices via USB-to-serial cables
 */

let SerialPort, ReadlineParser;
try {
  const sp = await import('serialport');
  SerialPort = sp.SerialPort;
  const rp = await import('@serialport/parser-readline');
  ReadlineParser = rp.ReadlineParser;
} catch (e) {
  console.warn('⚠️ serialport not available - console features require serialport module');
}

export class ConsoleHandler {
  constructor() {
    this.connections = new Map();
  }

  /**
   * List available serial ports
   */
  async listPorts() {
    if (!SerialPort) {
      throw new Error('serialport module not available');
    }
    const ports = await SerialPort.list();

    const formatted = ports.map(port => {
      let displayName = port.path;
      if (port.manufacturer && !port.manufacturer.includes('Unknown')) {
        if (port.manufacturer.toLowerCase().includes('ftdi')) {
          displayName = `${port.path} - FTDI USB Serial`;
        } else if (port.manufacturer.toLowerCase().includes('prolific')) {
          displayName = `${port.path} - Prolific USB Serial`;
        } else if (port.manufacturer.toLowerCase().includes('silicon')) {
          displayName = `${port.path} - Silicon Labs USB Serial`;
        } else {
          displayName = `${port.path} - ${port.manufacturer}`;
        }
      } else if (port.friendlyName && port.friendlyName !== port.path) {
        let cleanName = port.friendlyName.replace(/\s*\([A-Z]+\d+\)\s*/g, '');
        cleanName = cleanName.replace('Standard Serial over Bluetooth link', 'Bluetooth Serial');
        cleanName = cleanName.replace('USB Serial Port', 'USB Serial');
        if (cleanName && cleanName !== port.path) {
          displayName = `${port.path} - ${cleanName}`;
        }
      }
      return {
        path: port.path,
        manufacturer: port.manufacturer || 'Unknown',
        serialNumber: port.serialNumber || 'N/A',
        vendorId: port.vendorId || 'N/A',
        productId: port.productId || 'N/A',
        friendlyName: displayName,
        isUSB: !!(port.vendorId || port.manufacturer?.toLowerCase().includes('usb'))
      };
    });

    // Filter out bluetooth / virtual ports
    const valid = formatted.filter(p => {
      const lower = (p.path + p.friendlyName).toLowerCase();
      return !['bluetooth', 'virtual', 'loopback'].some(s => lower.includes(s));
    });

    return { success: true, ports: valid, count: valid.length };
  }

  /**
   * Connect to a device via serial console
   */
  async connect(config) {
    if (!SerialPort) throw new Error('serialport module not available');
    const { deviceId, portPath, baudRate = 9600, dataBits = 8, parity = 'none', stopBits = 1 } = config;
    this.disconnect(deviceId);

    return new Promise((resolve, reject) => {
      const port = new SerialPort({
        path: portPath,
        baudRate,
        dataBits,
        parity,
        stopBits,
        autoOpen: false
      });

      port.open((err) => {
        if (err) return reject(new Error(`Failed to open ${portPath}: ${err.message}`));
        this.connections.set(deviceId, { port, portPath, createdAt: Date.now() });
        resolve({ success: true, message: `Connected to ${portPath}`, deviceId });
      });

      port.on('error', (err) => {
        console.error(`Serial port error (${portPath}):`, err.message);
      });
    });
  }

  /**
   * Send a command and wait for response
   */
  async sendCommand(deviceId, command, waitForPrompt = true) {
    const entry = this.connections.get(deviceId);
    if (!entry) throw new Error('Device not connected via console');

    return new Promise((resolve, reject) => {
      let output = '';
      const timeout = setTimeout(() => {
        entry.port.removeListener('data', onData);
        resolve({ output: output || '(no response)', deviceId });
      }, waitForPrompt ? 10000 : 2000);

      const onData = (data) => {
        output += data.toString();
        // Check for common prompt endings
        if (waitForPrompt && /[#>$]\s*$/.test(output)) {
          clearTimeout(timeout);
          entry.port.removeListener('data', onData);
          resolve({ output, deviceId });
        }
      };

      entry.port.on('data', onData);
      entry.port.write(command + '\r\n', (err) => {
        if (err) {
          clearTimeout(timeout);
          entry.port.removeListener('data', onData);
          reject(new Error(`Write failed: ${err.message}`));
        }
      });
    });
  }

  /**
   * Test console connection
   */
  async testConnection(config) {
    try {
      await this.connect(config);
      // Send empty line and wait for response
      const result = await this.sendCommand(config.deviceId || `test_${Date.now()}`, '', true);
      this.disconnect(config.deviceId || `test_${Date.now()}`);
      return { success: true, message: 'Console connection test passed', response: result.output };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  /**
   * Send initial configuration commands
   */
  async sendInitialConfig(deviceId, configCommands) {
    const entry = this.connections.get(deviceId);
    if (!entry) throw new Error('Device not connected via console');

    const commands = configCommands.split('\n').map(c => c.trim()).filter(c => c);
    const results = [];

    for (const cmd of commands) {
      try {
        const result = await this.sendCommand(deviceId, cmd, true);
        results.push({ command: cmd, output: result.output, success: true });
      } catch (err) {
        results.push({ command: cmd, output: err.message, success: false });
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return {
      success: failed === 0,
      results,
      summary: { total: commands.length, successful, failed },
      fullOutput: results.map(r => `${r.command}\n${r.output}`).join('\n')
    };
  }

  isConnected(deviceId) {
    return this.connections.has(deviceId);
  }

  disconnect(deviceId) {
    const entry = this.connections.get(deviceId);
    if (entry) {
      try { entry.port.close(); } catch (e) {}
      this.connections.delete(deviceId);
    }
  }

  async disconnectAll() {
    for (const [id] of this.connections) this.disconnect(id);
  }

  getStatus(deviceId) {
    if (deviceId) {
      const entry = this.connections.get(deviceId);
      return entry ? { connected: true, portPath: entry.portPath, connectedAt: entry.createdAt } : { connected: false };
    }
    return { activeSessions: this.connections.size };
  }
}
