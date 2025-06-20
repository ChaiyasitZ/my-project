-- Network Automation Database Schema
-- PostgreSQL Tables for AI-Powered Cisco Configuration Management

-- Drop existing tables (if you want to recreate them)
DROP TABLE IF EXISTS configuration_history CASCADE;
DROP TABLE IF EXISTS configuration_templates CASCADE;
DROP TABLE IF EXISTS devices CASCADE;

-- Create devices table
CREATE TABLE devices (
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
    -- SNMP Configuration
    snmp_enabled BOOLEAN DEFAULT true,
    snmp_version VARCHAR(10) DEFAULT '2c' CHECK (snmp_version IN ('1', '2c', '3')),
    snmp_community VARCHAR(255) DEFAULT 'public',
    snmp_port INTEGER DEFAULT 161,
    -- SNMP v3 specific fields
    snmp_username VARCHAR(255),
    snmp_auth_protocol VARCHAR(20) CHECK (snmp_auth_protocol IN ('MD5', 'SHA')),
    snmp_auth_key VARCHAR(255),
    snmp_priv_protocol VARCHAR(20) CHECK (snmp_priv_protocol IN ('DES', 'AES')),
    snmp_priv_key VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create configuration_history table
CREATE TABLE configuration_history (
    id SERIAL PRIMARY KEY,
    device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    generated_config TEXT NOT NULL,
    applied_config TEXT,
    status VARCHAR(20) DEFAULT 'generated' CHECK (status IN ('generated', 'applied', 'failed', 'rolled_back')),
    ai_model VARCHAR(255),
    execution_time INTEGER,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    applied_at TIMESTAMP WITH TIME ZONE
);

-- Create configuration_templates table
CREATE TABLE configuration_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    device_type VARCHAR(50) NOT NULL CHECK (device_type IN ('switch', 'router', 'both')),
    template_config TEXT NOT NULL,
    variables JSONB,
    category VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_devices_type ON devices(type);
CREATE INDEX idx_devices_status ON devices(status);
CREATE INDEX idx_config_history_device_id ON configuration_history(device_id);
CREATE INDEX idx_config_history_status ON configuration_history(status);
CREATE INDEX idx_config_templates_device_type ON configuration_templates(device_type);

-- Insert sample configuration templates
INSERT INTO configuration_templates (name, description, device_type, template_config, variables, category)
VALUES 
('Basic VLAN Configuration', 'Create and configure VLANs on switches', 'switch', 
 'vlan {vlan_id}
 name {vlan_name}
 exit
interface vlan{vlan_id}
 ip address {ip_address} {subnet_mask}
 no shutdown
 exit', 
 '{"vlan_id": "number", "vlan_name": "string", "ip_address": "ip", "subnet_mask": "mask"}',
 'VLAN'),

('Interface Configuration', 'Configure switch/router interfaces', 'both',
 'interface {interface_name}
 description {description}
 ip address {ip_address} {subnet_mask}
 no shutdown
 exit',
 '{"interface_name": "string", "description": "string", "ip_address": "ip", "subnet_mask": "mask"}',
 'Interface'),

('OSPF Routing', 'Configure OSPF routing protocol', 'router',
 'router ospf {process_id}
 network {network} {wildcard_mask} area {area_id}
 exit',
 '{"process_id": "number", "network": "ip", "wildcard_mask": "mask", "area_id": "number"}',
 'Routing'),

-- SNMP Configuration Templates
('Basic SNMP v2c Configuration', 'Configure SNMP v2c with read-only community', 'both',
 'snmp-server community {ro_community} RO
snmp-server community {rw_community} RW
snmp-server location {location}
snmp-server contact {contact}
snmp-server enable traps',
 '{"ro_community": "string", "rw_community": "string", "location": "string", "contact": "string"}',
 'SNMP'),

('SNMP v3 Configuration', 'Configure SNMP v3 with authentication and privacy', 'both',
 'snmp-server group {group_name} v3 priv
snmp-server user {username} {group_name} v3 auth {auth_protocol} {auth_password} priv {priv_protocol} {priv_password}
snmp-server location {location}
snmp-server contact {contact}
snmp-server enable traps',
 '{"group_name": "string", "username": "string", "auth_protocol": "string", "auth_password": "string", "priv_protocol": "string", "priv_password": "string", "location": "string", "contact": "string"}',
 'SNMP'),

('SNMP Monitoring Setup', 'Configure SNMP for comprehensive monitoring', 'both',
 'snmp-server community {community} RO
snmp-server location {location}
snmp-server contact {contact}
snmp-server enable traps snmp authentication linkdown linkup coldstart warmstart
snmp-server enable traps cpu threshold
snmp-server enable traps memory bufferpeak
snmp-server enable traps config
snmp-server enable traps entity
snmp-server enable traps envmon fan shutdown supply temperature',
 '{"community": "string", "location": "string", "contact": "string"}',
 'SNMP');

-- Show created tables
\dt 