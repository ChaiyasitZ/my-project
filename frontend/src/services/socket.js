/**
 * Polling Service - Replaces Socket.IO with HTTP polling
 * 
 * For Vercel serverless compatibility, all real-time features
 * use periodic HTTP polling instead of WebSocket connections.
 */

import axios from 'axios';

// ─── Notification Polling ───

let notificationPollTimeout = null;
let isPollingActive = false;
let isFetchInProgress = false;
let lastNotificationTime = new Date(Date.now() - 30000).toISOString();
const eventListeners = new Map(); // event -> Set<callback>

/**
 * Perform the actual poll request, and schedule the next one.
 */
const pollNotifications = async () => {
  if (!isPollingActive) return;
  if (isFetchInProgress) return;
  
  isFetchInProgress = true;
  try {
    const { data } = await axios.get(`/agent/notifications?since=${lastNotificationTime}`);
    
    // Process notifications first
    for (const notification of (data.notifications || [])) {
      const listeners = eventListeners.get(notification.event);
      if (listeners) {
        for (const callback of listeners) {
          try {
            callback(notification.data);
          } catch (e) {
            console.error('Notification handler error:', e);
          }
        }
      }
    }

    // Update time using the latest notification's timestamp if available,
    // otherwise use serverTime. This avoids missing notifications due to DB insertion delays,
    // and correctly advances the cursor.
    if (data.notifications && data.notifications.length > 0) {
      const latestNotification = data.notifications[data.notifications.length - 1];
      // Add 1ms to avoid $gt fetching the exact same record if we use the same string
      lastNotificationTime = latestNotification.timestamp;
    } else if (data.serverTime) {
      lastNotificationTime = data.serverTime;
    }
    
  } catch (error) {
    if (error.response?.status !== 401) {
      console.warn('Notification poll error:', error.message);
    }
  } finally {
    isFetchInProgress = false;
    // Schedule the next poll if still active
    if (isPollingActive) {
      notificationPollTimeout = setTimeout(pollNotifications, 3000);
    }
  }
};

/**
 * Start polling for notifications (replaces socket.connect)
 */
export const connectSocket = () => {
  if (isPollingActive) return; // Already polling
  
  console.log('📡 Started notification polling');
  isPollingActive = true;
  pollNotifications();
};

/**
 * Stop polling for notifications (replaces socket.disconnect)
 */
export const disconnectSocket = () => {
  if (isPollingActive) {
    isPollingActive = false;
    if (notificationPollTimeout) {
      clearTimeout(notificationPollTimeout);
      notificationPollTimeout = null;
    }
    console.log('📡 Stopped notification polling');
  }
};

/**
 * Subscribe to a specific event type
 * Returns an unsubscribe function (same API as the old socket subscriptions)
 */
function subscribe(event, callback) {
  if (!eventListeners.has(event)) {
    eventListeners.set(event, new Set());
  }
  eventListeners.get(event).add(callback);
  
  // Return unsubscribe function
  return () => {
    const listeners = eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        eventListeners.delete(event);
      }
    }
  };
}

// ─── Backup & Deployment Subscriptions ───

export const subscribeToBackupProgress = (callback) => {
  return subscribe('backup:progress', callback);
};

export const subscribeToDeploymentProgress = (callback) => {
  return subscribe('deployment:progress', callback);
};

export const subscribeToBackupSummary = (callback) => {
  return subscribe('backup:summary', callback);
};

export const subscribeToBackupError = (callback) => {
  return subscribe('backup:error', callback);
};

// ─── Agent Status Polling ───

/**
 * Subscribe to agent status changes via polling
 * Polls /api/agent/status every 5 seconds
 */
export const subscribeToAgentStatus = (callback) => {
  let lastOnlineState = null;
  
  const interval = setInterval(async () => {
    try {
      const { data } = await axios.get('/agent/status');
      
      // Only fire callback when status changes
      if (lastOnlineState !== data.online) {
        lastOnlineState = data.online;
        callback({
          online: data.online,
          agentInfo: data.agent
        });
      }
    } catch (error) {
      // Ignore polling errors
    }
  }, 5000);
  
  // Return unsubscribe function
  return () => clearInterval(interval);
};

// ─── Shell Session Polling ───

/**
 * Subscribe to shell output for a session
 * Polls every 300ms (was 500ms) for a more responsive terminal, matching
 * the agent's tightened input-polling cadence.
 */
export const subscribeToShellData = (sessionId, callback) => {
  let cursor = 0;
  
  const interval = setInterval(async () => {
    try {
      const { data } = await axios.get(`/agent/shell/output/${sessionId}?since=${cursor}`);
      
      if (data.chunks && data.chunks.length > 0) {
        for (const chunk of data.chunks) {
          callback({ sessionId, data: chunk.data });
        }
        cursor = data.nextCursor;
      }
      
      if (data.status === 'closed') {
        clearInterval(interval);
      }
    } catch (error) {
      // Ignore polling errors
    }
  }, 300);
  
  return () => clearInterval(interval);
};

/**
 * Subscribe to shell closed events
 */
export const subscribeToShellClosed = (sessionId, callback) => {
  const interval = setInterval(async () => {
    try {
      const { data } = await axios.get(`/agent/shell/output/${sessionId}?since=0`);
      
      if (data.status === 'closed') {
        callback({ sessionId });
        clearInterval(interval);
      }
    } catch (error) {
      // Ignore
    }
  }, 2000);
  
  return () => clearInterval(interval);
};

/**
 * Send shell input
 */
export const sendShellInput = async (sessionId, inputData) => {
  try {
    await axios.post('/agent/shell/input', { sessionId, data: inputData });
  } catch (error) {
    console.error('Failed to send shell input:', error.message);
  }
};

// Default export for backward compatibility (no-op object)
export default {
  connected: false,
  connect: connectSocket,
  disconnect: disconnectSocket,
  on: () => {},
  off: () => {},
  emit: () => {}
};
