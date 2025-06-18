import pg from 'pg';
import { config } from '../config/config.js';

const { Client } = pg;

const createDatabase = async () => {
  console.log('🔗 Connecting to PostgreSQL...');
  // First connect to postgres to create the database
  const client = new Client({
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
    database: 'postgres', // Connect to default postgres database
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL');
    
    // Check if database exists
    console.log(`🔍 Checking if database '${config.database.name}' exists...`);
    const dbExists = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [config.database.name]
    );

    if (dbExists.rows.length === 0) {
      console.log(`📝 Creating database '${config.database.name}'...`);
      await client.query(`CREATE DATABASE ${config.database.name}`);
      console.log(`✅ Database '${config.database.name}' created successfully`);
    } else {
      console.log(`✅ Database '${config.database.name}' already exists`);
    }
  } catch (error) {
    console.error('❌ Error creating database:', error.message);
    throw error;
  } finally {
    await client.end();
  }
};

const createTables = async () => {
  console.log(`🔗 Connecting to database '${config.database.name}'...`);
  const client = new Client({
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
    database: config.database.name,
  });

  try {
    await client.connect();
    console.log(`✅ Connected to database '${config.database.name}'`);

    // Create devices table
    console.log('📝 Creating devices table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS devices (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL CHECK (type IN ('switch', 'router')),
        ip_address INET NOT NULL UNIQUE,
        ssh_port INTEGER DEFAULT 22,
        username VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL,
        description TEXT,
        location VARCHAR(255),
        model VARCHAR(255),
        ios_version VARCHAR(255),
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Devices table created');

    // Create configuration_history table
    console.log('📝 Creating configuration_history table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS configuration_history (
        id SERIAL PRIMARY KEY,
        device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,
        prompt TEXT NOT NULL,
        generated_config TEXT NOT NULL,
        applied_config TEXT,
        status VARCHAR(20) DEFAULT 'generated' CHECK (status IN ('generated', 'applied', 'failed', 'rolled_back')),
        ai_model VARCHAR(255),
        execution_time INTEGER, -- in milliseconds
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        applied_at TIMESTAMP WITH TIME ZONE
      )
    `);
    console.log('✅ Configuration_history table created');

    // Create configuration_templates table
    console.log('📝 Creating configuration_templates table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS configuration_templates (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        device_type VARCHAR(50) NOT NULL CHECK (device_type IN ('switch', 'router', 'both')),
        template_config TEXT NOT NULL,
        variables JSONB, -- Store template variables as JSON
        category VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Configuration_templates table created');

    // Create indexes for better performance
    console.log('📝 Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_devices_type ON devices(type);
      CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
      CREATE INDEX IF NOT EXISTS idx_config_history_device_id ON configuration_history(device_id);
      CREATE INDEX IF NOT EXISTS idx_config_history_status ON configuration_history(status);
      CREATE INDEX IF NOT EXISTS idx_config_templates_device_type ON configuration_templates(device_type);
    `);
    console.log('✅ Database indexes created');

    // Insert sample data
    console.log('📝 Inserting sample configuration templates...');
    await client.query(`
      INSERT INTO configuration_templates (name, description, device_type, template_config, variables, category)
      VALUES 
      ('Basic VLAN Configuration', 'Create and configure VLANs on switches', 'switch', 
       'vlan {vlan_id}\n name {vlan_name}\n exit\ninterface vlan{vlan_id}\n ip address {ip_address} {subnet_mask}\n no shutdown\n exit', 
       '{"vlan_id": "number", "vlan_name": "string", "ip_address": "ip", "subnet_mask": "mask"}',
       'VLAN'),
      ('Interface Configuration', 'Configure switch/router interfaces', 'both',
       'interface {interface_name}\n description {description}\n ip address {ip_address} {subnet_mask}\n no shutdown\n exit',
       '{"interface_name": "string", "description": "string", "ip_address": "ip", "subnet_mask": "mask"}',
       'Interface'),
      ('OSPF Routing', 'Configure OSPF routing protocol', 'router',
       'router ospf {process_id}\n network {network} {wildcard_mask} area {area_id}\n exit',
       '{"process_id": "number", "network": "ip", "wildcard_mask": "mask", "area_id": "number"}',
       'Routing')
      ON CONFLICT DO NOTHING
    `);

    console.log('✅ Database tables created successfully');
    console.log('✅ Sample configuration templates inserted');

  } catch (error) {
    console.error('❌ Error creating tables:', error.message);
    throw error;
  } finally {
    await client.end();
  }
};

const initializeDatabase = async () => {
  console.log('🚀 Initializing database...');
  try {
    await createDatabase();
    await createTables();
    console.log('🎉 Database initialization completed!');
  } catch (error) {
    console.error('💥 Database initialization failed:', error.message);
    process.exit(1);
  }
};

// Run initialization if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeDatabase();
} 