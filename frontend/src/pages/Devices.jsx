import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  ServerIcon,
  FunnelIcon,
  SearchIcon,
  RefreshCwIcon
} from 'lucide-react';
import DeviceIcon from '../components/DeviceIcon';
import PageLoader from '../components/PageLoader';
import Pagination from '../components/Pagination';
import ZoomControls from '../components/ZoomControls';
import ConfirmationModal from '../components/ConfirmationModal';
import { useResponsive } from '../hooks/useResponsive';
import { useConfirmation } from '../hooks/useConfirmation';

function Devices() {
  const { getItemsPerPage, getSpacing, deviceType, getFormStyles } = useResponsive();
  const { confirmationState, showConfirmation } = useConfirmation();
  const ITEMS_PER_PAGE = getItemsPerPage('list');
  const spacing = getSpacing();
  const formStyles = getFormStyles();
  
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [testingDevice, setTestingDevice] = useState(null);
  const [sshSessions, setSshSessions] = useState(new Map()); // Track SSH session status
  const [connectingDevices, setConnectingDevices] = useState(new Set());
  
  // Filter states
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  
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
    enable_password: '',
    description: '',
    location: '',
    model: '',
    status: 'active'
  });

  useEffect(() => {
    fetchDevices();
    
    // Poll for SSH status updates every 30 seconds (increased from 10s for performance)
    const pollInterval = setInterval(() => {
      if (devices.length > 0) {
        fetchSshSessionStatuses();
        // Silently refresh device list to get latest ssh_status
        axios.get('/devices').then(response => {
          const devicesData = response.data.devices || [];
          setDevices(devicesData);
        }).catch(err => console.error('Error polling devices:', err));
      }
    }, 30000);
    
    return () => clearInterval(pollInterval);
  }, []);

  // Memoize filtered devices instead of using separate state
  const filteredDevices = useMemo(() => {
    let filtered = [...devices];

    // Filter by device type and layer
    if (selectedFilter !== 'all') {
      if (selectedFilter === 'layer-2') {
        filtered = filtered.filter(device => device.type === 'switch' && device.layer === 'layer-2');
      } else if (selectedFilter === 'layer-3') {
        filtered = filtered.filter(device => device.type === 'switch' && device.layer === 'layer-3');
      } else {
        filtered = filtered.filter(device => device.type === selectedFilter);
      }
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

    return filtered;
  }, [devices, selectedFilter, searchTerm]);

  // Paginated devices
  const totalPages = Math.ceil(filteredDevices.length / ITEMS_PER_PAGE);
  const paginatedDevices = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredDevices.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredDevices, currentPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedFilter, searchTerm]);

  // Memoize filter counts
  const filterCounts = useMemo(() => ({
    all: devices.length,
    'layer-2': devices.filter(d => d.type === 'switch' && d.layer === 'layer-2').length,
    'layer-3': devices.filter(d => d.type === 'switch' && d.layer === 'layer-3').length,
    router: devices.filter(d => d.type === 'router').length,
    nexus: devices.filter(d => d.type === 'nexus').length
  }), [devices]);

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

  const fetchDevices = useCallback(async (showLoadingState = false) => {
    if (showLoadingState) setLoading(true);
    try {
      const response = await axios.get('/devices');
      const devicesData = response.data.devices || [];
      setDevices(devicesData);
      
      // Fetch SSH session status using batch endpoint
      await fetchSshSessionStatuses();
    } catch (error) {
      console.error('Error fetching devices:', error);
      toast.error('Failed to fetch devices');
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, []);

  // Use batch endpoint instead of N+1 individual calls
  const fetchSshSessionStatuses = useCallback(async () => {
    try {
      const response = await axios.get('/devices/ssh/status-all');
      if (response.data.success) {
        const newSessions = new Map();
        response.data.devices.forEach(device => {
          newSessions.set(device.device_id, {
            is_connected: device.is_connected,
            session_id: device.session_id,
            connected_at: device.connected_at,
            ssh_status: device.ssh_status
          });
        });
        setSshSessions(newSessions);
      }
    } catch (error) {
      console.error('Error fetching SSH session statuses:', error);
    }
  }, []);

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

  const getFilterIcon = (type) => {
    if (type === 'all') {
      return <FunnelIcon className="h-4 w-4" />;
    }
    if (type === 'layer-2') {
      return <DeviceIcon deviceType="switch" layer="layer-2" className="h-5 w-5" />;
    }
    if (type === 'layer-3') {
      return <DeviceIcon deviceType="switch" layer="layer-3" className="h-5 w-5" />;
    }
    return <DeviceIcon 
      deviceType={type} 
      layer="layer-2" 
      className="h-5 w-5" 
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
      console.error('📋 Validation details:', error.response?.data?.details);
      console.error('📋 Validation message:', error.response?.data?.validationMessage);
      const errorMsg = error.response?.data?.validationMessage || error.response?.data?.message || error.message;
      toast.error('Error saving device: ' + errorMsg);
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
      enable_password: '', // Don't populate enable password for security
      description: device.description || '',
      location: device.location || '',
      model: device.model || '',
      status: device.status
    });
    setShowModal(true);
  };

  const handleDelete = async (device) => {
    const confirmed = await showConfirmation({
      title: 'Delete Device',
      message: `Are you sure you want to delete "${device.name}"?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger'
    });
    
    if (confirmed) {
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
      enable_password: '',
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
      className="h-10 w-10" 
    />;
  };

  if (loading && initialLoad) {
    return <PageLoader message="Loading devices..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-xl">
              <ServerIcon className="h-7 w-7 text-blue-600 dark:text-blue-400" />
            </div>
            Devices Management
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Manage your network devices (switches and routers)
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <ZoomControls />
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
      <div className="card">
        <div className="card-body">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search devices..."
                className="input pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Filter Buttons */}
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'all', label: 'All', count: filterCounts.all },
                { key: 'layer-2', label: 'L2 Switch', count: filterCounts['layer-2'] },
                { key: 'layer-3', label: 'L3 Switch', count: filterCounts['layer-3'] },
                { key: 'router', label: 'Routers', count: filterCounts.router },
                { key: 'nexus', label: 'Nexus', count: filterCounts.nexus }
              ].map(filter => (
                <button
                  key={filter.key}
                  onClick={() => setSelectedFilter(filter.key)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    selectedFilter === filter.key
                      ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-2 border-blue-200 dark:border-blue-700 shadow-sm'
                      : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 border-2 border-transparent'
                  }`}
                >
                  {getFilterIcon(filter.key)}
                  {filter.label}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    selectedFilter === filter.key
                      ? 'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200'
                      : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                  }`}>
                    {filter.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Active filters indicator */}
          {(selectedFilter !== 'all' || searchTerm) && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">Active filters:</span>
                {selectedFilter !== 'all' && (
                  <span className="px-2.5 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-medium flex items-center gap-1.5">
                    {getFilterIcon(selectedFilter)}
                    {selectedFilter === 'layer-2' ? 'Layer 2 Switch' : 
                     selectedFilter === 'layer-3' ? 'Layer 3 Switch' :
                     selectedFilter === 'router' ? 'Router' :
                     selectedFilter === 'nexus' ? 'Nexus' : selectedFilter}
                  </span>
                )}
                {searchTerm && (
                  <span className="px-2.5 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-medium">
                    Search: "{searchTerm}"
                  </span>
                )}
                <button
                  onClick={() => {
                    setSelectedFilter('all');
                    setSearchTerm('');
                  }}
                  className="text-blue-600 hover:text-blue-800 text-xs font-medium hover:underline ml-2"
                >
                  Clear all
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results Summary */}
      <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">
        Showing <span className="text-gray-900 dark:text-white">{filteredDevices.length}</span> of <span className="text-gray-900 dark:text-white">{devices.length}</span> devices
        {selectedFilter !== 'all' && ` (${
          selectedFilter === 'layer-2' ? 'Layer 2 Switches' : 
          selectedFilter === 'layer-3' ? 'Layer 3 Switches' :
          selectedFilter === 'router' ? 'Routers' :
          selectedFilter === 'nexus' ? 'Nexus devices' : selectedFilter
        } only)`}
        {searchTerm && ` matching "${searchTerm}"`}
      </div>

      {/* Devices List */}
      {filteredDevices.length === 0 ? (
        <div className="card">
          <div className="card-body">
            {devices.length === 0 ? (
              <div className="empty-state">
                <ServerIcon className="empty-state-icon" />
                <h3 className="empty-state-title">No devices found</h3>
                <p className="empty-state-description">Get started by adding your first network device</p>
                <button
                  onClick={() => {
                    resetForm();
                    setEditingDevice(null);
                    setShowModal(true);
                  }}
                  className="btn btn-primary btn-md mt-4"
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Add First Device
                </button>
              </div>
            ) : (
              <div className="empty-state">
                <FunnelIcon className="empty-state-icon" />
                <h3 className="empty-state-title">No devices match your filters</h3>
                <p className="empty-state-description">
                  Try adjusting your search term or filter selection
                </p>
                <button
                  onClick={() => {
                    setSelectedFilter('all');
                    setSearchTerm('');
                  }}
                  className="btn btn-secondary btn-md mt-4"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          {paginatedDevices.map((device) => {
            const deviceId = device.id || device._id;
            return (
            <div key={deviceId} className="card card-hover">
              <div className="card-body py-2 px-3">
                {/* Single Row Layout */}
                <div className="flex items-center justify-between">
                  {/* Left: Device Info */}
                  <div className="flex items-center space-x-2">
                    <div className={`flex-shrink-0 p-1.5 rounded ${device.status === 'active' ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400' : device.status === 'inactive' ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'}`}>
                      {getDeviceIcon(device)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">{device.name}</span>
                        <span className="text-xs px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-500 dark:text-gray-400">
                          {device.type}{device.type === 'switch' && device.layer && ` (${device.layer === 'layer-2' ? 'L2' : 'L3'})`}
                        </span>
                        <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{device.ip_address}</span>
                        {device.location && <span className="text-xs text-gray-400">• {device.location}</span>}
                      </div>
                    </div>
                  </div>
                  
                  {/* Right: Status + Actions */}
                  <div className="flex items-center gap-2">
                    {/* Status badges */}
                    <span className={`badge text-xs ${getStatusBadge(device.status)}`}>{device.status}</span>
                    {device.ssh_status === 'connected' && (
                      <span className="badge badge-success text-xs">• SSH Connected</span>
                    )}
                    {(device.type === 'nexus' || device.netconf_enabled) && (
                      <span className="badge badge-cyan text-xs">🌐 NETCONF</span>
                    )}
                    
                    {/* Divider */}
                    <div className="w-px h-5 bg-gray-200 dark:bg-gray-700"></div>
                    
                    {/* Action buttons */}
                    <button onClick={() => handleTestConnection(device)} disabled={testingDevice === deviceId} className="btn btn-primary btn-sm" aria-label="Test SSH connection">
                      {testingDevice === deviceId ? 'Testing...' : 'Test SSH'}
                    </button>
                    {device.ssh_status === 'connected' ? (
                      <button onClick={() => handleSshDisconnect(device)} disabled={connectingDevices.has(deviceId)} className="btn btn-warning btn-sm" aria-label="Disconnect SSH">Disconnect</button>
                    ) : (
                      <button onClick={() => handleSshConnect(device)} disabled={connectingDevices.has(deviceId)} className="btn btn-success btn-sm" aria-label="Connect SSH">Connect</button>
                    )}
                    <button onClick={() => handleEdit(device)} className="btn btn-secondary btn-sm" aria-label="Edit device"><PencilIcon className="h-3.5 w-3.5" /></button>
                    <button onClick={() => handleDelete(device)} className="btn btn-danger btn-sm" aria-label="Delete device"><TrashIcon className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {filteredDevices.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredDevices.length}
          itemsPerPage={ITEMS_PER_PAGE}
          onPageChange={setCurrentPage}
        />
      )}

      {/* Modal */}
      {showModal && createPortal(
        <div className="modal-overlay fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full mx-4 max-h-screen overflow-y-auto modal-scrollbar animate-fade-in ${formStyles.modalWidth}`}>
            <form onSubmit={handleSubmit}>
              <div className={`border-b border-gray-100 dark:border-gray-700 ${formStyles.modalPadding}`}>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {editingDevice ? 'Edit Device' : 'Add New Device'}
                </h3>
                <p className={`${formStyles.labelSize} text-gray-500 dark:text-gray-400 mt-1`}>
                  {editingDevice ? 'Update device configuration' : 'Configure a new network device'}
                </p>
              </div>
              
              <div className={`${formStyles.modalPadding} ${formStyles.formGap}`}>
                <div className={`grid grid-cols-1 md:grid-cols-2 ${formStyles.gridGap}`}>
                  <div>
                    <label className={`block ${formStyles.labelSize} font-medium text-gray-700 dark:text-gray-300`}>Name *</label>
                    <input
                      type="text"
                      required
                      className="input mt-1"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  
                  <div>
                    <label className={`block ${formStyles.labelSize} font-medium text-gray-700 dark:text-gray-300`}>Type *</label>
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
                    <label className={`block ${formStyles.labelSize} font-medium text-gray-700 dark:text-gray-300`}>Switch Layer *</label>
                    <select
                      required
                      className="input mt-1"
                      value={formData.layer || 'layer-2'}
                      onChange={(e) => setFormData({...formData, layer: e.target.value})}
                    >
                      <option value="layer-2">Layer 2 (Data Link)</option>
                      <option value="layer-3">Layer 3 (Network/Routing)</option>
                    </select>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Layer 2: Switching only • Layer 3: Switching + Routing capabilities
                    </p>
                  </div>
                )}
                
                <div className={`grid grid-cols-1 md:grid-cols-2 ${formStyles.gridGap}`}>
                  <div>
                    <label className={`block ${formStyles.labelSize} font-medium text-gray-700 dark:text-gray-300`}>IP Address *</label>
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
                    <label className={`block ${formStyles.labelSize} font-medium text-gray-700 dark:text-gray-300`}>SSH Port</label>
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
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
                    <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-3 flex items-center gap-2">
                      🌐 NETCONF Settings
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">NETCONF Port</label>
                        <input
                          type="number"
                          className="input mt-1"
                          value={formData.netconf_port}
                          onChange={(e) => setFormData({...formData, netconf_port: parseInt(e.target.value)})}
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Default: 830 (RFC 6242)</p>
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
                      className="h-4 w-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                      checked={formData.netconf_enabled}
                      onChange={(e) => setFormData({...formData, netconf_enabled: e.target.checked})}
                    />
                    <label htmlFor="netconf_enabled" className={`${formStyles.labelSize} text-gray-700 dark:text-gray-300`}>
                      Enable NETCONF for this device
                    </label>
                  </div>
                )}
                
                <div className={`grid grid-cols-1 md:grid-cols-2 ${formStyles.gridGap}`}>
                  <div>
                    <label className={`block ${formStyles.labelSize} font-medium text-gray-700 dark:text-gray-300`}>Username *</label>
                    <input
                      type="text"
                      required
                      className="input mt-1"
                      value={formData.username}
                      onChange={(e) => setFormData({...formData, username: e.target.value})}
                    />
                  </div>
                  
                  <div>
                    <label className={`block ${formStyles.labelSize} font-medium text-gray-700 dark:text-gray-300`}>
                      Password {!editingDevice && '*'}
                    </label>
                    <input
                      type="password"
                      required={!editingDevice}
                      className="input mt-1"
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      placeholder={editingDevice ? "Keep current" : ""}
                    />
                    {editingDevice && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Leave blank to keep current</p>
                    )}
                  </div>
                </div>
                
                <div>
                  <label className={`block ${formStyles.labelSize} font-medium text-gray-700 dark:text-gray-300`}>Description</label>
                  <textarea
                    className="input mt-1"
                    rows={formStyles.textareaRows}
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                  />
                </div>
                
                <div className={`grid grid-cols-1 md:grid-cols-2 ${formStyles.gridGap}`}>
                  <div>
                    <label className={`block ${formStyles.labelSize} font-medium text-gray-700 dark:text-gray-300`}>Location</label>
                    <input
                      type="text"
                      placeholder="Data Center A"
                      className="input mt-1"
                      value={formData.location}
                      onChange={(e) => setFormData({...formData, location: e.target.value})}
                    />
                  </div>
                  
                  <div>
                    <label className={`block ${formStyles.labelSize} font-medium text-gray-700 dark:text-gray-300`}>Model</label>
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
                  <label className={`block ${formStyles.labelSize} font-medium text-gray-700 dark:text-gray-300`}>Status</label>
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
              
              <div className={`${formStyles.modalPadding} bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700 flex justify-end space-x-3 rounded-b-2xl`}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className={`btn btn-secondary ${formStyles.buttonSize}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`btn btn-primary ${formStyles.buttonSize}`}
                >
                  {editingDevice ? 'Update Device' : 'Add Device'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmationState.isOpen}
        onConfirm={confirmationState.onConfirm}
        onCancel={confirmationState.onCancel}
        title={confirmationState.title}
        message={confirmationState.message}
        confirmText={confirmationState.confirmText}
        cancelText={confirmationState.cancelText}
        type={confirmationState.type}
      />
    </div>
  );
}

export default Devices; 