import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
  RefreshCwIcon,
  RotateCcwIcon
} from 'lucide-react';
import PageLoader from '../components/PageLoader';
import Pagination from '../components/Pagination';
import ZoomControls from '../components/ZoomControls';
import ConfirmationModal from '../components/ConfirmationModal';
import { useResponsive } from '../hooks/useResponsive';
import { useConfirmation } from '../hooks/useConfirmation';

function ConfigurationHistory() {
  const { getItemsPerPage } = useResponsive();
  const { confirmationState, showConfirmation } = useConfirmation();
  const defaultItemsPerPage = getItemsPerPage('list');
  
  const [configurations, setConfigurations] = useState([]);
  const [groupedConfigurations, setGroupedConfigurations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [clearingAll, setClearingAll] = useState(false);
  const [filter, setFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(defaultItemsPerPage);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showRollbackModal, setShowRollbackModal] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState(null);
  const [rollbackReason, setRollbackReason] = useState('');
  const [isRollingBack, setIsRollingBack] = useState(false);
  const fetchConfigurations = useCallback(async () => {
    try {
      const url = filter === 'all' ? '/configurations/history' : `/configurations/history?status=${filter}`;
      const response = await axios.get(url);
      const configs = response.data.configurations || [];
      setConfigurations(configs);
      // Sort by created_at (newest first)
      const sortedConfigs = configs.sort((a, b) => b.created_at - a.created_at);
      setGroupedConfigurations(sortedConfigs);
    } catch (error) {
      console.error('Error fetching configurations:', error);
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchConfigurations();
  }, [fetchConfigurations]);

  // Manage modal body class
  useEffect(() => {
    if (showModal || showRollbackModal) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    
    // Cleanup on unmount
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showModal, showRollbackModal]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  // Handle items per page change
  const handleItemsPerPageChange = useCallback((newSize) => {
    setItemsPerPage(newSize);
    setCurrentPage(1); // Reset to first page when changing page size
  }, []);

  // Paginated configurations
  const totalPages = Math.ceil(groupedConfigurations.length / itemsPerPage);
  const paginatedConfigurations = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return groupedConfigurations.slice(start, start + itemsPerPage);
  }, [groupedConfigurations, currentPage, itemsPerPage]);

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
    const configurationsToDelete = applyFilters();
    
    if (configurationsToDelete.length === 0) {
      console.warn('⚠️ No configurations to delete with current filters');
      toast.error('No configurations to delete with current filters');
      return;
    }

    const confirmed = await showConfirmation({
      title: 'Delete Configurations',
      message: `Are you sure you want to delete ${configurationsToDelete.length} configuration${configurationsToDelete.length > 1 ? 's' : ''}?\n\nThis action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger'
    });

    if (confirmed) {
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

  // Open rollback confirmation modal
  const openRollbackModal = (config) => {
    setRollbackTarget(config);
    setRollbackReason('');
    setShowRollbackModal(true);
  };

  // Execute rollback
  const handleRollback = async () => {
    if (!rollbackTarget) return;
    
    setIsRollingBack(true);
    const toastId = toast.loading(`Rolling back to configuration for ${rollbackTarget.device_name}...`);
    
    try {
      const response = await axios.post(`/configurations/${rollbackTarget.id}/rollback`, {
        reason: rollbackReason || 'User initiated rollback'
      });
      
      if (response.data.success) {
        toast.success(response.data.message, { id: toastId });
        setShowRollbackModal(false);
        setRollbackTarget(null);
        setRollbackReason('');
        fetchConfigurations();
      } else {
        toast.error(response.data.message || 'Rollback failed', { id: toastId });
      }
    } catch (error) {
      console.error('❌ Rollback error:', error);
      toast.error(error.response?.data?.message || 'Failed to rollback configuration', { id: toastId });
    } finally {
      setIsRollingBack(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      generated: 'badge-info',
      deployed: 'badge-success',
      failed: 'badge-danger',
      rolled_back: 'badge-warning'
    };
    return styles[status] || 'badge-info';
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'deployed':
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

  if (loading && initialLoad) {
    return <PageLoader message="Loading history..." />;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <div className="p-1.5 bg-cyan-100 dark:bg-cyan-900/50 rounded-lg">
              <HistoryIcon className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
            </div>
            Configuration History
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
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
          
          <ZoomControls />
          
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
              <FilterIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter by Status:</span>
            </div>
            
            {/* Filter Buttons */}
            <div className="flex items-center space-x-2">
              {[
                { key: 'all', label: 'All', count: groupedConfigurations.length },
                { key: 'generated', label: 'Generated', count: groupedConfigurations.filter(c => c.status === 'generated').length },
                { key: 'deployed', label: 'Deployed', count: groupedConfigurations.filter(c => c.status === 'deployed').length },
                { key: 'failed', label: 'Failed', count: groupedConfigurations.filter(c => c.status === 'failed').length }
              ].map((filterOption) => (
                <button
                  key={filterOption.key}
                  onClick={() => setFilter(filterOption.key)}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    filter === filterOption.key
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {filterOption.label}
                  {filterOption.count > 0 && (
                    <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${
                      filter === filterOption.key
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                    }`}>
                      {filterOption.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
          
          {filter !== 'all' && groupedConfigurations.length > 0 && (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Showing {groupedConfigurations.length} {filter} configuration{groupedConfigurations.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {/* Configurations List */}
      {groupedConfigurations.length === 0 ? (
        <div className="card p-12 text-center">
          <ClockIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No configurations found</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {filter === 'all' 
              ? 'No configurations have been generated yet' 
              : `No configurations with status "${filter}" found`
            }
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {paginatedConfigurations.map((item) => (
            <div key={item.id} className="card">
              <div className="p-3">
                {/* Row 1: Device Info & Status */}
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      {getStatusIcon(item.status)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{item.device_name}</h3>
                        <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-400">
                          {item.device_type}
                        </span>
                        <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{item.ip_address}</span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-1 max-w-xl">{item.prompt}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`badge ${getStatusBadge(item.status)}`}>{item.status}</span>
                  </div>
                </div>
                
                {/* Row 2: Metadata & Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <span>Created: {formatDate(item.created_at)}</span>
                    {item.deployed_at && <span>Deployed: {formatDate(item.deployed_at)}</span>}
                    {item.rolled_back_at && (
                      <span className="text-yellow-600 dark:text-yellow-400">Rolled back: {formatDate(item.rolled_back_at)}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => viewDetails(item)} className="btn btn-secondary btn-sm" title="View Details" aria-label="View configuration details">
                      <EyeIcon className="h-4 w-4" />
                    </button>
                    <button onClick={() => deleteConfiguration(item.id)} className="btn btn-danger btn-sm" title="Delete" aria-label="Delete configuration">
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                
                {/* Conditional: Error/Rollback messages */}
                {item.status === 'rolled_back' && item.rollback_reason && (
                  <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded text-xs text-yellow-600 dark:text-yellow-400">
                    <strong>Rollback:</strong> {item.rollback_reason}
                  </div>
                )}
                {item.error_message && (
                  <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded text-xs text-red-600 dark:text-red-400">
                    <strong>Error:</strong> {item.error_message}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {groupedConfigurations.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={groupedConfigurations.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={handleItemsPerPageChange}
          showPageSizeSelector={true}
        />
      )}

      {/* Configuration Details Modal */}
      {showModal && selectedConfig && createPortal(
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => setShowModal(false)}
          ></div>
          
          {/* Modal Container */}
          <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto modal-scrollbar pointer-events-auto animate-fade-in">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Configuration Details
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
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
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Device Information</h4>
                  <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg space-y-1">
                    <p className="text-sm dark:text-gray-300"><strong>Name:</strong> {selectedConfig.device_name}</p>
                    <p className="text-sm dark:text-gray-300"><strong>Type:</strong> {selectedConfig.device_type}</p>
                    <p className="text-sm dark:text-gray-300"><strong>IP:</strong> {selectedConfig.ip_address}</p>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Configuration Status</h4>
                  <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg space-y-1">
                    <div className="flex items-center">
                      <span className="text-sm dark:text-gray-300 mr-2"><strong>Status:</strong></span>
                      <span className={`badge ${getStatusBadge(selectedConfig.status)}`}>
                        {selectedConfig.status}
                      </span>
                    </div>
                    <p className="text-sm dark:text-gray-300"><strong>Created:</strong> {formatDate(selectedConfig.created_at)}</p>
                    {selectedConfig.deployed_at && (
                      <p className="text-sm dark:text-gray-300"><strong>Deployed:</strong> {formatDate(selectedConfig.deployed_at)}</p>
                    )}
                    {selectedConfig.deployment_time && (
                      <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                        <strong>⚡ Deployment Time:</strong> {(selectedConfig.deployment_time / 1000).toFixed(2)}s 
                        <span className="text-gray-500 dark:text-gray-400 ml-2">({selectedConfig.deployment_time}ms)</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Original Prompt */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Original Prompt</h4>
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <p className="text-sm text-gray-800 dark:text-gray-200">{selectedConfig.prompt}</p>
                </div>
              </div>
              
              {/* Generated Configuration */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Generated Configuration</h4>
                <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">
                    {selectedConfig.generated_config}
                  </pre>
                </div>
              </div>
              
              {/* AI Explanation */}
              {selectedConfig.explanation && selectedConfig.explanation.success && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">AI Explanation</h4>
                  <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg">
                    <p className="text-sm text-blue-800 dark:text-blue-300 whitespace-pre-wrap">
                      {selectedConfig.explanation.explanation}
                    </p>
                  </div>
                </div>
              )}
              
              {/* Deployed Configuration (if different) */}
              {selectedConfig.deployed_config && selectedConfig.deployed_config !== selectedConfig.generated_config && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Deployed Configuration</h4>
                  <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                    <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">
                      {selectedConfig.deployed_config}
                    </pre>
                  </div>
                </div>
              )}
              
              {/* Error Message */}
              {selectedConfig.error_message && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Error Details</h4>
                  <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-lg border border-red-200 dark:border-red-700">
                    <p className="text-sm text-red-600 dark:text-red-400">{selectedConfig.error_message}</p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="btn btn-secondary btn-md"
              >
                Close
              </button>
            </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Rollback Confirmation Modal */}
      {showRollbackModal && rollbackTarget && createPortal(
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => !isRollingBack && setShowRollbackModal(false)}
          ></div>
          
          {/* Modal Container */}
          <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full pointer-events-auto animate-fade-in">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                    <RotateCcwIcon className="h-5 w-5 text-yellow-500" />
                    Rollback Configuration
                  </h3>
                  <button
                    onClick={() => !isRollingBack && setShowRollbackModal(false)}
                    disabled={isRollingBack}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50"
                  >
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              
              <div className="px-6 py-4 space-y-4">
                <div className="bg-yellow-50 dark:bg-yellow-900/30 p-4 rounded-lg border border-yellow-200 dark:border-yellow-700">
                  <p className="text-sm text-yellow-800 dark:text-yellow-300">
                    <strong>Warning:</strong> This will deploy the selected configuration to the device, 
                    replacing the current active configuration.
                  </p>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg space-y-2">
                  <p className="text-sm dark:text-gray-300">
                    <strong>Device:</strong> {rollbackTarget.device_name}
                  </p>
                  <p className="text-sm dark:text-gray-300">
                    <strong>Configuration:</strong> {rollbackTarget.prompt?.substring(0, 100)}
                    {rollbackTarget.prompt?.length > 100 ? '...' : ''}
                  </p>
                  <p className="text-sm dark:text-gray-300">
                    <strong>Originally Deployed:</strong> {formatDate(rollbackTarget.deployed_at)}
                  </p>
                </div>
                
                <div>
                  <label htmlFor="rollbackReason" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Reason for Rollback (Optional)
                  </label>
                  <textarea
                    id="rollbackReason"
                    value={rollbackReason}
                    onChange={(e) => setRollbackReason(e.target.value)}
                    placeholder="e.g., Configuration caused network issues"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                    rows={3}
                    disabled={isRollingBack}
                  />
                </div>
              </div>
              
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 flex justify-end space-x-3">
                <button
                  onClick={() => setShowRollbackModal(false)}
                  disabled={isRollingBack}
                  className="btn btn-secondary btn-md"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRollback}
                  disabled={isRollingBack}
                  className="btn btn-warning btn-md"
                >
                  {isRollingBack ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Rolling back...
                    </>
                  ) : (
                    <>
                      <RotateCcwIcon className="h-4 w-4 mr-2" />
                      Confirm Rollback
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmationState.isOpen}
        onConfirm={confirmationState.onConfirm}
        onClose={confirmationState.onCancel}
        title={confirmationState.title}
        message={confirmationState.message}
        confirmText={confirmationState.confirmText}
        cancelText={confirmationState.cancelText}
        type={confirmationState.type}
      />
    </div>
  );
}

export default ConfigurationHistory; 