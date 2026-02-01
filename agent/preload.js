/**
 * Preload script - Exposes safe APIs to renderer process
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  
  // Network scanning
  scanNetwork: () => ipcRenderer.invoke('scan-network'),
  
  // Device testing
  testSSH: (device) => ipcRenderer.invoke('test-ssh', device),
  testNetconf: (device) => ipcRenderer.invoke('test-netconf', device),
  
  // Command execution
  executeSSH: (device, commands) => ipcRenderer.invoke('execute-ssh', device, commands),
  executeNetconf: (device, config) => ipcRenderer.invoke('execute-netconf', device, config),
  
  // Server status
  getServerStatus: () => ipcRenderer.invoke('get-server-status'),
  
  // Event listeners
  onScanStarted: (callback) => ipcRenderer.on('scan-started', callback),
  onScanCompleted: (callback) => ipcRenderer.on('scan-completed', (event, devices) => callback(devices)),
  onScanError: (callback) => ipcRenderer.on('scan-error', (event, error) => callback(error)),
  onServerStatus: (callback) => ipcRenderer.on('server-status', (event, status) => callback(status)),
  onNavigate: (callback) => ipcRenderer.on('navigate', (event, page) => callback(page)),
  
  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});
