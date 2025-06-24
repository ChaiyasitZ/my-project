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

      console.log(`🔌 Found ${formattedPorts.length} serial ports`);
      
      return {
        success: true,
        ports: formattedPorts,
        count: formattedPorts.length
      };
    } catch (error) {
      console.error('❌ Error listing serial ports:', error.message);
      return {
        success: false,
        error: error.message,
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
        autoOpen: false
      };

      const port = new SerialPort(serialConfig);
      const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          port.close();
          reject(new Error('Console connection timeout'));
        }, 10000);

        port.open((err) => {
          if (err) {
            clearTimeout(timeout);
            console.error(`❌ Failed to open console port ${portPath}:`, err.message);
            reject(new Error(`Failed to open console port: ${err.message}`));
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
        
        // Send the command
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

      // Prepare configuration commands
      const commands = configCommands.split('\n')
        .map(cmd => cmd.trim())
        .filter(cmd => cmd && !cmd.startsWith('#'));

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
      basic_switch: {
        name: 'Basic Switch Configuration',
        description: 'Essential configuration for a new Cisco switch',
        config: `enable
configure terminal
hostname {{hostname}}
enable secret {{enable_password}}
username {{username}} secret {{user_password}}
username {{username}} privilege 15
ip domain-name {{domain}}
crypto key generate rsa modulus 2048
ip ssh version 2
line vty 0 15
 login local
 transport input ssh
line console 0
 logging synchronous
 exec-timeout 30 0
interface vlan1
 ip address {{management_ip}} {{management_mask}}
 no shutdown
ip default-gateway {{default_gateway}}
banner motd # Authorized access only #
service password-encryption
no ip http server
no ip http secure-server
end
write memory`
      },
      
      basic_router: {
        name: 'Basic Router Configuration',
        description: 'Essential configuration for a new Cisco router',
        config: `enable
configure terminal
hostname {{hostname}}
enable secret {{enable_password}}
username {{username}} secret {{user_password}}
username {{username}} privilege 15
ip domain-name {{domain}}
crypto key generate rsa modulus 2048
ip ssh version 2
line vty 0 4
 login local
 transport input ssh
line console 0
 logging synchronous
 exec-timeout 30 0
banner motd # Authorized access only #
service password-encryption
no ip http server
no ip http secure-server
end
write memory`
      },

      security_hardening: {
        name: 'Security Hardening',
        description: 'Security best practices configuration',
        config: `enable
configure terminal
service password-encryption
security passwords min-length 8
login block-for 300 attempts 3 within 60
service tcp-keepalives-in
service tcp-keepalives-out
no service pad
no ip bootp server
no ip http server
no ip http secure-server
no ip finger
no ip source-route
no cdp run
spanning-tree mode rapid-pvst
spanning-tree portfast bpduguard default
spanning-tree portfast bpdufilter default
end
write memory`
      }
    };
  }
}

export default new ConsoleService(); 