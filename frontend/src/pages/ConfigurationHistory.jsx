import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { 
  ClockIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  AlertTriangleIcon,
  EyeIcon,
  TrashIcon,
  FilterIcon,
  Trash2Icon,
  HistoryIcon,
  RefreshCwIcon
} from 'lucide-react';

function ConfigurationHistory() {
  const [configurations, setConfigurations] = useState([]);
  const [groupedConfigurations, setGroupedConfigurations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clearingAll, setClearingAll] = useState(false);
  const [filter, setFilter] = useState('all');
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  // Group configurations by session_id
  const groupConfigurations = useCallback((configs) => {
    const groups = {};
    const singleConfigs = [];

    configs.forEach(config => {
      if (config.session_id && config.multi_device_session) {
        if (!groups[config.session_id]) {
          groups[config.session_id] = {
            session_id: config.session_id,
            prompt: config.prompt,
            created_at: config.created_at,
            execution_time: config.execution_time,
            topology_image: config.topology_image,
            vision_enhanced: config.vision_enhanced,
            ai_model: config.ai_model,
            method: config.method,
            devices: [],
            isGroup: true
          };
        }
        groups[config.session_id].devices.push(config);
      } else {
        singleConfigs.push(config);
      }
    });

    // Convert groups object to array and sort by created_at
    const groupsArray = Object.values(groups).map(group => ({
      ...group,
      devices: group.devices.sort((a, b) => a.device_name.localeCompare(b.device_name)),
      status: group.devices.every(d => d.status === 'applied') ? 'applied' : 
              group.devices.some(d => d.status === 'failed') ? 'failed' : 'generated'
    }));

    // Combine and sort by created_at (newest first)
    const allItems = [...groupsArray, ...singleConfigs].sort((a, b) => b.created_at - a.created_at);
    
    return allItems;
  }, []);

  const fetchConfigurations = useCallback(async () => {
    try {
      const url = filter === 'all' ? '/configurations/history' : `/configurations/history?status=${filter}`;
      const response = await axios.get(url);
      const configs = response.data.configurations || [];
      setConfigurations(configs);
      setGroupedConfigurations(groupConfigurations(configs));
    } catch (error) {
      console.error('Error fetching configurations:', error);
    } finally {
      setLoading(false);
    }
  }, [filter, groupConfigurations]);

  useEffect(() => {
    fetchConfigurations();
  }, [fetchConfigurations]);

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

  const toggleGroupExpansion = (sessionId) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sessionId)) {
        newSet.delete(sessionId);
      } else {
        newSet.add(sessionId);
      }
      return newSet;
    });
  };

  const applyFilters = () => {
    return groupedConfigurations;
  };

  const viewDetails = async (config) => {
    setSelectedConfig(config);
    setShowModal(true);
  };

  const deleteConfiguration = async (configId) => {
    try {
      await axios.delete(`/configurations/${configId}`);
      console.log('✅ Configuration deleted successfully');
      toast.success('Configuration deleted successfully!');
      fetchConfigurations();
      if (selectedConfig?.id === configId) {
        setSelectedConfig(null);
      }
    } catch (error) {
      console.error('❌ Error deleting configuration:', error.response?.data?.message || error.message);
      toast.error('Failed to delete configuration: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleClearAll = async () => {
    // Get configurations that match the current filter
    const groupedItems = applyFilters();
    
    if (groupedItems.length === 0) {
      console.warn('⚠️ No configurations to delete with current filters');
      toast.error('No configurations to delete with current filters');
      return;
    }

    // Flatten grouped configurations to get all individual configs to delete
    const configurationsToDelete = [];
    groupedItems.forEach(item => {
      if (item.isGroup) {
        configurationsToDelete.push(...item.devices);
      } else {
        configurationsToDelete.push(item);
      }
    });

    const confirmationMessage = `Are you sure you want to delete ${configurationsToDelete.length} configuration${configurationsToDelete.length > 1 ? 's' : ''} across ${groupedItems.length} session${groupedItems.length > 1 ? 's' : ''}?\n\nThis action cannot be undone.`;

    if (window.confirm(confirmationMessage)) {
      setClearingAll(true);
      const toastId = toast.loading(`Deleting ${configurationsToDelete.length} configurations...`);
      
      try {
        // Delete configurations in parallel
        await Promise.all(
          configurationsToDelete.map(config => 
            axios.delete(`/configurations/${config.id}`)
          )
        );
        
        console.log(`✅ Successfully deleted ${configurationsToDelete.length} configurations!`);
        toast.success(`Successfully deleted ${configurationsToDelete.length} configurations!`, { id: toastId });
        fetchConfigurations();
        
        // Clear selection if it was deleted
        if (selectedConfig && configurationsToDelete.some(c => c.id === selectedConfig.id)) {
          setSelectedConfig(null);
        }
      } catch (error) {
        console.error('❌ Error clearing configurations:', error.response?.data?.message || error.message);
        toast.error('Failed to delete some configurations: ' + (error.response?.data?.message || error.message), { id: toastId });
      } finally {
        setClearingAll(false);
      }
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      generated: 'badge-info',
      applied: 'badge-success',
      failed: 'badge-danger',
      rolled_back: 'badge-warning'
    };
    return styles[status] || 'badge-info';
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'applied':
        return <CheckCircleIcon className="h-5 w-5 text-green-600" />;
      case 'failed':
        return <XCircleIcon className="h-5 w-5 text-red-600" />;
      case 'rolled_back':
        return <AlertTriangleIcon className="h-5 w-5 text-yellow-600" />;
      default:
        return <ClockIcon className="h-5 w-5 text-blue-600" />;
    }
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return 'Unknown date';
    
    try {
      // Handle both timestamps (numbers) and date strings
      const date = typeof dateValue === 'number' 
        ? new Date(dateValue)
        : new Date(dateValue);
      
      return isNaN(date.getTime()) ? 'Invalid date' : date.toLocaleString();
    } catch {
      return 'Invalid date';
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded"></div>
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
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <HistoryIcon className="h-8 w-8 text-blue-600" />
            Configuration History
          </h1>
          <p className="mt-2 text-gray-600">
            View and manage configuration generation history
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {/* Clear All Config Button - Always visible */}
          <button
            onClick={handleClearAll}
            disabled={clearingAll || groupedConfigurations.length === 0}
            className="btn btn-danger btn-md"
            title={groupedConfigurations.length === 0 
              ? 'No configurations to clear' 
              : `Clear ${filter === 'all' ? 'all configurations' : `all ${filter} configurations`}`
            }
          >
            {clearingAll ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Clearing...
              </>
            ) : (
              <>
                <Trash2Icon className="h-4 w-4 mr-2" />
                Clear All ({groupedConfigurations.length})
              </>
            )}
          </button>
          
          <button
            onClick={fetchConfigurations}
            disabled={loading}
            className="btn btn-secondary btn-md"
          >
            <RefreshCwIcon className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <FilterIcon className="h-5 w-5 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Filter by Status:</span>
            </div>
            
            {/* Filter Buttons */}
            <div className="flex items-center space-x-2">
              {[
                { key: 'all', label: 'All', count: groupedConfigurations.length },
                { key: 'generated', label: 'Generated', count: groupedConfigurations.filter(c => c.status === 'generated').length },
                { key: 'applied', label: 'Deployed', count: groupedConfigurations.filter(c => c.status === 'applied').length },
                { key: 'failed', label: 'Failed', count: groupedConfigurations.filter(c => c.status === 'failed').length },
                { key: 'rolled_back', label: 'Rolled Back', count: groupedConfigurations.filter(c => c.status === 'rolled_back').length }
              ].map((filterOption) => (
                <button
                  key={filterOption.key}
                  onClick={() => setFilter(filterOption.key)}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    filter === filterOption.key
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {filterOption.label}
                  {filterOption.count > 0 && (
                    <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${
                      filter === filterOption.key
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}>
                      {filterOption.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
          
          {filter !== 'all' && groupedConfigurations.length > 0 && (
            <div className="text-sm text-gray-500">
              Showing {groupedConfigurations.length} {filter} configuration{groupedConfigurations.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {/* Configurations List */}
      {groupedConfigurations.length === 0 ? (
        <div className="card p-12 text-center">
          <ClockIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No configurations found</h3>
          <p className="text-gray-500 mb-6">
            {filter === 'all' 
              ? 'No configurations have been generated yet' 
              : `No configurations with status "${filter}" found`
            }
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedConfigurations.map((item) => (
            item.isGroup ? (
              // Grouped Multi-Device Configuration
              <div key={item.session_id} className="card p-6 border-l-4 border-l-blue-500 bg-blue-50">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    <div className="flex-shrink-0 mt-1">
                      {getStatusIcon(item.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-medium text-gray-900">
                          Multi-Device Configuration ({item.devices.length} devices)
                        </h3>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded flex items-center">
                          📦 Group
                        </span>
                        {item.topology_image && item.topology_image.base64Data && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded flex items-center">
                            🖼️ Image
                          </span>
                        )}
                        {item.vision_enhanced && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded flex items-center">
                            👁️ LLaVA
                          </span>
                        )}
                      </div>
                      
                      <p className="text-gray-600 mb-3 line-clamp-2">
                        {item.prompt}
                      </p>

                      <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
                        <span>Created: {formatDate(item.created_at)}</span>
                        {item.execution_time && (
                          <span>Duration: {item.execution_time}ms</span>
                        )}
                        <span>Devices: {item.devices.map(d => d.device_name).join(', ')}</span>
                      </div>

                      {/* Device List - Collapsed/Expanded */}
                      {expandedGroups.has(item.session_id) && (
                        <div className="mt-4 space-y-2">
                          {item.devices.map((device) => (
                            <div key={device.id} className="bg-white p-3 rounded border">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <div className="flex-shrink-0">
                                    {getStatusIcon(device.status)}
                                  </div>
                                  <div>
                                    <div className="font-medium">{device.device_name}</div>
                                    <div className="text-sm text-gray-500">({device.device_type}) {device.ip_address}</div>
                                  </div>
                                  <span className={`badge ${getStatusBadge(device.status)}`}>
                                    {device.status}
                                  </span>
                                </div>
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => viewDetails(device)}
                                    className="btn btn-secondary btn-sm"
                                    title="View Details"
                                  >
                                    <EyeIcon className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => deleteConfiguration(device.id)}
                                    className="btn btn-danger btn-sm"
                                    title="Delete"
                                  >
                                    <TrashIcon className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <span className={`badge ${getStatusBadge(item.status)}`}>
                      {item.status}
                    </span>
                    
                    <button
                      onClick={() => toggleGroupExpansion(item.session_id)}
                      className="btn btn-secondary btn-sm"
                      title={expandedGroups.has(item.session_id) ? "Collapse" : "Expand"}
                    >
                      {expandedGroups.has(item.session_id) ? (
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              // Single Device Configuration
              <div key={item.id} className="card p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    <div className="flex-shrink-0 mt-1">
                      {getStatusIcon(item.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-medium text-gray-900">
                          {item.device_name}
                        </h3>
                        <span className="text-sm text-gray-500">
                          ({item.device_type})
                        </span>
                        <span className="text-sm text-gray-400">
                          {item.ip_address}
                        </span>
                        {item.topology_image && item.topology_image.base64Data && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded flex items-center">
                            🖼️ Image
                          </span>
                        )}
                        {item.vision_enhanced && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded flex items-center">
                            👁️ LLaVA
                          </span>
                        )}
                      </div>
                      
                      <p className="text-gray-600 mb-3 line-clamp-2">
                        {item.prompt}
                      </p>
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span>Created: {formatDate(item.created_at)}</span>
                        {item.applied_at && (
                          <span>Applied: {formatDate(item.applied_at)}</span>
                        )}
                        {item.execution_time && (
                          <span>Duration: {item.execution_time}ms</span>
                        )}
                      </div>
                      
                      {item.error_message && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                          <p className="text-sm text-red-600">
                            <strong>Error:</strong> {item.error_message}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <span className={`badge ${getStatusBadge(item.status)}`}>
                      {item.status}
                    </span>
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={() => viewDetails(item)}
                        className="btn btn-secondary btn-sm"
                        title="View Details"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      
                      <button
                        onClick={() => deleteConfiguration(item.id)}
                        className="btn btn-danger btn-sm"
                        title="Delete"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          ))}
        </div>
      )}

      {/* Configuration Details Modal */}
      {showModal && selectedConfig && (
        <div className="modal-overlay fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-screen overflow-y-auto modal-scrollbar">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  Configuration Details
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="px-6 py-4 space-y-6">
              {/* Configuration Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Device Information</h4>
                  <div className="bg-gray-50 p-3 rounded-lg space-y-1">
                    <p className="text-sm"><strong>Name:</strong> {selectedConfig.device_name}</p>
                    <p className="text-sm"><strong>Type:</strong> {selectedConfig.device_type}</p>
                    <p className="text-sm"><strong>IP:</strong> {selectedConfig.ip_address}</p>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Configuration Status</h4>
                  <div className="bg-gray-50 p-3 rounded-lg space-y-1">
                    <div className="flex items-center">
                      <span className="text-sm mr-2"><strong>Status:</strong></span>
                      <span className={`badge ${getStatusBadge(selectedConfig.status)}`}>
                        {selectedConfig.status}
                      </span>
                    </div>
                    <p className="text-sm"><strong>Created:</strong> {formatDate(selectedConfig.created_at)}</p>
                    {selectedConfig.applied_at && (
                      <p className="text-sm"><strong>Applied:</strong> {formatDate(selectedConfig.applied_at)}</p>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Original Prompt */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Original Prompt</h4>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-800">{selectedConfig.prompt}</p>
                </div>
              </div>

              {/* Topology Image */}
              {selectedConfig.topology_image && selectedConfig.topology_image.base64Data && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                    🖼️ Network Topology Image
                    {selectedConfig.topology_image.isVisionGenerated && (
                      <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                        👁️ LLaVA Vision
                      </span>
                    )}
                  </h4>
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="mb-3">
                      <img 
                        src={`data:${selectedConfig.topology_image.mimetype};base64,${selectedConfig.topology_image.base64Data}`}
                        alt="Network Topology"
                        className="max-w-full h-auto max-h-64 object-contain border border-gray-300 rounded"
                      />
                    </div>
                    <div className="text-xs text-gray-500 space-y-1">
                      <div><strong>Filename:</strong> {selectedConfig.topology_image.originalName}</div>
                      <div><strong>Size:</strong> {Math.round(selectedConfig.topology_image.size / 1024)} KB</div>
                      <div><strong>Uploaded:</strong> {new Date(selectedConfig.topology_image.uploadDate).toLocaleString()}</div>
                      {selectedConfig.vision_analysis && selectedConfig.vision_analysis.vision_model && (
                        <div><strong>Vision Model:</strong> {selectedConfig.vision_analysis.vision_model}</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Generated Configuration */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Generated Configuration</h4>
                <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">
                    {selectedConfig.generated_config}
                  </pre>
                </div>
              </div>
              
              {/* AI Explanation */}
              {selectedConfig.explanation && selectedConfig.explanation.success && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">AI Explanation</h4>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-blue-800 whitespace-pre-wrap">
                      {selectedConfig.explanation.explanation}
                    </p>
                  </div>
                </div>
              )}
              
              {/* Applied Configuration (if different) */}
              {selectedConfig.applied_config && selectedConfig.applied_config !== selectedConfig.generated_config && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Applied Configuration</h4>
                  <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                    <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">
                      {selectedConfig.applied_config}
                    </pre>
                  </div>
                </div>
              )}
              
              {/* Error Message */}
              {selectedConfig.error_message && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Error Details</h4>
                  <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                    <p className="text-sm text-red-600">{selectedConfig.error_message}</p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 bg-gray-50 flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="btn btn-secondary btn-md"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ConfigurationHistory; 