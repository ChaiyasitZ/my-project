# 🚀 Network Automation with AI

A comprehensive web application for automating Cisco network device configuration using AI-powered generation. This tool allows network engineers to manage Cisco switches and routers through an intuitive web interface with AI-assisted configuration generation.

## ✨ Features

- **🤖 Local AI-Powered Configuration Generation**: Generate Cisco IOS configurations using local Ollama models with natural language prompts
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
- **Database**: MongoDB Atlas cloud database for data persistence
- **AI Integration**: Local Ollama service with configurable models
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
- **configuration_backups**: Store device backup configurations

## 🛠️ Prerequisites

Before running this application, ensure you have:

- **Node.js** (v18+ recommended)
- **MongoDB Atlas Account** (free tier available)
- **Ollama** (for local AI models)
- **Git** for version control

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd my-project
```

### 2. Install and Setup Ollama

**Install Ollama:**

**Windows/macOS:**
- Download and install from https://ollama.com

**Linux:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**Start Ollama and pull a model:**
```bash
# Start Ollama service (runs on http://localhost:11434)
ollama serve

# Pull the main code-specialized model (recommended)
ollama pull codellama:13b

# Or pull alternative models
ollama pull llama3.2:3b    # Lightweight for testing
ollama pull llama3.1:8b    # Balanced performance
```

### 3. Setup MongoDB Atlas Database

1. Create a free MongoDB Atlas account at https://www.mongodb.com/atlas
2. Create a new cluster (free tier M0 is sufficient)
3. Create a database user with read/write permissions
4. Configure network access (allow access from anywhere for development: 0.0.0.0/0)
5. Get your connection string from the "Connect" button

### 4. Configure Backend

Navigate to the backend directory and install dependencies:

```bash
cd backend
npm install
```

Create a `.env` file in the backend directory with your MongoDB connection string:

```bash
# MongoDB Atlas configuration
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/network_automation

# Ollama configuration
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=codellama:13b

# Server configuration
NODE_ENV=development
PORT=5000
```

### 5. Initialize Database Collections

The application will automatically create collections when needed. You can optionally run the initialization script to populate sample data:

```bash
# In the backend directory
npm run init-db
```

This will create:
- 3 sample devices
- 3 configuration templates (Basic Switch Setup, Router OSPF, VLAN Configuration)

### 6. Configure Frontend

Navigate to the frontend directory and install dependencies:

```bash
cd ../frontend
npm install
```

### 7. Start the Application

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
- `GET /api/configurations/ai-status` - Get AI service status and model info
- `POST /api/configurations/generate` - Generate AI configuration
- `POST /api/configurations/apply` - Apply configuration to device
- `GET /api/configurations/history` - Get configuration history
- `GET /api/configurations/:id` - Get specific configuration
- `POST /api/configurations/:id/validate` - Validate configuration

### Backups API
- `GET /api/backups` - List all backups
- `POST /api/backups/:deviceId` - Create device backup
- `GET /api/backups/:deviceId/latest` - Get latest backup for device
- `POST /api/backups/:backupId/restore` - Restore from backup

## 🔒 Security Features

- **Input Validation**: All API inputs are validated using Joi
- **Rate Limiting**: API rate limiting to prevent abuse
- **CORS Protection**: Configured for frontend domain only
- **SSH Security**: Secure SSH connections with timeout handling
- **Password Security**: Passwords not returned in API responses
- **MongoDB Security**: Atlas provides built-in security and encryption

## 🆘 Troubleshooting

### Common Issues

1. **MongoDB Connection Errors**
   - Verify your MongoDB Atlas connection string is correct
   - Check network access settings (allow 0.0.0.0/0 for development)
   - Ensure database user has proper permissions
   - Verify username and password in connection string

2. **"MongoServerError" Connection Issues**
   - Check if your IP address is whitelisted in Atlas
   - Verify the cluster is running and accessible
   - Try connecting using MongoDB Compass to test the connection

3. **SSH Connection Failures**
   - Verify device IP address is reachable
   - Check SSH credentials
   - Ensure SSH is enabled on the device

4. **AI Generation Errors**
   - Ensure Ollama service is running: `ollama serve`
   - Verify the configured model is available: `ollama list`
   - Pull the required model if missing: `ollama pull codellama:13b`
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
- Check MongoDB Atlas logs for database connection issues

## 🎯 Current Status

✅ **Working Features:**
- Complete React frontend with modern UI
- Backend API with all endpoints
- MongoDB Atlas cloud database integration
- Local AI integration with Ollama
- SSH service for device connections
- Device management (CRUD operations)
- Configuration generation and history
- Backup and restore functionality
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