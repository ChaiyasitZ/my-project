import mongoose from 'mongoose';
import Device from '../models/Device.js';
import { config } from '../config/config.js';

// Sample mock devices for testing
const mockDevices = [
  {
    name: 'Mock-SW-Core-01',
    type: 'switch',
    ip_address: '192.168.1.100',
    ssh_port: 22,
    username: 'admin',
    password: 'cisco123',
    description: 'Mock Core Switch for Testing',
    location: 'Data Center - Rack A1',
    model: 'Nexus 9300',
    ios_version: '10.1(2)',
    vendor: 'cisco',
    status: 'active',
    netconf_enabled: true,
    netconf_port: 830,
    preferred_connection: 'netconf',
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
    ]
  },
  {
    name: 'Mock-SW-Access-01',
    type: 'switch',
    ip_address: '192.168.1.101',
    ssh_port: 22,
    username: 'admin',
    password: 'cisco123',
    description: 'Mock Access Switch for Testing',
    location: 'Floor 2 - Network Closet',
    model: 'Catalyst 9200',
    ios_version: '17.3.4',
    vendor: 'cisco',
    status: 'active',
    netconf_enabled: true,
    netconf_port: 830,
    preferred_connection: 'ssh',
    yang_models: [
      {
        model_name: 'ietf-interfaces',
        namespace: 'urn:ietf:params:xml:ns:yang:ietf-interfaces',
        revision: '2018-02-20',
        supported: true
      }
    ]
  },
  {
    name: 'Mock-RTR-Border-01',
    type: 'router',
    ip_address: '10.0.1.1',
    ssh_port: 22,
    username: 'admin',
    password: 'cisco123',
    description: 'Mock Border Router for Testing',
    location: 'DMZ - Security Zone',
    model: 'ISR 4431',
    ios_version: '16.12.05',
    vendor: 'cisco',
    status: 'active',
    netconf_enabled: false, // Legacy device without NETCONF
    preferred_connection: 'ssh'
  },
  {
    name: 'Mock-FW-ASA-01',
    type: 'firewall',
    ip_address: '10.0.0.1',
    ssh_port: 22,
    username: 'admin',
    password: 'cisco123',
    description: 'Mock ASA Firewall for Testing',
    location: 'Perimeter Security',
    model: 'ASA 5516-X',
    ios_version: '9.16(4)',
    vendor: 'cisco',
    status: 'maintenance',
    netconf_enabled: false,
    preferred_connection: 'ssh'
  },
  {
    name: 'Mock-SW-Nexus-DC',
    type: 'switch',
    ip_address: '192.168.10.10',
    ssh_port: 22,
    username: 'netadmin',
    password: 'N3xus@123',
    description: 'Mock Nexus Data Center Switch',
    location: 'Data Center - Core',
    model: 'Nexus 9500',
    ios_version: '10.2(1)',
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
    preferred_connection: 'netconf',
    yang_models: [
      {
        model_name: 'ietf-interfaces',
        namespace: 'urn:ietf:params:xml:ns:yang:ietf-interfaces',
        revision: '2018-02-20',
        supported: true
      },
      {
        model_name: 'ietf-ip',
        namespace: 'urn:ietf:params:xml:ns:yang:ietf-ip',
        revision: '2018-02-22',
        supported: true
      },
      {
        model_name: 'cisco-nx-os-device',
        namespace: 'http://cisco.com/ns/yang/cisco-nx-os-device',
        revision: '2023-05-01',
        supported: true
      }
    ]
  }
];

async function initializeMockDevices() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(config.database.mongodb_uri);
    console.log('✅ Connected to MongoDB');

    console.log('🗑️  Clearing existing mock devices...');
    // Only remove devices that start with "Mock-"
    await Device.deleteMany({ name: { $regex: /^Mock-/ } });

    console.log('📝 Creating mock devices...');
    for (const deviceData of mockDevices) {
      const device = new Device(deviceData);
      await device.save();
      console.log(`✅ Created mock device: ${device.name} (${device.type} - ${device.ip_address})`);
    }

    console.log(`\n🎉 Successfully initialized ${mockDevices.length} mock devices!`);
    console.log('\nMock devices summary:');
    const devices = await Device.find({ name: { $regex: /^Mock-/ } }).select('name type ip_address netconf_enabled status');
    devices.forEach(device => {
      const netconfStatus = device.netconf_enabled ? '✅ NETCONF' : '❌ SSH Only';
      console.log(`  - ${device.name} (${device.type}) - ${device.ip_address} - ${netconfStatus} - ${device.status}`);
    });

    console.log('\n📊 Device statistics:');
    const stats = await Device.aggregate([
      { $match: { name: { $regex: /^Mock-/ } } },
      { $group: { 
          _id: '$type', 
          count: { $sum: 1 },
          netconf_enabled: { $sum: { $cond: ['$netconf_enabled', 1, 0] } }
        }
      }
    ]);
    
    stats.forEach(stat => {
      console.log(`  - ${stat._id}: ${stat.count} devices (${stat.netconf_enabled} with NETCONF)`);
    });

  } catch (error) {
    console.error('❌ Error initializing mock devices:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    process.exit(0);
  }
}

// Run initialization if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeMockDevices();
}

export default initializeMockDevices; 