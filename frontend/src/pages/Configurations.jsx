import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { 
  BotIcon, 
  SendIcon, 
  CheckCircleIcon, 
  ServerIcon
} from 'lucide-react';

function Configurations() {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [generatedConfig, setGeneratedConfig] = useState(null);
  const [validation, setValidation] = useState(null);
  const [aiStatus, setAiStatus] = useState(null);

  useEffect(() => {
    fetchDevices();
    checkAiStatus();
  }, []);

  const fetchDevices = async () => {
    try {
      const response = await axios.get('/devices?status=active');
      setDevices(response.data.devices || []);
    } catch (error) {
      console.error('Error fetching devices:', error);
    }
  };

  const checkAiStatus = async () => {
    try {
      const response = await axios.get('/configurations/ai-status');
      setAiStatus(response.data.aiService);
      console.log('🤖 AI Service Status:', response.data.aiService);
    } catch (error) {
      console.error('Error checking AI status:', error);
      setAiStatus({ status: 'error', error: error.message });
    }
  };

  const handleGenerateConfiguration = async (e) => {
    e.preventDefault();
    if (!selectedDevice || !prompt) return;

    setIsGenerating(true);
    const toastId = toast.loading('Generating configuration...');
    
    try {
      const requestData = {
        device_id: selectedDevice,
        prompt: prompt
      };

      const response = await axios.post('/configurations/generate', requestData);

      if (response.data.configuration) {
        setGeneratedConfig(response.data.configuration);
        setValidation(response.data.configuration.validation);
        
        // Show warning if fallback method was used
        if (response.data.configuration.warning) {
          console.warn('⚠️ Configuration warning:', response.data.configuration.warning);
        }
        toast.success('Configuration generated successfully!', { id: toastId });
      } else {
        // Handle case where AI couldn't generate valid configuration
        throw new Error(response.data.error || 'No configuration generated');
      }
    } catch (error) {
      console.error('❌ Error generating configuration:', error);
      console.error('📊 Error details:', error.response?.data);
      
      let errorMessage = '';
      let showSuggestions = false;
      
      if (error.response?.status === 503) {
        // AI service unavailable
        errorMessage = '🤖 AI Service Unavailable';
        showSuggestions = true;
      } else if (error.response?.status === 400) {
        const errorData = error.response.data;
        
        if (errorData.details) {
          // Validation error
          const details = errorData.details.map(d => d.message).join(', ');
          errorMessage = `Validation Error: ${details}`;
        } else if (errorData.error?.includes('ObjectId')) {
          // Device ID format error
          errorMessage = 'Invalid device selection. Please refresh the page and try again.';
        } else if (errorData.message?.includes('AI generation failed')) {
          // AI generation error
          errorMessage = 'AI could not generate a valid configuration. Try being more specific.';
          showSuggestions = true;
        } else {
          errorMessage = errorData.message || 'Configuration generation failed';
        }
      } else if (error.response?.status === 404) {
        errorMessage = 'Selected device not found. Please refresh and try again.';
      } else {
        errorMessage = error.response?.data?.message || error.message || 'Network error occurred';
      }
      
      console.warn('⚠️', errorMessage);
      
      // Show error with suggestions if applicable
      if (showSuggestions && error.response?.data?.suggestions) {
        const suggestions = error.response.data.suggestions.join('\n• ');
        toast.error(`${errorMessage}\n\nSuggestions:\n• ${suggestions}`, { 
          id: toastId,
          duration: 8000 
        });
      } else {
        toast.error(errorMessage, { id: toastId });
      }
      
      // Refresh AI status if it's an AI service error
      if (error.response?.status === 503) {
        checkAiStatus();
      }
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
    const toastId = toast.loading('Deploying configuration...');
    
    try {
      await axios.post('/configurations/apply', {
        configuration_id: generatedConfig.id
      });

      console.log('✅ Configuration applied successfully!');
      setGeneratedConfig({
        ...generatedConfig,
        status: 'applied'
      });
      toast.success('Configuration deployed successfully!', { id: toastId });
    } catch (error) {
      console.error('Error applying configuration:', error);
      toast.error('Error deploying configuration: ' + (error.response?.data?.message || error.message), { id: toastId });
    } finally {
      setIsApplying(false);
    }
  };

  const handleValidateConfiguration = async () => {
    if (!generatedConfig) return;

    setIsValidating(true);
    const toastId = toast.loading('Validating configuration...');
    
    try {
      const response = await axios.post(`/configurations/${generatedConfig.id}/validate`);
      setValidation(response.data.validation);
      toast.success('Configuration validated successfully!', { id: toastId });
    } catch (error) {
      console.error('Error validating configuration:', error);
      console.warn('⚠️', 'Error validating configuration: ' + (error.response?.data?.message || error.message));
      toast.error('Error validating configuration: ' + (error.response?.data?.message || error.message), { id: toastId });
    } finally {
      setIsValidating(false);
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
      <CheckCircleIcon className="h-5 w-5 text-red-600" />;
  };

  const examplePrompts = [
    "interface fe0/1 ip 192.168.1.1/24",
    "username admin password cisco123",
    "vlan 100 sales", 
    "hostname Router1",
    "interface ge0/1 switchport mode trunk",
    "router ospf 1 network 192.168.1.0 0.0.0.255 area 0",
    "access-list 100 deny tcp 192.168.10.0 0.0.0.255 any eq 80"
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <BotIcon className="h-8 w-8 text-blue-600" />
              AI Configuration Generator
            </h1>
            <p className="mt-2 text-gray-600">
              Generate Cisco device configurations using local AI with Ollama
            </p>
          </div>
          {/* AI Status Indicator */}
          {aiStatus && (
            <div className="flex items-center space-x-2">
              <div className={`h-3 w-3 rounded-full ${
                aiStatus.status === 'connected' ? 'bg-green-500' : 
                aiStatus.status === 'disconnected' ? 'bg-red-500' : 'bg-yellow-500'
              }`}></div>
              <span className="text-sm text-gray-600">
                {aiStatus.status === 'connected' ? 'AI Service Online' : 
                 aiStatus.status === 'disconnected' ? 'AI Service Offline' : 'AI Service Checking...'}
              </span>
              <button
                onClick={checkAiStatus}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Refresh
              </button>
            </div>
          )}
        </div>
      </div>

      {/* AI Service Warning */}
      {aiStatus && aiStatus.status !== 'connected' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                AI Service Issue
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  {aiStatus.status === 'disconnected' 
                    ? 'The Ollama AI service is not available. Make sure Ollama is running on your system.'
                    : 'There was an error connecting to the AI service.'
                  }
                </p>
                {aiStatus.error && (
                  <p className="mt-1 font-mono text-xs bg-yellow-100 p-2 rounded">
                    Error: {aiStatus.error}
                  </p>
                )}
                <div className="mt-3">
                  <p className="font-medium">To fix this:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Ensure Ollama is installed and running</li>
                    <li>Check if the service is accessible at http://localhost:11434</li>
                    <li>Verify the model ({aiStatus.model || 'codellama:13b'}) is downloaded</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
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
                placeholder="Enter Cisco commands. Example: 'interface fe0/1 ip 192.168.1.1/24'"
                className="input"
                rows="4"
                required
                minLength="10"
              />
              <div className="flex justify-between items-center mt-1">
                <p className="text-sm text-gray-500">
                  Enter the configuration you want. Use standard Cisco command format.
                </p>
                <p className={`text-sm ${
                  prompt.length < 10 ? 'text-red-500' : 
                  prompt.length > 2000 ? 'text-red-500' : 'text-green-500'
                }`}>
                  {prompt.length}/2000 chars {prompt.length < 10 ? '(min 10)' : ''}
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={isGenerating || !selectedDevice || !prompt || prompt.length < 10}
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
            
            {prompt.length > 0 && prompt.length < 10 && (
              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">
                  Prompt must be at least 10 characters long. Currently: {prompt.length} characters.
                </p>
              </div>
            )}
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

        {/* Configuration Preview */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">Configuration Preview</h2>
            {generatedConfig && (
              <div className="flex space-x-2">
                <button
                  onClick={handleValidateConfiguration}
                  disabled={isValidating}
                  className="btn btn-secondary btn-sm"
                >
                  {isValidating ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                  ) : (
                    <CheckCircleIcon className="h-4 w-4 mr-2" />
                  )}
                  {isValidating ? 'Validating...' : 'Validate'}
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
                      <CheckCircleIcon className="h-4 w-4 mr-2" />
                    )}
                    {isApplying ? 'Deploying...' : 'Deploy'}
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
            <ServerIcon className="h-6 w-6 text-blue-600 mr-3 mt-0.5" />
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