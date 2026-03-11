/**
 * useNetconfSessions Hook
 * Manages NETCONF session state and operations
 */
import { useState, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

/**
 * Custom hook for managing NETCONF sessions
 * @param {Function} fetchDevices - Function to refresh devices
 * @returns {Object} NETCONF session state and handlers
 */
export const useNetconfSessions = (fetchDevices) => {
  const [netconfSessions, setNetconfSessions] = useState([]);
  const [netconfSessionsLoading, setNetconfSessionsLoading] = useState(false);
  const [connectingDeviceId, setConnectingDeviceId] = useState(null);

  /**
   * Fetch active NETCONF sessions
   */
  const fetchNetconfSessions = useCallback(async () => {
    setNetconfSessionsLoading(true);
    try {
      const response = await axios.get('/devices/netconf/sessions');
      setNetconfSessions(response.data.sessions || []);
    } catch (error) {
      console.error('Error fetching NETCONF sessions:', error);
    } finally {
      setNetconfSessionsLoading(false);
    }
  }, []);

  /**
   * Connect to device via NETCONF
   */
  const handleConnectNetconf = useCallback(async (device) => {
    const deviceId = device.id || device._id;
    const deviceName = device.name;
    setConnectingDeviceId(deviceId);
    const toastId = toast.loading(`Connecting NETCONF to ${deviceName}...`);
    
    try {
      const response = await axios.post(`/devices/${deviceId}/netconf/connect`);
      
      if (response.data.success) {
        toast.success(
          `NETCONF connected to ${deviceName}! (${response.data.capabilities?.length || 0} capabilities)`, 
          { id: toastId }
        );
        fetchNetconfSessions();
      } else {
        toast.error(`NETCONF connection failed: ${response.data.message}`, { id: toastId });
      }
    } catch (error) {
      console.error('NETCONF connect error:', error);
      toast.error(
        `NETCONF connection failed: ${error.response?.data?.message || error.message}`, 
        { id: toastId }
      );
    } finally {
      setConnectingDeviceId(null);
    }
  }, [fetchNetconfSessions]);

  /**
   * Disconnect NETCONF session
   */
  const handleDisconnectNetconfSession = useCallback(async (deviceId, deviceName) => {
    const toastId = toast.loading(`Disconnecting NETCONF session from ${deviceName}...`);
    
    try {
      await axios.post(`/devices/${deviceId}/netconf/disconnect`);
      toast.success(`NETCONF session disconnected from ${deviceName}`, { id: toastId });
      fetchNetconfSessions();
    } catch (error) {
      toast.error(
        `Failed to disconnect: ${error.response?.data?.message || error.message}`, 
        { id: toastId }
      );
    }
  }, [fetchNetconfSessions]);

  /**
   * Toggle mock mode for a device
   */
  const handleToggleMockMode = useCallback(async (device) => {
    const deviceId = device.id || device._id;
    const deviceName = device.name;
    const currentMockMode = device.netconf_mock_mode === true;
    
    const toastId = toast.loading(
      `${currentMockMode ? 'Disabling' : 'Enabling'} mock mode for ${deviceName}...`
    );
    
    try {
      const response = await axios.post(`/configurations/netconf/mock/${deviceId}`, {
        enabled: !currentMockMode
      });
      
      if (response.data.success) {
        toast.success(response.data.message, { id: toastId });
        // Refresh devices to get updated mock mode status
        if (fetchDevices) fetchDevices();
        fetchNetconfSessions();
      } else {
        toast.error(`Failed to toggle mock mode: ${response.data.message}`, { id: toastId });
      }
    } catch (error) {
      console.error('Toggle mock mode error:', error);
      toast.error(
        `Failed to toggle mock mode: ${error.response?.data?.message || error.message}`, 
        { id: toastId }
      );
    }
  }, [fetchDevices, fetchNetconfSessions]);

  /**
   * Check if a device has an active session
   */
  const hasActiveSession = useCallback((deviceId) => {
    return netconfSessions.some(s => s.device_id === deviceId && s.is_connected);
  }, [netconfSessions]);

  /**
   * Get session for a specific device
   */
  const getDeviceSession = useCallback((deviceId) => {
    return netconfSessions.find(s => s.device_id === deviceId);
  }, [netconfSessions]);

  return {
    // State
    netconfSessions,
    netconfSessionsLoading,
    connectingDeviceId,
    
    // Actions
    fetchNetconfSessions,
    handleConnectNetconf,
    handleDisconnectNetconfSession,
    handleToggleMockMode,
    
    // Utilities
    hasActiveSession,
    getDeviceSession,
  };
};

export default useNetconfSessions;
