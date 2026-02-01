/**
 * Preload script - Secure bridge between main and renderer
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  
  // Backend
  getBackendStatus: () => ipcRenderer.invoke('get-backend-status'),
  getBackendUrl: () => ipcRenderer.invoke('get-backend-url'),
  restartBackend: () => ipcRenderer.invoke('restart-backend'),
  
  // OAuth
  loginWithGoogle: () => ipcRenderer.invoke('oauth-google'),
  
  // App info
  isElectron: true,
  platform: process.platform,
  version: process.env.npm_package_version || '1.0.0'
});

// Expose backend URL to window for API calls
ipcRenderer.invoke('get-backend-url').then(url => {
  window.BACKEND_URL = url;
});
