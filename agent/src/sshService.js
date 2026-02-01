/**
 * SSH Service - Execute commands on devices via SSH
 */

const { Client } = require('ssh2');

class SSHService {
  constructor() {
    this.defaultPort = 22;
    this.defaultTimeout = 30000; // 30 seconds
  }

  /**
   * Create SSH connection to device
   */
  connect(device) {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      
      const config = {
        host: device.ip,
        port: device.sshPort || this.defaultPort,
        username: device.username || 'admin',
        password: device.password || '',
        readyTimeout: this.defaultTimeout,
        algorithms: {
          kex: [
            'ecdh-sha2-nistp256',
            'ecdh-sha2-nistp384',
            'ecdh-sha2-nistp521',
            'diffie-hellman-group-exchange-sha256',
            'diffie-hellman-group14-sha256',
            'diffie-hellman-group14-sha1',
            'diffie-hellman-group1-sha1'
          ],
          cipher: [
            'aes128-ctr',
            'aes192-ctr',
            'aes256-ctr',
            'aes128-gcm@openssh.com',
            'aes256-gcm@openssh.com',
            'aes128-cbc',
            'aes256-cbc',
            '3des-cbc'
          ]
        }
      };
      
      // Add private key if provided
      if (device.privateKey) {
        config.privateKey = device.privateKey;
        delete config.password;
      }
      
      conn.on('ready', () => {
        resolve(conn);
      });
      
      conn.on('error', (err) => {
        reject(err);
      });
      
      conn.on('timeout', () => {
        reject(new Error('SSH connection timeout'));
      });
      
      conn.connect(config);
    });
  }

  /**
   * Test SSH connection
   */
  async testConnection(device) {
    try {
      const conn = await this.connect(device);
      conn.end();
      return { success: true, message: 'SSH connection successful' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Execute single command
   */
  executeCommand(conn, command) {
    return new Promise((resolve, reject) => {
      let output = '';
      let errorOutput = '';
      
      conn.exec(command, (err, stream) => {
        if (err) {
          reject(err);
          return;
        }
        
        stream.on('close', (code) => {
          resolve({
            output: output.trim(),
            errorOutput: errorOutput.trim(),
            exitCode: code
          });
        });
        
        stream.on('data', (data) => {
          output += data.toString();
        });
        
        stream.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });
      });
    });
  }

  /**
   * Execute multiple commands in sequence
   */
  async execute(device, commands) {
    const conn = await this.connect(device);
    
    try {
      const results = [];
      const commandList = Array.isArray(commands) ? commands : [commands];
      
      // For Cisco devices, we need to use shell mode
      const output = await this.executeShell(conn, commandList);
      
      conn.end();
      return output;
    } catch (error) {
      conn.end();
      throw error;
    }
  }

  /**
   * Execute commands in interactive shell (for Cisco devices)
   */
  executeShell(conn, commands) {
    return new Promise((resolve, reject) => {
      conn.shell((err, stream) => {
        if (err) {
          reject(err);
          return;
        }
        
        let output = '';
        let commandIndex = 0;
        let commandSent = false;
        
        const timeout = setTimeout(() => {
          stream.end();
          resolve(output);
        }, this.defaultTimeout);
        
        stream.on('close', () => {
          clearTimeout(timeout);
          resolve(output);
        });
        
        stream.on('data', (data) => {
          const chunk = data.toString();
          output += chunk;
          
          // Check for prompt (# or >) and send next command
          if ((chunk.includes('#') || chunk.includes('>')) && !commandSent) {
            if (commandIndex < commands.length) {
              commandSent = true;
              setTimeout(() => {
                stream.write(commands[commandIndex] + '\n');
                commandIndex++;
                commandSent = false;
                
                // End after all commands
                if (commandIndex >= commands.length) {
                  setTimeout(() => {
                    stream.write('exit\n');
                  }, 500);
                }
              }, 100);
            }
          }
        });
        
        stream.stderr.on('data', (data) => {
          output += data.toString();
        });
      });
    });
  }

  /**
   * Get device configuration
   */
  async getConfig(device, configType = 'running-config') {
    const commands = [
      'terminal length 0',
      `show ${configType}`
    ];
    
    return await this.execute(device, commands);
  }

  /**
   * Apply configuration commands
   */
  async applyConfig(device, configCommands) {
    const commands = [
      'terminal length 0',
      'configure terminal',
      ...(Array.isArray(configCommands) ? configCommands : configCommands.split('\n')),
      'end',
      'write memory'
    ];
    
    return await this.execute(device, commands);
  }
}

module.exports = { SSHService };
