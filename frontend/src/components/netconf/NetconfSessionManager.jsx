import React from 'react';
import { 
  WifiIcon, 
  StopIcon,
  CheckCircleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { useConfirmation } from '../../hooks/useConfirmation';

const NetconfSessionManager = ({ 
  activeSessions, 
  loading, 
  onDisconnect, 
  onRefresh 
}) => {
  const { showConfirmation } = useConfirmation();

  const handleDisconnect = async (sessionId) => {
    const confirmed = await showConfirmation({
      title: 'Disconnect NETCONF Session',
      message: 'Are you sure you want to disconnect this NETCONF session?',
      confirmText: 'Disconnect',
      cancelText: 'Cancel',
      type: 'warning'
    });

    if (confirmed) {
      onDisconnect(sessionId);
    }
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium text-gray-900">Active NETCONF Sessions</h2>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="btn btn-secondary btn-sm"
        >
          <ArrowPathIcon className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
      
      {activeSessions.length === 0 ? (
        <div className="text-center py-12">
          <WifiIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No active NETCONF sessions</h3>
          <p className="text-gray-500 mb-6">Connect to a device to start a NETCONF session</p>
        </div>
      ) : (
        <div className="space-y-4">
          {activeSessions.map((session) => (
            <div key={session.sessionId} className="card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <CheckCircleIcon className="h-5 w-5 text-green-500" />
                    <span className="font-medium">{session.ip_address}</span>
                    <span className="text-sm text-gray-500">({session.sessionId})</span>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    Connected • {session.capabilities?.length || 0} capabilities
                  </div>
                </div>
                <button
                  onClick={() => handleDisconnect(session.sessionId)}
                  disabled={loading}
                  className="btn btn-danger btn-sm"
                >
                  <StopIcon className="h-4 w-4 mr-2" />
                  Disconnect
                </button>
              </div>
              
              {session.capabilities && session.capabilities.length > 0 && (
                <div className="mt-3">
                  <details className="text-sm">
                    <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                      View Capabilities ({session.capabilities.length})
                    </summary>
                    <div className="mt-2 pl-4 space-y-1 max-h-32 overflow-y-auto">
                      {session.capabilities.slice(0, 10).map((capability, idx) => (
                        <div key={idx} className="text-gray-600 text-xs font-mono">
                          {capability}
                        </div>
                      ))}
                      {session.capabilities.length > 10 && (
                        <div className="text-gray-500 text-xs">
                          ... and {session.capabilities.length - 10} more
                        </div>
                      )}
                    </div>
                  </details>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Session Summary */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h4 className="text-sm font-medium text-blue-900 mb-2">Session Information</h4>
        <div className="text-sm text-blue-800 space-y-1">
          <p>• Active Sessions: {activeSessions.length}</p>
          <p>• Total Capabilities: {activeSessions.reduce((sum, session) => sum + (session.capabilities?.length || 0), 0)}</p>
          <p>• Protocol: NETCONF 1.0</p>
        </div>
      </div>
    </div>
  );
};

export default NetconfSessionManager; 