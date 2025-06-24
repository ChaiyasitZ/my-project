import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  BotIcon, 
  SendIcon, 
  CheckCircleIcon, 
  PlayIcon,
  EyeIcon,
  AlertTriangleIcon,
  ServerIcon
} from 'lucide-react';

function Configurations() {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [generatedConfig, setGeneratedConfig] = useState(null);
  const [validation, setValidation] = useState(null);
  const [aiStatus, setAiStatus] = useState(null);

  useEffect(() => {
    fetchDevices();
    fetchAiStatus();
  }, []);

  const fetchDevices = async () => {
    try {
      const response = await axios.get('/devices?status=active');
      setDevices(response.data.devices || []);
    } catch (error) {
      console.error('Error fetching devices:', error);
    }
  };

  const fetchAiStatus = async () => {
    try {
      const response = await axios.get('/configurations/ai-status');
      setAiStatus(response.data.aiService);
    } catch (error) {
      console.error('Error fetching AI status:', error);
      setAiStatus({
        success: false,
        status: 'disconnected',
        error: 'Unable to connect to AI service'
      });
    }
  };

  const handleGenerateConfiguration = async (e) => {
    e.preventDefault();
    if (!selectedDevice || !prompt) return;

    setIsGenerating(true);
    try {
      const requestData = {
        device_id: parseInt(selectedDevice),
        prompt: prompt
      };

      const response = await axios.post('/configurations/generate', requestData);

      setGeneratedConfig(response.data.configuration);
      setValidation(response.data.configuration.validation);
    } catch (error) {
      console.error('Error generating configuration:', error);
      alert('Error generating configuration: ' + (error.response?.data?.message || error.message));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyConfiguration = async () => {
    if (!generatedConfig) return;

    if (!window.confirm('Are you sure you want to apply this configuration to the device?')) {
      return;
    }

    setIsApplying(true);
    try {
      await axios.post('/configurations/apply', {
        configuration_id: generatedConfig.id
      });

      alert('Configuration applied successfully!');
      setGeneratedConfig({
        ...generatedConfig,
        status: 'applied'
      });
    } catch (error) {
      console.error('Error applying configuration:', error);
      alert('Error applying configuration: ' + (error.response?.data?.message || error.message));
    } finally {
      setIsApplying(false);
    }
  };

  const handleValidateConfiguration = async () => {
    if (!generatedConfig) return;

    try {
      const response = await axios.post(`/configurations/${generatedConfig.id}/validate`);
      setValidation(response.data.validation);
    } catch (error) {
      console.error('Error validating configuration:', error);
      alert('Error validating configuration: ' + (error.response?.data?.message || error.message));
    }
  };

  const resetForm = () => {
    setSelectedDevice('');
    setPrompt('');
    setGeneratedConfig(null);
    setValidation(null);
  };

  const getValidationColor = (isValid) => {
    return isValid ? 'text-green-600' : 'text-red-600';
  };

  const getValidationIcon = (isValid) => {
    return isValid ? 
      <CheckCircleIcon className="h-5 w-5 text-green-600" /> : 
      <AlertTriangleIcon className="h-5 w-5 text-red-600" />;
  };

  const examplePrompts = [
    "Create VLAN 100 named 'Sales' with IP 192.168.100.1/24",
    "Configure interface GigabitEthernet0/1 as trunk port",
    "Set up OSPF routing with area 0 for network 192.168.1.0/24",
    "Create access list to deny HTTP traffic from 192.168.10.0/24",
    "Configure port security on interface FastEthernet0/5"
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">AI Configuration Generator</h1>
        <p className="mt-2 text-gray-600">
          Generate Cisco device configurations using local AI with Ollama
        </p>
      </div>

      {/* AI Status */}
      {aiStatus && (
        <div className="card p-4 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-3 ${
                aiStatus.success && aiStatus.modelAvailable ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
              <div>
                <h3 className="text-sm font-medium text-gray-900">
                  🤖 AI Service Status
                </h3>
                <p className="text-sm text-gray-600">
                  {aiStatus.success ? (
                    aiStatus.modelAvailable ? (
                      <>Model: <span className="font-mono font-medium">{aiStatus.currentModel}</span> • Host: {aiStatus.host}</>
                    ) : (
                      <>Model <span className="font-mono">{aiStatus.currentModel}</span> not available • Please pull the model first</>
                    )
                  ) : (
                    <>Disconnected: {aiStatus.error}</>
                  )}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-gray-900">
                {aiStatus.success ? aiStatus.modelCount : 0} models
              </div>
              <button
                onClick={fetchAiStatus}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Refresh
              </button>
            </div>
          </div>
          
          {aiStatus.success && !aiStatus.modelAvailable && (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start">
                <AlertTriangleIcon className="h-5 w-5 text-yellow-600 mr-2 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">Model Not Available</p>
                  <p className="text-sm text-yellow-700 mt-1">
                    The configured model "{aiStatus.currentModel}" is not available. 
                    {aiStatus.availableModels?.length > 0 && (
                      <> Available models: {aiStatus.availableModels.join(', ')}</>
                    )}
                  </p>
                  <p className="text-sm text-yellow-700 mt-2">
                    Pull the model using: <code className="bg-yellow-100 px-1 rounded">ollama pull {aiStatus.currentModel}</code>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Generation Form */}
        <div className="card p-6">
          <div className="flex items-center mb-4">
            <BotIcon className="h-6 w-6 text-blue-600 mr-2" />
            <h2 className="text-lg font-medium text-gray-900">Generate Configuration</h2>
          </div>

          <form onSubmit={handleGenerateConfiguration} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Device
              </label>
              <select
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
                className="input"
                required
              >
                <option value="">Choose a device...</option>
                {devices.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.name} ({device.type}) - {device.ip_address}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Configuration Prompt
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe what you want to configure..."
                className="input"
                rows="4"
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                Be specific about what you want to configure. Include IP addresses, VLAN IDs, interface names, etc.
              </p>
            </div>

            <button
              type="submit"
              disabled={isGenerating || !selectedDevice || !prompt}
              className="btn btn-primary btn-md w-full"
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Generating...
                </>
              ) : (
                <>
                  <SendIcon className="h-4 w-4 mr-2" />
                  Generate Configuration
                </>
              )}
            </button>
          </form>

          {/* Example Prompts */}
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Example Prompts:</h3>
            <div className="space-y-2">
              {examplePrompts.map((example, index) => (
                <button
                  key={index}
                  onClick={() => setPrompt(example)}
                  className="text-left text-sm text-blue-600 hover:text-blue-800 block"
                >
                  • {example}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Generated Configuration */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">Generated Configuration</h2>
            {generatedConfig && (
              <div className="flex space-x-2">
                <button
                  onClick={handleValidateConfiguration}
                  className="btn btn-secondary btn-sm"
                >
                  <EyeIcon className="h-4 w-4 mr-2" />
                  Validate
                </button>
                {generatedConfig.status === 'generated' && (
                  <button
                    onClick={handleApplyConfiguration}
                    disabled={isApplying}
                    className="btn btn-primary btn-sm"
                  >
                    {isApplying ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    ) : (
                      <PlayIcon className="h-4 w-4 mr-2" />
                    )}
                    Apply
                  </button>
                )}
              </div>
            )}
          </div>

          {!generatedConfig ? (
            <div className="text-center py-12">
              <BotIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No configuration generated yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Select a device and enter a prompt to get started
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Device Info */}
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <div className="flex items-center">
                    <ServerIcon className="h-4 w-4 mr-2" />
                    <span>
                      {generatedConfig.device_name} ({generatedConfig.device_type})
                    </span>
                  </div>
                  <span className={`badge ${
                    generatedConfig.status === 'applied' ? 'badge-success' : 
                    generatedConfig.status === 'failed' ? 'badge-danger' : 'badge-info'
                  }`}>
                    {generatedConfig.status}
                  </span>
                </div>
                
                {/* Model Info */}
                <div className="mt-2 flex items-center text-xs text-gray-500">
                  <BotIcon className="h-3 w-3 mr-1" />
                  <span>Generated with: <span className="font-mono font-medium">{generatedConfig.ai_model}</span></span>
                  {generatedConfig.execution_time && (
                    <span className="ml-3">• {generatedConfig.execution_time}ms</span>
                  )}
                </div>
              </div>

              {/* Validation Results */}
              {validation && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-start">
                    {getValidationIcon(validation.isValid)}
                    <div className="ml-2">
                      <p className={`text-sm font-medium ${getValidationColor(validation.isValid)}`}>
                        {validation.isValid ? 'Configuration Valid' : 'Configuration Issues Found'}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {validation.feedback}
                      </p>
                      {validation.suggestions && (
                        <div className="mt-2">
                          <p className="text-sm font-medium text-gray-700">Suggestions:</p>
                          <p className="text-sm text-gray-600">{validation.suggestions}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Configuration Code */}
              <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">
                  {generatedConfig.generated_config}
                </pre>
              </div>

              {/* Actions */}
              <div className="flex justify-between">
                <button
                  onClick={resetForm}
                  className="btn btn-secondary btn-sm"
                >
                  Generate New
                </button>
                
                <div className="text-xs text-gray-500">
                  Generated: {new Date(generatedConfig.created_at).toLocaleString()}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Start Guide */}
      {devices.length === 0 && (
        <div className="card p-6 bg-blue-50 border-blue-200">
          <div className="flex items-start">
            <AlertTriangleIcon className="h-6 w-6 text-blue-600 mr-3 mt-0.5" />
            <div>
              <h3 className="text-lg font-medium text-blue-900">No Active Devices Found</h3>
              <p className="text-blue-700 mt-1">
                You need to add and activate devices before generating configurations.
              </p>
              <a
                href="/devices"
                className="inline-flex items-center mt-3 text-sm text-blue-600 hover:text-blue-500"
              >
                <ServerIcon className="h-4 w-4 mr-1" />
                Manage Devices
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Configurations; 