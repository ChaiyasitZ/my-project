import { useState, useEffect } from 'react';
import axios from 'axios';

function ConsoleConfiguration() {
  const [availablePorts, setAvailablePorts] = useState([]);
  const [selectedPort, setSelectedPort] = useState('');
  const [connectionSettings, setConnectionSettings] = useState({
    baudRate: 9600,
    dataBits: 8,
    parity: 'none',
    stopBits: 1
  });
  const [isConnected, setIsConnected] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [configMode, setConfigMode] = useState('template'); // 'template' or 'custom'
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [templates, setTemplates] = useState({});
  const [templateVariables, setTemplateVariables] = useState({});
  const [customConfig, setCustomConfig] = useState('');
  const [configResults, setConfigResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState('');

  useEffect(() => {
    fetchAvailablePorts();
    fetchTemplates();
  }, []);

  const fetchAvailablePorts = async () => {
    try {
      const response = await axios.get('/console/ports');
      setAvailablePorts(response.data.ports || []);
    } catch (error) {
      console.error('Error fetching ports:', error);
      alert('Error fetching serial ports: ' + (error.response?.data?.message || error.message));
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await axios.get('/console/templates');
      setTemplates(response.data.templates || {});
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const handleTestConnection = async () => {
    if (!selectedPort) {
      alert('Please select a serial port');
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post('/console/test', {
        deviceId: 'test',
        portPath: selectedPort,
        ...connectionSettings
      });

      if (response.data.test.success) {
        alert('✅ Console connection test successful!\n\n' + 
              (response.data.test.output || response.data.test.message));
      } else {
        alert('❌ Console connection test failed:\n\n' + response.data.test.message);
      }
    } catch (error) {
      console.error('Connection test error:', error);
      alert('Connection test failed: ' + (error.response?.data?.message || error.message));
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!selectedPort || !deviceId) {
      alert('Please select a port and enter a device ID');
      return;
    }

    setIsLoading(true);
    try {
      await axios.post('/console/connect', {
        deviceId,
        portPath: selectedPort,
        ...connectionSettings
      });

      setIsConnected(true);
      setConsoleOutput(prev => prev + `\n✅ Connected to ${selectedPort}\n`);
      alert('Console connected successfully!');
    } catch (error) {
      console.error('Connection error:', error);
      alert('Connection failed: ' + (error.response?.data?.message || error.message));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setIsLoading(true);
    try {
      await axios.post('/console/disconnect', { deviceId });
      setIsConnected(false);
      setConsoleOutput(prev => prev + `\n🔌 Disconnected from console\n`);
    } catch (error) {
      console.error('Disconnect error:', error);
      alert('Disconnect failed: ' + (error.response?.data?.message || error.message));
    } finally {
      setIsLoading(false);
    }
  };

  const handleTemplateChange = (templateKey) => {
    setSelectedTemplate(templateKey);
    if (templates[templateKey]) {
      // Extract variables from template
      const template = templates[templateKey].config;
      const variableMatches = template.match(/\{\{(\w+)\}\}/g) || [];
      const variables = {};
      
      variableMatches.forEach(match => {
        const varName = match.replace(/[{}]/g, '');
        variables[varName] = '';
      });
      
      setTemplateVariables(variables);
    }
  };

  const handleVariableChange = (varName, value) => {
    setTemplateVariables(prev => ({
      ...prev,
      [varName]: value
    }));
  };

  const handleApplyConfiguration = async () => {
    if (!isConnected) {
      alert('Please connect to console first');
      return;
    }

    setIsLoading(true);
    setConfigResults(null);

    try {
      let response;
      
      if (configMode === 'template' && selectedTemplate) {
        response = await axios.post('/console/templates/apply', {
          templateKey: selectedTemplate,
          variables: templateVariables,
          deviceId
        });
      } else if (configMode === 'custom' && customConfig) {
        response = await axios.post('/console/initial-config', {
          deviceId,
          configCommands: customConfig,
          deviceInfo: templateVariables
        });
      } else {
        alert('Please select a template or enter custom configuration');
        return;
      }

      setConfigResults(response.data.configuration);
      setConsoleOutput(prev => prev + `\n📝 Configuration applied:\n${response.data.configuration.fullOutput}\n`);
      
      const summary = response.data.configuration.summary;
      alert(`Configuration completed!\n\n` +
            `✅ Successful: ${summary.successful}/${summary.totalCommands} commands\n` +
            `❌ Failed: ${summary.failed} commands\n` +
            `📊 Success rate: ${summary.successRate}%`);
      
    } catch (error) {
      console.error('Configuration error:', error);
      alert('Configuration failed: ' + (error.response?.data?.message || error.message));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendCommand = async () => {
    const command = prompt('Enter command to send:');
    if (!command || !isConnected) return;

    setIsLoading(true);
    try {
      const response = await axios.post('/console/command', {
        deviceId,
        command,
        waitForPrompt: true
      });

      setConsoleOutput(prev => prev + `\n> ${command}\n${response.data.result.output}\n`);
    } catch (error) {
      console.error('Command error:', error);
      alert('Command failed: ' + (error.response?.data?.message || error.message));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Initial Setup SSH</h1>
          <div className="flex items-center space-x-2">
            <div className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-600">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
        
        <p className="text-gray-600 mb-6">
          Configure new Cisco devices via console port to enable SSH access for network management
        </p>

        {/* Connection Settings */}
        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Serial Console Connection</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            {/* Device ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Device ID</label>
              <input
                type="text"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                placeholder="e.g., switch01"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isConnected}
              />
            </div>

            {/* Port Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Serial Port</label>
              <select
                value={selectedPort}
                onChange={(e) => setSelectedPort(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isConnected}
              >
                <option value="">Select Port</option>
                {availablePorts.map((port) => (
                  <option key={port.path} value={port.path}>
                    {port.friendlyName}
                  </option>
                ))}
              </select>
            </div>

            {/* Baud Rate */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Baud Rate</label>
              <select
                value={connectionSettings.baudRate}
                onChange={(e) => setConnectionSettings(prev => ({ ...prev, baudRate: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isConnected}
              >
                <option value={9600}>9600</option>
                <option value={19200}>19200</option>
                <option value={38400}>38400</option>
                <option value={57600}>57600</option>
                <option value={115200}>115200</option>
              </select>
            </div>
          </div>

          {/* Connection Buttons */}
          <div className="flex space-x-4">
            <button
              onClick={handleTestConnection}
              disabled={isLoading || !selectedPort}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400"
            >
              {isLoading ? 'Testing...' : 'Test Connection'}
            </button>
            
            {!isConnected ? (
              <button
                onClick={handleConnect}
                disabled={isLoading || !selectedPort || !deviceId}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-400"
              >
                {isLoading ? 'Connecting...' : 'Connect'}
              </button>
            ) : (
              <button
                onClick={handleDisconnect}
                disabled={isLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-gray-400"
              >
                {isLoading ? 'Disconnecting...' : 'Disconnect'}
              </button>
            )}

            {isConnected && (
              <button
                onClick={handleSendCommand}
                disabled={isLoading}
                className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 disabled:bg-gray-400"
              >
                Send Command
              </button>
            )}
          </div>
        </div>

        {/* Configuration Mode */}
        {isConnected && (
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">SSH Setup Configuration</h2>
            
            {/* Mode Selection */}
            <div className="flex space-x-4 mb-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="template"
                  checked={configMode === 'template'}
                  onChange={(e) => setConfigMode(e.target.value)}
                  className="mr-2"
                />
                Use Template
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="custom"
                  checked={configMode === 'custom'}
                  onChange={(e) => setConfigMode(e.target.value)}
                  className="mr-2"
                />
                Custom Configuration
              </label>
            </div>

            {/* Template Mode */}
            {configMode === 'template' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Template</label>
                  <select
                    value={selectedTemplate}
                    onChange={(e) => handleTemplateChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Choose a template</option>
                    {Object.entries(templates).map(([key, template]) => (
                      <option key={key} value={key}>
                        {template.name} - {template.description}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Template Variables */}
                {selectedTemplate && Object.keys(templateVariables).length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.keys(templateVariables).map((varName) => (
                      <div key={varName}>
                        <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                          {varName.replace(/([A-Z])/g, ' $1').trim()}
                        </label>
                        <input
                          type="text"
                          value={templateVariables[varName]}
                          onChange={(e) => handleVariableChange(varName, e.target.value)}
                          placeholder={`Enter ${varName}`}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Custom Mode */}
            {configMode === 'custom' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Configuration Commands</label>
                <textarea
                  value={customConfig}
                  onChange={(e) => setCustomConfig(e.target.value)}
                  placeholder="Enter Cisco IOS configuration commands, one per line..."
                  rows={10}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>
            )}

            {/* Apply Button */}
            <div className="mt-4">
              <button
                onClick={handleApplyConfiguration}
                disabled={isLoading || (!selectedTemplate && !customConfig)}
                className="px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-400"
              >
                {isLoading ? 'Applying Configuration...' : 'Apply Configuration'}
              </button>
            </div>
          </div>
        )}

        {/* Console Output */}
        {consoleOutput && (
          <div className="bg-black rounded-lg p-4 mb-6">
            <h3 className="text-lg font-medium text-white mb-2">Console Output</h3>
            <pre className="text-green-400 text-sm font-mono whitespace-pre-wrap overflow-auto max-h-96">
              {consoleOutput}
            </pre>
          </div>
        )}

        {/* Configuration Results */}
        {configResults && (
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Configuration Results</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{configResults.summary.successful}</div>
                <div className="text-sm text-green-700">Successful Commands</div>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{configResults.summary.failed}</div>
                <div className="text-sm text-red-700">Failed Commands</div>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{configResults.summary.successRate}%</div>
                <div className="text-sm text-blue-700">Success Rate</div>
              </div>
            </div>

            {/* Command Details */}
            <div className="space-y-2 max-h-64 overflow-auto">
              {configResults.results.map((result, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-2 rounded ${
                    result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                  } border`}
                >
                  <span className="font-mono text-sm">{result.command}</span>
                  <span className={`text-sm ${result.success ? 'text-green-600' : 'text-red-600'}`}>
                    {result.success ? '✅' : '❌'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ConsoleConfiguration; 