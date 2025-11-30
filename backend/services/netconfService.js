import { Client } from 'ssh2';

/**
 * NETCONF Service for Cisco NX-OS devices
 * Uses NETCONF over SSH (RFC 6241) for programmatic device configuration
 */
export class NetconfService {
  constructor() {
    this.connections = new Map();
    this.defaultPort = 830; // Standard NETCONF port
    this.sessionTimeout = 300000; // 5 minutes
    
    // NETCONF message constants
    this.NETCONF_HELLO = `<?xml version="1.0" encoding="UTF-8"?>
<hello xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
  <capabilities>
    <capability>urn:ietf:params:netconf:base:1.0</capability>
    <capability>urn:ietf:params:netconf:base:1.1</capability>
    <capability>urn:ietf:params:netconf:capability:writable-running:1.0</capability>
    <capability>urn:ietf:params:netconf:capability:candidate:1.0</capability>
    <capability>urn:ietf:params:netconf:capability:confirmed-commit:1.0</capability>
    <capability>urn:ietf:params:netconf:capability:validate:1.0</capability>
    <capability>urn:ietf:params:netconf:capability:startup:1.0</capability>
    <capability>urn:ietf:params:netconf:capability:url:1.0</capability>
  </capabilities>
</hello>]]>]]>`;

    this.MESSAGE_DELIMITER = ']]>]]>';
    
    // Cleanup expired connections
    setInterval(() => {
      this.cleanupExpiredConnections();
    }, 60000);
  }

  /**
   * Connect to device via NETCONF
   */
  async connect(deviceConfig) {
    const { id, _id, ip_address, username, password, netconf_port } = deviceConfig;
    const deviceId = id || _id;
    const port = netconf_port || this.defaultPort;
    
    // Clean up existing connection
    this.disconnect(deviceId);
    
    console.log(`🔌 NETCONF: Connecting to ${ip_address}:${port}...`);
    
    return new Promise((resolve, reject) => {
      const conn = new Client();
      
      const timeout = setTimeout(() => {
        conn.end();
        reject(new Error('NETCONF connection timeout'));
      }, 30000);
      
      conn.on('ready', () => {
        clearTimeout(timeout);
        console.log(`✅ NETCONF: SSH connected to ${ip_address}`);
        
        // Start NETCONF subsystem
        conn.subsys('netconf', (err, stream) => {
          if (err) {
            conn.end();
            reject(new Error(`NETCONF subsystem failed: ${err.message}`));
            return;
          }
          
          console.log(`✅ NETCONF: Subsystem started on ${ip_address}`);
          
          let serverHello = '';
          let helloReceived = false;
          
          stream.on('data', (data) => {
            serverHello += data.toString();
            
            if (serverHello.includes(this.MESSAGE_DELIMITER) && !helloReceived) {
              helloReceived = true;
              
              // Parse server capabilities
              const capabilities = this.parseCapabilities(serverHello);
              console.log(`📋 NETCONF: Server capabilities received (${capabilities.length} capabilities)`);
              
              // Send client hello
              stream.write(this.NETCONF_HELLO);
              
              // Store connection
              this.connections.set(deviceId, {
                connection: conn,
                stream: stream,
                capabilities: capabilities,
                createdAt: Date.now(),
                lastUsed: Date.now(),
                deviceIp: ip_address
              });
              
              resolve({
                success: true,
                deviceId: deviceId,
                capabilities: capabilities,
                message: 'NETCONF session established'
              });
            }
          });
          
          stream.on('error', (err) => {
            clearTimeout(timeout);
            console.error(`❌ NETCONF stream error: ${err.message}`);
            reject(new Error(`NETCONF stream error: ${err.message}`));
          });
          
          stream.on('close', () => {
            console.log(`🔌 NETCONF: Session closed for ${ip_address}`);
            this.connections.delete(deviceId);
          });
        });
      });
      
      conn.on('error', (err) => {
        clearTimeout(timeout);
        console.error(`❌ NETCONF connection error for ${ip_address}:`, err.message);
        reject(new Error(`NETCONF connection failed: ${err.message}`));
      });
      
      conn.on('close', () => {
        this.connections.delete(deviceId);
      });
      
      // Connect with NX-OS compatible algorithms
      conn.connect({
        host: ip_address,
        port: port,
        username: username,
        password: password,
        readyTimeout: 30000,
        authTimeout: 20000,
        tryKeyboard: true,
        algorithms: {
          kex: [
            'diffie-hellman-group14-sha256',
            'diffie-hellman-group14-sha1',
            'diffie-hellman-group-exchange-sha256',
            'ecdh-sha2-nistp256',
            'ecdh-sha2-nistp384'
          ],
          cipher: [
            'aes256-ctr',
            'aes192-ctr',
            'aes128-ctr',
            'aes256-cbc',
            'aes128-cbc'
          ],
          hmac: [
            'hmac-sha2-256',
            'hmac-sha2-512',
            'hmac-sha1'
          ],
          serverHostKey: [
            'ssh-rsa',
            'rsa-sha2-256',
            'rsa-sha2-512',
            'ecdsa-sha2-nistp256'
          ]
        }
      });
    });
  }

  /**
   * Parse server capabilities from hello message
   */
  parseCapabilities(helloMessage) {
    const capabilities = [];
    const capRegex = /<capability>([^<]+)<\/capability>/g;
    let match;
    
    while ((match = capRegex.exec(helloMessage)) !== null) {
      capabilities.push(match[1].trim());
    }
    
    return capabilities;
  }

  /**
   * Send NETCONF RPC and receive response
   */
  async sendRpc(deviceId, rpcContent, messageId = null) {
    const session = this.connections.get(deviceId);
    
    if (!session) {
      throw new Error('No active NETCONF session');
    }
    
    session.lastUsed = Date.now();
    const msgId = messageId || `msg-${Date.now()}`;
    
    // Wrap content in RPC envelope
    const rpcMessage = `<?xml version="1.0" encoding="UTF-8"?>
<rpc message-id="${msgId}" xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
${rpcContent}
</rpc>${this.MESSAGE_DELIMITER}`;
    
    console.log(`📤 NETCONF: Sending RPC (message-id: ${msgId})`);
    
    return new Promise((resolve, reject) => {
      let response = '';
      const timeout = setTimeout(() => {
        reject(new Error('NETCONF RPC timeout'));
      }, 60000);
      
      const dataHandler = (data) => {
        response += data.toString();
        
        if (response.includes(this.MESSAGE_DELIMITER)) {
          clearTimeout(timeout);
          session.stream.removeListener('data', dataHandler);
          
          // Parse response
          const cleanResponse = response.replace(this.MESSAGE_DELIMITER, '').trim();
          const isError = cleanResponse.includes('<rpc-error>');
          
          if (isError) {
            const errorMsg = this.parseRpcError(cleanResponse);
            console.error(`❌ NETCONF RPC error: ${errorMsg}`);
            reject(new Error(`NETCONF RPC error: ${errorMsg}`));
          } else {
            console.log(`✅ NETCONF: RPC response received`);
            resolve({
              success: true,
              messageId: msgId,
              response: cleanResponse
            });
          }
        }
      };
      
      session.stream.on('data', dataHandler);
      session.stream.write(rpcMessage);
    });
  }

  /**
   * Parse RPC error from response
   */
  parseRpcError(response) {
    const errorTagMatch = response.match(/<error-tag>([^<]+)<\/error-tag>/);
    const errorMsgMatch = response.match(/<error-message[^>]*>([^<]+)<\/error-message>/);
    const errorPathMatch = response.match(/<error-path>([^<]+)<\/error-path>/);
    
    let errorMsg = 'Unknown error';
    if (errorMsgMatch) {
      errorMsg = errorMsgMatch[1];
    } else if (errorTagMatch) {
      errorMsg = errorTagMatch[1];
    }
    
    if (errorPathMatch) {
      errorMsg += ` (path: ${errorPathMatch[1]})`;
    }
    
    return errorMsg;
  }

  /**
   * Get running configuration (NX-OS)
   */
  async getRunningConfig(deviceId, filter = null) {
    let filterXml = '';
    
    if (filter) {
      filterXml = `
  <filter type="subtree">
    ${filter}
  </filter>`;
    }
    
    const rpcContent = `  <get-config>
    <source>
      <running/>
    </source>${filterXml}
  </get-config>`;
    
    return await this.sendRpc(deviceId, rpcContent);
  }

  /**
   * Edit configuration (NX-OS NETCONF)
   */
  async editConfig(deviceId, configXml, target = 'running', defaultOperation = 'merge') {
    const rpcContent = `  <edit-config>
    <target>
      <${target}/>
    </target>
    <default-operation>${defaultOperation}</default-operation>
    <config>
${configXml}
    </config>
  </edit-config>`;
    
    console.log(`📝 NETCONF: Edit-config to ${target} (operation: ${defaultOperation})`);
    return await this.sendRpc(deviceId, rpcContent);
  }

  /**
   * Commit configuration (for candidate datastore)
   */
  async commit(deviceId) {
    const rpcContent = `  <commit/>`;
    console.log(`💾 NETCONF: Committing configuration...`);
    return await this.sendRpc(deviceId, rpcContent);
  }

  /**
   * Validate configuration
   */
  async validate(deviceId, configXml = null) {
    let rpcContent;
    
    if (configXml) {
      // Validate provided config content directly
      rpcContent = `  <validate>
    <source>
      <config>
${configXml}
      </config>
    </source>
  </validate>`;
      console.log(`🔍 NETCONF: Validating provided configuration...`);
    } else {
      // Validate candidate datastore (default behavior)
      rpcContent = `  <validate>
    <source>
      <candidate/>
    </source>
  </validate>`;
      console.log(`🔍 NETCONF: Validating candidate configuration...`);
    }
    
    try {
      const result = await this.sendRpc(deviceId, rpcContent);
      return {
        success: true,
        message: 'Configuration validation passed',
        response: result.response
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Configuration validation failed'
      };
    }
  }

  /**
   * Discard changes in candidate datastore
   */
  async discardChanges(deviceId) {
    const rpcContent = `  <discard-changes/>`;
    return await this.sendRpc(deviceId, rpcContent);
  }

  /**
   * Lock configuration datastore
   */
  async lock(deviceId, target = 'running') {
    const rpcContent = `  <lock>
    <target>
      <${target}/>
    </target>
  </lock>`;
    
    console.log(`🔒 NETCONF: Locking ${target} datastore...`);
    return await this.sendRpc(deviceId, rpcContent);
  }

  /**
   * Unlock configuration datastore
   */
  async unlock(deviceId, target = 'running') {
    const rpcContent = `  <unlock>
    <target>
      <${target}/>
    </target>
  </unlock>`;
    
    console.log(`🔓 NETCONF: Unlocking ${target} datastore...`);
    return await this.sendRpc(deviceId, rpcContent);
  }

  /**
   * Get device capabilities
   */
  async getCapabilities(deviceId) {
    const session = this.connections.get(deviceId);
    
    if (!session) {
      throw new Error('No active NETCONF session');
    }
    
    return {
      success: true,
      capabilities: session.capabilities,
      deviceIp: session.deviceIp
    };
  }

  /**
   * Apply YANG configuration to NX-OS device
   * This wraps the configuration in proper NX-OS YANG namespaces
   */
  async applyNxosConfig(deviceId, yangConfig, operation = 'merge') {
    console.log(`🚀 NETCONF: Applying NX-OS YANG configuration...`);
    
    try {
      // Lock the running config
      await this.lock(deviceId, 'running');
      
      try {
        // Apply configuration
        const result = await this.editConfig(deviceId, yangConfig, 'running', operation);
        
        // Unlock on success
        await this.unlock(deviceId, 'running');
        
        return {
          success: true,
          message: 'Configuration applied successfully via NETCONF',
          response: result.response
        };
        
      } catch (editError) {
        // Unlock on failure
        try {
          await this.unlock(deviceId, 'running');
        } catch (unlockError) {
          console.warn(`⚠️ NETCONF: Failed to unlock after error: ${unlockError.message}`);
        }
        throw editError;
      }
      
    } catch (error) {
      console.error(`❌ NETCONF: Configuration failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Close NETCONF session gracefully
   */
  async closeSession(deviceId) {
    const session = this.connections.get(deviceId);
    
    if (!session) {
      return { success: true, message: 'No active session' };
    }
    
    try {
      // Send close-session RPC
      const rpcContent = `  <close-session/>`;
      await this.sendRpc(deviceId, rpcContent);
      
      session.connection.end();
      this.connections.delete(deviceId);
      
      console.log(`👋 NETCONF: Session closed gracefully`);
      return { success: true, message: 'Session closed' };
      
    } catch (error) {
      // Force close
      if (session.connection) {
        session.connection.end();
      }
      this.connections.delete(deviceId);
      
      return { success: true, message: 'Session force closed' };
    }
  }

  /**
   * Disconnect device
   */
  disconnect(deviceId) {
    const session = this.connections.get(deviceId);
    
    if (session) {
      try {
        if (session.connection) {
          session.connection.end();
        }
      } catch (err) {
        // Ignore disconnect errors
      }
      this.connections.delete(deviceId);
      console.log(`🔌 NETCONF: Disconnected device ${deviceId}`);
    }
  }

  /**
   * Cleanup expired connections
   */
  cleanupExpiredConnections() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [deviceId, session] of this.connections) {
      if ((now - session.lastUsed) > this.sessionTimeout) {
        this.disconnect(deviceId);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 NETCONF: Cleaned up ${cleaned} expired sessions`);
    }
  }

  /**
   * Test NETCONF connectivity
   */
  async testConnection(deviceConfig) {
    try {
      const result = await this.connect(deviceConfig);
      
      if (result.success) {
        const deviceId = deviceConfig.id || deviceConfig._id;
        
        // Get running config to verify
        try {
          await this.getRunningConfig(deviceId, '<System xmlns="http://cisco.com/ns/yang/cisco-nx-os-device"/>');
        } catch (getError) {
          console.warn(`⚠️ NETCONF: Config retrieval test failed: ${getError.message}`);
        }
        
        // Close session
        await this.closeSession(deviceId);
        
        return {
          success: true,
          message: 'NETCONF connection successful',
          capabilities: result.capabilities?.length || 0,
          supportsNxos: result.capabilities?.some(c => c.includes('cisco-nx-os')) || false
        };
      }
      
      return {
        success: false,
        message: result.message || 'Connection failed'
      };
      
    } catch (error) {
      return {
        success: false,
        message: `NETCONF connection failed: ${error.message}`,
        troubleshooting: [
          'Ensure NETCONF is enabled on the device (feature netconf)',
          'Verify port 830 is open and accessible',
          'Check username has netconf access privileges',
          'Verify NX-OS version supports NETCONF (7.0+)'
        ]
      };
    }
  }

  /**
   * Get session status
   */
  getSessionStatus(deviceId) {
    const session = this.connections.get(deviceId);
    
    if (!session) {
      return {
        isConnected: false,
        connected: false,
        message: 'No active NETCONF session'
      };
    }
    
    return {
      isConnected: true,
      connected: true,
      deviceIp: session.deviceIp,
      createdAt: session.createdAt,
      lastUsed: session.lastUsed,
      capabilities: session.capabilities?.length || 0,
      sessionAge: Date.now() - session.createdAt
    };
  }

  /**
   * Get all active sessions
   */
  getActiveSessions() {
    const sessions = [];
    
    for (const [deviceId, session] of this.connections) {
      sessions.push({
        deviceId: deviceId,
        deviceIp: session.deviceIp,
        createdAt: session.createdAt,
        lastUsed: session.lastUsed,
        capabilities: session.capabilities?.length || 0
      });
    }
    
    return sessions;
  }
}

// Create singleton instance
const netconfService = new NetconfService();
export default netconfService;
