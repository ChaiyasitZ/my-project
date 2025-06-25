import snmp from 'net-snmp';

export class SNMPService {
  constructor() {
    this.sessions = new Map(); // Store active SNMP sessions
    
    // Standard SNMP OIDs for interface monitoring
    this.OIDs = {
      // Interface table OIDs
      ifIndex: '1.3.6.1.2.1.2.2.1.1',           // Interface index
      ifDescr: '1.3.6.1.2.1.2.2.1.2',           // Interface description/name
      ifType: '1.3.6.1.2.1.2.2.1.3',            // Interface type
      ifMtu: '1.3.6.1.2.1.2.2.1.4',             // MTU
      ifSpeed: '1.3.6.1.2.1.2.2.1.5',           // Interface speed
      ifPhysAddress: '1.3.6.1.2.1.2.2.1.6',     // MAC address
      ifAdminStatus: '1.3.6.1.2.1.2.2.1.7',     // Admin status (up/down)
      ifOperStatus: '1.3.6.1.2.1.2.2.1.8',      // Operational status
      ifLastChange: '1.3.6.1.2.1.2.2.1.9',      // Last status change
      ifInOctets: '1.3.6.1.2.1.2.2.1.10',       // Bytes in
      ifOutOctets: '1.3.6.1.2.1.2.2.1.16',      // Bytes out
      
      // IP address table OIDs
      ipAdEntAddr: '1.3.6.1.2.1.4.20.1.1',      // IP address
      ipAdEntIfIndex: '1.3.6.1.2.1.4.20.1.2',   // Interface index for IP
      ipAdEntNetMask: '1.3.6.1.2.1.4.20.1.3',   // Subnet mask
      
      // System information OIDs
      sysDescr: '1.3.6.1.2.1.1.1.0',            // System description
      sysObjectID: '1.3.6.1.2.1.1.2.0',         // System object ID
      sysUpTime: '1.3.6.1.2.1.1.3.0',           // System uptime
      sysContact: '1.3.6.1.2.1.1.4.0',          // System contact
      sysName: '1.3.6.1.2.1.1.5.0',             // System name
      sysLocation: '1.3.6.1.2.1.1.6.0',         // System location
      
      // Cisco specific OIDs
      ciscoMemoryPoolUsed: '1.3.6.1.4.1.9.9.48.1.1.1.5',      // Memory usage
      ciscoCPUTotal5min: '1.3.6.1.4.1.9.9.109.1.1.1.1.8',     // CPU usage
      ciscoEnvMonTemperature: '1.3.6.1.4.1.9.9.13.1.3.1.3'    // Temperature
    };
    
    // Interface status mappings
    this.ifStatusMap = {
      1: 'up',
      2: 'down',
      3: 'testing',
      4: 'unknown',
      5: 'dormant',
      6: 'notPresent',
      7: 'lowerLayerDown'
    };
    
    // Interface type mappings
    this.ifTypeMap = {
      6: 'ethernet',
      24: 'loopback',
      131: 'tunnel',
      53: 'propVirtual',
      135: 'l2vlan',
      136: 'l3ipvlan',
      161: 'ieee8023adLag'
    };
  }

  // Create SNMP session for device
  createSession(deviceConfig) {
    const { ip_address, snmp_community = 'public', snmp_version = snmp.Version1 } = deviceConfig;
    
    const sessionId = `${ip_address}_${snmp_community}`;
    
    if (this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId);
    }
    
    const session = snmp.createSession(ip_address, snmp_community, {
      port: deviceConfig.snmp_port || 161,
      retries: 3,
      timeout: 5000,
      transport: 'udp4',
      trapPort: 162,
      version: snmp_version,
      idBitsSize: 32
    });
    
    // Handle session errors
    session.on('error', (error) => {
      console.error(`❌ SNMP session error for ${ip_address}:`, error.message);
      this.sessions.delete(sessionId);
    });
    
    this.sessions.set(sessionId, session);
    console.log(`✅ Created SNMP session for ${ip_address}`);
    
    return session;
  }

  // Close SNMP session
  closeSession(deviceConfig) {
    const sessionId = `${deviceConfig.ip_address}_${deviceConfig.snmp_community || 'public'}`;
    const session = this.sessions.get(sessionId);
    
    if (session) {
      session.close();
      this.sessions.delete(sessionId);
      console.log(`🔌 Closed SNMP session for ${deviceConfig.ip_address}`);
    }
  }

  // Get single OID value
  async getOID(deviceConfig, oid) {
    return new Promise((resolve, reject) => {
      const session = this.createSession(deviceConfig);
      
      session.get([oid], (error, varbinds) => {
        if (error) {
          reject(new Error(`SNMP GET error: ${error.message}`));
          return;
        }
        
        if (varbinds[0] && snmp.isVarbindError(varbinds[0])) {
          reject(new Error(`SNMP varbind error: ${snmp.varbindError(varbinds[0])}`));
          return;
        }
        
        resolve(varbinds[0]);
      });
    });
  }

  // Get multiple OID values
  async getOIDs(deviceConfig, oids) {
    return new Promise((resolve, reject) => {
      const session = this.createSession(deviceConfig);
      
      session.get(oids, (error, varbinds) => {
        if (error) {
          reject(new Error(`SNMP GET error: ${error.message}`));
          return;
        }
        
        const results = {};
        varbinds.forEach((varbind, index) => {
          if (snmp.isVarbindError(varbind)) {
            results[oids[index]] = { error: snmp.varbindError(varbind) };
          } else {
            results[oids[index]] = varbind;
          }
        });
        
        resolve(results);
      });
    });
  }

  // Walk OID tree
  async walkOID(deviceConfig, oid) {
    return new Promise((resolve, reject) => {
      const session = this.createSession(deviceConfig);
      const results = [];
      
      function feedCb(varbinds) {
        for (const varbind of varbinds) {
          if (snmp.isVarbindError(varbind)) {
            console.error(`❌ SNMP walk error: ${snmp.varbindError(varbind)}`);
          } else {
            results.push(varbind);
          }
        }
      }
      
      function doneCb(error) {
        if (error) {
          reject(new Error(`SNMP walk error: ${error.message}`));
        } else {
          resolve(results);
        }
      }
      
      session.walk(oid, feedCb, doneCb);
    });
  }

  // Get system information
  async getSystemInfo(deviceConfig) {
    try {
      console.log(`📊 Getting system information for ${deviceConfig.ip_address}`);
      
      const systemOIDs = [
        this.OIDs.sysDescr,
        this.OIDs.sysObjectID,
        this.OIDs.sysUpTime,
        this.OIDs.sysContact,
        this.OIDs.sysName,
        this.OIDs.sysLocation
      ];
      
      const results = await this.getOIDs(deviceConfig, systemOIDs);
      
      const systemInfo = {
        description: results[this.OIDs.sysDescr]?.value?.toString() || 'Unknown',
        objectId: results[this.OIDs.sysObjectID]?.value?.toString() || 'Unknown',
        uptime: results[this.OIDs.sysUpTime]?.value || 0,
        contact: results[this.OIDs.sysContact]?.value?.toString() || 'Unknown',
        hostname: results[this.OIDs.sysName]?.value?.toString() || 'Unknown',
        location: results[this.OIDs.sysLocation]?.value?.toString() || 'Unknown',
        retrievedAt: new Date().toISOString()
      };
      
      console.log(`✅ Retrieved system info for ${deviceConfig.ip_address}`);
      return { success: true, systemInfo };
      
    } catch (error) {
      console.error(`❌ Failed to get system info for ${deviceConfig.ip_address}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  // Get all interfaces and their status
  async getInterfaceStatus(deviceConfig) {
    try {
      console.log(`🔍 Getting interface status for ${deviceConfig.ip_address}`);
      
      // Walk interface table to get all interfaces
      const [ifIndexResults, ifDescrResults, ifAdminStatusResults, ifOperStatusResults, 
             ifTypeResults, ifSpeedResults] = await Promise.all([
        this.walkOID(deviceConfig, this.OIDs.ifIndex),
        this.walkOID(deviceConfig, this.OIDs.ifDescr),
        this.walkOID(deviceConfig, this.OIDs.ifAdminStatus),
        this.walkOID(deviceConfig, this.OIDs.ifOperStatus),
        this.walkOID(deviceConfig, this.OIDs.ifType),
        this.walkOID(deviceConfig, this.OIDs.ifSpeed)
      ]);
      
      const interfaces = [];
      
      // Process interface data
      ifIndexResults.forEach((indexVarbind) => {
        const ifIndex = indexVarbind.value;
        const ifIndexOid = indexVarbind.oid;
        
        // Extract interface index from OID
        const interfaceIndex = ifIndexOid.split('.').slice(-1)[0];
        
        // Find corresponding data for this interface
        const descrVarbind = ifDescrResults.find(v => 
          v.oid.endsWith(`.${interfaceIndex}`));
        const adminStatusVarbind = ifAdminStatusResults.find(v => 
          v.oid.endsWith(`.${interfaceIndex}`));
        const operStatusVarbind = ifOperStatusResults.find(v => 
          v.oid.endsWith(`.${interfaceIndex}`));
        const typeVarbind = ifTypeResults.find(v => 
          v.oid.endsWith(`.${interfaceIndex}`));
        const speedVarbind = ifSpeedResults.find(v => 
          v.oid.endsWith(`.${interfaceIndex}`));
        
        const interfaceData = {
          index: parseInt(ifIndex),
          name: descrVarbind?.value?.toString() || `Interface${interfaceIndex}`,
          description: descrVarbind?.value?.toString() || '',
          adminStatus: this.ifStatusMap[adminStatusVarbind?.value] || 'unknown',
          operStatus: this.ifStatusMap[operStatusVarbind?.value] || 'unknown',
          type: this.ifTypeMap[typeVarbind?.value] || 'unknown',
          typeId: typeVarbind?.value || 0,
          speed: speedVarbind?.value || 0,
          speedMbps: speedVarbind?.value ? Math.round(speedVarbind.value / 1000000) : 0
        };
        
        interfaces.push(interfaceData);
      });
      
      // Sort by interface index
      interfaces.sort((a, b) => a.index - b.index);
      
      console.log(`✅ Retrieved ${interfaces.length} interfaces for ${deviceConfig.ip_address}`);
      return { success: true, interfaces, count: interfaces.length };
      
    } catch (error) {
      console.error(`❌ Failed to get interface status for ${deviceConfig.ip_address}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  // Get IP addresses on interfaces
  async getInterfaceIPs(deviceConfig) {
    try {
      console.log(`🌐 Getting interface IP addresses for ${deviceConfig.ip_address}`);
      
      // Walk IP address table
      const [ipAddrResults, ipIfIndexResults, ipNetMaskResults] = await Promise.all([
        this.walkOID(deviceConfig, this.OIDs.ipAdEntAddr),
        this.walkOID(deviceConfig, this.OIDs.ipAdEntIfIndex),
        this.walkOID(deviceConfig, this.OIDs.ipAdEntNetMask)
      ]);
      
      const ipAddresses = [];
      
      // Process IP address data
      ipAddrResults.forEach((ipVarbind) => {
        const ipAddress = ipVarbind.value?.toString() || '';
        const ipOid = ipVarbind.oid;
        
        // Extract IP address from OID for matching
        const ipOidSuffix = ipOid.split('.').slice(-4).join('.');
        
        // Find corresponding interface index and netmask
        const ifIndexVarbind = ipIfIndexResults.find(v => 
          v.oid.endsWith(`.${ipOidSuffix}`));
        const netMaskVarbind = ipNetMaskResults.find(v => 
          v.oid.endsWith(`.${ipOidSuffix}`));
        
        const ipData = {
          ipAddress: ipAddress,
          interfaceIndex: ifIndexVarbind?.value || 0,
          netmask: netMaskVarbind?.value?.toString() || '',
          cidr: this.netmaskToCIDR(netMaskVarbind?.value?.toString() || ''),
          network: this.calculateNetwork(ipAddress, netMaskVarbind?.value?.toString() || '')
        };
        
        ipAddresses.push(ipData);
      });
      
      // Sort by interface index
      ipAddresses.sort((a, b) => a.interfaceIndex - b.interfaceIndex);
      
      console.log(`✅ Retrieved ${ipAddresses.length} IP addresses for ${deviceConfig.ip_address}`);
      return { success: true, ipAddresses, count: ipAddresses.length };
      
    } catch (error) {
      console.error(`❌ Failed to get interface IPs for ${deviceConfig.ip_address}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  // Get complete interface monitoring data
  async getCompleteInterfaceData(deviceConfig) {
    try {
      console.log(`📋 Getting complete interface data for ${deviceConfig.ip_address}`);
      
      // Get both interface status and IP addresses
      const [interfaceResult, ipResult, systemResult] = await Promise.all([
        this.getInterfaceStatus(deviceConfig),
        this.getInterfaceIPs(deviceConfig),
        this.getSystemInfo(deviceConfig)
      ]);
      
      if (!interfaceResult.success) {
        throw new Error(`Interface status error: ${interfaceResult.error}`);
      }
      
      // Merge interface data with IP addresses
      const interfaces = interfaceResult.interfaces.map(intf => {
        const interfaceIPs = ipResult.success ? 
          ipResult.ipAddresses.filter(ip => ip.interfaceIndex === intf.index) : [];
        
        return {
          ...intf,
          ipAddresses: interfaceIPs,
          hasIP: interfaceIPs.length > 0,
          primaryIP: interfaceIPs.length > 0 ? interfaceIPs[0].ipAddress : null
        };
      });
      
      const result = {
        success: true,
        deviceInfo: {
          ipAddress: deviceConfig.ip_address,
          hostname: systemResult.success ? systemResult.systemInfo.hostname : 'Unknown',
          description: systemResult.success ? systemResult.systemInfo.description : 'Unknown',
          uptime: systemResult.success ? systemResult.systemInfo.uptime : 0
        },
        interfaces: interfaces,
        summary: {
          totalInterfaces: interfaces.length,
          interfacesUp: interfaces.filter(i => i.operStatus === 'up').length,
          interfacesDown: interfaces.filter(i => i.operStatus === 'down').length,
          interfacesWithIP: interfaces.filter(i => i.hasIP).length,
          totalIPs: ipResult.success ? ipResult.count : 0
        },
        retrievedAt: new Date().toISOString()
      };
      
      console.log(`✅ Retrieved complete interface data for ${deviceConfig.ip_address}`);
      return result;
      
    } catch (error) {
      console.error(`❌ Failed to get complete interface data for ${deviceConfig.ip_address}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  // Test SNMP connectivity
  async testConnection(deviceConfig) {
    try {
      console.log(`🧪 Testing SNMP connection to ${deviceConfig.ip_address}`);
      
      // Try to get system description
      const result = await this.getOID(deviceConfig, this.OIDs.sysDescr);
      
      if (result && result.value) {
        console.log(`✅ SNMP connection test successful for ${deviceConfig.ip_address}`);
        return {
          success: true,
          message: 'SNMP connection successful',
          systemDescription: result.value.toString(),
          community: deviceConfig.snmp_community || 'public',
          version: deviceConfig.snmp_version || 'v1'
        };
      } else {
        throw new Error('No response from device');
      }
      
    } catch (error) {
      console.error(`❌ SNMP connection test failed for ${deviceConfig.ip_address}:`, error.message);
      
      let specificMessage = error.message;
      if (error.message.includes('RequestTimedOutError')) {
        specificMessage = 'SNMP request timeout. Check if SNMP is enabled on the device and firewall allows UDP 161.';
      } else if (error.message.includes('No such name')) {
        specificMessage = 'Invalid community string or SNMP not configured properly.';
      }
      
      return {
        success: false,
        message: specificMessage,
        originalError: error.message
      };
    }
  }

  // Utility function to convert netmask to CIDR
  netmaskToCIDR(netmask) {
    if (!netmask) return 0;
    
    const parts = netmask.split('.');
    if (parts.length !== 4) return 0;
    
    let cidr = 0;
    for (const part of parts) {
      const num = parseInt(part);
      const binary = num.toString(2);
      cidr += binary.split('1').length - 1;
    }
    
    return cidr;
  }

  // Utility function to calculate network address
  calculateNetwork(ipAddress, netmask) {
    if (!ipAddress || !netmask) return '';
    
    try {
      const ipParts = ipAddress.split('.').map(p => parseInt(p));
      const maskParts = netmask.split('.').map(p => parseInt(p));
      
      if (ipParts.length !== 4 || maskParts.length !== 4) return '';
      
      const networkParts = ipParts.map((ip, i) => ip & maskParts[i]);
      return networkParts.join('.');
    } catch (error) {
      return '';
    }
  }

  // Close all SNMP sessions
  closeAllSessions() {
    console.log(`🔌 Closing all SNMP sessions (${this.sessions.size} active)`);
    for (const [sessionId, session] of this.sessions) {
      session.close();
    }
    this.sessions.clear();
  }
}

// Create singleton instance
const snmpService = new SNMPService();

export default snmpService;