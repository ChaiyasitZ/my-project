import { Client } from 'ssh2';
import xml2js from 'xml2js';
import xpath from 'xpath';

class NetconfService {
  constructor() {
    this.sessions = new Map(); // Store active NETCONF sessions
    this.builder = new xml2js.Builder({ rootName: 'rpc' });
    this.parser = new xml2js.Parser({ explicitArray: false });
    this.debugMode = true; // Enable detailed debugging
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

            // Connection timeout for hello exchange
            const connectionTimeout = setTimeout(() => {
              console.error(`❌ NETCONF hello timeout for ${ip_address}`);
              reject(new Error('NETCONF hello exchange timeout'));
            }, 30000);

            // Handle incoming data
            stream.on('data', (data) => {
              const chunk = data.toString();
              buffer += chunk;
              console.log(`📥 Setup data: ${chunk.length} bytes - ${chunk.substring(0, 100)}${chunk.length > 100 ? '...' : ''}`);
              
              // Check for complete messages (ending with ]]>]]>)
              const messages = buffer.split(']]>]]>');
              buffer = messages.pop(); // Keep incomplete message in buffer
              
              messages.forEach(message => {
                if (message.trim()) {
                  console.log(`🔄 Processing setup message: ${message.substring(0, 200)}...`);
                  this.handleNetconfMessage(message + ']]>]]>', session);
                  
                  // If this was a hello response, resolve the connection
                  if (message.includes('</hello>') && session.capabilities && session.capabilities.length > 0) {
                    clearTimeout(connectionTimeout);
                    this.sessions.set(sessionId, session);
                    session.connected_at = new Date();
                    console.log(`✅ NETCONF session established for ${ip_address} with ${session.capabilities.length} capabilities`);
                    resolve(session);
                  }
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

  // Test NETCONF connection
  async testConnection(deviceConfig) {
    try {
      console.log(`🧪 Testing NETCONF connection to ${deviceConfig.ip_address}:${deviceConfig.netconf_port || 830}`);
      
      const session = await this.connect(deviceConfig);
      console.log(`✅ NETCONF session established, testing basic operations...`);
      
      // Try a simple get-config operation with timeout
      const testPromise = this.sendRpc(session, 'get-config', {
        source: { running: {} }
      });
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Connection test timeout')), 30000);
      });
      
      const result = await Promise.race([testPromise, timeoutPromise]);
      console.log(`✅ NETCONF test operation successful`);
      
      // Close the test connection
      this.disconnect(session.sessionId);
      
      return {
        success: true,
        message: 'NETCONF connection and basic operations successful',
        capabilities: session.capabilities,
        connectionTime: new Date().toISOString()
      };
    } catch (error) {
      console.error(`❌ NETCONF connection test failed: ${error.message}`);
      return {
        success: false,
        message: `NETCONF connection test failed: ${error.message}`,
        error: error.message
      };
    }
  }

  // Check if session is healthy
  isSessionHealthy(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }
    
    return session.isConnected && 
           session.stream && 
           !session.stream.destroyed && 
           session.conn && 
           session.conn._sock && 
           session.conn._sock.readable;
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
      // Check if session is still connected
      if (!session.isConnected) {
        reject(new Error('NETCONF session is not connected'));
        return;
      }

      const messageId = session.messageId();
      const rpc = this.buildRpc(operation, content, messageId);
      
      console.log(`📤 Sending NETCONF RPC: ${operation} (message-id: ${messageId})`);
      console.log(`🔍 RPC Content: ${rpc.substring(0, 200)}...`);
      
      // Increase timeout for slower devices and add connection check
      const timeout = setTimeout(() => {
        console.log(`⏰ NETCONF RPC timeout for ${operation} on ${session.ip_address}`);
        reject(new Error(`NETCONF RPC timeout for ${operation} after 60 seconds`));
      }, 60000); // Increased to 60 seconds

      let responseBuffer = '';

      const responseHandler = (data) => {
        try {
          const chunk = data.toString();
          responseBuffer += chunk;
          console.log(`📥 Received NETCONF data chunk: ${chunk.length} bytes`);
          console.log(`🔍 Chunk content: ${chunk.substring(0, 200)}${chunk.length > 200 ? '...' : ''}`);
          console.log(`📊 Total buffer size: ${responseBuffer.length} bytes`);
          
          // Check if we have a complete response (ends with ]]>]]>)
          if (responseBuffer.includes(']]>]]>')) {
            console.log(`✅ Found complete NETCONF response with ]]>]]> terminator`);
            
            // Extract the message for this specific messageId (try both formats)
            const messageIdPatterns = [
              `message-id="${messageId}"`,
              `message-id='${messageId}'`,
              `message-id=${messageId}`
            ];
            
            let foundMessageId = false;
            for (const pattern of messageIdPatterns) {
              if (responseBuffer.includes(pattern)) {
                foundMessageId = true;
                console.log(`✅ Found matching message ID with pattern: ${pattern}`);
                break;
              }
            }
            
            if (foundMessageId) {
              clearTimeout(timeout);
              session.stream.removeListener('data', responseHandler);
              
              // Clean up the response - extract everything before ]]>]]>
              const terminatorIndex = responseBuffer.indexOf(']]>]]>');
              const cleanResponse = responseBuffer.substring(0, terminatorIndex);
              
              console.log(`🧹 Cleaned response: ${cleanResponse.substring(0, 300)}${cleanResponse.length > 300 ? '...' : ''}`);
              
              this.parser.parseString(cleanResponse, (err, result) => {
                if (err) {
                  console.error(`❌ XML parsing error: ${err.message}`);
                  console.error(`❌ Failed XML content: ${cleanResponse.substring(0, 500)}`);
                  reject(new Error(`XML parsing error: ${err.message}`));
                  return;
                }
                
                // Check for NETCONF errors
                if (result.rpc && result.rpc['rpc-error']) {
                  const error = result.rpc['rpc-error'];
                  const errorMsg = error['error-message'] || 'Unknown NETCONF error';
                  console.error(`❌ NETCONF RPC error: ${errorMsg}`);
                  reject(new Error(`NETCONF RPC error: ${errorMsg}`));
                  return;
                }
                
                console.log(`✅ NETCONF RPC ${operation} completed successfully`);
                resolve({
                  success: true,
                  operation,
                  messageId,
                  data: result
                });
              });
            } else {
              console.log(`⚠️ Complete response found but no matching message ID for ${messageId}`);
              console.log(`🔍 Response preview: ${responseBuffer.substring(0, 500)}`);
            }
          } else {
            // Log buffer content for debugging when we get stuck
            if (this.debugMode && responseBuffer.length >= 300) {
              console.log(`🔍 DEBUG: Current buffer content (${responseBuffer.length} bytes):`);
              console.log(`📄 Raw buffer: ${JSON.stringify(responseBuffer.substring(0, 800))}`);
              console.log(`🔍 Looking for patterns:`);
              console.log(`   - Contains ]]>]]>: ${responseBuffer.includes(']]>]]>')}`);
              console.log(`   - Contains </rpc-reply>: ${responseBuffer.includes('</rpc-reply>')}`);
              console.log(`   - Contains <rpc-error>: ${responseBuffer.includes('<rpc-error>')}`);
              console.log(`   - Message ID ${messageId}: ${responseBuffer.includes(`message-id="${messageId}"`)}`);
            }
            
            // Check if this might be an error response or incomplete
            if (responseBuffer.includes('<rpc-error>') || responseBuffer.includes('</rpc-reply>')) {
              console.log(`⚠️ Potential complete response without ]]>]]> terminator detected`);
              console.log(`🔍 Response content: ${responseBuffer.substring(0, 500)}`);
              
              // Try to parse anyway if we have a complete rpc-reply
              if (responseBuffer.includes('</rpc-reply>')) {
                console.log(`🔄 Attempting to parse response without ]]>]]> terminator`);
                
            clearTimeout(timeout);
                session.stream.removeListener('data', responseHandler);
                
                this.parser.parseString(responseBuffer, (err, result) => {
              if (err) {
                    console.error(`❌ XML parsing error: ${err.message}`);
                reject(new Error(`XML parsing error: ${err.message}`));
                return;
              }
                  
                  // Check for NETCONF errors
                  if (result['rpc-reply'] && result['rpc-reply']['rpc-error']) {
                    const error = result['rpc-reply']['rpc-error'];
                    const errorMsg = error['error-message'] || 'Unknown NETCONF error';
                    console.error(`❌ NETCONF RPC error: ${errorMsg}`);
                    reject(new Error(`NETCONF RPC error: ${errorMsg}`));
                    return;
                  }
                  
                  console.log(`✅ NETCONF RPC ${operation} completed successfully (no terminator)`);
              resolve({
                success: true,
                operation,
                messageId,
                data: result
              });
            });
              }
            }
          }
        } catch (error) {
          clearTimeout(timeout);
          session.stream.removeListener('data', responseHandler);
          console.error(`❌ Error processing NETCONF response: ${error.message}`);
          reject(error);
        }
      };

      // Add response handler
      session.stream.on('data', responseHandler);
      
      // Handle stream errors
      const errorHandler = (error) => {
        clearTimeout(timeout);
        session.stream.removeListener('data', responseHandler);
        session.stream.removeListener('error', errorHandler);
        console.error(`❌ NETCONF stream error: ${error.message}`);
        reject(new Error(`NETCONF stream error: ${error.message}`));
      };
      
      session.stream.once('error', errorHandler);
      
      // Send RPC
      try {
      session.stream.write(rpc);
        console.log(`📤 RPC sent to ${session.ip_address}`);
      } catch (writeError) {
        clearTimeout(timeout);
        session.stream.removeListener('data', responseHandler);
        session.stream.removeListener('error', errorHandler);
        console.error(`❌ Error writing RPC: ${writeError.message}`);
        reject(new Error(`Error writing RPC: ${writeError.message}`));
      }
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