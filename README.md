# 🚀 Network Automation with AI

A comprehensive web application for automating Cisco network device configuration using AI-powered generation. This tool allows network engineers to manage Cisco switches and routers through an intuitive web interface with AI-assisted configuration generation.

## ✨ Features

- **🤖 AI-Powered Configuration Generation**: Generate Cisco IOS configurations using natural language prompts
- **📱 Modern Web Interface**: Clean, responsive React frontend with Tailwind CSS
- **🔐 SSH Device Management**: Secure SSH connections to Cisco devices
- **📊 Real-time Dashboard**: Monitor devices and configuration status
- **📝 Configuration History**: Track all generated and applied configurations
- **✅ Configuration Validation**: AI-powered syntax validation
- **🔄 Live Configuration Deployment**: Apply configurations directly to devices
- **🎯 Device Templates**: Pre-built configuration templates for common tasks

## 🏗️ Architecture

### Backend (Node.js + Express)
- **API Server**: RESTful API with Express.js
- **Database**: PostgreSQL for data persistence
- **AI Integration**: OpenRouter API with Llama 3.3 70B model
- **SSH Client**: SSH2 library for device connections
- **Security**: Rate limiting, CORS, input validation

### Frontend (React + Vite)
- **UI Framework**: React 18 with Vite for fast development
- **Styling**: Tailwind CSS for modern design
- **Icons**: Lucide React for consistent iconography
- **Routing**: React Router for navigation
- **API Client**: Axios for HTTP requests

### Database Schema
- **devices**: Store Cisco device information
- **configuration_history**: Track AI-generated configurations
- **configuration_templates**: Pre-built configuration templates

## 🛠️ Prerequisites

Before running this application, ensure you have:

- **Node.js** (v18+ recommended)
- **PostgreSQL** (v12+ recommended)
- **Git** for version control

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd my-project
```

### 2. Setup PostgreSQL Database

Make sure PostgreSQL is running and create the database:

```sql
-- Connect to PostgreSQL as postgres user
CREATE DATABASE network_automation;
```

### 3. Configure Backend

Navigate to the backend directory and install dependencies:

```bash
cd backend
npm install
```

The configuration is already set up in `backend/config/config.js` with these defaults:
- Database: `network_automation`
- User: `postgres`
- Password: `admin`
- OpenRouter API Key: Already configured

### 4. Initialize Database Tables

Since the database tables are required, run this manual setup:

```bash
# In the backend directory
node -e "
import pg from 'pg';
const client = new pg.Client({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'admin',
  database: 'network_automation'
});
await client.connect();
await client.query(\`
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
  );
  CREATE TABLE IF NOT EXISTS configuration_history (
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
  CREATE TABLE IF NOT EXISTS configuration_templates (
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
\`);
await client.end();
console.log('Database tables created successfully!');
"
```

### 5. Configure Frontend

Navigate to the frontend directory and install dependencies:

```bash
cd ../frontend
npm install
```

### 6. Start the Application

Start the backend server (in one terminal):

```bash
# In the backend directory
npm run dev
```

Start the frontend development server (in another terminal):

```bash
# In the frontend directory
npm run dev
```

The application will be available at:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000

## 📖 Usage Guide

### 1. Add Network Devices

1. Navigate to the **Devices** page
2. Click **"Add Device"**
3. Fill in device information:
   - Name (e.g., "Core Switch 1")
   - Type (Switch or Router)
   - IP Address
   - SSH credentials
   - Optional: Location, Model, IOS Version

### 2. Test Device Connectivity

- Use the **Test Connection** button to verify SSH access
- Ensure the device is reachable and credentials are correct

### 3. Generate AI Configurations

1. Go to the **Configurations** page
2. Select a target device
3. Enter a natural language prompt describing what you want to configure

**Example Prompts:**
```
- "Create VLAN 100 named 'Sales' with IP 192.168.100.1/24"
- "Configure interface GigabitEthernet0/1 as trunk port"
- "Set up OSPF routing with area 0 for network 192.168.1.0/24"
```

### 4. Review and Apply Configurations

1. Review the AI-generated configuration
2. Use **"Validate"** to check for syntax errors
3. Click **"Apply"** to deploy to the device
4. Monitor results in the **History** page

## 🔧 API Endpoints

### Devices API
- `GET /api/devices` - List all devices
- `POST /api/devices` - Create new device
- `PUT /api/devices/:id` - Update device
- `DELETE /api/devices/:id` - Delete device
- `POST /api/devices/:id/test` - Test SSH connection

### Configurations API
- `POST /api/configurations/generate` - Generate AI configuration
- `POST /api/configurations/apply` - Apply configuration to device
- `GET /api/configurations/history` - Get configuration history
- `GET /api/configurations/:id` - Get specific configuration
- `POST /api/configurations/:id/validate` - Validate configuration

## 🔒 Security Features

- **Input Validation**: All API inputs are validated using Joi
- **Rate Limiting**: API rate limiting to prevent abuse
- **CORS Protection**: Configured for frontend domain only
- **SSH Security**: Secure SSH connections with timeout handling
- **Password Security**: Passwords not returned in API responses

## 🆘 Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Verify PostgreSQL is running
   - Check database credentials in `backend/config/config.js`
   - Ensure database exists and user has permissions

2. **"relation 'devices' does not exist" Error**
   - Run the manual database table creation script above
   - Verify tables were created with: `psql -U postgres -d network_automation -c "\dt"`

3. **SSH Connection Failures**
   - Verify device IP address is reachable
   - Check SSH credentials
   - Ensure SSH is enabled on the device

4. **AI Generation Errors**
   - Verify OpenRouter API key is valid
   - Check internet connectivity
   - Try simpler prompts if complex ones fail

5. **Frontend Connection Issues**
   - Ensure backend is running on port 5000
   - Check CORS configuration
   - Verify API base URL in frontend

### Getting Help

- Check the browser console for JavaScript errors
- Review backend logs for API errors
- Ensure all dependencies are installed correctly
- Verify environment variables are set properly

## 🎯 Current Status

✅ **Working Features:**
- Complete React frontend with modern UI
- Backend API with all endpoints
- Database schema and connection
- AI integration with OpenRouter
- SSH service for device connections
- Device management (CRUD operations)
- Configuration generation and history
- Real-time dashboard

## 🎯 Future Enhancements

- Multi-vendor device support (Juniper, Arista)
- Configuration rollback functionality
- Scheduled configuration deployment
- Advanced configuration templates
- User authentication and role-based access
- Configuration compliance checking
- Network topology visualization

---

**Built with ❤️ for Network Engineers** 