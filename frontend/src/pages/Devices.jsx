import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  TestTubeIcon,
  ServerIcon,
  WifiIcon,
  FunnelIcon,
  SearchIcon,
  RefreshCwIcon,
  StopCircleIcon
} from 'lucide-react';
import DeviceIcon from '../components/DeviceIcon';

function Devices() {
  const [devices, setDevices] = useState([]);
  const [filteredDevices, setFilteredDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [testingDevice, setTestingDevice] = useState(null);
  const [testingNetconf, setTestingNetconf] = useState(null);
  const [sshSessions, setSshSessions] = useState(new Map()); // Track SSH session status
  const [connectingDevices, setConnectingDevices] = useState(new Set());
  
  // Filter states
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'switch',
    layer: 'layer-2',
    ip_address: '',
    ssh_port: 22,
    netconf_port: 830,
    netconf_enabled: false,
    username: '',
    password: '',
    description: '',
    location: '',
    model: '',
    status: 'active'
  });

  useEffect(() => {
    fetchDevices();
    
    // Poll for SSH status updates every 10 seconds
    const pollInterval = setInterval(() => {
      if (devices.length > 0) {
        fetchSshSessionStatuses(devices);
        // Silently refresh device list to get latest ssh_status
        axios.get('/devices').then(response => {
          const devicesData = response.data.devices || [];
          setDevices(devicesData);
        }).catch(err => console.error('Error polling devices:', err));
      }
    }, 10000);
    
    return () => clearInterval(pollInterval);
  }, []);

  // Filter devices whenever devices, selectedFilter, or searchTerm changes
  useEffect(() => {
    filterDevices();
  }, [devices, selectedFilter, searchTerm]);

  // Manage modal body class
  useEffect(() => {
    if (showModal) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    
    // Cleanup on unmount
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showModal]);

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/devices');
      const devicesData = response.data.devices || [];
      setDevices(devicesData);
      
      // Fetch SSH session status for each device
      await fetchSshSessionStatuses(devicesData);
    } catch (error) {
      console.error('Error fetching devices:', error);
      toast.error('Failed to fetch devices');
    } finally {
      setLoading(false);
    }
  };

  const fetchSshSessionStatuses = async (deviceList) => {
    try {
      const sessionPromises = deviceList.map(async (device) => {
        try {
          const response = await axios.get(`/devices/${device.id}/ssh/status`);
          return {
            deviceId: device.id,
            session: response.data.ssh_session
          };
        } catch (error) {
          return {
            deviceId: device.id,
            session: { is_connected: false }
          };
        }
      });
      
      const sessionResults = await Promise.all(sessionPromises);
      const newSessions = new Map();
      
      sessionResults.forEach(result => {
        newSessions.set(result.deviceId, result.session);
      });
      
      setSshSessions(newSessions);
    } catch (error) {
      console.error('Error fetching SSH session statuses:', error);
    }
  };

  const handleSshConnect = async (device) => {
    const deviceId = device.id || device._id;
    setConnectingDevices(prev => new Set([...prev, deviceId]));
    const toastId = toast.loading(`Connecting SSH session to ${device.name}...`);
    
    try {
      const response = await axios.post(`/devices/${deviceId}/ssh/connect`);
      
      if (response.data.success) {
        // Update session status
        setSshSessions(prev => new Map([...prev, [deviceId, {
          is_connected: true,
          session_id: response.data.session.session_id,
          connected_at: response.data.session.connected_at,
          is_privileged: response.data.session.is_privileged,
          use_count: response.data.session.use_count
        }]]));
        
        toast.success(`SSH session connected to ${device.name}${response.data.session.is_privileged ? ' (Privileged mode)' : ' (User mode)'}`, { id: toastId });
        
        // Refresh device list to show updated status
        fetchDevices();
      } else {
        toast.error(`Failed to connect: ${response.data.message || 'Unknown error'}`, { id: toastId });
        fetchDevices();
      }
    } catch (error) {
      console.error('Error connecting SSH session:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || 'Connection failed';
      toast.error(`Failed to connect to ${device.name}: ${errorMessage}`, { id: toastId });
      // Refresh to update status
      fetchDevices();
    } finally {
      setConnectingDevices(prev => {
        const newSet = new Set(prev);
        newSet.delete(deviceId);
        return newSet;
      });
    }
  };

  const handleSshDisconnect = async (device) => {
    const deviceId = device.id || device._id;
    setConnectingDevices(prev => new Set([...prev, deviceId]));
    const toastId = toast.loading(`Disconnecting SSH session from ${device.name}...`);
    
    try {
      const response = await axios.post(`/devices/${deviceId}/ssh/disconnect`);
      
      if (response.data.success) {
        // Update session status
        setSshSessions(prev => new Map([...prev, [deviceId, { is_connected: false }]]));
        toast.success(`SSH session disconnected from ${device.name}`, { id: toastId });
        
        // Refresh device list to show updated status
        fetchDevices();
      }
    } catch (error) {
      console.error('Error disconnecting SSH session:', error);
      toast.error(`Failed to disconnect from ${device.name}: ${error.response?.data?.message || error.message}`, { id: toastId });
    } finally {
      setConnectingDevices(prev => {
        const newSet = new Set(prev);
        newSet.delete(deviceId);
        return newSet;
      });
    }
  };

  const handleSshStop = async (device) => {
    const deviceId = device.id || device._id;
    const toastId = toast.loading(`Stopping SSH connection attempt to ${device.name}...`);
    
    try {
      // Try to disconnect to cancel the connection attempt
      await axios.post(`/devices/${deviceId}/ssh/disconnect`);
      
      toast.success(`Connection attempt stopped for ${device.name}`, { id: toastId });
      
      // Refresh device list to show updated status
      fetchDevices();
    } catch (error) {
      console.error('Error stopping SSH connection:', error);
      toast.error(`Failed to stop connection: ${error.response?.data?.message || error.message}`, { id: toastId });
    } finally {
      setConnectingDevices(prev => {
        const newSet = new Set(prev);
        newSet.delete(deviceId);
        return newSet;
      });
    }
  };

  const filterDevices = () => {
    let filtered = [...devices];

    // Filter by device type
    if (selectedFilter !== 'all') {
      filtered = filtered.filter(device => device.type === selectedFilter);
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(device => 
        device.name.toLowerCase().includes(search) ||
        device.ip_address.toLowerCase().includes(search) ||
        (device.location && device.location.toLowerCase().includes(search)) ||
        (device.model && device.model.toLowerCase().includes(search)) ||
        (device.description && device.description.toLowerCase().includes(search))
      );
    }

    setFilteredDevices(filtered);
  };

  const getFilterCounts = () => {
    const counts = {
      all: devices.length,
      switch: devices.filter(d => d.type === 'switch').length,
      router: devices.filter(d => d.type === 'router').length,
      nexus: devices.filter(d => d.type === 'nexus').length
    };
    return counts;
  };

  const getFilterIcon = (type) => {
    if (type === 'all') {
      return <FunnelIcon className="h-4 w-4" />;
    }
    return <DeviceIcon 
      deviceType={type} 
      layer="layer-2" 
      className="h-4 w-4" 
    />;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingDevice) {
        const deviceId = editingDevice.id || editingDevice._id;
        await axios.put(`/devices/${deviceId}`, formData);
        console.log('✅ Device updated successfully:', formData.name);
        toast.success(`Device "${formData.name}" updated successfully!`);
      } else {
        await axios.post('/devices', formData);
        console.log('✅ Device created successfully:', formData.name);
        toast.success(`Device "${formData.name}" created successfully!`);
      }
      
      setShowModal(false);
      setEditingDevice(null);
      resetForm();
      fetchDevices();
    } catch (error) {
      console.error('❌ Error saving device:', error.response?.data?.message || error.message);
      toast.error('Error saving device: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleEdit = (device) => {
    setEditingDevice(device);
    setFormData({
      name: device.name,
      type: device.type,
      layer: device.type === 'switch' ? (device.layer || 'layer-2') : undefined,
      ip_address: device.ip_address,
      ssh_port: device.ssh_port,
      netconf_port: device.netconf_port || 830,
      netconf_enabled: device.netconf_enabled || false,
      username: device.username,
      password: '', // Don't populate password for security
      description: device.description || '',
      location: device.location || '',
      model: device.model || '',
      status: device.status
    });
    setShowModal(true);
  };

  const handleDelete = async (device) => {
    if (window.confirm(`Are you sure you want to delete ${device.name}?`)) {
      try {
        const deviceId = device.id || device._id;
        await axios.delete(`/devices/${deviceId}`);
        console.log('✅ Device deleted successfully:', device.name);
        toast.success(`Device "${device.name}" deleted successfully!`);
        fetchDevices();
      } catch (error) {
        console.error('❌ Error deleting device:', error.response?.data?.message || error.message);
        toast.error('Error deleting device: ' + (error.response?.data?.message || error.message));
      }
    }
  };

  const handleTestConnection = async (device) => {
    const deviceId = device.id || device._id;
    setTestingDevice(deviceId);
    const toastId = toast.loading(`Testing SSH connection to ${device.name}...`);
    
    try {
      const response = await axios.post(`/devices/${deviceId}/test`);
      
      // Add null/undefined checks for nested properties
      if (response.data && response.data.connectionTest) {
        const result = response.data.connectionTest;
        
        if (result.success) {
          console.log('✅ SSH Connection successful for', device.name + ':', result.message);
          toast.success(`SSH connection to ${device.name} successful!`, { id: toastId });
        } else {
          console.warn('⚠️ SSH Connection failed for', device.name + ':', result.message);
          toast.error(`SSH connection to ${device.name} failed: ${result.message}`, { id: toastId });
        }
      } else if (response.data && response.data.success !== undefined) {
        // Handle direct success response format
        if (response.data.success) {
          toast.success(`SSH connection to ${device.name} successful!`, { id: toastId });
        } else {
          toast.error(`SSH connection to ${device.name} failed: ${response.data.message || 'Unknown error'}`, { id: toastId });
        }
      } else {
        console.error('Invalid response format:', response.data);
        toast.error(`Connection test failed: Invalid response from server`, { id: toastId });
      }
    } catch (error) {
      console.error('❌ SSH Connection test failed for', device.name + ':', error.response?.data?.message || error.message);
      toast.error(`Connection test failed: ${error.response?.data?.message || error.message}`, { id: toastId });
    } finally {
      setTestingDevice(null);
    }
  };

  const handleTestNetconf = async (device) => {
    const deviceId = device.id || device._id;
    setTestingNetconf(deviceId);
    const toastId = toast.loading(`Testing NETCONF connection to ${device.name}...`);
    
    try {
      const response = await axios.post(`/devices/${deviceId}/netconf/test`);
      
      if (response.data && response.data.success) {
        const capabilities = response.data.connectionTest?.capabilities || [];
        console.log('✅ NETCONF Connection successful for', device.name);
        toast.success(
          `NETCONF connection to ${device.name} successful! ${capabilities.length} capabilities found.`, 
          { id: toastId }
        );
      } else {
        console.warn('⚠️ NETCONF Connection failed for', device.name);
        toast.error(
          `NETCONF connection to ${device.name} failed: ${response.data.message}`, 
          { id: toastId }
        );
      }
    } catch (error) {
      console.error('❌ NETCONF Connection test failed for', device.name + ':', error.response?.data?.message || error.message);
      toast.error(`NETCONF test failed: ${error.response?.data?.message || error.message}`, { id: toastId });
    } finally {
      setTestingNetconf(null);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'switch',
      layer: 'layer-2',
      ip_address: '',
      ssh_port: 22,
      netconf_port: 830,
      netconf_enabled: false,
      username: '',
      password: '',
      description: '',
      location: '',
      model: '',
      status: 'active'
    });
  };

  const getStatusBadge = (status) => {
    const styles = {
      active: 'badge-success',
      inactive: 'badge-danger',
      maintenance: 'badge-warning'
    };
    return styles[status] || 'badge-info';
  };

  const getDeviceIcon = (device) => {
    return <DeviceIcon 
      deviceType={device.type} 
      layer={device.layer} 
      className="h-5 w-5" 
    />;
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  const filterCounts = getFilterCounts();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <ServerIcon className="h-8 w-8 text-blue-600" />
            Devices Management
          </h1>
          <p className="mt-2 text-gray-600">
            Manage your network devices (switches and routers)
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              resetForm();
              setEditingDevice(null);
              setShowModal(true);
            }}
            className="btn btn-primary btn-md"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Device
          </button>
          <button
            onClick={fetchDevices}
            disabled={loading}
            className="btn btn-secondary btn-md"
          >
            <RefreshCwIcon className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search devices..."
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Filter Buttons */}
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'all', label: 'All', count: filterCounts.all },
              { key: 'switch', label: 'Switches', count: filterCounts.switch },
              { key: 'router', label: 'Routers', count: filterCounts.router },
              { key: 'nexus', label: 'Nexus', count: filterCounts.nexus }
            ].map(filter => (
              <button
                key={filter.key}
                onClick={() => setSelectedFilter(filter.key)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedFilter === filter.key
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                }`}
              >
                {getFilterIcon(filter.key)}
                {filter.label}
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  selectedFilter === filter.key
                    ? 'bg-blue-200 text-blue-800'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {filter.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Active filters indicator */}
        {(selectedFilter !== 'all' || searchTerm) && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Active filters:</span>
              {selectedFilter !== 'all' && (
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs">
                  Type: {selectedFilter}
                </span>
              )}
              {searchTerm && (
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs">
                  Search: "{searchTerm}"
                </span>
              )}
              <button
                onClick={() => {
                  setSelectedFilter('all');
                  setSearchTerm('');
                }}
                className="text-blue-600 hover:text-blue-800 text-xs underline"
              >
                Clear all
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Results Summary */}
      <div className="text-sm text-gray-600">
        Showing {filteredDevices.length} of {devices.length} devices
        {selectedFilter !== 'all' && ` (${selectedFilter}s only)`}
        {searchTerm && ` matching "${searchTerm}"`}
      </div>

      {/* Devices List */}
      {filteredDevices.length === 0 ? (
        <div className="card p-12 text-center">
          {devices.length === 0 ? (
            <>
              <ServerIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No devices found</h3>
              <p className="text-gray-500 mb-6">Get started by adding your first network device</p>
              <button
                onClick={() => {
                  resetForm();
                  setEditingDevice(null);
                  setShowModal(true);
                }}
                className="btn btn-primary btn-md"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Add First Device
              </button>
            </>
          ) : (
            <>
              <FunnelIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No devices match your filters</h3>
              <p className="text-gray-500 mb-6">
                Try adjusting your search term or filter selection
              </p>
              <button
                onClick={() => {
                  setSelectedFilter('all');
                  setSearchTerm('');
                }}
                className="btn btn-secondary btn-md"
              >
                Clear Filters
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-6">
          {filteredDevices.map((device) => {
            const deviceId = device.id || device._id;
            return (
            <div key={deviceId} className="card p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0 text-gray-600">
                    {getDeviceIcon(device)}
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{device.name}</h3>
                    <p className="text-sm text-gray-500">
                      {device.type}
                      {device.type === 'switch' && device.layer && ` (${device.layer === 'layer-2' ? 'L2' : 'L3'})`} • {device.ip_address}
                      {device.location && ` • ${device.location}`}
                    </p>
                    {device.description && (
                      <p className="text-sm text-gray-400 mt-1">{device.description}</p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <span className={`badge ${getStatusBadge(device.status)}`}>
                    {device.status}
                  </span>
                  
                  {/* Enhanced SSH Session Status Indicator */}
                  {device.ssh_status === 'connected' && (
                    <span className="badge badge-success text-xs flex items-center gap-1">
                      <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                      SSH Connected
                      {sshSessions.get(deviceId)?.is_privileged && ' (Privileged)'}
                    </span>
                  )}
                  {device.ssh_status === 'connecting' && (
                    <span className="badge badge-info text-xs flex items-center gap-1">
                      <div className="animate-spin rounded-full h-2 w-2 border border-blue-400 border-t-transparent"></div>
                      Connecting...
                    </span>
                  )}
                  {device.ssh_status === 'error' && (
                    <span className="badge badge-danger text-xs flex items-center gap-1">
                      <span className="inline-block w-2 h-2 bg-red-400 rounded-full"></span>
                      SSH Error
                    </span>
                  )}

                  {/* NETCONF Enabled Indicator */}
                  {(device.type === 'nexus' || device.netconf_enabled) && (
                    <span className="badge badge-info text-xs flex items-center gap-1">
                      🌐 NETCONF
                    </span>
                  )}
                </div>
                
                {/* Action Buttons - Moved to separate row for better layout */}
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                  {/* Test Connections Group */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleTestConnection(device)}
                      disabled={testingDevice === deviceId}
                      className="btn btn-primary btn-sm"
                      title="Test SSH Connection"
                    >
                      {testingDevice === deviceId ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Testing...
                        </>
                      ) : (
                        'Test SSH'
                      )}
                    </button>

                    {/* NETCONF Test Button - show for nexus or netconf-enabled devices */}
                    {(device.type === 'nexus' || device.netconf_enabled) && (
                      <button
                        onClick={() => handleTestNetconf(device)}
                        disabled={testingNetconf === deviceId}
                        className="btn btn-purple btn-sm"
                        title="Test NETCONF Connection"
                      >
                        {testingNetconf === deviceId ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Testing...
                          </>
                        ) : (
                          'Test NETCONF'
                        )}
                      </button>
                    )}
                  </div>
                  
                  {/* Session Management Group */}
                  <div className="flex gap-2">
                    {/* SSH Session Management Buttons */}
                    {device.ssh_status === 'connected' ? (
                      <button
                        onClick={() => handleSshDisconnect(device)}
                        disabled={connectingDevices.has(deviceId)}
                        className="btn btn-warning btn-sm"
                        title="Disconnect SSH Session"
                      >
                        {connectingDevices.has(deviceId) ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Disconnecting...
                          </>
                        ) : (
                          'Disconnect'
                        )}
                      </button>
                    ) : device.ssh_status === 'connecting' ? (
                      <button
                        onClick={() => handleSshStop(device)}
                        className="btn btn-secondary btn-sm"
                        title="Stop Connection Attempt"
                      >
                        Stop
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSshConnect(device)}
                        disabled={connectingDevices.has(deviceId)}
                        className="btn btn-success btn-sm"
                        title="Connect SSH Session"
                      >
                        {connectingDevices.has(deviceId) ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Connecting...
                          </>
                        ) : (
                          'Connect'
                        )}
                      </button>
                    )}
                  </div>
                    
                  {/* Edit/Delete Group */}
                  <div className="flex gap-2 ml-auto">
                    <button
                      onClick={() => handleEdit(device)}
                      className="btn btn-secondary btn-sm"
                      title="Edit Device"
                    >
                      Edit
                    </button>
                    
                    <button
                      onClick={() => handleDelete(device)}
                      className="btn btn-danger btn-sm"
                      title="Delete Device"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
              
              {device.model && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="grid grid-cols-1 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Model:</span>
                        <span className="ml-2 text-gray-900">{device.model}</span>
                      </div>
                  </div>
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && createPortal(
        <div className="modal-overlay fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-screen overflow-y-auto modal-scrollbar">
            <form onSubmit={handleSubmit}>
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">
                  {editingDevice ? 'Edit Device' : 'Add New Device'}
                </h3>
              </div>
              
              <div className="px-6 py-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Name *</label>
                    <input
                      type="text"
                      required
                      className="input mt-1"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Type *</label>
                    <select
                      required
                      className="input mt-1"
                      value={formData.type}
                      onChange={(e) => {
                        const newType = e.target.value;
                        setFormData({
                          ...formData, 
                          type: newType,
                          layer: newType === 'switch' ? 'layer-2' : undefined
                        });
                      }}
                    >
                      <option value="switch">Switch</option>
                      <option value="router">Router</option>
                      <option value="nexus">Nexus (NX-OS)</option>
                    </select>
                  </div>
                </div>

                {/* Layer Selection - only show for switches */}
                {formData.type === 'switch' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Switch Layer *</label>
                    <select
                      required
                      className="input mt-1"
                      value={formData.layer || 'layer-2'}
                      onChange={(e) => setFormData({...formData, layer: e.target.value})}
                    >
                      <option value="layer-2">Layer 2 (Data Link)</option>
                      <option value="layer-3">Layer 3 (Network/Routing)</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Layer 2: Switching only • Layer 3: Switching + Routing capabilities
                    </p>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">IP Address *</label>
                    <input
                      type="text"
                      required
                      placeholder="192.168.1.1"
                      className="input mt-1"
                      value={formData.ip_address}
                      onChange={(e) => setFormData({...formData, ip_address: e.target.value})}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">SSH Port</label>
                    <input
                      type="number"
                      className="input mt-1"
                      value={formData.ssh_port}
                      onChange={(e) => setFormData({...formData, ssh_port: parseInt(e.target.value)})}
                    />
                  </div>
                </div>

                {/* NETCONF Settings - show for Nexus or when enabled */}
                {(formData.type === 'nexus' || formData.netconf_enabled) && (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h4 className="text-sm font-medium text-blue-800 mb-3 flex items-center gap-2">
                      🌐 NETCONF Settings
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">NETCONF Port</label>
                        <input
                          type="number"
                          className="input mt-1"
                          value={formData.netconf_port}
                          onChange={(e) => setFormData({...formData, netconf_port: parseInt(e.target.value)})}
                        />
                        <p className="text-xs text-gray-500 mt-1">Default: 830 (RFC 6242)</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Enable NETCONF toggle - only show for non-nexus devices */}
                {formData.type !== 'nexus' && (
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="netconf_enabled"
                      className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      checked={formData.netconf_enabled}
                      onChange={(e) => setFormData({...formData, netconf_enabled: e.target.checked})}
                    />
                    <label htmlFor="netconf_enabled" className="text-sm text-gray-700">
                      Enable NETCONF for this device
                    </label>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Username *</label>
                    <input
                      type="text"
                      required
                      className="input mt-1"
                      value={formData.username}
                      onChange={(e) => setFormData({...formData, username: e.target.value})}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Password {!editingDevice && '*'} {editingDevice && <span className="text-xs text-gray-500">(leave blank to keep current password)</span>}
                    </label>
                    <input
                      type="password"
                      required={!editingDevice}
                      className="input mt-1"
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      placeholder={editingDevice ? "Leave blank to keep current password" : "Enter password"}
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    className="input mt-1"
                    rows="2"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Location</label>
                    <input
                      type="text"
                      placeholder="Data Center A"
                      className="input mt-1"
                      value={formData.location}
                      onChange={(e) => setFormData({...formData, location: e.target.value})}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Model</label>
                    <input
                      type="text"
                      placeholder="Cisco 2960"
                      className="input mt-1"
                      value={formData.model}
                      onChange={(e) => setFormData({...formData, model: e.target.value})}
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <select
                    className="input mt-1"
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>

              </div>
              
              <div className="px-6 py-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary btn-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-md"
                >
                  {editingDevice ? 'Update Device' : 'Add Device'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default Devices; 