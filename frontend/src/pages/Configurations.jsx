import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { 
  BrainCircuitIcon, 
  SendIcon, 
  CheckCircleIcon, 
  ServerIcon,
  RefreshCwIcon,
  CodeIcon,
  NetworkIcon,
  UploadIcon,
  FileTextIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
  FolderIcon,
  WifiIcon,
  XCircleIcon,
  ActivityIcon,
  PlayIcon,
  SearchIcon,
  TerminalIcon,
  CopyIcon,
  EyeIcon,
  XIcon,
  Router as RouterIcon
} from 'lucide-react';
import ConfirmationModal from '../components/ConfirmationModal';
import ConfigProgressModal from '../components/ConfigProgressModal';
import DeviceIcon from '../components/DeviceIcon';
import ZoomControls from '../components/ZoomControls';
import { useConfirmation } from '../hooks/useConfirmation';
import { useResponsive } from '../hooks/useResponsive';
import { validateConfigPrompt, getValidationErrorMessage } from '../utils/promptValidator';
import { 
  connectSocket, 
  disconnectSocket,
  subscribeToBackupProgress,
  subscribeToDeploymentProgress
} from '../services/socket';

function Configurations() {
  const { getFormStyles } = useResponsive();
  const formStyles = getFormStyles();
  
  const [devices, setDevices] = useState([]);
  const [showDeviceDropdown, setShowDeviceDropdown] = useState(false);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [selectedDevices, setSelectedDevices] = useState([]); // Multi-device for CLI mode
  const [multiDeviceResults, setMultiDeviceResults] = useState([]); // Results for multi-device generation
  const [activeResultTab, setActiveResultTab] = useState(0); // Active tab for multi-device results
  const [prompt, setPrompt] = useState('');
  const [promptLanguage, setPromptLanguage] = useState('en'); // 'en' or 'th'
  const [isTranslating, setIsTranslating] = useState(false);
  const [configMode, setConfigMode] = useState('cli'); // 'cli' or 'netconf'
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [generatedConfig, setGeneratedConfig] = useState(null);
  const [validation, setValidation] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedConfig, setEditedConfig] = useState('');
  const [showConfigProgressModal, setShowConfigProgressModal] = useState(false);
  const [generationError, setGenerationError] = useState(null);
  
  // YANG Models state
  const [yangModels, setYangModels] = useState([]);
  const [yangModelsLoading, setYangModelsLoading] = useState(false);
  const [showYangUploadModal, setShowYangUploadModal] = useState(false);
  const [showCustomYangModal, setShowCustomYangModal] = useState(false);
  const [showYangDetailModal, setShowYangDetailModal] = useState(false);
  const [selectedYangModel, setSelectedYangModel] = useState(null);
  const [expandedYangModel, setExpandedYangModel] = useState(null);
  const [yangFormData, setYangFormData] = useState({
    name: '',
    namespace: '',
    prefix: '',
    version: '1.0.0',
    device_type: 'all',
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
  const [connectingDeviceId, setConnectingDeviceId] = useState(null);
  const [validateBeforeApply, setValidateBeforeApply] = useState(false); // Default disabled - some NX-OS devices don't support validate
  const [expandedSession, setExpandedSession] = useState(null);
  
  // YANG Models search/filter
  const [yangSearchTerm, setYangSearchTerm] = useState('');
  const [yangCategoryFilter, setYangCategoryFilter] = useState('all');
  const [selectedYangModelsForGen, setSelectedYangModelsForGen] = useState([]); // Selected YANG models for generation
  
  // NETCONF sub-tabs: 'generate', 'sessions', 'yang-models', 'operations'
  const [netconfSubTab, setNetconfSubTab] = useState('generate');
  
  // NETCONF Operations state
  const [operationDevice, setOperationDevice] = useState('');
  const [operationType, setOperationType] = useState('get');
  const [operationFilter, setOperationFilter] = useState('');
  const [customRpc, setCustomRpc] = useState('');
  const [operationResult, setOperationResult] = useState(null);
  const [isExecutingOperation, setIsExecutingOperation] = useState(false);

  const deviceDropdownRef = useRef(null);

  const { confirmationState, showConfirmation } = useConfirmation();

  // Helper function to wrap NETCONF config with validate RPC when validateBeforeApply is enabled
  // This shows users the actual NETCONF RPC workflow that will be executed
  const generateNetconfWorkflowXml = (config, shouldValidate) => {
    if (!config) return config;
    
    // Check if it's XML/NETCONF config
    if (!config.includes('<') || !config.includes('>')) return config;
    
    // Check if already wrapped with workflow
    if (config.includes('<!-- NETCONF Workflow:')) return config;
    
    // Clean any XML declaration from config for embedding
    const cleanConfig = config.replace(/<\?xml[^?]*\?>\s*/g, '').trim();
    
    // Indent the config for proper nesting
    const indentedConfig = cleanConfig.split('\n').map(line => '        ' + line).join('\n');
    
    if (shouldValidate) {
      // Generate full NETCONF workflow with validation
      return `<?xml version="1.0" encoding="UTF-8"?>
<!-- NETCONF Workflow: Validate Before Apply -->
<!-- Step 1: Lock candidate datastore -->
<rpc message-id="1" xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
  <lock>
    <target>
      <candidate/>
    </target>
  </lock>
</rpc>

<!-- Step 2: Edit candidate configuration -->
<rpc message-id="2" xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
  <edit-config>
    <target>
      <candidate/>
    </target>
    <default-operation>merge</default-operation>
    <config>
${indentedConfig}
    </config>
  </edit-config>
</rpc>

<!-- Step 3: Validate candidate configuration (RFC 6241) -->
<rpc message-id="3" xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
  <validate>
    <source>
      <candidate/>
    </source>
  </validate>
</rpc>

<!-- Step 4: Commit validated configuration -->
<rpc message-id="4" xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
  <commit/>
</rpc>

<!-- Step 5: Unlock candidate datastore -->
<rpc message-id="5" xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
  <unlock>
    <target>
      <candidate/>
    </target>
  </unlock>
</rpc>`;
    } else {
      // Generate NETCONF workflow without validation
      return `<?xml version="1.0" encoding="UTF-8"?>
<!-- NETCONF Workflow: Direct Apply (No Validation) -->
<!-- Step 1: Lock candidate datastore -->
<rpc message-id="1" xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
  <lock>
    <target>
      <candidate/>
    </target>
  </lock>
</rpc>

<!-- Step 2: Edit candidate configuration -->
<rpc message-id="2" xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
  <edit-config>
    <target>
      <candidate/>
    </target>
    <default-operation>merge</default-operation>
    <config>
${indentedConfig}
    </config>
  </edit-config>
</rpc>

<!-- Step 3: Commit configuration -->
<rpc message-id="3" xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
  <commit/>
</rpc>

<!-- Step 4: Unlock candidate datastore -->
<rpc message-id="4" xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
  <unlock>
    <target>
      <candidate/>
    </target>
  </unlock>
</rpc>`;
    }
  };

  // Computed config with NETCONF workflow when displaying NETCONF config
  const displayConfig = generatedConfig?.config_type === 'netconf-yang'
    ? generateNetconfWorkflowXml(generatedConfig?.generated_config, validateBeforeApply)
    : generatedConfig?.generated_config;

  // Close device dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (deviceDropdownRef.current && !deviceDropdownRef.current.contains(event.target)) {
        setShowDeviceDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    
    return () => {
      unsubscribeBackup();
      unsubscribeDeployment();
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

  const handleConnectNetconf = async (device) => {
    const deviceId = device.id || device._id;
    const deviceName = device.name;
    setConnectingDeviceId(deviceId);
    const toastId = toast.loading(`Connecting NETCONF to ${deviceName}...`);
    
    try {
      const response = await axios.post(`/devices/${deviceId}/netconf/connect`);
      
      if (response.data.success) {
        toast.success(`NETCONF connected to ${deviceName}! (${response.data.capabilities?.length || 0} capabilities)`, { id: toastId });
        fetchNetconfSessions();
      } else {
        toast.error(`NETCONF connection failed: ${response.data.message}`, { id: toastId });
      }
    } catch (error) {
      console.error('NETCONF connect error:', error);
      toast.error(`NETCONF connection failed: ${error.response?.data?.message || error.message}`, { id: toastId });
    } finally {
      setConnectingDeviceId(null);
    }
  };

  const handleToggleMockMode = async (device) => {
    const deviceId = device.id || device._id;
    const deviceName = device.name;
    const currentMockMode = device.netconf_mock_mode === true;
    
    const toastId = toast.loading(`${currentMockMode ? 'Disabling' : 'Enabling'} mock mode for ${deviceName}...`);
    
    try {
      const response = await axios.post(`/configurations/netconf/mock/${deviceId}`, {
        enabled: !currentMockMode
      });
      
      if (response.data.success) {
        toast.success(response.data.message, { id: toastId });
        // Refresh devices to get updated mock mode status
        fetchDevices();
        fetchNetconfSessions();
      } else {
        toast.error(`Failed to toggle mock mode: ${response.data.message}`, { id: toastId });
      }
    } catch (error) {
      console.error('Toggle mock mode error:', error);
      toast.error(`Failed to toggle mock mode: ${error.response?.data?.message || error.message}`, { id: toastId });
    }
  };

  const handleYangModelSubmit = async (e) => {
    e.preventDefault();
    if (!yangFormData.name || !yangFormData.yang_content) {
      toast.error('Please upload a YANG file first');
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
    const confirmed = await showConfirmation({
      title: 'Delete YANG Model',
      message: 'Are you sure you want to delete this YANG model?',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger'
    });
    
    if (!confirmed) return;
    try {
      await axios.delete(`/yang-models/${id}`);
      toast.success('YANG model deleted');
      fetchYangModels();
    } catch {
      toast.error('Failed to delete YANG model');
    }
  };

  const handleViewYangModel = async (id) => {
    try {
      const response = await axios.get(`/yang-models/${id}`);
      if (response.data.success) {
        setSelectedYangModel(response.data.yangModel);
        setShowYangDetailModal(true);
      }
    } catch (error) {
      toast.error('Failed to load YANG model details');
      console.error('Error fetching YANG model:', error);
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
      device_type: 'all',
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
    
    // Check file size (Vercel has 4.5MB body limit)
    const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB to be safe
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is 4MB.`);
      e.target.value = '';
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      const nameFromFile = file.name.replace(/\.yang$/i, '');
      
      // Parse YANG file to extract metadata
      const parsedData = parseYangFile(content, nameFromFile);
      
      setYangFormData(prev => ({ 
        ...prev, 
        ...parsedData,
        yang_content: content
      }));
      
      toast.success(`YANG file "${file.name}" loaded! Metadata auto-extracted.`);
    };
    reader.readAsText(file);
  };

  // Parse YANG file content to extract metadata
  const parseYangFile = (content, fileName) => {
    const result = {
      name: fileName,
      namespace: '',
      prefix: '',
      description: '',
      version: '1.0.0',
      device_type: 'all',  // Default to 'all' - will auto-detect if possible
      category: 'other'
    };
    
    try {
      // Extract module/submodule name
      const moduleMatch = content.match(/(?:module|submodule)\s+([^\s{]+)/);
      if (moduleMatch) {
        result.name = moduleMatch[1];
      }
      
      // Extract namespace
      const namespaceMatch = content.match(/namespace\s+"([^"]+)"/);
      if (namespaceMatch) {
        result.namespace = namespaceMatch[1];
        const nsLower = namespaceMatch[1].toLowerCase();
        
        // Auto-detect device type from namespace (case-insensitive)
        if (nsLower.includes('cisco-nx-os') || nsLower.includes('nx-os')) {
          result.device_type = 'nexus';
        } else if (nsLower.includes('cisco-ios-xe') || nsLower.includes('ios-xe')) {
          result.device_type = 'ios-xe';
        } else if (nsLower.includes('cisco-ios-xr') || nsLower.includes('ios-xr')) {
          result.device_type = 'ios-xr';
        } else if (nsLower.includes('cisco-ios') && !nsLower.includes('xe') && !nsLower.includes('xr')) {
          result.device_type = 'ios';
        }
        // If no match, keep 'all' as default
      }
      
      // Also check module name for device type hints
      if (result.device_type === 'all' && result.name) {
        const nameLower = result.name.toLowerCase();
        if (nameLower.includes('nx-os') || nameLower.includes('nxos')) {
          result.device_type = 'nexus';
        } else if (nameLower.includes('ios-xe') || nameLower.startsWith('cisco-ios-xe')) {
          result.device_type = 'ios-xe';
        } else if (nameLower.includes('ios-xr') || nameLower.startsWith('cisco-ios-xr')) {
          result.device_type = 'ios-xr';
        }
      }
      
      // Extract prefix
      const prefixMatch = content.match(/prefix\s+([^\s;{]+)/);
      if (prefixMatch) {
        result.prefix = prefixMatch[1].replace(/[";]/g, '');
      }
      
      // Extract description (first description found, usually module description)
      const descMatch = content.match(/description\s+"([^"]+)"/);
      if (descMatch) {
        result.description = descMatch[1].substring(0, 200); // Limit to 200 chars
      }
      
      // Extract revision/version
      const revisionMatch = content.match(/revision\s+(\d{4}-\d{2}-\d{2})/);
      if (revisionMatch) {
        result.version = revisionMatch[1];
      }
      
      // Auto-detect category from content keywords
      const lowerContent = content.toLowerCase();
      if (lowerContent.includes('interface') || lowerContent.includes('ethernet')) {
        result.category = 'interface';
      } else if (lowerContent.includes('bgp') || lowerContent.includes('ospf') || lowerContent.includes('routing')) {
        result.category = 'routing';
      } else if (lowerContent.includes('vlan') || lowerContent.includes('spanning-tree') || lowerContent.includes('switching')) {
        result.category = 'switching';
      } else if (lowerContent.includes('acl') || lowerContent.includes('security') || lowerContent.includes('aaa')) {
        result.category = 'security';
      } else if (lowerContent.includes('qos') || lowerContent.includes('policy-map')) {
        result.category = 'qos';
      } else if (lowerContent.includes('system') || lowerContent.includes('hostname') || lowerContent.includes('ntp')) {
        result.category = 'system';
      }
      
    } catch (error) {
      console.warn('Error parsing YANG file:', error);
    }
    
    return result;
  };

  const getCategoryColor = (category) => {
    const colors = {
      interface: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
      routing: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300',
      switching: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300',
      security: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300',
      qos: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300',
      system: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
      other: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
    };
    return colors[category] || colors.other;
  };

  // Translation dictionary for network configuration terms
  const translationDict = useMemo(() => ({
    // English to Thai
    en: {
      'configure': 'ตั้งค่า',
      'set up': 'กำหนด',
      'set': 'กำหนด',
      'create': 'สร้าง',
      'enable': 'เปิดใช้งาน',
      'disable': 'ปิดใช้งาน',
      'add': 'เพิ่ม',
      'remove': 'ลบ',
      'delete': 'ลบ',
      'interface': 'interface',
      'with': 'ด้วย',
      'and': 'และ',
      'on': 'บน',
      'for': 'สำหรับ',
      'to': 'ไป',
      'via': 'ผ่าน',
      'using': 'ใช้',
      'named': 'ชื่อ',
      'as': 'เป็น',
      'description': 'description',
      'routing': 'routing',
      'static route': 'static route',
      'static routes': 'static routes',
      'trunk port': 'trunk port',
      'access port': 'access port',
      'port-channel': 'port-channel',
      'members': 'สมาชิก',
      'allowing': 'อนุญาต',
      'maximum': 'จำกัด',
      'default gateway': 'default gateway',
      'next-hop': 'next-hop',
      'area': 'area',
      'network': 'network',
      'neighbor': 'neighbor',
      'remote-as': 'remote-as',
      'mapped': 'แมป',
      'destination': 'destination',
      'priority': 'priority',
      'virtual': 'virtual',
      'group': 'group',
      'domain': 'domain',
      'peer-keepalive': 'peer-keepalive',
      'active mode': 'active mode',
    },
    // Thai to English  
    th: {
      'ตั้งค่า': 'configure',
      'กำหนด': 'set',
      'สร้าง': 'create',
      'เปิดใช้งาน': 'enable',
      'ปิดใช้งาน': 'disable',
      'เพิ่ม': 'add',
      'ลบ': 'remove',
      'ด้วย': 'with',
      'และ': 'and',
      'บน': 'on',
      'สำหรับ': 'for',
      'ไป': 'to',
      'ผ่าน': 'via',
      'ใช้': 'using',
      'ชื่อ': 'named',
      'เป็น': 'as',
      'สมาชิก': 'members',
      'อนุญาต': 'allowing',
      'จำกัด': 'maximum',
      'แมป': 'mapped',
      'พร้อม': 'with',
      'กับ': 'with',
    }
  }), []);

  // Translate prompt between English and Thai (client-side)
  const handleTranslatePrompt = () => {
    if (!prompt.trim() || isTranslating) return;
    
    setIsTranslating(true);
    const targetLang = promptLanguage === 'en' ? 'th' : 'en';
    const langNames = { en: 'English', th: 'ไทย' };
    
    try {
      let translatedText = prompt;
      const dict = translationDict[promptLanguage];
      
      // Sort keys by length (longest first) to avoid partial replacements
      const sortedKeys = Object.keys(dict).sort((a, b) => b.length - a.length);
      
      for (const key of sortedKeys) {
        // For Thai (no word boundaries), use simple replace
        // For English, use word boundaries
        if (promptLanguage === 'th') {
          // Thai: simple global replace (case-sensitive for Thai)
          translatedText = translatedText.split(key).join(dict[key]);
        } else {
          // English: use word boundaries
          const regex = new RegExp(`\\b${key}\\b`, 'gi');
          translatedText = translatedText.replace(regex, dict[key]);
        }
      }
      
      setPrompt(translatedText);
      setPromptLanguage(targetLang);
      toast.success(`Translated to ${langNames[targetLang]}`);
    } catch (error) {
      console.error('Translation error:', error);
      toast.error('Translation failed');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleGenerateConfiguration = async (e) => {
    e.preventDefault();
    
    // Determine if multi-device (CLI mode with multiple devices selected)
    const isMultiDevice = configMode === 'cli' && selectedDevices.length > 1;
    const hasDevice = configMode === 'cli' ? selectedDevices.length > 0 : !!selectedDevice;
    
    if (!hasDevice || !prompt) return;

    // Validate that the prompt is about network configuration
    const validation = validateConfigPrompt(prompt);
    if (!validation.isValid) {
      const errorMessage = getValidationErrorMessage(validation);
      setGenerationError(errorMessage);
      toast.error('Please enter a valid network configuration prompt', { duration: 5000 });
      
      // Show suggestion in a separate toast
      if (validation.suggestions.length > 0) {
        setTimeout(() => {
          toast(`💡 Try: "${validation.suggestions[0]}"`, { 
            duration: 6000,
            icon: '📝'
          });
        }, 500);
      }
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);
    setShowConfigProgressModal(true);
    setMultiDeviceResults([]);
    const modeLabel = configMode === 'netconf' ? 'NETCONF/YANG' : 'CLI';
    
    try {
      // Multi-device generation (CLI mode)
      if (isMultiDevice) {
        // Clean out undefined values in case of selection errors
        const validDeviceIds = selectedDevices.filter(id => id);
        
        if (validDeviceIds.length === 0) {
           throw new Error('No valid devices selected.');
        }

        const response = await axios.post('/configurations/generate-multi', {
          device_ids: validDeviceIds,
          prompt: prompt
        });

        // Handle async Ollama pending state for multi-device
        if (response.data.results && response.data.results.some(r => r.pending)) {
          toast('Generating via Ollama AI...', { icon: '🧠', duration: 5000 });
          const pendingResult = response.data.results.find(r => r.pending);
          const commandId = pendingResult.commandId;
          
          const maxPollTime = 120000;
          const pollInterval = 2000;
          const pollStart = Date.now();
          
          let ollamaResult = null;
          while (Date.now() - pollStart < maxPollTime) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            try {
              const pollRes = await axios.get(`/configurations/llm-result/${commandId}`);
              if (pollRes.data.status === 'completed') {
                ollamaResult = pollRes.data.result;
                break;
              } else if (pollRes.data.status === 'failed') {
                throw new Error(pollRes.data.error || 'Ollama generation failed');
              }
            } catch (pollErr) {
              if (pollErr.response?.status === 404) {
                throw new Error('Generation request expired. Please try again.');
              }
              throw pollErr;
            }
          }
          
          if (!ollamaResult) {
            throw new Error('Ollama generation timed out. Try a smaller model or simpler prompt.');
          }

          toast.success('Configuration generated via Ollama! (Async result)');
          
          // Show the raw multi-device output as the first device's result since it's hard to split perfectly without backend processing
          if (ollamaResult.content) {
             const mockConfiguration = {
                generated_config: ollamaResult.content,
                validation: { score: 0, warnings: ['Generated via Ollama — async result, validation pending'] },
                model: ollamaResult.model || 'ollama',
                provider: 'ollama',
                method: 'ollama_chat'
             };
             
             setMultiDeviceResults([{
                device_name: 'Multi-Device Response',
                success: true,
                configuration: mockConfiguration
             }]);
             setActiveResultTab(0);
             setGeneratedConfig(mockConfiguration);
             setValidation(mockConfiguration.validation);
             setEditedConfig(mockConfiguration.generated_config);
          }
          setIsEditing(false);
          setIsGenerating(false);
          return;
        }

        if (response.data.success && response.data.results) {
          setMultiDeviceResults(response.data.results);
          setActiveResultTab(0);
          
          // If first successful result, also set it as active generatedConfig
          const firstSuccess = response.data.results.find(r => r.success && r.configuration);
          if (firstSuccess) {
            setGeneratedConfig(firstSuccess.configuration);
            setValidation(firstSuccess.configuration.validation);
            setEditedConfig(firstSuccess.configuration.generated_config);
          }
          setIsEditing(false); // Make sure editing is false even if all failed
          setIsGenerating(false); // explicitly set to false to close modal loader
          
          toast.success(`Generated configurations for ${response.data.succeeded}/${response.data.total} devices`);
        } else {
          throw new Error(response.data.message || 'Multi-device generation failed');
        }
        return;
      }

      // Single device generation (existing flow)
      const requestData = {
        device_id: configMode === 'cli' && selectedDevices.length === 1 ? selectedDevices[0] : selectedDevice,
        prompt: prompt
      };

      // Add selected YANG models for NETCONF mode
      if (configMode === 'netconf' && selectedYangModelsForGen.length > 0) {
        requestData.yang_model_ids = selectedYangModelsForGen;
      }

      // Choose endpoint based on config mode
      const endpoint = configMode === 'netconf' 
        ? '/configurations/netconf/generate' 
        : '/configurations/generate';

      const response = await axios.post(endpoint, requestData);

      // Handle async Ollama generation (pending state)
      if (response.data.pending && response.data.commandId) {
        toast('Generating via Ollama AI...', { icon: '🧠', duration: 5000 });
        
        // Poll for result (check every 2 seconds, up to 120 seconds)
        const commandId = response.data.commandId;
        const maxPollTime = 120000;
        const pollInterval = 2000;
        const pollStart = Date.now();
        
        let ollamaResult = null;
        while (Date.now() - pollStart < maxPollTime) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          try {
            const pollRes = await axios.get(`/configurations/llm-result/${commandId}`);
            if (pollRes.data.status === 'completed') {
              ollamaResult = pollRes.data.result;
              break;
            } else if (pollRes.data.status === 'failed') {
              throw new Error(pollRes.data.error || 'Ollama generation failed');
            }
            // Still pending/processing — continue polling
          } catch (pollErr) {
            if (pollErr.response?.status === 404) {
              throw new Error('Generation request expired. Please try again.');
            }
            throw pollErr;
          }
        }
        
        if (!ollamaResult) {
          throw new Error('Ollama generation timed out. Try a smaller model or simpler prompt.');
        }

        // For async Ollama, we get raw LLM content — show it as a basic result
        // The full processing (cleaning, validation, saving) needs a second API call
        toast.success('Configuration generated via Ollama!');
        
        // Re-submit with the Ollama result to get full processing
        // The backend already processed and saved it if it completed within 8s
        // For async results, we show the raw content
        if (ollamaResult.content) {
          setGeneratedConfig({
            generated_config: ollamaResult.content,
            validation: { score: 0, warnings: ['Generated via Ollama — async result, validation pending'] },
            model: ollamaResult.model || 'ollama',
            provider: 'ollama',
            method: 'ollama_chat'
          });
          setEditedConfig(ollamaResult.content);
          setIsEditing(false);
        }
      } else if (response.data.configuration) {
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
        toast.success('Configuration generated successfully!');
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
        errorMessage = 'AI Service Unavailable - Please check if the AI server is running';
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
      setGenerationError(errorMessage);
      
      // Show error with suggestions if applicable
      if (showSuggestions && error.response?.data?.suggestions) {
        const suggestions = error.response.data.suggestions.join('\n• ');
        toast.error(`${errorMessage}\n\nSuggestions:\n• ${suggestions}`, { 
          duration: 8000 
        });
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyConfiguration = async () => {
    if (!generatedConfig) return;

    const isNetconf = generatedConfig.config_type === 'netconf-yang';
    const modeLabel = isNetconf ? 'NETCONF' : 'SSH';
    const configId = generatedConfig.id || generatedConfig._id;

    // Verify the interface names the LLM generated (e.g. "eth0/1") actually
    // exist on the real device (e.g. "GigabitEthernet0/1") before deploying.
    // CLI-only: NETCONF configs are XML and don't match the "interface X"
    // pattern this check looks for. If the device can't be reached to check,
    // we don't block deploy — only a confirmed mismatch does.
    if (configId && !isNetconf) {
      let verifyResult = null;
      const verifyToastId = toast.loading('Checking interface names against the device...');
      try {
        const verifyResponse = await axios.post(`/configurations/${configId}/verify-interfaces`);
        verifyResult = verifyResponse.data;
      } catch (verifyError) {
        console.warn('Interface verification failed, proceeding without it:', verifyError.message);
      } finally {
        toast.dismiss(verifyToastId);
      }

      if (verifyResult?.blocked) {
        const mismatchLines = verifyResult.mismatches.map(m => (
          m.suggestion
            ? `• ${m.configInterface} — not found. Did you mean ${m.suggestion}?`
            : `• ${m.configInterface} — ${m.reason}`
        )).join('\n');
        const deviceInterfaceList = (verifyResult.deviceInterfaces || []).join(', ') || 'none detected';

        const proceedAnyway = await showConfirmation({
          title: 'Interface Mismatch Detected',
          message: `This configuration references interface(s) that don't exist on the device:\n\n${mismatchLines}\n\nInterfaces actually on this device:\n${deviceInterfaceList}\n\nDeploying anyway may fail or silently do nothing for these lines.`,
          confirmText: 'Deploy Anyway',
          cancelText: 'Cancel',
          type: 'danger'
        });

        if (!proceedAnyway) return;
      }
    }

    let statusNotes = '';
    if (isNetconf && validateBeforeApply) statusNotes += '\n\n✓ Validation will run before applying.';

    const confirmed = await showConfirmation({
      title: `Deploy Configuration via ${modeLabel}`,
      message: `Are you sure you want to apply this configuration to the device using ${modeLabel}?\n\nThis action will modify the device configuration.${statusNotes}`,
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

      // Debug: Log the configuration ID being sent
      console.log('📤 Applying configuration:', {
        id: generatedConfig.id,
        _id: generatedConfig._id,
        config_type: generatedConfig.config_type
      });

      const configId = generatedConfig.id || generatedConfig._id;
      if (!configId) {
        throw new Error('Configuration ID is missing - please regenerate the configuration');
      }

      const requestPayload = {
        configuration_id: String(configId), // Ensure it's a string
        validate_before_apply: isNetconf ? validateBeforeApply : false,
        mock_deploy: false
      };
      
      console.log('📦 Request payload:', requestPayload);

      const response = await axios.post(endpoint, requestPayload);

      console.log('✅ Configuration applied successfully!');
      
      // Check if it was a mock deployment
      const isMock = response.data?.mock === true;
      
      // Extract deployment time from response
      const deploymentTime = response.data?.deployment_time || 
                            response.data?.deployment_time_ms || 
                            null;
      
      const deploymentTimeSeconds = response.data?.deployment_time_seconds || 
                            (response.data?.deployment_time_ms ? 
                            (response.data.deployment_time_ms / 1000).toFixed(2) : null);
      
      setGeneratedConfig({
        ...generatedConfig,
        status: 'deployed',
        deployment_time: deploymentTime,
        mock_deployment: isMock
      });
      
      const successMessage = deploymentTimeSeconds 
        ? `Configuration deployed successfully in ${deploymentTimeSeconds}s!` 
        : `Configuration deployed successfully!`;
      
      toast.success(successMessage, { id: toastId, duration: 5000 });
    } catch (error) {
      console.error('Error applying configuration:', error);
      console.error('🔴 Server response:', error.response?.data);
      
      // Get the actual error details
      const responseData = error.response?.data;
      const userFriendlyMsg = responseData?.message || 'Deployment failed';
      const actualError = responseData?.error || error.message;
      const errorType = responseData?.errorType;
      
      // Show both the user-friendly message and actual error
      let errorMsg = userFriendlyMsg;
      if (actualError && actualError !== userFriendlyMsg) {
        errorMsg += `\n\nDetails: ${actualError}`;
      }
      
      console.error('🔴 Error type:', errorType);
      console.error('🔴 Actual error:', actualError);
      
      toast.error(errorMsg, { id: toastId, duration: 10000 });
    } finally {
      setIsApplying(false);
    }
  };

  const resetForm = () => {
    setSelectedDevice('');
    setSelectedDevices([]);
    setMultiDeviceResults([]);
    setActiveResultTab(0);
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
    "Enable IP routing and configure default gateway 192.168.1.254",
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <div className="p-1.5 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
              <BrainCircuitIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            LLM Configuration Generator
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Generate Cisco device configurations using LLM via OpenRouter
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ZoomControls />
          {/* Config Mode Toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
            <button
              onClick={() => { setConfigMode('cli'); setSelectedYangModelsForGen([]); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                configMode === 'cli' 
                  ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-blue-100 dark:ring-blue-800' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <CodeIcon className="h-4 w-4" />
              CLI
            </button>
            <button
              onClick={() => { setConfigMode('netconf'); setSelectedYangModelsForGen([]); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                configMode === 'netconf' 
                  ? 'bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-400 shadow-sm ring-1 ring-purple-100 dark:ring-purple-800' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
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
        <div className="flex items-center space-x-1 border-b border-gray-200 dark:border-gray-700 pb-0">
          <button
            onClick={() => setNetconfSubTab('generate')}
            className={`tab ${netconfSubTab === 'generate' ? 'tab-active' : 'tab-inactive'}`}
          >
            <SendIcon className="h-4 w-4" />
            Generate Config
          </button>
          <button
            onClick={() => { setNetconfSubTab('sessions'); fetchNetconfSessions(); }}
            className={`tab ${netconfSubTab === 'sessions' ? 'tab-active' : 'tab-inactive'}`}
          >
            <ActivityIcon className="h-4 w-4" />
            Active Sessions
            {netconfSessions.length > 0 && (
              <span className="ml-1.5 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full font-semibold">
                {netconfSessions.length}
              </span>
            )}
          </button>
          <button
            onClick={() => { setNetconfSubTab('yang-models'); fetchYangModels(); }}
            className={`tab ${netconfSubTab === 'yang-models' ? 'tab-active' : 'tab-inactive'}`}
          >
            <FileTextIcon className="h-4 w-4" />
            YANG Models
            {yangModels.length > 0 && (
              <span className="ml-1.5 px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-full font-semibold">
                {yangModels.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setNetconfSubTab('operations')}
            className={`tab ${netconfSubTab === 'operations' ? 'tab-active' : 'tab-inactive'}`}
          >
            <TerminalIcon className="h-4 w-4" />
            Operations
          </button>
        </div>
      )}

      {/* CLI Mode or NETCONF Generate Tab */}
      {(configMode === 'cli' || (configMode === 'netconf' && netconfSubTab === 'generate')) && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Generation Form */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Generate {configMode === 'netconf' ? 'NETCONF/YANG' : 'CLI'} Configuration
            </h2>
          </div>

          <div className="card-body">
            <form 
              onSubmit={handleGenerateConfiguration}
              className={formStyles.formGap}
            >
              <div>
                <label className={`block ${formStyles.labelSize} font-medium text-gray-700 mb-1`}>
                  {configMode === 'cli' ? 'Select Device(s)' : 'Select Device'}
                </label>
                <div className="relative" ref={deviceDropdownRef}>
                  {/* CLI Mode: Multi-select dropdown */}
                  {configMode === 'cli' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowDeviceDropdown(!showDeviceDropdown)}
                        className="input w-full text-left flex items-center justify-between"
                      >
                        {selectedDevices.length > 0 ? (
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="inline-flex items-center justify-center h-5 min-w-[1.25rem] px-1.5 text-xs font-bold bg-blue-600 text-white rounded-full">
                              {selectedDevices.length}
                            </span>
                            <span className="truncate">
                              {selectedDevices.length === 1
                                ? devices.find(d => (d.id || d._id) === selectedDevices[0])?.name || 'Selected'
                                : `${selectedDevices.length} devices selected`}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-500 dark:text-gray-400">Choose device(s)...</span>
                        )}
                        <ChevronDownIcon className={`h-5 w-5 text-gray-400 transition-transform flex-shrink-0 ${showDeviceDropdown ? 'rotate-180' : ''}`} />
                      </button>

                      {showDeviceDropdown && (
                        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                          {/* Select All / Clear All */}
                          <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 z-10">
                            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 dark:text-gray-400">
                              <input
                                type="checkbox"
                                checked={selectedDevices.length === devices.length && devices.length > 0}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedDevices(devices.map(d => d.id || d._id));
                                  } else {
                                    setSelectedDevices([]);
                                  }
                                }}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              Select All
                            </label>
                            {selectedDevices.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setSelectedDevices([])}
                                className="text-xs text-gray-500 hover:text-red-500 transition-colors"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                          {devices.map((device) => (
                            <label
                              key={device.id || device._id}
                              className={`px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer flex items-center gap-3 transition-colors ${
                                selectedDevices.includes(device.id || device._id) ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={selectedDevices.includes(device.id || device._id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedDevices([...selectedDevices, device.id || device._id]);
                                  } else {
                                    setSelectedDevices(selectedDevices.filter(id => id !== (device.id || device._id)));
                                  }
                                }}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <div className={`p-1.5 rounded-lg ${
                                device.status === 'active' ? 'bg-green-100 dark:bg-green-900/50' :
                                device.status === 'inactive' ? 'bg-red-100 dark:bg-red-900/50' : 'bg-amber-100 dark:bg-amber-900/50'
                              }`}>
                                <DeviceIcon 
                                  deviceType={device.type} 
                                  layer={device.layer}
                                  className={`h-5 w-5 ${
                                    device.status === 'active' ? 'text-green-600 dark:text-green-400' :
                                    device.status === 'inactive' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
                                  }`}
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-gray-900 dark:text-white truncate">{device.name}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                  {device.type}{device.layer ? ` (${device.layer === 'layer-2' ? 'L2' : 'L3'})` : ''} • {device.ip_address}
                                </div>
                              </div>
                              {device.status === 'active' && (
                                <span className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></span>
                              )}
                            </label>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    /* NETCONF Mode: Single-select dropdown (unchanged) */
                    <>
                      <button
                        type="button"
                        onClick={() => setShowDeviceDropdown(!showDeviceDropdown)}
                        className="input w-full text-left flex items-center justify-between"
                      >
                        {selectedDevice ? (
                          <div className="flex items-center gap-3">
                            <DeviceIcon 
                              deviceType={devices.find(d => (d.id || d._id) === selectedDevice)?.type} 
                              layer={devices.find(d => (d.id || d._id) === selectedDevice)?.layer}
                              className="h-5 w-5 text-gray-600 dark:text-gray-400"
                            />
                            <span>
                              {devices.find(d => (d.id || d._id) === selectedDevice)?.name} 
                              <span className="text-gray-500 dark:text-gray-400 ml-1">
                                ({devices.find(d => (d.id || d._id) === selectedDevice)?.type})
                              </span>
                              <span className="text-gray-400 ml-1">
                                - {devices.find(d => (d.id || d._id) === selectedDevice)?.ip_address}
                              </span>
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-500 dark:text-gray-400">Choose a device...</span>
                        )}
                        <ChevronDownIcon className={`h-5 w-5 text-gray-400 transition-transform ${showDeviceDropdown ? 'rotate-180' : ''}`} />
                      </button>
                      
                      {showDeviceDropdown && (
                        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                          <div 
                            className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700"
                            onClick={() => {
                              setSelectedDevice('');
                              setShowDeviceDropdown(false);
                            }}
                          >
                            Choose a device...
                          </div>
                          {devices.map((device) => (
                            <div
                              key={device.id || device._id}
                              className={`px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer flex items-center gap-3 transition-colors ${
                                selectedDevice === device.id ? 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500' : ''
                              }`}
                              onClick={() => {
                                setSelectedDevice(device.id || device._id);
                                setSelectedYangModelsForGen([]); // Clear YANG selections when device changes
                                setShowDeviceDropdown(false);
                              }}
                            >
                              <div className={`p-1.5 rounded-lg ${
                                device.status === 'active' ? 'bg-green-100 dark:bg-green-900/50' :
                                device.status === 'inactive' ? 'bg-red-100 dark:bg-red-900/50' : 'bg-amber-100 dark:bg-amber-900/50'
                              }`}>
                                <DeviceIcon 
                                  deviceType={device.type} 
                                  layer={device.layer}
                                  className={`h-5 w-5 ${
                                    device.status === 'active' ? 'text-green-600 dark:text-green-400' :
                                    device.status === 'inactive' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
                                  }`}
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-gray-900 dark:text-white truncate">{device.name}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                  {device.type}{device.layer ? ` (${device.layer === 'layer-2' ? 'L2' : 'L3'})` : ''} • {device.ip_address}
                                </div>
                              </div>
                              {device.status === 'active' && (
                                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
                {/* Hidden input for form validation */}
                <input type="hidden" value={configMode === 'cli' ? (selectedDevices.length > 0 ? 'ok' : '') : selectedDevice} required />
              </div>

              {/* YANG Model Selector (NETCONF mode only) */}
              {configMode === 'netconf' && yangModels.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    YANG Models for Generation
                    <span className="text-xs font-normal text-gray-500 ml-2">(optional - for accurate XML)</span>
                  </label>
                  <div className="border rounded-lg dark:border-gray-600 max-h-32 overflow-y-auto">
                    {yangModels.map((model) => (
                      <label 
                        key={model.id} 
                        className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b last:border-b-0 dark:border-gray-600"
                      >
                        <input
                          type="checkbox"
                          checked={selectedYangModelsForGen.includes(model.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedYangModelsForGen([...selectedYangModelsForGen, model.id]);
                            } else {
                              setSelectedYangModelsForGen(selectedYangModelsForGen.filter(id => id !== model.id));
                            }
                          }}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{model.name}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                              model.device_type === 'nexus' ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300' :
                              model.device_type === 'ios-xe' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' :
                              model.device_type === 'ios-xr' ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300' :
                              'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                            }`}>
                              {model.device_type?.toUpperCase() || 'ALL'}
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${getCategoryColor(model.category)}`}>
                              {model.category}
                            </span>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                  {selectedYangModelsForGen.length > 0 && (
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-purple-600 dark:text-purple-400">
                        {selectedYangModelsForGen.length} model(s) selected
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedYangModelsForGen([])}
                        className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                      >
                        Clear all
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Configuration Prompt
                  </label>
                  {/* Translate Button */}
                  <button
                    type="button"
                    onClick={handleTranslatePrompt}
                    disabled={!prompt.trim() || isTranslating}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                      !prompt.trim() || isTranslating
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 shadow-sm hover:shadow'
                    }`}
                    title={promptLanguage === 'en' ? 'Translate to Thai' : 'Translate to English'}
                  >
                    {isTranslating ? (
                      <>
                        <div className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full"></div>
                        Translating...
                      </>
                    ) : (
                      <>
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                        </svg>
                        {promptLanguage === 'en' ? '🇺🇸 → 🇹🇭' : '🇹🇭 → 🇺🇸'}
                      </>
                    )}
                  </button>
                </div>
                <div className="relative">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={promptLanguage === 'th' 
                      ? "ใส่คำสั่งเครือข่าย เช่น 'ตั้งค่า interface fe0/1 ด้วย IP 192.168.1.1/24'"
                      : "Enter Cisco commands. Example: 'interface fe0/1 ip 192.168.1.1/24'"
                    }
                    className="input pr-12"
                    rows="3"
                    required
                    minLength="10"
                  />
                  {prompt && (
                    <span className="absolute bottom-2 right-2 text-xs text-gray-400">
                      {promptLanguage === 'en' ? '🇺🇸' : '🇹🇭'}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={isGenerating || (configMode === 'cli' ? selectedDevices.length === 0 : !selectedDevice) || !prompt || prompt.length < 10}
                className="btn btn-primary btn-md w-full"
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {configMode === 'cli' && selectedDevices.length > 1 ? `Generating for ${selectedDevices.length} devices...` : 'Generating...'}
                  </>
                ) : (
                  <>
                    <SendIcon className="h-4 w-4 mr-2" />
                    {configMode === 'cli' && selectedDevices.length > 1 
                      ? `Generate for ${selectedDevices.length} Devices` 
                      : 'Generate Configuration'}
                  </>
                )}
              </button>
            </form>

            {/* Example Prompts */}
            <div className="mt-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Example Prompts:</h3>
              <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar pr-2">
                {examplePrompts.map((example, index) => (
                  <button
                    key={index}
                    onClick={() => setPrompt(example)}
                    className={`text-left text-xs block w-full px-2 py-1.5 rounded-lg transition-colors ${
                      configMode === 'netconf' 
                        ? 'text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/30' 
                        : 'text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30'
                    }`}
                  >
                    • {example}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Configuration Preview */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-medium text-gray-900 dark:text-white">Configuration Preview</h2>
            {generatedConfig && generatedConfig.status === 'generated' && (
              <div className="flex items-center space-x-4">
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
          {!generatedConfig && multiDeviceResults.length === 0 && (
            <div className="text-center py-8">
              <BrainCircuitIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No configuration generated yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Select a device and enter a prompt to get started
              </p>
            </div>
          )}

          {/* Multi-Device Results Tabs */}
          {multiDeviceResults.length > 1 && (
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-2">
                <ServerIcon className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {multiDeviceResults.filter(r => r.success).length}/{multiDeviceResults.length} devices generated
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {multiDeviceResults.map((result, index) => (
                  <button
                    key={result.device_id}
                    onClick={() => {
                      setActiveResultTab(index);
                      if (result.success && result.configuration) {
                        setGeneratedConfig(result.configuration);
                        setValidation(result.configuration.validation);
                        setEditedConfig(result.configuration.generated_config);
                        setIsEditing(false);
                      } else {
                        setGeneratedConfig(null);
                        setValidation(null);
                      }
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                      activeResultTab === index
                        ? 'bg-blue-600 text-white shadow-sm'
                        : result.success
                          ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200'
                    }`}
                  >
                    {result.device_name}
                    {result.success ? (
                      <CheckCircleIcon className="h-3 w-3 ml-1 inline" />
                    ) : (
                      <XCircleIcon className="h-3 w-3 ml-1 inline" />
                    )}
                  </button>
                ))}
              </div>
              {/* Show error message for failed device */}
              {multiDeviceResults[activeResultTab] && !multiDeviceResults[activeResultTab].success && (
                <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <p className="text-sm text-red-700 dark:text-red-400">
                    <XCircleIcon className="h-4 w-4 inline mr-1" />
                    Failed: {multiDeviceResults[activeResultTab].error || 'Unknown error'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Single Device Configuration Display */}
          {generatedConfig && (
            <div className="space-y-4">
              {/* Device Info */}
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
                  <div className="flex items-center">
                    <ServerIcon className="h-4 w-4 mr-2" />
                    <span>
                      {generatedConfig.device_name} ({generatedConfig.device_type})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`badge ${
                      generatedConfig.status === 'deployed' ? 'badge-success' : 
                      generatedConfig.status === 'failed' ? 'badge-danger' : 'badge-info'
                    }`}>
                      {generatedConfig.status}
                    </span>
                  </div>
                </div>
                
                {/* Model Info */}
                <div className="mt-2 flex items-center flex-wrap text-xs text-gray-500 dark:text-gray-400">
                  <BrainCircuitIcon className="h-3 w-3 mr-1" />
                  <span>Generated with: <span className="font-mono font-medium">{generatedConfig.ai_model}</span></span>
                {generatedConfig.execution_time && (
                  <span className="ml-3 text-green-600 dark:text-green-400 font-medium">• Generation: {(generatedConfig.execution_time / 1000).toFixed(2)}s</span>
                )}
                {generatedConfig.deployment_time && (
                  <span className="ml-3 font-medium text-green-600 dark:text-green-400">
                    • Deploy: {(generatedConfig.deployment_time / 1000).toFixed(2)}s
                  </span>
                )}
                </div>
              </div>

              {/* Configuration Valid Tab with Explanation */}
              {validation && (
                <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4 border border-blue-100 dark:border-blue-800">
                  <div className="flex items-start">
                    {getValidationIcon(validation.isValid)}
                    <div className="ml-3 flex-1">
                      <p className={`text-sm font-medium ${getValidationColor(validation.isValid)} mb-2`}>
                        {validation.isValid ? 'Configuration Valid' : 'Configuration Issues Found'}
                      </p>
                      {generatedConfig.explanation && (
                        <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
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
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Configuration</h3>
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
                      {displayConfig}
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
                
                <div className="text-xs text-gray-500 dark:text-gray-400">
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Available Devices for NETCONF Connection */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <ServerIcon className="h-6 w-6 text-blue-600 dark:text-blue-400 mr-2" />
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Available Devices</h2>
              </div>
              <button
                onClick={fetchDevices}
                disabled={devicesLoading}
                className="btn btn-secondary btn-sm"
              >
                <RefreshCwIcon className={`h-4 w-4 mr-1 ${devicesLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
            
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Connect to NETCONF-enabled devices (Nexus/IOS-XE). Port 830 must be accessible.
            </p>

            {devicesLoading ? (
              <div className="text-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : devices.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <ServerIcon className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                <p>No devices found</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {devices.map((device) => {
                  const deviceId = device.id || device._id;
                  const isConnected = netconfSessions.some(s => s.deviceId === deviceId);
                  const isConnecting = connectingDeviceId === deviceId;
                  const supportsNetconf = device.type === 'nexus' || device.netconf_enabled;
                  return (
                    <div 
                      key={deviceId}
                      className={`flex items-center justify-between p-3 border rounded-lg ${
                        isConnected 
                          ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20' 
                          : 'border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          device.type === 'nexus' ? 'bg-purple-100 dark:bg-purple-900/50' :
                          device.type === 'router' ? 'bg-blue-100 dark:bg-blue-900/50' :
                          'bg-green-100 dark:bg-green-900/50'
                        }`}>
                          <DeviceIcon deviceType={device.type} layer={device.layer} className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white text-sm flex items-center gap-2">
                            {device.name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {device.ip_address} • {device.type.toUpperCase()}
                            {supportsNetconf && <span className="ml-1 text-purple-600">• NETCONF</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isConnected ? (
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded-full">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1 animate-pulse"></span>
                            Connected
                          </span>
                        ) : (
                          <button
                            onClick={() => handleConnectNetconf(device)}
                            disabled={isConnecting || !supportsNetconf}
                            className={`btn btn-sm ${supportsNetconf ? 'btn-primary' : 'btn-secondary opacity-50 cursor-not-allowed'}`}
                            title={supportsNetconf ? 'Connect via NETCONF' : 'NETCONF not enabled for this device'}
                          >
                            {isConnecting ? (
                              <>
                                <RefreshCwIcon className="h-3 w-3 mr-1 animate-spin" />
                                Connecting...
                              </>
                            ) : (
                              <>
                                <WifiIcon className="h-3 w-3 mr-1" />
                                Connect
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active NETCONF Sessions */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <ActivityIcon className="h-6 w-6 text-green-600 dark:text-green-400 mr-2" />
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Active Sessions</h2>
                <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded-full font-semibold">
                  {netconfSessions.length}
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

            {netconfSessionsLoading ? (
              <div className="text-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mx-auto"></div>
              </div>
            ) : netconfSessions.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <WifiIcon className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                <p className="text-lg font-medium">No active sessions</p>
                <p className="text-sm mt-1">Select a device and click Connect</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {netconfSessions.map((session) => {
                  const getDeviceBgColor = () => {
                    if (session.mock) {
                      return 'bg-orange-100 dark:bg-orange-900/50';
                    }
                    switch(session.device_type) {
                      case 'nexus':
                        return 'bg-purple-100 dark:bg-purple-900/50';
                      case 'router':
                        return 'bg-blue-100 dark:bg-blue-900/50';
                      default:
                        return 'bg-green-100 dark:bg-green-900/50';
                    }
                  };
                  
                  // Get capabilities count
                  const capCount = session.capabilityList?.length || session.capabilities || 0;
                  const capList = session.capabilityList || [];
                  
                  return (
                  <div 
                    key={session.deviceId} 
                    className="border rounded-lg overflow-hidden border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/30"
                  >
                    <div 
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/50"
                      onClick={() => setExpandedSession(expandedSession === session.deviceId ? null : session.deviceId)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`relative p-2 rounded-lg ${getDeviceBgColor()}`}>
                          <DeviceIcon deviceType={session.device_type} layer={session.device_layer} className="h-5 w-5" />
                          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full animate-pulse bg-green-500"></span>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                            {session.device_name || 'Unknown Device'}
                            <span className="px-1.5 py-0.5 text-xs font-bold bg-green-500 text-white rounded">
                              CONNECTED
                            </span>
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {session.device_ip || session.deviceId} • Port 830
                          </div>
                          {capCount > 0 && (
                            <div className="text-xs flex items-center gap-1 mt-0.5 text-green-600 dark:text-green-400">
                              <span>{capCount} capabilities</span>
                              {expandedSession === session.deviceId ? (
                                <ChevronUpIcon className="h-3 w-3" />
                              ) : (
                                <ChevronDownIcon className="h-3 w-3" />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDisconnectNetconfSession(session.deviceId, session.device_name); }}
                        className="btn btn-danger btn-sm"
                        title="Disconnect Session"
                      >
                        <XCircleIcon className="h-4 w-4 mr-1" />
                        Disconnect
                      </button>
                    </div>
                    
                    {/* Expanded Capabilities List */}
                    {expandedSession === session.deviceId && capCount > 0 && (
                      <div className="border-t bg-white dark:bg-gray-800 p-4 border-green-200 dark:border-green-700">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                          <span>Device Capabilities ({capCount})</span>
                          <span className="text-xs text-gray-400 font-normal">• Click to collapse</span>
                        </h4>
                        {capList.length > 0 ? (
                          <div className="max-h-64 overflow-y-auto space-y-1.5">
                            {capList.map((cap, idx) => {
                              // Extract module name and revision from capability URL
                              const moduleMatch = cap.match(/module=([^&]+)/);
                              const revisionMatch = cap.match(/revision=([^&]+)/);
                              const moduleName = moduleMatch ? moduleMatch[1] : null;
                              const revision = revisionMatch ? revisionMatch[1] : null;
                              
                              // Categorize capabilities
                              const isBase = cap.includes('netconf:base') || cap.includes('netconf:capability');
                              const isYang = moduleName !== null;
                              const isOpenConfig = cap.includes('openconfig.net');
                              const isCisco = cap.includes('cisco.com') || cap.includes('Cisco');
                              
                              let categoryColor = 'bg-gray-100 dark:bg-gray-700';
                              let categoryLabel = '';
                              if (isBase) {
                                categoryColor = 'bg-blue-50 dark:bg-blue-900/30 border-l-2 border-blue-400';
                                categoryLabel = 'NETCONF';
                              } else if (isOpenConfig) {
                                categoryColor = 'bg-purple-50 dark:bg-purple-900/30 border-l-2 border-purple-400';
                                categoryLabel = 'OpenConfig';
                              } else if (isCisco) {
                                categoryColor = 'bg-green-50 dark:bg-green-900/30 border-l-2 border-green-400';
                                categoryLabel = 'Cisco';
                              }
                              
                              return (
                                <div 
                                  key={idx} 
                                  className={`text-xs font-mono rounded p-2 ${categoryColor}`}
                                >
                                  {moduleName ? (
                                    <div className="flex flex-col">
                                      <div className="flex items-center gap-2">
                                        {categoryLabel && (
                                          <span className={`text-xs px-1 py-0.5 rounded font-sans font-medium ${
                                            isBase ? 'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200' :
                                            isOpenConfig ? 'bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200' :
                                            'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200'
                                          }`}>{categoryLabel}</span>
                                        )}
                                        <span className="font-semibold text-gray-800 dark:text-gray-200">{moduleName}</span>
                                        {revision && <span className="text-gray-500">@{revision}</span>}
                                      </div>
                                      <div className="text-gray-400 text-xs truncate mt-1">{cap}</div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      {isBase && (
                                        <span className="text-xs px-1 py-0.5 rounded font-sans font-medium bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200">NETCONF</span>
                                      )}
                                      <span className="text-gray-600 dark:text-gray-400 break-all">{cap}</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500">Capability details not available. Try reconnecting.</p>
                        )}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* YANG Models Tab - Only visible in NETCONF mode when yang-models tab is selected */}
      {configMode === 'netconf' && netconfSubTab === 'yang-models' && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <FileTextIcon className="h-6 w-6 text-purple-600 dark:text-purple-400 mr-2" />
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">YANG Models</h2>
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                ({yangModels.length} models)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchYangModels}
                disabled={yangModelsLoading}
                className="btn btn-secondary btn-sm"
              >
                <RefreshCwIcon className={`h-4 w-4 mr-1 ${yangModelsLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={() => setShowCustomYangModal(true)}
                className="btn btn-secondary btn-sm"
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                Create Custom
              </button>
              <button
                onClick={() => setShowYangUploadModal(true)}
                className="btn btn-primary btn-sm"
              >
                <UploadIcon className="h-4 w-4 mr-1" />
                Upload File
              </button>
            </div>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Upload YANG files or create custom models to improve XML configuration generation.
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
              {filteredYangModels.map((model) => {
                // Device type badge color
                const getDeviceTypeBadge = (type) => {
                  switch(type) {
                    case 'nexus': return 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300';
                    case 'ios-xe': return 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300';
                    case 'ios-xr': return 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300';
                    case 'ios': return 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300';
                    case 'all': return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
                    default: return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
                  }
                };
                
                return (
                <div 
                  key={model.id} 
                  className="border border-purple-200 dark:border-purple-800 rounded-lg overflow-hidden"
                >
                  <div 
                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                    onClick={() => setExpandedYangModel(expandedYangModel === model.id ? null : model.id)}
                  >
                    <div className="flex items-center gap-3">
                      <FileTextIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{model.name}</span>
                          {model.is_custom && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 font-medium">
                              Custom
                            </span>
                          )}
                          <span className={`text-xs px-1.5 py-0.5 rounded ${getCategoryColor(model.category)}`}>
                            {model.category}
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${getDeviceTypeBadge(model.device_type)}`}>
                            {model.device_type?.toUpperCase() || 'ALL'}
                          </span>
                        </div>
                        {model.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-md">{model.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleViewYangModel(model.id); }}
                        className="p-1 rounded text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                        title="View Details"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleYangModelDelete(model.id); }}
                        className="p-1 rounded text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
                        title="Delete YANG Model"
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
                    <div className="border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 space-y-4">
                      {/* Header */}
                      <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Model Details</h4>
                      
                      {/* Metadata Grid */}
                      <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                          <div>
                            <span className="text-gray-500 dark:text-gray-400 block">Device Type</span>
                            <span className={`inline-block mt-0.5 px-2 py-0.5 rounded font-medium ${getDeviceTypeBadge(model.device_type)}`}>
                              {model.device_type?.toUpperCase() || 'ALL'}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400 block">Category</span>
                            <span className={`inline-block mt-0.5 px-2 py-0.5 rounded ${getCategoryColor(model.category)}`}>
                              {model.category}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400 block">Version</span>
                            <span className="font-medium text-gray-700 dark:text-gray-300">{model.version || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400 block">Prefix</span>
                            <span className="font-mono font-medium text-purple-600 dark:text-purple-400">{model.prefix || 'N/A'}</span>
                          </div>
                        </div>
                        
                        {model.namespace && (
                          <div className="mt-3 pt-3 border-t dark:border-gray-700">
                            <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Namespace URI</span>
                            <div className="font-mono text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 rounded p-2 break-all border dark:border-gray-600">
                              {model.namespace}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Description */}
                      {model.description && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-3">
                          <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Description</span>
                          <p className="text-sm text-gray-700 dark:text-gray-300">{model.description}</p>
                        </div>
                      )}
                      
                      {/* XML Templates */}
                      {model.xml_templates?.length > 0 && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-3">
                          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">XML Templates ({model.xml_templates.length})</p>
                          <div className="space-y-1">
                            {model.xml_templates.map((tmpl, idx) => (
                              <div key={idx} className="text-xs bg-gray-50 dark:bg-gray-700 rounded p-2 border dark:border-gray-600">
                                <span className="font-medium text-purple-600 dark:text-purple-400">{tmpl.name}</span>
                                {tmpl.description && <span className="text-gray-500 dark:text-gray-400 ml-2">— {tmpl.description}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Config Paths */}
                      {model.config_paths?.length > 0 && (
                        <div className="bg-white rounded-lg border p-3">
                          <p className="text-xs font-medium text-gray-700 mb-2">Config Paths ({model.config_paths.length})</p>
                          <div className="space-y-1">
                            {model.config_paths.map((path, idx) => (
                              <div key={idx} className="text-xs bg-gray-50 rounded p-1.5 border font-mono text-purple-600">
                                {path.path}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Model ID */}
                      <div className="text-xs text-gray-400 pt-2 border-t">
                        <span>ID: {model.id}</span>
                      </div>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* NETCONF Operations Tab */}
      {configMode === 'netconf' && netconfSubTab === 'operations' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Operations Form */}
          <div className="card p-6">
            <div className="flex items-center mb-4">
              <TerminalIcon className="h-6 w-6 text-blue-600 mr-2" />
              <h2 className="text-lg font-medium text-gray-900">NETCONF Operations</h2>
            </div>

            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Monitor Mode:</strong> Execute NETCONF operations to query device state and configuration.
                Use &lt;get&gt; for operational data and &lt;get-config&gt; for configuration data.
              </p>
            </div>

            <div className="space-y-4">
              {/* Device Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Device
                </label>
                <select
                  value={operationDevice}
                  onChange={(e) => setOperationDevice(e.target.value)}
                  className="input"
                >
                  <option value="">Choose a device...</option>
                  {devices.filter(d => d.netconf_enabled || d.type === 'nexus').map((device) => (
                    <option key={device.id || device._id} value={device.id}>
                      {device.name} ({device.type}) - {device.ip_address}
                    </option>
                  ))}
                </select>
              </div>

              {/* Operation Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Operation Type
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOperationType('get')}
                    className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                      operationType === 'get'
                        ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300'
                        : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <SearchIcon className="h-4 w-4 inline mr-1" />
                    &lt;get&gt;
                  </button>
                  <button
                    type="button"
                    onClick={() => setOperationType('get-config')}
                    className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                      operationType === 'get-config'
                        ? 'bg-green-50 dark:bg-green-900/30 border-green-500 text-green-700 dark:text-green-300'
                        : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <CodeIcon className="h-4 w-4 inline mr-1" />
                    &lt;get-config&gt;
                  </button>
                  <button
                    type="button"
                    onClick={() => setOperationType('custom')}
                    className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                      operationType === 'custom'
                        ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-500 text-purple-700 dark:text-purple-300'
                        : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <TerminalIcon className="h-4 w-4 inline mr-1" />
                    Custom RPC
                  </button>
                </div>
              </div>

              {/* Filter (for get/get-config) */}
              {operationType !== 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    XML Filter <span className="text-amber-600 dark:text-amber-400 font-normal">(recommended to avoid timeout)</span>
                  </label>
                  <textarea
                    value={operationFilter}
                    onChange={(e) => setOperationFilter(e.target.value)}
                    placeholder={`Use a filter to avoid timeout. Use Quick Filters below or enter your own.`}
                    className="input font-mono text-sm"
                    rows="5"
                  />
                </div>
              )}

              {/* Custom RPC Content */}
              {operationType === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    RPC Content (without &lt;rpc&gt; wrapper)
                  </label>
                  <textarea
                    value={customRpc}
                    onChange={(e) => setCustomRpc(e.target.value)}
                    placeholder={`Example:\n<get>\n  <filter type="subtree">\n    <System xmlns="http://cisco.com/ns/yang/cisco-nx-os-device"/>\n  </filter>\n</get>`}
                    className="input font-mono text-sm"
                    rows="6"
                  />
                </div>
              )}

              {/* Execute Button */}
              <button
                onClick={async () => {
                  if (!operationDevice) {
                    toast.error('Please select a device');
                    return;
                  }
                  
                  setIsExecutingOperation(true);
                  setOperationResult(null);
                  const toastId = toast.loading('Executing NETCONF operation...');
                  
                  try {
                    let endpoint = '';
                    let payload = {};
                    
                    if (operationType === 'get') {
                      endpoint = `/devices/${operationDevice}/netconf/get`;
                      payload = { filter: operationFilter || undefined };
                    } else if (operationType === 'get-config') {
                      endpoint = `/devices/${operationDevice}/netconf/get-config`;
                      payload = { source: 'running', filter: operationFilter || undefined };
                    } else {
                      endpoint = `/devices/${operationDevice}/netconf/rpc`;
                      payload = { rpc_content: customRpc };
                    }
                    
                    const response = await axios.post(endpoint, payload);
                    
                    setOperationResult({
                      success: true,
                      device_name: response.data.device_name,
                      operation: operationType,
                      execution_time: response.data.execution_time_ms,
                      response: response.data.response
                    });
                    
                    toast.success(`Operation completed in ${response.data.execution_time_ms}ms`, { id: toastId });
                  } catch (error) {
                    setOperationResult({
                      success: false,
                      error: error.response?.data?.message || error.message
                    });
                    toast.error(error.response?.data?.message || 'Operation failed', { id: toastId });
                  } finally {
                    setIsExecutingOperation(false);
                  }
                }}
                disabled={isExecutingOperation || !operationDevice || (operationType === 'custom' && !customRpc)}
                className="btn btn-primary btn-md w-full"
              >
                {isExecutingOperation ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Executing...
                  </>
                ) : (
                  <>
                    <PlayIcon className="h-4 w-4 mr-2" />
                    Execute Operation
                  </>
                )}
              </button>
            </div>

            {/* Quick Filters - Dynamic based on selected device type */}
            <div className="mt-6">
              {(() => {
                const selectedDeviceData = devices.find(d => (d.id || d._id) === operationDevice);
                const isIosXe = selectedDeviceData?.type === 'router' || selectedDeviceData?.type === 'ios-xe';
                
                const nxosFilters = [
                  { name: 'Interfaces', filter: '<System xmlns="http://cisco.com/ns/yang/cisco-nx-os-device"><intf-items/></System>' },
                  { name: 'VLANs', filter: '<System xmlns="http://cisco.com/ns/yang/cisco-nx-os-device"><bd-items/></System>' },
                  { name: 'Routing', filter: '<System xmlns="http://cisco.com/ns/yang/cisco-nx-os-device"><ipv4-items/></System>' },
                  { name: 'System Info', filter: '<System xmlns="http://cisco.com/ns/yang/cisco-nx-os-device"><name/><serial/></System>' },
                  { name: 'OSPF', filter: '<System xmlns="http://cisco.com/ns/yang/cisco-nx-os-device"><ospf-items/></System>' },
                  { name: 'BGP', filter: '<System xmlns="http://cisco.com/ns/yang/cisco-nx-os-device"><bgp-items/></System>' },
                ];
                
                const iosXeFilters = [
                  { name: 'Interfaces', filter: '<interfaces xmlns="urn:ietf:params:xml:ns:yang:ietf-interfaces"/>', opType: 'get' },
                  { name: 'Native Config', filter: '<native xmlns="http://cisco.com/ns/yang/Cisco-IOS-XE-native"/>', opType: 'get-config' },
                  { name: 'Routing', filter: '<native xmlns="http://cisco.com/ns/yang/Cisco-IOS-XE-native"><ip/></native>', opType: 'get-config' },
                  { name: 'OSPF', filter: '<native xmlns="http://cisco.com/ns/yang/Cisco-IOS-XE-native"><router/></native>', opType: 'get-config' },
                  { name: 'BGP', filter: '<native xmlns="http://cisco.com/ns/yang/Cisco-IOS-XE-native"><router/></native>', opType: 'get-config' },
                  { name: 'Platform', filter: '<device-hardware-data xmlns="http://cisco.com/ns/yang/Cisco-IOS-XE-device-hardware-oper"/>', opType: 'get' },
                ];
                
                const filters = isIosXe ? iosXeFilters : nxosFilters;
                const platformLabel = isIosXe ? 'IOS-XE' : 'NX-OS';
                
                return (
                  <>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Quick Filters ({platformLabel}):</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {filters.map((item) => (
                        <button
                          key={item.name}
                          onClick={() => {
                            setOperationFilter(item.filter);
                            setOperationType(item.opType || 'get');
                          }}
                          className="text-left text-sm p-2 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300 transition-colors text-gray-700 dark:text-gray-300"
                        >
                          • {item.name}
                        </button>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Operation Result */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">Operation Result</h2>
              {operationResult && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(operationResult.response || '');
                    toast.success('Copied to clipboard');
                  }}
                  className="btn btn-secondary btn-sm"
                >
                  <CopyIcon className="h-4 w-4 mr-1" />
                  Copy
                </button>
              )}
            </div>

            {!operationResult && (
              <div className="text-center py-12">
                <TerminalIcon className="h-16 w-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">No operation executed yet</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                  Select a device and operation to get started
                </p>
              </div>
            )}

            {operationResult && !operationResult.success && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex items-center text-red-700 dark:text-red-400 mb-2">
                  <XCircleIcon className="h-5 w-5 mr-2" />
                  <span className="font-medium">Operation Failed</span>
                </div>
                <p className="text-sm text-red-600 dark:text-red-400">{operationResult.error}</p>
              </div>
            )}

            {operationResult && operationResult.success && (
              <div className="space-y-4">
                {/* Result Info */}
                <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded-lg">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center text-green-700 dark:text-green-400">
                      <CheckCircleIcon className="h-4 w-4 mr-2" />
                      <span className="font-medium">{operationResult.device_name}</span>
                      <span className="ml-2 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-medium rounded">
                        {operationResult.operation}
                      </span>
                    </div>
                    <span className="text-green-600 dark:text-green-400 text-xs">
                      {operationResult.execution_time}ms
                    </span>
                  </div>
                </div>

                {/* XML Response */}
                <div className="bg-gray-900 rounded-lg p-4 overflow-auto max-h-[500px]">
                  <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">
                    {operationResult.response}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* YANG Model Upload Modal */}
      {showYangUploadModal && createPortal(
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => { setShowYangUploadModal(false); resetYangForm(); }}
          ></div>
          
          {/* Modal Container */}
          <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto pointer-events-auto animate-fade-in">
            <div className="p-4 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <UploadIcon className="h-5 w-5 text-purple-600" />
                Upload YANG Model
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Upload a .yang file to auto-extract metadata</p>
            </div>
            
            <form onSubmit={handleYangModelSubmit} className="p-4 space-y-4">
              {/* Primary Upload Section */}
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-2 border-dashed border-purple-200 dark:border-purple-700 rounded-lg p-6 text-center">
                <label className="cursor-pointer block">
                  <input type="file" accept=".yang" onChange={handleYangFileUpload} className="hidden" />
                  <UploadIcon className="h-12 w-12 text-purple-500 dark:text-purple-400 mx-auto mb-3" />
                  <span className="text-lg font-medium text-gray-700 dark:text-gray-200 block">
                    {yangFormData.yang_content ? `✓ ${yangFormData.name}.yang loaded` : 'Click to upload .yang file'}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400 mt-1 block">
                    Metadata will be auto-extracted from the file
                  </span>
                </label>
              </div>

              {/* Auto-extracted Info (shown after upload) */}
              {yangFormData.yang_content && (
                <>
                  <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium text-sm mb-2">
                      <CheckCircleIcon className="h-4 w-4" />
                      Metadata Extracted
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Name:</span>
                        <span className="ml-2 font-mono text-gray-900 dark:text-gray-100">{yangFormData.name}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Prefix:</span>
                        <span className="ml-2 font-mono text-gray-900 dark:text-gray-100">{yangFormData.prefix || '-'}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-500 dark:text-gray-400">Namespace:</span>
                        <span className="ml-2 font-mono text-xs text-gray-900 dark:text-gray-100 break-all">{yangFormData.namespace || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Device Type:</span>
                        <span className="ml-2 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded text-xs font-medium">{yangFormData.device_type}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Category:</span>
                        <span className="ml-2 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded text-xs font-medium">{yangFormData.category}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Version:</span>
                        <span className="ml-2 font-mono text-gray-900 dark:text-gray-100">{yangFormData.version}</span>
                      </div>
                      {yangFormData.description && (
                        <div className="col-span-2">
                          <span className="text-gray-500 dark:text-gray-400">Description:</span>
                          <span className="ml-2 text-gray-900 dark:text-gray-100">{yangFormData.description}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Editable Fields (collapsed by default) */}
                  <details className="border dark:border-gray-700 rounded-lg">
                    <summary className="p-3 cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                      ✏️ Edit Metadata (optional)
                    </summary>
                    <div className="p-3 pt-0 space-y-3 border-t dark:border-gray-700">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Model Name</label>
                          <input
                            type="text"
                            value={yangFormData.name}
                            onChange={(e) => setYangFormData({ ...yangFormData, name: e.target.value })}
                            className="input text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Prefix</label>
                          <input
                            type="text"
                            value={yangFormData.prefix}
                            onChange={(e) => setYangFormData({ ...yangFormData, prefix: e.target.value })}
                            className="input text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Namespace URI</label>
                        <input
                          type="text"
                          value={yangFormData.namespace}
                          onChange={(e) => setYangFormData({ ...yangFormData, namespace: e.target.value })}
                          className="input font-mono text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Device Type</label>
                          <select
                            value={yangFormData.device_type}
                            onChange={(e) => setYangFormData({ ...yangFormData, device_type: e.target.value })}
                            className="input text-sm"
                          >
                            <option value="nexus">Nexus (NX-OS)</option>
                            <option value="ios">IOS</option>
                            <option value="ios-xe">IOS-XE</option>
                            <option value="ios-xr">IOS-XR</option>
                            <option value="all">All Devices</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Category</label>
                          <select
                            value={yangFormData.category}
                            onChange={(e) => setYangFormData({ ...yangFormData, category: e.target.value })}
                            className="input text-sm"
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
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Version</label>
                          <input
                            type="text"
                            value={yangFormData.version}
                            onChange={(e) => setYangFormData({ ...yangFormData, version: e.target.value })}
                            className="input text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description</label>
                        <input
                          type="text"
                          value={yangFormData.description}
                          onChange={(e) => setYangFormData({ ...yangFormData, description: e.target.value })}
                          className="input text-sm"
                        />
                      </div>
                    </div>
                  </details>

                  {/* View YANG Content (collapsed) */}
                  <details className="border dark:border-gray-700 rounded-lg">
                    <summary className="p-3 cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                      📄 View YANG Content
                    </summary>
                    <div className="p-3 pt-0 border-t dark:border-gray-700">
                      <pre className="bg-gray-900 text-green-400 text-xs p-3 rounded-lg overflow-auto max-h-48 font-mono">
                        {yangFormData.yang_content}
                      </pre>
                    </div>
                  </details>
                  
                  {/* XML Templates (collapsed) */}
                  <details className="border dark:border-gray-700 rounded-lg">
                    <summary className="p-3 cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                      📋 XML Templates (Optional - {yangFormData.xml_templates.length} added)
                    </summary>
                    <div className="p-3 pt-0 border-t dark:border-gray-700 space-y-2">
                      {yangFormData.xml_templates.length > 0 && (
                        <div className="space-y-1 mb-2">
                          {yangFormData.xml_templates.map((tmpl, idx) => (
                            <div key={idx} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 rounded p-2 text-xs">
                              <span className="font-medium flex-1 text-gray-900 dark:text-gray-100">{tmpl.name}</span>
                              <button type="button" onClick={() => removeYangTemplate(idx)} className="text-red-500 dark:text-red-400">
                                <TrashIcon className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
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
                          placeholder="Description"
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
                  </details>
                  
                  {/* Config Paths (collapsed) */}
                  <details className="border rounded-lg">
                    <summary className="p-3 cursor-pointer text-sm font-medium text-gray-700 hover:bg-gray-50">
                      📁 Config Paths (Optional - {yangFormData.config_paths.length} added)
                    </summary>
                    <div className="p-3 pt-0 border-t space-y-2">
                      {yangFormData.config_paths.length > 0 && (
                        <div className="space-y-1 mb-2">
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
                  </details>
                </>
              )}
              
              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => { setShowYangUploadModal(false); resetYangForm(); }}
                  className="btn btn-secondary btn-md"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary btn-md"
                  disabled={!yangFormData.yang_content}
                >
                  <UploadIcon className="h-4 w-4 mr-1" />
                  Upload Model
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Custom YANG Model Modal */}
      {showCustomYangModal && createPortal(
        <div className="modal-overlay fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-screen overflow-y-auto modal-scrollbar animate-fade-in">
            <form onSubmit={async (e) => {
              e.preventDefault();
              const toastId = toast.loading('Creating custom YANG model...');
              try {
                // Create minimal YANG content from custom data
                const customContent = `module ${yangFormData.name.replace(/[^a-zA-Z0-9_-]/g, '-')} {
  namespace "urn:custom:${yangFormData.name.replace(/[^a-zA-Z0-9_-]/g, '-')}";
  prefix "${yangFormData.prefix || yangFormData.name.substring(0, 4).toLowerCase()}";
  
  // Custom YANG Model
  // Description: ${yangFormData.description || 'User-defined configuration model'}
  // Device Type: ${yangFormData.device_type}
  // Category: ${yangFormData.category}
  
  revision "${new Date().toISOString().split('T')[0]}" {
    description "Custom model created by user";
  }
  
  /*
   * Configuration paths and templates defined by user
   * for LLM reference during configuration generation.
   */
}`;
                
                await axios.post('/yang-models', {
                  ...yangFormData,
                  yang_content: customContent,
                  is_custom: true
                });
                
                toast.success('Custom YANG model created!', { id: toastId });
                setShowCustomYangModal(false);
                resetYangForm();
                fetchYangModels();
              } catch (error) {
                toast.error(error.response?.data?.message || 'Failed to create custom model', { id: toastId });
              }
            }}>
              <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <PlusIcon className="h-5 w-5 text-amber-600" />
                  Create Custom YANG Model
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Create a simplified custom model to guide LLM configuration generation
                </p>
              </div>
              
              <div className="px-6 py-4 space-y-4">
              {/* Basic Info */}
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-3 flex items-center gap-2">
                  <FileTextIcon className="h-4 w-4" />
                  Model Information
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Model Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={yangFormData.name}
                      onChange={(e) => setYangFormData({ ...yangFormData, name: e.target.value })}
                      className="input text-sm"
                      placeholder="e.g., my-vlan-config"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Device Type</label>
                    <select
                      value={yangFormData.device_type}
                      onChange={(e) => setYangFormData({ ...yangFormData, device_type: e.target.value })}
                      className="input text-sm"
                    >
                      <option value="all">All Devices</option>
                      <option value="nexus">Nexus (NX-OS)</option>
                      <option value="ios">IOS</option>
                      <option value="ios-xe">IOS-XE</option>
                      <option value="ios-xr">IOS-XR</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                    <select
                      value={yangFormData.category}
                      onChange={(e) => setYangFormData({ ...yangFormData, category: e.target.value })}
                      className="input text-sm"
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
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={yangFormData.description}
                      onChange={(e) => setYangFormData({ ...yangFormData, description: e.target.value })}
                      className="input text-sm"
                      rows={2}
                      placeholder="Describe what this model is for (e.g., Configure VLANs with specific naming convention)"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* XML Templates Section */}
              <div className="border dark:border-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                  📋 XML Templates 
                  <span className="text-xs font-normal text-gray-500">({yangFormData.xml_templates.length} added)</span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Add example XML configurations for the LLM to reference
                </p>
                
                {yangFormData.xml_templates.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {yangFormData.xml_templates.map((tmpl, idx) => (
                      <div key={idx} className="flex items-start gap-2 bg-gray-50 dark:bg-gray-700 rounded-lg p-2">
                        <div className="flex-1">
                          <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{tmpl.name}</span>
                          {tmpl.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">{tmpl.description}</p>
                          )}
                        </div>
                        <button type="button" onClick={() => removeYangTemplate(idx)} className="text-red-500 dark:text-red-400 p-1">
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="space-y-2 bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
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
                    rows={4}
                    placeholder={`<config>
  <System xmlns="http://cisco.com/ns/yang/...">
    ...
  </System>
</config>`}
                  />
                  <button 
                    type="button" 
                    onClick={addYangTemplate} 
                    className="btn btn-secondary btn-sm"
                    disabled={!newTemplate.name || !newTemplate.template}
                  >
                    <PlusIcon className="h-3 w-3 mr-1" />
                    Add Template
                  </button>
                </div>
              </div>
              </div>
              
              <div className="px-6 py-5 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700 flex justify-end space-x-3 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => { setShowCustomYangModal(false); resetYangForm(); }}
                  className="btn btn-secondary btn-md"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary btn-md"
                  disabled={!yangFormData.name || !yangFormData.description}
                >
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Create Model
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* YANG Model Detail Modal */}
      {showYangDetailModal && selectedYangModel && createPortal(
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => { setShowYangDetailModal(false); setSelectedYangModel(null); }}
          ></div>
          
          {/* Modal Container */}
          <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col pointer-events-auto animate-fade-in">
            {/* Header */}
            <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/30 dark:to-blue-900/30">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                  <FileTextIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">{selectedYangModel.name}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">YANG Model Details</p>
                </div>
              </div>
              <button
                onClick={() => { setShowYangDetailModal(false); setSelectedYangModel(null); }}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Metadata Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Device Type</span>
                  <span className={`inline-block px-2 py-1 rounded text-sm font-medium ${
                    selectedYangModel.device_type === 'nexus' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' :
                    selectedYangModel.device_type === 'ios-xe' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                    selectedYangModel.device_type === 'ios-xr' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' :
                    'bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-300'
                  }`}>
                    {selectedYangModel.device_type?.toUpperCase() || 'ALL'}
                  </span>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Category</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">{selectedYangModel.category}</span>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Version</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{selectedYangModel.version || 'N/A'}</span>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Prefix</span>
                  <span className="text-sm font-mono font-medium text-purple-600 dark:text-purple-400">{selectedYangModel.prefix || 'N/A'}</span>
                </div>
              </div>

              {/* Namespace */}
              {selectedYangModel.namespace && (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <span className="text-xs text-gray-500 dark:text-gray-400 block mb-2">Namespace URI</span>
                  <code className="text-sm font-mono text-gray-800 dark:text-gray-200 break-all">{selectedYangModel.namespace}</code>
                </div>
              )}

              {/* Description */}
              {selectedYangModel.description && (
                <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4">
                  <span className="text-xs text-blue-600 dark:text-blue-400 block mb-2 font-medium">Description</span>
                  <p className="text-sm text-blue-800 dark:text-blue-200">{selectedYangModel.description}</p>
                </div>
              )}

              {/* XML Templates */}
              {selectedYangModel.xml_templates?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <CodeIcon className="h-4 w-4" />
                    XML Templates ({selectedYangModel.xml_templates.length})
                  </h3>
                  <div className="space-y-2">
                    {selectedYangModel.xml_templates.map((tmpl, idx) => (
                      <details key={idx} className="bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden">
                        <summary className="p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center justify-between">
                          <span className="font-medium text-sm text-gray-900 dark:text-white">{tmpl.name}</span>
                          {tmpl.description && <span className="text-xs text-gray-500 dark:text-gray-400">{tmpl.description}</span>}
                        </summary>
                        <div className="border-t dark:border-gray-600 bg-gray-900 p-3">
                          <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap overflow-auto max-h-48">{tmpl.template}</pre>
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              )}

              {/* Config Paths */}
              {selectedYangModel.config_paths?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <FolderIcon className="h-4 w-4" />
                    Config Paths ({selectedYangModel.config_paths.length})
                  </h3>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 space-y-1">
                    {selectedYangModel.config_paths.map((path, idx) => (
                      <div key={idx} className="text-sm font-mono text-purple-600 dark:text-purple-400 bg-white dark:bg-gray-800 rounded p-2">
                        {path.path}
                        {path.description && <span className="text-xs text-gray-500 ml-2">— {path.description}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* YANG Content */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <FileTextIcon className="h-4 w-4" />
                    YANG Model Content
                  </h3>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedYangModel.yang_content);
                      toast.success('YANG content copied to clipboard');
                    }}
                    className="btn btn-secondary btn-sm"
                  >
                    <CopyIcon className="h-3 w-3 mr-1" />
                    Copy
                  </button>
                </div>
                <div className="bg-gray-900 rounded-lg p-4 overflow-auto max-h-96">
                  <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">{selectedYangModel.yang_content}</pre>
                </div>
              </div>

              {/* Metadata Footer */}
              <div className="text-xs text-gray-400 dark:text-gray-500 pt-4 border-t dark:border-gray-700">
                <span>ID: {selectedYangModel.id || selectedYangModel._id}</span>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t dark:border-gray-700 flex justify-between bg-gray-50 dark:bg-gray-800">
              <button
                onClick={() => {
                  setShowYangDetailModal(false);
                  setSelectedYangModel(null);
                  handleYangModelDelete(selectedYangModel.id || selectedYangModel._id);
                }}
                className="btn btn-danger btn-md"
              >
                <TrashIcon className="h-4 w-4 mr-1" />
                Delete Model
              </button>
              <button
                onClick={() => { setShowYangDetailModal(false); setSelectedYangModel(null); }}
                className="btn btn-secondary btn-md"
              >
                Close
              </button>
            </div>
            </div>
          </div>
        </div>,
        document.body
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

      {/* Config Generation Progress Modal */}
      <ConfigProgressModal
        isOpen={showConfigProgressModal}
        onClose={() => setShowConfigProgressModal(false)}
        isGenerating={isGenerating}
        configMode={configMode}
        error={generationError}
        generatedConfig={generatedConfig}
      />
    </div>
  );
}

export default Configurations;
