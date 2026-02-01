# NetConfig Desktop Application

Complete network configuration management system packaged as a desktop application.

## Features

- 🖥️ **Full Desktop Experience** - Native Windows/macOS/Linux application
- 🌐 **Embedded Backend** - No separate server installation needed
- 🔧 **Device Management** - Manage Cisco Nexus and IOS-XE devices
- 📡 **SSH & NETCONF** - Connect via CLI or NETCONF/YANG
- 🤖 **AI Configuration** - Generate configs using LLM (OpenRouter)
- 💾 **Backup Management** - Schedule and manage device backups

## System Requirements

- **Windows**: Windows 10 or later (64-bit)
- **macOS**: macOS 10.14 or later
- **Linux**: Ubuntu 18.04+ or equivalent
- **MongoDB**: MongoDB Atlas account or local MongoDB instance
- **Memory**: 4GB RAM minimum, 8GB recommended

## Installation

### Windows

1. Download `NetConfig-Setup-1.0.0.exe`
2. Run the installer
3. Follow installation wizard
4. Launch from Start Menu or Desktop shortcut

### macOS

1. Download `NetConfig-1.0.0.dmg`
2. Open the DMG file
3. Drag NetConfig to Applications folder
4. Launch from Applications

### Linux

1. Download `NetConfig-1.0.0.AppImage`
2. Make executable: `chmod +x NetConfig-1.0.0.AppImage`
3. Run: `./NetConfig-1.0.0.AppImage`

## First-Time Setup

1. **Launch the application**
2. **Configure MongoDB**:
   - Go to File → Settings
   - Enter your MongoDB connection URI
   - Example: `mongodb+srv://user:pass@cluster.mongodb.net/netconfig`
3. **Optional: Configure OpenRouter**:
   - Add your OpenRouter API key for AI features
4. **Save and restart**

## Development

### Prerequisites

- Node.js 18+
- npm 9+

### Setup

```bash
# Install dependencies
cd desktop
npm install

# Build frontend
cd ../frontend
npm run build
xcopy /E /I /Y dist ..\desktop\frontend-dist

# Run in development mode
cd ../desktop
npm run dev
```

### Build for Distribution

```bash
# Build for Windows
npm run build:win

# Build for macOS
npm run build:mac

# Build for Linux
npm run build:linux
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  NetConfig Desktop                       │
├─────────────────────────────────────────────────────────┤
│                    Electron Shell                        │
│  ┌────────────────────────────────────────────────────┐ │
│  │                  Main Process                       │ │
│  │  • Window Management                                │ │
│  │  • System Tray                                      │ │
│  │  • Backend Process Control                          │ │
│  │  • Settings (electron-store)                        │ │
│  └────────────────────────────────────────────────────┘ │
│                         │                                │
│  ┌──────────────────────┼──────────────────────────────┐│
│  │                      ▼                              ││
│  │  ┌─────────────┐   ┌─────────────────────────────┐ ││
│  │  │   Backend   │   │         Frontend            │ ││
│  │  │  (Node.js)  │◄──│        (React/Vite)         │ ││
│  │  │  Port 3001  │   │    BrowserWindow            │ ││
│  │  └─────────────┘   └─────────────────────────────┘ ││
│  │        │                                           ││
│  │        ▼                                           ││
│  │  ┌─────────────┐                                   ││
│  │  │  MongoDB    │                                   ││
│  │  │  (Atlas)    │                                   ││
│  │  └─────────────┘                                   ││
│  └────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
              │
              ▼
    ┌─────────────────┐
    │ Network Devices │
    │  (SSH/NETCONF)  │
    └─────────────────┘
```

## Configuration Files

| File | Location | Purpose |
|------|----------|---------|
| Settings | `%APPDATA%/netconfig-desktop/config.json` | User settings |
| Logs | `%APPDATA%/netconfig-desktop/logs/` | Application logs |

## Troubleshooting

### Backend won't start

1. Check MongoDB connection string in Settings
2. Verify MongoDB Atlas whitelist includes your IP
3. Check if port 3001 is available

### Connection to devices fails

1. Verify device IP and credentials
2. Check if SSH (22) or NETCONF (830) port is open
3. Ensure device is reachable from your network

### AI features not working

1. Verify OpenRouter API key in Settings
2. Check internet connectivity
3. Ensure API key has sufficient credits

## License

MIT License - See LICENSE file for details
