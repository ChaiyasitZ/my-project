import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { 
  Archive,
  RefreshCwIcon,
  DownloadIcon,
  UploadIcon,
  TrashIcon,
  ClockIcon,
  ServerIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  TagIcon,
  ShieldIcon,
  FolderIcon,
  FileTextIcon,
  FilterIcon,
  PlusIcon,
  SearchIcon,
  EyeIcon,
  WifiIcon
} from 'lucide-react';
import ConfirmationModal from '../components/ConfirmationModal';
import { useConfirmation } from '../hooks/useConfirmation';

function BackupManagement() {
  // Helper function to safely parse JSON tags
  const parseTagsSafely = (tags) => {
    if (!tags) return [];
    if (Array.isArray(tags)) return tags;
    if (typeof tags === 'string') {
      if (tags.trim() === '') return [];
      try {
        return JSON.parse(tags);
      } catch (error) {
        console.warn('Failed to parse tags:', tags, error);
        return [];
      }
    }
    return [];
  };
  // Removed excessive console logging to reduce re-render noise
  
  const [backups, setBackups] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('running');
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [multiDeviceMode, setMultiDeviceMode] = useState(false);
  const [selectedDevices, setSelectedDevices] = useState([]);
  
  // Form state
  const [backupForm, setBackupForm] = useState({
    device_id: '',
    backup_name: '',
    description: '',
    backup_type: 'manual',
    config_type: 'running-config',
    tags: []
  });
  
  const [multiBackupForm, setMultiBackupForm] = useState({
    backup_name_prefix: '',
    description: '',
    backup_type: 'manual',
    config_type: 'running-config',
    tags: []
  });

  const [restoreForm, setRestoreForm] = useState({
    restore_type: 'running',
    create_checkpoint: true
  });

  const { confirmationState, showConfirmation } = useConfirmation();

  // Define fetchData before using it in useEffect
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      const [backupsResponse, devicesResponse] = await Promise.all([
        axios.get('/backups', {
          params: {
            device_id: selectedDevice || undefined,
            backup_type: filter !== 'all' ? filter : undefined,
            limit: 50
          }
        }),
        axios.get('/devices?status=active')
      ]);

      // Ensure we have proper data structure
      const backupsData = backupsResponse.data?.backups || backupsResponse.data || [];
      const devicesData = devicesResponse.data?.devices || devicesResponse.data || [];
      
      setBackups(Array.isArray(backupsData) ? backupsData : []);
      setDevices(Array.isArray(devicesData) ? devicesData : []);
    } catch (error) {
      console.error('❌ Error fetching data:', error);
      // Don't show toast during silent refresh after backup creation
      if (!creating) {
        toast.error('Failed to load data: ' + (error.response?.data?.message || error.message));
      }
      // Set empty arrays as fallback
      setBackups([]);
      setDevices([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDevice, filter, creating]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateBackup = async (e) => {
    e.preventDefault();
    if (!backupForm.device_id || !backupForm.backup_name) {
      toast.error('Please fill in all required fields');
      return;
    }

    setCreating(true);
    const toastId = toast.loading('Creating backup...');
    
    try {
      await axios.post('/backups', {
        ...backupForm,
        tags: backupForm.tags.filter(tag => tag.trim() !== '')
      });

      // Close modal and reset form first
      setShowCreateModal(false);
      setBackupForm({
        device_id: '',
        backup_name: '',
        description: '',
        backup_type: 'manual',
        config_type: 'running-config',
        tags: []
      });

      // Show success message
      console.log('✅ Backup created successfully!');
      console.log('Details:',
        `Name: ${backupForm.backup_name}\n` +
        `Device: ${(devices || []).find(d => d.id === parseInt(backupForm.device_id))?.name || 'Unknown'}\n` +
        `Type: ${backupForm.backup_type}`
      );
      
      toast.success(`Backup "${backupForm.backup_name}" created successfully!`, { id: toastId });
      
      // Refresh data after successful creation
      await fetchData();
    } catch (error) {
      console.error('❌ Error creating backup:', error);
      toast.error('Failed to create backup: ' + (error.response?.data?.message || error.message), { id: toastId });
    } finally {
      setCreating(false);
    }
  };

  const handleCreateMultiBackup = async (e) => {
    e.preventDefault();
    if (selectedDevices.length === 0 || !multiBackupForm.backup_name_prefix) {
      toast.error('Please select devices and enter a backup name prefix');
      return;
    }

    setCreating(true);
    const toastId = toast.loading(`Creating backups for ${selectedDevices.length} devices...`);
    
    try {
      // Create individual backup requests for each device
      const backupPromises = selectedDevices.map((device) => {
        return axios.post('/backups', {
          device_id: device.id,
          backup_name: `${multiBackupForm.backup_name_prefix}_${device.name}`,
          description: multiBackupForm.description || `Multi-device backup for ${device.name}`,
          backup_type: multiBackupForm.backup_type,
          tags: multiBackupForm.tags.filter(tag => tag.trim() !== '')
        });
      });

      // Wait for all backups to complete
      const results = await Promise.allSettled(backupPromises);
      
      // Count successes and failures
      const successes = results.filter(r => r.status === 'fulfilled').length;
      const failures = results.filter(r => r.status === 'rejected').length;

      // Close modal and reset form
      setShowCreateModal(false);
      setMultiBackupForm({
        backup_name_prefix: '',
        description: '',
        backup_type: 'manual',
        tags: []
      });
      setSelectedDevices([]);
      setMultiDeviceMode(false);

      // Show results
      if (failures === 0) {
        toast.success(`All ${successes} backups created successfully!`, { id: toastId });
      } else {
        toast.error(`${successes} backups created, ${failures} failed`, { id: toastId });
      }
      
      // Refresh data
      await fetchData();
    } catch (error) {
      console.error('❌ Error creating multi-device backups:', error);
      toast.error('Failed to create backups: ' + (error.response?.data?.message || error.message), { id: toastId });
    } finally {
      setCreating(false);
    }
  };

  const handleRestoreBackup = async (e) => {
    e.preventDefault();
    if (!selectedBackup || !restoreForm.restore_type) {
      toast.error('Please select a backup and restore type');
      return;
    }

    const confirmed = await showConfirmation({
      title: 'Restore Configuration',
      message: `Are you sure you want to restore "${selectedBackup.backup_name}"?\n\nThis will ${restoreForm.restore_type === 'startup-config' ? 'replace the startup configuration' : 'apply to running configuration'}.`,
      confirmText: 'Restore',
      cancelText: 'Cancel',
      type: 'warning'
    });

    if (!confirmed) return;

    setRestoring(true);
    const toastId = toast.loading(`Restoring backup "${selectedBackup.backup_name}"...`);
    
    try {
      const response = await axios.post(`/backups/${selectedBackup.id}/restore`, restoreForm);
      
      console.log('✅ Configuration restored successfully!');
      console.log('Summary:',
        `Backup: ${selectedBackup.backup_name}\n` +
        `Device: ${selectedBackup.device_name}\n` +
        `Type: ${response.data.restore_details.restore_type}\n` +
        `Checkpoint created: ${response.data.restore_details.checkpoint_created ? 'Yes' : 'No'}`);
      
      toast.success(`Backup "${selectedBackup.backup_name}" restored successfully!`, { id: toastId });
      
      setShowRestoreModal(false);
      setRestoreForm({
        restore_type: 'running-config',
        create_checkpoint: true,
        description: ''
      });
      
      fetchData();
    } catch (error) {
      console.error('❌ Error restoring backup:', error);
      toast.error('Failed to restore backup: ' + (error.response?.data?.message || error.message), { id: toastId });
    } finally {
      setRestoring(false);
    }
  };

  const handleDeleteBackup = async (backup) => {
    const confirmed = await showConfirmation({
      title: 'Delete Backup',
      message: `Are you sure you want to delete backup "${backup.backup_name}"?\n\nThis action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger'
    });

    if (!confirmed) return;

    try {
      await axios.delete(`/backups/${backup.id}`);
      console.log('✅ Backup deleted successfully!');
      toast.success(`Backup "${backup.backup_name}" deleted successfully!`);
      fetchData();
    } catch (error) {
      console.error('❌ Error deleting backup:', error);
      toast.error('Failed to delete backup: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleSetRestorePoint = async (backup) => {
    try {
      await axios.post(`/backups/${backup.id}/set-restore-point`);
      console.log(`✅ Backup "${backup.backup_name}" marked as restore point!`);
      toast.success(`Backup "${backup.backup_name}" marked as restore point!`);
      fetchData();
    } catch (error) {
      console.error('❌ Error setting restore point:', error);
      toast.error('Failed to set restore point: ' + (error.response?.data?.message || error.message));
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`;
  };

  const formatDate = (dateValue) => {
    if (!dateValue || dateValue === undefined || dateValue === null) {
      return 'No date available';
    }
    
    try {
      // Handle both timestamps (numbers) and date strings
      const date = typeof dateValue === 'number' 
        ? new Date(dateValue)
        : new Date(dateValue);
      
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      
      return date.toLocaleString();
    } catch {
      return 'Date error';
    }
  };

  const getBackupTypeIcon = (type) => {
    switch (type) {
      case 'manual':
        return <Archive className="h-4 w-4 text-blue-600" />;
      case 'scheduled':
        return <ClockIcon className="h-4 w-4 text-green-600" />;
      case 'pre_change':
        return <ShieldIcon className="h-4 w-4 text-orange-600" />;
      default:
        return <FolderIcon className="h-4 w-4 text-gray-600" />;
    }
  };

  const getBackupTypeBadge = (type) => {
    const styles = {
      manual: 'bg-blue-100 text-blue-800',
      scheduled: 'bg-green-100 text-green-800',
      pre_change: 'bg-orange-100 text-orange-800'
    };
    return styles[type] || 'bg-gray-100 text-gray-800';
  };

  const addTag = () => {
    setBackupForm({
      ...backupForm,
      tags: [...backupForm.tags, '']
    });
  };

  const updateTag = (index, value) => {
    const newTags = [...backupForm.tags];
    newTags[index] = value;
    setBackupForm({
      ...backupForm,
      tags: newTags
    });
  };

  const removeTag = (index) => {
    setBackupForm({
      ...backupForm,
      tags: backupForm.tags.filter((_, i) => i !== index)
    });
  };

  // Filter backups based on search term - ensure backups is always an array
  const filteredBackups = (backups || []).filter(backup => 
    backup?.backup_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    backup?.device_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (backup?.description && backup.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Calculate statistics - ensure safe array operations
  const stats = {
    total: (backups || []).length,
    manual: (backups || []).filter(b => b?.backup_type === 'manual').length,
    scheduled: (backups || []).filter(b => b?.backup_type === 'scheduled').length,
    restorePoints: (backups || []).filter(b => b?.is_restore_point).length,
    totalSize: (backups || []).reduce((sum, b) => sum + (b?.file_size || 0), 0)
  };

  const addDeviceToSelection = (deviceId) => {
    if (deviceId && !selectedDevices.find(d => d.id === deviceId)) {
      const device = devices.find(d => d.id === deviceId);
      if (device) {
        setSelectedDevices([...selectedDevices, device]);
      }
    }
  };

  const removeDeviceFromSelection = (deviceId) => {
    setSelectedDevices(selectedDevices.filter(d => d.id !== deviceId));
  };

  const handleTestBackup = async (device) => {
    setLoading(true);
    const toastId = toast.loading(`Testing backup for ${device.name}...`);
    
    try {
      const response = await axios.get(`/backups/test/${device.id}`);
      
      if (response.data.success) {
        const results = response.data.test_results;
        
        toast.success(
          `✅ Backup test successful!\n` +
          `📊 Running config: ${results.running_config.line_count} lines (${results.running_config.size} bytes)\n` +
          `💾 Startup config: ${results.startup_config?.success ? 'Available' : 'Not available'}\n` +
          `🔍 Contains: ${results.running_config.has_version ? 'Version ✓' : ''} ${results.running_config.has_hostname ? 'Hostname ✓' : ''} ${results.running_config.has_interfaces ? 'Interfaces ✓' : ''}`,
          { 
            id: toastId,
            duration: 8000
          }
        );
        
        console.log('🧪 Backup test results:', response.data);
        
        // Show detailed results in console for debugging
        console.log('📋 Running config preview:', results.running_config.preview);
        if (results.startup_config?.preview) {
          console.log('💾 Startup config preview:', results.startup_config.preview);
        }
        
      } else {
        toast.error(`❌ Backup test failed: ${response.data.error}`, { id: toastId });
      }
      
    } catch (error) {
      console.error('❌ Backup test error:', error);
      toast.error(`Backup test failed: ${error.response?.data?.message || error.message}`, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewBackup = async (backup) => {
    console.log('🔍 Preview button clicked for backup:', backup.backup_name);
    console.log('🔍 Backup ID:', backup.id);
    console.log('🔍 Full API URL will be:', `/backups/${backup.id}/preview`);
    
    // Test backend connectivity first
    try {
      console.log('🧪 Testing backend connectivity...');
      const healthCheck = await axios.get('/backups');
      console.log('✅ Backend is accessible, backups response:', healthCheck.status);
    } catch (healthError) {
      console.error('❌ Backend connectivity test failed:', healthError);
      toast.error('Backend server is not accessible. Please start the server.');
      return;
    }
    
    setPreviewLoading(true);
    setShowPreviewModal(true);
    setPreviewData(null);
    setActiveTab('running');
    
    const toastId = toast.loading(`Loading preview for ${backup.backup_name}...`);
    
    try {
      console.log('🚀 Making API request to:', `/backups/${backup.id}/preview`);
      const response = await axios.get(`/backups/${backup.id}/preview`);
      
      if (response.data.success) {
        setPreviewData(response.data);
        toast.success(`Preview loaded successfully!`, { id: toastId });
        console.log('🔍 Preview data:', response.data);
      } else {
        toast.error(`Failed to load preview: ${response.data.message}`, { id: toastId });
        setShowPreviewModal(false);
      }
      
    } catch (error) {
      console.error('❌ Preview error:', error);
      toast.error(`Failed to load preview: ${error.response?.data?.message || error.message}`, { id: toastId });
      setShowPreviewModal(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <ShieldIcon className="h-8 w-8 text-blue-600" />
            Backup Management
          </h1>
          <p className="mt-2 text-gray-600">
            Create, restore, and manage device configuration backups
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Backup
          </button>
          <button
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <RefreshCwIcon className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Archive className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Backups</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ClockIcon className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Manual</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.manual}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ShieldIcon className="h-8 w-8 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Restore Points</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.restorePoints}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ServerIcon className="h-8 w-8 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Devices</p>
              <p className="text-2xl font-semibold text-gray-900">{(devices || []).length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <FileTextIcon className="h-8 w-8 text-indigo-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Size</p>
              <p className="text-2xl font-semibold text-gray-900">{formatFileSize(stats.totalSize)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0 lg:space-x-6">
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 flex-1">
            {/* Search */}
            <div className="relative flex-1 max-w-xs">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <SearchIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Search backups..."
              />
            </div>

            {/* Device Filter */}
            <div className="flex-1 max-w-xs">
              <select
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Devices</option>
                {(devices || []).map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.name} ({device.type})
                  </option>
                ))}
              </select>
            </div>

            {/* Type Filter */}
            <div className="flex-1 max-w-xs">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Types</option>
                <option value="manual">Manual</option>
                <option value="scheduled">Scheduled</option>
                <option value="pre_change">Pre-Change</option>
              </select>
            </div>
          </div>

          <div className="text-sm text-gray-500">
            {filteredBackups.length} of {(backups || []).length} backups
          </div>
        </div>
      </div>

      {/* Backup List */}
      {loading ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading backups...</p>
          </div>
        </div>
      ) : filteredBackups.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
          <div className="text-center">
            <Archive className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {(backups || []).length === 0 ? 'No backups found' : 'No backups match your search'}
            </h3>
            <p className="text-gray-600 mb-6">
              {(backups || []).length === 0 
                ? 'Create your first backup to get started'
                : 'Try adjusting your search or filter criteria'
              }
            </p>
            {(backups || []).length === 0 && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Create First Backup
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredBackups.map((backup) => (
            <div key={backup.id} className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              {/* Card Header */}
              <div className="p-6 pb-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    {getBackupTypeIcon(backup.backup_type)}
                    <h3 className="text-lg font-semibold text-gray-900 truncate">
                      {backup.backup_name}
                    </h3>
                  </div>
                  {backup.is_restore_point && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                      <ShieldIcon className="h-3 w-3 mr-1" />
                      Restore Point
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-2 mb-3">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getBackupTypeBadge(backup.backup_type)}`}>
                    {backup.backup_type.replace('_', ' ')}
                  </span>
                </div>

                {backup.description && (
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {backup.description}
                  </p>
                )}
              </div>

              {/* Card Body */}
              <div className="px-6 pb-4">
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center">
                    <ServerIcon className="h-4 w-4 mr-2 text-gray-400" />
                    <span className="truncate">{backup.device_name} ({backup.device_type})</span>
                  </div>
                  <div className="flex items-center">
                    <FileTextIcon className="h-4 w-4 mr-2 text-gray-400" />
                    <span>{formatFileSize(backup.file_size)}</span>
                  </div>
                  <div className="flex items-center">
                    <ClockIcon className="h-4 w-4 mr-2 text-gray-400" />
                    <span>{formatDate(backup.createdAt || backup.created_at)}</span>
                  </div>
                </div>

                {/* Tags */}
                {(() => {
                  const tags = parseTagsSafely(backup.tags);
                  return tags.length > 0 && (
                    <div className="mt-3">
                      <div className="flex flex-wrap gap-1">
                        {tags.slice(0, 3).map((tag, index) => (
                          <span key={index} className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-800">
                            {tag}
                          </span>
                        ))}
                        {tags.length > 3 && (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-800">
                            +{tags.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Card Footer */}
              <div className="px-6 py-4 bg-gray-50 rounded-b-lg">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => {
                      setSelectedBackup(backup);
                      setShowRestoreModal(true);
                    }}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <UploadIcon className="h-3 w-3 mr-1" />
                    Restore
                  </button>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handlePreviewBackup(backup)}
                      title="Preview Configuration"
                      className="inline-flex items-center px-3 py-1.5 border border-blue-300 text-xs font-medium rounded text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <EyeIcon className="h-3 w-3" />
                    </button>
                    {!backup.is_restore_point && (
                      <>
                        <button
                          onClick={() => handleSetRestorePoint(backup)}
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          <ShieldIcon className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteBackup(backup)}
                          className="inline-flex items-center px-3 py-1.5 border border-red-300 text-xs font-medium rounded text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                          <TrashIcon className="h-3 w-3" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Backup Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowCreateModal(false)}></div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Create New Backup</h3>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="rounded-md text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <XCircleIcon className="h-6 w-6" />
                  </button>
                </div>

                {/* Mode Selection */}
                <div className="mb-4">
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={!multiDeviceMode}
                        onChange={() => setMultiDeviceMode(false)}
                        className="mr-2"
                      />
                      <span className="text-sm font-medium">Single Device</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={multiDeviceMode}
                        onChange={() => setMultiDeviceMode(true)}
                        className="mr-2"
                      />
                      <span className="text-sm font-medium">Multiple Devices</span>
                    </label>
                  </div>
                </div>

                <form onSubmit={multiDeviceMode ? handleCreateMultiBackup : handleCreateBackup} className="space-y-4">
                  {!multiDeviceMode ? (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Device *
                        </label>
                        <select
                          value={backupForm.device_id}
                          onChange={(e) => setBackupForm({ ...backupForm, device_id: e.target.value })}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          required
                        >
                          <option value="">Select a device...</option>
                          {(devices || []).map((device) => (
                            <option key={device.id} value={device.id}>
                              {device.name} ({device.type}) - {device.ip_address}
                            </option>
                          ))}
                        </select>
                        
                        {/* Test Backup Button */}
                        {backupForm.device_id && (
                          <div className="mt-2">
                            <button
                              type="button"
                              onClick={() => {
                                const device = devices.find(d => d.id === backupForm.device_id);
                                if (device) handleTestBackup(device);
                              }}
                              disabled={loading}
                              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                            >
                              <WifiIcon className="h-4 w-4 mr-2" />
                              Test Backup Connection
                            </button>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Backup Name *
                        </label>
                        <input
                          type="text"
                          value={backupForm.backup_name}
                          onChange={(e) => setBackupForm({ ...backupForm, backup_name: e.target.value })}
                          placeholder="e.g., Pre-maintenance backup"
                          className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Select Multiple Devices
                        </label>
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              addDeviceToSelection(e.target.value);
                              e.target.value = '';
                            }
                          }}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 mb-3"
                        >
                          <option value="">Add device...</option>
                          {devices.filter(d => !selectedDevices.find(sd => sd.id === d.id)).map((device) => (
                            <option key={device.id} value={device.id}>
                              {device.name} ({device.type}) - {device.ip_address}
                            </option>
                          ))}
                        </select>
                        
                        {/* Selected Devices List */}
                        {selectedDevices.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-gray-700">Selected Devices ({selectedDevices.length}):</p>
                            {selectedDevices.map((device, index) => (
                              <div key={device.id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                                <span className="text-sm">
                                  {index + 1}. {device.name} ({device.type}) - {device.ip_address}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeDeviceFromSelection(device.id)}
                                  className="text-red-600 hover:text-red-800 text-sm"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Backup Name Prefix *
                        </label>
                        <input
                          type="text"
                          value={multiBackupForm.backup_name_prefix}
                          onChange={(e) => setMultiBackupForm({ ...multiBackupForm, backup_name_prefix: e.target.value })}
                          placeholder="e.g., Pre-maintenance"
                          className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Device name will be appended automatically (e.g., "Pre-maintenance_Router1")
                        </p>
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={multiDeviceMode ? multiBackupForm.description : backupForm.description}
                      onChange={(e) => {
                        if (multiDeviceMode) {
                          setMultiBackupForm({ ...multiBackupForm, description: e.target.value });
                        } else {
                          setBackupForm({ ...backupForm, description: e.target.value });
                        }
                      }}
                      placeholder="Optional description for this backup..."
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      rows="3"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Backup Type
                      </label>
                      <select
                        value={multiDeviceMode ? multiBackupForm.backup_type : backupForm.backup_type}
                        onChange={(e) => {
                          if (multiDeviceMode) {
                            setMultiBackupForm({ ...multiBackupForm, backup_type: e.target.value });
                          } else {
                            setBackupForm({ ...backupForm, backup_type: e.target.value });
                          }
                        }}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="manual">Manual</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="pre_change">Pre-Change</option>
                      </select>
                    </div>


                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tags
                    </label>
                    <div className="space-y-2">
                      {(multiDeviceMode ? multiBackupForm.tags : backupForm.tags).map((tag, index) => (
                        <div key={index} className="flex space-x-2">
                          <input
                            type="text"
                            value={tag}
                            onChange={(e) => {
                              if (multiDeviceMode) {
                                const newTags = [...multiBackupForm.tags];
                                newTags[index] = e.target.value;
                                setMultiBackupForm({ ...multiBackupForm, tags: newTags });
                              } else {
                                updateTag(index, e.target.value);
                              }
                            }}
                            placeholder="Enter tag"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (multiDeviceMode) {
                                setMultiBackupForm({
                                  ...multiBackupForm,
                                  tags: multiBackupForm.tags.filter((_, i) => i !== index)
                                });
                              } else {
                                removeTag(index);
                              }
                            }}
                            className="inline-flex items-center px-3 py-2 border border-red-300 text-sm font-medium rounded-lg text-red-700 bg-white hover:bg-red-50"
                          >
                            <XCircleIcon className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          if (multiDeviceMode) {
                            setMultiBackupForm({
                              ...multiBackupForm,
                              tags: [...multiBackupForm.tags, '']
                            });
                          } else {
                            addTag();
                          }
                        }}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50"
                      >
                        <TagIcon className="h-4 w-4 mr-2" />
                        Add Tag
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  onClick={multiDeviceMode ? handleCreateMultiBackup : handleCreateBackup}
                  disabled={creating || 
                    (multiDeviceMode ? 
                      (selectedDevices.length === 0 || !multiBackupForm.backup_name_prefix) : 
                      (!backupForm.device_id || !backupForm.backup_name)
                    )
                  }
                  className="w-full inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <Archive className="h-4 w-4 mr-2" />
                      {multiDeviceMode ? 'Create Multi Backups' : 'Create Backup'}
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-lg border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowPreviewModal(false)}></div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-6xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center">
                    <EyeIcon className="h-5 w-5 text-blue-600 mr-2" />
                    Configuration Preview
                  </h3>
                  <button
                    onClick={() => setShowPreviewModal(false)}
                    className="rounded-md text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <XCircleIcon className="h-6 w-6" />
                  </button>
                </div>

                {previewLoading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading configuration preview...</p>
                  </div>
                ) : previewData ? (
                  <div className="space-y-6">
                    {/* Backup Info */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Backup Details</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Name:</span> {previewData.backup.backup_name}
                        </div>
                        <div>
                          <span className="font-medium">Device:</span> {previewData.backup.device_name}
                        </div>
                        <div>
                          <span className="font-medium">Type:</span> {previewData.backup.backup_type}
                        </div>
                        <div>
                          <span className="font-medium">Size:</span> {formatFileSize(previewData.backup.file_size)}
                        </div>
                        <div>
                          <span className="font-medium">Created:</span> {formatDate(previewData.backup.created_at)}
                        </div>
                        <div>
                          <span className="font-medium">Running lines:</span> {previewData.preview.running_config_lines}
                        </div>
                        <div>
                          <span className="font-medium">Startup lines:</span> {previewData.preview.startup_config_lines}
                        </div>
                      </div>
                    </div>

                    {/* Configuration Tabs */}
                    <div className="border-b border-gray-200">
                      <nav className="-mb-px flex space-x-8">
                        <button
                          onClick={() => setActiveTab('running')}
                          className={`py-2 px-1 border-b-2 font-medium text-sm ${ 
                            activeTab === 'running' 
                              ? 'border-blue-500 text-blue-600' 
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          Running Configuration ({previewData.preview.running_config_lines} lines)
                        </button>
                        {previewData.content.has_startup_config && (
                          <button
                            onClick={() => setActiveTab('startup')}
                            className={`py-2 px-1 border-b-2 font-medium text-sm ${ 
                              activeTab === 'startup' 
                                ? 'border-blue-500 text-blue-600' 
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                          >
                            Startup Configuration ({previewData.preview.startup_config_lines} lines)
                          </button>
                        )}
                      </nav>
                    </div>

                    {/* Configuration Content */}
                    <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm overflow-auto max-h-96">
                      <pre className="whitespace-pre-wrap">
                        {activeTab === 'running' 
                          ? previewData.content.running_config 
                          : previewData.content.startup_config
                        }
                      </pre>
                    </div>
                    
                    {/* Download Options */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                      <div className="text-sm text-gray-600">
                        💡 Tip: You can download individual configs or copy text directly from the preview above
                      </div>
                      <div className="flex space-x-3">
                        <button
                          onClick={() => {
                            const config = activeTab === 'running' 
                              ? previewData.content.running_config 
                              : previewData.content.startup_config;
                            const filename = `${previewData.backup.backup_name}_${activeTab}_config.txt`;
                            
                            const blob = new Blob([config], { type: 'text/plain' });
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = filename;
                            document.body.appendChild(a);
                            a.click();
                            window.URL.revokeObjectURL(url);
                            document.body.removeChild(a);
                            
                            toast.success(`Downloaded ${activeTab} configuration!`);
                          }}
                          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          <DownloadIcon className="h-4 w-4 mr-2" />
                          Download {activeTab === 'running' ? 'Running' : 'Startup'} Config
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <XCircleIcon className="h-12 w-12 text-red-400 mx-auto mb-4" />
                    <p className="text-gray-600">Failed to load configuration preview</p>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(false)}
                  className="w-full inline-flex justify-center rounded-lg border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Restore Modal */}
      {showRestoreModal && selectedBackup && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowRestoreModal(false)}></div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Restore Configuration</h3>
                  <button
                    onClick={() => setShowRestoreModal(false)}
                    className="rounded-md text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <XCircleIcon className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <AlertTriangleIcon className="h-5 w-5 text-yellow-600 mr-2 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-yellow-800">Warning</p>
                        <p className="text-sm text-yellow-700 mt-1">
                          This will replace the current configuration on the device. Make sure you have a recent backup if needed.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Backup Details</h4>
                    <div className="space-y-1 text-sm text-gray-600">
                      <p><strong>Name:</strong> {selectedBackup.backup_name}</p>
                      <p><strong>Device:</strong> {selectedBackup.device_name} ({selectedBackup.device_type})</p>
                      <p><strong>Created:</strong> {formatDate(selectedBackup.createdAt || selectedBackup.created_at)}</p>
                      <p><strong>Size:</strong> {formatFileSize(selectedBackup.file_size)}</p>
                    </div>
                  </div>

                  <form onSubmit={handleRestoreBackup} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Restore Type
                      </label>
                      <select
                        value={restoreForm.restore_type}
                        onChange={(e) => setRestoreForm({ ...restoreForm, restore_type: e.target.value })}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="running">Running Configuration Only</option>
                        <option value="startup">Startup Configuration Only</option>
                        <option value="both">Both Running and Startup</option>
                      </select>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="create_checkpoint"
                        checked={restoreForm.create_checkpoint}
                        onChange={(e) => setRestoreForm({ ...restoreForm, create_checkpoint: e.target.checked })}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="create_checkpoint" className="ml-2 text-sm text-gray-700">
                        Create checkpoint before restore (recommended)
                      </label>
                    </div>

                    <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded-lg">
                      <p>💡 A checkpoint will automatically backup the current configuration before applying the restore.</p>
                    </div>
                  </form>
                </div>
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  onClick={handleRestoreBackup}
                  disabled={restoring}
                  className="w-full inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 bg-orange-600 text-base font-medium text-white hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {restoring ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Restoring...
                    </>
                  ) : (
                    <>
                      <UploadIcon className="h-4 w-4 mr-2" />
                      Restore Configuration
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRestoreModal(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-lg border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmationState.isOpen}
        onClose={confirmationState.onCancel}
        onConfirm={confirmationState.onConfirm}
        title={confirmationState.title}
        message={confirmationState.message}
        confirmText={confirmationState.confirmText}
        cancelText={confirmationState.cancelText}
        type={confirmationState.type}
        loading={confirmationState.loading}
        loadingText={confirmationState.loadingText}
      />
    </div>
  );
}

export default BackupManagement; 