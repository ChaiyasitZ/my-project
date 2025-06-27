-- =============================================
-- Network Management System Database Schema
-- PostgreSQL Database Schema
-- =============================================

-- Drop existing tables if they exist (in reverse order due to foreign keys)
DROP TABLE IF EXISTS configuration_backups CASCADE;
DROP TABLE IF EXISTS configuration_history CASCADE;
DROP TABLE IF EXISTS configuration_templates CASCADE;
DROP TABLE IF EXISTS devices CASCADE;
-- Drop existing types if they exist
DROP TYPE IF EXISTS device_status_enum CASCADE;
DROP TYPE IF EXISTS config_status_enum CASCADE;
DROP TYPE IF EXISTS backup_type_enum CASCADE;

-- Create custom ENUM types for better data integrity
CREATE TYPE device_status_enum AS ENUM ('active', 'inactive', 'maintenance', 'error');
CREATE TYPE config_status_enum AS ENUM ('generated', 'applied', 'failed', 'rolled_back');
CREATE TYPE backup_type_enum AS ENUM ('manual', 'scheduled', 'pre_change', 'post_change');

-- =============================================
-- Table: devices
-- Purpose: Store network device information
-- =============================================
CREATE TABLE devices (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    type VARCHAR(50) NOT NULL,
    ip_address INET NOT NULL UNIQUE,
    ssh_port INTEGER DEFAULT 22 CHECK (ssh_port > 0 AND ssh_port <= 65535),
    username VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    description TEXT,
    location VARCHAR(255),
    model VARCHAR(255),
    ios_version VARCHAR(255),
    status device_status_enum DEFAULT 'inactive',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- Table: configuration_templates
-- Purpose: Store reusable configuration templates
-- =============================================
CREATE TABLE configuration_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    device_type VARCHAR(50) NOT NULL,
    template_config TEXT NOT NULL,
    variables JSONB DEFAULT '{}',
    category VARCHAR(100) DEFAULT 'general',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- Table: configuration_history
-- Purpose: Track AI-generated configurations and their application
-- =============================================
CREATE TABLE configuration_history (
    id SERIAL PRIMARY KEY,
    device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    generated_config TEXT,
    applied_config TEXT,
    status config_status_enum DEFAULT 'generated',
    ai_model VARCHAR(255) DEFAULT 'ollama',
    execution_time INTEGER, -- in milliseconds
    error_message TEXT,
    rag_enhanced BOOLEAN DEFAULT FALSE,
    rag_metadata JSONB,
    knowledge_sources TEXT[],
    accuracy_score DECIMAL(3,2),
    confidence_score DECIMAL(3,2),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    applied_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT chk_prompt_length CHECK (LENGTH(prompt) >= 10),
    CONSTRAINT chk_execution_time CHECK (execution_time IS NULL OR execution_time >= 0)
);

-- =============================================
-- Table: configuration_backups
-- Purpose: Store device configuration backups
-- =============================================
CREATE TABLE configuration_backups (
    id SERIAL PRIMARY KEY,
    device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    backup_name VARCHAR(255) NOT NULL,
    description TEXT,
    running_config TEXT,
    startup_config TEXT,
    backup_type backup_type_enum DEFAULT 'manual',
    file_size INTEGER, -- in bytes
    config_hash VARCHAR(64), -- SHA-256 hash for integrity
    created_by VARCHAR(255) NOT NULL,
    is_restored_point BOOLEAN DEFAULT false,
    tags JSONB DEFAULT '[]',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT chk_file_size CHECK (file_size IS NULL OR file_size >= 0),
    CONSTRAINT chk_config_content CHECK (running_config IS NOT NULL OR startup_config IS NOT NULL),
    CONSTRAINT uq_device_backup_name UNIQUE (device_id, backup_name)
);

-- =============================================
-- Create Indexes for Performance Optimization
-- =============================================

-- Devices table indexes
CREATE INDEX idx_devices_status ON devices(status);
CREATE INDEX idx_devices_type ON devices(type);
CREATE INDEX idx_devices_ip_address ON devices(ip_address);

-- Configuration history indexes
CREATE INDEX idx_config_history_device_id ON configuration_history(device_id);
CREATE INDEX idx_config_history_status ON configuration_history(status);
CREATE INDEX idx_config_history_created_at ON configuration_history(created_at DESC);
CREATE INDEX idx_config_history_device_status ON configuration_history(device_id, status);
CREATE INDEX idx_config_history_rag_enhanced ON configuration_history(rag_enhanced);
CREATE INDEX idx_config_history_accuracy ON configuration_history(accuracy_score DESC);
CREATE INDEX idx_config_history_device_type ON configuration_history(device_id);

-- Configuration backups indexes
CREATE INDEX idx_config_backups_device_id ON configuration_backups(device_id);
CREATE INDEX idx_config_backups_created_at ON configuration_backups(created_at DESC);
CREATE INDEX idx_config_backups_backup_type ON configuration_backups(backup_type);
CREATE INDEX idx_config_backups_restored_point ON configuration_backups(is_restored_point);
CREATE INDEX idx_config_backups_tags ON configuration_backups USING GIN(tags);

-- Configuration templates indexes
CREATE INDEX idx_config_templates_device_type ON configuration_templates(device_type);
CREATE INDEX idx_config_templates_category ON configuration_templates(category);


-- =============================================
-- Create Functions and Triggers
-- =============================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updating updated_at timestamps
CREATE TRIGGER update_devices_updated_at 
    BEFORE UPDATE ON devices 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_config_templates_updated_at 
    BEFORE UPDATE ON configuration_templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically set applied_at when status changes to 'applied'
CREATE OR REPLACE FUNCTION set_applied_at_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'applied' AND OLD.status != 'applied' THEN
        NEW.applied_at = CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for setting applied_at timestamp
CREATE TRIGGER set_config_applied_at 
    BEFORE UPDATE ON configuration_history 
    FOR EACH ROW EXECUTE FUNCTION set_applied_at_on_status_change();

-- =============================================
-- Insert Sample Data for Testing
-- =============================================

-- Sample configuration templates
INSERT INTO configuration_templates (name, description, device_type, template_config, variables, category) VALUES
('Basic SSH Setup', 'Basic SSH configuration for Cisco devices', 'router', 
'hostname {{hostname}}
username {{username}} privilege 15 secret {{password}}
ip domain-name {{domain}}
crypto key generate rsa modulus 2048
ssh version 2
line vty 0 4
 transport input ssh
 login local
end', 
'{"hostname": "", "username": "admin", "password": "", "domain": "local"}', 
'security'),

('Interface Configuration', 'Basic interface configuration template', 'switch', 
'interface {{interface}}
 description {{description}}
 ip address {{ip_address}} {{subnet_mask}}
 no shutdown
end', 
'{"interface": "GigabitEthernet0/1", "description": "", "ip_address": "", "subnet_mask": "255.255.255.0"}', 
'interface'),

('VLAN Configuration', 'VLAN setup template for switches', 'switch',
'vlan {{vlan_id}}
 name {{vlan_name}}
interface {{interface}}
 switchport mode access
 switchport access vlan {{vlan_id}}
end',
'{"vlan_id": "", "vlan_name": "", "interface": "FastEthernet0/1"}',
'vlan');

-- Sample device (for testing purposes only - use secure passwords in production)
INSERT INTO devices (name, type, ip_address, username, password, description, location, status) VALUES
('Router-01', 'router', '192.168.1.1', 'admin', 'changeme', 'Main office router', 'Main Office', 'active'),
('Switch-01', 'switch', '192.168.1.2', 'admin', 'changeme', 'Core switch', 'Server Room', 'active'),
('Firewall-01', 'firewall', '192.168.1.3', 'admin', 'changeme', 'Perimeter firewall', 'DMZ', 'maintenance');

-- =============================================
-- Create Views for Common Queries
-- =============================================

-- View for device summary with latest backup info
CREATE VIEW device_summary AS
SELECT 
    d.id,
    d.name,
    d.type,
    d.ip_address,
    d.status,
    d.location,
    d.created_at,
    latest_backup.backup_count,
    latest_backup.latest_backup_date,
    config_count.total_configs,
    config_count.applied_configs
FROM devices d
LEFT JOIN (
    SELECT 
        device_id,
        COUNT(*) as backup_count,
        MAX(created_at) as latest_backup_date
    FROM configuration_backups 
    GROUP BY device_id
) latest_backup ON d.id = latest_backup.device_id
LEFT JOIN (
    SELECT 
        device_id,
        COUNT(*) as total_configs,
        COUNT(CASE WHEN status = 'applied' THEN 1 END) as applied_configs
    FROM configuration_history 
    GROUP BY device_id
) config_count ON d.id = config_count.device_id;

-- View for recent configuration activity
CREATE VIEW recent_config_activity AS
SELECT 
    ch.id,
    d.name as device_name,
    d.type as device_type,
    ch.prompt,
    ch.status,
    ch.ai_model,
    ch.execution_time,
    ch.created_at,
    ch.applied_at
FROM configuration_history ch
JOIN devices d ON ch.device_id = d.id
ORDER BY ch.created_at DESC;

-- =============================================
-- Grant Permissions (Adjust as needed for your application user)
-- =============================================

-- Create application user (uncomment and modify as needed)
-- CREATE USER netautomate_app WITH PASSWORD 'your_secure_password_here';
-- GRANT CONNECT ON DATABASE your_database_name TO netautomate_app;
-- GRANT USAGE ON SCHEMA public TO netautomate_app;
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO netautomate_app;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO netautomate_app;

-- =============================================
-- Comments for Documentation
-- =============================================

COMMENT ON TABLE devices IS 'Network devices managed by the system';
COMMENT ON TABLE configuration_history IS 'AI-generated configuration history and application tracking';
COMMENT ON TABLE configuration_backups IS 'Device configuration backups with versioning';
COMMENT ON TABLE configuration_templates IS 'Reusable configuration templates with variables';

COMMENT ON COLUMN configuration_history.execution_time IS 'AI configuration generation time in milliseconds';
COMMENT ON COLUMN configuration_backups.config_hash IS 'SHA-256 hash for configuration integrity verification';

-- =============================================
-- Database Setup Complete
-- =============================================

-- Display summary
SELECT 'Database schema created successfully!' as status;
SELECT 'Total tables created: ' || count(*) as table_count 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- Create knowledge base tracking table
CREATE TABLE IF NOT EXISTS knowledge_base_entries (
    id SERIAL PRIMARY KEY,
    entry_id VARCHAR(255) UNIQUE NOT NULL,
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(100),
    device_type VARCHAR(50) CHECK (device_type IN ('switch', 'router', 'both')),
    complexity VARCHAR(50) CHECK (complexity IN ('simple', 'moderate', 'complex', 'advanced')),
    keywords TEXT[],
    source VARCHAR(100) DEFAULT 'system',
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    usage_count INTEGER DEFAULT 0,
    last_used TIMESTAMP WITH TIME ZONE
);

-- Create indexes for knowledge base
CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge_base_entries(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_device_type ON knowledge_base_entries(device_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_complexity ON knowledge_base_entries(complexity);
CREATE INDEX IF NOT EXISTS idx_knowledge_keywords ON knowledge_base_entries USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_knowledge_usage ON knowledge_base_entries(usage_count DESC);

-- Create configuration accuracy tracking table
CREATE TABLE IF NOT EXISTS configuration_accuracy (
    id SERIAL PRIMARY KEY,
    configuration_id INTEGER REFERENCES configuration_history(id) ON DELETE CASCADE,
    device_type VARCHAR(50) NOT NULL,
    prompt_complexity VARCHAR(50),
    generation_method VARCHAR(50), -- 'template', 'ai', 'rag'
    accuracy_score DECIMAL(3,2),
    confidence_score DECIMAL(3,2),
    validation_passed BOOLEAN,
    deployment_successful BOOLEAN,
    user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5),
    feedback_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for accuracy tracking
CREATE INDEX IF NOT EXISTS idx_accuracy_method ON configuration_accuracy(generation_method);
CREATE INDEX IF NOT EXISTS idx_accuracy_score ON configuration_accuracy(accuracy_score DESC);
CREATE INDEX IF NOT EXISTS idx_accuracy_device_type ON configuration_accuracy(device_type);

-- Create RAG usage analytics table
CREATE TABLE IF NOT EXISTS rag_analytics (
    id SERIAL PRIMARY KEY,
    prompt_hash VARCHAR(64), -- Hash of prompt for privacy
    device_type VARCHAR(50),
    knowledge_types_used TEXT[],
    knowledge_sources_count INTEGER,
    generation_time_ms INTEGER,
    accuracy_improvement DECIMAL(3,2), -- Improvement over non-RAG
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for RAG analytics
CREATE INDEX IF NOT EXISTS idx_rag_analytics_device_type ON rag_analytics(device_type);
CREATE INDEX IF NOT EXISTS idx_rag_analytics_date ON rag_analytics(created_at);

-- Update trigger to track knowledge base usage
CREATE OR REPLACE FUNCTION update_knowledge_usage()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE knowledge_base_entries 
    SET usage_count = usage_count + 1, 
        last_used = CURRENT_TIMESTAMP
    WHERE entry_id = ANY(NEW.knowledge_sources);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_knowledge_usage
    AFTER INSERT OR UPDATE OF knowledge_sources ON configuration_history
    FOR EACH ROW
    WHEN (NEW.knowledge_sources IS NOT NULL)
    EXECUTE FUNCTION update_knowledge_usage(); 