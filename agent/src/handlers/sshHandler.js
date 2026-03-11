/**
 * SSH Handler - Manages SSH connections to local network devices
 * Executed on client machine, results sent back to cloud via WebSocket
 */

import { Client } from 'ssh2';

export class SSHHandler {
  constructor() {
    this.connections = new Map();
    this.sessions = new Map();
    this.sessionTimeout = 600000; // 10 minutes
  }

  /**
   * Connect to a device via SSH
   */
  async connect(deviceConfig) {
    const { deviceId, ip_address, host, ssh_port, port, username, password } = deviceConfig;
    const connectHost = ip_address || host;
    const connectPort = ssh_port || port || 22;

    // Clean up existing connection
    this.disconnect(deviceId);

    return new Promise((resolve, reject) => {
      const conn = new Client();

      const timeout = setTimeout(() => {
        conn.end();
        reject(new Error('SSH connection timeout - device unreachable'));
      }, 10000);

      conn.on('ready', () => {
        clearTimeout(timeout);
        this.connections.set(deviceId, {
          connection: conn,
          createdAt: Date.now(),
          lastUsed: Date.now(),
          ip_address: connectHost
        });
        resolve({ success: true, deviceId, message: `Connected to ${connectHost}` });
      });

      conn.on('error', (err) => {
        clearTimeout(timeout);
        this.connections.delete(deviceId);
        reject(new Error(`SSH error: ${err.message}`));
      });

      conn.on('keyboard-interactive', (name, instructions, lang, prompts, finish) => {
        finish([password]);
      });

      conn.connect({
        host: connectHost,
        port: connectPort,
        username,
        password,
        readyTimeout: 10000,
        keepaliveInterval: 10000,
        algorithms: {
          kex: [
            'ecdh-sha2-nistp256',
            'ecdh-sha2-nistp384',
            'ecdh-sha2-nistp521',
            'diffie-hellman-group14-sha256',
            'diffie-hellman-group14-sha1',
            'diffie-hellman-group1-sha1'
          ],
          cipher: [
            'aes128-ctr', 'aes192-ctr', 'aes256-ctr',
            'aes128-cbc', 'aes192-cbc', 'aes256-cbc',
            '3des-cbc',
            'aes128-gcm', 'aes128-gcm@openssh.com',
            'aes256-gcm', 'aes256-gcm@openssh.com'
          ],
          hmac: ['hmac-sha2-256', 'hmac-sha1', 'hmac-sha2-512'],
          serverHostKey: [
            'ssh-rsa', 'ssh-dss',
            'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521',
            'ssh-ed25519', 'rsa-sha2-256', 'rsa-sha2-512'
          ]
        },
        hostVerifier: () => true,
        tryKeyboard: true
      });
    });
  }

  /**
   * Execute a command on a connected device
   */
  async executeCommand(deviceId, command) {
    const entry = this.connections.get(deviceId);
    if (!entry) {
      throw new Error('Device not connected');
    }

    entry.lastUsed = Date.now();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Command execution timeout'));
      }, 30000);

      entry.connection.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timeout);
          return reject(err);
        }

        let output = '';
        let errorOutput = '';

        stream.on('data', (data) => {
          output += data.toString();
        });

        stream.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });

        stream.on('close', () => {
          clearTimeout(timeout);
          resolve({
            success: true,
            output: output.trim(),
            error: errorOutput.trim() || null
          });
        });
      });
    });
  }

  /**
   * Open interactive shell session for real-time terminal
   */
  async openShell(deviceId, onData, onClose) {
    const entry = this.connections.get(deviceId);
    if (!entry) {
      throw new Error('Device not connected');
    }

    return new Promise((resolve, reject) => {
      entry.connection.shell({ rows: 40, cols: 120 }, (err, stream) => {
        if (err) return reject(err);

        const sessionId = `${deviceId}_shell_${Date.now()}`;

        stream.on('data', (data) => {
          onData(data.toString());
        });

        stream.on('close', () => {
          this.sessions.delete(sessionId);
          if (onClose) onClose();
        });

        this.sessions.set(sessionId, {
          stream,
          deviceId,
          createdAt: Date.now()
        });

        resolve({ sessionId, stream });
      });
    });
  }

  /**
   * Write to an interactive shell session
   */
  writeToShell(sessionId, data) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Shell session not found');
    session.stream.write(data);
  }

  /**
   * Send configuration commands (enters config mode, sends commands, exits)
   */
  async sendConfig(deviceId, commands, enablePassword) {
    const entry = this.connections.get(deviceId);
    if (!entry) throw new Error('Device not connected');

    entry.lastUsed = Date.now();

    return new Promise((resolve, reject) => {
      entry.connection.shell((err, stream) => {
        if (err) return reject(err);

        let output = '';
        let commandIndex = 0;
        let lastSentTime = 0;
        const allCommands = [];

        // Build command sequence
        if (enablePassword) {
          allCommands.push('enable');
          allCommands.push(enablePassword);
        }
        allCommands.push('configure terminal');
        allCommands.push(...(Array.isArray(commands) ? commands : commands.split('\n').filter(c => c.trim())));
        allCommands.push('end');
        allCommands.push('write memory');

        const timeout = setTimeout(() => {
          stream.end();
          resolve({ success: true, output, partial: true });
        }, 60000);

        const trySendNext = () => {
          if (commandIndex >= allCommands.length) return;
          const now = Date.now();
          if (now - lastSentTime < 200) return; // Debounce

          // Check for prompt indicators in the last chunk of output
          const lastChunk = output.slice(-200);
          const hasPrompt = /[#>]\s*$/.test(lastChunk) || lastChunk.includes('Password:');
          
          if (hasPrompt) {
            const cmd = allCommands[commandIndex++];
            lastSentTime = now;
            stream.write(cmd + '\n');
            
            // If all commands sent, wait a bit then close
            if (commandIndex >= allCommands.length) {
              setTimeout(() => {
                stream.end();
              }, 2000);
            }
          }
        };

        stream.on('data', (data) => {
          output += data.toString();
          // Small delay to let the prompt fully arrive before checking
          setTimeout(trySendNext, 150);
        });

        stream.on('close', () => {
          clearTimeout(timeout);
          resolve({ success: true, output });
        });
      });
    });
  }

  /**
   * Execute backup commands via interactive shell.
   * Uses a single shell session to send 'terminal length 0' then the requested
   * show command(s). When configType is 'both', both running-config and
   * startup-config are fetched in the same session to avoid VTY line issues.
   *
   * Returns { output } for single type, or { runningOutput, startupOutput } for 'both'.
   */
  async execBackupCommands(deviceId, configType = 'running-config') {
    const entry = this.connections.get(deviceId);
    if (!entry) throw new Error('Device not connected');
    entry.lastUsed = Date.now();
    const isBoth = configType === 'both';
    return new Promise((resolve, reject) => {
      entry.connection.shell((err, stream) => {
        if (err) return reject(err);
        let output = '';
        let runningSplitIdx = 0;
        let settled = false;
        const totalTimeout = isBoth ? 30000 : 20000;
        const timeout = setTimeout(() => {
          if (!settled) { settled = true; stream.end(); finish(); }
        }, totalTimeout);
        const finish = () => {
          if (isBoth) {
            resolve({ runningOutput: output.substring(0, runningSplitIdx), startupOutput: output.substring(runningSplitIdx) });
          } else {
            resolve({ output });
          }
        };
        stream.on('data', (d) => { output += d.toString(); });
        stream.on('close', () => {
          if (!settled) { settled = true; clearTimeout(timeout); finish(); }
        });
        setTimeout(() => {
          stream.write('terminal length 0\n');
          setTimeout(() => {
            if (isBoth) {
              stream.write('show running-config\n');
              setTimeout(() => {
                runningSplitIdx = output.length;
                stream.write('show startup-config\n');
                setTimeout(() => {
                  if (!settled) { settled = true; clearTimeout(timeout); stream.end(); finish(); }
                }, 8000);
              }, 8000);
            } else {
              stream.write(`show ${configType}\n`);
              setTimeout(() => {
                if (!settled) { settled = true; clearTimeout(timeout); stream.end(); finish(); }
              }, 8000);
            }
          }, 1000);
        }, 1000);
      });
    });
  }

  /**
   * Check if device is connected
   */
  isConnected(deviceId) {
    return this.connections.has(deviceId);
  }

  /**
   * Disconnect from a device
   */
  disconnect(deviceId) {
    // Close any shell sessions
    for (const [sessionId, session] of this.sessions) {
      if (session.deviceId === deviceId) {
        try { session.stream.end(); } catch (e) {}
        this.sessions.delete(sessionId);
      }
    }

    const entry = this.connections.get(deviceId);
    if (entry) {
      try { entry.connection.end(); } catch (e) {}
      this.connections.delete(deviceId);
    }
  }

  /**
   * Disconnect all devices
   */
  async disconnectAll() {
    for (const [deviceId] of this.connections) {
      this.disconnect(deviceId);
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    const status = {};
    for (const [deviceId, entry] of this.connections) {
      status[deviceId] = {
        connected: true,
        ip_address: entry.ip_address,
        connectedSince: entry.createdAt,
        lastUsed: entry.lastUsed
      };
    }
    return status;
  }
}
