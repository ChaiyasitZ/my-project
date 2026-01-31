/**
 * useDevices Hook
 * Manages device fetching, selection, and related UI state
 */
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import axios from 'axios';

/**
 * Custom hook for managing device state and operations
 * @returns {Object} Device state and handlers
 */
export const useDevices = () => {
  const [devices, setDevices] = useState([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [showDeviceDropdown, setShowDeviceDropdown] = useState(false);
  const [deviceSearchQuery, setDeviceSearchQuery] = useState('');
  const deviceDropdownRef = useRef(null);

  /**
   * Fetch active devices from the API
   */
  const fetchDevices = useCallback(async () => {
    setDevicesLoading(true);
    try {
      const response = await axios.get('/devices?status=active');
      setDevices(response.data.devices || []);
    } catch (error) {
      console.error('Error fetching devices:', error);
    } finally {
      setDevicesLoading(false);
    }
  }, []);

  /**
   * Filter devices based on search query
   */
  const filteredDevices = useMemo(() => {
    if (!deviceSearchQuery.trim()) return devices;
    
    const query = deviceSearchQuery.toLowerCase();
    return devices.filter(device => 
      device.name?.toLowerCase().includes(query) ||
      device.ip_address?.toLowerCase().includes(query) ||
      device.type?.toLowerCase().includes(query)
    );
  }, [devices, deviceSearchQuery]);

  /**
   * Get selected device object
   */
  const selectedDeviceObj = useMemo(() => {
    return devices.find(d => (d.id || d._id) === selectedDevice);
  }, [devices, selectedDevice]);

  /**
   * Handle device selection
   */
  const handleDeviceSelect = useCallback((deviceId) => {
    setSelectedDevice(deviceId);
    setShowDeviceDropdown(false);
    setDeviceSearchQuery('');
  }, []);

  /**
   * Toggle dropdown visibility
   */
  const toggleDropdown = useCallback(() => {
    setShowDeviceDropdown(prev => !prev);
  }, []);

  /**
   * Close dropdown when clicking outside
   */
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (deviceDropdownRef.current && !deviceDropdownRef.current.contains(event.target)) {
        setShowDeviceDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /**
   * Reset device selection
   */
  const resetDeviceSelection = useCallback(() => {
    setSelectedDevice('');
    setDeviceSearchQuery('');
    setShowDeviceDropdown(false);
  }, []);

  return {
    // State
    devices,
    devicesLoading,
    selectedDevice,
    selectedDeviceObj,
    showDeviceDropdown,
    deviceSearchQuery,
    deviceDropdownRef,
    filteredDevices,
    
    // Actions
    fetchDevices,
    setSelectedDevice,
    setDeviceSearchQuery,
    setShowDeviceDropdown,
    handleDeviceSelect,
    toggleDropdown,
    resetDeviceSelection,
  };
};

export default useDevices;
