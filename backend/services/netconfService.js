import { Client } from 'ssh2';
import xml2js from 'xml2js';
import xpath from 'xpath';

class NetconfService {
  constructor() {
    this.sessions = new Map(); // Store active NETCONF sessions
    this.builder = new xml2js.Builder({ rootName: 'rpc' });
    this.parser = new xml2js.Parser({ explicitArray: false });
  }

  // Connect to device via NETCONF
  async connect(deviceConfig) {
    const { ip_address, username, password, netconf_port = 830 } = deviceConfig;
    const sessionId = `${ip_address}:${netconf_port}`;

    try {
      const conn = new Client();
      
      return new Promise((resolve, reject) => {
        conn.on('ready', () => {
          console.log(`✅ SSH connection ready for ${ip_address}`);
          
          // Start NETCONF subsystem
          conn.subsys('netconf', (err, stream) => {
            if (err) {
              reject(new Error(`NETCONF subsystem error: ${err.message}`));
              return;
            }

            console.log(`🔗 NETCONF session started for ${ip_address}`);
            
            // Send NETCONF hello
            const hello = this.buildHello();
            stream.write(hello);
            
            let buffer = '';
            let messageId = 1;
            
            const session = {
              conn,
              stream,
              ip_address,
              isConnected: true,
              capabilities: [],
              messageId: () => messageId++
            };

            // Handle incoming data
            stream.on('data', (data) => {
              buffer += data.toString();
              
              // Check for complete messages (ending with ]]>]]>)
              const messages = buffer.split(']]>]]>');
              buffer = messages.pop(); // Keep incomplete message in buffer
              
              messages.forEach(message => {
                if (message.trim()) {
                  this.handleNetconfMessage(message + ']]>]]>', session);
                }
              });
            });

            stream.on('close', () => {
              console.log(`❌ NETCONF session closed for ${ip_address}`);
              session.isConnected = false;
              this.sessions.delete(sessionId);
            });

            stream.on('error', (err) => {
              console.error(`❌ NETCONF stream error for ${ip_address}:`, err);
              session.isConnected = false;
              reject(err);
            });

            this.sessions.set(sessionId, session);
            
            // Wait for hello response before resolving
            setTimeout(() => {
              if (session.capabilities.length > 0) {
                resolve({
                  success: true,
                  sessionId,
                  capabilities: session.capabilities,
                  message: `NETCONF session established with ${ip_address}`
                });
              } else {
                resolve({
                  success: true,
                  sessionId,
                  message: `NETCONF connection established with ${ip_address}`,
                  note: 'Capabilities exchange in progress'
                });
              }
            }, 2000);
          });
        });

        conn.on('error', (err) => {
          console.error(`❌ SSH connection error for ${ip_address}:`, err);
          reject(new Error(`SSH connection failed: ${err.message}`));
        });

        // Connect with SSH - Support older Cisco devices
        conn.connect({
          host: ip_address,
          port: 22, // SSH port for NETCONF
          username,
          password,
          readyTimeout: 30000,
          algorithms: {
            kex: [
              'diffie-hellman-group14-sha256',
              'diffie-hellman-group14-sha1',
              'diffie-hellman-group1-sha1',
              'diffie-hellman-group-exchange-sha256',
              'diffie-hellman-group-exchange-sha1'
            ],
            cipher: [
              'aes128-ctr',
              'aes192-ctr', 
              'aes256-ctr',
              'aes128-cbc',
              'aes192-cbc',
              'aes256-cbc',
              '3des-cbc'
            ],
            hmac: [
              'hmac-sha2-256',
              'hmac-sha2-512',
              'hmac-sha1',
              'hmac-sha1-96'
            ]
          }
        });
      });

    } catch (error) {
      console.error(`❌ NETCONF connection error for ${ip_address}:`, error);
      throw new Error(`NETCONF connection failed: ${error.message}`);
    }
  }

  // Disconnect NETCONF session
  async disconnect(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('NETCONF session not found');
    }

    try {
      // Send close-session RPC
      const closeRpc = this.buildRpc('close-session', {}, session.messageId());
      session.stream.write(closeRpc);
      
      // Close connections
      session.stream.end();
      session.conn.end();
      session.isConnected = false;
      
      this.sessions.delete(sessionId);
      
      return {
        success: true,
        message: `NETCONF session ${sessionId} disconnected`
      };
    } catch (error) {
      console.error(`❌ Error disconnecting NETCONF session ${sessionId}:`, error);
      throw error;
    }
  }

  // Get device configuration
  async getConfig(sessionId, datastore = 'running', filter = null) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isConnected) {
      throw new Error('NETCONF session not available');
    }

    const rpcContent = {
      source: { [datastore]: null }
    };

    if (filter) {
      rpcContent.filter = filter;
    }

    return this.sendRpc(session, 'get-config', rpcContent);
  }

  // Get operational data
  async get(sessionId, filter = null) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isConnected) {
      throw new Error('NETCONF session not available');
    }

    const rpcContent = filter ? { filter } : {};
    return this.sendRpc(session, 'get', rpcContent);
  }

  // Edit configuration
  async editConfig(sessionId, datastore = 'running', config, defaultOperation = 'merge') {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isConnected) {
      throw new Error('NETCONF session not available');
    }

    const rpcContent = {
      target: { [datastore]: null },
      'default-operation': defaultOperation,
      config
    };

    return this.sendRpc(session, 'edit-config', rpcContent);
  }

  // Commit configuration (for candidate datastore)
  async commit(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isConnected) {
      throw new Error('NETCONF session not available');
    }

    return this.sendRpc(session, 'commit', {});
  }

  // Discard changes (for candidate datastore)
  async discardChanges(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isConnected) {
      throw new Error('NETCONF session not available');
    }

    return this.sendRpc(session, 'discard-changes', {});
  }

  // Lock datastore
  async lock(sessionId, datastore = 'running') {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isConnected) {
      throw new Error('NETCONF session not available');
    }

    const rpcContent = {
      target: { [datastore]: null }
    };

    return this.sendRpc(session, 'lock', rpcContent);
  }

  // Unlock datastore
  async unlock(sessionId, datastore = 'running') {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isConnected) {
      throw new Error('NETCONF session not available');
    }

    const rpcContent = {
      target: { [datastore]: null }
    };

    return this.sendRpc(session, 'unlock', rpcContent);
  }

  // Validate configuration
  async validate(sessionId, datastore = 'candidate') {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isConnected) {
      throw new Error('NETCONF session not available');
    }

    const rpcContent = {
      source: { [datastore]: null }
    };

    return this.sendRpc(session, 'validate', rpcContent);
  }

  // Validate XML configuration
  async validateXmlConfig(sessionId, xmlConfig) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isConnected) {
      throw new Error('NETCONF session not available');
    }

    return new Promise((resolve, reject) => {
      this.parser.parseString(xmlConfig, (err, result) => {
        if (err) {
          resolve({
            valid: false,
            validation_result: {
              structure: 'invalid',
              error: err.message
            },
            warnings: [],
            errors: [err.message]
          });
          return;
        }

        // Basic validation - check if it's a valid NETCONF structure
        const warnings = [];
        const errors = [];
        
        // Check for common NETCONF elements
        if (!result.config && !result['rpc-reply'] && !result.rpc) {
          warnings.push('XML does not appear to be a standard NETCONF configuration');
        }
        
        resolve({
          valid: errors.length === 0,
          validation_result: {
            structure: 'valid',
            parsed: result
          },
          warnings,
          errors
        });
      });
    });
  }

  // Deploy XML configuration
  async deployXmlConfig(sessionId, xmlConfig, options = {}) {
    const { datastore = 'running', validate = true, commit = true } = options;
    
    const session = this.sessions.get(sessionId);
    if (!session || !session.isConnected) {
      throw new Error('NETCONF session not available');
    }

    try {
      // Parse the XML config
      const parsedConfig = await new Promise((resolve, reject) => {
        this.parser.parseString(xmlConfig, (err, result) => {
          if (err) {
            reject(new Error(`XML parsing failed: ${err.message}`));
          } else {
            resolve(result);
          }
        });
      });
      
      // If validation is requested, validate first
      if (validate) {
        const validationResult = await this.validateXmlConfig(sessionId, xmlConfig);
        if (!validationResult.valid) {
          throw new Error(`Configuration validation failed: ${validationResult.errors.join(', ')}`);
        }
      }
      
      // Deploy the configuration using edit-config
      const editResult = await this.editConfig(sessionId, datastore, parsedConfig, 'merge');
      
      // If commit is requested and we're using candidate datastore
      if (commit && datastore === 'candidate') {
        const commitResult = await this.commit(sessionId);
        return {
          edit_result: editResult,
          commit_result: commitResult,
          deployed: true,
          committed: true
        };
      }
      
      return {
        edit_result: editResult,
        deployed: true,
        committed: datastore === 'running' // running datastore is automatically committed
      };
      
    } catch (error) {
      console.error(`❌ Error deploying XML config:`, error);
      throw new Error(`Configuration deployment failed: ${error.message}`);
    }
  }

  // Get active sessions
  getActiveSessions() {
    const sessions = [];
    for (const [sessionId, session] of this.sessions) {
      sessions.push({
        sessionId,
        ip_address: session.ip_address,
        isConnected: session.isConnected,
        capabilities: session.capabilities,
        connectedAt: session.connectedAt
      });
    }
    return sessions;
  }

  // Build NETCONF hello message
  buildHello() {
    const hello = `<?xml version="1.0" encoding="UTF-8"?>
<hello xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
  <capabilities>
    <capability>urn:ietf:params:netconf:base:1.0</capability>
    <capability>urn:ietf:params:netconf:base:1.1</capability>
    <capability>urn:ietf:params:netconf:capability:startup:1.0</capability>
    <capability>urn:ietf:params:netconf:capability:candidate:1.0</capability>
    <capability>urn:ietf:params:netconf:capability:validate:1.0</capability>
  </capabilities>
</hello>]]>]]>`;
    
    return hello;
  }

  // Build NETCONF RPC message
  buildRpc(operation, content, messageId) {
    const rpc = {
      $: {
        'message-id': messageId,
        'xmlns': 'urn:ietf:params:xml:ns:netconf:base:1.0'
      },
      [operation]: content
    };

    let xml = this.builder.buildObject({ rpc });
    // Fix XML declaration
    xml = xml.replace('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>', 
                     '<?xml version="1.0" encoding="UTF-8"?>');
    return xml + ']]>]]>';
  }

  // Send RPC and wait for response
  async sendRpc(session, operation, content) {
    return new Promise((resolve, reject) => {
      const messageId = session.messageId();
      const rpc = this.buildRpc(operation, content, messageId);
      
      console.log(`📤 Sending NETCONF RPC: ${operation} (message-id: ${messageId})`);
      
      // Set up response handler
      const timeout = setTimeout(() => {
        reject(new Error(`NETCONF RPC timeout for ${operation}`));
      }, 30000);

      const responseHandler = (data) => {
        try {
          if (data.includes(`message-id="${messageId}"`)) {
            clearTimeout(timeout);
            this.parser.parseString(data.replace(']]>]]>', ''), (err, result) => {
              if (err) {
                reject(new Error(`XML parsing error: ${err.message}`));
                return;
              }
              resolve({
                success: true,
                operation,
                messageId,
                data: result
              });
            });
          }
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      };

      // Temporary response handler
      session.stream.once('data', responseHandler);
      
      // Send RPC
      session.stream.write(rpc);
    });
  }

  // Handle incoming NETCONF messages
  handleNetconfMessage(message, session) {
    try {
      if (message.includes('<hello')) {
        // Handle hello response
        this.parser.parseString(message.replace(']]>]]>', ''), (err, result) => {
          if (!err && result.hello && result.hello.capabilities) {
            session.capabilities = Array.isArray(result.hello.capabilities.capability) 
              ? result.hello.capabilities.capability 
              : [result.hello.capabilities.capability];
            console.log(`📋 Received capabilities for ${session.ip_address}:`, session.capabilities.length);
          }
        });
      }
    } catch (error) {
      console.error(`❌ Error handling NETCONF message:`, error);
    }
  }

  // Cleanup all sessions
  async cleanup() {
    const sessionIds = Array.from(this.sessions.keys());
    const promises = sessionIds.map(sessionId => {
      try {
        return this.disconnect(sessionId);
      } catch (error) {
        console.error(`Error disconnecting session ${sessionId}:`, error);
        return Promise.resolve();
      }
    });
    
    await Promise.allSettled(promises);
    console.log(`🧹 Cleaned up ${sessionIds.length} NETCONF sessions`);
  }
}

export default new NetconfService(); 