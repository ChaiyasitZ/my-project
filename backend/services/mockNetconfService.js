import xml2js from 'xml2js';

class MockNetconfService {
  constructor() {
    this.mockSessions = new Map();
    this.builder = new xml2js.Builder({ rootName: 'rpc-reply' });
    this.parser = new xml2js.Parser({ explicitArray: false });
    this.messageIdCounter = 1;
  }

  // Mock device capabilities
  getMockCapabilities() {
    return [
      'urn:ietf:params:netconf:base:1.0',
      'urn:ietf:params:netconf:base:1.1',
      'urn:ietf:params:netconf:capability:candidate:1.0',
      'urn:ietf:params:netconf:capability:confirmed-commit:1.0',
      'urn:ietf:params:netconf:capability:rollback-on-error:1.0',
      'urn:ietf:params:netconf:capability:startup:1.0',
      'urn:ietf:params:netconf:capability:url:1.0',
      'urn:ietf:params:netconf:capability:validate:1.0',
      'urn:ietf:params:xml:ns:yang:ietf-interfaces?module=ietf-interfaces&revision=2018-02-20',
      'urn:ietf:params:xml:ns:yang:ietf-ip?module=ietf-ip&revision=2018-02-22',
      'http://cisco.com/ns/yang/cisco-nx-os-device?module=cisco-nx-os-device&revision=2023-05-01'
    ];
  }

  // Mock running configuration
  getMockRunningConfig() {
    return {
      'rpc-reply': {
        $: {
          'message-id': this.messageIdCounter++,
          'xmlns': 'urn:ietf:params:xml:ns:netconf:base:1.0'
        },
        data: {
          interfaces: {
            $: { xmlns: 'urn:ietf:params:xml:ns:yang:ietf-interfaces' },
            interface: [
              {
                name: 'GigabitEthernet0/0/1',
                description: 'Connection to Core Switch',
                type: 'iana-if-type:gigabitEthernet',
                enabled: 'true',
                ipv4: {
                  $: { xmlns: 'urn:ietf:params:xml:ns:yang:ietf-ip' },
                  enabled: 'true',
                  address: {
                    ip: '192.168.1.1',
                    'prefix-length': '24'
                  }
                }
              },
              {
                name: 'GigabitEthernet0/0/2',
                description: 'Management Interface',
                type: 'iana-if-type:gigabitEthernet',
                enabled: 'true',
                ipv4: {
                  $: { xmlns: 'urn:ietf:params:xml:ns:yang:ietf-ip' },
                  enabled: 'true',
                  address: {
                    ip: '10.0.0.100',
                    'prefix-length': '24'
                  }
                }
              },
              {
                name: 'Loopback0',
                description: 'Loopback Interface',
                type: 'iana-if-type:softwareLoopback',
                enabled: 'true',
                ipv4: {
                  $: { xmlns: 'urn:ietf:params:xml:ns:yang:ietf-ip' },
                  enabled: 'true',
                  address: {
                    ip: '1.1.1.1',
                    'prefix-length': '32'
                  }
                }
              }
            ]
          },
          'cisco-nx-os-device:System': {
            $: { xmlns: 'http://cisco.com/ns/yang/cisco-nx-os-device' },
            'intf-items': {
              'phys-items': [
                {
                  id: 'eth1/1',
                  adminSt: 'up',
                  descr: 'Server Connection',
                  'rshIfMain-items': {
                    'addr-items': {
                      addr: '192.168.10.1',
                      mask: '24'
                    }
                  }
                },
                {
                  id: 'eth1/2',
                  adminSt: 'up',
                  descr: 'Uplink to Core',
                  'rshIfMain-items': {
                    'addr-items': {
                      addr: '10.1.1.2',
                      mask: '30'
                    }
                  }
                }
              ]
            },
            'vrf-items': {
              'name-items': [
                {
                  name: 'default',
                  descr: 'Default VRF'
                },
                {
                  name: 'management',
                  descr: 'Management VRF'
                }
              ]
            }
          }
        }
      }
    };
  }

  // Mock operational data
  getMockOperationalData() {
    return {
      'rpc-reply': {
        $: {
          'message-id': this.messageIdCounter++,
          'xmlns': 'urn:ietf:params:xml:ns:netconf:base:1.0'
        },
        data: {
          'interfaces-state': {
            $: { xmlns: 'urn:ietf:params:xml:ns:yang:ietf-interfaces' },
            interface: [
              {
                name: 'GigabitEthernet0/0/1',
                type: 'iana-if-type:gigabitEthernet',
                'admin-status': 'up',
                'oper-status': 'up',
                'last-change': '2024-01-15T10:30:00Z',
                'if-index': '1',
                speed: '1000000000',
                statistics: {
                  'in-octets': '145832156',
                  'in-unicast-pkts': '1245678',
                  'in-errors': '0',
                  'out-octets': '98765432',
                  'out-unicast-pkts': '987654',
                  'out-errors': '0'
                }
              },
              {
                name: 'GigabitEthernet0/0/2',
                type: 'iana-if-type:gigabitEthernet',
                'admin-status': 'up',
                'oper-status': 'up',
                'last-change': '2024-01-15T09:15:00Z',
                'if-index': '2',
                speed: '1000000000',
                statistics: {
                  'in-octets': '87654321',
                  'in-unicast-pkts': '765432',
                  'in-errors': '2',
                  'out-octets': '123456789',
                  'out-unicast-pkts': '1234567',
                  'out-errors': '1'
                }
              }
            ]
          },
          'system-state': {
            $: { xmlns: 'urn:ietf:params:xml:ns:yang:ietf-system' },
            platform: {
              'os-name': 'Cisco NX-OS',
              'os-release': '10.1(2)',
              'os-version': '10.1(2)I7(1)',
              'machine': 'Nexus9000 C9300 Chassis'
            },
            clock: {
              'current-datetime': new Date().toISOString(),
              'boot-datetime': '2024-01-01T08:00:00Z'
            }
          }
        }
      }
    };
  }

  // Mock NETCONF connect
  async mockConnect(deviceConfig) {
    const { ip_address, netconf_port = 830 } = deviceConfig;
    const sessionId = `mock_${ip_address}:${netconf_port}_${Date.now()}`;

    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    const session = {
      sessionId,
      ip_address,
      isConnected: true,
      capabilities: this.getMockCapabilities(),
      connectedAt: new Date(),
      isMock: true
    };

    this.mockSessions.set(sessionId, session);

    return {
      success: true,
      sessionId,
      capabilities: session.capabilities,
      message: `Mock NETCONF session established with ${ip_address}`,
      isMock: true
    };
  }

  // Mock disconnect
  async mockDisconnect(sessionId) {
    const session = this.mockSessions.get(sessionId);
    if (!session) {
      throw new Error('Mock NETCONF session not found');
    }

    // Simulate disconnect delay
    await new Promise(resolve => setTimeout(resolve, 500));

    this.mockSessions.delete(sessionId);

    return {
      success: true,
      message: `Mock NETCONF session ${sessionId} disconnected`,
      isMock: true
    };
  }

  // Mock get-config
  async mockGetConfig(sessionId, datastore = 'running', filter = null) {
    const session = this.mockSessions.get(sessionId);
    if (!session || !session.isConnected) {
      throw new Error('Mock NETCONF session not available');
    }

    // Simulate operation delay
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200));

    let configData = this.getMockRunningConfig();

    // Apply filter if provided (simplified filtering)
    if (filter && typeof filter === 'string') {
      if (filter.includes('interfaces')) {
        configData = {
          'rpc-reply': {
            ...configData['rpc-reply'],
            data: {
              interfaces: configData['rpc-reply'].data.interfaces
            }
          }
        };
      }
    }

    return {
      success: true,
      operation: 'get-config',
      messageId: this.messageIdCounter++,
      data: configData,
      datastore,
      isMock: true
    };
  }

  // Mock get operational data
  async mockGet(sessionId, filter = null) {
    const session = this.mockSessions.get(sessionId);
    if (!session || !session.isConnected) {
      throw new Error('Mock NETCONF session not available');
    }

    // Simulate operation delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1500));

    return {
      success: true,
      operation: 'get',
      messageId: this.messageIdCounter++,
      data: this.getMockOperationalData(),
      isMock: true
    };
  }

  // Mock edit-config
  async mockEditConfig(sessionId, datastore = 'running', config, defaultOperation = 'merge') {
    const session = this.mockSessions.get(sessionId);
    if (!session || !session.isConnected) {
      throw new Error('Mock NETCONF session not available');
    }

    // Simulate configuration delay
    await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 2000));

    // Simulate occasional errors for testing
    if (Math.random() < 0.1) { // 10% chance of error
      throw new Error('Mock configuration error: Invalid interface name');
    }

    const response = {
      'rpc-reply': {
        $: {
          'message-id': this.messageIdCounter++,
          'xmlns': 'urn:ietf:params:xml:ns:netconf:base:1.0'
        },
        ok: {}
      }
    };

    return {
      success: true,
      operation: 'edit-config',
      messageId: this.messageIdCounter,
      data: response,
      datastore,
      defaultOperation,
      isMock: true
    };
  }

  // Mock commit
  async mockCommit(sessionId) {
    const session = this.mockSessions.get(sessionId);
    if (!session || !session.isConnected) {
      throw new Error('Mock NETCONF session not available');
    }

    // Simulate commit delay
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));

    const response = {
      'rpc-reply': {
        $: {
          'message-id': this.messageIdCounter++,
          'xmlns': 'urn:ietf:params:xml:ns:netconf:base:1.0'
        },
        ok: {}
      }
    };

    return {
      success: true,
      operation: 'commit',
      messageId: this.messageIdCounter,
      data: response,
      isMock: true
    };
  }

  // Mock validate
  async mockValidate(sessionId, datastore = 'candidate') {
    const session = this.mockSessions.get(sessionId);
    if (!session || !session.isConnected) {
      throw new Error('Mock NETCONF session not available');
    }

    // Simulate validation delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1500));

    // Simulate occasional validation errors
    if (Math.random() < 0.15) { // 15% chance of validation error
      throw new Error('Mock validation error: Configuration contains syntax errors');
    }

    const response = {
      'rpc-reply': {
        $: {
          'message-id': this.messageIdCounter++,
          'xmlns': 'urn:ietf:params:xml:ns:netconf:base:1.0'
        },
        ok: {}
      }
    };

    return {
      success: true,
      operation: 'validate',
      messageId: this.messageIdCounter,
      data: response,
      datastore,
      isMock: true
    };
  }

  // Get mock active sessions
  getMockActiveSessions() {
    const sessions = [];
    for (const [sessionId, session] of this.mockSessions) {
      sessions.push({
        sessionId,
        ip_address: session.ip_address,
        isConnected: session.isConnected,
        capabilities: session.capabilities,
        connectedAt: session.connectedAt,
        isMock: true
      });
    }
    return sessions;
  }

  // Generate mock NETCONF XML examples
  generateMockXmlExamples() {
    return {
      interfaceConfig: `<config xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
  <interfaces xmlns="urn:ietf:params:xml:ns:yang:ietf-interfaces">
    <interface>
      <name>GigabitEthernet0/0/3</name>
      <description>New Interface Configuration</description>
      <type xmlns:ianaift="urn:ietf:params:xml:ns:yang:iana-if-type">ianaift:gigabitEthernet</type>
      <enabled>true</enabled>
      <ipv4 xmlns="urn:ietf:params:xml:ns:yang:ietf-ip">
        <enabled>true</enabled>
        <address>
          <ip>192.168.100.1</ip>
          <prefix-length>24</prefix-length>
        </address>
      </ipv4>
    </interface>
  </interfaces>
</config>`,

      ciscoNxosConfig: `<config xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
  <System xmlns="http://cisco.com/ns/yang/cisco-nx-os-device">
    <intf-items>
      <phys-items>
        <id>eth1/10</id>
        <adminSt>up</adminSt>
        <descr>Production Server Link</descr>
        <rshIfMain-items>
          <addr-items>
            <addr>10.10.10.1</addr>
            <mask>24</mask>
          </addr-items>
        </rshIfMain-items>
      </phys-items>
    </intf-items>
  </System>
</config>`,

      vrfConfig: `<config xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
  <System xmlns="http://cisco.com/ns/yang/cisco-nx-os-device">
    <vrf-items>
      <name-items>
        <name>PROD-VRF</name>
        <descr>Production VRF for critical services</descr>
      </name-items>
    </vrf-items>
  </System>
</config>`
    };
  }

  // Cleanup mock sessions
  async mockCleanup() {
    const sessionIds = Array.from(this.mockSessions.keys());
    this.mockSessions.clear();
    console.log(`🧹 Cleaned up ${sessionIds.length} mock NETCONF sessions`);
    return { cleaned: sessionIds.length };
  }
}

export default new MockNetconfService(); 