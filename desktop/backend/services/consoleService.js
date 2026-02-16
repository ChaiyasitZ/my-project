import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

export class ConsoleService {
  constructor() {
    this.connections = new Map(); // Store active console connections
    this.defaultSettings = {
      baudRate: 9600,
      dataBits: 8,
      parity: 'none',
      stopBits: 1,
      flowControl: false
    };
  }

  // Get list of available serial ports
  async getAvailablePorts() {
    try {
      const ports = await SerialPort.list();
      
      // Filter and format ports for better display
      const formattedPorts = ports.map(port => {
        // Create a clean, short display name
        let displayName = port.path; // Default to just COM4, COM3, etc.
        
        // Add descriptive info if available
        if (port.manufacturer && !port.manufacturer.includes('Unknown')) {
          if (port.manufacturer.toLowerCase().includes('ftdi')) {
            displayName = `${port.path} - FTDI USB Serial`;
          } else if (port.manufacturer.toLowerCase().includes('prolific')) {
            displayName = `${port.path} - Prolific USB Serial`;
          } else if (port.manufacturer.toLowerCase().includes('silicon')) {
            displayName = `${port.path} - Silicon Labs USB Serial`;
          } else if (port.manufacturer.toLowerCase().includes('bluetooth')) {
            displayName = `${port.path} - Bluetooth Serial`;
          } else {
            displayName = `${port.path} - ${port.manufacturer}`;
          }
        } else if (port.friendlyName && port.friendlyName !== port.path) {
          // Clean up Windows friendly names
          let cleanName = port.friendlyName;
          // Remove redundant COM port references
          cleanName = cleanName.replace(/\s*\([A-Z]+\d+\)\s*/g, '');
          cleanName = cleanName.replace(/\s*\([A-Z]+\d+\)/, '');
          // Simplify common names
          cleanName = cleanName.replace('Standard Serial over Bluetooth link', 'Bluetooth Serial');
          cleanName = cleanName.replace('USB Serial Port', 'USB Serial');
          cleanName = cleanName.replace('Communications Port', 'Serial Port');
          
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
          isUSB: port.path.includes('USB') || port.manufacturer?.toLowerCase().includes('usb') || 
                 (port.friendlyName && port.friendlyName.toLowerCase().includes('usb'))
        };
      });

      // Filter out ports that are likely not real serial devices on Windows
      const validPorts = formattedPorts.filter(port => {
        // Skip virtual ports that might cause issues
        const skipPatterns = [
          'bluetooth',
          'virtual',
          'loopback'
        ];
        
        const lowerPath = port.path.toLowerCase();
        const lowerName = port.friendlyName.toLowerCase();
        
        return !skipPatterns.some(pattern => 
          lowerPath.includes(pattern) || lowerName.includes(pattern)
        );
      });

      console.log(`🔌 Found ${validPorts.length} valid serial ports (filtered from ${formattedPorts.length} total)`);
      
      return {
        success: true,
        ports: validPorts,
        count: validPorts.length
      };
    } catch (error) {
      console.error('❌ Error listing serial ports:', error.message);
      
      // More specific error messages for common Windows issues
      let errorMessage = error.message;
      if (error.message.includes('Access is denied')) {
        errorMessage = 'Access denied to serial ports. Please run as administrator or check port permissions.';
      } else if (error.message.includes('ENOENT')) {
        errorMessage = 'Serial port driver not found. Please install USB-to-serial drivers.';
      } else if (error.message.includes('Permission denied')) {
        errorMessage = 'Permission denied accessing serial ports. Check user permissions.';
      }
      
      return {
        success: false,
        error: errorMessage,
        ports: [],
        count: 0
      };
    }
  }

  // Connect to device via console
  async connectConsole(connectionConfig) {
    const { deviceId, portPath, baudRate, dataBits, parity, stopBits } = connectionConfig;
    
    try {
      console.log(`🔌 Connecting to console via ${portPath}`);
      
      // Close existing connection if any
      if (this.connections.has(deviceId)) {
        await this.disconnectConsole(deviceId);
      }

      const serialConfig = {
        path: portPath,
        baudRate: baudRate || this.defaultSettings.baudRate,
        dataBits: dataBits || this.defaultSettings.dataBits,
        parity: parity || this.defaultSettings.parity,
        stopBits: stopBits || this.defaultSettings.stopBits,
        autoOpen: false,
        // Windows-specific settings
        hupcl: false, // Don't hang up on close
        lock: false   // Don't lock the port
      };

      console.log(`📋 Serial config:`, serialConfig);

      const port = new SerialPort(serialConfig);
      const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.log('⏰ Connection timeout, closing port...');
          port.close();
          reject(new Error('Console connection timeout after 10 seconds'));
        }, 10000);

        port.open((err) => {
          if (err) {
            clearTimeout(timeout);
            console.error(`❌ Failed to open console port ${portPath}:`, err.message);
            
            // Provide more specific error messages
            let errorMessage = err.message;
            if (err.message.includes('Access is denied') || err.message.includes('EACCES')) {
              errorMessage = `Port ${portPath} is already in use or access denied. Please close other terminal applications.`;
            } else if (err.message.includes('ENOENT')) {
              errorMessage = `Port ${portPath} not found. Please check if the device is connected.`;
            } else if (err.message.includes('EBUSY')) {
              errorMessage = `Port ${portPath} is busy. Another application may be using it.`;
            }
            
            reject(new Error(errorMessage));
            return;
          }

          clearTimeout(timeout);
          console.log(`✅ Console connected via ${portPath}`);
          
          // Store connection info
          this.connections.set(deviceId, {
            port,
            parser,
            portPath,
            connectedAt: new Date(),
            config: serialConfig
          });

          // Handle initial configuration dialog automatically
          this.handleInitialConfigDialog(deviceId);

          resolve({
            success: true,
            message: `Console connected via ${portPath}`,
            portPath,
            config: serialConfig
          });
        });

        // Handle connection errors
        port.on('error', (err) => {
          console.error(`❌ Console port error on ${portPath}:`, err.message);
          this.connections.delete(deviceId);
        });

        port.on('close', () => {
          console.log(`🔌 Console connection closed for ${portPath}`);
          this.connections.delete(deviceId);
        });
      });
    } catch (error) {
      console.error('❌ Console connection error:', error.message);
      throw new Error(`Console connection failed: ${error.message}`);
    }
  }

  // Handle initial configuration dialog automatically
  async handleInitialConfigDialog(deviceId) {
    try {
      const connection = this.connections.get(deviceId);
      if (!connection) {
        console.log(`⚠️ No connection found for device ${deviceId} to handle initial dialog`);
        return;
      }

      const { parser, port } = connection;
      
      console.log(`🤖 Setting up automatic initial configuration dialog handler for device ${deviceId}`);
      
      // Set up a listener for initial configuration dialog
      const dialogHandler = (data) => {
        const response = data.toString().toLowerCase();
        console.log(`📥 Received from device: ${data}`);
        
        // Check for initial configuration dialog prompt
        if (response.includes('would you like to enter the initial configuration dialog') && 
            (response.includes('[yes/no]') || response.includes('(yes/no)'))) {
          console.log(`🚫 Auto-responding 'no' to initial configuration dialog for device ${deviceId}`);
          port.write('no\r\n');
        }
        // Handle follow-up questions
        else if (response.includes('would you like to terminate autoinstall') && 
                 (response.includes('[yes]') || response.includes('(yes)'))) {
          console.log(`✅ Auto-responding 'yes' to terminate autoinstall for device ${deviceId}`);
          port.write('yes\r\n');
        }
        // Handle any other yes/no prompts during startup
        else if (response.includes('press enter to continue') || 
                 response.includes('press return to get started')) {
          console.log(`⏎ Auto-pressing Enter to continue for device ${deviceId}`);
          port.write('\r\n');
        }
      };

      // Add handler for initial setup
      parser.on('data', dialogHandler);
      
      // Remove handler after 60 seconds to avoid interfering with normal operation
      setTimeout(() => {
        parser.removeListener('data', dialogHandler);
        console.log(`⏰ Removed initial configuration dialog handler for device ${deviceId} after 60 seconds`);
      }, 60000);

      // Send an initial carriage return to trigger any waiting prompts
      setTimeout(() => {
        console.log(`⏎ Sending initial carriage return to device ${deviceId}`);
        port.write('\r\n');
      }, 2000);

    } catch (error) {
      console.error(`❌ Error setting up initial dialog handler for device ${deviceId}:`, error.message);
    }
  }

  // Send command via console
  async sendConsoleCommand(deviceId, command, waitForPrompt = true) {
    try {
      const connection = this.connections.get(deviceId);
      if (!connection) {
        throw new Error('No active console connection found for device');
      }

      const { port, parser } = connection;
      
      return new Promise((resolve, reject) => {
        let output = '';
        let commandSent = false;
        
        const timeout = setTimeout(() => {
          reject(new Error('Console command timeout'));
        }, 30000);

        const dataHandler = (data) => {
          output += data + '\n';
          console.log(`📥 Console received: ${data}`);
          
          // Check for common Cisco prompts
          if (waitForPrompt && (
            data.includes('#') || 
            data.includes('>') || 
            data.includes('Password:') ||
            data.includes('Username:') ||
            data.includes('(config)#') ||
            data.includes('--More--')
          )) {
            clearTimeout(timeout);
            parser.removeListener('data', dataHandler);
            
            resolve({
              success: true,
              output: output.trim(),
              lastLine: data.trim()
            });
          }
        };

        parser.on('data', dataHandler);
        
        // Send command
        console.log(`➡️ Sending console command: ${command}`);
        port.write(command + '\r\n', (err) => {
          if (err) {
            clearTimeout(timeout);
            parser.removeListener('data', dataHandler);
            reject(new Error(`Failed to send command: ${err.message}`));
            return;
          }
          commandSent = true;
        });
        
        // If not waiting for prompt, resolve immediately after sending
        if (!waitForPrompt) {
          setTimeout(() => {
            clearTimeout(timeout);
            parser.removeListener('data', dataHandler);
            resolve({
              success: true,
              output: output.trim(),
              message: 'Command sent successfully'
            });
          }, 1000);
        }
      });
    } catch (error) {
      console.error('❌ Console command error:', error.message);
      throw new Error(`Console command failed: ${error.message}`);
    }
  }

  // Send initial configuration via console
  async sendInitialConfig(deviceId, configCommands, deviceInfo = {}) {
    try {
      console.log(`🔧 Starting initial configuration via console for device ${deviceId}`);
      
      const connection = this.connections.get(deviceId);
      if (!connection) {
        throw new Error('No active console connection found for device');
      }

      let configResults = [];
      let currentOutput = '';

      // Prepare configuration commands with special banner handling
      const lines = configCommands.split('\n');
      const commands = [];
      let inBanner = false;
      let bannerCommand = '';
      
      // Process lines to handle banner motd as a single command
      for (const line of lines) {
        const trimmed = line.trim();
        
        if (!trimmed || trimmed.startsWith('#')) continue;
        
        if (trimmed.startsWith('banner motd')) {
          inBanner = true;
          bannerCommand = trimmed;
        } else if (inBanner && trimmed === '#') {
          // End of banner - combine into single command
          inBanner = false;
          commands.push(bannerCommand);
          bannerCommand = '';
        } else if (inBanner) {
          // Skip banner content lines - they'll be handled by the banner command
          continue;
        } else {
          commands.push(trimmed);
        }
      }

      console.log(`📋 Sending ${commands.length} configuration commands`);

      // Send each command and collect results
      for (let i = 0; i < commands.length; i++) {
        const command = commands[i];
        console.log(`📝 Command ${i + 1}/${commands.length}: ${command}`);
        
        try {
          const result = await this.sendConsoleCommand(deviceId, command, true);
          configResults.push({
            command,
            success: true,
            output: result.output,
            sequence: i + 1
          });
          currentOutput += result.output + '\n';
          
          // Small delay between commands
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (cmdError) {
          console.error(`❌ Command failed: ${command}`, cmdError.message);
          configResults.push({
            command,
            success: false,
            error: cmdError.message,
            sequence: i + 1
          });
          
          // Continue with next command even if one fails
        }
      }

      // Try to save configuration
      try {
        console.log('💾 Saving configuration...');
        await this.sendConsoleCommand(deviceId, 'write memory', true);
        configResults.push({
          command: 'write memory',
          success: true,
          output: 'Configuration saved',
          sequence: commands.length + 1
        });
      } catch (saveError) {
        console.log('⚠️ Could not save configuration automatically');
        configResults.push({
          command: 'write memory',
          success: false,
          error: saveError.message,
          sequence: commands.length + 1
        });
      }

      const successCount = configResults.filter(r => r.success).length;
      const failCount = configResults.filter(r => !r.success).length;

      console.log(`✅ Initial configuration completed: ${successCount} success, ${failCount} failed`);

      return {
        success: true,
        message: `Initial configuration completed: ${successCount}/${configResults.length} commands successful`,
        results: configResults,
        summary: {
          totalCommands: configResults.length,
          successful: successCount,
          failed: failCount,
          successRate: Math.round((successCount / configResults.length) * 100)
        },
        fullOutput: currentOutput.trim()
      };

    } catch (error) {
      console.error('❌ Initial configuration error:', error.message);
      throw new Error(`Initial configuration failed: ${error.message}`);
    }
  }

  // Test console connection
  async testConsoleConnection(connectionConfig) {
    const tempDeviceId = `test_${Date.now()}`;
    
    try {
      console.log(`🧪 Testing console connection via ${connectionConfig.portPath}`);
      
      // Try to connect
      await this.connectConsole({
        ...connectionConfig,
        deviceId: tempDeviceId
      });

      // Send a simple command to test
      try {
        const result = await this.sendConsoleCommand(tempDeviceId, '\r', true);
        
        // Disconnect test connection
        await this.disconnectConsole(tempDeviceId);
        
        console.log(`✅ Console connection test successful`);
        return {
          success: true,
          message: 'Console connection test successful',
          output: result.output,
          portPath: connectionConfig.portPath
        };
        
      } catch (cmdError) {
        // Even if command fails, connection might be working
        await this.disconnectConsole(tempDeviceId);
        
        return {
          success: true,
          message: 'Console connection established (device may need configuration)',
          warning: 'Device did not respond to test command',
          portPath: connectionConfig.portPath
        };
      }
      
    } catch (error) {
      // Clean up any partial connection
      await this.disconnectConsole(tempDeviceId);
      
      console.error(`❌ Console connection test failed:`, error.message);
      return {
        success: false,
        message: error.message,
        portPath: connectionConfig.portPath
      };
    }
  }

  // Disconnect console
  async disconnectConsole(deviceId) {
    try {
      const connection = this.connections.get(deviceId);
      if (connection) {
        const { port, portPath } = connection;
        
        return new Promise((resolve) => {
          port.close((err) => {
            if (err) {
              console.error(`⚠️ Error closing console port ${portPath}:`, err.message);
            } else {
              console.log(`🔌 Console disconnected from ${portPath}`);
            }
            
            this.connections.delete(deviceId);
            resolve();
          });
        });
      }
    } catch (error) {
      console.error('❌ Console disconnect error:', error.message);
      this.connections.delete(deviceId);
    }
  }

  // Get console connection status
  getConsoleStatus(deviceId) {
    const connection = this.connections.get(deviceId);
    if (!connection) {
      return {
        connected: false,
        message: 'No active console connection'
      };
    }

    const { portPath, connectedAt, config } = connection;
    const duration = Math.round((Date.now() - connectedAt.getTime()) / 1000);

    return {
      connected: true,
      portPath,
      connectedAt: connectedAt.toISOString(),
      duration: `${duration} seconds`,
      config: {
        baudRate: config.baudRate,
        dataBits: config.dataBits,
        parity: config.parity,
        stopBits: config.stopBits
      }
    };
  }

  // Disconnect all console connections
  async disconnectAllConsoles() {
    console.log(`🔌 Disconnecting all console connections (${this.connections.size} active)`);
    
    const disconnectPromises = [];
    for (const deviceId of this.connections.keys()) {
      disconnectPromises.push(this.disconnectConsole(deviceId));
    }
    
    await Promise.all(disconnectPromises);
    this.connections.clear();
  }

  // Get initial configuration templates
  getInitialConfigTemplates() {
    return {
      ssh_configuration: {
        name: 'SSH Configuration',
        description: 'Configure SSH for Cisco devices with Manual IP and DHCP support',
        config: `enable
configure terminal
hostname {{hostname}}
username {{username}} secret {{user_password}}
username {{username}} privilege 15
no ip domain-lookup
ip domain-name {{domain}}
crypto key generate rsa modulus {{rsa_key_size}}
ip ssh version 2
ip ssh time-out 60
ip ssh authentication-retries 3
line vty 0 15
 login local
 transport input ssh
interface {{management_interface}}
 description Management Interface{{interface_description_suffix}}
{{ip_configuration}}
 no shutdown
banner motd ^C
=== Authorized Access Only ===
This system is for authorized users only.
All activities are monitored and logged.
^C
service password-encryption
no ip http server
no ip http secure-server
ip ssh logging events
end
write memory`
      }
    };
  }

  // Function to convert CIDR prefix to subnet mask
  cidrToSubnetMask(prefix) {
    const prefixNum = parseInt(prefix.replace('/', ''));
    if (isNaN(prefixNum) || prefixNum < 0 || prefixNum > 32) {
      return null;
    }
    
    const mask = (0xFFFFFFFF << (32 - prefixNum)) >>> 0;
    return [
      (mask >>> 24) & 0xFF,
      (mask >>> 16) & 0xFF,
      (mask >>> 8) & 0xFF,
      mask & 0xFF
    ].join('.');
  }

  // Process template with IP configuration method
  processTemplateWithIPConfig(templateKey, variables) {
    const templates = this.getInitialConfigTemplates();
    const template = templates[templateKey];
    
    if (!template) {
      throw new Error('Template not found');
    }

    let config = template.config;
    
    // Process IP configuration based on method
    const ipMethod = variables.ip_method || 'manual';
    
    if (ipMethod === 'dhcp') {
      // DHCP Configuration
      variables.interface_description_suffix = ' - DHCP';
      variables.ip_configuration = ' ip address dhcp';
    } else {
      // Manual IP Configuration
      variables.interface_description_suffix = '';
      
      // Convert CIDR to subnet mask if needed
      let subnetMask = variables.management_mask || '{{management_mask}}';
      if (subnetMask.startsWith('/')) {
        const converted = this.cidrToSubnetMask(subnetMask);
        subnetMask = converted || subnetMask;
      }
      
      variables.ip_configuration = ` ip address ${variables.management_ip || '{{management_ip}}'} ${subnetMask}`;
    }

    // Replace all variables in template
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      config = config.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
    });

    return config;
  }
}

export default new ConsoleService();
