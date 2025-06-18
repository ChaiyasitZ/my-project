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
cd network-automation
```

### 2. Setup PostgreSQL Database

Create a PostgreSQL database and user:

```sql
CREATE DATABASE network_automation;
CREATE USER netauto_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE network_automation TO netauto_user;
```

### 3. Configure Backend

Navigate to the backend directory and install dependencies:

```bash
cd backend
npm install
```

Create a `.env` file in the backend directory:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=network_automation
DB_USER=netauto_user
DB_PASSWORD=your_secure_password

# OpenRouter AI Configuration (Already included)
OPENROUTER_API_KEY=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
OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct:free

# Server Configuration
PORT=5000
JWT_SECRET=your_jwt_secret_key_here
NODE_ENV=development

# CORS Configuration
FRONTEND_URL=http://localhost:5173
```

Initialize the database:

```bash
npm run init-db
```

### 4. Configure Frontend

Navigate to the frontend directory and install dependencies:

```bash
cd ../frontend
npm install
```

### 5. Start the Application

Start the backend server:

```bash
# In the backend directory
npm run dev
```

Start the frontend development server:

```bash
# In the frontend directory (new terminal)
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

## 🛠️ Development

### Backend Development

```bash
cd backend
npm run dev  # Starts with nodemon for auto-reload
```

### Frontend Development

```bash
cd frontend
npm run dev  # Starts Vite dev server with HMR
```

### Database Management

```bash
# Reset database
cd backend
npm run init-db

# View database logs in PostgreSQL
psql -U netauto_user -d network_automation
```

## 📊 Project Structure

```
network-automation/
├── backend/                 # Node.js Express API
│   ├── config/             # Configuration files
│   │   ├── lib/                # Database connection
│   │   ├── routes/             # API route handlers
│   │   ├── services/           # Business logic (AI, SSH)
│   │   ├── scripts/            # Database initialization
│   │   └── server.js           # Main server file
│   └── README.md               # This file
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Verify PostgreSQL is running
   - Check database credentials in `.env`
   - Ensure database exists and user has permissions

2. **SSH Connection Failures**
   - Verify device IP address is reachable
   - Check SSH credentials
   - Ensure SSH is enabled on the device

3. **AI Generation Errors**
   - Verify OpenRouter API key is valid
   - Check internet connectivity
   - Try simpler prompts if complex ones fail

4. **Frontend Connection Issues**
   - Ensure backend is running on port 5000
   - Check CORS configuration
   - Verify API base URL in frontend

### Getting Help

- Check the browser console for JavaScript errors
- Review backend logs for API errors
- Ensure all dependencies are installed correctly
- Verify environment variables are set properly

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