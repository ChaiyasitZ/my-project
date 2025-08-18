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
  RefreshCwIcon
} from 'lucide-react';
import DeviceIcon from '../components/DeviceIcon';

function Devices() {
  const [devices, setDevices] = useState([]);
  const [filteredDevices, setFilteredDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [testingDevice, setTestingDevice] = useState(null);
  
  // Filter states
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'switch',
    layer: 'layer-2',
    ip_address: '',
    ssh_port: 22,
    username: '',
    password: '',
    description: '',
    location: '',
    model: '',
    status: 'active'
  });

  useEffect(() => {
    fetchDevices();
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
    try {
      const response = await axios.get('/devices');
      setDevices(response.data.devices || []);
    } catch (error) {
      console.error('Error fetching devices:', error);
    } finally {
      setLoading(false);
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

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'switch',
      layer: 'layer-2',
      ip_address: '',
      ssh_port: 22,
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
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleTestConnection(device)}
                      disabled={testingDevice === deviceId}
                      className="btn btn-secondary btn-sm"
                      title="Test Connection"
                    >
                      {testingDevice === deviceId ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                      ) : (
                        <TestTubeIcon className="h-4 w-4" />
                      )}
                    </button>
                    
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
                      <option value="nexus">Nexus Switch</option>
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
        </div>,
        document.body
      )}
    </div>
  );
}

export default Devices; 