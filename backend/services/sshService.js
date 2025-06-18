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
      console.log(`🔧 Starting configuration deployment to ${deviceConfig.ip_address}`);
      console.log(`📝 Commands to deploy:\n${commands}`);
      
      let conn = this.connections.get(deviceConfig.id);
      
      if (!conn) {
        conn = await this.connect(deviceConfig);
      }

      return new Promise((resolve, reject) => {
        conn.shell({ pty: true }, (err, stream) => {
          if (err) {
            reject(new Error(`Failed to create shell: ${err.message}`));
            return;
          }

          let output = '';
          let currentStep = 0;
          let commandComplete = false;
          
          // Prepare commands
          const configCommands = commands.split('\n')
            .map(cmd => cmd.trim())
            .filter(cmd => cmd && !cmd.startsWith('configure terminal') && !cmd.startsWith('end') && !cmd.startsWith('exit'));
          
          const allCommands = [
            'enable',
            'configure terminal',
            ...configCommands,
            'end',
            'write memory'
          ];
          
          console.log(`📋 Prepared commands:`, allCommands);
          
          const timeout = setTimeout(() => {
            if (!commandComplete) {
              stream.end();
              reject(new Error('Configuration deployment timeout (60 seconds)'));
            }
          }, 60000); // 60 second timeout

          const sendNextCommand = () => {
            if (currentStep >= allCommands.length) {
              commandComplete = true;
              clearTimeout(timeout);
              
              console.log(`✅ All commands sent successfully to ${deviceConfig.ip_address}`);
              
              // Wait a bit for final output then close
              setTimeout(() => {
                stream.end();
                resolve({
                  success: true,
                  output: output.trim(),
                  commandsExecuted: allCommands
                });
              }, 2000);
              return;
            }
            
            const command = allCommands[currentStep];
            console.log(`➡️ Sending command ${currentStep + 1}/${allCommands.length}: ${command}`);
            
            stream.write(command + '\r\n');
            currentStep++;
          };

          stream.on('data', (data) => {
            const chunk = data.toString();
            output += chunk;
            console.log(`📥 Received: ${chunk.trim()}`);
            
            // Check for various Cisco prompts and send next command
            if (chunk.includes('#') || 
                chunk.includes('Password:') || 
                chunk.includes('(config)#') ||
                chunk.includes('(config-') ||
                chunk.includes('[OK]') ||
                chunk.includes('Building configuration')) {
              
              // Small delay to ensure prompt is complete
              setTimeout(sendNextCommand, 500);
            }
            
            // Handle password prompt specifically
            if (chunk.toLowerCase().includes('password:')) {
              stream.write(deviceConfig.password + '\r\n');
            }
            
            // Check for errors
            if (chunk.includes('% Invalid') || 
                chunk.includes('% Ambiguous') ||
                chunk.includes('% Incomplete') ||
                chunk.includes('% Unknown')) {
              console.log(`⚠️ Warning: Possible command error detected: ${chunk.trim()}`);
            }
          });

          stream.on('close', () => {
            clearTimeout(timeout);
            if (!commandComplete) {
              reject(new Error('SSH session closed unexpectedly'));
            }
          });

          stream.on('error', (error) => {
            clearTimeout(timeout);
            reject(new Error(`SSH stream error: ${error.message}`));
          });

          // Start the process - wait for initial prompt
          console.log(`🚀 Waiting for initial prompt from ${deviceConfig.ip_address}`);
        });
      });
    } catch (error) {
      console.error(`❌ Configuration deployment failed:`, error.message);
      throw new Error(`Configuration deployment failed: ${error.message}`);
    }
  }

  async testConnection(deviceConfig) {
    try {
      console.log(`🧪 Testing connection to ${deviceConfig.ip_address}`);
      const conn = await this.connect(deviceConfig);
      
      // Test with a simple command that doesn't require enable mode
      const result = await this.executeCommand(deviceConfig, 'show version | include Software');
      this.disconnect(deviceConfig.id);
      
      console.log(`✅ Connection test successful for ${deviceConfig.ip_address}`);
      return {
        success: true,
        message: 'Connection successful',
        version: result.output
      };
    } catch (error) {
      console.error(`❌ Connection test failed for ${deviceConfig.ip_address}:`, error.message);
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
      console.log(`🔌 Disconnected device ID: ${deviceId}`);
    }
  }

  disconnectAll() {
    console.log(`🔌 Disconnecting all SSH connections (${this.connections.size} active)`);
    for (const [deviceId, conn] of this.connections) {
      conn.end();
    }
    this.connections.clear();
  }
}

export default new SSHService(); 