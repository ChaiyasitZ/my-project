import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { 
  BotIcon, 
  SendIcon, 
  CheckCircleIcon, 
  ServerIcon,
  RefreshCwIcon
} from 'lucide-react';
import ConfirmationModal from '../components/ConfirmationModal';
import { useConfirmation } from '../hooks/useConfirmation';

function Configurations() {
  const [devices, setDevices] = useState([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [generatedConfig, setGeneratedConfig] = useState(null);
  const [validation, setValidation] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedConfig, setEditedConfig] = useState('');

  const { confirmationState, showConfirmation } = useConfirmation();

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    setDevicesLoading(true);
    try {
      const response = await axios.get('/devices?status=active');
      setDevices(response.data.devices || []);
    } catch (error) {
      console.error('Error fetching devices:', error);
    } finally {
      setDevicesLoading(false);
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
        console.log('📥 Received configuration:', response.data.configuration);
        console.log('📅 Frontend received created_at:', response.data.configuration.created_at, typeof response.data.configuration.created_at);
        
        setGeneratedConfig(response.data.configuration);
        setValidation(response.data.configuration.validation);
        setEditedConfig(response.data.configuration.generated_config);
        setIsEditing(false);
        
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
          errorMessage = 'LLM could not generate a valid configuration. Try being more specific.';
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
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyConfiguration = async () => {
    if (!generatedConfig) return;

    const confirmed = await showConfirmation({
      title: 'Deploy Configuration',
      message: 'Are you sure you want to apply this configuration to the device?\n\nThis action will modify the device configuration.',
      confirmText: 'Deploy',
      cancelText: 'Cancel',
      type: 'warning'
    });

    if (!confirmed) return;

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

  const resetForm = () => {
    setSelectedDevice('');
    setPrompt('');
    setGeneratedConfig(null);
    setValidation(null);
    setIsEditing(false);
    setEditedConfig('');
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
    "vlan 100 sales", 
    "hostname Router1",
    "interface ge0/1 switchport mode trunk",
    "router ospf 1 network 192.168.1.0 0.0.0.255 area 0",
    "access-list 100 deny tcp 192.168.10.0 0.0.0.255 any eq 80",
    "Configure OSPF area 10 for all routers",
    "Setup EIGRP AS 100 topology",
    "Configure BGP AS 65001 peering"
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <BotIcon className="h-8 w-8 text-blue-600" />
            LLM Configuration Generator
          </h1>
          <p className="mt-2 text-gray-600">
            Generate Cisco device configurations using local LLM with Ollama
          </p>
        </div>
        <button
          onClick={fetchDevices}
          disabled={devicesLoading}
          className="btn btn-secondary btn-md"
        >
          <RefreshCwIcon className={`h-4 w-4 mr-2 ${devicesLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Generation Form */}
        <div className="card p-6">
          <div className="flex items-center mb-4">
            <BotIcon className="h-6 w-6 text-blue-600 mr-2" />
            <h2 className="text-lg font-medium text-gray-900">Generate Configuration</h2>
          </div>

          <form 
            onSubmit={handleGenerateConfiguration}
            className="space-y-4"
          >
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
            {generatedConfig && generatedConfig.status === 'generated' && (
              <div className="flex space-x-2">
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
              </div>
            )}
          </div>

          {/* No Configuration Display */}
          {!generatedConfig && (
            <div className="text-center py-12">
              <BotIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No configuration generated yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Select a device and enter a prompt to get started
              </p>
            </div>
          )}

          {/* Single Device Configuration Display */}
          {generatedConfig && (
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

              {/* Configuration Valid Tab with Explanation */}
              {validation && (
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                  <div className="flex items-start">
                    {getValidationIcon(validation.isValid)}
                    <div className="ml-3 flex-1">
                      <p className={`text-sm font-medium ${getValidationColor(validation.isValid)} mb-2`}>
                        {validation.isValid ? 'Configuration Valid' : 'Configuration Issues Found'}
                      </p>
                      {generatedConfig.explanation && (
                        <div className="text-sm text-gray-700 leading-relaxed">
                          {generatedConfig.explanation}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Configuration Code */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-700">Configuration</h3>
                  <div className="flex space-x-2">
                    {!isEditing ? (
                      <button
                        onClick={() => {
                          setIsEditing(true);
                          setEditedConfig(generatedConfig.generated_config);
                        }}
                        className="btn btn-secondary btn-sm"
                      >
                        Edit
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setGeneratedConfig({
                              ...generatedConfig,
                              generated_config: editedConfig
                            });
                            setIsEditing(false);
                          }}
                          className="btn btn-primary btn-sm"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditedConfig(generatedConfig.generated_config);
                            setIsEditing(false);
                          }}
                          className="btn btn-secondary btn-sm"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>
                
                {isEditing ? (
                  <textarea
                    value={editedConfig}
                    onChange={(e) => setEditedConfig(e.target.value)}
                    className="w-full h-48 p-3 bg-gray-900 text-green-400 font-mono text-sm rounded-lg border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-vertical"
                    placeholder="Edit your configuration..."
                    spellCheck={false}
                  />
                ) : (
                  <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                    <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">
                      {generatedConfig.generated_config}
                    </pre>
                  </div>
                )}
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
                  Generated: {generatedConfig.created_at ? new Date(generatedConfig.created_at).toLocaleString() : 'Just now'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>



      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmationState.isOpen}
        onClose={confirmationState.onCancel}
        onConfirm={confirmationState.onConfirm}
        title={confirmationState.title}
        message={confirmationState.message}
        confirmText={confirmationState.confirmText}
        cancelText={confirmationState.cancelText}
        type={confirmationState.type}
        loading={confirmationState.loading}
        loadingText={confirmationState.loadingText}
      />
    </div>
  );
}

export default Configurations; 