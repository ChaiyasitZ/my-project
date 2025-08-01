import mongoose from 'mongoose';
import { config } from '../config/config.js';

// Import MongoDB models
import Device from '../models/Device.js';
import netconfDevices from '../models/netconfDevices.js';
import ConfigurationTemplate from '../models/ConfigurationTemplate.js';
import YangModel from '../models/YangModel.js';
import ConfigurationHistory from '../models/ConfigurationHistory.js';
import ConfigurationBackup from '../models/ConfigurationBackup.js';

console.log('🔄 Starting MongoDB initialization...');

async function initializeMongoDB() {
  try {
    // Connect to MongoDB
    console.log('🍃 Connecting to MongoDB...');
    await mongoose.connect(config.database.mongodb_uri);
    console.log('✅ MongoDB connected');

    // Get database reference
    const db = mongoose.connection.db;

    // 1. Create sample devices with NETCONF support
    console.log('\n📱 Creating sample devices...');
    const devicesCollection = db.collection('devices');
    
    // Clear existing devices
    await devicesCollection.deleteMany({});
    
    const sampleDevices = [
      {
        name: 'Core-Switch-01',
        type: 'switch',
        ip_address: '192.168.1.10',
        ssh_port: 22,
        username: 'admin',
        password: 'cisco123',
        description: 'Main distribution switch with NETCONF support',
        location: 'Data Center Rack A1',
        model: 'Cisco Nexus 9300',
        ios_version: '10.1(2)',
        vendor: 'cisco',
        status: 'active',
        netconf_enabled: true,
        netconf_port: 830,
        netconf_capabilities: [
          'urn:ietf:params:netconf:base:1.0',
          'urn:ietf:params:netconf:base:1.1',
          'urn:ietf:params:netconf:capability:candidate:1.0',
          'urn:ietf:params:xml:ns:yang:ietf-interfaces?module=ietf-interfaces&revision=2018-02-20',
          'http://cisco.com/ns/yang/cisco-nx-os-device?module=cisco-nx-os-device&revision=2023-05-01'
        ],
        yang_models: [
          {
            model_name: 'ietf-interfaces',
            namespace: 'urn:ietf:params:xml:ns:yang:ietf-interfaces',
            revision: '2018-02-20',
            supported: true
          },
          {
            model_name: 'cisco-nx-os-device',
            namespace: 'http://cisco.com/ns/yang/cisco-nx-os-device',
            revision: '2023-05-01',
            supported: true
          }
        ],
        preferred_connection: 'netconf',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Edge-Router-01',
        type: 'router',
        ip_address: '192.168.1.1',
        ssh_port: 22,
        username: 'admin',
        password: 'cisco123',
        description: 'Internet gateway router - Legacy SSH only',
        location: 'Data Center Rack A2',
        model: 'Cisco ISR 4321',
        ios_version: '16.09.04',
        vendor: 'cisco',
        status: 'active',
        netconf_enabled: false,
        preferred_connection: 'ssh',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Access-Switch-02',
        type: 'switch',
        ip_address: '192.168.1.20',
        ssh_port: 22,
        username: 'admin',
        password: 'cisco123',
        description: 'Floor 2 access switch with NETCONF',
        location: 'Floor 2 IDF',
        model: 'Cisco Catalyst 9200',
        ios_version: '17.3.4',
        vendor: 'cisco',
        status: 'inactive',
        netconf_enabled: true,
        netconf_port: 830,
        yang_models: [
          {
            model_name: 'ietf-interfaces',
            namespace: 'urn:ietf:params:xml:ns:yang:ietf-interfaces',
            revision: '2018-02-20',
            supported: true
          }
        ],
        preferred_connection: 'ssh',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    await devicesCollection.insertMany(sampleDevices);
    console.log(`✅ Created ${sampleDevices.length} sample devices`);

    // 2. Create YANG models
    console.log('\n📄 Creating YANG models...');
    const yangModelsCollection = db.collection('yangmodels');
    
    // Clear existing YANG models
    await yangModelsCollection.deleteMany({});
    
    const sampleYangModels = [
      {
        name: 'ietf-interfaces',
        namespace: 'urn:ietf:params:xml:ns:yang:ietf-interfaces',
        prefix: 'if',
        revision: '2018-02-20',
        description: 'This module contains a collection of YANG definitions for managing network interfaces.',
        organization: 'IETF NETMOD (Network Modeling) Working Group',
        contact: 'WG Web:   <https://datatracker.ietf.org/wg/netmod/>',
        yang_content: `module ietf-interfaces {
  yang-version 1.1;
  namespace "urn:ietf:params:xml:ns:yang:ietf-interfaces";
  prefix if;
  
  description "This module contains a collection of YANG definitions for managing network interfaces.";
  
  revision 2018-02-20 {
    description "Updated to support NMDA.";
  }
  
  container interfaces {
    description "Interface parameters.";
    
    list interface {
      key "name";
      description "The list of interfaces on the device.";
      
      leaf name {
        type string;
        description "The name of the interface.";
      }
      
      leaf description {
        type string;
        description "A textual description of the interface.";
      }
      
      leaf type {
        type string;
        mandatory true;
        description "The type of the interface.";
      }
      
      leaf enabled {
        type boolean;
        default "true";
        description "This leaf contains the configured, desired state of the interface.";
      }
    }
  }
}`,
        parsed_structure: {
          containers: {
            interfaces: {
              description: "Interface parameters.",
              lists: {
                interface: {
                  key: "name",
                  leaves: [
                    { name: "name", type: "string", mandatory: false },
                    { name: "description", type: "string", mandatory: false },
                    { name: "type", type: "string", mandatory: true },
                    { name: "enabled", type: "boolean", default: "true" }
                  ]
                }
              }
            }
          }
        },
        vendor: 'ietf',
        category: 'interface',
        status: 'active',
        supported_devices: [
          { vendor: 'cisco', model: 'nexus-9000', os_version: 'any' },
          { vendor: 'cisco', model: 'catalyst-9000', os_version: 'any' }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'cisco-nx-os-device',
        namespace: 'http://cisco.com/ns/yang/cisco-nx-os-device',
        prefix: 'nxos',
        revision: '2023-05-01',
        description: 'Cisco NX-OS device model.',
        organization: 'Cisco Systems, Inc.',
        contact: 'Cisco Systems, Inc.',
        yang_content: `module cisco-nx-os-device {
  yang-version 1.1;
  namespace "http://cisco.com/ns/yang/cisco-nx-os-device";
  prefix nxos;
  
  description "Cisco NX-OS device model.";
  
  revision 2023-05-01 {
    description "Latest revision";
  }
  
  container System {
    description "System configuration";
    
    container intf-items {
      description "Interface items";
      
      list phys-items {
        key "id";
        description "Physical interface list";
        
        leaf id {
          type string;
          description "Interface identifier";
        }
        
        leaf adminSt {
          type enumeration {
            enum up;
            enum down;
          }
          default "up";
          description "Administrative state";
        }
        
        leaf descr {
          type string;
          description "Interface description";
        }
      }
    }
  }
}`,
        parsed_structure: {
          containers: {
            System: {
              description: "System configuration",
              containers: {
                "intf-items": {
                  description: "Interface items",
                  lists: {
                    "phys-items": {
                      key: "id",
                      leaves: [
                        { name: "id", type: "string", mandatory: false },
                        { name: "adminSt", type: "enumeration", default: "up" },
                        { name: "descr", type: "string", mandatory: false }
                      ]
                    }
                  }
                }
              }
            }
          }
        },
        vendor: 'cisco',
        category: 'system',
        status: 'active',
        supported_devices: [
          { vendor: 'cisco', model: 'nexus-9000', os_version: '9.3' },
          { vendor: 'cisco', model: 'nexus-9000', os_version: '10.1' }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    await yangModelsCollection.insertMany(sampleYangModels);
    console.log(`✅ Created ${sampleYangModels.length} YANG models`);

    // 3. Create sample configuration templates with NETCONF support
    console.log('\n📄 Creating configuration templates...');
    const templatesCollection = db.collection('configurationtemplates');
    
    // Clear existing templates
    await templatesCollection.deleteMany({});
    
    const sampleTemplates = [
      {
        name: 'Basic Switch Setup',
        description: 'Essential switch configuration with management IP and SSH',
        device_type: 'switch',
        category: 'basic',
        template_config: `! Basic Switch Configuration
hostname {{hostname}}
!
ip domain-name {{domain}}
!
interface vlan1
 ip address {{management_ip}} {{management_mask}}
 no shutdown
!
ip default-gateway {{default_gateway}}
!
crypto key generate rsa general-keys modulus {{rsa_key_size}}
!
username {{username}} privilege 15 secret {{password}}
!
line vty 0 15
 login local
 transport input ssh
!
ip ssh version 2
!
end`,
        variables: {
          hostname: 'SW-CORE-01',
          domain: 'company.local',
          management_ip: '192.168.1.10',
          management_mask: '255.255.255.0',
          default_gateway: '192.168.1.1',
          rsa_key_size: '2048',
          username: 'admin',
          password: 'cisco123'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'NETCONF Interface Configuration',
        description: 'NETCONF XML template for interface configuration',
        device_type: 'switch',
        category: 'netconf',
        template_config: `<config xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
  <interfaces xmlns="urn:ietf:params:xml:ns:yang:ietf-interfaces">
    <interface>
      <name>{{interface_name}}</name>
      <description>{{interface_description}}</description>
      <type xmlns:ianaift="urn:ietf:params:xml:ns:yang:iana-if-type">ianaift:gigabitEthernet</type>
      <enabled>{{enabled}}</enabled>
      <ipv4 xmlns="urn:ietf:params:xml:ns:yang:ietf-ip">
        <enabled>true</enabled>
        <address>
          <ip>{{ip_address}}</ip>
          <prefix-length>{{prefix_length}}</prefix-length>
        </address>
      </ipv4>
    </interface>
  </interfaces>
</config>`,
        variables: {
          interface_name: 'GigabitEthernet0/0/1',
          interface_description: 'Management Interface',
          enabled: 'true',
          ip_address: '192.168.1.10',
          prefix_length: '24'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Cisco NX-OS NETCONF Configuration',
        description: 'Cisco NX-OS specific NETCONF XML template',
        device_type: 'switch',
        category: 'netconf',
        template_config: `<config xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
  <System xmlns="http://cisco.com/ns/yang/cisco-nx-os-device">
    <intf-items>
      <phys-items>
        <id>{{interface_id}}</id>
        <adminSt>{{admin_state}}</adminSt>
        <descr>{{description}}</descr>
        <rshIfMain-items>
          <addr-items>
            <addr>{{ip_address}}</addr>
            <mask>{{subnet_mask}}</mask>
          </addr-items>
        </rshIfMain-items>
      </phys-items>
    </intf-items>
  </System>
</config>`,
        variables: {
          interface_id: 'eth1/1',
          admin_state: 'up',
          description: 'Server Connection',
          ip_address: '192.168.10.1',
          subnet_mask: '24'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Router OSPF Configuration',
        description: 'Basic OSPF routing setup for enterprise networks',
        device_type: 'router',
        category: 'routing',
        template_config: `! OSPF Router Configuration
hostname {{hostname}}
!
router ospf {{process_id}}
 network {{network_address}} {{wildcard_mask}} area {{area_id}}
 passive-interface default
 no passive-interface {{active_interface}}
!
interface {{active_interface}}
 ip ospf hello-interval {{hello_interval}}
 ip ospf dead-interval {{dead_interval}}
!
end`,
        variables: {
          hostname: 'RTR-CORE-01',
          process_id: '1',
          network_address: '192.168.0.0',
          wildcard_mask: '0.0.255.255',
          area_id: '0',
          active_interface: 'GigabitEthernet0/0',
          hello_interval: '10',
          dead_interval: '40'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    await templatesCollection.insertMany(sampleTemplates);
    console.log(`✅ Created ${sampleTemplates.length} configuration templates`);

    // 4. Create indexes for performance
    console.log('\n🔍 Creating database indexes...');
    
    // Device indexes
    await devicesCollection.createIndex({ status: 1 });
    await devicesCollection.createIndex({ type: 1 });
    await devicesCollection.createIndex({ vendor: 1 });
    await devicesCollection.createIndex({ netconf_enabled: 1 });
    await devicesCollection.createIndex({ preferred_connection: 1 });
    console.log('✅ Created device indexes');
    
    // YANG model indexes
    await yangModelsCollection.createIndex({ vendor: 1, category: 1 });
    await yangModelsCollection.createIndex({ name: 1, revision: -1 });
    await yangModelsCollection.createIndex({ namespace: 1 });
    await yangModelsCollection.createIndex({ status: 1 });
    console.log('✅ Created YANG model indexes');

    // 5. Show final statistics
    console.log('\n📊 Database statistics:');
    const collections = await db.listCollections().toArray();
    for (const collection of collections) {
      const count = await db.collection(collection.name).countDocuments();
      console.log(`   - ${collection.name}: ${count} documents`);
    }

    // 6. Show NETCONF summary
    console.log('\n📡 NETCONF/YANG Summary:');
    const netconfDevices = await devicesCollection.find({ netconf_enabled: true }).toArray();
    console.log(`   - NETCONF-enabled devices: ${netconfDevices.length}`);
    const yangModelsCount = await yangModelsCollection.countDocuments();
    console.log(`   - YANG models available: ${yangModelsCount}`);
    const netconfTemplates = await templatesCollection.find({ category: 'netconf' }).toArray();
    console.log(`   - NETCONF templates: ${netconfTemplates.length}`);

    console.log('\n✅ MongoDB initialization completed successfully!');
    console.log('🤖 Ready for AI-powered network automation with NETCONF/YANG support');

  } catch (error) {
    console.error('❌ MongoDB initialization failed:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
  }
}

// Run initialization
initializeMongoDB().catch((error) => {
  console.error('💥 Initialization failed:', error);
  process.exit(1);
}); 