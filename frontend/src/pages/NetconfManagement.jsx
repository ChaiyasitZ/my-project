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
  BeakerIcon,
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
  const [mockMode, setMockMode] = useState(false);
  const [mockXmlExamples, setMockXmlExamples] = useState({});
  const [selectedExample, setSelectedExample] = useState('');

  const API_BASE_URL = 'http://localhost:3001/api';

  useEffect(() => {
    fetchDevices();
    fetchYangModels();
    fetchActiveSessions();
    fetchMockXmlExamples();
  }, []);

  const fetchDevices = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/devices`);
      const data = await response.json();
      if (data.success) {
        // In mock mode, show all devices; in real mode, filter NETCONF-enabled devices
        const filteredDevices = mockMode 
          ? data.data.devices 
          : data.data.devices.filter(device => device.netconf_enabled);
        setDevices(filteredDevices);
      }
    } catch (error) {
      console.error('Error fetching devices:', error);
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

  const fetchMockXmlExamples = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/netconf/mock/xml-examples`);
      const data = await response.json();
      if (data.success) {
        setMockXmlExamples(data.data.examples);
      }
    } catch (error) {
      console.error('Error fetching mock XML examples:', error);
    }
  };

  const testConnection = async (deviceId) => {
    setLoading(true);
    setConnectionResult(null);
    try {
      const response = await fetch(`${API_BASE_URL}/netconf/test-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId, mock: mockMode })
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
        body: JSON.stringify({ mock: mockMode })
      });
      const data = await response.json();
      if (data.success) {
        alert(`${data.data.isMock ? 'Mock ' : ''}NETCONF session established successfully!`);
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

  const createDemoSession = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/netconf/mock/demo-session`, {
        method: 'POST'
      });
      const data = await response.json();
      if (data.success) {
        alert('Demo mock session created successfully!');
        fetchActiveSessions();
      } else {
        alert(`Failed to create demo session: ${data.message}`);
      }
    } catch (error) {
      console.error('Error creating demo session:', error);
      alert('Failed to create demo session');
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

  const loadExample = (exampleKey) => {
    if (mockXmlExamples[exampleKey]) {
      setGeneratedXml(mockXmlExamples[exampleKey]);
      setSelectedExample(exampleKey);
    }
  };

  const cleanupMockSessions = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/netconf/mock/cleanup`, {
        method: 'POST'
      });
      const data = await response.json();
      if (data.success) {
        alert(`Cleaned up ${data.data.cleaned} mock sessions`);
        fetchActiveSessions();
      } else {
        alert(`Cleanup failed: ${data.message}`);
      }
    } catch (error) {
      console.error('Error cleaning up mock sessions:', error);
      alert('Cleanup failed');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'sessions', name: 'Active Sessions', icon: WifiIcon },
    { id: 'devices', name: 'NETCONF Devices', icon: CpuChipIcon },
    { id: 'yang', name: 'YANG Models', icon: DocumentTextIcon },
    { id: 'operations', name: 'Operations', icon: CogIcon },
    { id: 'generator', name: 'XML Generator', icon: CodeBracketIcon },
    { id: 'demo', name: 'Demo & Examples', icon: BeakerIcon }
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
              {mockMode && (
                <span className="px-3 py-1 bg-orange-100 text-orange-800 text-sm font-medium rounded-full">
                  Mock Mode
                </span>
              )}
            </h1>
            <p className="mt-2 text-gray-600">
              Manage NETCONF sessions, YANG models, and network configurations
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Mock Mode Toggle */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Mock Mode</span>
              <button
                onClick={() => {
                  setMockMode(!mockMode);
                  fetchDevices(); // Refresh devices list based on mode
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  mockMode ? 'bg-orange-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    mockMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
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
            {mockMode && (
              <button
                onClick={cleanupMockSessions}
                disabled={loading}
                className="btn btn-danger btn-sm"
              >
                <XMarkIcon className="h-4 w-4 mr-2" />
                Cleanup Mock Sessions
              </button>
            )}
          </div>
          
          {activeSessions.length === 0 ? (
            <div className="text-center py-12">
              <WifiIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No active NETCONF sessions</h3>
              <p className="text-gray-500 mb-6">Connect to a device to start a NETCONF session</p>
              {mockMode && (
                <button
                  onClick={createDemoSession}
                  disabled={loading}
                  className="btn btn-primary btn-md"
                >
                  <BeakerIcon className="h-4 w-4 mr-2" />
                  Create Demo Session
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {activeSessions.map((session) => (
                <div key={session.sessionId} className={`card p-4 ${
                  session.isMock ? 'border-orange-200 bg-orange-50' : ''
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <CheckCircleIcon className="h-5 w-5 text-green-500" />
                        <span className="font-medium">{session.ip_address}</span>
                        <span className="text-sm text-gray-500">({session.sessionId})</span>
                        {session.isMock && (
                          <span className="badge badge-warning">Mock</span>
                        )}
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
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            {mockMode ? 'All Devices (Mock Mode)' : 'NETCONF-Enabled Devices'}
          </h2>
          
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
                {connectionResult.data?.isMock && (
                  <span className="badge badge-warning">Mock</span>
                )}
              </div>
              {connectionResult.data?.capabilities && (
                <div className="mt-2 text-sm text-green-700">
                  Capabilities: {connectionResult.data.capabilities.length}
                </div>
              )}
            </div>
          )}

          {devices.length === 0 ? (
            <div className="text-center py-12">
              <CpuChipIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {mockMode ? 'No devices found' : 'No NETCONF-enabled devices found'}
              </h3>
              <p className="text-gray-500">
                {mockMode ? 'Add devices to see them here' : 'Enable NETCONF on devices to see them here'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {devices.map((device) => (
                <div key={device._id} className="card p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${
                          device.status === 'active' ? 'bg-green-500' : 'bg-gray-400'
                        }`}></div>
                        <span className="font-medium">{device.name}</span>
                        <span className="text-sm text-gray-500">
                          ({device.ip_address}:{device.netconf_port || 830})
                        </span>
                        {mockMode && !device.netconf_enabled && (
                          <span className="badge badge-warning">NETCONF Disabled</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {device.vendor} {device.model} • {device.type}
                        {device.netconf_capabilities && (
                          <span className="ml-2">• {device.netconf_capabilities.length} capabilities</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => testConnection(device._id)}
                        disabled={loading}
                        className="btn btn-secondary btn-sm"
                      >
                        <PlayIcon className="h-4 w-4 mr-2" />
                        Test
                      </button>
                      <button
                        onClick={() => connectDevice(device._id)}
                        disabled={loading}
                        className="btn btn-primary btn-sm"
                      >
                        <WifiIcon className="h-4 w-4 mr-2" />
                        Connect
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* YANG Models Tab */}
      {activeTab === 'yang' && (
        <div className="card p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">YANG Models</h2>
          {yangModels.length === 0 ? (
            <div className="text-center py-12">
              <DocumentTextIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No YANG models available</h3>
              <p className="text-gray-500">Import YANG models to see them here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {yangModels.map((model) => (
                <div key={model.id} className="card p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{model.name}</span>
                        {model.revision && (
                          <span className="text-sm text-gray-500">({model.revision})</span>
                        )}
                        <span className={`badge ${
                          model.vendor === 'ietf' ? 'badge-info' : 
                          model.vendor === 'cisco' ? 'badge-success' : 
                          'badge-warning'
                        }`}>
                          {model.vendor}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {model.namespace} • {model.category}
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedYangModel(model)}
                      className={`btn btn-sm ${
                        selectedYangModel?.id === model.id
                          ? 'btn-primary'
                          : 'btn-secondary'
                      }`}
                    >
                      {selectedYangModel?.id === model.id ? 'Selected' : 'Select'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Operations Tab */}
      {activeTab === 'operations' && (
        <div className="space-y-6">
          {/* Session Selection */}
          <div className="card p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">NETCONF Operations</h2>
            {activeSessions.length === 0 ? (
              <div className="text-center py-12">
                <ExclamationTriangleIcon className="h-16 w-16 text-yellow-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No active NETCONF sessions</h3>
                <p className="text-gray-500 mb-6">Connect to a device first to perform operations</p>
                {mockMode && (
                  <button
                    onClick={createDemoSession}
                    disabled={loading}
                    className="btn btn-primary btn-md"
                  >
                    <BeakerIcon className="h-4 w-4 mr-2" />
                    Create Demo Session
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {activeSessions.map((session) => (
                  <div key={session.sessionId} className={`card p-4 ${
                    session.isMock ? 'border-orange-200 bg-orange-50' : ''
                  }`}>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <span className="font-medium">{session.ip_address}</span>
                        <span className="text-sm text-gray-500 ml-2">({session.sessionId})</span>
                        {session.isMock && (
                          <span className="ml-2 badge badge-warning">Mock</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <button
                        onClick={() => getConfiguration(session.sessionId, 'running')}
                        disabled={loading}
                        className="btn btn-primary btn-sm"
                      >
                        <DocumentTextIcon className="h-4 w-4 mr-2" />
                        Get Running Config
                      </button>
                      <button
                        onClick={() => getConfiguration(session.sessionId, 'candidate')}
                        disabled={loading}
                        className="btn btn-secondary btn-sm"
                      >
                        <DocumentTextIcon className="h-4 w-4 mr-2" />
                        Get Candidate Config
                      </button>
                      <button
                        onClick={() => getOperationalData(session.sessionId)}
                        disabled={loading}
                        className="btn btn-secondary btn-sm"
                      >
                        <InformationCircleIcon className="h-4 w-4 mr-2" />
                        Get Operational Data
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Configuration Data Display */}
          {(configData || operationalData) && (
            <div className="card p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {configData ? 'Configuration Data' : 'Operational Data'}
              </h3>
              <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">
                  {configData || operationalData}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* XML Generator Tab */}
      {activeTab === 'generator' && (
        <div className="card p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">NETCONF XML Generator</h2>
          
          <div className="space-y-6">
            {/* Device and YANG Model Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Device (Optional)
                </label>
                <select
                  value={selectedDevice?._id || ''}
                  onChange={(e) => setSelectedDevice(devices.find(d => d._id === e.target.value) || null)}
                  className="input"
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
                  value={selectedYangModel?.id || ''}
                  onChange={(e) => setSelectedYangModel(yangModels.find(m => m.id === e.target.value) || null)}
                  className="input"
                >
                  <option value="">Select YANG model...</option>
                  {yangModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} ({model.vendor})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Prompt Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Configuration Request
              </label>
              <textarea
                value={xmlPrompt}
                onChange={(e) => setXmlPrompt(e.target.value)}
                placeholder="Describe the configuration you want to generate in NETCONF XML format..."
                rows={4}
                className="input"
              />
            </div>

            {/* Generate Button */}
            <button
              onClick={generateNetconfXml}
              disabled={loading || !xmlPrompt.trim()}
              className="btn btn-primary btn-md"
            >
              <CodeBracketIcon className="h-4 w-4 mr-2" />
              Generate NETCONF XML
            </button>

            {/* Generated XML Display */}
            {generatedXml && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">Generated NETCONF XML</h3>
                <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">
                    {generatedXml}
                  </pre>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(generatedXml)}
                  className="btn btn-secondary btn-sm"
                >
                  <ClipboardDocumentIcon className="h-4 w-4 mr-2" />
                  Copy to Clipboard
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Demo & Examples Tab */}
      {activeTab === 'demo' && (
        <div className="space-y-6">
          {/* Mock XML Examples */}
          <div className="card p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
              <BeakerIcon className="h-6 w-6 text-orange-600" />
              Mock NETCONF XML Examples
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {Object.entries(mockXmlExamples).map(([key]) => (
                <button
                  key={key}
                  onClick={() => loadExample(key)}
                  className={`card p-4 text-left hover:bg-gray-50 ${
                    selectedExample === key ? 'border-blue-500 bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <EyeIcon className="h-4 w-4 text-gray-500" />
                    <span className="font-medium capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {key === 'interfaceConfig' && 'Standard IETF interface configuration'}
                    {key === 'ciscoNxosConfig' && 'Cisco NX-OS specific configuration'}
                    {key === 'vrfConfig' && 'VRF configuration example'}
                  </p>
                </button>
              ))}
            </div>

            {generatedXml && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">
                    Example XML {selectedExample && `(${selectedExample})`}
                  </h3>
                  <button
                    onClick={() => navigator.clipboard.writeText(generatedXml)}
                    className="btn btn-secondary btn-sm"
                  >
                    <ClipboardDocumentIcon className="h-4 w-4 mr-2" />
                    Copy
                  </button>
                </div>
                <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">
                    {generatedXml}
                  </pre>
                </div>
              </div>
            )}
          </div>

          {/* Demo Actions */}
          <div className="card p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Demo Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={createDemoSession}
                disabled={loading}
                className="btn btn-primary btn-md"
              >
                <BeakerIcon className="h-4 w-4 mr-2" />
                Create Demo Session
              </button>
              <button
                onClick={cleanupMockSessions}
                disabled={loading}
                className="btn btn-danger btn-md"
              >
                <XMarkIcon className="h-4 w-4 mr-2" />
                Cleanup Mock Sessions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NetconfManagement; 