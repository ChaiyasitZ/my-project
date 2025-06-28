import mongoose from 'mongoose';
import { config } from '../config/config.js';

// Import MongoDB models
import Device from '../models/Device.js';
import ConfigurationTemplate from '../models/ConfigurationTemplate.js';

console.log('🔄 Starting MongoDB initialization...');

async function initializeMongoDB() {
  try {
    // Connect to MongoDB
    console.log('🍃 Connecting to MongoDB...');
    await mongoose.connect(config.database.mongodb_uri);
    console.log('✅ MongoDB connected');

    // Get database reference
    const db = mongoose.connection.db;

    // 1. Create sample devices
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
        description: 'Main distribution switch',
        location: 'Data Center Rack A1',
        model: 'Cisco Catalyst 3850',
        ios_version: '16.12.08',
        status: 'active',
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
        description: 'Internet gateway router',
        location: 'Data Center Rack A2',
        model: 'Cisco ISR 4321',
        ios_version: '16.09.04',
        status: 'active',
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
        description: 'Floor 2 access switch',
        location: 'Floor 2 IDF',
        model: 'Cisco Catalyst 2960',
        ios_version: '15.2.7',
        status: 'inactive',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    await devicesCollection.insertMany(sampleDevices);
    console.log(`✅ Created ${sampleDevices.length} sample devices`);

    // 2. Create sample configuration templates
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
      },
      {
        name: 'VLAN Configuration',
        description: 'Standard VLAN setup with access and trunk ports',
        device_type: 'switch',
        category: 'vlan',
        template_config: `! VLAN Configuration
vlan {{vlan_id}}
 name {{vlan_name}}
!
interface {{access_interface}}
 switchport mode access
 switchport access vlan {{vlan_id}}
 spanning-tree portfast
 no shutdown
!
interface {{trunk_interface}}
 switchport mode trunk
 switchport trunk allowed vlan {{allowed_vlans}}
 no shutdown
!
end`,
        variables: {
          vlan_id: '100',
          vlan_name: 'Sales',
          access_interface: 'FastEthernet0/1',
          trunk_interface: 'GigabitEthernet0/1',
          allowed_vlans: '1,100,200'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    await templatesCollection.insertMany(sampleTemplates);
    console.log(`✅ Created ${sampleTemplates.length} configuration templates`);

    // 3. Show final statistics
    console.log('\n📊 Database statistics:');
    const collections = await db.listCollections().toArray();
    for (const collection of collections) {
      const count = await db.collection(collection.name).countDocuments();
      console.log(`   - ${collection.name}: ${count} documents`);
    }

    console.log('\n✅ MongoDB initialization completed successfully!');
    console.log('🤖 Ready for AI-powered network automation');

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