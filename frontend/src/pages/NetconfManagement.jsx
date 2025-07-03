import React, { useState, useEffect } from 'react';
import { 
  WifiIcon, 
  CodeBracketIcon, 
  DocumentTextIcon, 
  PlayIcon, 
  StopIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ArrowPathIcon,
  CpuChipIcon,
  CogIcon,
  EyeIcon,
  ClipboardDocumentIcon
} from '@heroicons/react/24/outline';

const NetconfManagement = () => {
  const [devices, setDevices] = useState([]);
  const [yangModels, setYangModels] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [selectedYangModel, setSelectedYangModel] = useState(null);
  const [activeTab, setActiveTab] = useState('sessions');
  const [loading, setLoading] = useState(false);
  const [connectionResult, setConnectionResult] = useState(null);
  const [configData, setConfigData] = useState('');
  const [operationalData, setOperationalData] = useState('');
  const [generatedXml, setGeneratedXml] = useState('');
  const [xmlPrompt, setXmlPrompt] = useState('');

  const API_BASE_URL = 'http://localhost:3001/api';

  useEffect(() => {
    fetchDevices();
    fetchYangModels();
    fetchActiveSessions();
  }, []);

  const fetchDevices = async () => {
    try {
      console.log(`🔍 Fetching NETCONF-enabled devices from ${API_BASE_URL}/devices`);
      const response = await fetch(`${API_BASE_URL}/devices`);
      const data = await response.json();
      console.log('📥 API Response:', data);
      
      if (data.success && data.devices) {
        // Filter for NETCONF-enabled devices only
        const allDevices = data.devices || [];
        const filteredDevices = allDevices.filter(device => device.netconf_enabled);
        
        setDevices(filteredDevices);
        console.log(`📱 Loaded ${filteredDevices.length} NETCONF-enabled devices (Total: ${allDevices.length})`);
        
        if (filteredDevices.length === 0 && allDevices.length > 0) {
          console.warn('⚠️ No NETCONF-enabled devices found. Consider enabling NETCONF on devices.');
        }
      } else {
        console.error('❌ Invalid API response structure:', data);
        setDevices([]);
      }
    } catch (error) {
      console.error('❌ Error fetching devices:', error);
      setDevices([]);
    }
  };

  const fetchYangModels = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/netconf/yang-models`);
      const data = await response.json();
      if (data.success) {
        setYangModels(data.data.models);
      }
    } catch (error) {
      console.error('Error fetching YANG models:', error);
    }
  };

  const fetchActiveSessions = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/netconf/sessions`);
      const data = await response.json();
      if (data.success) {
        setActiveSessions(data.data.sessions);
      }
    } catch (error) {
      console.error('Error fetching active sessions:', error);
    }
  };

  const testConnection = async (deviceId) => {
    setLoading(true);
    setConnectionResult(null);
    try {
      const response = await fetch(`${API_BASE_URL}/netconf/test-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId })
      });
      const data = await response.json();
      setConnectionResult(data);
      if (data.success) {
        fetchActiveSessions(); // Refresh sessions
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      setConnectionResult({
        success: false,
        message: 'Connection test failed',
        error: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const connectDevice = async (deviceId) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/netconf/connect/${deviceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await response.json();
      if (data.success) {
        alert('NETCONF session established successfully!');
        fetchActiveSessions();
      } else {
        alert(`Connection failed: ${data.message}`);
      }
    } catch (error) {
      console.error('Error connecting device:', error);
      alert('Connection failed');
    } finally {
      setLoading(false);
    }
  };

  const disconnectSession = async (sessionId) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/netconf/disconnect/${sessionId}`, {
        method: 'POST'
      });
      const data = await response.json();
      if (data.success) {
        alert('NETCONF session disconnected successfully!');
        fetchActiveSessions();
      } else {
        alert(`Disconnect failed: ${data.message}`);
      }
    } catch (error) {
      console.error('Error disconnecting session:', error);
      alert('Disconnect failed');
    } finally {
      setLoading(false);
    }
  };

  const getConfiguration = async (sessionId, datastore = 'running') => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/netconf/config/${sessionId}?datastore=${datastore}`);
      const data = await response.json();
      if (data.success) {
        setConfigData(JSON.stringify(data.data.config, null, 2));
      } else {
        alert(`Failed to get configuration: ${data.message}`);
      }
    } catch (error) {
      console.error('Error getting configuration:', error);
      alert('Failed to get configuration');
    } finally {
      setLoading(false);
    }
  };

  const getOperationalData = async (sessionId) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/netconf/operational/${sessionId}`);
      const data = await response.json();
      if (data.success) {
        setOperationalData(JSON.stringify(data.data.operationalData, null, 2));
      } else {
        alert(`Failed to get operational data: ${data.message}`);
      }
    } catch (error) {
      console.error('Error getting operational data:', error);
      alert('Failed to get operational data');
    } finally {
      setLoading(false);
    }
  };

  const generateNetconfXml = async () => {
    if (!xmlPrompt.trim()) {
      alert('Please enter a prompt for XML generation');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/netconf/generate-xml`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: xmlPrompt,
          device_id: selectedDevice?._id,
          yang_model: selectedYangModel?.name
        })
      });
      const data = await response.json();
      if (data.success) {
        setGeneratedXml(data.data.generated_xml);
      } else {
        alert(`Failed to generate XML: ${data.message}`);
      }
    } catch (error) {
      console.error('Error generating XML:', error);
      alert('Failed to generate XML');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'sessions', name: 'Active Sessions', icon: WifiIcon },
    { id: 'devices', name: 'NETCONF Devices', icon: CpuChipIcon },
    { id: 'yang', name: 'YANG Models', icon: DocumentTextIcon },
    { id: 'operations', name: 'Operations', icon: CogIcon },
    { id: 'generator', name: 'XML Generator', icon: CodeBracketIcon }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <WifiIcon className="h-8 w-8 text-blue-600" />
              NETCONF/YANG Management
            </h1>
            <p className="mt-2 text-gray-600">
              Manage NETCONF sessions, YANG models, and network configurations
            </p>
          </div>
          <button
            onClick={fetchActiveSessions}
            disabled={loading}
            className="btn btn-primary btn-md"
          >
            <ArrowPathIcon className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mt-6">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Active Sessions Tab */}
      {activeTab === 'sessions' && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">Active NETCONF Sessions</h2>
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
                      onClick={() => disconnectSession(session.sessionId)}
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
                        <div className="mt-2 pl-4 space-y-1">
                          {session.capabilities.slice(0, 5).map((capability, idx) => (
                            <div key={idx} className="text-gray-600 text-xs font-mono">
                              {capability}
                            </div>
                          ))}
                          {session.capabilities.length > 5 && (
                            <div className="text-gray-500 text-xs">
                              ... and {session.capabilities.length - 5} more
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
        </div>
      )}

      {/* NETCONF Devices Tab */}
      {activeTab === 'devices' && (
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
                onClick={fetchDevices}
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
                    </div>
                    <span className={`badge ${
                      device.status === 'active' ? 'badge-success' : 'badge-warning'
                    }`}>
                      {device.status}
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    <button
                      onClick={() => testConnection(device._id)}
                      disabled={loading}
                      className="btn btn-secondary btn-sm w-full"
                    >
                      <PlayIcon className="h-4 w-4 mr-2" />
                      Test Connection
                    </button>
                    <button
                      onClick={() => connectDevice(device._id)}
                      disabled={loading || !device.netconf_enabled}
                      className="btn btn-primary btn-sm w-full"
                    >
                      <WifiIcon className="h-4 w-4 mr-2" />
                      Connect
                    </button>
                  </div>
                  
                  {device.netconf_capabilities && device.netconf_capabilities.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-600">
                        {device.netconf_capabilities.length} capabilities available
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900 mb-2">Connection Information</h4>
            <div className="text-sm text-blue-800 space-y-1">
              <p>• Total Devices: {devices.length}</p>
              <p>• Active Sessions: {activeSessions.length}</p>
            </div>
          </div>
        </div>
      )}

      {/* YANG Models Tab */}
      {activeTab === 'yang' && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">YANG Models</h2>
            <button
              onClick={fetchYangModels}
              disabled={loading}
              className="btn btn-secondary btn-sm"
            >
              <ArrowPathIcon className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
          
          {yangModels.length === 0 ? (
            <div className="text-center py-12">
              <DocumentTextIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No YANG models found</h3>
              <p className="text-gray-500">Load YANG models to see them here</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {yangModels.map((model) => (
                <div key={model._id} className="card p-4">
                  <h3 className="font-medium text-gray-900 mb-2">{model.name}</h3>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>Vendor: {model.vendor}</p>
                    <p>Version: {model.revision}</p>
                    <p>Namespace: {model.namespace}</p>
                  </div>
                  <button
                    onClick={() => setSelectedYangModel(model)}
                    className="btn btn-secondary btn-sm w-full mt-3"
                  >
                    Select Model
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Operations Tab */}
      {activeTab === 'operations' && (
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
                  onClick={() => navigator.clipboard.writeText(configData)}
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
                  onClick={() => navigator.clipboard.writeText(operationalData)}
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
      )}

      {/* XML Generator Tab */}
      {activeTab === 'generator' && (
        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">NETCONF XML Generator</h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Target Device (Optional)
                  </label>
                  <select
                    value={selectedDevice?._id || ''}
                    onChange={(e) => {
                      const device = devices.find(d => d._id === e.target.value);
                      setSelectedDevice(device || null);
                    }}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">Select device...</option>
                    {devices.map((device) => (
                      <option key={device._id} value={device._id}>
                        {device.name} ({device.ip_address})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    YANG Model (Optional)
                  </label>
                  <select
                    value={selectedYangModel?._id || ''}
                    onChange={(e) => {
                      const model = yangModels.find(m => m._id === e.target.value);
                      setSelectedYangModel(model || null);
                    }}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">Select YANG model...</option>
                    {yangModels.map((model) => (
                      <option key={model._id} value={model._id}>
                        {model.name} ({model.vendor})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Configuration Prompt
                </label>
                <textarea
                  value={xmlPrompt}
                  onChange={(e) => setXmlPrompt(e.target.value)}
                  placeholder="Describe the configuration you want to generate... (e.g., 'Configure VLAN 100 with IP 192.168.1.1/24')"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  rows="4"
                />
              </div>
              
              <button
                onClick={generateNetconfXml}
                disabled={loading || !xmlPrompt.trim()}
                className="btn btn-primary btn-md"
              >
                <CodeBracketIcon className="h-4 w-4 mr-2" />
                {loading ? 'Generating...' : 'Generate NETCONF XML'}
              </button>
            </div>
          </div>
          
          {/* Generated XML Display */}
          {generatedXml && (
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Generated NETCONF XML</h3>
                <button
                  onClick={() => navigator.clipboard.writeText(generatedXml)}
                  className="btn btn-secondary btn-sm"
                >
                  <ClipboardDocumentIcon className="h-4 w-4 mr-2" />
                  Copy XML
                </button>
              </div>
              <pre className="bg-gray-50 p-4 rounded-lg overflow-auto max-h-96 text-sm">
                <code>{generatedXml}</code>
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NetconfManagement; 