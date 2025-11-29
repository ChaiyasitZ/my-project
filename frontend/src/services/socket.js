import { io } from 'socket.io-client';

const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:3001'
  : window.location.origin;

// Create socket connection
const socket = io(API_BASE_URL, {
  autoConnect: false, // Don't connect automatically, we'll connect when needed
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5
});

// Connection event handlers
socket.on('connect', () => {
  console.log('🔌 WebSocket connected:', socket.id);
  // Subscribe to backup notifications
  socket.emit('subscribe:backups');
});

socket.on('disconnect', () => {
  console.log('🔌 WebSocket disconnected');
});

socket.on('connect_error', (error) => {
  console.error('🔌 WebSocket connection error:', error);
});

// Export socket instance
export default socket;

// Helper functions for managing socket connection
export const connectSocket = () => {
  if (!socket.connected) {
    socket.connect();
  }
};

export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect();
  }
};

export const subscribeToBackupProgress = (callback) => {
  socket.on('backup:progress', callback);
  return () => socket.off('backup:progress', callback);
};

export const subscribeToDeploymentProgress = (callback) => {
  socket.on('deployment:progress', callback);
  return () => socket.off('deployment:progress', callback);
};

export const subscribeToScheduleResults = (callback) => {
  socket.on('backup:schedule-results', callback);
  return () => socket.off('backup:schedule-results', callback);
};

export const subscribeToBackupSummary = (callback) => {
  socket.on('backup:summary', callback);
  return () => socket.off('backup:summary', callback);
};

export const subscribeToBackupError = (callback) => {
  socket.on('backup:error', callback);
  return () => socket.off('backup:error', callback);
};
