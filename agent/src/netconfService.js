/**
 * NETCONF Service - Manage devices via NETCONF protocol
 */

const { Client } = require('ssh2');

// NETCONF message constants
const NETCONF_BASE_1_0 = 'urn:ietf:params:netconf:base:1.0';
const NETCONF_BASE_1_1 = 'urn:ietf:params:netconf:base:1.1';
const MSG_DELIMITER = ']]>]]>';
const MSG_DELIMITER_1_1 = '\n##\n';

// YANG namespaces for Cisco devices
const NAMESPACES = {
  'nxos': 'http://cisco.com/ns/yang/cisco-nx-os-device',
  'ios-xe': 'http://cisco.com/ns/yang/Cisco-IOS-XE-native'
};

const ROOT_ELEMENTS = {
  'nxos': 'System',
  'ios-xe': 'native'
};

class NetconfService {
  constructor() {
    this.defaultPort = 830;
    this.defaultTimeout = 30000;
  }

  /**
   * Build NETCONF hello message
   */
  buildHello() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<hello xmlns="${NETCONF_BASE_1_0}">
  <capabilities>
    <capability>${NETCONF_BASE_1_0}</capability>
    <capability>${NETCONF_BASE_1_1}</capability>
  </capabilities>
</hello>${MSG_DELIMITER}`;
  }

  /**
   * Build RPC message
   */
  buildRPC(messageId, operation) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<rpc message-id="${messageId}" xmlns="${NETCONF_BASE_1_0}">
${operation}
</rpc>${MSG_DELIMITER}`;
  }

  /**
   * Build get-config RPC
   */
  buildGetConfig(source = 'running', filter = null) {
    let operation = `  <get-config>
    <source>
      <${source}/>
    </source>`;
    
    if (filter) {
      operation += `
    <filter type="subtree">
      ${filter}
    </filter>`;
    }
    
    operation += `
  </get-config>`;
    
    return operation;
  }

  /**
   * Build edit-config RPC
   */
  buildEditConfig(target = 'running', config, defaultOperation = 'merge') {
    return `  <edit-config>
    <target>
      <${target}/>
    </target>
    <default-operation>${defaultOperation}</default-operation>
    <config>
      ${config}
    </config>
  </edit-config>`;
  }

  /**
   * Build close-session RPC
   */
  buildCloseSession() {
    return '  <close-session/>';
  }

  /**
   * Create NETCONF session
   */
  connect(device) {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      
      const config = {
        host: device.ip,
        port: device.netconfPort || this.defaultPort,
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
            'diffie-hellman-group14-sha1'
          ]
        }
      };
      
      conn.on('ready', () => {
        // Start NETCONF subsystem
        conn.subsys('netconf', (err, stream) => {
          if (err) {
            conn.end();
            reject(err);
            return;
          }
          
          resolve({ conn, stream });
        });
      });
      
      conn.on('error', (err) => {
        reject(err);
      });
      
      conn.connect(config);
    });
  }

  /**
   * Send message and wait for response
   */
  sendMessage(stream, message) {
    return new Promise((resolve, reject) => {
      let response = '';
      let resolved = false;
      
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reject(new Error('NETCONF response timeout'));
        }
      }, this.defaultTimeout);
      
      const onData = (data) => {
        response += data.toString();
        
        // Check for message delimiter
        if (response.includes(MSG_DELIMITER)) {
          clearTimeout(timeout);
          stream.removeListener('data', onData);
          
          if (!resolved) {
            resolved = true;
            // Remove delimiter from response
            resolve(response.replace(MSG_DELIMITER, '').trim());
          }
        }
      };
      
      stream.on('data', onData);
      stream.write(message);
    });
  }

  /**
   * Establish NETCONF session with hello exchange
   */
  async establishSession(device) {
    const { conn, stream } = await this.connect(device);
    
    // Wait for server hello
    let serverHello = '';
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Server hello timeout'));
      }, 10000);
      
      const onData = (data) => {
        serverHello += data.toString();
        if (serverHello.includes(MSG_DELIMITER)) {
          clearTimeout(timeout);
          stream.removeListener('data', onData);
          resolve();
        }
      };
      
      stream.on('data', onData);
    });
    
    // Parse server capabilities
    const capabilities = this.parseCapabilities(serverHello);
    
    // Send client hello
    stream.write(this.buildHello());
    
    return { conn, stream, capabilities };
  }

  /**
   * Parse capabilities from hello message
   */
  parseCapabilities(hello) {
    const caps = [];
    const regex = /<capability>([^<]+)<\/capability>/g;
    let match;
    
    while ((match = regex.exec(hello)) !== null) {
      caps.push(match[1]);
    }
    
    return {
      raw: caps,
      hasBase10: caps.some(c => c.includes('base:1.0')),
      hasBase11: caps.some(c => c.includes('base:1.1')),
      hasNxos: caps.some(c => c.includes('cisco-nx-os')),
      hasIosXe: caps.some(c => c.includes('Cisco-IOS-XE'))
    };
  }

  /**
   * Detect device type from capabilities
   */
  detectDeviceType(capabilities) {
    if (capabilities.hasNxos) return 'nxos';
    if (capabilities.hasIosXe) return 'ios-xe';
    return 'unknown';
  }

  /**
   * Test NETCONF connection
   */
  async testConnection(device) {
    try {
      const { conn, stream, capabilities } = await this.establishSession(device);
      
      // Send close-session
      await this.sendMessage(stream, this.buildRPC('1', this.buildCloseSession()));
      
      conn.end();
      
      const deviceType = this.detectDeviceType(capabilities);
      
      return {
        success: true,
        message: 'NETCONF connection successful',
        deviceType,
        capabilities: capabilities.raw.length
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Get device configuration via NETCONF
   */
  async get(device, filter = null) {
    const { conn, stream, capabilities } = await this.establishSession(device);
    
    try {
      const operation = this.buildGetConfig('running', filter);
      const response = await this.sendMessage(stream, this.buildRPC('1', operation));
      
      // Close session
      await this.sendMessage(stream, this.buildRPC('2', this.buildCloseSession()));
      
      conn.end();
      
      return {
        success: true,
        data: response,
        deviceType: this.detectDeviceType(capabilities)
      };
    } catch (error) {
      conn.end();
      throw error;
    }
  }

  /**
   * Edit device configuration via NETCONF
   */
  async editConfig(device, config, target = 'running') {
    const { conn, stream, capabilities } = await this.establishSession(device);
    
    try {
      const deviceType = this.detectDeviceType(capabilities);
      
      // Wrap config with appropriate namespace if not already wrapped
      let wrappedConfig = config;
      if (!config.includes('xmlns=')) {
        const ns = NAMESPACES[deviceType] || NAMESPACES['nxos'];
        const root = ROOT_ELEMENTS[deviceType] || ROOT_ELEMENTS['nxos'];
        wrappedConfig = `<${root} xmlns="${ns}">${config}</${root}>`;
      }
      
      const operation = this.buildEditConfig(target, wrappedConfig);
      const response = await this.sendMessage(stream, this.buildRPC('1', operation));
      
      // Check for error
      const hasError = response.includes('<rpc-error>');
      
      // Close session
      await this.sendMessage(stream, this.buildRPC('2', this.buildCloseSession()));
      
      conn.end();
      
      if (hasError) {
        // Extract error message
        const errorMatch = response.match(/<error-message[^>]*>([^<]+)<\/error-message>/);
        throw new Error(errorMatch ? errorMatch[1] : 'NETCONF edit-config failed');
      }
      
      return {
        success: true,
        message: 'Configuration applied successfully',
        response,
        deviceType
      };
    } catch (error) {
      conn.end();
      throw error;
    }
  }

  /**
   * Get device details (interfaces, VLANs, etc.)
   */
  async getDeviceDetails(device) {
    const { conn, stream, capabilities } = await this.establishSession(device);
    
    try {
      const deviceType = this.detectDeviceType(capabilities);
      const filter = this.buildDeviceFilter(deviceType);
      
      const operation = this.buildGetConfig('running', filter);
      const response = await this.sendMessage(stream, this.buildRPC('1', operation));
      
      // Close session
      await this.sendMessage(stream, this.buildRPC('2', this.buildCloseSession()));
      
      conn.end();
      
      return {
        success: true,
        data: response,
        deviceType,
        parsed: this.parseDeviceDetails(response, deviceType)
      };
    } catch (error) {
      conn.end();
      throw error;
    }
  }

  /**
   * Build filter for device details based on device type
   */
  buildDeviceFilter(deviceType) {
    if (deviceType === 'ios-xe') {
      return `<native xmlns="${NAMESPACES['ios-xe']}">
        <hostname/>
        <interface/>
        <vlan/>
        <router/>
      </native>`;
    }
    
    // Default to NX-OS
    return `<System xmlns="${NAMESPACES['nxos']}">
      <name/>
      <intf-items/>
      <bd-items/>
    </System>`;
  }

  /**
   * Parse device details from NETCONF response
   */
  parseDeviceDetails(response, deviceType) {
    const details = {
      hostname: null,
      interfaces: [],
      vlans: []
    };
    
    // Simple regex-based parsing (for production, use proper XML parser)
    const hostnameMatch = response.match(/<hostname>([^<]+)<\/hostname>|<name>([^<]+)<\/name>/);
    if (hostnameMatch) {
      details.hostname = hostnameMatch[1] || hostnameMatch[2];
    }
    
    return details;
  }
}

module.exports = { NetconfService };
