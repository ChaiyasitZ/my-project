import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  CheckCircleIcon, 
  XCircleIcon,
  Loader2,
  ServerIcon,
  WifiIcon,
  TerminalIcon,
  SaveIcon,
  Archive,
  AlertTriangleIcon,
  XIcon
} from 'lucide-react';

// Backup creation steps
const BACKUP_STEPS = [
  { id: 'connect', label: 'Connecting to device', icon: WifiIcon },
  { id: 'authenticate', label: 'Authenticating', icon: ServerIcon },
  { id: 'running', label: 'Retrieving running config', icon: TerminalIcon },
  { id: 'startup', label: 'Retrieving startup config', icon: TerminalIcon },
  { id: 'save', label: 'Saving backup', icon: SaveIcon },
];

function BackupCreationModal({ 
  isOpen, 
  onClose, 
  deviceName,
  backupName,
  currentStep,  // 'connect' | 'authenticate' | 'running' | 'startup' | 'save' | 'complete' | 'error'
  error,
  onRetry
}) {
  const [elapsedTime, setElapsedTime] = useState(0);

  // Timer for elapsed time
  useEffect(() => {
    if (!isOpen || currentStep === 'complete' || currentStep === 'error') {
      return;
    }

    const timer = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, currentStep]);

  // Reset timer when modal opens
  useEffect(() => {
    if (isOpen) {
      setElapsedTime(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getStepStatus = (stepId) => {
    const stepOrder = BACKUP_STEPS.map(s => s.id);
    const currentIndex = stepOrder.indexOf(currentStep);
    const stepIndex = stepOrder.indexOf(stepId);

    if (currentStep === 'complete') return 'complete';
    if (currentStep === 'error') {
      if (stepIndex < currentIndex) return 'complete';
      if (stepIndex === currentIndex) return 'error';
      return 'pending';
    }
    if (stepIndex < currentIndex) return 'complete';
    if (stepIndex === currentIndex) return 'in-progress';
    return 'pending';
  };

  const getStepIcon = (step, status) => {
    const IconComponent = step.icon;
    
    switch (status) {
      case 'complete':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'in-progress':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'error':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      default:
        return <IconComponent className="h-5 w-5 text-gray-300 dark:text-gray-600" />;
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const isComplete = currentStep === 'complete';
  const isError = currentStep === 'error';

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={isComplete || isError ? onClose : undefined}
      ></div>
      
      {/* Modal Container */}
      <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full pointer-events-auto animate-fade-in">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${
                  isComplete ? 'bg-green-100 dark:bg-green-900/30' :
                  isError ? 'bg-red-100 dark:bg-red-900/30' :
                  'bg-blue-100 dark:bg-blue-900/30'
                }`}>
                  {isComplete ? (
                    <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                  ) : isError ? (
                    <XCircleIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
                  ) : (
                    <Archive className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {isComplete ? 'Backup Complete' : isError ? 'Backup Failed' : 'Creating Backup'}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {deviceName}
                  </p>
                </div>
              </div>
              {(isComplete || isError) && (
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
          <div className="px-6 py-5">
            {/* Backup name */}
            <div className="mb-5 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Backup Name</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{backupName}</p>
            </div>

            {/* Progress Steps */}
            <div className="space-y-3">
              {BACKUP_STEPS.map((step, index) => {
                const status = getStepStatus(step.id);
                return (
                  <div 
                    key={step.id}
                    className={`flex items-center space-x-3 p-3 rounded-lg transition-all duration-300 ${
                      status === 'in-progress' ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' :
                      status === 'complete' ? 'bg-green-50/50 dark:bg-green-900/10' :
                      status === 'error' ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' :
                      'bg-gray-50/50 dark:bg-gray-700/30'
                    }`}
                  >
                    <div className="flex-shrink-0">
                      {getStepIcon(step, status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${
                        status === 'in-progress' ? 'text-blue-700 dark:text-blue-300' :
                        status === 'complete' ? 'text-green-700 dark:text-green-400' :
                        status === 'error' ? 'text-red-700 dark:text-red-300' :
                        'text-gray-400 dark:text-gray-500'
                      }`}>
                        {step.label}
                      </p>
                    </div>
                    {status === 'in-progress' && (
                      <span className="text-xs text-blue-500 dark:text-blue-400 font-mono">
                        {formatTime(elapsedTime)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Error Message */}
            {isError && error && (
              <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-start space-x-3">
                  <AlertTriangleIcon className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800 dark:text-red-200">Error</p>
                    <p className="text-sm text-red-600 dark:text-red-300 mt-1">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Success Message */}
            {isComplete && (
              <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center space-x-3">
                  <CheckCircleIcon className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-800 dark:text-green-200">
                      Backup created successfully!
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                      Completed in {formatTime(elapsedTime)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-700 rounded-b-xl">
            <div className="flex justify-end space-x-3">
              {isError && onRetry && (
                <button
                  onClick={onRetry}
                  className="btn btn-primary btn-md"
                >
                  Retry
                </button>
              )}
              {(isComplete || isError) && (
                <button
                  onClick={onClose}
                  className="btn btn-secondary btn-md"
                >
                  {isComplete ? 'Done' : 'Close'}
                </button>
              )}
              {!isComplete && !isError && (
                <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Please wait...
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default BackupCreationModal;
