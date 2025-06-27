import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { 
  TerminalIcon, 
  PlayIcon, 
  SettingsIcon,
  WifiIcon,
  WifiOffIcon,
  SendIcon,
  ClockIcon
} from 'lucide-react';

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

  // New state for enhanced SSH configuration
  const [ipConfigMethod, setIpConfigMethod] = useState('manual'); // 'manual' or 'dhcp'

  useEffect(() => {
    fetchAvailablePorts();
    fetchTemplates();
  }, []);

  const fetchAvailablePorts = async () => {
    try {
      const response = await axios.get('/console/ports');
      setAvailablePorts(response.data.ports || []);
    } catch (error) {
      console.error('❌ Error fetching serial ports:', error.response?.data?.message || error.message);
      toast.error('Failed to fetch serial ports: ' + (error.response?.data?.message || error.message));
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
      console.warn('⚠️ Please select a serial port');
      toast.error('Please select a serial port');
      return;
    }

    if (!deviceId) {
      console.warn('⚠️ Please enter a device ID');
      toast.error('Please enter a device ID for testing');
      return;
    }

    setIsLoading(true);
    const toastId = toast.loading('Testing console connection...');
    
    try {
      const response = await axios.post('/console/test', {
        deviceId: deviceId,
        portPath: selectedPort,
        baudRate: connectionSettings.baudRate,
        dataBits: connectionSettings.dataBits,
        parity: connectionSettings.parity,
        stopBits: connectionSettings.stopBits
      });

      if (response.data.test.success) {
        console.log('✅ Console connection test successful!');
        console.log('Response:', response.data.test.output || response.data.test.message);
        toast.success('Console connection test successful!', { id: toastId });
      } else {
        console.warn('⚠️ Console connection test failed:');
        console.warn('Error:', response.data.test.message);
        toast.error(`Connection test failed: ${response.data.test.message}`, { id: toastId });
      }
    } catch (error) {
      console.error('❌ Connection test failed:', error.response?.data?.message || error.message);
      toast.error(`Connection test failed: ${error.response?.data?.message || error.message}`, { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!selectedPort || !deviceId) {
      console.warn('⚠️ Please select a port and enter a device ID');
      toast.error('Please select a port and enter a device ID');
      return;
    }

    setIsLoading(true);
    const toastId = toast.loading('Connecting to console...');
    
    try {
      await axios.post('/console/connect', {
        deviceId: deviceId,
        portPath: selectedPort,
        baudRate: connectionSettings.baudRate,
        dataBits: connectionSettings.dataBits,
        parity: connectionSettings.parity,
        stopBits: connectionSettings.stopBits
      });

      setIsConnected(true);
      setConsoleOutput(prev => prev + `\n✅ Connected to ${selectedPort}\n`);
      console.log('✅ Console connected successfully!');
      toast.success(`Connected to console on ${selectedPort}!`, { id: toastId });
    } catch (error) {
      console.error('❌ Connection failed:', error.response?.data?.message || error.message);
      toast.error(`Connection failed: ${error.response?.data?.message || error.message}`, { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!deviceId) {
      toast.error('Device ID is required for disconnect');
      return;
    }

    setIsLoading(true);
    try {
      await axios.post('/console/disconnect', {
        deviceId: deviceId
      });
      setIsConnected(false);
      setConsoleOutput(prev => prev + `\n🔌 Disconnected from console\n`);
      console.log('✅ Console disconnected successfully!');
      toast.success('Console disconnected successfully!');
    } catch (error) {
      console.error('❌ Disconnect failed:', error.response?.data?.message || error.message);
      toast.error(`Disconnect failed: ${error.response?.data?.message || error.message}`);
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
        // Set default values for common variables
        switch(varName) {
          case 'rsa_key_size':
            variables[varName] = '2048';
            break;
          case 'management_interface':
            variables[varName] = 'vlan1';
            break;
          case 'management_mask':
            variables[varName] = '255.255.255.0';
            break;
          case 'domain':
            variables[varName] = 'company.local';
            break;
          case 'username':
            variables[varName] = 'admin';
            break;
          default:
            variables[varName] = '';
        }
      });
      
      // Add important variables that might not be in template but needed for UI
      if (!variables.management_ip) variables.management_ip = '';
      if (!variables.management_mask) variables.management_mask = '255.255.255.0';
      
      // Add IP method variable
      variables.ip_method = ipConfigMethod;
      
      setTemplateVariables(variables);
    }
  };

  const handleVariableChange = (varName, value) => {
    setTemplateVariables(prev => ({
      ...prev,
      [varName]: value
    }));
  };

  const handleIPMethodChange = (method) => {
    setIpConfigMethod(method);
    // Update the ip_method variable
    setTemplateVariables(prev => ({
      ...prev,
      ip_method: method
    }));
  };

  const handleApplyConfiguration = async () => {
    if (!isConnected) {
      console.warn('⚠️ Please connect to console first');
      toast.error('Please connect to console first');
      return;
    }

    if (!deviceId) {
      toast.error('Device ID is required');
      return;
    }

    if (configMode === 'template' && !selectedTemplate) {
      toast.error('Please select a template');
      return;
    }

    if (configMode === 'custom' && !customConfig) {
      toast.error('Please enter custom configuration');
      return;
    }

    setIsLoading(true);
    const toastId = toast.loading('Applying configuration...');
    
    // Add realtime feedback to console output
    setConsoleOutput(prev => prev + `\n🔧 Starting configuration application...\n`);
    setConsoleOutput(prev => prev + `📋 Mode: ${configMode === 'template' ? 'Template' : 'Custom'}\n`);
    if (configMode === 'template') {
      setConsoleOutput(prev => prev + `📄 Template: ${templates[selectedTemplate]?.name}\n`);
    }
    setConsoleOutput(prev => prev + `⏱️ Started at: ${new Date().toLocaleTimeString()}\n`);
    setConsoleOutput(prev => prev + `${'='.repeat(50)}\n`);
    
    try {
      let response;
      
      if (configMode === 'template') {
        // Apply template configuration
        response = await axios.post('/console/templates/apply', {
          templateKey: selectedTemplate,
          variables: templateVariables,
          deviceId: deviceId
        });
      } else {
        // Apply custom configuration
        response = await axios.post('/console/initial-config', {
          deviceId: deviceId,
          configCommands: customConfig
        });
      }

      setConfigResults(response.data.configuration);
      const summary = response.data.configuration.summary;
      
      // Add detailed realtime feedback
      setConsoleOutput(prev => prev + `\n✅ Configuration application completed!\n`);
      setConsoleOutput(prev => prev + `📊 Results Summary:\n`);
      setConsoleOutput(prev => prev + `   ✅ Successful: ${summary.successful}/${summary.totalCommands} commands\n`);
      setConsoleOutput(prev => prev + `   ❌ Failed: ${summary.failed} commands\n`);
      setConsoleOutput(prev => prev + `   📈 Success rate: ${summary.successRate}%\n`);
      setConsoleOutput(prev => prev + `⏱️ Completed at: ${new Date().toLocaleTimeString()}\n`);
      setConsoleOutput(prev => prev + `${'='.repeat(50)}\n`);
      
      // Add command-by-command results
      response.data.configuration.results.forEach((result, index) => {
        const status = result.success ? '✅' : '❌';
        setConsoleOutput(prev => prev + `${status} Command ${index + 1}: ${result.command}\n`);
        if (!result.success && result.error) {
          setConsoleOutput(prev => prev + `   Error: ${result.error}\n`);
        }
      });
      
      console.log('✅ Configuration completed!');
      console.log('Summary:\n' +
            `✅ Successful: ${summary.successful}/${summary.totalCommands} commands\n` +
            `❌ Failed: ${summary.failed} commands\n` +
            `📊 Success rate: ${summary.successRate}%`);
      
      if (summary.successRate === 100) {
        toast.success(`Configuration applied successfully! ${summary.successful}/${summary.totalCommands} commands executed.`, { id: toastId });
      } else {
        toast.error(`Configuration partially applied: ${summary.successful}/${summary.totalCommands} commands successful (${summary.successRate}%)`, { id: toastId });
      }
      
    } catch (error) {
      console.error('❌ Configuration failed:', error.response?.data?.message || error.message);
      
      // Add error feedback to console
      setConsoleOutput(prev => prev + `\n❌ Configuration application failed!\n`);
      setConsoleOutput(prev => prev + `🚨 Error: ${error.response?.data?.message || error.message}\n`);
      setConsoleOutput(prev => prev + `⏱️ Failed at: ${new Date().toLocaleTimeString()}\n`);
      setConsoleOutput(prev => prev + `${'='.repeat(50)}\n`);
      
      toast.error(`Configuration failed: ${error.response?.data?.message || error.message}`, { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendCommand = async (command) => {
    if (!isConnected) {
      toast.error('Please connect to console first');
      return;
    }

    if (!deviceId) {
      toast.error('Device ID is required');
      return;
    }

    if (!command || !command.trim()) return;

    setIsLoading(true);
    try {
      const response = await axios.post('/console/command', {
        deviceId: deviceId,
        command: command.trim(),
        waitForPrompt: true
      });

      setConsoleOutput(prev => prev + `\n> ${command}\n${response.data.result.output}\n`);
      console.log('✅ Command executed successfully:', command.trim());
      toast.success('Command executed successfully');
    } catch (error) {
      console.error('❌ Command failed:', error.response?.data?.message || error.message);
      toast.error(`Command failed: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Console Setup</h1>
          <p className="mt-2 text-gray-600">
            Configure new Cisco devices via console port to enable SSH access for network management
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-sm text-gray-600">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Connection Settings */}
      <div className="bg-white shadow rounded-lg p-6">
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
              onClick={() => handleSendCommand(prompt('Enter command to send:'))}
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
        <div className="bg-white shadow rounded-lg p-6">
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
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">SSH Configuration Template</label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Choose SSH configuration template</option>
                  {Object.entries(templates).map(([key, template]) => (
                    <option key={key} value={key}>
                      {template.name} - {template.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* Template Variables */}
              {selectedTemplate && Object.keys(templateVariables).length > 0 && (
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h3 className="text-md font-medium text-gray-900 mb-4">Configuration Parameters</h3>
                  
                  {/* Basic Device Settings */}
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">🔧 Device Settings</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {['hostname', 'domain'].filter(key => Object.hasOwn(templateVariables, key)).map((varName) => (
                        <div key={varName}>
                          <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                            {varName === 'hostname' ? '🏷️ Hostname' : '🌐 Domain Name'}
                          </label>
                          <input
                            type="text"
                            value={templateVariables[varName]}
                            onChange={(e) => handleVariableChange(varName, e.target.value)}
                            placeholder={varName === 'hostname' ? 'SW-CORE-01' : 'company.local'}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Security Settings */}
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">🔐 Security Settings</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.hasOwn(templateVariables, 'rsa_key_size') && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            🔑 RSA Key Size
                          </label>
                          <select
                            value={templateVariables.rsa_key_size}
                            onChange={(e) => handleVariableChange('rsa_key_size', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="1024">1024 bits</option>
                            <option value="2048">2048 bits (Recommended)</option>
                          </select>
                        </div>
                      )}

                      {['username', 'user_password'].filter(key => Object.hasOwn(templateVariables, key)).map((varName) => (
                        <div key={varName}>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {varName === 'username' && '👤 Username'}
                            {varName === 'user_password' && '🔒 User Password'}
                          </label>
                          <input
                            type={varName.includes('password') ? 'password' : 'text'}
                            value={templateVariables[varName]}
                            onChange={(e) => handleVariableChange(varName, e.target.value)}
                            placeholder={
                              varName === 'username' ? 'admin' :
                              'Strong password for user'
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Management Interface Settings */}
                  {Object.hasOwn(templateVariables, 'management_interface') && (
                    <div className="mb-6">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">🌐 Management Interface</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            🔌 Interface
                          </label>
                          <input
                            type="text"
                            value={templateVariables.management_interface}
                            onChange={(e) => handleVariableChange('management_interface', e.target.value)}
                            placeholder="vlan1, GigabitEthernet0/1, etc."
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Examples: vlan1, vlan10, GigabitEthernet0/1, FastEthernet0/1, Ethernet0/0
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            ⚙️ IP Configuration Method
                          </label>
                          <select
                            value={ipConfigMethod}
                            onChange={(e) => handleIPMethodChange(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="manual">Manual IP Address</option>
                            <option value="dhcp">DHCP</option>
                          </select>
                        </div>
                      </div>

                      {/* IP Configuration Fields - Only show for manual */}
                      {ipConfigMethod === 'manual' && (
                        <div className="bg-blue-50 p-4 rounded-md">
                          <h5 className="text-sm font-medium text-blue-900 mb-3">📍 Manual IP Configuration</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-blue-700 mb-1">
                                🌐 IP Address
                              </label>
                              <input
                                type="text"
                                value={templateVariables.management_ip || ''}
                                onChange={(e) => handleVariableChange('management_ip', e.target.value)}
                                placeholder="192.168.1.10"
                                className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-blue-700 mb-1">
                                🎭 Subnet Mask
                              </label>
                              <input
                                type="text"
                                value={templateVariables.management_mask || '255.255.255.0'}
                                onChange={(e) => handleVariableChange('management_mask', e.target.value)}
                                placeholder="255.255.255.0"
                                className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </div>
                          <div className="mt-3 p-3 bg-blue-100 rounded-md">
                            <p className="text-sm text-blue-800">
                              <strong>Note:</strong> No gateway configuration - device will be accessible only within local subnet
                            </p>
                          </div>
                        </div>
                      )}

                      {ipConfigMethod === 'dhcp' && (
                        <div className="bg-green-50 p-4 rounded-md">
                          <div className="flex items-center">
                            <div className="flex-shrink-0">
                              <span className="text-green-400 text-xl">✅</span>
                            </div>
                            <div className="ml-3">
                              <h5 className="text-sm font-medium text-green-800">DHCP Configuration</h5>
                              <p className="text-sm text-green-700">
                                Interface will automatically obtain IP address from DHCP server
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Template Preview */}
                  <div className="mt-6">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">📋 Configuration Preview</h4>
                    <div className="bg-black rounded-md p-3 max-h-40 overflow-auto">
                      <pre className="text-green-400 text-xs font-mono whitespace-pre-wrap">
                        {templates[selectedTemplate] && 
                          (() => {
                            // Create a preview config with IP method processing
                            let previewConfig = templates[selectedTemplate].config;
                            const vars = { ...templateVariables };
                            
                            // Process IP configuration for preview
                            if (vars.ip_method === 'dhcp') {
                              vars.interface_description_suffix = ' - DHCP';
                              vars.ip_configuration = ' ip address dhcp';
                            } else {
                              vars.interface_description_suffix = '';
                              vars.ip_configuration = ` ip address ${vars.management_ip || '{{management_ip}}'} ${vars.management_mask || '{{management_mask}}'}`;
                            }
                            
                            // Replace variables in preview
                            Object.entries(vars).forEach(([key, value]) => {
                              const placeholder = `{{${key}}}`;
                              previewConfig = previewConfig.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value || `{{${key}}}`);
                            });
                            
                            const lines = previewConfig.split('\n');
                            return lines.slice(0, 20).join('\n') + 
                              (lines.length > 20 ? '\n... (truncated)' : '');
                          })()
                        }
                      </pre>
                    </div>
                  </div>
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
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">🖥️ Console Output</h3>
            <div className="flex space-x-2">
              <button
                onClick={() => navigator.clipboard.writeText(consoleOutput)}
                className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                📋 Copy
              </button>
              <button
                onClick={() => setConsoleOutput('')}
                className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                🗑️ Clear
              </button>
            </div>
          </div>
          <div className="bg-black rounded-lg p-4 border">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-700">
              <span className="text-green-400 text-xs font-mono">Console Session - Device: {deviceId || 'Unknown'}</span>
              <span className="text-gray-400 text-xs">{new Date().toLocaleString()}</span>
            </div>
            <pre className="text-green-400 text-sm font-mono whitespace-pre-wrap overflow-auto max-h-96 leading-relaxed">
              {consoleOutput}
            </pre>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            💡 Tip: Use the Copy button to save output, or Clear to reset the console display
          </div>
        </div>
      )}

      {/* Configuration Results */}
      {configResults && (
        <div className="bg-white shadow rounded-lg p-6">
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
                className={`p-3 rounded ${
                  result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                } border`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-sm font-semibold">{result.command}</span>
                  <div className="flex items-center space-x-2">
                    <span className={`text-xs px-2 py-1 rounded ${
                      result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      #{result.sequence}
                    </span>
                    <span className={`text-sm ${result.success ? 'text-green-600' : 'text-red-600'}`}>
                      {result.success ? '✅' : '❌'}
                    </span>
                  </div>
                </div>
                {result.output && (
                  <div className="mt-2 p-2 bg-gray-100 rounded text-xs font-mono text-gray-700 overflow-auto max-h-20">
                    {result.output.trim()}
                  </div>
                )}
                {result.error && (
                  <div className="mt-2 p-2 bg-red-100 rounded text-xs text-red-700">
                    <strong>Error:</strong> {result.error}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Full Configuration Output */}
          {configResults.fullOutput && (
            <div className="mt-6">
              <h4 className="text-sm font-medium text-gray-700 mb-2">📋 Full Console Output</h4>
              <div className="bg-black rounded-lg p-4 max-h-96 overflow-auto">
                <pre className="text-green-400 text-xs font-mono whitespace-pre-wrap">
                  {configResults.fullOutput}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ConsoleConfiguration; 