import { Client } from 'ssh2';

/**
 * NETCONF Service for Cisco NX-OS devices
 * Uses NETCONF over SSH (RFC 6241) for programmatic device configuration
 * Using NETCONF 1.0 (end-of-message delimiter) for compatibility
 */
export class NetconfService {
  constructor() {
    this.connections = new Map();
    this.defaultPort = 830; // Standard NETCONF port
    this.sessionTimeout = 300000; // 5 minutes
    
    // NETCONF message constants - Only advertise base:1.0 to use simple delimiter framing
    // If we advertise 1.1, server might switch to chunked framing which is more complex
    this.NETCONF_HELLO = `<?xml version="1.0" encoding="UTF-8"?>
<hello xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
  <capabilities>
    <capability>urn:ietf:params:netconf:base:1.0</capability>
    <capability>urn:ietf:params:netconf:capability:writable-running:1.0</capability>
    <capability>urn:ietf:params:netconf:capability:candidate:1.0</capability>
    <capability>urn:ietf:params:netconf:capability:confirmed-commit:1.0</capability>
    <capability>urn:ietf:params:netconf:capability:validate:1.0</capability>
  </capabilities>
</hello>]]>]]>`;

    this.MESSAGE_DELIMITER = ']]>]]>';
    
    // Cleanup expired connections (store interval ID for shutdown)
    this.cleanupInterval = setInterval(() => {
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
          
          const helloHandler = (data) => {
            serverHello += data.toString();
            console.log(`📥 NETCONF Hello: Received ${data.length} bytes`);
            
            if (serverHello.includes(this.MESSAGE_DELIMITER) && !helloReceived) {
              helloReceived = true;
              
              // IMPORTANT: Remove hello handler so it doesn't interfere with RPC handlers
              stream.removeListener('data', helloHandler);
              
              // Parse server capabilities
              const capabilities = this.parseCapabilities(serverHello);
              console.log(`📋 NETCONF: Server capabilities received (${capabilities.length} capabilities)`);
              
              // Check if server supports base:1.1 (chunked framing) - we'll avoid it
              const supports11 = capabilities.some(c => c.includes('base:1.1'));
              console.log(`� NETCONF: Server supports base:1.1: ${supports11 ? 'yes (we use 1.0)' : 'no'}`);
              
              // Send client hello
              stream.write(this.NETCONF_HELLO, 'utf8', (err) => {
                if (err) {
                  console.error(`❌ NETCONF: Failed to send hello: ${err.message}`);
                  reject(new Error(`Failed to send NETCONF hello: ${err.message}`));
                  return;
                }
                
                console.log(`📤 NETCONF: Client hello sent successfully`);
                
                // Small delay to let the session stabilize
                setTimeout(() => {
                  // Store connection
                  this.connections.set(deviceId, {
                    connection: conn,
                    stream: stream,
                    capabilities: capabilities,
                    createdAt: Date.now(),
                    lastUsed: Date.now(),
                    deviceIp: ip_address,
                    netconfVersion: '1.0' // We always use 1.0 for simplicity
                  });
                  
                  console.log(`✅ NETCONF: Session ready for ${ip_address}`);
                  
                  resolve({
                    success: true,
                    deviceId: deviceId,
                    capabilities: capabilities,
                    message: 'NETCONF session established'
                  });
                }, 500); // 500ms delay to let session stabilize
              });
            }
          };
          
          stream.on('data', helloHandler);
          
          // Handle stderr from NETCONF subsystem
          stream.stderr.on('data', (data) => {
            console.error(`⚠️ NETCONF stderr: ${data.toString()}`);
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
   * @param {string} deviceId - Device ID
   * @param {string} rpcContent - RPC content (without envelope)
   * @param {string} messageId - Optional message ID
   * @param {number} timeoutMs - Timeout in milliseconds (default 60s for operations, use higher for get operations)
   */
  async sendRpc(deviceId, rpcContent, messageId = null, timeoutMs = 60000) {
    const session = this.connections.get(deviceId);
    
    if (!session) {
      throw new Error('No active NETCONF session');
    }
    
    session.lastUsed = Date.now();
    const msgId = messageId || `msg-${Date.now()}`;
    
    // Detect operation type for logging
    const operationType = rpcContent.includes('<get-config') ? 'get-config' :
                          rpcContent.includes('<get>') ? 'get' :
                          rpcContent.includes('<edit-config') ? 'edit-config' :
                          rpcContent.includes('<lock') ? 'lock' :
                          rpcContent.includes('<unlock') ? 'unlock' :
                          rpcContent.includes('<commit') ? 'commit' :
                          rpcContent.includes('<validate') ? 'validate' :
                          rpcContent.includes('<close-session') ? 'close-session' :
                          'unknown';
    
    // Wrap content in RPC envelope
    const rpcMessage = `<?xml version="1.0" encoding="UTF-8"?>
<rpc message-id="${msgId}" xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
${rpcContent}
</rpc>${this.MESSAGE_DELIMITER}`;
    
    console.log(`📤 NETCONF: Sending ${operationType} RPC (message-id: ${msgId}, timeout: ${timeoutMs/1000}s)`);
    // Debug: Log RPC being sent (first 200 chars)
    console.log(`📤 NETCONF: RPC content preview: ${rpcMessage.substring(0, 200).replace(/\n/g, ' ')}...`);
    
    return new Promise((resolve, reject) => {
      let response = '';
      let dataSize = 0;
      const startTime = Date.now();
      
      // Check if stream is writable
      if (!session.stream.writable) {
        reject(new Error('NETCONF stream is not writable - session may be closed'));
        return;
      }
      
      const timeout = setTimeout(() => {
        session.stream.removeListener('data', dataHandler);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.error(`❌ NETCONF: ${operationType} timeout after ${elapsed}s (received ${dataSize} bytes)`);
        reject(new Error(`NETCONF ${operationType} timeout after ${elapsed}s - device not responding. Received ${dataSize} bytes before timeout.`));
      }, timeoutMs);
      
      const dataHandler = (data) => {
        const chunk = data.toString();
        response += chunk;
        dataSize += chunk.length;
        
        console.log(`📥 NETCONF: Received ${chunk.length} bytes (total: ${dataSize})`);
        
        // Log progress for large responses
        if (dataSize > 100000 && dataSize % 100000 < chunk.length) {
          console.log(`📦 NETCONF: Receiving data... ${Math.round(dataSize / 1024)}KB`);
        }
        
        if (response.includes(this.MESSAGE_DELIMITER)) {
          clearTimeout(timeout);
          session.stream.removeListener('data', dataHandler);
          
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
          console.log(`📦 NETCONF: ${operationType} response received (${Math.round(dataSize / 1024)}KB in ${elapsed}s)`);
          
          // Parse response
          const cleanResponse = response.replace(this.MESSAGE_DELIMITER, '').trim();
          const isError = cleanResponse.includes('<rpc-error>');
          
          if (isError) {
            const errorMsg = this.parseRpcError(cleanResponse);
            console.error(`❌ NETCONF ${operationType} error: ${errorMsg}`);
            reject(new Error(`NETCONF ${operationType} error: ${errorMsg}`));
          } else {
            console.log(`✅ NETCONF: ${operationType} completed successfully`);
            resolve({
              success: true,
              messageId: msgId,
              response: cleanResponse
            });
          }
        }
      };
      
      // IMPORTANT: Attach data handler BEFORE writing
      session.stream.on('data', dataHandler);
      
      // Write the RPC message and check for errors
      const writeSuccess = session.stream.write(rpcMessage, 'utf8', (err) => {
        if (err) {
          clearTimeout(timeout);
          session.stream.removeListener('data', dataHandler);
          console.error(`❌ NETCONF: Write error: ${err.message}`);
          reject(new Error(`NETCONF write failed: ${err.message}`));
        } else {
          console.log(`✅ NETCONF: RPC written to stream (${rpcMessage.length} bytes)`);
        }
      });
      
      if (!writeSuccess) {
        console.warn(`⚠️ NETCONF: Write returned false - stream buffer full, waiting for drain`);
      }
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
   * Get device details via NETCONF <get> operation
   * Retrieves system info, interfaces, VLANs, and other operational data
   * @param {string} deviceId - Device ID
   * @param {string} dataType - Type of data to retrieve: 'system', 'interfaces', 'vlans', 'routing', 'all'
   */
  async getDeviceDetails(deviceId, dataType = 'all') {
    console.log(`📊 NETCONF: Getting device details (type: ${dataType})...`);
    
    const session = this.connections.get(deviceId);
    if (!session) {
      throw new Error('No active NETCONF session');
    }
    
    // Build filter based on data type requested
    let filterXml = '';
    
    switch (dataType) {
      case 'system':
        filterXml = `<System xmlns="http://cisco.com/ns/yang/cisco-nx-os-device">
      <name/>
      <serial/>
      <version/>
      <model/>
      <uptime/>
      <fm-items/>
    </System>`;
        break;
        
      case 'interfaces':
        filterXml = `<System xmlns="http://cisco.com/ns/yang/cisco-nx-os-device">
      <intf-items>
        <phys-items/>
        <svi-items/>
        <aggr-items/>
        <lb-items/>
      </intf-items>
    </System>`;
        break;
        
      case 'vlans':
        filterXml = `<System xmlns="http://cisco.com/ns/yang/cisco-nx-os-device">
      <bd-items/>
    </System>`;
        break;
        
      case 'routing':
        filterXml = `<System xmlns="http://cisco.com/ns/yang/cisco-nx-os-device">
      <ospf-items/>
      <bgp-items/>
      <ipv4-items/>
    </System>`;
        break;
        
      case 'all':
      default:
        // Get comprehensive system info
        filterXml = `<System xmlns="http://cisco.com/ns/yang/cisco-nx-os-device">
      <name/>
      <serial/>
      <version/>
      <model/>
      <fm-items/>
      <intf-items/>
      <bd-items/>
    </System>`;
        break;
    }
    
    const rpcContent = `  <get>
    <filter type="subtree">
      ${filterXml}
    </filter>
  </get>`;
    
    try {
      // Use 120 second timeout for get operations
      const result = await this.sendRpc(deviceId, rpcContent, null, 120000);
      
      // Parse the response to extract useful data
      const parsedData = this.parseDeviceDetails(result.response, dataType);
      
      return {
        success: true,
        dataType: dataType,
        rawXml: result.response,
        data: parsedData,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error(`❌ NETCONF: Failed to get device details: ${error.message}`);
      throw error;
    }
  }

  /**
   * Parse device details from NETCONF get response
   */
  parseDeviceDetails(xmlResponse, dataType) {
    const data = {
      system: {},
      interfaces: [],
      vlans: [],
      features: []
    };
    
    try {
      // Extract system name
      const nameMatch = xmlResponse.match(/<name>([^<]+)<\/name>/);
      if (nameMatch) data.system.hostname = nameMatch[1];
      
      // Extract serial number
      const serialMatch = xmlResponse.match(/<serial>([^<]+)<\/serial>/);
      if (serialMatch) data.system.serial = serialMatch[1];
      
      // Extract version
      const versionMatch = xmlResponse.match(/<version>([^<]+)<\/version>/);
      if (versionMatch) data.system.version = versionMatch[1];
      
      // Extract model
      const modelMatch = xmlResponse.match(/<model>([^<]+)<\/model>/);
      if (modelMatch) data.system.model = modelMatch[1];
      
      // Extract features (FmEntity-list)
      const featureRegex = /<FmEntity-list>\s*<fmName>([^<]+)<\/fmName>\s*<adminSt>([^<]+)<\/adminSt>/g;
      let featureMatch;
      while ((featureMatch = featureRegex.exec(xmlResponse)) !== null) {
        data.features.push({
          name: featureMatch[1],
          adminState: featureMatch[2]
        });
      }
      
      // Extract physical interfaces (PhysIf-list)
      const physIfRegex = /<PhysIf-list>([\s\S]*?)<\/PhysIf-list>/g;
      let physIfMatch;
      while ((physIfMatch = physIfRegex.exec(xmlResponse)) !== null) {
        const ifData = physIfMatch[1];
        const intf = this.parseInterfaceBlock(ifData, 'physical');
        if (intf) data.interfaces.push(intf);
      }
      
      // Extract SVIs (SviIf-list)
      const sviRegex = /<SviIf-list>([\s\S]*?)<\/SviIf-list>/g;
      let sviMatch;
      while ((sviMatch = sviRegex.exec(xmlResponse)) !== null) {
        const ifData = sviMatch[1];
        const intf = this.parseInterfaceBlock(ifData, 'svi');
        if (intf) data.interfaces.push(intf);
      }
      
      // Extract Port-channels (AggrIf-list)
      const aggrRegex = /<AggrIf-list>([\s\S]*?)<\/AggrIf-list>/g;
      let aggrMatch;
      while ((aggrMatch = aggrRegex.exec(xmlResponse)) !== null) {
        const ifData = aggrMatch[1];
        const intf = this.parseInterfaceBlock(ifData, 'port-channel');
        if (intf) data.interfaces.push(intf);
      }
      
      // Extract Loopbacks (LbIf-list)
      const lbRegex = /<LbIf-list>([\s\S]*?)<\/LbIf-list>/g;
      let lbMatch;
      while ((lbMatch = lbRegex.exec(xmlResponse)) !== null) {
        const ifData = lbMatch[1];
        const intf = this.parseInterfaceBlock(ifData, 'loopback');
        if (intf) data.interfaces.push(intf);
      }
      
      // Extract VLANs (BD-list)
      const bdRegex = /<BD-list>([\s\S]*?)<\/BD-list>/g;
      let bdMatch;
      while ((bdMatch = bdRegex.exec(xmlResponse)) !== null) {
        const bdData = bdMatch[1];
        const vlan = this.parseVlanBlock(bdData);
        if (vlan) data.vlans.push(vlan);
      }
      
    } catch (parseError) {
      console.error(`⚠️ NETCONF: Error parsing device details: ${parseError.message}`);
    }
    
    return data;
  }
  
  /**
   * Parse interface block from XML
   */
  parseInterfaceBlock(xmlBlock, type) {
    const intf = { type: type };
    
    const idMatch = xmlBlock.match(/<id>([^<]+)<\/id>/);
    if (idMatch) intf.id = idMatch[1];
    
    const adminStMatch = xmlBlock.match(/<adminSt>([^<]+)<\/adminSt>/);
    if (adminStMatch) intf.adminState = adminStMatch[1];
    
    const operStMatch = xmlBlock.match(/<operSt>([^<]+)<\/operSt>/);
    if (operStMatch) intf.operState = operStMatch[1];
    
    const descrMatch = xmlBlock.match(/<descr>([^<]+)<\/descr>/);
    if (descrMatch) intf.description = descrMatch[1];
    
    const speedMatch = xmlBlock.match(/<speed>([^<]+)<\/speed>/);
    if (speedMatch) intf.speed = speedMatch[1];
    
    const mtuMatch = xmlBlock.match(/<mtu>([^<]+)<\/mtu>/);
    if (mtuMatch) intf.mtu = mtuMatch[1];
    
    const modeMatch = xmlBlock.match(/<mode>([^<]+)<\/mode>/);
    if (modeMatch) intf.mode = modeMatch[1];
    
    const layerMatch = xmlBlock.match(/<layer>([^<]+)<\/layer>/);
    if (layerMatch) intf.layer = layerMatch[1];
    
    return intf.id ? intf : null;
  }
  
  /**
   * Parse VLAN block from XML
   */
  parseVlanBlock(xmlBlock) {
    const vlan = {};
    
    const fabEncapMatch = xmlBlock.match(/<fabEncap>vlan-(\d+)<\/fabEncap>/);
    if (fabEncapMatch) vlan.id = parseInt(fabEncapMatch[1]);
    
    const nameMatch = xmlBlock.match(/<name>([^<]+)<\/name>/);
    if (nameMatch) vlan.name = nameMatch[1];
    
    const adminStMatch = xmlBlock.match(/<adminSt>([^<]+)<\/adminSt>/);
    if (adminStMatch) vlan.adminState = adminStMatch[1];
    
    const operStMatch = xmlBlock.match(/<operSt>([^<]+)<\/operSt>/);
    if (operStMatch) vlan.operState = operStMatch[1];
    
    const modeMatch = xmlBlock.match(/<mode>([^<]+)<\/mode>/);
    if (modeMatch) vlan.mode = modeMatch[1];
    
    return vlan.id ? vlan : null;
  }

  /**
   * Get specific configuration section via NETCONF
   * @param {string} deviceId - Device ID
   * @param {string} section - Section to retrieve: 'interfaces', 'vlans', 'ospf', 'bgp', 'acl'
   */
  async getConfigSection(deviceId, section) {
    console.log(`📋 NETCONF: Getting config section: ${section}`);
    
    const sectionFilters = {
      interfaces: `<System xmlns="http://cisco.com/ns/yang/cisco-nx-os-device"><intf-items/></System>`,
      vlans: `<System xmlns="http://cisco.com/ns/yang/cisco-nx-os-device"><bd-items/></System>`,
      ospf: `<System xmlns="http://cisco.com/ns/yang/cisco-nx-os-device"><ospf-items/></System>`,
      bgp: `<System xmlns="http://cisco.com/ns/yang/cisco-nx-os-device"><bgp-items/></System>`,
      ipv4: `<System xmlns="http://cisco.com/ns/yang/cisco-nx-os-device"><ipv4-items/></System>`,
      features: `<System xmlns="http://cisco.com/ns/yang/cisco-nx-os-device"><fm-items/></System>`
    };
    
    const filter = sectionFilters[section];
    if (!filter) {
      throw new Error(`Unknown config section: ${section}. Valid options: ${Object.keys(sectionFilters).join(', ')}`);
    }
    
    return await this.getRunningConfig(deviceId, filter);
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
    
    // Use longer timeout for get-config (180s) as it can return large responses
    return await this.sendRpc(deviceId, rpcContent, null, 180000);
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
    console.log(`📋 NETCONF: Config size: ${configXml.length} bytes`);
    
    // Log first 500 chars of config for debugging (if small enough)
    if (configXml.length <= 500) {
      console.log(`📋 NETCONF: Full config:\n${configXml}`);
    } else {
      console.log(`📋 NETCONF: Config preview (first 500 chars):\n${configXml.substring(0, 500)}...`);
    }
    
    // Use 90 second timeout for edit-config operations
    return await this.sendRpc(deviceId, rpcContent, null, 90000);
  }

  /**
   * Add NETCONF validate workflow comment to XML configuration
   * This marks the config as requiring validation before applying
   * The actual <validate> RPC is sent separately during the apply workflow
   * @param {string} xmlConfig - The YANG/XML configuration
   * @param {boolean} validateEnabled - Whether validation is enabled
   * @returns {string} - Configuration with validate workflow comment if enabled
   */
  addValidateTag(xmlConfig, validateEnabled = false) {
    if (!validateEnabled) {
      return xmlConfig;
    }
    
    // Add workflow comment indicating validation will be performed
    const validateWorkflowComment = `<!-- NETCONF Workflow: lock → edit-config → validate → commit → unlock -->`;
    
    // Check if config already starts with XML declaration
    if (xmlConfig.trim().startsWith('<?xml')) {
      // Insert after XML declaration
      const xmlDeclEnd = xmlConfig.indexOf('?>') + 2;
      return xmlConfig.slice(0, xmlDeclEnd) + '\n' + validateWorkflowComment + xmlConfig.slice(xmlDeclEnd);
    } else {
      // Add at the beginning
      return validateWorkflowComment + '\n' + xmlConfig;
    }
  }

  /**
   * Generate full NETCONF RPC workflow XML for display purposes
   * Shows the complete sequence of RPC operations that will be executed
   * @param {string} configXml - The configuration XML content
   * @param {boolean} includeValidate - Whether to include validate step
   * @returns {string} - Full NETCONF workflow XML
   */
  generateWorkflowXml(configXml, includeValidate = false) {
    // Clean any XML declaration from config for embedding
    const cleanConfig = configXml.replace(/<\?xml[^?]*\?>\s*/g, '').trim();
    
    // Indent the config for proper nesting
    const indentedConfig = cleanConfig.split('\n').map(line => '      ' + line).join('\n');
    
    let workflow = `<?xml version="1.0" encoding="UTF-8"?>
<!-- NETCONF Workflow${includeValidate ? ' with Validation' : ''} (RFC 6241) -->

<!-- Step 1: Lock candidate datastore -->
<rpc message-id="1" xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
  <lock>
    <target><candidate/></target>
  </lock>
</rpc>

<!-- Step 2: Edit candidate configuration -->
<rpc message-id="2" xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
  <edit-config>
    <target><candidate/></target>
    <default-operation>merge</default-operation>
    <config>
${indentedConfig}
    </config>
  </edit-config>
</rpc>
`;

    if (includeValidate) {
      workflow += `
<!-- Step 3: Validate candidate configuration -->
<rpc message-id="3" xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
  <validate>
    <source><candidate/></source>
  </validate>
</rpc>

<!-- Step 4: Commit validated configuration -->
<rpc message-id="4" xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
  <commit/>
</rpc>

<!-- Step 5: Unlock candidate datastore -->
<rpc message-id="5" xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
  <unlock>
    <target><candidate/></target>
  </unlock>
</rpc>`;
    } else {
      workflow += `
<!-- Step 3: Commit configuration -->
<rpc message-id="3" xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
  <commit/>
</rpc>

<!-- Step 4: Unlock candidate datastore -->
<rpc message-id="4" xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
  <unlock>
    <target><candidate/></target>
  </unlock>
</rpc>`;
    }
    
    return workflow;
  }

  /**
   * Commit configuration (for candidate datastore)
   */
  async commit(deviceId) {
    const rpcContent = `  <commit/>`;
    console.log(`💾 NETCONF: Committing configuration...`);
    // Commit can take time for large configs - 120 second timeout
    return await this.sendRpc(deviceId, rpcContent, null, 120000);
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
    console.log(`🗑️ NETCONF: Discarding candidate changes...`);
    // Quick operation - 15 second timeout
    return await this.sendRpc(deviceId, rpcContent, null, 15000);
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
    // Lock should be quick - 30 second timeout
    return await this.sendRpc(deviceId, rpcContent, null, 30000);
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
    // Unlock should be quick - 30 second timeout
    return await this.sendRpc(deviceId, rpcContent, null, 30000);
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
   * Uses candidate datastore if available for safer configuration changes
   */
  async applyNxosConfig(deviceId, yangConfig, operation = 'merge') {
    console.log(`🚀 NETCONF: Applying NX-OS YANG configuration...`);
    
    // Check if device supports candidate datastore and writable-running
    const session = this.connections.get(deviceId);
    if (!session) {
      throw new Error('No active NETCONF session');
    }
    
    const supportCandidate = session.capabilities?.some(c => 
      c.includes('capability:candidate') || c.includes(':candidate:')
    );
    const supportWritableRunning = session.capabilities?.some(c => 
      c.includes('writable-running')
    );
    const supportRollbackOnError = session.capabilities?.some(c => 
      c.includes('rollback-on-error')
    );
    
    console.log(`📋 NETCONF: Device capabilities check:`);
    console.log(`   - Candidate datastore: ${supportCandidate ? 'yes' : 'no'}`);
    console.log(`   - Writable-running: ${supportWritableRunning ? 'yes' : 'no'}`);
    console.log(`   - Rollback-on-error: ${supportRollbackOnError ? 'yes' : 'no'}`);
    
    if (!supportCandidate && !supportWritableRunning) {
      throw new Error('Device does not support writable-running or candidate datastore. Cannot apply configuration.');
    }
    
    // First, verify the session is alive with a simple get operation
    try {
      console.log(`� NETCONF: Verifying session is alive...`);
      await this.sendRpc(deviceId, `  <get><filter type="subtree"><System xmlns="http://cisco.com/ns/yang/cisco-nx-os-device"><name/></System></filter></get>`, null, 15000);
      console.log(`✅ NETCONF: Session is alive`);
    } catch (pingError) {
      console.error(`❌ NETCONF: Session appears dead, reconnecting...`);
      throw new Error(`NETCONF session is not responding. Please disconnect and reconnect to the device. Error: ${pingError.message}`);
    }
    
    try {
      if (supportCandidate) {
        // Use candidate datastore workflow (safer)
        console.log(`� NETCONF: Using candidate datastore workflow...`);
        
        // Try to clean up any existing locks first (best effort)
        try {
          console.log(`🧹 NETCONF: Cleaning up any existing candidate state...`);
          await this.discardChanges(deviceId);
        } catch (discardErr) {
          // Ignore - might not have any changes to discard
          console.log(`   (No pending changes to discard)`);
        }
        
        try {
          await this.unlock(deviceId, 'candidate');
        } catch (unlockErr) {
          // Ignore - might not be locked
          console.log(`   (Candidate was not locked)`);
        }
        
        // Now lock candidate
        await this.lock(deviceId, 'candidate');
        
        try {
          // Edit candidate config
          console.log(`📝 NETCONF: Writing to candidate datastore...`);
          await this.editConfig(deviceId, yangConfig, 'candidate', operation);
          
          // Commit to running
          console.log(`💾 NETCONF: Committing candidate to running...`);
          const commitResult = await this.commit(deviceId);
          
          // Unlock candidate
          await this.unlock(deviceId, 'candidate');
          
          return {
            success: true,
            message: 'Configuration applied successfully via NETCONF (candidate commit)',
            response: commitResult.response
          };
          
        } catch (editError) {
          // Discard changes and unlock on failure
          try {
            console.log(`⚠️ NETCONF: Error occurred, discarding changes...`);
            await this.discardChanges(deviceId);
            await this.unlock(deviceId, 'candidate');
          } catch (cleanupError) {
            console.warn(`⚠️ NETCONF: Failed to cleanup after error: ${cleanupError.message}`);
          }
          throw editError;
        }
        
      } else if (supportWritableRunning) {
        // Fall back to direct running config edit
        console.log(`🔒 NETCONF: Using direct running config workflow...`);
        
        // Lock the running config
        await this.lock(deviceId, 'running');
        
        try {
          // Apply configuration directly to running
          console.log(`📝 NETCONF: Editing running config directly...`);
          const result = await this.editConfig(deviceId, yangConfig, 'running', operation);
          
          // Unlock on success
          await this.unlock(deviceId, 'running');
          
          return {
            success: true,
            message: 'Configuration applied successfully via NETCONF (direct edit)',
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
      }
      
    } catch (error) {
      console.error(`❌ NETCONF: Configuration failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Apply YANG configuration to NX-OS device with optional validation
   * Implements RFC 6241 workflow: lock -> edit-config -> [validate] -> commit -> unlock
   * @param {string} deviceId - Device ID
   * @param {string} yangConfig - YANG XML configuration
   * @param {string} operation - edit-config operation (merge, replace, etc.)
   * @param {boolean} validateBeforeCommit - Whether to validate before committing
   */
  async applyNxosConfigWithValidation(deviceId, yangConfig, operation = 'merge', validateBeforeCommit = false) {
    console.log(`🚀 NETCONF: Applying NX-OS YANG configuration (validate: ${validateBeforeCommit})...`);
    
    const session = this.connections.get(deviceId);
    if (!session) {
      throw new Error('No active NETCONF session');
    }
    
    const supportCandidate = session.capabilities?.some(c => 
      c.includes('capability:candidate') || c.includes(':candidate:')
    );
    const supportValidate = session.capabilities?.some(c => 
      c.includes('capability:validate') || c.includes(':validate:')
    );
    
    console.log(`📋 NETCONF: Device capabilities - candidate: ${supportCandidate}, validate: ${supportValidate}`);
    
    if (!supportCandidate) {
      // Fall back to non-validation workflow
      console.log(`⚠️ NETCONF: Device does not support candidate datastore, using direct apply`);
      return await this.applyNxosConfig(deviceId, yangConfig, operation);
    }
    
    // First, verify the session is alive
    try {
      console.log(`🔍 NETCONF: Verifying session is alive...`);
      await this.sendRpc(deviceId, `  <get><filter type="subtree"><System xmlns="http://cisco.com/ns/yang/cisco-nx-os-device"><name/></System></filter></get>`, null, 15000);
      console.log(`✅ NETCONF: Session is alive`);
    } catch (pingError) {
      throw new Error(`NETCONF session not responding. Please reconnect. Error: ${pingError.message}`);
    }
    
    // Full candidate datastore workflow with optional validation
    console.log(`📝 NETCONF: Starting candidate datastore workflow...`);
    
    // Step 0: Clean up any existing state
    try {
      await this.discardChanges(deviceId);
    } catch (e) { /* ignore */ }
    
    try {
      await this.unlock(deviceId, 'candidate');
    } catch (e) { /* ignore */ }
    
    // Step 1: Lock candidate
    console.log(`🔒 NETCONF: Step 1 - Locking candidate datastore...`);
    await this.lock(deviceId, 'candidate');
    
    try {
      // Step 2: Edit candidate config
      console.log(`📝 NETCONF: Step 2 - Editing candidate configuration...`);
      await this.editConfig(deviceId, yangConfig, 'candidate', operation);
      
      // Step 3: Validate (optional)
      if (validateBeforeCommit && supportValidate) {
        console.log(`🔍 NETCONF: Step 3 - Validating candidate configuration...`);
        const validateResult = await this.validate(deviceId); // Validate candidate datastore
        
        if (!validateResult.success) {
          // Validation failed - discard and unlock
          console.log(`❌ NETCONF: Validation failed, discarding changes...`);
          await this.discardChanges(deviceId);
          await this.unlock(deviceId, 'candidate');
          throw new Error(`Validation failed: ${validateResult.error}`);
        }
        console.log(`✅ NETCONF: Validation passed`);
      } else if (validateBeforeCommit && !supportValidate) {
        console.log(`⚠️ NETCONF: Device does not support validate capability, skipping validation`);
      }
      
      // Step 4: Commit
      console.log(`💾 NETCONF: Step ${validateBeforeCommit ? '4' : '3'} - Committing configuration...`);
      const commitResult = await this.commit(deviceId);
      
      // Step 5: Unlock
      console.log(`🔓 NETCONF: Step ${validateBeforeCommit ? '5' : '4'} - Unlocking candidate datastore...`);
      await this.unlock(deviceId, 'candidate');
      
      console.log(`✅ NETCONF: Configuration applied successfully!`);
      
      return {
        success: true,
        message: `Configuration applied successfully via NETCONF${validateBeforeCommit ? ' (validated)' : ''}`,
        response: commitResult.response,
        validated: validateBeforeCommit && supportValidate
      };
      
    } catch (error) {
      // Cleanup on failure
      console.log(`⚠️ NETCONF: Error occurred, cleaning up...`);
      try {
        await this.discardChanges(deviceId);
        await this.unlock(deviceId, 'candidate');
      } catch (cleanupError) {
        console.warn(`⚠️ NETCONF: Cleanup failed: ${cleanupError.message}`);
      }
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
      // Send close-session RPC with short timeout
      const rpcContent = `  <close-session/>`;
      await this.sendRpc(deviceId, rpcContent, null, 10000); // 10 second timeout
      
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
   * Disconnect all NETCONF sessions
   */
  disconnectAll() {
    const sessionCount = this.connections.size;
    
    for (const [deviceId] of this.connections) {
      this.disconnect(deviceId);
    }
    
    console.log(`🔌 NETCONF: Disconnected all ${sessionCount} sessions`);
    return { disconnected: sessionCount };
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
    
    // Check if stream is still writable
    const streamWritable = session.stream?.writable === true;
    
    if (!streamWritable) {
      // Clean up dead session
      console.log(`⚠️ NETCONF: Session for ${session.deviceIp} has dead stream, removing...`);
      this.connections.delete(deviceId);
      return {
        isConnected: false,
        connected: false,
        message: 'NETCONF session stream is closed'
      };
    }
    
    return {
      isConnected: true,
      connected: true,
      deviceIp: session.deviceIp,
      createdAt: session.createdAt,
      lastUsed: session.lastUsed,
      capabilities: session.capabilities?.length || 0,
      sessionAge: Date.now() - session.createdAt,
      streamWritable: streamWritable
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
        capabilities: session.capabilities?.length || 0,
        capabilityList: session.capabilities || []
      });
    }
    
    return sessions;
  }

  /**
   * Graceful shutdown - close all connections and clear intervals
   */
  shutdown() {
    console.log('🌐 NETCONF Service shutting down...');
    
    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Close all NETCONF sessions
    for (const [deviceId, session] of this.connections) {
      try {
        if (session.stream) {
          session.stream.end();
        }
        if (session.connection) {
          session.connection.end();
        }
      } catch (e) {
        // Ignore errors during shutdown
      }
    }
    this.connections.clear();
    
    console.log('✅ NETCONF Service shutdown complete');
  }
}

// Create singleton instance
const netconfService = new NetconfService();
export default netconfService;
