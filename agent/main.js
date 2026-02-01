/**
 * NetConfig Agent - Electron Main Process
 * 
 * Runs in system tray, scans LAN devices, executes SSH/NETCONF commands
 */

const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, dialog } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { NetworkScanner } = require('./src/scanner');
const { SSHService } = require('./src/sshService');
const { NetconfService } = require('./src/netconfService');
const { WebSocketClient } = require('./src/websocketClient');

// Initialize store for settings
const store = new Store({
  defaults: {
    serverUrl: 'http://localhost:5000',
    autoStart: true,
    scanOnStartup: false,
    scanRange: '192.168.1.1-254'
  }
});

let mainWindow = null;
let tray = null;
let wsClient = null;
let isQuitting = false;

// Services
const scanner = new NetworkScanner();
const sshService = new SSHService();
const netconfService = new NetconfService();

/**
 * Create the main application window
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Show when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Hide instead of close
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

/**
 * Create system tray icon
 */
function createTray() {
  // Create a simple tray icon (green circle for connected)
  const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
  
  // If icon doesn't exist, create a default one
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) {
      trayIcon = createDefaultIcon();
    }
  } catch {
    trayIcon = createDefaultIcon();
  }

  tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));
  tray.setToolTip('NetConfig Agent - Click to open');

  updateTrayMenu('disconnected');

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
      }
    }
  });
}

/**
 * Create a default tray icon
 */
function createDefaultIcon() {
  // Create a simple 16x16 icon
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);
  
  // Fill with green color (RGBA)
  for (let i = 0; i < size * size; i++) {
    canvas[i * 4] = 76;      // R
    canvas[i * 4 + 1] = 175; // G
    canvas[i * 4 + 2] = 80;  // B
    canvas[i * 4 + 3] = 255; // A
  }
  
  return nativeImage.createFromBuffer(canvas, { width: size, height: size });
}

/**
 * Update tray menu based on connection status
 */
function updateTrayMenu(status) {
  const statusText = status === 'connected' ? '🟢 Connected' : '🔴 Disconnected';
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'NetConfig Agent', type: 'normal', enabled: false },
    { type: 'separator' },
    { label: statusText, type: 'normal', enabled: false },
    { type: 'separator' },
    { 
      label: 'Open Dashboard', 
      click: () => {
        if (mainWindow) mainWindow.show();
      }
    },
    { 
      label: 'Scan Network', 
      click: async () => {
        await scanNetwork();
      }
    },
    { type: 'separator' },
    { 
      label: 'Settings', 
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.webContents.send('navigate', 'settings');
        }
      }
    },
    { type: 'separator' },
    { 
      label: 'Quit', 
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

/**
 * Scan the network for devices
 */
async function scanNetwork() {
  const scanRange = store.get('scanRange');
  console.log(`Scanning network: ${scanRange}`);
  
  if (mainWindow) {
    mainWindow.webContents.send('scan-started');
  }

  try {
    const devices = await scanner.scan(scanRange);
    console.log(`Found ${devices.length} devices`);
    
    if (mainWindow) {
      mainWindow.webContents.send('scan-completed', devices);
    }

    // Send to server if connected
    if (wsClient && wsClient.isConnected()) {
      wsClient.send('devices-discovered', devices);
    }

    return devices;
  } catch (error) {
    console.error('Scan error:', error);
    if (mainWindow) {
      mainWindow.webContents.send('scan-error', error.message);
    }
    return [];
  }
}

/**
 * Connect to WebSocket server
 */
function connectToServer() {
  const serverUrl = store.get('serverUrl');
  
  wsClient = new WebSocketClient(serverUrl);
  
  wsClient.on('connected', () => {
    console.log('Connected to server');
    updateTrayMenu('connected');
    if (mainWindow) {
      mainWindow.webContents.send('server-status', 'connected');
    }
  });

  wsClient.on('disconnected', () => {
    console.log('Disconnected from server');
    updateTrayMenu('disconnected');
    if (mainWindow) {
      mainWindow.webContents.send('server-status', 'disconnected');
    }
  });

  wsClient.on('command', async (data) => {
    await handleServerCommand(data);
  });

  wsClient.connect();
}

/**
 * Handle commands from server
 */
async function handleServerCommand(data) {
  console.log('Received command:', data.type);

  try {
    switch (data.type) {
      case 'scan-network':
        const devices = await scanNetwork();
        wsClient.send('scan-result', { devices });
        break;

      case 'ssh-execute':
        const sshResult = await sshService.execute(data.device, data.commands);
        wsClient.send('ssh-result', { requestId: data.requestId, result: sshResult });
        break;

      case 'netconf-get':
        const getResult = await netconfService.get(data.device, data.filter);
        wsClient.send('netconf-result', { requestId: data.requestId, result: getResult });
        break;

      case 'netconf-edit':
        const editResult = await netconfService.editConfig(data.device, data.config);
        wsClient.send('netconf-result', { requestId: data.requestId, result: editResult });
        break;

      default:
        console.log('Unknown command:', data.type);
    }
  } catch (error) {
    console.error('Command error:', error);
    wsClient.send('command-error', { 
      requestId: data.requestId, 
      error: error.message 
    });
  }
}

// IPC Handlers
ipcMain.handle('get-settings', () => {
  return store.store;
});

ipcMain.handle('save-settings', (event, settings) => {
  Object.entries(settings).forEach(([key, value]) => {
    store.set(key, value);
  });
  
  // Reconnect if server URL changed
  if (settings.serverUrl && wsClient) {
    wsClient.disconnect();
    connectToServer();
  }
  
  return true;
});

ipcMain.handle('scan-network', async () => {
  return await scanNetwork();
});

ipcMain.handle('test-ssh', async (event, device) => {
  try {
    const result = await sshService.testConnection(device);
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('test-netconf', async (event, device) => {
  try {
    const result = await netconfService.testConnection(device);
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('execute-ssh', async (event, device, commands) => {
  try {
    const result = await sshService.execute(device, commands);
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('execute-netconf', async (event, device, config) => {
  try {
    const result = await netconfService.editConfig(device, config);
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-server-status', () => {
  return wsClient ? wsClient.isConnected() : false;
});

// App lifecycle
app.whenReady().then(() => {
  createWindow();
  createTray();
  
  // Connect to server after startup
  setTimeout(() => {
    connectToServer();
  }, 2000);

  // Scan on startup if enabled
  if (store.get('scanOnStartup')) {
    setTimeout(() => {
      scanNetwork();
    }, 5000);
  }
});

app.on('window-all-closed', () => {
  // Don't quit on macOS
  if (process.platform !== 'darwin') {
    // Keep running in tray
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  if (wsClient) {
    wsClient.disconnect();
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  // Don't show dialog for connection errors
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    console.log('Connection error (server may be offline):', error.message);
    return;
  }
  console.error('Uncaught exception:', error);
  dialog.showErrorBox('Error', error.message);
});
