import { useState, useEffect } from 'react';
import { 
  XCircleIcon, 
  CheckCircleIcon, 
  ClockIcon,
  AlertTriangleIcon,
  ServerIcon,
  Archive,
  Loader2
} from 'lucide-react';

function BackupProgressModal({ isOpen, onClose, scheduleResults }) {
  const [progress, setProgress] = useState({
    preDeployment: { status: 'pending', message: '' },
    deployment: { status: 'pending', message: '' },
    postDeployment: { status: 'pending', message: '' },
    schedules: []
  });

  useEffect(() => {
    if (scheduleResults) {
      setProgress(prev => ({
        ...prev,
        schedules: scheduleResults.schedules || []
      }));
    }
  }, [scheduleResults]);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'in-progress':
        return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />;
      case 'complete':
        return <CheckCircleIcon className="h-5 w-5 text-green-600" />;
      case 'failed':
        return <XCircleIcon className="h-5 w-5 text-red-600" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'in-progress':
        return 'bg-blue-50 border-blue-200';
      case 'complete':
        return 'bg-green-50 border-green-200';
      case 'failed':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  if (!isOpen) return null;

  const hasSchedules = progress.schedules && progress.schedules.length > 0;
  const totalDevicesBackedUp = progress.schedules.reduce((sum, s) => sum + (s.devices_backed_up || 0), 0);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center">
                <Archive className="h-6 w-6 text-blue-600 mr-2" />
                Post-Deployment Backup Summary
              </h3>
              <button
                onClick={onClose}
                className="rounded-md text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              {hasSchedules ? (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-900">
                          {progress.schedules.length} schedule{progress.schedules.length !== 1 ? 's' : ''} triggered
                        </p>
                        <p className="text-sm text-blue-700">
                          {totalDevicesBackedUp} device{totalDevicesBackedUp !== 1 ? 's' : ''} backed up successfully
                        </p>
                      </div>
                      <CheckCircleIcon className="h-8 w-8 text-blue-600" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-gray-900">Schedule Details:</h4>
                    {progress.schedules.map((schedule, index) => (
                      <div 
                        key={index}
                        className={`border rounded-lg p-4 ${getStatusColor(schedule.result?.success ? 'complete' : 'failed')}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              {getStatusIcon(schedule.result?.success ? 'complete' : 'failed')}
                              <span className="font-medium text-gray-900">
                                {schedule.schedule_name}
                              </span>
                            </div>
                            <div className="text-sm text-gray-600 space-y-1">
                              <p className="flex items-center">
                                <ServerIcon className="h-4 w-4 mr-2" />
                                {schedule.devices_backed_up} device{schedule.devices_backed_up !== 1 ? 's' : ''} backed up
                              </p>
                              {schedule.result?.results && (
                                <div className="ml-6 mt-2 space-y-1">
                                  {schedule.result.results.map((result, idx) => (
                                    <div key={idx} className="flex items-center text-xs">
                                      {result.success ? (
                                        <CheckCircleIcon className="h-3 w-3 text-green-600 mr-1" />
                                      ) : (
                                        <XCircleIcon className="h-3 w-3 text-red-600 mr-1" />
                                      )}
                                      <span>{result.device_name}</span>
                                      {result.backup_id && (
                                        <span className="text-gray-500 ml-1">
                                          (Backup ID: {result.backup_id.toString().substring(0, 8)}...)
                                        </span>
                                      )}
                                      {result.error && (
                                        <span className="text-red-600 ml-1">- {result.error}</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                  <AlertTriangleIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 mb-1">No post-deployment schedules configured</p>
                  <p className="text-sm text-gray-500">
                    You can create post-deployment schedules in the Backup Management page
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-primary btn-md w-full sm:w-auto"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BackupProgressModal;
