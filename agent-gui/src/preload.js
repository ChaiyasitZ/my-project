/**
 * Preload script - exposes safe IPC bridge to renderer
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('agent', {
  // Config
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (data) => ipcRenderer.invoke('save-config', data),

  // Connection
  connect: () => ipcRenderer.invoke('connect'),
  disconnect: () => ipcRenderer.invoke('disconnect'),
  getStatus: () => ipcRenderer.invoke('get-status'),

  // Logs
  getLogs: () => ipcRenderer.invoke('get-logs'),

  // Ollama
  checkOllama: () => ipcRenderer.invoke('check-ollama'),

  // Window controls
  minimize: () => ipcRenderer.invoke('minimize'),
  close: () => ipcRenderer.invoke('close'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // Event listeners
  onLog: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('log', handler);
    return () => ipcRenderer.removeListener('log', handler);
  },
  onStatus: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('status', handler);
    return () => ipcRenderer.removeListener('status', handler);
  },
  onConfig: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('config', handler);
    return () => ipcRenderer.removeListener('config', handler);
  },
  onOllamaStatus: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('ollama-status', handler);
    return () => ipcRenderer.removeListener('ollama-status', handler);
  },
  onLogs: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('logs', handler);
    return () => ipcRenderer.removeListener('logs', handler);
  }
});
