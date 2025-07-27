import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';

const API_BASE_URL = '/api';

export const useNetconf = () => {
  const [devices, setDevices] = useState([]);
  const [yangModels, setYangModels] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch NETCONF devices
  const fetchDevices = useCallback(async () => {
    try {
      console.log(`🔍 Fetching NETCONF devices from ${API_BASE_URL}/netconf-devices`);
      const response = await fetch(`${API_BASE_URL}/netconf-devices`);
      const data = await response.json();
      
      if (data.success && data.data && data.data.devices) {
        const netconfDevices = data.data.devices;
        
        setDevices(netconfDevices);
        console.log(`📱 Loaded ${netconfDevices.length} NETCONF devices`);
        
        if (netconfDevices.length === 0) {
          console.warn('⚠️ No NETCONF devices found. Consider adding NETCONF devices.');
        }
      } else {
        console.error('❌ Invalid API response structure:', data);
        setDevices([]);
      }
    } catch (error) {
      console.error('❌ Error fetching NETCONF devices:', error);
      setDevices([]);
    }
  }, []);

  // Fetch YANG models
  const fetchYangModels = useCallback(async () => {
    try {
      console.log('📥 Fetching YANG models...');
      const response = await fetch(`${API_BASE_URL}/netconf/yang-models`);
      const data = await response.json();
      
      if (data.success) {
        setYangModels(data.data.models);
      }
    } catch (error) {
      console.error('Error fetching YANG models:', error);
    }
  }, []);

  // Fetch active sessions
  const fetchActiveSessions = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/netconf/sessions`);
      const data = await response.json();
      if (data.success) {
        setActiveSessions(data.data.sessions);
        console.log(`📊 Loaded ${data.data.sessions.length} active NETCONF sessions`);
      }
    } catch (error) {
      console.error('Error fetching active sessions:', error);
    }
  }, []);

  // Check device session status (real-time)
  const checkDeviceSessionStatus = useCallback(async (deviceId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/netconf/device-session-status/${deviceId}`);
      const data = await response.json();
      if (data.success) {
        return data.data;
      }
      return null;
    } catch (error) {
      console.error('Error checking device session status:', error);
      return null;
    }
  }, []);

  // Test connection
  const testConnection = useCallback(async (deviceId) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/netconf-devices/${deviceId}/test-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      
      if (data.success) {
        fetchActiveSessions();
      }
      return data;
    } catch (error) {
      console.error('Error testing connection:', error);
      return {
        success: false,
        message: 'Connection test failed',
        error: error.message
      };
    } finally {
      setLoading(false);
    }
  }, [fetchActiveSessions]);

  // Connect device
  const connectDevice = useCallback(async (deviceId) => {
    setLoading(true);
    const toastId = toast.loading('Establishing NETCONF session...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/netconf-devices/${deviceId}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      
      if (data.success) {
        toast.success('NETCONF session established successfully!', { id: toastId });
        fetchActiveSessions();
        return { success: true };
      } else {
        toast.error(`Connection failed: ${data.message}`, { id: toastId });
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error('Error connecting device:', error);
      toast.error('Connection failed: ' + error.message, { id: toastId });
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, [fetchActiveSessions]);

  // Disconnect session
  const disconnectSession = useCallback(async (sessionId) => {
    console.log(`🔌 Attempting to disconnect NETCONF session: ${sessionId}`);
    setLoading(true);
    const toastId = toast.loading('Disconnecting NETCONF session...');
    
    try {
      const url = `${API_BASE_URL}/netconf/disconnect/${encodeURIComponent(sessionId)}`;
      console.log(`📤 POST to: ${url}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`📥 Response status: ${response.status}`);
      const data = await response.json();
      console.log(`📄 Response data:`, data);
      
      if (data.success) {
        toast.success('NETCONF session disconnected successfully!', { id: toastId });
        fetchActiveSessions();
        return { success: true };
      } else {
        console.error(`❌ Disconnect failed:`, data);
        toast.error(`Disconnect failed: ${data.message}`, { id: toastId });
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error('❌ Error disconnecting session:', error);
      toast.error('Disconnect failed: ' + error.message, { id: toastId });
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, [fetchActiveSessions]);

  // Initialize data on mount
  useEffect(() => {
    fetchDevices();
    fetchYangModels();
    fetchActiveSessions();
  }, [fetchDevices, fetchYangModels, fetchActiveSessions]);

  return {
    // State
    devices,
    yangModels,
    activeSessions,
    loading,
    
    // Actions
    fetchDevices,
    fetchYangModels,
    fetchActiveSessions,
    testConnection,
    connectDevice,
    disconnectSession,
    checkDeviceSessionStatus,
    
    // Setters for external updates
    setDevices,
    setYangModels,
    setActiveSessions
  };
};

export default useNetconf; 