import pg from 'pg';
import { config } from '../config/config.js';

const { Client } = pg;

const addSNMPSupport = async () => {
  console.log('🔗 Connecting to database for SNMP migration...');
  const client = new Client({
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
    database: config.database.name,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Check if SNMP columns already exist
    console.log('🔍 Checking if SNMP columns exist...');
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'devices' 
      AND column_name IN ('snmp_community', 'snmp_version', 'snmp_port', 'snmp_enabled')
    `);

    const existingColumns = columnCheck.rows.map(row => row.column_name);
    
    if (existingColumns.length === 0) {
      console.log('📝 Adding SNMP support columns to devices table...');
      
      // Add SNMP fields to devices table
      await client.query(`
        ALTER TABLE devices 
        ADD COLUMN snmp_community VARCHAR(255) DEFAULT 'public',
        ADD COLUMN snmp_version INTEGER DEFAULT 0 CHECK (snmp_version IN (0, 1, 2)),
        ADD COLUMN snmp_port INTEGER DEFAULT 161 CHECK (snmp_port > 0 AND snmp_port <= 65535),
        ADD COLUMN snmp_enabled BOOLEAN DEFAULT FALSE
      `);
      
      console.log('✅ SNMP columns added successfully');
      
      // Add comments for documentation
      await client.query(`
        COMMENT ON COLUMN devices.snmp_community IS 'SNMP community string (default: public)';
        COMMENT ON COLUMN devices.snmp_version IS 'SNMP version: 0=v1, 1=v2c, 2=v3 (default: 0)';
        COMMENT ON COLUMN devices.snmp_port IS 'SNMP port number (default: 161)';
        COMMENT ON COLUMN devices.snmp_enabled IS 'Whether SNMP monitoring is enabled for this device';
      `);
      
      console.log('✅ Column comments added');
      
      // Create index for SNMP enabled devices
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_devices_snmp_enabled ON devices(snmp_enabled) WHERE snmp_enabled = TRUE;
      `);
      
      console.log('✅ SNMP index created');
      
    } else {
      console.log(`⚠️  Some SNMP columns already exist: ${existingColumns.join(', ')}`);
      
      // Add missing columns if needed
      const columnsToAdd = ['snmp_community', 'snmp_version', 'snmp_port', 'snmp_enabled']
        .filter(col => !existingColumns.includes(col));
      
      if (columnsToAdd.length > 0) {
        console.log(`📝 Adding missing SNMP columns: ${columnsToAdd.join(', ')}`);
        
        for (const column of columnsToAdd) {
          let columnDef = '';
          switch (column) {
            case 'snmp_community':
              columnDef = "VARCHAR(255) DEFAULT 'public'";
              break;
            case 'snmp_version':
              columnDef = 'INTEGER DEFAULT 0 CHECK (snmp_version IN (0, 1, 2))';
              break;
            case 'snmp_port':
              columnDef = 'INTEGER DEFAULT 161 CHECK (snmp_port > 0 AND snmp_port <= 65535)';
              break;
            case 'snmp_enabled':
              columnDef = 'BOOLEAN DEFAULT FALSE';
              break;
          }
          
          await client.query(`ALTER TABLE devices ADD COLUMN ${column} ${columnDef}`);
          console.log(`✅ Added column: ${column}`);
        }
      }
    }

    // Create SNMP monitoring log table
    console.log('📝 Creating SNMP monitoring log table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS snmp_monitoring_logs (
        id SERIAL PRIMARY KEY,
        device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,
        monitoring_type VARCHAR(50) NOT NULL CHECK (monitoring_type IN ('interface_status', 'system_info', 'interface_ips', 'custom_oid')),
        oid VARCHAR(255),
        result JSONB NOT NULL,
        success BOOLEAN NOT NULL,
        error_message TEXT,
        response_time INTEGER, -- in milliseconds
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ SNMP monitoring log table created');

    // Create indexes for SNMP monitoring logs
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_snmp_logs_device_id ON snmp_monitoring_logs(device_id);
      CREATE INDEX IF NOT EXISTS idx_snmp_logs_type ON snmp_monitoring_logs(monitoring_type);
      CREATE INDEX IF NOT EXISTS idx_snmp_logs_created_at ON snmp_monitoring_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_snmp_logs_success ON snmp_monitoring_logs(success);
    `);
    console.log('✅ SNMP monitoring log indexes created');

    // Update existing devices to enable SNMP if they're active
    console.log('📝 Enabling SNMP for active devices...');
    const updateResult = await client.query(`
      UPDATE devices 
      SET snmp_enabled = TRUE 
      WHERE status = 'active' AND snmp_enabled IS NULL
    `);
    console.log(`✅ Updated ${updateResult.rowCount} devices to enable SNMP`);

    console.log('🎉 SNMP support migration completed successfully!');
    console.log('');
    console.log('📋 SNMP Features Added:');
    console.log('  • SNMP community string support');
    console.log('  • SNMP version selection (v1, v2c, v3)');
    console.log('  • Custom SNMP port configuration');
    console.log('  • SNMP enable/disable per device');
    console.log('  • SNMP monitoring logs table');
    console.log('  • Performance indexes for SNMP operations');
    console.log('');
    console.log('🔧 Available SNMP APIs:');
    console.log('  • POST /api/snmp/devices/:id/test - Test SNMP connection');
    console.log('  • GET /api/snmp/devices/:id/system - Get system information');
    console.log('  • GET /api/snmp/devices/:id/interfaces - Get interface status');
    console.log('  • GET /api/snmp/devices/:id/ips - Get interface IP addresses');
    console.log('  • GET /api/snmp/devices/:id/complete - Get complete monitoring data');
    console.log('  • GET /api/snmp/devices/:id/oid/:oid - Get specific OID value');
    console.log('  • POST /api/snmp/devices/:id/walk - Walk OID tree');
    console.log('  • GET /api/snmp/oids - Get OID reference');

  } catch (error) {
    console.error('❌ Error adding SNMP support:', error.message);
    throw error;
  } finally {
    await client.end();
  }
};

// Run migration if this file is executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                     import.meta.url.endsWith(process.argv[1]) ||
                     process.argv[1].endsWith('addSNMPSupport.js');

if (isMainModule) {
  addSNMPSupport().catch(error => {
    console.error('💥 SNMP migration failed:', error.message);
    process.exit(1);
  });
}

export default addSNMPSupport; 