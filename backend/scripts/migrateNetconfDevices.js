import mongoose from 'mongoose';
import { config } from '../config/config.js';
import Device from '../models/Device.js';
import NetconfDevice from '../models/NetconfDevice.js';

console.log('🚀 Starting NETCONF devices migration...');

async function migrateNetconfDevices() {
  try {
    // Connect to MongoDB
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(config.database.mongodb_uri);
    console.log('✅ Connected to MongoDB');

    // Find all devices with NETCONF enabled
    console.log('🔍 Finding devices with NETCONF enabled...');
    const netconfEnabledDevices = await Device.find({ 
      netconf_enabled: true 
    }).lean();

    console.log(`📊 Found ${netconfEnabledDevices.length} devices with NETCONF enabled`);

    if (netconfEnabledDevices.length === 0) {
      console.log('⚠️ No NETCONF-enabled devices found to migrate');
      return;
    }

    // Transform and migrate each device
    const migratedDevices = [];
    const errors = [];

    for (const device of netconfEnabledDevices) {
      try {
        console.log(`🔄 Migrating device: ${device.name} (${device.ip_address})`);

        // Check if device already exists in NetconfDevice collection
        const existingNetconfDevice = await NetconfDevice.findOne({
          $or: [
            { ip_address: device.ip_address },
            { name: device.name }
          ]
        });

        if (existingNetconfDevice) {
          console.log(`⚠️ Device ${device.name} already exists in NetconfDevice collection, skipping...`);
          continue;
        }

        // Map old device fields to new NetconfDevice schema
        const netconfDeviceData = {
          name: device.name,
          description: device.description || '',
          ip_address: device.ip_address,
          hostname: device.hostname || '',
          location: device.location || '',
          
          // Map device type
          device_type: mapDeviceType(device.type),
          platform: device.model || '',
          model: device.model || '',
          os_version: device.ios_version || '',
          vendor: device.vendor || 'cisco',
          
          // SSH Connection
          ssh_port: device.ssh_port || 22,
          username: device.username,
          password: device.password,
          
          // NETCONF Configuration
          netconf_port: device.netconf_port || 830,
          netconf_enabled: true,
          netconf_capabilities: device.netconf_capabilities || [],
          
          // NETCONF Session defaults
          connection_timeout: 30000,
          keepalive_interval: 5000,
          max_retries: 3,
          
          // YANG Models
          yang_models: (device.yang_models || []).map(ym => ({
            model_id: ym.model_id,
            model_name: ym.model_name,
            namespace: ym.namespace,
            revision: ym.revision,
            supported: ym.supported !== false,
            device_capabilities: ym.device_capabilities || []
          })),
          
          // Device Status
          status: device.status || 'inactive',
          connection_status: 'disconnected',
          
          // Performance Metrics (initialize empty)
          performance_metrics: {
            total_sessions: 0,
            successful_sessions: 0,
            failed_sessions: 0
          },
          
          // Configuration Management
          supported_datastores: ['running'],
          default_datastore: 'running',
          supports_validation: false,
          supports_rollback: false,
          
          // Monitoring
          monitoring_enabled: true,
          alert_threshold: {
            response_time_ms: 5000,
            failure_rate_percent: 20
          },
          
          // Metadata
          created_by: 'migration',
          notes: `Migrated from Device collection on ${new Date().toISOString()}`,
          
          // Preserve timestamps if they exist
          createdAt: device.createdAt || new Date(),
          updatedAt: new Date()
        };

        // Create new NetconfDevice
        const netconfDevice = new NetconfDevice(netconfDeviceData);
        await netconfDevice.save();

        migratedDevices.push({
          original_id: device._id,
          new_id: netconfDevice._id,
          name: device.name,
          ip_address: device.ip_address
        });

        console.log(`✅ Successfully migrated: ${device.name} -> ${netconfDevice._id}`);

      } catch (deviceError) {
        console.error(`❌ Error migrating device ${device.name}:`, deviceError.message);
        errors.push({
          device_name: device.name,
          device_id: device._id,
          error: deviceError.message
        });
      }
    }

    // Summary
    console.log('\n📊 Migration Summary:');
    console.log(`✅ Successfully migrated: ${migratedDevices.length} devices`);
    console.log(`❌ Failed migrations: ${errors.length} devices`);

    if (migratedDevices.length > 0) {
      console.log('\n📋 Migrated Devices:');
      migratedDevices.forEach((device, index) => {
        console.log(`   ${index + 1}. ${device.name} (${device.ip_address})`);
      });
    }

    if (errors.length > 0) {
      console.log('\n❌ Migration Errors:');
      errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error.device_name}: ${error.error}`);
      });
    }

    // Ask if user wants to remove migrated devices from original collection
    if (migratedDevices.length > 0) {
      console.log('\n⚠️ IMPORTANT: Migrated devices still exist in the original Device collection.');
      console.log('💡 You may want to:');
      console.log('   1. Disable NETCONF on original devices: db.devices.updateMany({netconf_enabled: true}, {$set: {netconf_enabled: false}})');
      console.log('   2. Or delete the original devices after verifying the migration');
      console.log('   3. Update your frontend to use the new NetconfDevice endpoints');
      
      console.log('\n📝 To disable NETCONF on original devices, run:');
      console.log('   node scripts/disableNetconfOnOriginalDevices.js');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Helper function to map device types
function mapDeviceType(oldType) {
  const typeMapping = {
    'router': 'cisco_ios',
    'switch': 'cisco_ios',
    'nexus': 'cisco_nxos'
  };
  
  return typeMapping[oldType] || 'cisco_ios';
}

// Run migration
migrateNetconfDevices()
  .then(() => {
    console.log('🎉 Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }); 