import { Client } from 'ssh2';
import { promisify } from 'util';

export class SSHService {
  constructor() {
    this.connections = new Map(); // Store active connections
  }

  async connect(deviceConfig) {
    const { id, ip_address, ssh_port, username, password } = deviceConfig;
    
    return new Promise((resolve, reject) => {
      const conn = new Client();
      
      const timeout = setTimeout(() => {
        conn.end();
        reject(new Error('SSH connection timeout'));
      }, 10000); // 10 second timeout

      conn.on('ready', () => {
        clearTimeout(timeout);
        console.log(`✅ SSH connected to ${ip_address}`);
        this.connections.set(id, conn);
        resolve(conn);
      });

      conn.on('error', (err) => {
        clearTimeout(timeout);
        console.error(`❌ SSH connection error for ${ip_address}:`, err.message);
        reject(err);
      });

      conn.on('close', () => {
        console.log(`🔌 SSH connection closed for ${ip_address}`);
        this.connections.delete(id);
      });

      conn.connect({
        host: ip_address,
        port: ssh_port || 22,
        username,
        password,
        readyTimeout: 10000,
        algorithms: {
          kex: ['diffie-hellman-group14-sha256', 'diffie-hellman-group14-sha1'],
          cipher: ['aes128-ctr', 'aes192-ctr', 'aes256-ctr'],
          hmac: ['hmac-sha2-256', 'hmac-sha2-512', 'hmac-sha1'],
        },
      });
    });
  }

  async executeCommand(deviceConfig, command) {
    try {
      let conn = this.connections.get(deviceConfig.id);
      
      if (!conn) {
        conn = await this.connect(deviceConfig);
      }

      return new Promise((resolve, reject) => {
        conn.exec(command, (err, stream) => {
          if (err) {
            reject(err);
            return;
          }

          let output = '';
          let errorOutput = '';

          stream.on('close', (code, signal) => {
            if (code === 0) {
              resolve({
                success: true,
                output: output.trim(),
                exitCode: code
              });
            } else {
              reject(new Error(`Command failed with exit code ${code}: ${errorOutput}`));
            }
          });

          stream.on('data', (data) => {
            output += data.toString();
          });

          stream.stderr.on('data', (data) => {
            errorOutput += data.toString();
          });
        });
      });
    } catch (error) {
      throw new Error(`SSH execution failed: ${error.message}`);
    }
  }

  async sendConfigCommands(deviceConfig, commands) {
    try {
      let conn = this.connections.get(deviceConfig.id);
      
      if (!conn) {
        conn = await this.connect(deviceConfig);
      }

      return new Promise((resolve, reject) => {
        conn.shell((err, stream) => {
          if (err) {
            reject(err);
            return;
          }

          let output = '';
          let isComplete = false;
          
          const timeout = setTimeout(() => {
            if (!isComplete) {
              reject(new Error('Configuration timeout'));
            }
          }, 30000); // 30 second timeout

          stream.on('close', () => {
            clearTimeout(timeout);
            if (!isComplete) {
              isComplete = true;
              resolve({
                success: true,
                output: output.trim()
              });
            }
          });

          stream.on('data', (data) => {
            output += data.toString();
            
            // Check if we're in config mode and ready for commands
            if (output.includes('#') || output.includes('(config)#')) {
              // Send commands one by one
              const commandsToSend = [
                'configure terminal',
                ...commands.split('\n').filter(cmd => cmd.trim()),
                'end',
                'write memory',
                'exit'
              ];
              
              commandsToSend.forEach((cmd, index) => {
                setTimeout(() => {
                  stream.write(cmd + '\n');
                  if (index === commandsToSend.length - 1) {
                    setTimeout(() => {
                      isComplete = true;
                      clearTimeout(timeout);
                      stream.end();
                    }, 2000);
                  }
                }, index * 500); // 500ms delay between commands
              });
            }
          });

          // Start the session
          stream.write('\n');
        });
      });
    } catch (error) {
      throw new Error(`Configuration failed: ${error.message}`);
    }
  }

  async testConnection(deviceConfig) {
    try {
      const conn = await this.connect(deviceConfig);
      const result = await this.executeCommand(deviceConfig, 'show version | include Software');
      this.disconnect(deviceConfig.id);
      return {
        success: true,
        message: 'Connection successful',
        version: result.output
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  disconnect(deviceId) {
    const conn = this.connections.get(deviceId);
    if (conn) {
      conn.end();
      this.connections.delete(deviceId);
    }
  }

  disconnectAll() {
    for (const [deviceId, conn] of this.connections) {
      conn.end();
    }
    this.connections.clear();
  }
}

export default new SSHService(); 