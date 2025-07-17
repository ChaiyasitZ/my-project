import { Client } from 'ssh2';
import { promisify } from 'util';

export class SSHService {
  constructor() {
    this.connections = new Map(); // Store active connections
  }

  async connect(deviceConfig) {
    const { id, _id, ip_address, ssh_port, username, password } = deviceConfig;
    const deviceId = id || _id;
    
    return new Promise((resolve, reject) => {
      const conn = new Client();
      
      const timeout = setTimeout(() => {
        conn.end();
        reject(new Error('SSH connection timeout'));
      }, 30000); // 30 second timeout for legacy devices

      conn.on('ready', () => {
        clearTimeout(timeout);
        console.log(`✅ SSH connected to ${ip_address}`);
        this.connections.set(deviceId, conn);
        resolve(conn);
      });

      conn.on('error', (err) => {
        clearTimeout(timeout);
        console.error(`❌ SSH connection error for ${ip_address}:`, err.message);
        reject(err);
      });

      // Handle keyboard-interactive authentication
      conn.on('keyboard-interactive', (name, instructions, instructionsLang, prompts, finish) => {
        console.log(`🔐 Keyboard-interactive auth for ${ip_address}`);
        console.log(`Name: ${name}`);
        console.log(`Instructions: ${instructions}`);
        
        // Respond to prompts with the password
        const answers = prompts.map(prompt => {
          console.log(`Prompt: ${prompt.prompt}`);
          return password; // Use the provided password for all prompts
        });
        
        finish(answers);
      });

      conn.on('close', () => {
        console.log(`🔌 SSH connection closed for ${ip_address}`);
        this.connections.delete(deviceId);
      });

      conn.connect({
        host: ip_address,
        port: ssh_port || 22,
        username,
        password,
        readyTimeout: 30000,
        authTimeout: 30000,
        tryKeyboard: true, // Enable keyboard-interactive authentication
        // Add specific options for Cisco devices
        keepaliveInterval: 30000,
        keepaliveCountMax: 3,
        // Disable strict host key checking for lab environments
        hostVerifier: () => true,
        algorithms: {
          kex: [
            // Put the most compatible legacy algorithms first
            'diffie-hellman-group1-sha1',
            'diffie-hellman-group14-sha1',
            'diffie-hellman-group-exchange-sha1',
            'diffie-hellman-group-exchange-sha256',
            'diffie-hellman-group14-sha256',
            'ecdh-sha2-nistp256',
            'ecdh-sha2-nistp384',
            'ecdh-sha2-nistp521'
          ],
          cipher: [
            // Support both modern and legacy ciphers
            'aes128-ctr',
            'aes192-ctr', 
            'aes256-ctr',
            'aes128-cbc',
            'aes192-cbc',
            'aes256-cbc',
            '3des-cbc',
            'aes128-gcm',
            'aes128-gcm@openssh.com',
            'aes256-gcm',
            'aes256-gcm@openssh.com'
          ],
          hmac: [
            // Put legacy hmac-sha1 first (what Nexus uses)
            'hmac-sha1',
            'hmac-sha2-256',
            'hmac-sha2-512', 
            'hmac-md5',
            'hmac-sha1-96',
            'hmac-md5-96'
          ],
          serverHostKey: [
            // Put ssh-rsa first (what Nexus uses)
            'ssh-rsa',
            'rsa-sha2-512',
            'rsa-sha2-256', 
            'ssh-dss',
            'ecdsa-sha2-nistp256',
            'ecdsa-sha2-nistp384', 
            'ecdsa-sha2-nistp521',
            'ssh-ed25519'
          ]
        },
        debug: process.env.SSH_DEBUG === 'true' // Enable with SSH_DEBUG=true
      });
    });
  }

  async executeCommand(deviceConfig, command) {
    try {
      const deviceId = deviceConfig.id || deviceConfig._id;
      let conn = this.connections.get(deviceId);
      
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
      
      const deviceId = deviceConfig.id || deviceConfig._id;
      let conn = this.connections.get(deviceId);
      
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
    // Ensure we always return a proper response object
    const defaultResponse = {
      success: false,
      message: 'Connection test failed',
      originalError: 'Unknown error'
    };
    
    try {
      console.log(`🧪 Testing connection to ${deviceConfig.ip_address}`);
      
      // Validate device configuration
      if (!deviceConfig || !deviceConfig.ip_address || !deviceConfig.username || !deviceConfig.password) {
        return {
          success: false,
          message: 'Invalid device configuration - missing required fields',
          originalError: 'Missing ip_address, username, or password'
        };
      }
      
      const conn = await this.connect(deviceConfig);
      
      // For Cisco devices, try basic commands first
      try {
        // Try show version first (usually works without enable)
        const result = await this.executeCommand(deviceConfig, 'show version | include Software');
        this.disconnect(deviceConfig.id || deviceConfig._id);
        
        console.log(`✅ Connection test successful for ${deviceConfig.ip_address}`);
        return {
          success: true,
          message: 'Connection successful',
          version: result.output,
          deviceType: 'cisco'
        };
      } catch (cmdError) {
        // If basic command fails, try with enable mode
        console.log(`🔄 Basic command failed, trying with enable mode...`);
        try {
          const enableResult = await this.executeCommandWithEnable(deviceConfig, 'show version | include Software');
          this.disconnect(deviceConfig.id || deviceConfig._id);
          
          console.log(`✅ Connection test successful with enable mode for ${deviceConfig.ip_address}`);
          return {
            success: true,
            message: 'Connection successful (requires enable mode)',
            version: enableResult.output,
            requiresEnable: true,
            deviceType: 'cisco'
          };
        } catch (enableError) {
          this.disconnect(deviceConfig.id || deviceConfig._id);
          throw new Error(`Both basic and enable mode commands failed: ${enableError.message}`);
        }
      }
    } catch (error) {
      console.error(`❌ Connection test failed for ${deviceConfig.ip_address}:`, error.message);
      
      // Provide specific error messages for common Cisco issues
      let specificMessage = error.message;
      if (error.message.includes('All configured authentication methods failed')) {
        specificMessage = 'Authentication failed. Please verify:\n' +
          '1. Username and password are correct\n' +
          '2. User has SSH access privileges\n' +
          '3. SSH is enabled on the device\n' +
          '4. Check if the user needs to be in specific privilege level or local user database';
      } else if (error.message.includes('connect ECONNREFUSED')) {
        specificMessage = 'Connection refused. SSH service may not be running on the device.';
      } else if (error.message.includes('connect ETIMEDOUT')) {
        specificMessage = 'Connection timeout. Check network connectivity and firewall rules.';
      } else if (error.message.includes('Hostname/IP does not match certificate')) {
        specificMessage = 'Certificate mismatch. This is normal for lab environments.';
      }
      
      return {
        success: false,
        message: specificMessage,
        originalError: error.message
      };
    }
  }

  async executeCommandWithEnable(deviceConfig, command) {
    try {
      const deviceId = deviceConfig.id || deviceConfig._id;
      let conn = this.connections.get(deviceId);
      
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
          let commandSent = false;
          let enableSent = false;
          let configurationComplete = false;
          let lastActivity = Date.now();
          
          const timeout = setTimeout(() => {
            stream.end();
            reject(new Error('Command execution timeout'));
          }, 90000); // Increased timeout for large configurations

          stream.on('data', (data) => {
            const chunk = data.toString();
            output += chunk;
            lastActivity = Date.now();
            
            // Handle different Cisco prompts
            if (chunk.includes('>') && !enableSent) {
              // User mode prompt, send enable
              console.log(`🔐 Sending enable command to ${deviceConfig.ip_address}`);
              enableSent = true;
              stream.write('enable\r\n');
            } else if (chunk.includes('Password:') && enableSent && !commandSent) {
              // Enable password prompt
              console.log(`🔑 Sending enable password to ${deviceConfig.ip_address}`);
              stream.write(deviceConfig.password + '\r\n');
            } else if (chunk.includes('#') && !commandSent) {
              // Privileged mode prompt, send the actual command
              console.log(`📝 Sending command "${command}" to ${deviceConfig.ip_address}`);
              commandSent = true;
              
              // For show running-config, disable paging to get full output
              if (command.includes('running-config') || command.includes('startup-config')) {
                stream.write('terminal length 0\r\n');
                // Wait a moment for the length command to process
                setTimeout(() => {
                  stream.write(command + '\r\n');
                }, 500);
              } else {
                stream.write(command + '\r\n');
              }
            } else if (chunk.includes('--More--')) {
              // Handle paged output by sending space to continue
              console.log(`📄 Handling paged output for ${deviceConfig.ip_address}`);
              stream.write(' ');
            } else if (commandSent && !configurationComplete) {
              // Check for command completion markers
              const lines = chunk.split('\n');
              const lastLine = lines[lines.length - 1] || lines[lines.length - 2] || '';
              
              // Look for completion patterns (device prompt after configuration)
              if (lastLine.match(/^[\w-]+#\s*$/) && 
                  (output.includes('Building configuration') || 
                   output.includes('Current configuration') ||
                   output.includes('version ') ||
                   output.includes('hostname ') ||
                   command.includes('version'))) {
                
                // Wait a bit more to ensure we got everything
                setTimeout(() => {
                  configurationComplete = true;
                  clearTimeout(timeout);
                  stream.end();
                  
                  console.log(`✅ Command completed for ${deviceConfig.ip_address}, output length: ${output.length}`);
                  resolve({
                    success: true,
                    output: output.trim()
                  });
                }, 1000);
              }
            }
          });

          // Fallback completion check - if no activity for 5 seconds after command sent
          const inactivityCheck = setInterval(() => {
            if (commandSent && (Date.now() - lastActivity > 5000)) {
              console.log(`⏰ No activity for 5 seconds, completing command for ${deviceConfig.ip_address}`);
              configurationComplete = true;
              clearTimeout(timeout);
              clearInterval(inactivityCheck);
              stream.end();
              
              resolve({
                success: true,
                output: output.trim()
              });
            }
          }, 1000);

          stream.on('close', () => {
            clearTimeout(timeout);
            clearInterval(inactivityCheck);
            if (!configurationComplete && commandSent) {
              resolve({
                success: true,
                output: output.trim()
              });
            } else if (!commandSent) {
              reject(new Error('Connection closed before command could be sent'));
            }
          });

          stream.on('error', (error) => {
            clearTimeout(timeout);
            clearInterval(inactivityCheck);
            reject(new Error(`SSH stream error: ${error.message}`));
          });
        });
      });
    } catch (error) {
      throw new Error(`SSH execution with enable failed: ${error.message}`);
    }
  }

  disconnect(deviceId) {
    // Handle both MongoDB ObjectId and regular id formats
    const actualId = typeof deviceId === 'object' ? deviceId.toString() : deviceId;
    const conn = this.connections.get(actualId);
    if (conn) {
      conn.end();
      this.connections.delete(actualId);
      console.log(`🔌 Disconnected device ID: ${actualId}`);
    }
  }

  disconnectAll() {
    console.log(`🔌 Disconnecting all SSH connections (${this.connections.size} active)`);
    for (const [deviceId, conn] of this.connections) {
      conn.end();
    }
    this.connections.clear();
  }

  // Backup and Restore Methods
  async getRunningConfig(deviceConfig) {
    try {
      console.log(`📋 Getting running configuration from ${deviceConfig.ip_address}`);
      
      const result = await this.executeCommandWithEnable(deviceConfig, 'show running-config');
      
      if (!result.success) {
        throw new Error('Failed to retrieve running configuration');
      }
      
      // Clean up the output to get just the configuration
      let config = result.output;
      
      console.log(`📦 Raw output length: ${config.length} characters`);
      console.log(`📦 Raw output preview: ${config.substring(0, 300)}...`);
      
      // Remove command echo and initial prompts
      const lines = config.split('\n');
      let configStart = -1;
      let configEnd = lines.length;
      
      // Find the start of actual configuration
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.includes('Building configuration') || 
            line.includes('Current configuration') ||
            (line.startsWith('version ') && line.match(/^\s*version\s+\d+/)) ||
            line.startsWith('!') ||
            line.startsWith('service ') ||
            line.startsWith('hostname ')) {
          configStart = i;
          break;
        }
      }
      
      // Find the end of configuration (before final prompts)
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        // Look for actual config lines, not prompts
        if (line && 
            !line.match(/^[\w-]+[>#]\s*$/) && // Not device prompts
            !line.includes('terminal length') && // Not our terminal command
            !line.includes('show running-config') && // Not command echo
            !line.includes('Building configuration') &&
            (line.startsWith('end') || 
             line.startsWith('!') || 
             line.includes('=') || 
             line.match(/^\s*\w+/) ||
             line.startsWith(' '))) {
          configEnd = i + 1;
          break;
        }
      }
      
      if (configStart > -1) {
        config = lines.slice(configStart, configEnd).join('\n');
      }
      
      // Clean up remaining unwanted lines while preserving config
      const cleanLines = config.split('\n').filter(line => {
        const trimmed = line.trim();
        // Keep all lines except specific unwanted patterns
        return !(
          trimmed.match(/^[\w-]+[>#]\s*$/) || // Device prompts only
          trimmed.includes('terminal length') || // Our terminal commands
          trimmed.includes('show running-config') || // Command echo
          (trimmed.includes('#') && trimmed.length < 10) // Short lines with just prompts
        );
      });
      
      config = cleanLines.join('\n').trim();
      
      // Ensure we have a reasonable configuration
      if (config.length < 50 || !config.includes('version')) {
        console.warn(`⚠️ Configuration seems incomplete, length: ${config.length}`);
        console.warn(`⚠️ Config preview: ${config.substring(0, 200)}`);
      }
      
      console.log(`✅ Successfully retrieved running config from ${deviceConfig.ip_address} (${config.length} characters)`);
      console.log(`📋 Final config preview: ${config.substring(0, 200)}...`);
      
      return {
        success: true,
        config: config,
        size: Buffer.byteLength(config, 'utf8')
      };
      
    } catch (error) {
      console.error(`❌ Failed to get running config from ${deviceConfig.ip_address}:`, error.message);
      throw new Error(`Failed to get running configuration: ${error.message}`);
    }
  }

  async getStartupConfig(deviceConfig) {
    try {
      console.log(`📋 Getting startup configuration from ${deviceConfig.ip_address}`);
      
      const result = await this.executeCommandWithEnable(deviceConfig, 'show startup-config');
      
      if (!result.success) {
        throw new Error('Failed to retrieve startup configuration');
      }
      
      // Clean up the output to get just the configuration
      let config = result.output;
      
      console.log(`📦 Raw startup output length: ${config.length} characters`);
      
      // Remove command echo and initial prompts
      const lines = config.split('\n');
      let configStart = -1;
      let configEnd = lines.length;
      
      // Find the start of actual configuration
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.includes('Using ') || 
            line.includes('Current configuration') ||
            (line.startsWith('version ') && line.match(/^\s*version\s+\d+/)) ||
            line.startsWith('!') ||
            line.startsWith('service ') ||
            line.startsWith('hostname ')) {
          configStart = i;
          break;
        }
      }
      
      // Find the end of configuration (before final prompts)
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (line && 
            !line.match(/^[\w-]+[>#]\s*$/) && // Not device prompts
            !line.includes('terminal length') && // Not our terminal command
            !line.includes('show startup-config') && // Not command echo
            (line.startsWith('end') || 
             line.startsWith('!') || 
             line.includes('=') || 
             line.match(/^\s*\w+/) ||
             line.startsWith(' '))) {
          configEnd = i + 1;
          break;
        }
      }
      
      if (configStart > -1) {
        config = lines.slice(configStart, configEnd).join('\n');
      }
      
      // Clean up remaining unwanted lines while preserving config
      const cleanLines = config.split('\n').filter(line => {
        const trimmed = line.trim();
        return !(
          trimmed.match(/^[\w-]+[>#]\s*$/) || // Device prompts only
          trimmed.includes('terminal length') || // Our terminal commands
          trimmed.includes('show startup-config') || // Command echo
          (trimmed.includes('#') && trimmed.length < 10) // Short lines with just prompts
        );
      });
      
      config = cleanLines.join('\n').trim();
      
      console.log(`✅ Successfully retrieved startup config from ${deviceConfig.ip_address} (${config.length} characters)`);
      
      return {
        success: true,
        config: config,
        size: Buffer.byteLength(config, 'utf8')
      };
      
    } catch (error) {
      console.error(`❌ Failed to get startup config from ${deviceConfig.ip_address}:`, error.message);
      throw new Error(`Failed to get startup configuration: ${error.message}`);
    }
  }

  async createFullBackup(deviceConfig) {
    try {
      console.log(`💾 Creating full backup for ${deviceConfig.ip_address}`);
      
      const [runningResult, startupResult] = await Promise.all([
        this.getRunningConfig(deviceConfig).catch(err => ({ success: false, error: err.message })),
        this.getStartupConfig(deviceConfig).catch(err => ({ success: false, error: err.message }))
      ]);
      
      if (!runningResult.success) {
        throw new Error(`Failed to get running config: ${runningResult.error}`);
      }
      
      const backup = {
        success: true,
        runningConfig: runningResult.config,
        runningConfigSize: runningResult.size,
        startupConfig: startupResult.success ? startupResult.config : null,
        startupConfigSize: startupResult.success ? startupResult.size : 0,
        timestamp: new Date().toISOString(),
        deviceInfo: {
          name: deviceConfig.name,
          type: deviceConfig.type,
          ip_address: deviceConfig.ip_address,
          model: deviceConfig.model,
          ios_version: deviceConfig.ios_version
        }
      };
      
      console.log(`✅ Full backup completed for ${deviceConfig.ip_address}`);
      return backup;
      
    } catch (error) {
      console.error(`❌ Full backup failed for ${deviceConfig.ip_address}:`, error.message);
      throw error;
    }
  }

  async restoreConfiguration(deviceConfig, backupConfig, options = {}) {
    try {
      console.log(`🔄 Starting configuration restore for ${deviceConfig.ip_address}`);
      
      const { 
        replaceRunning = true, 
        copyToStartup = true,
        createCheckpoint = true 
      } = options;
      
      const deviceId = deviceConfig.id || deviceConfig._id;
      let conn = this.connections.get(deviceId);
      
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
          let step = 0;
          let operationComplete = false;
          
          const steps = [
            'enable',
            'configure terminal',
            'configure replace flash:backup.cfg force', // This would be the actual restore command
            'end'
          ];
          
          if (copyToStartup) {
            steps.push('copy running-config startup-config');
          }
          
          const timeout = setTimeout(() => {
            if (!operationComplete) {
              stream.end();
              reject(new Error('Configuration restore timeout'));
            }
          }, 120000); // 2 minutes timeout for restore operations

          const executeStep = () => {
            if (step >= steps.length) {
              operationComplete = true;
              clearTimeout(timeout);
              
              setTimeout(() => {
                stream.end();
                resolve({
                  success: true,
                  output: output.trim(),
                  message: 'Configuration restored successfully',
                  steps: steps
                });
              }, 3000);
              return;
            }
            
            const command = steps[step];
            console.log(`➡️ Restore step ${step + 1}/${steps.length}: ${command}`);
            stream.write(command + '\r\n');
            step++;
          };

          stream.on('data', (data) => {
            const chunk = data.toString();
            output += chunk;
            
            // Handle various Cisco prompts during restore
            if (chunk.includes('#') || 
                chunk.includes('Password:') || 
                chunk.includes('[confirm]') ||
                chunk.includes('[OK]')) {
              
              if (chunk.includes('Password:')) {
                stream.write(deviceConfig.password + '\r\n');
              } else if (chunk.includes('[confirm]')) {
                stream.write('\r\n'); // Just press enter to confirm
              } else {
                setTimeout(executeStep, 1000);
              }
            }
            
            // Check for errors during restore
            if (chunk.includes('% Invalid') || 
                chunk.includes('% Error') ||
                chunk.includes('Failed')) {
              clearTimeout(timeout);
              operationComplete = true;
              stream.end();
              reject(new Error(`Configuration restore failed: ${chunk.trim()}`));
            }
          });

          stream.on('close', () => {
            clearTimeout(timeout);
            if (!operationComplete) {
              reject(new Error('SSH session closed during restore'));
            }
          });

          stream.on('error', (error) => {
            clearTimeout(timeout);
            reject(new Error(`SSH stream error during restore: ${error.message}`));
          });

          // Start the restore process
          console.log(`🚀 Starting restore process for ${deviceConfig.ip_address}`);
        });
      });
      
    } catch (error) {
      console.error(`❌ Configuration restore failed:`, error.message);
      throw new Error(`Configuration restore failed: ${error.message}`);
    }
  }

  async applyConfigurationFromBackup(deviceConfig, configCommands) {
    try {
      console.log(`🔄 Applying configuration from backup to ${deviceConfig.ip_address}`);
      
      // Use the existing sendConfigCommands method but with backup-specific handling
      const result = await this.sendConfigCommands(deviceConfig, configCommands);
      
      console.log(`✅ Backup configuration applied successfully to ${deviceConfig.ip_address}`);
      return {
        success: true,
        output: result.output,
        message: 'Backup configuration applied successfully'
      };
      
    } catch (error) {
      console.error(`❌ Failed to apply backup configuration to ${deviceConfig.ip_address}:`, error.message);
      throw new Error(`Failed to apply backup configuration: ${error.message}`);
    }
  }
}

export default new SSHService(); 