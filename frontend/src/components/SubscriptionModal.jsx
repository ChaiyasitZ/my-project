import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  CheckCircleIcon, 
  XCircleIcon,
  Loader2,
  ServerIcon,
  BellIcon,
  XIcon,
  CheckIcon,
  AlertTriangleIcon,
  Archive,
  ZapIcon
} from 'lucide-react';

function SubscriptionModal({ 
  isOpen, 
  onClose, 
  devices = [],
  onSubscribe,
  isLoading = false
}) {
  const [selectedDevices, setSelectedDevices] = useState([]);
  const [subscriptionName, setSubscriptionName] = useState('');
  const [description, setDescription] = useState('');
  const [createInitialBackup, setCreateInitialBackup] = useState(true);
  const [step, setStep] = useState('form'); // 'form' | 'progress' | 'complete' | 'error'
  const [progressData, setProgressData] = useState({
    current: 0,
    total: 0,
    currentDevice: '',
    results: []
  });
  const [error, setError] = useState(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedDevices([]);
      setSubscriptionName('');
      setDescription('');
      setCreateInitialBackup(true);
      setStep('form');
      setProgressData({ current: 0, total: 0, currentDevice: '', results: [] });
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleDevice = (deviceId) => {
    setSelectedDevices(prev => 
      prev.includes(deviceId) 
        ? prev.filter(id => id !== deviceId)
        : [...prev, deviceId]
    );
  };

  const selectAllDevices = () => {
    if (selectedDevices.length === devices.length) {
      setSelectedDevices([]);
    } else {
      setSelectedDevices(devices.map(d => d.id || d._id));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!subscriptionName.trim()) {
      setError('Please enter a subscription name');
      return;
    }
    
    if (selectedDevices.length === 0) {
      setError('Please select at least one device');
      return;
    }

    setError(null);
    setStep('progress');
    setProgressData({
      current: 0,
      total: selectedDevices.length,
      currentDevice: '',
      results: []
    });

    try {
      const result = await onSubscribe({
        name: subscriptionName,
        description,
        device_ids: selectedDevices,
        create_initial_backup: createInitialBackup
      });

      if (result.success) {
        setProgressData(prev => ({
          ...prev,
          current: selectedDevices.length,
          results: result.initial_backup_results || []
        }));
        setStep('complete');
      } else {
        setError(result.message || 'Failed to create subscription');
        setStep('error');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to create subscription');
      setStep('error');
    }
  };

  const getSelectedDeviceNames = () => {
    return devices
      .filter(d => selectedDevices.includes(d.id || d._id))
      .map(d => d.name)
      .join(', ');
  };

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={step === 'form' ? onClose : undefined}
      ></div>
      
      {/* Modal Container */}
      <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden pointer-events-auto animate-fade-in">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/50 rounded-lg">
                  <BellIcon className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Auto-Backup Subscription
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Subscribe devices to auto-backup after config deployment
                  </p>
                </div>
              </div>
              {step === 'form' && (
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <XIcon className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[60vh]">
            {step === 'form' && (
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Subscription Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Subscription Name *
                  </label>
                  <input
                    type="text"
                    value={subscriptionName}
                    onChange={(e) => setSubscriptionName(e.target.value)}
                    placeholder="e.g., Production Devices Auto-Backup"
                    className="input"
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description (optional)
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe this subscription..."
                    rows={2}
                    className="input"
                  />
                </div>

                {/* Device Selection */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Select Devices *
                    </label>
                    <button
                      type="button"
                      onClick={selectAllDevices}
                      className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      {selectedDevices.length === devices.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-48 overflow-y-auto">
                    {devices.length === 0 ? (
                      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                        <ServerIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No devices available</p>
                      </div>
                    ) : (
                      devices.map((device) => {
                        const deviceId = device.id || device._id;
                        const isSelected = selectedDevices.includes(deviceId);
                        return (
                          <div
                            key={deviceId}
                            onClick={() => toggleDevice(deviceId)}
                            className={`flex items-center justify-between p-3 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-colors ${
                              isSelected 
                                ? 'bg-orange-50 dark:bg-orange-900/20' 
                                : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                            }`}
                          >
                            <div className="flex items-center space-x-3">
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                isSelected 
                                  ? 'bg-orange-500 border-orange-500' 
                                  : 'border-gray-300 dark:border-gray-600'
                              }`}>
                                {isSelected && <CheckIcon className="h-3 w-3 text-white" />}
                              </div>
                              <ServerIcon className={`h-5 w-5 ${isSelected ? 'text-orange-600' : 'text-gray-400'}`} />
                              <div>
                                <p className={`font-medium ${isSelected ? 'text-orange-700 dark:text-orange-300' : 'text-gray-900 dark:text-white'}`}>
                                  {device.name}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {device.type} • {device.ip_address}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {selectedDevices.length} of {devices.length} devices selected
                  </p>
                </div>

                {/* Create Initial Backup Option */}
                <div className="flex items-start space-x-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <input
                    type="checkbox"
                    id="createInitialBackup"
                    checked={createInitialBackup}
                    onChange={(e) => setCreateInitialBackup(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <label htmlFor="createInitialBackup" className="font-medium text-blue-800 dark:text-blue-200 cursor-pointer">
                      Create initial backup now
                    </label>
                    <p className="text-sm text-blue-600 dark:text-blue-300">
                      Capture current configuration for all selected devices immediately
                    </p>
                  </div>
                </div>

                {/* Info Box */}
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <div className="flex items-start space-x-3">
                    <ZapIcon className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-800 dark:text-amber-200">How it works</p>
                      <ul className="text-sm text-amber-700 dark:text-amber-300 mt-1 space-y-1">
                        <li>• Initial backup captures current device configuration</li>
                        <li>• After each config deployment, a new backup is created automatically</li>
                        <li>• You can manage subscriptions in Backup Management</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                    <div className="flex items-center space-x-2">
                      <AlertTriangleIcon className="h-5 w-5 text-red-600" />
                      <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                    </div>
                  </div>
                )}
              </form>
            )}

            {step === 'progress' && (
              <div className="space-y-6">
                <div className="text-center">
                  <Loader2 className="h-12 w-12 text-orange-500 animate-spin mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                    Creating Subscription...
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {createInitialBackup 
                      ? `Backing up ${progressData.total} device(s)...`
                      : 'Setting up subscription...'}
                  </p>
                </div>
                
                {createInitialBackup && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Progress</span>
                      <span className="text-gray-900 dark:text-white font-medium">
                        {progressData.current} / {progressData.total}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(progressData.current / progressData.total) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 'complete' && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircleIcon className="h-10 w-10 text-green-600 dark:text-green-400" />
                  </div>
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                    Subscription Created!
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {selectedDevices.length} device(s) are now subscribed to auto-backup
                  </p>
                </div>

                {/* Backup Results */}
                {progressData.results.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Initial Backup Results:
                    </h5>
                    <div className="space-y-2">
                      {progressData.results.map((result, idx) => (
                        <div 
                          key={idx}
                          className={`flex items-center justify-between p-3 rounded-lg ${
                            result.success 
                              ? 'bg-green-50 dark:bg-green-900/20' 
                              : 'bg-red-50 dark:bg-red-900/20'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            {result.success ? (
                              <CheckCircleIcon className="h-5 w-5 text-green-600" />
                            ) : (
                              <XCircleIcon className="h-5 w-5 text-red-600" />
                            )}
                            <span className={result.success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}>
                              {result.device_name}
                            </span>
                          </div>
                          {result.error && (
                            <span className="text-xs text-red-600 dark:text-red-400">
                              {result.error}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 'error' && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <XCircleIcon className="h-10 w-10 text-red-600 dark:text-red-400" />
                  </div>
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                    Subscription Failed
                  </h4>
                  <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                    {error}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-700">
            <div className="flex justify-end space-x-3">
              {step === 'form' && (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    className="btn btn-secondary btn-md"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isLoading || selectedDevices.length === 0 || !subscriptionName.trim()}
                    className="btn btn-primary btn-md"
                  >
                    <Archive className="h-4 w-4 mr-2" />
                    Create Subscription
                  </button>
                </>
              )}
              
              {(step === 'complete' || step === 'error') && (
                <button
                  onClick={onClose}
                  className="btn btn-primary btn-md"
                >
                  {step === 'complete' ? 'Done' : 'Close'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default SubscriptionModal;
