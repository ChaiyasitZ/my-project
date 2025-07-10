import React, { useState } from 'react';
import { 
  CpuChipIcon, 
  PlayIcon,
  WifiIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { useConfirmation } from '../../hooks/useConfirmation';

const NetconfDeviceManager = ({ 
  devices, 
  loading, 
  onTestConnection, 
  onConnect, 
  onRefresh 
}) => {
  const [connectionResult, setConnectionResult] = useState(null);
  const { showConfirmation } = useConfirmation();

  const handleTestConnection = async (deviceId) => {
    const result = await onTestConnection(deviceId);
    setConnectionResult(result);
  };

  const handleConnect = async (deviceId) => {
    const confirmed = await showConfirmation({
      title: 'Connect NETCONF Session',
      message: 'Are you sure you want to establish a NETCONF session with this device?',
      confirmText: 'Connect',
      cancelText: 'Cancel',
      type: 'info'
    });

    if (confirmed) {
      await onConnect(deviceId);
    }
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium text-gray-900">NETCONF-Enabled Devices</h2>
        <div className="flex items-center gap-2">
          {devices.length > 0 && (
            <span className="badge badge-primary">
              {devices.length} devices
            </span>
          )}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="btn btn-secondary btn-sm"
          >
            <ArrowPathIcon className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>
      
      {connectionResult && (
        <div className={`p-4 rounded-lg mb-4 ${
          connectionResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-center gap-2">
            {connectionResult.success ? (
              <CheckCircleIcon className="h-5 w-5 text-green-500" />
            ) : (
              <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
            )}
            <span className={connectionResult.success ? 'text-green-800' : 'text-red-800'}>
              {connectionResult.message}
            </span>
          </div>
        </div>
      )}
      
      {devices.length === 0 ? (
        <div className="text-center py-12">
          <CpuChipIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No NETCONF-enabled devices found</h3>
          <p className="text-gray-500 mb-6">Enable NETCONF on devices to see them here</p>
          
          {/* Quick setup guide */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-left max-w-md mx-auto">
            <h4 className="text-sm font-medium text-blue-900 mb-2">Enable NETCONF on Cisco Nexus:</h4>
            <div className="text-sm text-blue-800 space-y-1 font-mono">
              <p>configure terminal</p>
              <p>feature netconf</p>
              <p>ssh key rsa 2048</p>
              <p>copy run start</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map((device) => (
            <div key={device._id} className="card p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-medium text-gray-900">{device.name}</h3>
                  <p className="text-sm text-gray-600">{device.type} • {device.ip_address}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    NETCONF Port: {device.netconf_port || 830}
                  </p>
                  {device.model && (
                    <p className="text-xs text-gray-500">
                      Model: {device.model}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`badge ${
                    device.status === 'active' ? 'badge-success' : 'badge-warning'
                  }`}>
                    {device.status}
                  </span>
                  {device.vendor && (
                    <span className="badge badge-gray text-xs">
                      {device.vendor}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                <button
                  onClick={() => handleTestConnection(device._id)}
                  disabled={loading}
                  className="btn btn-secondary btn-sm w-full"
                >
                  <PlayIcon className="h-4 w-4 mr-2" />
                  Test Connection
                </button>
                <button
                  onClick={() => handleConnect(device._id)}
                  disabled={loading || !device.netconf_enabled}
                  className="btn btn-primary btn-sm w-full"
                >
                  <WifiIcon className="h-4 w-4 mr-2" />
                  Connect NETCONF
                </button>
              </div>
              
              {device.netconf_capabilities && device.netconf_capabilities.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-600">
                    {device.netconf_capabilities.length} capabilities available
                  </p>
                </div>
              )}

              {/* Last connection info */}
              {device.last_connection && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    Last connection: {device.last_connection.type} • 
                    {device.last_connection.status === 'success' ? ' ✅' : ' ❌'} {device.last_connection.status}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* Device Summary */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h4 className="text-sm font-medium text-blue-900 mb-2">Device Summary</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-blue-800">
          <div>
            <span className="font-medium">Total Devices:</span>
            <span className="ml-2">{devices.length}</span>
          </div>
          <div>
            <span className="font-medium">Active:</span>
            <span className="ml-2">{devices.filter(d => d.status === 'active').length}</span>
          </div>
          <div>
            <span className="font-medium">Cisco Devices:</span>
            <span className="ml-2">{devices.filter(d => d.vendor === 'cisco').length}</span>
          </div>
          <div>
            <span className="font-medium">NETCONF Ready:</span>
            <span className="ml-2">{devices.filter(d => d.netconf_enabled).length}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NetconfDeviceManager; 