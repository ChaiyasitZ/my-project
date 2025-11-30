import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { 
  BotIcon, 
  SendIcon, 
  CheckCircleIcon, 
  ServerIcon,
  RefreshCwIcon,
  CodeIcon,
  NetworkIcon,
  ToggleLeftIcon,
  ToggleRightIcon,
  UploadIcon,
  FileTextIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
  FolderIcon,
  WifiIcon,
  XCircleIcon,
  ActivityIcon
} from 'lucide-react';
import ConfirmationModal from '../components/ConfirmationModal';
import BackupProgressModal from '../components/BackupProgressModal';
import { useConfirmation } from '../hooks/useConfirmation';
import socket, { 
  connectSocket, 
  disconnectSocket,
  subscribeToBackupProgress,
  subscribeToDeploymentProgress,
  subscribeToScheduleResults
} from '../services/socket';

function Configurations() {
  const [devices, setDevices] = useState([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [prompt, setPrompt] = useState('');
  const [configMode, setConfigMode] = useState('cli'); // 'cli' or 'netconf'
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [generatedConfig, setGeneratedConfig] = useState(null);
  const [validation, setValidation] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedConfig, setEditedConfig] = useState('');
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [scheduleResults, setScheduleResults] = useState(null);
  
  // YANG Models state
  const [yangModels, setYangModels] = useState([]);
  const [yangModelsLoading, setYangModelsLoading] = useState(false);
  const [showYangUploadModal, setShowYangUploadModal] = useState(false);
  const [expandedYangModel, setExpandedYangModel] = useState(null);
  const [yangFormData, setYangFormData] = useState({
    name: '',
    namespace: '',
    prefix: '',
    version: '1.0.0',
    device_type: 'nexus',
    category: 'other',
    description: '',
    yang_content: '',
    xml_templates: [],
    config_paths: []
  });
  const [newTemplate, setNewTemplate] = useState({ name: '', description: '', template: '' });
  const [newPath, setNewPath] = useState({ path: '', description: '', data_type: '', required: false });
  
  // NETCONF Sessions state
  const [netconfSessions, setNetconfSessions] = useState([]);
  const [netconfSessionsLoading, setNetconfSessionsLoading] = useState(false);
  const [validateBeforeApply, setValidateBeforeApply] = useState(true); // Default enabled
  
  // YANG Models search/filter
  const [yangSearchTerm, setYangSearchTerm] = useState('');
  const [yangCategoryFilter, setYangCategoryFilter] = useState('all');
  
  // NETCONF sub-tabs: 'generate', 'sessions', 'yang-models'
  const [netconfSubTab, setNetconfSubTab] = useState('generate');

  const { confirmationState, showConfirmation } = useConfirmation();

  useEffect(() => {
    fetchDevices();
    
    // Connect to WebSocket
    connectSocket();
    
    // Subscribe to backup progress events
    const unsubscribeBackup = subscribeToBackupProgress((data) => {
      console.log('📡 Backup progress:', data);
      
      if (data.status === 'in-progress') {
        toast.loading(data.message, { id: data.stage });
      } else if (data.status === 'complete') {
        toast.success(data.message, { id: data.stage });
      } else if (data.status === 'failed') {
        toast.error(data.message, { id: data.stage });
      }
    });
    
    // Subscribe to deployment progress
    const unsubscribeDeployment = subscribeToDeploymentProgress((data) => {
      console.log('📡 Deployment progress:', data);
      
      if (data.status === 'in-progress') {
        toast.loading(data.message, { id: 'deployment' });
      } else if (data.status === 'complete') {
        toast.success(data.message, { id: 'deployment' });
      } else if (data.status === 'failed') {
        toast.error(data.message, { id: 'deployment' });
      }
    });
    
    // Subscribe to schedule results
    const unsubscribeSchedule = subscribeToScheduleResults((data) => {
      console.log('📡 Schedule results:', data);
      
      if (data.summary && data.summary.total_devices_backed_up > 0) {
        setScheduleResults(data);
        setShowBackupModal(true);
        toast.success(
          `Post-deployment schedules completed: ${data.summary.total_devices_backed_up} device(s) backed up`,
          { id: 'schedule', duration: 5000 }
        );
      }
    });
    
    return () => {
      unsubscribeBackup();
      unsubscribeDeployment();
      unsubscribeSchedule();
      disconnectSocket();
    };
  }, []);

  // Fetch YANG models when switching to netconf mode
  useEffect(() => {
    if (configMode === 'netconf') {
      fetchYangModels();
      fetchNetconfSessions();
    }
  }, [configMode]);

  const fetchDevices = useCallback(async () => {
    setDevicesLoading(true);
    try {
      const response = await axios.get('/devices?status=active');
      setDevices(response.data.devices || []);
    } catch (error) {
      console.error('Error fetching devices:', error);
    } finally {
      setDevicesLoading(false);
    }
  }, []);

  const fetchYangModels = useCallback(async () => {
    setYangModelsLoading(true);
    try {
      const response = await axios.get('/yang-models');
      setYangModels(response.data.yangModels || []);
    } catch (error) {
      console.error('Error fetching YANG models:', error);
    } finally {
      setYangModelsLoading(false);
    }
  }, []);

  const fetchNetconfSessions = useCallback(async () => {
    setNetconfSessionsLoading(true);
    try {
      const response = await axios.get('/devices/netconf/sessions');
      setNetconfSessions(response.data.sessions || []);
    } catch (error) {
      console.error('Error fetching NETCONF sessions:', error);
    } finally {
      setNetconfSessionsLoading(false);
    }
  }, []);

  const handleDisconnectNetconfSession = async (deviceId, deviceName) => {
    const toastId = toast.loading(`Disconnecting NETCONF session from ${deviceName}...`);
    try {
      await axios.post(`/devices/${deviceId}/netconf/disconnect`);
      toast.success(`NETCONF session disconnected from ${deviceName}`, { id: toastId });
      fetchNetconfSessions();
    } catch (error) {
      toast.error(`Failed to disconnect: ${error.response?.data?.message || error.message}`, { id: toastId });
    }
  };

  const handleYangModelSubmit = async (e) => {
    e.preventDefault();
    if (!yangFormData.name || !yangFormData.namespace || !yangFormData.yang_content) {
      toast.error('Please fill in required fields');
      return;
    }
    
    try {
      await axios.post('/yang-models', yangFormData);
      toast.success('YANG model uploaded successfully!');
      setShowYangUploadModal(false);
      resetYangForm();
      fetchYangModels();
    } catch (error) {
      console.error('Error uploading YANG model:', error);
      toast.error(error.response?.data?.message || 'Failed to upload YANG model');
    }
  };

  const handleYangModelDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this YANG model?')) return;
    try {
      await axios.delete(`/yang-models/${id}`);
      toast.success('YANG model deleted');
      fetchYangModels();
    } catch (error) {
      toast.error('Failed to delete YANG model');
    }
  };

  const handleYangModelToggle = async (id) => {
    try {
      const response = await axios.post(`/yang-models/toggle/${id}`);
      toast.success(response.data.message);
      fetchYangModels();
    } catch (error) {
      toast.error('Failed to toggle YANG model');
    }
  };

  const addYangTemplate = () => {
    if (!newTemplate.name || !newTemplate.template) {
      toast.error('Template name and content are required');
      return;
    }
    setYangFormData({
      ...yangFormData,
      xml_templates: [...yangFormData.xml_templates, { ...newTemplate }]
    });
    setNewTemplate({ name: '', description: '', template: '' });
  };

  const removeYangTemplate = (index) => {
    setYangFormData({
      ...yangFormData,
      xml_templates: yangFormData.xml_templates.filter((_, i) => i !== index)
    });
  };

  const addYangPath = () => {
    if (!newPath.path) {
      toast.error('Path is required');
      return;
    }
    setYangFormData({
      ...yangFormData,
      config_paths: [...yangFormData.config_paths, { ...newPath }]
    });
    setNewPath({ path: '', description: '', data_type: '', required: false });
  };

  const removeYangPath = (index) => {
    setYangFormData({
      ...yangFormData,
      config_paths: yangFormData.config_paths.filter((_, i) => i !== index)
    });
  };

  const resetYangForm = () => {
    setYangFormData({
      name: '',
      namespace: '',
      prefix: '',
      version: '1.0.0',
      device_type: 'nexus',
      category: 'other',
      description: '',
      yang_content: '',
      xml_templates: [],
      config_paths: []
    });
    setNewTemplate({ name: '', description: '', template: '' });
    setNewPath({ path: '', description: '', data_type: '', required: false });
  };

  const handleYangFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      const nameFromFile = file.name.replace('.yang', '');
      setYangFormData(prev => ({ 
        ...prev, 
        yang_content: content,
        name: prev.name || nameFromFile
      }));
    };
    reader.readAsText(file);
  };

  const getCategoryColor = (category) => {
    const colors = {
      interface: 'bg-blue-100 text-blue-700',
      routing: 'bg-green-100 text-green-700',
      switching: 'bg-yellow-100 text-yellow-700',
      security: 'bg-red-100 text-red-700',
      qos: 'bg-purple-100 text-purple-700',
      system: 'bg-gray-100 text-gray-700',
      other: 'bg-gray-100 text-gray-600'
    };
    return colors[category] || colors.other;
  };

  const handleGenerateConfiguration = async (e) => {
    e.preventDefault();
    if (!selectedDevice || !prompt) return;

    setIsGenerating(true);
    const modeLabel = configMode === 'netconf' ? 'NETCONF/YANG' : 'CLI';
    const toastId = toast.loading(`Generating ${modeLabel} configuration...`);
    
    try {
      const requestData = {
        device_id: selectedDevice,
        prompt: prompt
      };

      // Choose endpoint based on config mode
      const endpoint = configMode === 'netconf' 
        ? '/configurations/netconf/generate' 
        : '/configurations/generate';

      const response = await axios.post(endpoint, requestData);

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
          errorMessage = 'qwen2.5-coder:7b could not generate a valid configuration. Try being more specific.';
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

    const isNetconf = generatedConfig.config_type === 'netconf-yang';
    const modeLabel = isNetconf ? 'NETCONF' : 'SSH';

    const confirmed = await showConfirmation({
      title: `Deploy Configuration via ${modeLabel}`,
      message: `Are you sure you want to apply this configuration to the device using ${modeLabel}?\n\nThis action will modify the device configuration.${isNetconf && validateBeforeApply ? '\n\n✓ Validation will run before applying.' : ''}`,
      confirmText: 'Deploy',
      cancelText: 'Cancel',
      type: 'warning'
    });

    if (!confirmed) return;

    setIsApplying(true);
    const toastId = toast.loading(`Deploying via ${modeLabel}...`);
    
    try {
      // Choose endpoint based on config type
      const endpoint = isNetconf 
        ? '/configurations/netconf/apply' 
        : '/configurations/apply';

      const response = await axios.post(endpoint, {
        configuration_id: generatedConfig.id,
        validate_before_apply: isNetconf ? validateBeforeApply : false
      });

      console.log('✅ Configuration applied successfully!');
      
      // Extract deployment time from response
      const deploymentTime = response.data?.deployment_time || 
                            response.data?.deployment_time_ms || 
                            null;
      
      const deploymentTimeSeconds = response.data?.deployment_time_seconds || 
                            (response.data?.deployment_time_ms ? 
                            (response.data.deployment_time_ms / 1000).toFixed(2) : null);
      
      setGeneratedConfig({
        ...generatedConfig,
        status: 'applied',
        deployment_time: deploymentTime
      });
      
      const successMessage = deploymentTimeSeconds 
        ? `Configuration deployed successfully in ${deploymentTimeSeconds}s!` 
        : 'Configuration deployed successfully!';
      
      toast.success(successMessage, { id: toastId, duration: 5000 });
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

  const getValidationColor = useCallback((isValid) => {
    return isValid ? 'text-green-600' : 'text-red-600';
  }, []);

  const getValidationIcon = useCallback((isValid) => {
    return isValid ? 
      <CheckCircleIcon className="h-5 w-5 text-green-600" /> : 
      <CheckCircleIcon className="h-5 w-5 text-red-600" />;
  }, []);

  // Memoize example prompts to prevent recreation on every render
  const examplePrompts = useMemo(() => configMode === 'netconf' ? [
    // NX-OS NETCONF/YANG Examples - Interface Configuration
    "Configure interface Ethernet1/1 with description 'Uplink to Core' and MTU 9216",
    "Set interface Ethernet1/2 as access port on VLAN 100",
    "Configure port-channel 10 with members Ethernet1/3-4 using LACP active mode",
    
    // VLAN Configuration
    "Create VLAN 100 named PRODUCTION and VLAN 200 named MANAGEMENT",
    "Configure SVI interface Vlan100 with IP 192.168.100.1/24 and description 'Production Gateway'",
    
    // Routing Configuration  
    "Enable OSPF process 1 with router-id 10.0.0.1 and add interface Ethernet1/1 to area 0.0.0.0",
    "Configure BGP AS 65001 with neighbor 10.0.0.2 remote-as 65002",
    "Add static route to 172.16.0.0/16 via next-hop 10.0.0.254",
    
    // Advanced Features
    "Configure VXLAN with VNI 10100 mapped to VLAN 100 on NVE1",
    "Enable feature vpc and configure vpc domain 100 with peer-keepalive destination 192.168.1.2",
    "Configure HSRP group 1 on Vlan100 with virtual IP 192.168.100.254 and priority 110",
  ] : [
    // Router Examples
    "Configure OSPF routing for area 0 on GigabitEthernet0/0",
    "Set up static routes to 10.0.0.0/24 via 192.168.1.1",
    "Configure EIGRP AS 100 on network 192.168.0.0/16",
    // Layer 2 Switch Examples
    "Configure trunk port on interface GigabitEthernet1/0/1 allowing VLANs 10,20,30",
    "Create VLAN 100 named PRODUCTION and VLAN 200 named GUEST",
    "Set up port-security on interface FastEthernet0/1 with maximum 2 MAC addresses",
    // Layer 3 Switch Examples
    "Configure inter-VLAN routing for VLANs 10, 20, 30",
    "Set up SVI for VLAN 10 with IP 192.168.10.1/24",
    "Enable IP routing and configure default gateway 192.168.1.254"
  ], [configMode]);

  // Memoize filtered YANG models to prevent recalculation
  const filteredYangModels = useMemo(() => {
    return yangModels.filter(model => {
      const matchesSearch = !yangSearchTerm || 
        model.name.toLowerCase().includes(yangSearchTerm.toLowerCase()) ||
        model.namespace?.toLowerCase().includes(yangSearchTerm.toLowerCase()) ||
        model.description?.toLowerCase().includes(yangSearchTerm.toLowerCase());
      
      const matchesCategory = yangCategoryFilter === 'all' || 
        model.category === yangCategoryFilter;
      
      return matchesSearch && matchesCategory;
    });
  }, [yangModels, yangSearchTerm, yangCategoryFilter]);

  // Memoize active YANG models count
  const activeYangModelsCount = useMemo(() => 
    yangModels.filter(m => m.is_active).length
  , [yangModels]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <BotIcon className="h-8 w-8 text-blue-600" />
            LLM Configuration Generator
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Generate Cisco device configurations using AI-powered LLM via OpenRouter
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Config Mode Toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setConfigMode('cli')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                configMode === 'cli' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <CodeIcon className="h-4 w-4" />
              CLI
            </button>
            <button
              onClick={() => setConfigMode('netconf')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                configMode === 'netconf' 
                  ? 'bg-white text-purple-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <NetworkIcon className="h-4 w-4" />
              NETCONF/YANG
            </button>
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
      </div>

      {/* NETCONF Sub-Tabs Navigation - Only visible in NETCONF mode */}
      {configMode === 'netconf' && (
        <div className="flex items-center space-x-1 border-b border-gray-200 pb-0">
          <button
            onClick={() => setNetconfSubTab('generate')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              netconfSubTab === 'generate'
                ? 'border-purple-600 text-purple-600 bg-purple-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <SendIcon className="h-4 w-4" />
            Generate Config
          </button>
          <button
            onClick={() => { setNetconfSubTab('sessions'); fetchNetconfSessions(); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              netconfSubTab === 'sessions'
                ? 'border-green-600 text-green-600 bg-green-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ActivityIcon className="h-4 w-4" />
            Active Sessions
            {netconfSessions.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                {netconfSessions.length}
              </span>
            )}
          </button>
          <button
            onClick={() => { setNetconfSubTab('yang-models'); fetchYangModels(); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              netconfSubTab === 'yang-models'
                ? 'border-purple-600 text-purple-600 bg-purple-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FileTextIcon className="h-4 w-4" />
            YANG Models
            {activeYangModelsCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full">
                {activeYangModelsCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* CLI Mode or NETCONF Generate Tab */}
      {(configMode === 'cli' || (configMode === 'netconf' && netconfSubTab === 'generate')) && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Generation Form */}
        <div className="card p-6">
          <div className="flex items-center mb-4">
            {configMode === 'netconf' ? (
              <NetworkIcon className="h-6 w-6 text-purple-600 mr-2" />
            ) : (
              <BotIcon className="h-6 w-6 text-blue-600 mr-2" />
            )}
            <h2 className="text-lg font-medium text-gray-900">
              Generate {configMode === 'netconf' ? 'NETCONF/YANG' : 'CLI'} Configuration
            </h2>
            {configMode === 'netconf' && (
              <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                NX-OS
              </span>
            )}
          </div>

          {configMode === 'netconf' && (
            <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>NETCONF/YANG Mode:</strong> Generates XML configuration for NX-OS devices using YANG models.
                Requires NETCONF enabled on the device (port 830).
              </p>
            </div>
          )}

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
            <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
              {examplePrompts.map((example, index) => (
                <button
                  key={index}
                  onClick={() => setPrompt(example)}
                  className={`text-left text-sm block w-full p-2 rounded-lg transition-colors ${
                    configMode === 'netconf' 
                      ? 'text-purple-600 hover:text-purple-800 hover:bg-purple-50' 
                      : 'text-blue-600 hover:text-blue-800 hover:bg-blue-50'
                  }`}
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
              <div className="flex items-center space-x-4">
                {/* Validate Before Apply Checkbox - only for NETCONF */}
                {generatedConfig.config_type === 'netconf-yang' && (
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={validateBeforeApply}
                      onChange={(e) => setValidateBeforeApply(e.target.checked)}
                      className="h-4 w-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                    />
                    <span>Validate before apply</span>
                  </label>
                )}
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
                    {generatedConfig.config_type === 'netconf-yang' && (
                      <span className="ml-2 px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                        NETCONF
                      </span>
                    )}
                  </div>
                  <span className={`badge ${
                    generatedConfig.status === 'applied' ? 'badge-success' : 
                    generatedConfig.status === 'failed' ? 'badge-danger' : 'badge-info'
                  }`}>
                    {generatedConfig.status}
                  </span>
                </div>
                
                {/* Model Info */}
                <div className="mt-2 flex items-center flex-wrap text-xs text-gray-500">
                  <BotIcon className="h-3 w-3 mr-1" />
                  <span>Generated with: <span className="font-mono font-medium">{generatedConfig.ai_model}</span></span>
                  {generatedConfig.config_type === 'netconf-yang' && (
                    <span className="ml-2 text-purple-600 font-medium">• NETCONF/YANG XML</span>
                  )}
                {generatedConfig.execution_time && (
                  <span className="ml-3 text-green-600 font-medium">• Generation: {(generatedConfig.execution_time / 1000).toFixed(2)}s</span>
                )}
                {generatedConfig.deployment_time && (
                  <span className="ml-3 text-green-600 font-medium">• Deploy: {(generatedConfig.deployment_time / 1000).toFixed(2)}s</span>
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
      )}

      {/* Active NETCONF Sessions Tab - Only visible in NETCONF mode when sessions tab is selected */}
      {configMode === 'netconf' && netconfSubTab === 'sessions' && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <ActivityIcon className="h-6 w-6 text-green-600 mr-2" />
              <h2 className="text-lg font-medium text-gray-900">Active NETCONF Sessions</h2>
              <span className="ml-2 text-sm text-gray-500">
                ({netconfSessions.length} active)
              </span>
            </div>
            <button
              onClick={fetchNetconfSessions}
              disabled={netconfSessionsLoading}
              className="btn btn-secondary btn-sm"
            >
              <RefreshCwIcon className={`h-4 w-4 mr-1 ${netconfSessionsLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
          
          <p className="text-sm text-gray-600 mb-4">
            Monitor and manage active NETCONF connections to your NX-OS devices.
          </p>

          {netconfSessionsLoading ? (
            <div className="text-center py-6">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mx-auto"></div>
            </div>
          ) : netconfSessions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <WifiIcon className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="text-lg font-medium">No active NETCONF sessions</p>
              <p className="text-sm mt-1">Sessions are created when you apply NETCONF configurations</p>
              <button
                onClick={() => setNetconfSubTab('generate')}
                className="mt-4 btn btn-primary btn-sm"
              >
                <SendIcon className="h-4 w-4 mr-1" />
                Go to Generate Config
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {netconfSessions.map((session) => (
                <div 
                  key={session.deviceId} 
                  className="flex items-center justify-between p-4 border border-green-200 rounded-lg bg-green-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <WifiIcon className="h-6 w-6 text-green-600" />
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></span>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {session.device_name || 'Unknown Device'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {session.device_ip || session.deviceId} • Port 830
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right text-sm text-gray-500">
                      <div>Connected: {session.connectedAt ? new Date(session.connectedAt).toLocaleTimeString() : 'N/A'}</div>
                      {session.capabilities && (
                        <div className="text-xs">{session.capabilities.length} capabilities</div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDisconnectNetconfSession(session.deviceId, session.device_name)}
                      className="btn btn-danger btn-sm"
                      title="Disconnect Session"
                    >
                      <XCircleIcon className="h-4 w-4 mr-1" />
                      Disconnect
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* YANG Models Tab - Only visible in NETCONF mode when yang-models tab is selected */}
      {configMode === 'netconf' && netconfSubTab === 'yang-models' && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <FileTextIcon className="h-6 w-6 text-purple-600 mr-2" />
              <h2 className="text-lg font-medium text-gray-900">YANG Models</h2>
              <span className="ml-2 text-sm text-gray-500">
                ({activeYangModelsCount} active)
              </span>
            </div>
            <button
              onClick={() => setShowYangUploadModal(true)}
              className="btn btn-primary btn-sm"
            >
              <UploadIcon className="h-4 w-4 mr-1" />
              Upload Model
            </button>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            Upload custom YANG models to improve XML configuration generation accuracy.
          </p>

          {/* Search and Category Filter */}
          {yangModels.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              {/* Search Input */}
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search YANG models..."
                  value={yangSearchTerm}
                  onChange={(e) => setYangSearchTerm(e.target.value)}
                  className="input pl-9 text-sm"
                />
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              
              {/* Category Filter */}
              <select
                value={yangCategoryFilter}
                onChange={(e) => setYangCategoryFilter(e.target.value)}
                className="input text-sm w-full sm:w-40"
              >
                <option value="all">All Categories</option>
                <option value="interface">Interface</option>
                <option value="routing">Routing</option>
                <option value="vlan">VLAN</option>
                <option value="system">System</option>
                <option value="security">Security</option>
                <option value="qos">QoS</option>
                <option value="other">Other</option>
              </select>
            </div>
          )}

          {yangModelsLoading ? (
            <div className="text-center py-6">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mx-auto"></div>
            </div>
          ) : yangModels.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <FileTextIcon className="h-10 w-10 mx-auto mb-2 text-gray-300" />
              <p>No YANG models uploaded yet</p>
              <p className="text-xs mt-1">Upload models to enhance configuration generation</p>
            </div>
          ) : filteredYangModels.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <p>No YANG models match your search</p>
              <button
                onClick={() => { setYangSearchTerm(''); setYangCategoryFilter('all'); }}
                className="text-purple-600 text-sm mt-2 hover:underline"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {/* Results count */}
              {(yangSearchTerm || yangCategoryFilter !== 'all') && (
                <p className="text-xs text-gray-500 mb-2">
                  Showing {filteredYangModels.length} of {yangModels.length} models
                </p>
              )}
              {filteredYangModels.map((model) => (
                <div 
                  key={model.id} 
                  className={`border rounded-lg overflow-hidden ${model.is_active ? 'border-purple-200' : 'border-gray-200 opacity-60'}`}
                >
                  <div 
                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
                    onClick={() => setExpandedYangModel(expandedYangModel === model.id ? null : model.id)}
                  >
                    <div className="flex items-center gap-3">
                      <FileTextIcon className={`h-5 w-5 ${model.is_active ? 'text-purple-600' : 'text-gray-400'}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{model.name}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${getCategoryColor(model.category)}`}>
                            {model.category}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 font-mono truncate max-w-xs">{model.namespace}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {model.xml_templates?.length > 0 && (
                        <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                          {model.xml_templates.length} templates
                        </span>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleYangModelToggle(model.id); }}
                        className={`p-1 rounded ${model.is_active ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                        title={model.is_active ? 'Disable' : 'Enable'}
                      >
                        <CheckCircleIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleYangModelDelete(model.id); }}
                        className="p-1 rounded text-red-500 hover:bg-red-50"
                        title="Delete"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                      {expandedYangModel === model.id ? (
                        <ChevronUpIcon className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  </div>
                  
                  {expandedYangModel === model.id && (
                    <div className="border-t bg-gray-50 p-3 space-y-2">
                      {model.description && (
                        <p className="text-xs text-gray-600">{model.description}</p>
                      )}
                      {model.xml_templates?.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-gray-700 mb-1">Templates:</p>
                          {model.xml_templates.map((tmpl, idx) => (
                            <div key={idx} className="text-xs bg-white rounded p-2 border mb-1">
                              <span className="font-medium">{tmpl.name}</span>
                              {tmpl.description && <span className="text-gray-500"> - {tmpl.description}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* YANG Model Upload Modal */}
      {showYangUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto">
            <div className="p-4 border-b sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <UploadIcon className="h-5 w-5 text-purple-600" />
                Upload YANG Model
              </h2>
            </div>
            
            <form onSubmit={handleYangModelSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Model Name *</label>
                  <input
                    type="text"
                    value={yangFormData.name}
                    onChange={(e) => setYangFormData({ ...yangFormData, name: e.target.value })}
                    className="input"
                    placeholder="e.g., Cisco-NX-OS-device"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prefix</label>
                  <input
                    type="text"
                    value={yangFormData.prefix}
                    onChange={(e) => setYangFormData({ ...yangFormData, prefix: e.target.value })}
                    className="input"
                    placeholder="e.g., nxos"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Namespace URI *</label>
                <input
                  type="url"
                  value={yangFormData.namespace}
                  onChange={(e) => setYangFormData({ ...yangFormData, namespace: e.target.value })}
                  className="input font-mono text-sm"
                  placeholder="http://cisco.com/ns/yang/cisco-nx-os-device"
                  required
                />
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Device Type</label>
                  <select
                    value={yangFormData.device_type}
                    onChange={(e) => setYangFormData({ ...yangFormData, device_type: e.target.value })}
                    className="input"
                  >
                    <option value="nexus">Nexus (NX-OS)</option>
                    <option value="ios">IOS</option>
                    <option value="ios-xe">IOS-XE</option>
                    <option value="ios-xr">IOS-XR</option>
                    <option value="all">All Devices</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={yangFormData.category}
                    onChange={(e) => setYangFormData({ ...yangFormData, category: e.target.value })}
                    className="input"
                  >
                    <option value="interface">Interface</option>
                    <option value="routing">Routing</option>
                    <option value="switching">Switching</option>
                    <option value="security">Security</option>
                    <option value="qos">QoS</option>
                    <option value="system">System</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Version</label>
                  <input
                    type="text"
                    value={yangFormData.version}
                    onChange={(e) => setYangFormData({ ...yangFormData, version: e.target.value })}
                    className="input"
                    placeholder="1.0.0"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={yangFormData.description}
                  onChange={(e) => setYangFormData({ ...yangFormData, description: e.target.value })}
                  className="input"
                  placeholder="Brief description..."
                />
              </div>
              
              {/* YANG Content */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">YANG Model Content *</label>
                  <label className="btn btn-secondary btn-sm cursor-pointer">
                    <UploadIcon className="h-3 w-3 mr-1" />
                    Upload .yang
                    <input type="file" accept=".yang" onChange={handleYangFileUpload} className="hidden" />
                  </label>
                </div>
                <textarea
                  value={yangFormData.yang_content}
                  onChange={(e) => setYangFormData({ ...yangFormData, yang_content: e.target.value })}
                  className="input font-mono text-xs"
                  rows={6}
                  placeholder="Paste YANG model content or upload a .yang file..."
                  required
                />
              </div>
              
              {/* XML Templates */}
              <div className="border rounded-lg p-3">
                <h3 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-1">
                  <CodeIcon className="h-4 w-4" />
                  XML Templates (Optional)
                </h3>
                
                {yangFormData.xml_templates.length > 0 && (
                  <div className="mb-3 space-y-1">
                    {yangFormData.xml_templates.map((tmpl, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded p-2 text-xs">
                        <span className="font-medium flex-1">{tmpl.name}</span>
                        <button type="button" onClick={() => removeYangTemplate(idx)} className="text-red-500">
                          <TrashIcon className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={newTemplate.name}
                      onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                      className="input text-sm"
                      placeholder="Template name"
                    />
                    <input
                      type="text"
                      value={newTemplate.description}
                      onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                      className="input text-sm"
                      placeholder="Description (optional)"
                    />
                  </div>
                  <textarea
                    value={newTemplate.template}
                    onChange={(e) => setNewTemplate({ ...newTemplate, template: e.target.value })}
                    className="input font-mono text-xs"
                    rows={3}
                    placeholder="<System xmlns=...>..."
                  />
                  <button type="button" onClick={addYangTemplate} className="btn btn-secondary btn-sm">
                    <PlusIcon className="h-3 w-3 mr-1" />
                    Add Template
                  </button>
                </div>
              </div>
              
              {/* Config Paths */}
              <div className="border rounded-lg p-3">
                <h3 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-1">
                  <FolderIcon className="h-4 w-4" />
                  Config Paths (Optional)
                </h3>
                
                {yangFormData.config_paths.length > 0 && (
                  <div className="mb-3 space-y-1">
                    {yangFormData.config_paths.map((path, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded p-2 text-xs">
                        <code className="font-mono text-purple-600 flex-1">{path.path}</code>
                        <button type="button" onClick={() => removeYangPath(idx)} className="text-red-500">
                          <TrashIcon className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPath.path}
                    onChange={(e) => setNewPath({ ...newPath, path: e.target.value })}
                    className="input text-sm font-mono flex-1"
                    placeholder="/System/intf-items/..."
                  />
                  <button type="button" onClick={addYangPath} className="btn btn-secondary btn-sm">
                    <PlusIcon className="h-3 w-3" />
                  </button>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => { setShowYangUploadModal(false); resetYangForm(); }}
                  className="btn btn-secondary btn-md"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-md">
                  <UploadIcon className="h-4 w-4 mr-1" />
                  Upload Model
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


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

      {/* Backup Progress Modal */}
      <BackupProgressModal
        isOpen={showBackupModal}
        onClose={() => setShowBackupModal(false)}
        scheduleResults={scheduleResults}
      />
    </div>
  );
}

export default Configurations;
