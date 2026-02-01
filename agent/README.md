# NetConfig Agent

Local agent application for network device scanning and configuration via SSH/NETCONF.

## Features

- 🔍 **LAN Scanner** - Discover network devices on your local network
- 🔌 **SSH Client** - Execute CLI commands on Cisco devices
- 📡 **NETCONF Client** - Configure devices using NETCONF/YANG
- 🔗 **Server Connection** - Connect to NetConfig web backend
- 🖥️ **System Tray** - Runs in background with status indicator

## Requirements

- Windows 10/11, macOS 10.14+, or Linux
- Node.js 18+ (for development)
- Network access to target devices

## Installation

### From Installer (Recommended)

1. Download the latest installer from Releases
2. Run `NetConfig Agent Setup.exe`
3. Follow the installation wizard
4. Launch from Start Menu or Desktop shortcut

### From Source

```bash
cd agent
npm install
npm start
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for Windows
npm run build:win

# Build for macOS
npm run build:mac

# Build for Linux
npm run build:linux
```

## Configuration

### Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Server URL | Backend server address | `http://localhost:5000` |
| Scan Range | IP range to scan | `192.168.1.1-254` |
| Scan on Startup | Auto-scan when agent starts | `false` |
| Auto Start | Start with Windows | `false` |

### Supported Devices

- Cisco Nexus (NX-OS) - SSH & NETCONF
- Cisco IOS-XE - SSH & NETCONF
- Other SSH-enabled devices - SSH only

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    NetConfig Agent                       │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   Scanner   │  │ SSH Service │  │  NETCONF    │     │
│  │  (TCP/IP)   │  │   (ssh2)    │  │  Service    │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│         │                │                │              │
│         └────────────────┼────────────────┘              │
│                          │                               │
│                 ┌────────▼────────┐                     │
│                 │ WebSocket Client│                     │
│                 └────────┬────────┘                     │
└──────────────────────────┼──────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │   Backend   │
                    │  (Vercel)   │
                    └─────────────┘
```

## Troubleshooting

### Agent won't connect to server

1. Check if server URL is correct in Settings
2. Ensure backend server is running
3. Check firewall settings

### Device scan shows no results

1. Verify IP range is correct
2. Check if devices are powered on
3. Ensure agent has network access

### SSH/NETCONF connection fails

1. Verify device credentials
2. Check if SSH (port 22) or NETCONF (port 830) is enabled on device
3. Test connectivity with ping

## License

MIT
