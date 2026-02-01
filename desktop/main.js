/**
 * NetConfig Desktop Application
 * Main Electron Process
 * 
 * This packages the full application (backend + frontend) as a desktop app
 */

const { app, BrowserWindow, Menu, Tray, ipcMain, dialog, shell, nativeImage } = require('electron');
const path = require('path');
const { spawn, execSync } = require('child_process');
const Store = require('electron-store');
const fs = require('fs');

// Configuration store
const store = new Store({
  defaults: {
    mongoUri: '',
    port: 3001,
    jwtSecret: 'netconfig-desktop-secret-key',
    openrouterApiKey: '',
    windowBounds: { width: 1400, height: 900 }
  }
});

// Global references
let mainWindow = null;
let tray = null;
let backendProcess = null;
let isQuitting = false;
let backendReady = false;

// Paths
const isDev = process.argv.includes('--dev');
const resourcesPath = isDev 
  ? path.join(__dirname, '..') 
  : process.resourcesPath;
const backendPath = isDev 
  ? path.join(__dirname, '..', 'backend')
  : path.join(resourcesPath, 'backend');
const frontendPath = isDev 
  ? path.join(__dirname, 'frontend-dist')
  : path.join(__dirname, 'frontend-dist');

// Backend port
const BACKEND_PORT = store.get('port');

/**
 * Kill any process using the backend port
 */
function killPort(port) {
  try {
    if (process.platform === 'win32') {
      execSync(`for /f "tokens=5" %a in ('netstat -aon ^| findstr :${port}') do taskkill /f /pid %a`, { stdio: 'ignore', shell: true });
    } else {
      execSync(`lsof -ti:${port} | xargs kill -9`, { stdio: 'ignore' });
    }
  } catch (e) {
    // No process on that port, that's fine
  }
}

/**
 * Create environment variables for backend
 */
function getBackendEnv() {
  return {
    ...process.env,
    PORT: BACKEND_PORT.toString(),
    MONGODB_URI: store.get('mongoUri'),
    JWT_SECRET: store.get('jwtSecret'),
    OPENROUTER_API_KEY: store.get('openrouterApiKey'),
    NODE_ENV: isDev ? 'development' : 'production',
    ELECTRON_RUN: 'true'
  };
}

/**
 * Start the backend server
 */
function startBackend() {
  return new Promise((resolve, reject) => {
    const mongoUri = store.get('mongoUri');
    
    // Don't start if MongoDB URI not configured
    if (!mongoUri) {
      console.log('MongoDB URI not configured - skipping backend start');
      resolve();
      return;
    }
    
    console.log('Starting backend server...');
    console.log('Backend path:', backendPath);

    const serverPath = path.join(backendPath, 'server.js');
    
    if (!fs.existsSync(serverPath)) {
      console.error('Server file not found:', serverPath);
      reject(new Error('Backend server.js not found'));
      return;
    }

    // Kill any existing process on the port
    killPort(BACKEND_PORT);

    // Spawn Node.js process for backend
    backendProcess = spawn('node', [serverPath], {
      cwd: backendPath,
      env: getBackendEnv(),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let startupOutput = '';

    backendProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('[Backend]', output);
      startupOutput += output;

      // Check if server is ready
      if (output.includes('Server running') || output.includes('Connected to MongoDB')) {
        backendReady = true;
        resolve();
      }
    });

    backendProcess.stderr.on('data', (data) => {
      console.error('[Backend Error]', data.toString());
    });

    backendProcess.on('error', (error) => {
      console.error('Failed to start backend:', error);
      reject(error);
    });

    backendProcess.on('exit', (code) => {
      console.log('Backend exited with code:', code);
      backendReady = false;
      backendProcess = null;
      
      if (!isQuitting && code !== 0 && code !== null) {
        // Show error dialog only if we haven't already resolved
        setTimeout(() => {
          dialog.showErrorBox(
            'Backend Error',
            `The backend server stopped unexpectedly.\n\nOutput:\n${startupOutput.slice(-500)}`
          );
        }, 100);
      }
    });

    // Timeout for startup
    setTimeout(() => {
      if (!backendReady) {
        resolve(); // Resolve anyway to show the window
      }
    }, 10000);
  });
}

/**
 * Stop the backend server
 */
function stopBackend() {
  if (backendProcess) {
    console.log('Stopping backend server...');
    backendProcess.kill('SIGTERM');
    backendProcess = null;
    backendReady = false;
  }
}

/**
 * Create the main application window
 */
function createWindow() {
  const bounds = store.get('windowBounds');

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    minWidth: 1024,
    minHeight: 768,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    },
    show: false,
    titleBarStyle: 'default',
    autoHideMenuBar: false
  });

  // Create application menu
  createMenu();

  // Load the frontend
  if (isDev && fs.existsSync(path.join(frontendPath, 'index.html'))) {
    // Load built frontend
    mainWindow.loadFile(path.join(frontendPath, 'index.html'));
  } else if (isDev) {
    // Load from dev server
    mainWindow.loadURL('http://localhost:5173');
  } else {
    // Production - load from built files
    mainWindow.loadFile(path.join(frontendPath, 'index.html'));
  }

  // Show when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();

    // Check if MongoDB is configured
    if (!store.get('mongoUri')) {
      showSetupDialog();
    }
  });

  // Save window bounds on resize
  mainWindow.on('resize', () => {
    const bounds = mainWindow.getBounds();
    store.set('windowBounds', { width: bounds.width, height: bounds.height });
  });

  // Handle close
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });

  // Handle external links - but intercept OAuth
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Don't open OAuth URLs externally, they'll be handled by will-navigate
    if (url.includes('/api/auth/google')) {
      return { action: 'deny' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Intercept navigation for OAuth flow
  mainWindow.webContents.on('will-navigate', (event, url) => {
    console.log('Navigation to:', url);
    
    // Handle OAuth redirect
    if (url.includes('/auth/callback') && url.includes('token=')) {
      event.preventDefault();
      
      // Extract token from URL
      const urlObj = new URL(url);
      const token = urlObj.searchParams.get('token');
      const refreshToken = urlObj.searchParams.get('refreshToken');
      
      if (token) {
        // Execute JavaScript in the renderer to store the token and redirect
        mainWindow.webContents.executeJavaScript(`
          localStorage.setItem('authToken', '${token}');
          ${refreshToken ? `localStorage.setItem('refreshToken', '${refreshToken}');` : ''}
          window.location.hash = '#/dashboard';
          window.location.reload();
        `);
      }
    }
  });

  // Open DevTools in dev mode
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

/**
 * Create system tray
 */
function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
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
  tray.setToolTip('NetConfig - Network Configuration Manager');

  updateTrayMenu();

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
 * Create default tray icon
 */
function createDefaultIcon() {
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    canvas[i * 4] = 59;     // R
    canvas[i * 4 + 1] = 130; // G
    canvas[i * 4 + 2] = 246; // B
    canvas[i * 4 + 3] = 255; // A
  }
  return nativeImage.createFromBuffer(canvas, { width: size, height: size });
}

/**
 * Update tray menu
 */
function updateTrayMenu() {
  const contextMenu = Menu.buildFromTemplate([
    { label: 'NetConfig', type: 'normal', enabled: false },
    { type: 'separator' },
    { 
      label: backendReady ? '🟢 Server Running' : '🔴 Server Stopped',
      enabled: false 
    },
    { type: 'separator' },
    { 
      label: 'Open NetConfig',
      click: () => mainWindow && mainWindow.show()
    },
    { 
      label: 'Restart Server',
      click: async () => {
        stopBackend();
        await startBackend();
        updateTrayMenu();
      }
    },
    { type: 'separator' },
    { 
      label: 'Settings',
      click: () => showSettingsDialog()
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
 * Create application menu
 */
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { 
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => showSettingsDialog()
        },
        { type: 'separator' },
        { 
          label: 'Quit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            isQuitting = true;
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: () => shell.openExternal('https://github.com/netconfig/docs')
        },
        {
          label: 'About',
          click: () => showAboutDialog()
        }
      ]
    }
  ];

  // Add DevTools in dev mode
  if (isDev) {
    template[2].submenu.push(
      { type: 'separator' },
      { role: 'toggleDevTools' }
    );
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/**
 * Show setup dialog for first-time configuration
 */
async function showSetupDialog() {
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Welcome to NetConfig',
    message: 'First-time Setup Required',
    detail: 'Please configure your MongoDB connection to get started.',
    buttons: ['Configure Now', 'Later']
  });

  if (result.response === 0) {
    showSettingsDialog();
  }
}

/**
 * Show settings dialog
 */
function showSettingsDialog() {
  const settingsWindow = new BrowserWindow({
    width: 500,
    height: 450,
    parent: mainWindow,
    modal: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  settingsWindow.setMenu(null);
  settingsWindow.loadFile(path.join(__dirname, 'settings.html'));
}

/**
 * Show about dialog
 */
function showAboutDialog() {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'About NetConfig',
    message: 'NetConfig Desktop',
    detail: `Version: 1.0.0\n\nNetwork Configuration Management System\n\n© 2026 NetConfig Team`
  });
}

// IPC Handlers
ipcMain.handle('get-settings', () => {
  return {
    mongoUri: store.get('mongoUri'),
    port: store.get('port'),
    jwtSecret: store.get('jwtSecret'),
    openrouterApiKey: store.get('openrouterApiKey')
  };
});

// Handle OAuth login via IPC
ipcMain.handle('oauth-google', async () => {
  return new Promise((resolve, reject) => {
    const authWindow = new BrowserWindow({
      width: 500,
      height: 700,
      parent: mainWindow,
      modal: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    authWindow.setMenu(null);
    
    // Load Google OAuth URL
    const authUrl = `http://localhost:${BACKEND_PORT}/api/auth/google`;
    authWindow.loadURL(authUrl);

    // Intercept the callback
    authWindow.webContents.on('will-redirect', (event, url) => {
      console.log('OAuth redirect to:', url);
      
      if (url.includes('/auth/callback') || url.includes('token=')) {
        event.preventDefault();
        
        try {
          const urlObj = new URL(url);
          const token = urlObj.searchParams.get('token');
          const refreshToken = urlObj.searchParams.get('refreshToken');
          
          if (token) {
            authWindow.close();
            resolve({ success: true, token, refreshToken });
          } else {
            authWindow.close();
            reject(new Error('No token received'));
          }
        } catch (err) {
          authWindow.close();
          reject(err);
        }
      }
    });

    authWindow.on('closed', () => {
      resolve({ success: false, cancelled: true });
    });
  });
});

ipcMain.handle('save-settings', async (event, settings) => {
  const needsRestart = settings.mongoUri !== store.get('mongoUri') || 
                       settings.port !== store.get('port');

  Object.entries(settings).forEach(([key, value]) => {
    store.set(key, value);
  });

  if (needsRestart) {
    stopBackend();
    await startBackend();
    updateTrayMenu();
    
    // Reload frontend
    if (mainWindow) {
      mainWindow.reload();
    }
  }

  return { success: true, restarted: needsRestart };
});

ipcMain.handle('get-backend-status', () => {
  return { running: backendReady, port: BACKEND_PORT };
});

ipcMain.handle('get-backend-url', () => {
  return `http://localhost:${BACKEND_PORT}`;
});

ipcMain.handle('restart-backend', async () => {
  stopBackend();
  await startBackend();
  updateTrayMenu();
  return { success: true };
});

// App lifecycle
app.whenReady().then(async () => {
  // Start backend first
  try {
    await startBackend();
  } catch (error) {
    console.error('Failed to start backend:', error);
  }

  // Create window and tray
  createWindow();
  createTray();

  // Update tray status
  updateTrayMenu();
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
  } else if (mainWindow) {
    mainWindow.show();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  stopBackend();
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  
  // Don't show dialog for common errors
  if (error.code === 'ECONNREFUSED' || error.code === 'EADDRINUSE') {
    return;
  }
  
  dialog.showErrorBox('Error', error.message);
});
