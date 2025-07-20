import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  WifiIcon,
  ServerIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  CpuChipIcon,
  PlayIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CogIcon,
  LinkIcon,
  CloudArrowUpIcon,
  StopIcon
} from '@heroicons/react/24/outline';
import { useConfirmation } from '../../hooks/useConfirmation';

const NetconfDeviceManager = ({ 
  onTestConnection, 
  onConnect,
  onDisconnect
}) => {
  const [devices, setDevices] = useState([]);
  const [filteredDevices, setFilteredDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [testingDevice, setTestingDevice] = useState(null);
  const [connectionResult, setConnectionResult] = useState(null);
  
  // Filter states
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  const { showConfirmation } = useConfirmation();

  const [formData, setFormData] = useState({
    name: '',
    type: 'switch',
    ip_address: '',
    ssh_port: 22,
    username: '',
    password: '',
    description: '',
    location: '',
    model: '',
    status: 'active',
    netconf_enabled: true,
    netconf_port: 830,
    netconf_capabilities: [],
    yang_models: [],
    preferred_connection: 'netconf'
  });

  useEffect(() => {
    fetchDevices();
  }, []);

  // Filter devices whenever devices, selectedFilter, or searchTerm changes
  useEffect(() => {
    filterDevices();
  }, [devices, selectedFilter, searchTerm]);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/devices');
      setDevices(response.data.devices || []);
    } catch (error) {
      console.error('Error fetching devices:', error);
      toast.error('Failed to fetch devices');
    } finally {
      setLoading(false);
    }
  };

  const filterDevices = () => {
    // Always start with only NETCONF-enabled devices
    let filtered = devices.filter(device => device.netconf_enabled);

    // Apply additional filters on NETCONF devices
    if (selectedFilter === 'active_sessions') {
      filtered = filtered.filter(device => 
        device.last_connection?.type === 'netconf' && 
        device.last_connection?.status === 'success'
      );
    } else if (selectedFilter === 'switch') {
      filtered = filtered.filter(device => device.type === 'switch');
    } else if (selectedFilter === 'router') {
      filtered = filtered.filter(device => device.type === 'router');
    }
    // 'all' means all NETCONF devices, no additional filtering needed

    // Filter by search term
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(device => 
        device.name.toLowerCase().includes(search) ||
        device.ip_address.toLowerCase().includes(search) ||
        (device.location && device.location.toLowerCase().includes(search)) ||
        (device.model && device.model.toLowerCase().includes(search))
      );
    }

    setFilteredDevices(filtered);
  };

  const getFilterCounts = () => {
    const netconfDevices = devices.filter(d => d.netconf_enabled);
    const counts = {
      all: netconfDevices.length,
      active_sessions: netconfDevices.filter(d => 
        d.last_connection?.type === 'netconf' && 
        d.last_connection?.status === 'success'
      ).length,
      switch: netconfDevices.filter(d => d.type === 'switch').length,
      router: netconfDevices.filter(d => d.type === 'router').length
    };
    return counts;
  };

  const getFilterIcon = (type) => {
    switch (type) {
      case 'all':
        return <WifiIcon className="h-4 w-4" />;
      case 'active_sessions':
        return <LinkIcon className="h-4 w-4" />;
      case 'switch':
        return <ServerIcon className="h-4 w-4" />;
      case 'router':
        return <WifiIcon className="h-4 w-4" />;
      default:
        return <FunnelIcon className="h-4 w-4" />;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingDevice) {
        await axios.put(`/devices/${editingDevice.id}`, formData);
        console.log('✅ NETCONF Device updated successfully:', formData.name);
        toast.success(`NETCONF Device "${formData.name}" updated successfully!`);
      } else {
        await axios.post('/devices', formData);
        console.log('✅ NETCONF Device created successfully:', formData.name);
        toast.success(`NETCONF Device "${formData.name}" created successfully!`);
      }
      
      setShowModal(false);
      setEditingDevice(null);
      resetForm();
      fetchDevices();
    } catch (error) {
      console.error('❌ Error saving NETCONF device:', error.response?.data?.message || error.message);
      toast.error('Error saving device: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleEdit = (device) => {
    setEditingDevice(device);
    setFormData({
      name: device.name,
      type: device.type,
      ip_address: device.ip_address,
      ssh_port: device.ssh_port,
      username: device.username,
      password: '', // Don't populate password for security
      description: device.description || '',
      location: device.location || '',
      model: device.model || '',
      status: device.status,
      netconf_enabled: device.netconf_enabled || true,
      netconf_port: device.netconf_port || 830,
      netconf_capabilities: device.netconf_capabilities || [],
      yang_models: device.yang_models || [],
      preferred_connection: device.preferred_connection || 'netconf'
    });
    setShowModal(true);
  };

  const handleDelete = async (device) => {
    console.log('🗑️ Attempting to delete NETCONF device:', device.name, 'ID:', device.id);
    
    const confirmed = await showConfirmation({
      title: 'Delete NETCONF Device',
      message: `Are you sure you want to delete ${device.name}? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger'
    });

    if (confirmed) {
      try {
        console.log(`📤 DELETE request to: /devices/${device.id}`);
        const response = await axios.delete(`/devices/${device.id}`);
        console.log('📥 Delete response:', response.data);
        console.log('✅ NETCONF Device deleted successfully:', device.name);
        toast.success(`NETCONF Device "${device.name}" deleted successfully!`);
        fetchDevices();
      } catch (error) {
        console.error('❌ Error deleting NETCONF device:', error);
        console.error('❌ Error response:', error.response?.data);
        console.error('❌ Error status:', error.response?.status);
        toast.error('Error deleting device: ' + (error.response?.data?.message || error.message));
      }
    } else {
      console.log('❌ Device deletion cancelled by user');
    }
  };

  const handleTestConnection = async (device) => {
    setTestingDevice(device.id);
    setConnectionResult(null);
    
    try {
      const result = await onTestConnection(device.id);
      setConnectionResult(result);
    } catch (error) {
      setConnectionResult({
        success: false,
        message: error.message || 'Connection test failed'
      });
    } finally {
      setTestingDevice(null);
    }
  };

  const handleConnect = async (device) => {
    const confirmed = await showConfirmation({
      title: 'Connect NETCONF Session',
      message: `Are you sure you want to establish a NETCONF session with ${device.name}?`,
      confirmText: 'Connect',
      cancelText: 'Cancel',
      type: 'info'
    });

    if (confirmed) {
      try {
        await onConnect(device.id);
        toast.success(`NETCONF session established with ${device.name}`);
        fetchDevices(); // Refresh to show updated connection status
      } catch (error) {
        toast.error(`Failed to connect to ${device.name}: ${error.message}`);
      }
    }
  };

  const handleDisconnect = async (device) => {
    // Find the session ID for this device
    const sessionId = `${device.ip_address}:${device.netconf_port || 830}`;
    
    const confirmed = await showConfirmation({
      title: 'Disconnect NETCONF Session',
      message: `Are you sure you want to disconnect the NETCONF session with ${device.name}?`,
      confirmText: 'Disconnect',
      cancelText: 'Cancel',
      type: 'warning'
    });

    if (confirmed) {
      try {
        await onDisconnect(sessionId);
        toast.success(`NETCONF session disconnected from ${device.name}`);
        fetchDevices(); // Refresh to show updated connection status
      } catch (error) {
        toast.error(`Failed to disconnect from ${device.name}: ${error.message}`);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'switch',
      ip_address: '',
      ssh_port: 22,
      username: '',
      password: '',
      description: '',
      location: '',
      model: '',
      status: 'active',
      netconf_enabled: true,
      netconf_port: 830,
      netconf_capabilities: [],
      yang_models: [],
      preferred_connection: 'netconf'
    });
  };

  const getStatusBadge = (device) => {
    if (device.netconf_enabled) {
      if (device.last_connection?.type === 'netconf' && device.last_connection?.status === 'success') {
        return 'badge-success';
      }
      return 'badge-primary';
    }
    return 'badge-warning';
  };

  const getStatusText = (device) => {
    if (device.netconf_enabled) {
      if (device.last_connection?.type === 'netconf' && device.last_connection?.status === 'success') {
        return 'Connected';
      }
      return 'NETCONF Ready';
    }
    return 'NETCONF Disabled';
  };

  const getDeviceIcon = (type) => {
    switch (type) {
      case 'router':
        return <WifiIcon className="h-5 w-5" />;
      default:
        return <ServerIcon className="h-5 w-5" />;
    }
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
      {/* Connection Result Display */}
      {connectionResult && (
        <div className={`p-4 rounded-lg mb-4 ${
          connectionResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {connectionResult.success ? (
                <CheckCircleIcon className="h-5 w-5 text-green-500" />
              ) : (
                <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
              )}
              <span className={connectionResult.success ? 'text-green-800' : 'text-red-800'}>
                {connectionResult.message}
              </span>
            </div>
            <button
              onClick={() => setConnectionResult(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search NETCONF devices..."
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Add Device Button */}
          <button
            onClick={() => {
              resetForm();
              setEditingDevice(null);
              setShowModal(true);
            }}
            className="btn btn-primary btn-md"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Add NETCONF Device
          </button>
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2 mt-4">
          {[
            { key: 'all', label: 'All NETCONF Devices', count: filterCounts.all },
            { key: 'active_sessions', label: 'Active Sessions', count: filterCounts.active_sessions },
            { key: 'switch', label: 'Switches', count: filterCounts.switch },
            { key: 'router', label: 'Routers', count: filterCounts.router }
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

        {/* Active filters indicator */}
        {(selectedFilter !== 'all' || searchTerm) && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Active filters:</span>
              {selectedFilter !== 'all' && (
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs">
                  {selectedFilter === 'active_sessions' ? 'Active NETCONF sessions' :
                   selectedFilter === 'switch' ? 'Switches only' :
                   selectedFilter === 'router' ? 'Routers only' :
                   `Type: ${selectedFilter}`}
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
        Showing {filteredDevices.length} of {getFilterCounts().all} NETCONF devices
        {selectedFilter !== 'all' && (
          ` (${selectedFilter.replace('_', ' ')} only)`
        )}
        {searchTerm && ` matching "${searchTerm}"`}
      </div>

      {/* Devices List */}
      {filteredDevices.length === 0 ? (
        <div className="card p-12 text-center">
          {getFilterCounts().all === 0 ? (
            <>
              <WifiIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No NETCONF devices found</h3>
              <p className="text-gray-500 mb-6">
                Get started by adding your first NETCONF-enabled device
              </p>
              <button
                onClick={() => {
                  resetForm();
                  setEditingDevice(null);
                  setShowModal(true);
                }}
                className="btn btn-primary btn-md"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Add First NETCONF Device
              </button>
            </>
          ) : (
            <>
              <FunnelIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No NETCONF devices match your filters</h3>
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
          {filteredDevices.map((device) => (
            <div key={device.id} className="card p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0 text-gray-600">
                    {getDeviceIcon(device.type)}
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{device.name}</h3>
                    <p className="text-sm text-gray-500">
                      {device.type} • {device.ip_address}
                      {device.location && ` • ${device.location}`}
                    </p>
                    {device.netconf_port && device.netconf_port !== 830 && (
                      <div className="mt-1">
                        <span className="text-xs text-gray-500">NETCONF Port: {device.netconf_port}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <span className={`badge ${getStatusBadge(device)}`}>
                    {getStatusText(device)}
                  </span>
                  
                  <div className="flex space-x-2">
                    {device.netconf_enabled && (
                      <>
                        <button
                          onClick={() => handleTestConnection(device)}
                          disabled={testingDevice === device.id}
                          className="btn btn-secondary btn-sm"
                          title="Test NETCONF Connection"
                        >
                          {testingDevice === device.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                          ) : (
                            <PlayIcon className="h-4 w-4" />
                          )}
                        </button>
                        
                        <button
                          onClick={() => handleConnect(device)}
                          className="btn btn-primary btn-sm"
                          title="Connect NETCONF Session"
                        >
                          <WifiIcon className="h-4 w-4" />
                        </button>
                        
                        {device.last_connection?.type === 'netconf' && device.last_connection?.status === 'success' && (
                          <button
                            onClick={() => handleDisconnect(device)}
                            className="btn btn-warning btn-sm"
                            title="Disconnect NETCONF Session"
                          >
                            <StopIcon className="h-4 w-4" />
                          </button>
                        )}
                      </>
                    )}
                    
                    <button
                      onClick={() => handleEdit(device)}
                      className="btn btn-secondary btn-sm"
                      title="Edit Device"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    
                    <button
                      onClick={() => handleDelete(device)}
                      className="btn btn-danger btn-sm"
                      title="Delete Device"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Device Details */}
              {(device.model || (device.netconf_capabilities && device.netconf_capabilities.length > 0) || device.last_connection) && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                    {device.model && (
                      <div>
                        <span className="text-gray-500">Model:</span>
                        <span className="ml-2 text-gray-900">{device.model}</span>
                      </div>
                    )}
                    {device.netconf_capabilities && device.netconf_capabilities.length > 0 && (
                      <div>
                        <span className="text-gray-500">Capabilities:</span>
                        <span className="ml-2 text-gray-900">{device.netconf_capabilities.length}</span>
                      </div>
                    )}
                    {device.last_connection && (
                      <div>
                        <span className="text-gray-500">Last Connection:</span>
                        <span className={`ml-2 ${
                          device.last_connection.status === 'success' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {device.last_connection.type} {device.last_connection.status === 'success' ? '✅' : '❌'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Device Summary */}
      <div className="card p-4 bg-blue-50">
        <h4 className="text-sm font-medium text-blue-900 mb-2">NETCONF Device Summary</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-blue-800">
          <div>
            <span className="font-medium">Total NETCONF Devices:</span>
            <span className="ml-2">{filterCounts.all}</span>
          </div>
          <div>
            <span className="font-medium">Active Sessions:</span>
            <span className="ml-2">{filterCounts.active_sessions}</span>
          </div>
          <div>
            <span className="font-medium">Switches:</span>
            <span className="ml-2">{filterCounts.switch}</span>
          </div>
          <div>
            <span className="font-medium">Routers:</span>
            <span className="ml-2">{filterCounts.router}</span>
          </div>
        </div>
      </div>

      {/* Add/Edit Device Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-screen overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">
                  {editingDevice ? 'Edit NETCONF Device' : 'Add New NETCONF Device'}
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
                      onChange={(e) => setFormData({...formData, type: e.target.value})}
                    >
                      <option value="switch">Switch</option>
                      <option value="router">Router</option>
                    </select>
                  </div>
                </div>
                
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

                                 {/* NETCONF Configuration */}
                 <div className="border-t border-gray-200 pt-4">
                   <h4 className="text-md font-medium text-gray-900 mb-3">NETCONF Configuration</h4>
                   
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div>
                       <label className="block text-sm font-medium text-gray-700">NETCONF Port</label>
                       <input
                         type="number"
                         min="1"
                         max="65535"
                         className="input mt-1"
                         value={formData.netconf_port}
                         onChange={(e) => setFormData({...formData, netconf_port: parseInt(e.target.value)})}
                       />
                     </div>
                     
                     <div>
                       <label className="block text-sm font-medium text-gray-700">Preferred Connection</label>
                       <select
                         className="input mt-1"
                         value={formData.preferred_connection}
                         onChange={(e) => setFormData({...formData, preferred_connection: e.target.value})}
                       >
                         <option value="netconf">NETCONF</option>
                         <option value="ssh">SSH</option>
                         <option value="console">Console</option>
                       </select>
                     </div>
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
                       placeholder="Nexus 9000"
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

                                 <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                   <h4 className="text-sm font-medium text-blue-900 mb-2">
                     NETCONF Setup Instructions
                   </h4>
                   <p className="text-sm text-blue-800 mb-3">
                     Please ensure NETCONF is enabled on the device:
                   </p>
                   <div className="text-sm text-blue-800 space-y-1 font-mono bg-blue-100 p-2 rounded">
                     <p>configure terminal</p>
                     <p>feature netconf</p>
                     <p>ssh key rsa 2048</p>
                     <p>copy run start</p>
                   </div>
                 </div>
              </div>
              
              <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3">
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
        </div>
      )}
    </div>
  );
};

export default NetconfDeviceManager;