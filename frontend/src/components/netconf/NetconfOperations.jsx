import React, { useState } from 'react';
import { 
  WifiIcon, 
  EyeIcon,
  InformationCircleIcon,
  ClipboardDocumentIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const API_BASE_URL = 'http://localhost:3001/api';

const NetconfOperations = ({ activeSessions }) => {
  const [loading, setLoading] = useState(false);
  const [configData, setConfigData] = useState('');
  const [operationalData, setOperationalData] = useState('');

  const getConfiguration = async (sessionId, datastore = 'running') => {
    setLoading(true);
    const toastId = toast.loading(`Getting ${datastore} configuration...`);
    
    try {
      const response = await fetch(`${API_BASE_URL}/netconf/config/${sessionId}?datastore=${datastore}`);
      const data = await response.json();
      
      if (data.success) {
        setConfigData(JSON.stringify(data.data.config, null, 2));
        toast.success(`${datastore} configuration retrieved successfully!`, { id: toastId });
      } else {
        toast.error(`Failed to get configuration: ${data.message}`, { id: toastId });
      }
    } catch (error) {
      console.error('Error getting configuration:', error);
      toast.error('Failed to get configuration: ' + error.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const getOperationalData = async (sessionId) => {
    setLoading(true);
    const toastId = toast.loading('Getting operational data...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/netconf/operational/${sessionId}`);
      const data = await response.json();
      
      if (data.success) {
        setOperationalData(JSON.stringify(data.data.operationalData, null, 2));
        toast.success('Operational data retrieved successfully!', { id: toastId });
      } else {
        toast.error(`Failed to get operational data: ${data.message}`, { id: toastId });
      }
    } catch (error) {
      console.error('Error getting operational data:', error);
      toast.error('Failed to get operational data: ' + error.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">NETCONF Operations</h2>
        
        {activeSessions.length === 0 ? (
          <div className="text-center py-8">
            <WifiIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No active sessions. Connect to a device first.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeSessions.map((session) => (
                <div key={session.sessionId} className="card p-4">
                  <h3 className="font-medium text-gray-900 mb-2">
                    {session.ip_address} ({session.sessionId})
                  </h3>
                  <div className="space-y-2">
                    <button
                      onClick={() => getConfiguration(session.sessionId, 'running')}
                      disabled={loading}
                      className="btn btn-secondary btn-sm w-full"
                    >
                      <EyeIcon className="h-4 w-4 mr-2" />
                      Get Running Config
                    </button>
                    <button
                      onClick={() => getConfiguration(session.sessionId, 'candidate')}
                      disabled={loading}
                      className="btn btn-secondary btn-sm w-full"
                    >
                      <EyeIcon className="h-4 w-4 mr-2" />
                      Get Candidate Config
                    </button>
                    <button
                      onClick={() => getOperationalData(session.sessionId)}
                      disabled={loading}
                      className="btn btn-secondary btn-sm w-full"
                    >
                      <InformationCircleIcon className="h-4 w-4 mr-2" />
                      Get Operational Data
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Configuration Data Display */}
      {configData && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Configuration Data</h3>
            <button
              onClick={() => {
                navigator.clipboard.writeText(configData);
                toast.success('Configuration copied to clipboard!');
              }}
              className="btn btn-secondary btn-sm"
            >
              <ClipboardDocumentIcon className="h-4 w-4 mr-2" />
              Copy
            </button>
          </div>
          <pre className="bg-gray-50 p-4 rounded-lg overflow-auto max-h-96 text-sm">
            <code>{configData}</code>
          </pre>
        </div>
      )}
      
      {/* Operational Data Display */}
      {operationalData && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Operational Data</h3>
            <button
              onClick={() => {
                navigator.clipboard.writeText(operationalData);
                toast.success('Operational data copied to clipboard!');
              }}
              className="btn btn-secondary btn-sm"
            >
              <ClipboardDocumentIcon className="h-4 w-4 mr-2" />
              Copy
            </button>
          </div>
          <pre className="bg-gray-50 p-4 rounded-lg overflow-auto max-h-96 text-sm">
            <code>{operationalData}</code>
          </pre>
        </div>
      )}
    </div>
  );
};

export default NetconfOperations; 