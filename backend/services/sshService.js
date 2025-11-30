import { Client } from 'ssh2';
import { promisify } from 'util';

export class SSHService {
  constructor() {
    this.connections = new Map(); // Store active connections
    this.persistentSessions = new Map(); // Store persistent sessions with privileged mode
    this.sessionTimeout = 600000; // 10 minutes session timeout (increased)
    this.maxSessionsPerDevice = 3; // Increased concurrent sessions per device
    this.commandQueue = new Map(); // Queue commands for busy sessions
    this.sessionPool = new Map(); // Pool of ready sessions per device
    
    // Optimized cleanup - every 2 minutes instead of 1
    setInterval(() => {
      this.cleanupExpiredSessions();
      this.optimizeSessionPool();
    }, 120000);
    
    // Health check every 30 seconds
    setInterval(() => {
      this.healthCheckSessions();
    }, 30000);
  }

  async connect(deviceConfig) {
    const { id, _id, ip_address, ssh_port, username, password } = deviceConfig;
    const deviceId = id || _id;
    
    // Always clean up any existing connection for this device first
    this.disconnect(deviceId);
    
    // Quick connectivity check
    console.log(`🔍 Attempting fast connection to ${ip_address}...`);
    
    return new Promise((resolve, reject) => {
      const conn = new Client();
      
      const timeout = setTimeout(() => {
        conn.end();
        reject(new Error('SSH connection timeout - device unreachable'));
      }, 10000); // Fast timeout for unreachable devices

      conn.on('ready', () => {
        clearTimeout(timeout);
        console.log(`✅ SSH connected to ${ip_address}`);
        
        // Mark connection as ready and stable
        conn._isReady = true;
        
        this.connections.set(deviceId, {
          connection: conn,
          createdAt: Date.now(),
          lastUsed: Date.now(),
          isReady: true
        });
        resolve(conn);
      });

      conn.on('error', (err) => {
        clearTimeout(timeout);
        console.error(`❌ SSH connection error for ${ip_address}:`, err.message);
        conn._isReady = false;
        this.connections.delete(deviceId);
        
        // Clean up any persistent sessions for this device if connection fails
        const sessionKey = `${deviceId}_persistent`;
        if (this.persistentSessions.has(sessionKey)) {
          console.log(`🧹 Cleaning up persistent session due to connection error`);
          this.persistentSessions.delete(sessionKey);
        }
        
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
        conn._isReady = false;
        this.connections.delete(deviceId);
        
        // Clean up persistent sessions when connection closes
        const sessionKey = `${deviceId}_persistent`;
        if (this.persistentSessions.has(sessionKey)) {
          console.log(`🧹 Cleaning up persistent session due to connection close`);
          this.persistentSessions.delete(sessionKey);
        }
        
        // Clean up from session pool as well
        const deviceSessions = this.sessionPool.get(deviceId);
        if (deviceSessions) {
          const validSessions = deviceSessions.filter(s => s.connection !== conn);
          this.sessionPool.set(deviceId, validSessions);
        }
      });

      conn.connect({
        host: ip_address,
        port: ssh_port || 22,
        username,
        password,
        readyTimeout: 15000, // Increased timeout for backup operations
        authTimeout: 10000,  // Increased auth timeout
        tryKeyboard: true, // Enable keyboard-interactive authentication
        // Add specific options for Cisco devices
        keepaliveInterval: 15000, // More frequent keepalives
        keepaliveCountMax: 5, // More attempts
        // Disable strict host key checking for lab environments
        hostVerifier: () => true,
        algorithms: {
          kex: [
            // Legacy algorithms for older Cisco devices (most compatible first)
            'diffie-hellman-group1-sha1',
            'diffie-hellman-group14-sha1', 
            'diffie-hellman-group-exchange-sha1',
            'diffie-hellman-group-exchange-sha256',
            'diffie-hellman-group14-sha256',
            // Modern algorithms
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
      let connObj = this.connections.get(deviceId);
      let conn = connObj ? connObj.connection : null;
      
      if (!conn) {
        conn = await this.connect(deviceConfig);
      } else {
        // Update last used timestamp
        connObj.lastUsed = Date.now();
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

  async sendConfigCommands(deviceConfig, commands, options = {}) {
    try {
      const { tolerateErrors = false, useSession = true } = options; // useSession: reuse existing session if available
      console.log(`🔧 Starting configuration deployment to ${deviceConfig.ip_address}`);
      console.log(`📝 Commands to deploy:\n${commands}`);
      console.log(`⚙️ Error tolerance: ${tolerateErrors ? 'ENABLED (backup restore mode)' : 'DISABLED (normal mode)'}`);
      console.log(`🔗 Session mode: ${useSession ? 'REUSE existing session if available' : 'ALWAYS create fresh connection'}`);
      
      let conn;
      let sessionReused = false;
      const deviceId = deviceConfig.id || deviceConfig._id;
      const sessionKey = `${deviceId}_persistent`;
      
      // Try to reuse existing persistent session if enabled
      if (useSession) {
        const existingSession = this.persistentSessions.get(sessionKey);
        if (existingSession && this.isSessionValid(existingSession)) {
          console.log(`♻️ Reusing persistent session for ${deviceConfig.ip_address} (use count: ${existingSession.useCount})`);
          conn = existingSession.connection;
          existingSession.lastUsed = Date.now();
          existingSession.useCount++;
          sessionReused = true;
        } else {
          console.log(`🔄 No valid session found, creating new SSH connection...`);
          conn = await this.connect(deviceConfig);
          
          // Store as persistent session for future reuse
          const session = {
            connection: conn,
            deviceId: deviceId,
            deviceConfig: deviceConfig,
            createdAt: Date.now(),
            lastUsed: Date.now(),
            useCount: 1,
            isPrivileged: false,
            sessionKey: sessionKey
          };
          this.persistentSessions.set(sessionKey, session);
          console.log(`✅ New session created and stored for reuse`);
        }
      } else {
        // Force fresh connection (legacy behavior)
        console.log(`🔄 Creating fresh SSH connection for configuration deployment...`);
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
          let errorCount = 0;  // Track errors
          let hasErrors = false;  // Track if any errors occurred
          
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
              // Only disconnect if not reusing session
              if (!sessionReused) {
                const deviceId = deviceConfig.id || deviceConfig._id;
                this.disconnect(deviceId);
              }
              reject(new Error('Configuration deployment timeout - device unresponsive'));
            }
          }, 30000); // Faster deployment timeout

          const sendNextCommand = () => {
            if (currentStep >= allCommands.length) {
              commandComplete = true;
              clearTimeout(timeout);
              
              if (hasErrors) {
                console.log(`⚠️ Commands sent but device reported ${errorCount} error(s)`);
              } else {
                console.log(`✅ All commands sent successfully to ${deviceConfig.ip_address}`);
              }
              
              // Wait a bit for final output then close
              setTimeout(() => {
                stream.end();
                
                // Only close SSH connection if NOT reusing a persistent session
                if (!sessionReused) {
                  setTimeout(() => {
                    const deviceId = deviceConfig.id || deviceConfig._id;
                    this.disconnect(deviceId);
                    console.log(`🔌 SSH connection closed after deployment`);
                  }, 500);
                } else {
                  console.log(`♻️ SSH session kept alive for future reuse`);
                }
                
                // Handle errors based on tolerance mode
                if (hasErrors && !tolerateErrors) {
                  // Normal mode: Reject on errors
                  reject(new Error(`Configuration deployment completed with ${errorCount} error(s). Check device output.`));
                } else {
                  // Backup restore mode or no errors: Return success with warnings if needed
                  resolve({
                    success: true,
                    output: output.trim(),
                    commandsExecuted: allCommands,
                    errorCount: errorCount,
                    hasWarnings: hasErrors,
                    warningMessage: hasErrors ? `Deployment completed with ${errorCount} warning(s) - some commands may have failed but restore continued` : null,
                    sessionReused: sessionReused
                  });
                }
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
            
            // Check for errors - CRITICAL: Track and report them
            if (chunk.includes('% Invalid') || 
                chunk.includes('% Ambiguous') ||
                chunk.includes('% Incomplete') ||
                chunk.includes('% Unknown') ||
                chunk.includes('Bad mask') ||
                chunk.includes('% Error')) {
              console.log(`❌ ERROR: Command failed: ${chunk.trim()}`);
              errorCount++;
              hasErrors = true;
            }
          });

          stream.on('close', () => {
            clearTimeout(timeout);
            // Only disconnect if not using persistent session
            if (!sessionReused) {
              const deviceId = deviceConfig.id || deviceConfig._id;
              this.disconnect(deviceId);
            }
            if (!commandComplete) {
              reject(new Error('SSH session closed unexpectedly'));
            }
          });

          stream.on('error', (error) => {
            clearTimeout(timeout);
            // On error, always disconnect to cleanup
            const deviceId = deviceConfig.id || deviceConfig._id;
            this.disconnect(deviceId);
            // Also remove from persistent sessions if it was stored
            if (sessionReused) {
              const sessionKey = `${deviceId}_persistent`;
              this.persistentSessions.delete(sessionKey);
              console.log(`🗑️ Removed failed session from persistent sessions`);
            }
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
      
      // For critical operations like backup, always use a fresh connection
      console.log(`🔌 Creating fresh connection for ${deviceConfig.ip_address} for command: ${command}`);
      const conn = await this.connect(deviceConfig);
      
      // Log connection state immediately after connect
      console.log(`🔍 Connection state after connect: ready=${conn._isReady}, sock=${!!conn._sock}, state=${conn._sock?.readyState}`);

      return new Promise((resolve, reject) => {
        // Check if connection is healthy before creating shell
        if (!this.isConnectionHealthy(conn)) {
          console.error(`❌ Connection not healthy for ${deviceConfig.ip_address}: ready=${conn._isReady}, sock=${!!conn._sock}, state=${conn._sock?.readyState}`);
          reject(new Error(`Connection not healthy for shell creation`));
          return;
        }
        
        conn.shell({ pty: true }, (err, stream) => {
          if (err) {
            console.error(`❌ Shell creation failed for ${deviceConfig.ip_address}:`, err.message);
            reject(new Error(`Failed to create shell: ${err.message}`));
            return;
          }
          
          console.log(`✅ Shell created successfully for ${deviceConfig.ip_address}`);

            let output = '';
            let commandSent = false;
            let enableSent = false;
            let configurationComplete = false;
            let lastActivity = Date.now();
            
            const timeout = setTimeout(() => {
              console.log(`⏰ Command timeout after 180 seconds for ${deviceConfig.ip_address}`);
              console.log(`📊 Output received so far: ${output.length} characters`);
              console.log(`🔍 Last 200 chars: ${output.slice(-200)}`);
              stream.end();
              reject(new Error('Command execution timeout after 180 seconds'));
            }, 180000); // Increased timeout to 3 minutes for very large configurations

          stream.on('data', (data) => {
            const chunk = data.toString();
            output += chunk;
            lastActivity = Date.now();
            
            // Debug logging for troubleshooting
            if (process.env.SSH_DEBUG === 'true') {
              console.log(`🔍 [DEBUG] Received chunk: "${chunk.trim()}" (length: ${chunk.length})`);
              console.log(`🔍 [DEBUG] enableSent: ${enableSent}, commandSent: ${commandSent}`);
            }
            
            // Progress tracking for long operations
            if (commandSent && (output.length % 10000 === 0)) { // Every 10KB
              console.log(`📊 Progress for ${deviceConfig.ip_address}: ${output.length} bytes received...`);
            }
            
            // Handle different Cisco prompts
            if (chunk.includes('#') && !enableSent && !commandSent) {
              // Device is already in privileged mode, no need for enable
              console.log(`✅ Device ${deviceConfig.ip_address} is already in privileged mode`);
              enableSent = true; // Set to avoid trying enable
              commandSent = true;
              
              // For show running-config, disable paging to get full output
              if (command.includes('running-config') || command.includes('startup-config')) {
                console.log(`📺 Disabling terminal paging for ${deviceConfig.ip_address}`);
                stream.write('terminal length 0\r\n');
                setTimeout(() => {
                  console.log(`📝 Now sending main command: ${command}`);
                  stream.write(command + '\r\n');
                }, 1500);
              } else {
                stream.write(command + '\r\n');
              }
              
            } else if (chunk.includes('>') && !enableSent) {
              // User mode prompt, send enable
              console.log(`🔐 Sending enable command to ${deviceConfig.ip_address}`);
              enableSent = true;
              stream.write('enable\r\n');
              
              // Set a timeout to handle cases where device doesn't respond after enable
              setTimeout(() => {
                if (enableSent && !commandSent) {
                  console.log(`⏰ No response to enable command after 5 seconds, checking current prompt`);
                  console.log(`🔍 Current output: "${output.slice(-100)}"`);
                  // Send a carriage return to get current prompt
                  stream.write('\r\n');
                }
              }, 5000);
              
            } else if (chunk.includes('Password:') && enableSent && !commandSent) {
              // Enable password prompt
              console.log(`🔑 Sending enable password to ${deviceConfig.ip_address}`);
              stream.write((deviceConfig.enable_password || deviceConfig.password) + '\r\n');
              
            } else if (chunk.includes('% No password set') && enableSent && !commandSent) {
              // Device has no enable password - try user mode commands
              console.log(`ℹ️ Device ${deviceConfig.ip_address} has no enable password set`);
              console.log(`🔄 Attempting backup from user mode (limited access)`);
              
              // Mark as command sent and try to run limited commands from user mode
              commandSent = true;
              
              // Try user mode version of the command
              if (command.includes('running-config')) {
                console.log(`📝 Trying user mode command: show configuration`);
                stream.write('show configuration\r\n');
              } else if (command.includes('startup-config')) {
                console.log(`📝 Trying user mode command: show startup-config`);
                stream.write('show startup-config\r\n');
              } else {
                console.log(`📝 Trying original command in user mode: ${command}`);
                stream.write(command + '\r\n');
              }
              
            } else if (chunk.includes('#') && !commandSent) {
              // Privileged mode prompt - device is ready for commands
              console.log(`✅ Device ${deviceConfig.ip_address} is now in privileged mode`);
              commandSent = true;
              
              // For show running-config, disable paging to get full output
              if (command.includes('running-config') || command.includes('startup-config')) {
                console.log(`📺 Disabling terminal paging for ${deviceConfig.ip_address}`);
                stream.write('terminal length 0\r\n');
                // Wait for the terminal command to process
                setTimeout(() => {
                  console.log(`📝 Now sending main command: ${command}`);
                  stream.write(command + '\r\n');
                }, 1500);
              } else {
                stream.write(command + '\r\n');
              }
              
            } else if (enableSent && !commandSent && chunk.includes('>')) {
              // Still in user mode after enable - check for specific error messages
              console.log(`⚠️ Still in user mode after enable command for ${deviceConfig.ip_address}`);
              console.log(`🔍 Output so far: "${output.slice(-200)}"`);
              
              // Don't retry enable if we already got an error message
              if (output.includes('% No password set') || output.includes('% Access denied')) {
                console.log(`❌ Enable failed due to device configuration issue`);
                clearTimeout(timeout);
                stream.end();
                reject(new Error('Cannot enter privileged mode: Device configuration prevents enable command'));
              } else {
                // Only retry once more if no specific error
                console.log(`🔄 Retrying enable command once more...`);
                stream.write('enable\r\n');
              }
              

            } else if (chunk.includes('--More--') || chunk.includes('-- More --') || chunk.includes('More')) {
              // Handle paged output by sending space to continue
              console.log(`📄 Handling paged output for ${deviceConfig.ip_address}`);
              stream.write(' ');
            } else if (commandSent && !configurationComplete) {
              // Check for command completion markers - improved detection
              const lines = chunk.split('\n');
              const lastLine = lines[lines.length - 1] || lines[lines.length - 2] || '';
              
              // For show running-config/startup-config, look for "end" keyword and device prompt
              if (command.includes('running-config') || command.includes('startup-config')) {
                // Check if we have both "end" keyword and device prompt indicating completion
                if (output.includes('\nend\n') || output.includes('\nend\r')) {
                  const promptMatch = lastLine.match(/^[\w-]+#\s*$/);
                  if (promptMatch) {
                    console.log(`🎯 Configuration end marker found, completing for ${deviceConfig.ip_address}`);
                    configurationComplete = true;
                    clearTimeout(timeout);
                    stream.end();
                    
                    console.log(`✅ Command completed for ${deviceConfig.ip_address}, output length: ${output.length}`);
                    resolve({
                      success: true,
                      output: output.trim()
                    });
                    return;
                  }
                }
              } else {
                // For other commands, use original logic
                if (lastLine.match(/^[\w-]+#\s*$/) && 
                    (output.includes('Building configuration') || 
                     output.includes('Current configuration') ||
                     output.includes('version ') ||
                     output.includes('hostname ') ||
                     command.includes('version'))) {
                  
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
            }
          });

          // Fallback completion check - increased timeout for large configurations
          const inactivityCheck = setInterval(() => {
            if (commandSent && (Date.now() - lastActivity > 15000)) { // Increased from 5 to 15 seconds
              console.log(`⏰ No activity for 15 seconds, completing command for ${deviceConfig.ip_address}`);
              console.log(`📊 Final output length: ${output.length} characters`);
              configurationComplete = true;
              clearTimeout(timeout);
              clearInterval(inactivityCheck);
              stream.end();
              
              resolve({
                success: true,
                output: output.trim()
              });
            }
          }, 2000); // Check every 2 seconds instead of 1

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

  isConnectionHealthy(conn) {
    return conn && 
           conn._isReady === true && 
           conn._sock && 
           conn._sock.readyState === 'open' &&
           !conn._sock.destroyed;
  }

  disconnect(deviceId) {
    // Handle both MongoDB ObjectId and regular id formats
    const actualId = typeof deviceId === 'object' ? deviceId.toString() : deviceId;
    const connObj = this.connections.get(actualId);
    if (connObj) {
      connObj.connection._isReady = false;
      connObj.connection.end(); // End the actual connection object
      this.connections.delete(actualId);
      console.log(`🔌 Disconnected device ID: ${actualId}`);
    }
  }

  disconnectAll() {
    console.log(`🔌 Disconnecting all SSH connections (${this.connections.size} active)`);
    for (const [deviceId, conn] of this.connections) {
      conn.connection.end(); // End the actual connection object
    }
    this.connections.clear();
  }

  // Simple connection test with minimal algorithms for problematic devices
  async testBasicConnection(deviceConfig) {
    try {
      console.log(`🔍 Testing basic SSH connection to ${deviceConfig.ip_address} with minimal algorithms`);
      
      const conn = new Client();
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          conn.end();
          resolve({
            success: false,
            message: 'Connection timeout with basic algorithms',
            error: 'timeout'
          });
        }, 15000);
        
        conn.on('ready', () => {
          clearTimeout(timeout);
          console.log(`✅ Basic SSH connection successful to ${deviceConfig.ip_address}`);
          conn.end();
          resolve({
            success: true,
            message: 'Basic connection successful',
            algorithms_used: 'minimal_legacy_set'
          });
        });
        
        conn.on('error', (err) => {
          clearTimeout(timeout);
          console.error(`❌ Basic SSH connection failed to ${deviceConfig.ip_address}:`, err.message);
          resolve({
            success: false,
            message: `Basic connection failed: ${err.message}`,
            error: err.code || err.message
          });
        });
        
        // Use only the most basic, widely supported algorithms
        conn.connect({
          host: deviceConfig.ip_address,
          port: deviceConfig.ssh_port || 22,
          username: deviceConfig.username,
          password: deviceConfig.password,
          readyTimeout: 15000,
          authTimeout: 10000,
          algorithms: {
            kex: ['diffie-hellman-group1-sha1'],  // Only the most basic
            cipher: ['aes128-cbc', '3des-cbc'],   // Most compatible ciphers
            hmac: ['hmac-sha1'],                  // Most basic MAC
            serverHostKey: ['ssh-rsa', 'ssh-dss'] // Most basic host keys
          }
        });
      });
      
    } catch (error) {
      return {
        success: false,
        message: `Basic connection test failed: ${error.message}`,
        error: error.message
      };
    }
  }

  // Persistent Session Management
  async getOrCreatePersistentSession(deviceConfig) {
    const { id, _id, ip_address } = deviceConfig;
    const deviceId = id || _id;
    const sessionKey = `${deviceId}_persistent`;
    
    // Check if we have a valid persistent session
    const existingSession = this.persistentSessions.get(sessionKey);
    if (existingSession && this.isSessionValid(existingSession)) {
      console.log(`♻️ Reusing persistent session for ${ip_address}`);
      existingSession.lastUsed = Date.now();
      existingSession.useCount++;
      return existingSession;
    }
    
    // Create new persistent session
    console.log(`🔄 Creating new persistent session for ${ip_address}`);
    try {
      const conn = await this.connect(deviceConfig);
      
      // Test privileged mode access immediately
      const privilegedSession = await this.establishPrivilegedSession(conn, deviceConfig);
      
      const session = {
        connection: conn,
        deviceId: deviceId,
        deviceConfig: deviceConfig,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        useCount: 1,
        isPrivileged: privilegedSession.isPrivileged,
        privilegedStream: privilegedSession.stream,
        sessionKey: sessionKey
      };
      
      this.persistentSessions.set(sessionKey, session);
      console.log(`✅ Persistent session created for ${ip_address} (privileged: ${session.isPrivileged})`);
      
      return session;
      
    } catch (error) {
      console.error(`❌ Failed to create persistent session for ${ip_address}:`, error.message);
      throw error;
    }
  }

  async establishPrivilegedSession(conn, deviceConfig) {
    return new Promise((resolve, reject) => {
      conn.shell((err, stream) => {
        if (err) {
          return resolve({ isPrivileged: false, stream: null, error: err.message });
        }
        
        let output = '';
        let isPrivileged = false;
        let enableSent = false;
        
        const timeout = setTimeout(() => {
          resolve({ isPrivileged: false, stream: stream, error: 'Privilege escalation timeout' });
        }, 15000);
        
        stream.on('data', (data) => {
          const chunk = data.toString();
          output += chunk;
          
          if (chunk.includes('#') && !isPrivileged) {
            // Already in privileged mode or successfully escalated
            clearTimeout(timeout);
            isPrivileged = true;
            console.log(`✅ Privileged mode established for ${deviceConfig.ip_address}`);
            resolve({ isPrivileged: true, stream: stream });
            
          } else if (chunk.includes('>') && !enableSent) {
            // Try to escalate to privileged mode
            console.log(`🔐 Attempting privilege escalation for ${deviceConfig.ip_address}`);
            enableSent = true;
            stream.write('enable\r\n');
            
          } else if (chunk.includes('Password:') && enableSent) {
            // Send enable password
            stream.write((deviceConfig.enable_password || deviceConfig.password) + '\r\n');
            
          } else if (chunk.includes('% No password set') && enableSent) {
            // Device doesn't allow enable without password - use user mode
            clearTimeout(timeout);
            console.log(`ℹ️ Device ${deviceConfig.ip_address} will operate in user mode (no enable password)`);
            resolve({ isPrivileged: false, stream: stream, userModeOnly: true });
          }
        });
        
        stream.on('error', (err) => {
          clearTimeout(timeout);
          resolve({ isPrivileged: false, stream: null, error: err.message });
        });
        
        // Send initial command to get prompt
        stream.write('\r\n');
      });
    });
  }

  isSessionValid(session) {
    if (!session) return false;
    
    const now = Date.now();
    const isExpired = (now - session.lastUsed) > this.sessionTimeout;
    const isConnectionAlive = session.connection && session.connection._isReady;
    const hasValidStream = session.privilegedStream && !session.privilegedStream.destroyed;
    
    // Additional checks for SSH connection integrity
    const isHealthy = session.connection && 
                     !session.connection._readableState?.destroyed &&
                     !session.connection._writableState?.destroyed;
    
    return !isExpired && isConnectionAlive && hasValidStream && isHealthy;
  }

  // Get stats about active sessions for monitoring
  getSessionStats() {
    const stats = {
      activePersistentSessions: this.persistentSessions.size,
      pooledSessions: 0,
      sessions: []
    };
    
    // Count pooled sessions
    for (const [deviceKey, sessions] of this.sessionPool) {
      stats.pooledSessions += sessions.length;
    }
    
    // Get details of persistent sessions
    for (const [sessionKey, session] of this.persistentSessions) {
      const isValid = this.isSessionValid(session);
      stats.sessions.push({
        deviceId: session.deviceId,
        deviceIp: session.deviceConfig?.ip_address,
        createdAt: session.createdAt,
        lastUsed: session.lastUsed,
        useCount: session.useCount,
        isPrivileged: session.isPrivileged,
        isValid: isValid,
        ageMinutes: Math.round((Date.now() - session.createdAt) / 60000),
        idleMinutes: Math.round((Date.now() - session.lastUsed) / 60000)
      });
    }
    
    return stats;
  }

  async executeCommandOnPersistentSession(session, command) {
    try {
      session.lastUsed = Date.now();
      const stream = session.privilegedStream;
      
      if (!stream) {
        throw new Error('No active stream available');
      }
      
      return new Promise((resolve, reject) => {
        let output = '';
        let commandSent = false;
        let commandComplete = false;
        
        const timeout = setTimeout(() => {
          if (!commandComplete) {
            console.log(`⏰ Command timeout for persistent session: ${command}`);
            resolve({ success: true, output: output.trim() }); // Don't reject, return what we have
          }
        }, 60000);
        
        const dataHandler = (data) => {
          const chunk = data.toString();
          output += chunk;
          
          if (!commandSent) {
            // Adapt command for user mode if needed
            let actualCommand = command;
            if (!session.isPrivileged && command.includes('running-config')) {
              actualCommand = 'show running-config'; // Try running-config first in user mode
              console.log(`📝 Using running-config in user mode: ${actualCommand}`);
            } else {
              console.log(`📝 Executing on persistent session: ${command}`);
            }
            
            stream.write(actualCommand + '\r\n');
            commandSent = true;
            
          } else if ((chunk.includes('#') || chunk.includes('>')) && commandSent && !commandComplete) {
            // Command completed (works for both privileged # and user mode >)
            clearTimeout(timeout);
            commandComplete = true;
            stream.removeListener('data', dataHandler);
            resolve({ success: true, output: output.trim() });
          }
        };
        
        stream.on('data', dataHandler);
        
        // Trigger initial prompt
        stream.write('\r\n');
      });
      
    } catch (error) {
      console.error(`❌ Persistent session command failed:`, error.message);
      throw error;
    }
  }

  // Optimized session pool management
  async getOptimalSession(deviceConfig) {
    const deviceId = deviceConfig.id || deviceConfig._id;
    const deviceKey = `${deviceId}`;
    
    // Check session pool for this device
    if (!this.sessionPool.has(deviceKey)) {
      this.sessionPool.set(deviceKey, []);
    }
    
    const deviceSessions = this.sessionPool.get(deviceKey);
    
    // Find an available session
    for (const session of deviceSessions) {
      if (this.isSessionValid(session) && !session.busy) {
        console.log(`⚡ Using optimal session for ${deviceConfig.ip_address} (pool size: ${deviceSessions.length})`);
        session.lastUsed = Date.now();
        session.useCount++;
        return session;
      }
    }
    
    // Create new session if pool not full
    if (deviceSessions.length < this.maxSessionsPerDevice) {
      console.log(`🔄 Creating new optimized session for ${deviceConfig.ip_address}`);
      const newSession = await this.createOptimizedSession(deviceConfig);
      deviceSessions.push(newSession);
      return newSession;
    }
    
    // Wait for available session if pool is full
    console.log(`⏳ Waiting for available session for ${deviceConfig.ip_address}`);
    return await this.waitForAvailableSession(deviceKey);
  }

  async createOptimizedSession(deviceConfig) {
    try {
      const conn = await this.connect(deviceConfig);
      
      // Establish privileged mode with optimized approach
      const privilegedSession = await this.establishOptimizedPrivilegedSession(conn, deviceConfig);
      
      const session = {
        connection: conn,
        deviceId: deviceConfig.id || deviceConfig._id,
        deviceConfig: deviceConfig,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        useCount: 1,
        isPrivileged: privilegedSession.isPrivileged,
        privilegedStream: privilegedSession.stream,
        sessionKey: `${deviceConfig.id || deviceConfig._id}_optimized_${Date.now()}`,
        busy: false,
        userModeOnly: privilegedSession.userModeOnly || false,
        commandHistory: [],
        performance: {
          avgCommandTime: 0,
          totalCommands: 0,
          lastCommandTime: 0
        }
      };
      
      console.log(`✅ Optimized session created for ${deviceConfig.ip_address} (privileged: ${session.isPrivileged})`);
      return session;
      
    } catch (error) {
      console.error(`❌ Failed to create optimized session:`, error.message);
      throw error;
    }
  }

  async establishOptimizedPrivilegedSession(conn, deviceConfig) {
    return new Promise((resolve, reject) => {
      conn.shell((err, stream) => {
        if (err) {
          return resolve({ isPrivileged: false, stream: null, error: err.message });
        }
        
        let output = '';
        let isPrivileged = false;
        let enableSent = false;
        let userModeOnly = false;
        
        const timeout = setTimeout(() => {
          // Don't reject - accept user mode if that's all we can get
          console.log(`⏰ Privilege escalation timeout, accepting current mode for ${deviceConfig.ip_address}`);
          resolve({ isPrivileged: false, stream: stream, userModeOnly: true });
        }, 10000); // Shorter timeout for faster setup
        
        stream.on('data', (data) => {
          const chunk = data.toString();
          output += chunk;
          
          if (chunk.includes('#') && !isPrivileged) {
            // Already in privileged mode or successfully escalated
            clearTimeout(timeout);
            isPrivileged = true;
            console.log(`✅ Privileged mode established for ${deviceConfig.ip_address}`);
            resolve({ isPrivileged: true, stream: stream });
            
          } else if (chunk.includes('>') && !enableSent) {
            // Try to escalate to privileged mode
            console.log(`🔐 Attempting privilege escalation for ${deviceConfig.ip_address}`);
            enableSent = true;
            stream.write('enable\r\n');
            
          } else if (chunk.includes('Password:') && enableSent) {
            // Send enable password
            stream.write((deviceConfig.enable_password || deviceConfig.password) + '\r\n');
            
          } else if (chunk.includes('% No password set') && enableSent) {
            // Device doesn't allow enable - accept user mode
            clearTimeout(timeout);
            userModeOnly = true;
            console.log(`ℹ️ Device ${deviceConfig.ip_address} will operate in user mode only`);
            resolve({ isPrivileged: false, stream: stream, userModeOnly: true });
          }
        });
        
        stream.on('error', (err) => {
          clearTimeout(timeout);
          resolve({ isPrivileged: false, stream: null, error: err.message });
        });
        
        // Send initial command to get prompt
        stream.write('\r\n');
      });
    });
  }

  async waitForAvailableSession(deviceKey) {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const deviceSessions = this.sessionPool.get(deviceKey) || [];
        const availableSession = deviceSessions.find(s => !s.busy && this.isSessionValid(s));
        
        if (availableSession) {
          clearInterval(checkInterval);
          availableSession.lastUsed = Date.now();
          resolve(availableSession);
        }
      }, 100); // Check every 100ms
      
      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(null);
      }, 10000);
    });
  }

  optimizeSessionPool() {
    for (const [deviceKey, sessions] of this.sessionPool) {
      // Remove invalid sessions
      const validSessions = sessions.filter(session => this.isSessionValid(session));
      this.sessionPool.set(deviceKey, validSessions);
      
      if (validSessions.length !== sessions.length) {
        console.log(`🧹 Optimized session pool for device ${deviceKey}: ${sessions.length} → ${validSessions.length}`);
      }
    }
  }

  healthCheckSessions() {
    let totalSessions = 0;
    let healthySessions = 0;
    
    for (const [key, session] of this.persistentSessions) {
      totalSessions++;
      if (this.isSessionValid(session)) {
        healthySessions++;
        
        // Send keepalive if session is idle for more than 1 minute
        const idleTime = Date.now() - session.lastUsed;
        if (idleTime > 60000 && session.privilegedStream && !session.busy) {
          session.privilegedStream.write('\r\n'); // Send keepalive
        }
      }
    }
    
    if (totalSessions > 0) {
      console.log(`💓 Session health: ${healthySessions}/${totalSessions} healthy sessions`);
    }
  }

  cleanupExpiredSessions() {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, session] of this.persistentSessions) {
      if ((now - session.lastUsed) > this.sessionTimeout) {
        console.log(`🧹 Cleaning up expired session for device ${session.deviceConfig.ip_address}`);
        if (session.connection) {
          session.connection.end();
        }
        this.persistentSessions.delete(key);
        cleanedCount++;
      }
    }
    
    // Also cleanup session pool
    for (const [deviceKey, sessions] of this.sessionPool) {
      const validSessions = sessions.filter(session => (now - session.lastUsed) <= this.sessionTimeout);
      if (validSessions.length !== sessions.length) {
        this.sessionPool.set(deviceKey, validSessions);
        cleanedCount += sessions.length - validSessions.length;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired sessions`);
    }
  }

  // Optimized command execution with performance tracking
  async executeOptimizedCommand(session, command) {
    const startTime = Date.now();
    session.busy = true;
    
    try {
      session.lastUsed = Date.now();
      const stream = session.privilegedStream;
      
      if (!stream) {
        throw new Error('No active stream available');
      }
      
      return new Promise((resolve, reject) => {
        let output = '';
        let commandSent = false;
        let commandComplete = false;
        
        const timeout = setTimeout(() => {
          if (!commandComplete) {
            console.log(`⏰ Optimized command timeout: ${command}`);
            commandComplete = true;
            session.busy = false;
            resolve({ success: true, output: output.trim(), timeout: true });
          }
        }, 30000); // Reduced timeout for faster operations
        
        const dataHandler = (data) => {
          try {
            const chunk = data.toString('utf8');
            output += chunk;
            
            if (!commandSent) {
              // Optimize command for user mode devices
              let actualCommand = command;
              if (session.userModeOnly && command.includes('running-config')) {
                actualCommand = 'show running-config'; // Works in user mode on most devices
              }
              
              console.log(`⚡ Optimized execution: ${actualCommand}`);
              stream.write(actualCommand + '\r\n');
              commandSent = true;
            
          } else if ((chunk.includes('#') || chunk.includes('>')) && commandSent && !commandComplete) {
            // Command completed
            clearTimeout(timeout);
            commandComplete = true;
            session.busy = false;
            
            // Update performance metrics (with safety checks)
            const executionTime = Date.now() - startTime;
            
            // Initialize performance object if not exists
            if (!session.performance) {
              session.performance = {
                avgCommandTime: 0,
                totalCommands: 0,
                lastCommandTime: 0
              };
            }
            
            session.performance.totalCommands++;
            session.performance.lastCommandTime = executionTime;
            session.performance.avgCommandTime = 
              (session.performance.avgCommandTime * (session.performance.totalCommands - 1) + executionTime) / 
              session.performance.totalCommands;
            
            // Initialize command history if not exists
            if (!session.commandHistory) {
              session.commandHistory = [];
            }
            
            session.commandHistory.push({
              command: command,
              executionTime: executionTime,
              timestamp: Date.now(),
              outputSize: output.length
            });
            
            // Keep only last 10 commands in history
            if (session.commandHistory.length > 10) {
              session.commandHistory = session.commandHistory.slice(-10);
            }
            
            stream.removeListener('data', dataHandler);
            resolve({ 
              success: true, 
              output: output.trim(), 
              executionTime: executionTime,
              sessionPerformance: session.performance
            });
          }
        } catch (dataError) {
          console.error(`❌ Data processing error: ${dataError.message}`);
          // Continue processing despite data errors
        }
      };
        
        stream.on('data', dataHandler);
        
        stream.on('error', (streamError) => {
          console.error(`❌ Stream error during optimized command: ${streamError.message}`);
          clearTimeout(timeout);
          commandComplete = true;
          session.busy = false;
          stream.removeListener('data', dataHandler);
          reject(new Error(`Stream error: ${streamError.message}`));
        });
        
        // Trigger initial prompt
        stream.write('\r\n');
      });
      
    } catch (error) {
      session.busy = false;
      console.error(`❌ Optimized command failed:`, error.message);
      throw error;
    }
  }

  // Batch command execution for multiple commands
  async executeBatchCommands(session, commands) {
    const results = [];
    const startTime = Date.now();
    
    console.log(`📦 Executing batch of ${commands.length} commands`);
    
    for (const command of commands) {
      try {
        const result = await this.executeOptimizedCommand(session, command);
        results.push({
          command: command,
          success: true,
          output: result.output,
          executionTime: result.executionTime
        });
      } catch (error) {
        results.push({
          command: command,
          success: false,
          error: error.message,
          executionTime: 0
        });
      }
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`✅ Batch execution completed in ${totalTime}ms`);
    
    return {
      success: true,
      results: results,
      totalExecutionTime: totalTime,
      successfulCommands: results.filter(r => r.success).length,
      failedCommands: results.filter(r => !r.success).length
    };
  }

  // Optimized backup with proper config type handling
  async optimizedBackup(deviceConfig, configType = 'running-config') {
    try {
      console.log(`⚡ Starting optimized backup for ${deviceConfig.ip_address} (type: ${configType})`);
      
      const deviceId = deviceConfig.id || deviceConfig._id;
      const sessionKey = `${deviceId}_persistent`;
      let session = this.persistentSessions.get(sessionKey);
      
      // Validate session and recreate if corrupted
      if (!session || !this.isSessionValid(session)) {
        if (session) {
          console.log(`🔄 Session corrupted for ${deviceConfig.ip_address}, recreating...`);
          this.cleanupCorruptedSession(session, sessionKey);
        }
        
        console.log(`🔄 Creating new session for backup: ${deviceConfig.ip_address}`);
        session = await this.getOrCreatePersistentSession(deviceConfig);
      }
      
      console.log(`♻️ Using existing SSH session for ${deviceConfig.ip_address} (no enable needed)`);
      
      let runningConfigResult = null;
      let startupConfigResult = null;
      
      // Execute only requested config type
      if (configType === 'running-config' || configType === 'both') {
        console.log(`📋 Getting running configuration...`);
        runningConfigResult = await this.executeConfigCommand(session, 'show running-config');
      }
      
      if (configType === 'startup-config' || configType === 'both') {
        console.log(`💾 Getting startup configuration...`);
        startupConfigResult = await this.executeConfigCommand(session, 'show startup-config');
      }
      
      // Validate we got the requested config
      const hasRequiredConfig = 
        (configType === 'running-config' && runningConfigResult?.success) ||
        (configType === 'startup-config' && startupConfigResult?.success) ||
        (configType === 'both' && (runningConfigResult?.success || startupConfigResult?.success));
      
      if (!hasRequiredConfig) {
        throw new Error(`Failed to get ${configType} configuration`);
      }
      
      console.log(`✅ Optimized backup completed for ${deviceConfig.ip_address}`);
      console.log(`   📊 Running config: ${runningConfigResult?.output?.length || 0} chars`);
      console.log(`   💾 Startup config: ${startupConfigResult?.output?.length || 0} chars`);
      
      return {
        success: true,
        runningConfig: runningConfigResult?.output || null,
        runningConfigSize: runningConfigResult?.output?.length || 0,
        startupConfig: startupConfigResult?.output || null,
        startupConfigSize: startupConfigResult?.output?.length || 0,
        configType: configType,
        timestamp: new Date().toISOString(),
        sessionReused: true,
        useCount: session.useCount,
        sessionPerformance: session.performance,
        deviceInfo: {
          name: deviceConfig.name,
          type: deviceConfig.type,
          ip_address: deviceConfig.ip_address
        }
      };
      
    } catch (error) {
      console.error(`❌ Optimized backup failed for ${deviceConfig.ip_address}:`, error.message);
      throw error;
    }
  }

  // Execute configuration command with proper paging handling
  async executeConfigCommand(session, command) {
    const startTime = Date.now();
    session.busy = true;
    
    try {
      session.lastUsed = Date.now();
      const stream = session.privilegedStream;
      
      if (!stream) {
        throw new Error('No active stream available');
      }
      
      return new Promise((resolve, reject) => {
        let output = '';
        let commandSent = false;
        let pagingDisabled = false;
        let configCommandSent = false;
        let commandComplete = false;
        
        const timeout = setTimeout(() => {
          if (!commandComplete) {
            console.log(`⏰ Config command timeout: ${command}`);
            commandComplete = true;
            session.busy = false;
            resolve({ success: true, output: output.trim(), timeout: true });
          }
        }, 120000); // 2 minutes for config commands
        
        const dataHandler = (data) => {
          try {
            const chunk = data.toString('utf8');
            output += chunk;
            
            if (!commandSent && (chunk.includes('#') || chunk.includes('>'))) {
              // First, disable paging
              console.log(`📺 Disabling paging for config command`);
              stream.write('terminal length 0\r\n');
              commandSent = true;
              
            } else if (commandSent && !pagingDisabled && (chunk.includes('#') || chunk.includes('>'))) {
              // Paging disabled, now send the actual command
              console.log(`📝 Executing config command: ${command}`);
              stream.write(command + '\r\n');
              pagingDisabled = true;
              configCommandSent = true;
              
            } else if (chunk.includes('--More--') || chunk.includes('-- More --')) {
              // Handle any remaining paging
              console.log(`📄 Handling paged output`);
              stream.write(' ');
              
            } else if (configCommandSent && !commandComplete && (chunk.includes('#') || chunk.includes('>'))) {
              // Check if configuration is complete
              const lines = output.split('\n');
              const lastFewLines = lines.slice(-5).join('\n');
              
              // Look for end markers
              if (output.includes('\nend\n') || output.includes('\nend\r') || lastFewLines.includes('end')) {
                console.log(`🎯 Configuration end marker detected`);
                clearTimeout(timeout);
                commandComplete = true;
                session.busy = false;
                
                // Clean up the output
                const cleanOutput = this.cleanConfigOutput(output, command);
                
                // Update performance metrics
                this.updateSessionPerformance(session, startTime);
                
                stream.removeListener('data', dataHandler);
                resolve({ 
                  success: true, 
                  output: cleanOutput,
                  executionTime: Date.now() - startTime
                });
              }
            }
            
          } catch (dataError) {
            console.error(`❌ Config command data error: ${dataError.message}`);
          }
        };
        
        stream.on('data', dataHandler);
        
        stream.on('error', (streamError) => {
          console.error(`❌ Config command stream error: ${streamError.message}`);
          clearTimeout(timeout);
          commandComplete = true;
          session.busy = false;
          stream.removeListener('data', dataHandler);
          reject(new Error(`Config command stream error: ${streamError.message}`));
        });
        
        // Trigger initial prompt
        stream.write('\r\n');
      });
      
    } catch (error) {
      session.busy = false;
      console.error(`❌ Config command failed:`, error.message);
      throw error;
    }
  }

  // Clean configuration output
  cleanConfigOutput(rawOutput, command) {
    let cleaned = rawOutput;
    
    // Remove command echo and prompts
    const lines = cleaned.split('\n');
    const configLines = [];
    let inConfig = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip command echo and prompts
      if (trimmed.includes(command) || trimmed.includes('>') || trimmed.includes('#')) {
        continue;
      }
      
      // Skip paging markers
      if (trimmed.includes('--More--') || trimmed.includes('terminal length')) {
        continue;
      }
      
      // Start collecting from version or hostname
      if (trimmed.startsWith('version') || trimmed.startsWith('hostname') || trimmed.startsWith('!')) {
        inConfig = true;
      }
      
      if (inConfig && trimmed.length > 0) {
        configLines.push(line);
      }
    }
    
    return configLines.join('\n').trim();
  }

  // Update session performance metrics safely
  updateSessionPerformance(session, startTime) {
    const executionTime = Date.now() - startTime;
    
    // Initialize performance object if not exists
    if (!session.performance) {
      session.performance = {
        avgCommandTime: 0,
        totalCommands: 0,
        lastCommandTime: 0
      };
    }
    
    session.performance.totalCommands++;
    session.performance.lastCommandTime = executionTime;
    session.performance.avgCommandTime = 
      (session.performance.avgCommandTime * (session.performance.totalCommands - 1) + executionTime) / 
      session.performance.totalCommands;
  }

  // Clean up corrupted session safely
  cleanupCorruptedSession(session, sessionKey) {
    try {
      if (session.connection) {
        session.connection.end();
      }
      if (session.privilegedStream) {
        session.privilegedStream.end();
      }
    } catch (cleanupError) {
      console.log(`⚠️ Error cleaning up corrupted session: ${cleanupError.message}`);
    }
    this.persistentSessions.delete(sessionKey);
  }

  // Fast backup using persistent session (no enable needed)
  async fastBackupWithSession(deviceConfig, configType = 'running-config') {
    return await this.optimizedBackup(deviceConfig, configType);
  }

  // Fast backup using persistent session
  async fastBackup(deviceConfig) {
    try {
      console.log(`⚡ Starting fast backup for ${deviceConfig.ip_address}`);
      
      // Get or create persistent session
      const session = await this.getOrCreatePersistentSession(deviceConfig);
      
      // Execute backup commands on persistent session
      const runningConfigResult = await this.executeCommandOnPersistentSession(
        session, 
        'show running-config'
      );
      
      console.log(`✅ Fast backup completed for ${deviceConfig.ip_address} (${runningConfigResult.output.length} chars)`);
      
      return {
        success: true,
        runningConfig: runningConfigResult.output,
        runningConfigSize: runningConfigResult.output.length,
        startupConfig: null,
        startupConfigSize: 0,
        configType: 'running-config',
        timestamp: new Date().toISOString(),
        sessionReused: session.useCount > 1,
        deviceInfo: {
          name: deviceConfig.name,
          type: deviceConfig.type,
          ip_address: deviceConfig.ip_address
        }
      };
      
    } catch (error) {
      console.error(`❌ Fast backup failed for ${deviceConfig.ip_address}:`, error.message);
      throw error;
    }
  }

  // Session-based deployment (no enable needed)
  async fastDeployWithSession(deviceConfig, configuration) {
    try {
      console.log(`⚡ Starting session-based deployment for ${deviceConfig.ip_address}`);
      
      const deviceId = deviceConfig.id || deviceConfig._id;
      const sessionKey = `${deviceId}_persistent`;
      const session = this.persistentSessions.get(sessionKey);
      
      if (!session || !this.isSessionValid(session)) {
        throw new Error('No active SSH session found. Please connect SSH session first.');
      }
      
      console.log(`♻️ Using existing SSH session for deployment (no enable needed)`);
      
      // Split configuration into commands
      const commands = configuration.split('\n').filter(cmd => cmd.trim());
      let deploymentOutput = '';
      
      // Execute each command on existing session
      for (const command of commands) {
        if (command.trim()) {
          const result = await this.executeCommandOnPersistentSession(session, command.trim());
          deploymentOutput += `${command}\n${result.output}\n\n`;
        }
      }
      
      console.log(`✅ Session-based deployment completed for ${deviceConfig.ip_address}`);
      
      return {
        success: true,
        output: deploymentOutput,
        sessionReused: true,
        useCount: session.useCount,
        commandCount: commands.length
      };
      
    } catch (error) {
      console.error(`❌ Session-based deployment failed for ${deviceConfig.ip_address}:`, error.message);
      throw error;
    }
  }

  // Multi-device parallel session management
  async createParallelSessions(deviceConfigs) {
    console.log(`🚀 Creating parallel sessions for ${deviceConfigs.length} devices`);
    
    const sessionPromises = deviceConfigs.map(async (deviceConfig) => {
      try {
        const session = await this.getOptimalSession(deviceConfig);
        return {
          deviceId: deviceConfig.id || deviceConfig._id,
          deviceName: deviceConfig.name,
          session: session,
          success: true
        };
      } catch (error) {
        return {
          deviceId: deviceConfig.id || deviceConfig._id,
          deviceName: deviceConfig.name,
          session: null,
          success: false,
          error: error.message
        };
      }
    });
    
    const results = await Promise.all(sessionPromises);
    const successfulSessions = results.filter(r => r.success);
    
    console.log(`✅ Parallel session creation: ${successfulSessions.length}/${deviceConfigs.length} successful`);
    
    return {
      success: successfulSessions.length > 0,
      sessions: results,
      successfulCount: successfulSessions.length,
      totalCount: deviceConfigs.length
    };
  }

  // Parallel backup for multiple devices
  async parallelBackup(deviceConfigs) {
    console.log(`📦 Starting parallel backup for ${deviceConfigs.length} devices`);
    
    const backupPromises = deviceConfigs.map(async (deviceConfig) => {
      try {
        const session = await this.getOptimalSession(deviceConfig);
        const backupResult = await this.fastBackupWithSession(deviceConfig);
        
        return {
          deviceId: deviceConfig.id || deviceConfig._id,
          deviceName: deviceConfig.name,
          success: true,
          backup: backupResult,
          sessionPerformance: session.performance
        };
      } catch (error) {
        return {
          deviceId: deviceConfig.id || deviceConfig._id,
          deviceName: deviceConfig.name,
          success: false,
          error: error.message
        };
      }
    });
    
    const results = await Promise.all(backupPromises);
    const successfulBackups = results.filter(r => r.success);
    
    console.log(`✅ Parallel backup completed: ${successfulBackups.length}/${deviceConfigs.length} successful`);
    
    return {
      success: successfulBackups.length > 0,
      results: results,
      successfulCount: successfulBackups.length,
      totalCount: deviceConfigs.length,
      totalConfigSize: successfulBackups.reduce((sum, r) => sum + (r.backup?.runningConfigSize || 0), 0)
    };
  }

  // Parallel deployment for multiple devices
  async parallelDeploy(deviceConfigs, configurations) {
    console.log(`🚀 Starting parallel deployment for ${deviceConfigs.length} devices`);
    
    const deployPromises = deviceConfigs.map(async (deviceConfig, index) => {
      try {
        const session = await this.getOptimalSession(deviceConfig);
        const configuration = configurations[index];
        
        const deployResult = await this.fastDeployWithSession(deviceConfig, configuration);
        
        return {
          deviceId: deviceConfig.id || deviceConfig._id,
          deviceName: deviceConfig.name,
          success: true,
          deployment: deployResult,
          sessionPerformance: session.performance
        };
      } catch (error) {
        return {
          deviceId: deviceConfig.id || deviceConfig._id,
          deviceName: deviceConfig.name,
          success: false,
          error: error.message
        };
      }
    });
    
    const results = await Promise.all(deployPromises);
    const successfulDeployments = results.filter(r => r.success);
    
    console.log(`✅ Parallel deployment completed: ${successfulDeployments.length}/${deviceConfigs.length} successful`);
    
    return {
      success: successfulDeployments.length > 0,
      results: results,
      successfulCount: successfulDeployments.length,
      totalCount: deviceConfigs.length
    };
  }

  // Fast deployment using persistent session
  async fastDeploy(deviceConfig, configuration) {
    try {
      console.log(`⚡ Starting fast deployment for ${deviceConfig.ip_address}`);
      
      // Get or create persistent session
      const session = await this.getOrCreatePersistentSession(deviceConfig);
      
      // Split configuration into commands
      const commands = configuration.split('\n').filter(cmd => cmd.trim());
      let deploymentOutput = '';
      
      // Execute each command on persistent session
      for (const command of commands) {
        if (command.trim()) {
          const result = await this.executeCommandOnPersistentSession(session, command.trim());
          deploymentOutput += `${command}\n${result.output}\n\n`;
        }
      }
      
      console.log(`✅ Fast deployment completed for ${deviceConfig.ip_address}`);
      
      return {
        success: true,
        output: deploymentOutput,
        sessionReused: session.useCount > 1,
        commandCount: commands.length
      };
      
    } catch (error) {
      console.error(`❌ Fast deployment failed for ${deviceConfig.ip_address}:`, error.message);
      throw error;
    }
  }

  // Test connectivity method for debugging
  async testConnection(deviceConfig) {
    try {
      console.log(`🔍 Testing SSH connection to ${deviceConfig.ip_address}`);
      
      const conn = new Client();
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          conn.end();
          resolve({
            success: false,
            message: 'Connection timeout - device unreachable or wrong credentials',
            error: 'timeout'
          });
        }, 15000);
        
        conn.on('ready', () => {
          clearTimeout(timeout);
          console.log(`✅ SSH connection successful to ${deviceConfig.ip_address}`);
          
          conn.exec('show version | head 5', (err, stream) => {
            if (err) {
              conn.end();
              return resolve({
                success: false,
                message: 'Connected but command execution failed',
                error: err.message
              });
            }
            
            let output = '';
            stream.on('data', (data) => {
              output += data.toString();
            });
            
            stream.on('close', () => {
              conn.end();
              const deviceType = output.includes('IOS') ? 'Cisco IOS' : 
                               output.includes('NX-OS') ? 'Cisco NX-OS' : 
                               'Unknown';
              
              resolve({
                success: true,
                message: 'Connection and command execution successful',
                deviceType: deviceType,
                requiresEnable: output.includes('>'),
                versionInfo: output.split('\n')[0] || 'Version info not available'
              });
            });
            
            stream.on('error', (err) => {
              conn.end();
              resolve({
                success: false,
                message: 'Command execution error',
                error: err.message
              });
            });
          });
        });
        
        conn.on('error', (err) => {
          clearTimeout(timeout);
          console.error(`❌ SSH connection failed to ${deviceConfig.ip_address}:`, err.message);
          
          // Provide specific guidance based on error type
          let troubleshootingMessage = `Connection failed: ${err.message}`;
          let suggestions = [];
          
          if (err.message.includes('no matching key exchange algorithm')) {
            troubleshootingMessage = 'No compatible key exchange algorithms found';
            suggestions = [
              'Device may be using very old SSH algorithms',
              'Try: "ip ssh version 2" on the device',
              'Check if device supports DH Group 1 or 14'
            ];
          } else if (err.message.includes('Unsupported algorithm')) {
            troubleshootingMessage = `Unsupported SSH algorithm: ${err.message}`;
            suggestions = [
              'Device rejected one of our algorithm proposals',
              'This usually indicates algorithm negotiation succeeded',
              'Check device SSH configuration'
            ];
          } else if (err.message.includes('Authentication failed')) {
            troubleshootingMessage = 'SSH authentication failed';
            suggestions = [
              'Check username and password',
              'Verify device allows SSH login',
              'Check if account is locked'
            ];
          }
          
          resolve({
            success: false,
            message: troubleshootingMessage,
            error: err.code || err.message,
            suggestions: suggestions
          });
        });
        
        conn.connect({
          host: deviceConfig.ip_address,
          port: deviceConfig.ssh_port || 22,
          username: deviceConfig.username,
          password: deviceConfig.password,
          readyTimeout: 15000,
          authTimeout: 10000,
          tryKeyboard: true,
          // Add support for legacy Cisco devices
          algorithms: {
            kex: [
              // Legacy algorithms for older Cisco devices (most compatible first)
              'diffie-hellman-group1-sha1',
              'diffie-hellman-group14-sha1', 
              'diffie-hellman-group-exchange-sha1',
              'diffie-hellman-group-exchange-sha256',
              'diffie-hellman-group14-sha256',
              // Modern algorithms
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
              // Put legacy hmac-sha1 first (what older devices use)
              'hmac-sha1',
              'hmac-sha2-256',
              'hmac-sha2-512', 
              'hmac-md5',
              'hmac-sha1-96',
              'hmac-md5-96'
            ],
            serverHostKey: [
              // Put ssh-rsa first (what older devices use)
              'ssh-rsa',
              'rsa-sha2-512',
              'rsa-sha2-256',
              'ssh-dss',
              'ecdsa-sha2-nistp256',
              'ecdsa-sha2-nistp384',
              'ecdsa-sha2-nistp521',
              'ssh-ed25519'
            ]
          }
        });
      });
      
    } catch (error) {
      return {
        success: false,
        message: `Connection test failed: ${error.message}`,
        error: error.message
      };
    }
  }

  // Backup and Restore Methods
  async getRunningConfig(deviceConfig, retryCount = 0) {
    const maxRetries = 3; // Increased from 2 to 3
    
    try {
      console.log(`📋 Getting running configuration from ${deviceConfig.ip_address} (attempt ${retryCount + 1}/${maxRetries + 1})`);
      
      // Check if device has an active session first
      const deviceId = deviceConfig.id || deviceConfig._id;
      const sessionKey = `${deviceId}_persistent`;
      const existingSession = this.persistentSessions.get(sessionKey);
      
      if (existingSession && this.isSessionValid(existingSession)) {
        console.log(`♻️ Using existing SSH session for running config (no enable needed)`);
        const result = await this.executeCommandOnPersistentSession(existingSession, 'show running-config');
        return {
          success: true,
          config: result.output,
          size: result.output.length,
          sessionReused: true
        };
      }
      
      // Force disconnect any existing stale connections
      console.log(`🔌 Cleaning up any existing connections for ${deviceConfig.ip_address}`);
      this.disconnect(deviceConfig.id || deviceConfig._id);
      
      // Add a delay between attempts for device recovery
      if (retryCount > 0) {
        console.log(`⏳ Waiting ${3 + retryCount * 2} seconds for device recovery...`);
        await new Promise(resolve => setTimeout(resolve, (3 + retryCount * 2) * 1000));
      }
      
      // Test connection health before attempting backup
      const connectionHealth = await this.testConnection(deviceConfig);
      if (!connectionHealth.success) {
        throw new Error(`Connection health check failed: ${connectionHealth.message}`);
      }
      
      // Run performance diagnostics on first attempt
      if (retryCount === 0) {
        await this.checkDevicePerformance(deviceConfig);
      }
      
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
      
      // Clean up remaining unwanted lines while preserving config - less aggressive
      const cleanLines = config.split('\n').filter(line => {
        const trimmed = line.trim();
        // Only remove very specific unwanted patterns, keep everything else
        return !(
          trimmed.match(/^[\w-]+[>#]\s*$/) || // Device prompts only (standalone)
          trimmed === 'terminal length 0' || // Our exact terminal command
          trimmed === 'show running-config' || // Our exact command echo
          trimmed === 'show startup-config' || // Our exact command echo
          (trimmed.includes('Building configuration') && trimmed.length < 50) // Short building messages
        );
      });
      
      config = cleanLines.join('\n').trim();
      
      // Analyze configuration completeness
      const configLines = config.split('\n').length;
      const hasVersion = config.includes('version');
      const hasEnd = config.includes('end');
      const hasHostname = config.includes('hostname');
      const hasInterfaces = config.includes('interface');
      
      console.log(`📊 Configuration analysis for ${deviceConfig.ip_address}:`);
      console.log(`   📏 Total length: ${config.length} characters`);
      console.log(`   📝 Total lines: ${configLines}`);
      console.log(`   ✅ Has version: ${hasVersion}`);
      console.log(`   ✅ Has hostname: ${hasHostname}`);  
      console.log(`   ✅ Has interfaces: ${hasInterfaces}`);
      console.log(`   ✅ Has end marker: ${hasEnd}`);
      
      if (config.length < 200 || configLines < 20) {
        console.warn(`⚠️ Configuration seems incomplete for a typical Cisco device!`);
        console.warn(`⚠️ Raw output length was: ${result.output.length} characters`);
        console.warn(`⚠️ First 500 chars of raw output: ${result.output.substring(0, 500)}`);
      }
      
      console.log(`✅ Successfully retrieved running config from ${deviceConfig.ip_address}`);
      console.log(`📋 Final config preview (first 300 chars): ${config.substring(0, 300)}...`);
      
      return {
        success: true,
        config: config,
        size: Buffer.byteLength(config, 'utf8')
      };
      
    } catch (error) {
      console.error(`❌ Failed to get running config from ${deviceConfig.ip_address} (attempt ${retryCount + 1}):`, error.message);
      
      // Cleanup connection on any error
      this.disconnect(deviceConfig.id || deviceConfig._id);
      
      // Retry logic for timeout and connection errors
      if (retryCount < maxRetries && 
          (error.message.includes('timeout') || 
           error.message.includes('Connection') || 
           error.message.includes('ECONNRESET') ||
           error.message.includes('ECONNABORTED') ||
           error.message.includes('No response from server') ||
           error.message.includes('Failed to create shell') ||
           error.message.includes('EPIPE'))) {
        
        console.log(`🔄 Retrying backup for ${deviceConfig.ip_address}...`);
        
        return this.getRunningConfig(deviceConfig, retryCount + 1);
      }
      
      // If all retries failed due to timeout, try segmented approach
      if (error.message.includes('timeout')) {
        console.log(`🔄 Standard backup failed, trying segmented approach for ${deviceConfig.ip_address}...`);
        try {
          return await this.getRunningConfigSegmented(deviceConfig);
        } catch (segmentedError) {
          console.error(`❌ Both standard and segmented backup failed for ${deviceConfig.ip_address}`);
          throw new Error(`All backup methods failed: ${error.message}. Segmented attempt: ${segmentedError.message}`);
        }
      }
      
      throw new Error(`Failed to get running configuration: ${error.message}`);
    }
  }

  async getStartupConfig(deviceConfig, retryCount = 0) {
    const maxRetries = 3; // Increased from 2 to 3
    
    try {
      console.log(`📋 Getting startup configuration from ${deviceConfig.ip_address} (attempt ${retryCount + 1}/${maxRetries + 1})`);
      
      // Force disconnect any existing stale connections
      console.log(`🔌 Cleaning up any existing connections for ${deviceConfig.ip_address}`);
      this.disconnect(deviceConfig.id || deviceConfig._id);
      
      // Add a delay between attempts for device recovery
      if (retryCount > 0) {
        console.log(`⏳ Waiting ${3 + retryCount * 2} seconds for device recovery...`);
        await new Promise(resolve => setTimeout(resolve, (3 + retryCount * 2) * 1000));
      }
      
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
      console.error(`❌ Failed to get startup config from ${deviceConfig.ip_address} (attempt ${retryCount + 1}):`, error.message);
      
      // Cleanup connection on any error
      this.disconnect(deviceConfig.id || deviceConfig._id);
      
      // Retry logic for timeout and connection errors
      if (retryCount < maxRetries && 
          (error.message.includes('timeout') || 
           error.message.includes('Connection') || 
           error.message.includes('ECONNRESET') ||
           error.message.includes('ECONNABORTED') ||
           error.message.includes('No response from server') ||
           error.message.includes('Failed to create shell') ||
           error.message.includes('EPIPE'))) {
        
        console.log(`🔄 Retrying startup config backup for ${deviceConfig.ip_address}...`);
        
        return this.getStartupConfig(deviceConfig, retryCount + 1);
      }
      
      throw new Error(`Failed to get startup configuration: ${error.message}`);
    }
  }

  async createFullBackup(deviceConfig, options = {}) {
    let runningResult = { success: false, error: 'Not requested' };
    let startupResult = { success: false, error: 'Not requested' };
    
    try {
      const { config_type = 'running-config' } = options;
      console.log(`💾 Creating ${config_type} backup for ${deviceConfig.ip_address}`);
      
      // Fetch configurations based on config_type
      if (config_type === 'running-config' || config_type === 'both') {
        runningResult = await this.getRunningConfig(deviceConfig).catch(err => ({ success: false, error: err.message }));
      }
      
      if (config_type === 'startup-config' || config_type === 'both') {
        startupResult = await this.getStartupConfig(deviceConfig).catch(err => ({ success: false, error: err.message }));
      }
      
      // Check if we got at least one successful config based on what was requested
      const hasRequiredConfig = 
        (config_type === 'running-config' && runningResult.success) ||
        (config_type === 'startup-config' && startupResult.success) ||
        (config_type === 'both' && (runningResult.success || startupResult.success));
      
      if (!hasRequiredConfig) {
        const errors = [];
        if ((config_type === 'running-config' || config_type === 'both') && !runningResult.success) {
          errors.push(`Running config: ${runningResult.error}`);
        }
        if ((config_type === 'startup-config' || config_type === 'both') && !startupResult.success) {
          errors.push(`Startup config: ${startupResult.error}`);
        }
        throw new Error(`Failed to get required configurations: ${errors.join(', ')}`);
      }
      
      const backup = {
        success: true,
        runningConfig: runningResult.success ? runningResult.config : null,
        runningConfigSize: runningResult.success ? runningResult.size : 0,
        startupConfig: startupResult.success ? startupResult.config : null,
        startupConfigSize: startupResult.success ? startupResult.size : 0,
        configType: config_type,
        timestamp: new Date().toISOString(),
        deviceInfo: {
          name: deviceConfig.name,
          type: deviceConfig.type,
          ip_address: deviceConfig.ip_address,
          model: deviceConfig.model,
          ios_version: deviceConfig.ios_version
        }
      };
      
      console.log(`✅ ${config_type} backup completed for ${deviceConfig.ip_address}`);
      return backup;
      
    } catch (error) {
      console.error(`❌ Backup failed for ${deviceConfig.ip_address}:`, error.message);
      return {
        success: false,
        runningError: runningResult?.error || null,
        startupError: startupResult?.error || null,
        generalError: error.message,
        deviceInfo: {
          name: deviceConfig.name,
          type: deviceConfig.type,
          ip_address: deviceConfig.ip_address
        }
      };
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

  // Optimized restore using persistent sessions with error tolerance
  async applyConfigurationFromBackup(deviceConfig, configCommands) {
    try {
      console.log(`🔄 Starting backup restore for ${deviceConfig.ip_address}`);
      console.log(`📝 Configuration to restore (${configCommands.length} characters):`);
      console.log(`First 500 chars: ${configCommands.substring(0, 500)}`);
      
      // Use sendConfigCommands with error tolerance enabled for backup restore
      // This allows the restore to continue even if some commands fail
      const result = await this.sendConfigCommands(deviceConfig, configCommands, { tolerateErrors: true });
      
      console.log(`✅ Backup configuration restored for ${deviceConfig.ip_address}`);
      console.log(`📊 Restore result:`, {
        success: result.success,
        commandsExecuted: result.commandsExecuted?.length || 0,
        outputLength: result.output?.length || 0,
        errorCount: result.errorCount || 0,
        hasWarnings: result.hasWarnings || false
      });
      
      // Log any warnings but still return success
      if (result.hasWarnings) {
        console.warn(`⚠️ Restore completed with ${result.errorCount} warning(s) for ${deviceConfig.ip_address}`);
        console.warn(`⚠️ Some commands may have failed, but configuration was mostly restored`);
      }
      
      return {
        success: true,
        output: result.output,
        message: result.hasWarnings 
          ? `Backup configuration restored with ${result.errorCount} warning(s) - some commands may have failed`
          : 'Backup configuration restored successfully',
        errorCount: result.errorCount || 0,
        hasWarnings: result.hasWarnings || false
      };
      
    } catch (error) {
      console.error(`❌ Backup restore failed for ${deviceConfig.ip_address}:`, error.message);
      console.error(`❌ Full error:`, error);
      throw new Error(`Failed to restore backup configuration: ${error.message}`);
    }
  }

  // Alternative backup method for devices with very large configs or timeout issues
  async getRunningConfigSegmented(deviceConfig) {
    try {
      console.log(`📋 Getting running configuration in segments from ${deviceConfig.ip_address}`);
      
      const segments = [
        'show running-config | section ^version',
        'show running-config | section ^hostname',
        'show running-config | section ^service',
        'show running-config | section ^platform',
        'show running-config | section ^interface',
        'show running-config | section ^router',
        'show running-config | section ^ip route',
        'show running-config | section ^access-list',
        'show running-config | section ^line',
        'show running-config | section ^end'
      ];
      
      let fullConfig = '';
      
      for (const command of segments) {
        try {
          console.log(`📝 Getting segment: ${command}`);
          const result = await this.executeCommandWithEnable(deviceConfig, command);
          
          if (result.success && result.output.trim()) {
            fullConfig += result.output.trim() + '\n';
          }
          
          // Small delay between segments
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (segmentError) {
          console.warn(`⚠️ Failed to get segment ${command}: ${segmentError.message}`);
          // Continue with other segments
        }
      }
      
      if (fullConfig.length < 100) {
        throw new Error('Segmented backup failed - insufficient data retrieved');
      }
      
      console.log(`✅ Segmented backup completed for ${deviceConfig.ip_address} (${fullConfig.length} characters)`);
      
      return {
        success: true,
        config: fullConfig.trim(),
        size: Buffer.byteLength(fullConfig, 'utf8'),
        method: 'segmented'
      };
      
    } catch (error) {
      console.error(`❌ Segmented backup failed for ${deviceConfig.ip_address}:`, error.message);
      throw error;
    }
  }

  // Diagnostic method to check device performance before backup
  async checkDevicePerformance(deviceConfig) {
    try {
      console.log(`🔍 Running performance diagnostics for ${deviceConfig.ip_address}`);
      
      const diagnostics = {};
      
      // Check CPU utilization
      try {
        const cpuResult = await this.executeCommandWithEnable(deviceConfig, 'show processes cpu | include CPU');
        diagnostics.cpu = cpuResult.success ? cpuResult.output.trim() : 'Unable to get CPU info';
      } catch (error) {
        diagnostics.cpu = `Error: ${error.message}`;
      }
      
      // Check memory utilization
      try {
        const memResult = await this.executeCommandWithEnable(deviceConfig, 'show memory summary');
        diagnostics.memory = memResult.success ? memResult.output.trim() : 'Unable to get memory info';
      } catch (error) {
        diagnostics.memory = `Error: ${error.message}`;
      }
      
      // Estimate config size
      try {
        const sizeResult = await this.executeCommandWithEnable(deviceConfig, 'show running-config | count');
        diagnostics.configLines = sizeResult.success ? sizeResult.output.trim() : 'Unable to count lines';
      } catch (error) {
        diagnostics.configLines = `Error: ${error.message}`;
      }
      
      // Check device uptime
      try {
        const uptimeResult = await this.executeCommandWithEnable(deviceConfig, 'show version | include uptime');
        diagnostics.uptime = uptimeResult.success ? uptimeResult.output.trim() : 'Unable to get uptime';
      } catch (error) {
        diagnostics.uptime = `Error: ${error.message}`;
      }
      
      console.log(`📊 Performance diagnostics for ${deviceConfig.ip_address}:`);
      console.log(`   💾 CPU: ${diagnostics.cpu}`);
      console.log(`   🧠 Memory: ${diagnostics.memory}`);
      console.log(`   📝 Config lines: ${diagnostics.configLines}`);
      console.log(`   ⏰ Uptime: ${diagnostics.uptime}`);
      
      return {
        success: true,
        diagnostics
      };
      
    } catch (error) {
      console.warn(`⚠️ Performance diagnostics failed for ${deviceConfig.ip_address}: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default new SSHService();
