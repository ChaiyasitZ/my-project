import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  TestTubeIcon,
  ServerIcon,
  WifiIcon,
  AlertCircleIcon
} from 'lucide-react';

function Devices() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [testingDevice, setTestingDevice] = useState(null);
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
    ios_version: '',
    status: 'active'
  });

  useEffect(() => {
    fetchDevices();
  }, []);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingDevice) {
        await axios.put(`/devices/${editingDevice.id}`, formData);
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
      ip_address: device.ip_address,
      ssh_port: device.ssh_port,
      username: device.username,
      password: '', // Don't populate password for security
      description: device.description || '',
      location: device.location || '',
      model: device.model || '',
      ios_version: device.ios_version || '',
      status: device.status
    });
    setShowModal(true);
  };

  const handleDelete = async (device) => {
    if (window.confirm(`Are you sure you want to delete ${device.name}?`)) {
      try {
        await axios.delete(`/devices/${device.id}`);
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
    setTestingDevice(device.id);
    const toastId = toast.loading(`Testing SSH connection to ${device.name}...`);
    
    try {
      const response = await axios.post(`/devices/${device.id}/test`);
      
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
      ip_address: '',
      ssh_port: 22,
      username: '',
      password: '',
      description: '',
      location: '',
      model: '',
      ios_version: '',
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

  const getDeviceIcon = (type) => {
    return type === 'router' ? <WifiIcon className="h-5 w-5" /> : <ServerIcon className="h-5 w-5" />;
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Devices</h1>
          <p className="mt-2 text-gray-600">
            Manage your network devices (switches and routers)
          </p>
        </div>
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
      </div>

      {/* Devices List */}
      {devices.length === 0 ? (
        <div className="card p-12 text-center">
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
        </div>
      ) : (
        <div className="grid gap-6">
          {devices.map((device) => (
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
                      disabled={testingDevice === device.id}
                      className="btn btn-secondary btn-sm"
                      title="Test Connection"
                    >
                      {testingDevice === device.id ? (
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
              
              {(device.model || device.ios_version) && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {device.model && (
                      <div>
                        <span className="text-gray-500">Model:</span>
                        <span className="ml-2 text-gray-900">{device.model}</span>
                      </div>
                    )}
                    {device.ios_version && (
                      <div>
                        <span className="text-gray-500">IOS Version:</span>
                        <span className="ml-2 text-gray-900">{device.ios_version}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-screen overflow-y-auto">
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
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    className="input mt-1"
                    rows="2"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">IOS Version</label>
                    <input
                      type="text"
                      placeholder="15.2(4)S7"
                      className="input mt-1"
                      value={formData.ios_version}
                      onChange={(e) => setFormData({...formData, ios_version: e.target.value})}
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
        </div>
      )}
    </div>
  );
}

export default Devices; 