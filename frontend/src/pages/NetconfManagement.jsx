import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
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
  ClipboardDocumentIcon,
  CloudArrowUpIcon,
  CommandLineIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import ConfirmationModal from '../components/ConfirmationModal';
import { useConfirmation } from '../hooks/useConfirmation';

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
  
  // YANG Model Upload states
  const [showYangUploadForm, setShowYangUploadForm] = useState(false);
  const [uploadMethod, setUploadMethod] = useState('file'); // 'file' or 'manual'
  const [yangFile, setYangFile] = useState(null);
  const [newYangModel, setNewYangModel] = useState({
    name: '',
    namespace: '',
    prefix: '',
    revision: '',
    description: '',
    organization: '',
    contact: '',
    yang_content: '',
    vendor: 'custom',
    category: 'other'
  });
  const [dragOver, setDragOver] = useState(false);
  const [previewModel, setPreviewModel] = useState(null);
  const [editingModel, setEditingModel] = useState(null);
  const [yangValidation, setYangValidation] = useState(null);
  const [modelFilter, setModelFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const API_BASE_URL = 'http://localhost:3001/api';

  const { confirmationState, showConfirmation } = useConfirmation();
  const [deployingXml, setDeployingXml] = useState(false);
  const [deployResult, setDeployResult] = useState(null);

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
      console.log('📥 Fetching YANG models...');
      const response = await fetch(`${API_BASE_URL}/netconf/yang-models`);
      const data = await response.json();
      console.log('📋 YANG models response:', data);
      
      if (data.success) {
        console.log('✅ YANG models structure:', data.data.models);
        console.log('🔍 First model example:', data.data.models[0]);
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
    const confirmed = await showConfirmation({
      title: 'Connect NETCONF Session',
      message: 'Are you sure you want to establish a NETCONF session with this device?',
      confirmText: 'Connect',
      cancelText: 'Cancel',
      type: 'info'
    });

    if (!confirmed) return;

    setLoading(true);
    const toastId = toast.loading('Establishing NETCONF session...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/netconf/connect/${deviceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await response.json();
      if (data.success) {
        toast.success('NETCONF session established successfully!', { id: toastId });
        fetchActiveSessions();
      } else {
        toast.error(`Connection failed: ${data.message}`, { id: toastId });
      }
    } catch (error) {
      console.error('Error connecting device:', error);
      toast.error('Connection failed: ' + error.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const disconnectSession = async (sessionId) => {
    const confirmed = await showConfirmation({
      title: 'Disconnect NETCONF Session',
      message: 'Are you sure you want to disconnect this NETCONF session?',
      confirmText: 'Disconnect',
      cancelText: 'Cancel',
      type: 'warning'
    });

    if (!confirmed) return;

    setLoading(true);
    const toastId = toast.loading('Disconnecting NETCONF session...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/netconf/disconnect/${sessionId}`, {
        method: 'POST'
      });
      const data = await response.json();
      if (data.success) {
        toast.success('NETCONF session disconnected successfully!', { id: toastId });
        fetchActiveSessions();
      } else {
        toast.error(`Disconnect failed: ${data.message}`, { id: toastId });
      }
    } catch (error) {
      console.error('Error disconnecting session:', error);
      toast.error('Disconnect failed: ' + error.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const getConfiguration = async (sessionId, datastore = 'running') => {
    setLoading(true);
    const toastId = toast.loading(`Getting ${datastore} configuration...`);
    
    try {
      const response = await fetch(`${API_BASE_URL}/netconf/config/${sessionId}?datastore=${datastore}`);
      const data = await response.json();
      if (data.success) {
        setConfigData(JSON.stringify(data.data.config, null, 2));
        toast.success(`${datastore} configuration retrieved successfully!`, { id: toastId });
      } else {
        toast.error(`Failed to get configuration: ${data.message}`, { id: toastId });
      }
    } catch (error) {
      console.error('Error getting configuration:', error);
      toast.error('Failed to get configuration: ' + error.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const getOperationalData = async (sessionId) => {
    setLoading(true);
    const toastId = toast.loading('Getting operational data...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/netconf/operational/${sessionId}`);
      const data = await response.json();
      if (data.success) {
        setOperationalData(JSON.stringify(data.data.operationalData, null, 2));
        toast.success('Operational data retrieved successfully!', { id: toastId });
      } else {
        toast.error(`Failed to get operational data: ${data.message}`, { id: toastId });
      }
    } catch (error) {
      console.error('Error getting operational data:', error);
      toast.error('Failed to get operational data: ' + error.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const generateNetconfXml = async () => {
    if (!xmlPrompt.trim()) {
      toast.error('Please enter a prompt for XML generation');
      return;
    }

    if (xmlPrompt.length < 10) {
      toast.error('Prompt must be at least 10 characters long');
      return;
    }

    setLoading(true);
    const toastId = toast.loading('Generating NETCONF XML...');
    
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
        toast.success('NETCONF XML generated successfully!', { id: toastId });
      } else {
        toast.error(`Failed to generate XML: ${data.message}`, { id: toastId });
      }
    } catch (error) {
      console.error('Error generating XML:', error);
      toast.error('Failed to generate XML: ' + error.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const deployXmlToDevice = async (sessionId, xmlConfig) => {
    if (!sessionId || !xmlConfig) {
      toast.error('Please select a session and ensure XML is generated');
      return;
    }

    const session = activeSessions.find(s => s.sessionId === sessionId);
    if (!session) {
      toast.error('Selected session not found');
      return;
    }

    const confirmed = await showConfirmation({
      title: 'Deploy XML Configuration',
      message: `Are you sure you want to deploy this XML configuration to ${session.ip_address}?\n\nThis will modify the device configuration and cannot be easily undone.`,
      confirmText: 'Deploy Configuration',
      cancelText: 'Cancel',
      type: 'warning'
    });

    if (!confirmed) return;

    setDeployingXml(true);
    setDeployResult(null);
    const toastId = toast.loading(`Deploying XML configuration to ${session.ip_address}...`);
    
    try {
      const response = await fetch(`${API_BASE_URL}/netconf/deploy-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          xml_config: xmlConfig,
          datastore: 'running', // or 'candidate'
          validate: true,
          commit: true
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setDeployResult({
          success: true,
          message: data.message,
          details: data.details,
          session: session.ip_address
        });
        toast.success(`Configuration deployed successfully to ${session.ip_address}!`, { id: toastId });
        
        // Refresh operational data after deployment
        setTimeout(() => {
          getOperationalData(sessionId);
        }, 2000);
      } else {
        setDeployResult({
          success: false,
          message: data.message,
          error: data.error,
          session: session.ip_address
        });
        toast.error(`Deployment failed: ${data.message}`, { id: toastId });
      }
    } catch (error) {
      console.error('Error deploying XML:', error);
      setDeployResult({
        success: false,
        message: 'Network error occurred',
        error: error.message,
        session: session.ip_address
      });
      toast.error('Failed to deploy XML: ' + error.message, { id: toastId });
    } finally {
      setDeployingXml(false);
    }
  };

  const validateXmlConfiguration = async (sessionId, xmlConfig) => {
    if (!sessionId || !xmlConfig) {
      toast.error('Please select a session and ensure XML is generated');
      return;
    }

    setLoading(true);
    const toastId = toast.loading('Validating XML configuration...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/netconf/validate-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          xml_config: xmlConfig
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success('XML configuration is valid!', { id: toastId });
        setDeployResult({
          success: true,
          message: 'Configuration validation passed',
          details: data.details,
          validated: true
        });
      } else {
        toast.error(`Validation failed: ${data.message}`, { id: toastId });
        setDeployResult({
          success: false,
          message: data.message,
          error: data.error,
          validated: false
        });
      }
    } catch (error) {
      console.error('Error validating XML:', error);
      toast.error('Failed to validate XML: ' + error.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  // Enhanced YANG Model file handling
  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (file) {
      await processYangFile(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      await processYangFile(file);
    }
  };

  const processYangFile = async (file) => {
    if (!file.name.endsWith('.yang')) {
      toast.error('Please select a .yang file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast.error('File size must be less than 5MB');
      return;
    }

    setYangFile(file);
    setYangValidation(null);
    
    try {
      const content = await file.text();
      
      // Enhanced parsing with better regex patterns
      const moduleMatch = content.match(/module\s+([a-zA-Z0-9_-]+)\s*{/);
      const submoduleMatch = content.match(/submodule\s+([a-zA-Z0-9_-]+)\s*{/);
      const namespaceMatch = content.match(/namespace\s+"([^"]+)"/);
      const prefixMatch = content.match(/prefix\s+([a-zA-Z0-9_-]+)/);
      const revisionMatch = content.match(/revision\s+([0-9]{4}-[0-9]{2}-[0-9]{2})/);
      const organizationMatch = content.match(/organization\s+"([^"]+)"/);
      const contactMatch = content.match(/contact\s+"([^"]+)"/);
      const descriptionMatch = content.match(/description\s+"([^"]+)"/);
      const yangVersionMatch = content.match(/yang-version\s+([0-9.]+)/);

      // Auto-detect vendor based on namespace or organization
      let detectedVendor = 'custom';
      const namespace = namespaceMatch ? namespaceMatch[1] : '';
      const organization = organizationMatch ? organizationMatch[1] : '';
      
      if (namespace.includes('ietf') || organization.toLowerCase().includes('ietf')) {
        detectedVendor = 'ietf';
      } else if (namespace.includes('cisco') || organization.toLowerCase().includes('cisco')) {
        detectedVendor = 'cisco';
      } else if (namespace.includes('juniper') || organization.toLowerCase().includes('juniper')) {
        detectedVendor = 'juniper';
      } else if (namespace.includes('huawei') || organization.toLowerCase().includes('huawei')) {
        detectedVendor = 'huawei';
      }

      // Auto-detect category based on model name
      let detectedCategory = 'other';
      const modelName = (moduleMatch ? moduleMatch[1] : submoduleMatch ? submoduleMatch[1] : '').toLowerCase();
      
      if (modelName.includes('interface') || modelName.includes('if')) {
        detectedCategory = 'interface';
      } else if (modelName.includes('routing') || modelName.includes('bgp') || modelName.includes('ospf')) {
        detectedCategory = 'routing';
      } else if (modelName.includes('system') || modelName.includes('sys')) {
        detectedCategory = 'system';
      } else if (modelName.includes('security') || modelName.includes('acl')) {
        detectedCategory = 'security';
      } else if (modelName.includes('qos') || modelName.includes('quality')) {
        detectedCategory = 'qos';
      }

      const extractedModel = {
        name: moduleMatch ? moduleMatch[1] : submoduleMatch ? submoduleMatch[1] : file.name.replace('.yang', ''),
        namespace: namespace,
        prefix: prefixMatch ? prefixMatch[1] : '',
        revision: revisionMatch ? revisionMatch[1] : new Date().toISOString().split('T')[0],
        description: descriptionMatch ? descriptionMatch[1] : '',
        organization: organization,
        contact: contactMatch ? contactMatch[1] : '',
        yang_content: content,
        vendor: detectedVendor,
        category: detectedCategory,
        yang_version: yangVersionMatch ? yangVersionMatch[1] : '1.0',
        file_size: file.size,
        file_name: file.name
      };

      setNewYangModel(extractedModel);
      
      // Basic validation
      validateYangModel(extractedModel);
      
      toast.success('YANG file processed successfully!');
    } catch (error) {
      console.error('Error processing YANG file:', error);
      toast.error('Failed to process YANG file: ' + error.message);
    }
  };

  const validateYangModel = (model) => {
    const errors = [];
    const warnings = [];

    // Required fields validation
    if (!model.name) errors.push('Model name is required');
    if (!model.namespace) errors.push('Namespace is required');
    if (!model.prefix) errors.push('Prefix is required');
    if (!model.yang_content) errors.push('YANG content is required');

    // Format validation
    if (model.revision && !/^\d{4}-\d{2}-\d{2}$/.test(model.revision)) {
      errors.push('Revision must be in YYYY-MM-DD format');
    }

    // Content validation
    if (model.yang_content) {
      const content = model.yang_content;
      
      // Check for basic YANG structure
      if (!content.includes('module') && !content.includes('submodule')) {
        errors.push('YANG content must contain a module or submodule');
      }
      
      // Check for balanced braces
      const openBraces = (content.match(/{/g) || []).length;
      const closeBraces = (content.match(/}/g) || []).length;
      if (openBraces !== closeBraces) {
        errors.push('Unbalanced braces in YANG content');
      }
      
      // Common warnings
      if (!content.includes('organization')) {
        warnings.push('Organization information is missing');
      }
      if (!content.includes('contact')) {
        warnings.push('Contact information is missing');
      }
      if (!content.includes('description')) {
        warnings.push('Description is missing');
      }
    }

    setYangValidation({
      isValid: errors.length === 0,
      errors,
      warnings
    });
  };

  const uploadYangModel = async () => {
    if (uploadMethod === 'file' && !yangFile) {
      toast.error('Please select a YANG file');
      return;
    }

    if (uploadMethod === 'manual' && (!newYangModel.name || !newYangModel.namespace || !newYangModel.prefix || !newYangModel.yang_content)) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (yangValidation && !yangValidation.isValid) {
      toast.error('Please fix validation errors before uploading');
      return;
    }

    setLoading(true);
    const toastId = toast.loading('Uploading YANG model...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/netconf/yang-models`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newYangModel)
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success('YANG model uploaded successfully!', { id: toastId });
        resetYangForm();
        fetchYangModels();
      } else {
        toast.error(`Failed to upload YANG model: ${data.message}`, { id: toastId });
      }
    } catch (error) {
      console.error('Error uploading YANG model:', error);
      toast.error('Failed to upload YANG model: ' + error.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const resetYangForm = () => {
    setShowYangUploadForm(false);
    setYangFile(null);
    setNewYangModel({
      name: '',
      namespace: '',
      prefix: '',
      revision: '',
      description: '',
      organization: '',
      contact: '',
      yang_content: '',
      vendor: 'custom',
      category: 'other'
    });
    setYangValidation(null);
  };

  const editYangModel = (model) => {
    setEditingModel(model);
    setNewYangModel({
      name: model.name,
      namespace: model.namespace,
      prefix: model.prefix,
      revision: model.revision,
      description: model.description,
      organization: model.organization,
      contact: model.contact,
      yang_content: model.yang_content,
      vendor: model.vendor,
      category: model.category
    });
    setShowYangUploadForm(true);
    setUploadMethod('manual');
  };

  const updateYangModel = async () => {
    if (!editingModel) return;

    setLoading(true);
    const toastId = toast.loading('Updating YANG model...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/netconf/yang-models/${editingModel.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newYangModel)
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success('YANG model updated successfully!', { id: toastId });
        setEditingModel(null);
        resetYangForm();
        fetchYangModels();
      } else {
        toast.error(`Failed to update YANG model: ${data.message}`, { id: toastId });
      }
    } catch (error) {
      console.error('Error updating YANG model:', error);
      toast.error('Failed to update YANG model: ' + error.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const deleteYangModel = async (modelId) => {
    const confirmed = await showConfirmation({
      title: 'Delete YANG Model',
      message: 'Are you sure you want to delete this YANG model? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger'
    });

    if (!confirmed) return;

    setLoading(true);
    const toastId = toast.loading('Deleting YANG model...');
    
    try {
      console.log(`🗑️ Attempting to delete YANG model: ${modelId}`);
      
      const response = await fetch(`${API_BASE_URL}/netconf/yang-models/${modelId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`📡 Delete response status: ${response.status}`);
      
      const data = await response.json();
      console.log('📥 Delete response data:', data);
      
      if (response.ok && data.success) {
        toast.success(data.message || 'YANG model deleted successfully!', { id: toastId });
        fetchYangModels(); // Refresh the list
        
        // Clear selected model if it was deleted
        if (selectedYangModel && selectedYangModel.id === modelId) {
          setSelectedYangModel(null);
        }
      } else {
        // Handle error from backend
        const errorMessage = data.message || `Server returned ${response.status}`;
        console.error('❌ Delete failed:', errorMessage);
        toast.error(errorMessage, { id: toastId });
      }
    } catch (error) {
      console.error('❌ Network error deleting YANG model:', error);
      
      // More specific error handling
      let errorMessage = 'Network error occurred';
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorMessage = 'Cannot connect to server. Please check your connection.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const previewYangModel = (model) => {
    setPreviewModel(model);
  };

  const filteredYangModels = yangModels.filter(model => {
    const matchesFilter = modelFilter === 'all' || model.vendor === modelFilter;
    const matchesSearch = !searchTerm || 
      model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      model.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      model.vendor.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesFilter && matchesSearch;
  });

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
        <div className="space-y-6">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-medium text-gray-900">YANG Models Management</h2>
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowYangUploadForm(true)}
                  className="btn btn-primary btn-sm"
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Add Model
                </button>
                <button
                  onClick={fetchYangModels}
                  disabled={loading}
                  className="btn btn-secondary btn-sm"
                >
                  <ArrowPathIcon className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>

            {/* Filter and Search */}
            <div className="mb-6 flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search Models
                </label>
                <input
                  type="text"
                  placeholder="Search by name, description, or vendor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filter by Vendor
                </label>
                <select
                  value={modelFilter}
                  onChange={(e) => setModelFilter(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="all">All Vendors</option>
                  <option value="ietf">IETF</option>
                  <option value="cisco">Cisco</option>
                  <option value="juniper">Juniper</option>
                  <option value="huawei">Huawei</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            </div>

            {/* YANG Model Upload Form */}
            {showYangUploadForm && (
              <div className="mb-6 p-6 bg-gray-50 rounded-lg border">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    {editingModel ? 'Edit YANG Model' : 'Add New YANG Model'}
                  </h3>
                  <button
                    onClick={() => {
                      resetYangForm();
                      setEditingModel(null);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
                
                {/* Upload Method Selection */}
                {!editingModel && (
                  <div className="mb-6">
                    <div className="flex space-x-4">
                      <button
                        onClick={() => setUploadMethod('file')}
                        className={`px-4 py-2 rounded-lg border transition-colors ${
                          uploadMethod === 'file'
                            ? 'bg-blue-100 text-blue-700 border-blue-300'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <DocumentTextIcon className="h-4 w-4 mr-2 inline" />
                        Upload .yang File
                      </button>
                      <button
                        onClick={() => setUploadMethod('manual')}
                        className={`px-4 py-2 rounded-lg border transition-colors ${
                          uploadMethod === 'manual'
                            ? 'bg-blue-100 text-blue-700 border-blue-300'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <CodeBracketIcon className="h-4 w-4 mr-2 inline" />
                        Create Custom Model
                      </button>
                    </div>
                  </div>
                )}

                {/* File Upload Section */}
                {uploadMethod === 'file' && !editingModel && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Upload YANG File
                    </label>
                    <div 
                      className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-lg transition-colors ${
                        dragOver 
                          ? 'border-blue-400 bg-blue-50' 
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      <div className="space-y-1 text-center">
                        <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
                        <div className="flex text-sm text-gray-600">
                          <label
                            htmlFor="file-upload"
                            className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                          >
                            <span>Upload a .yang file</span>
                            <input
                              id="file-upload"
                              name="file-upload"
                              type="file"
                              accept=".yang"
                              className="sr-only"
                              onChange={handleFileChange}
                            />
                          </label>
                          <p className="pl-1">or drag and drop</p>
                        </div>
                        <p className="text-xs text-gray-500">
                          YANG files only (max 5MB)
                        </p>
                      </div>
                    </div>
                    {yangFile && (
                      <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center">
                          <CheckCircleIcon className="h-5 w-5 text-green-600 mr-2" />
                          <span className="text-sm text-green-800">
                            File loaded: {yangFile.name} ({(yangFile.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Model Form */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Model Name *
                    </label>
                    <input
                      type="text"
                      value={newYangModel.name}
                      onChange={(e) => setNewYangModel({...newYangModel, name: e.target.value})}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder="e.g., ietf-interfaces"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Namespace *
                    </label>
                    <input
                      type="text"
                      value={newYangModel.namespace}
                      onChange={(e) => setNewYangModel({...newYangModel, namespace: e.target.value})}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder="e.g., urn:ietf:params:xml:ns:yang:ietf-interfaces"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Prefix *
                    </label>
                    <input
                      type="text"
                      value={newYangModel.prefix}
                      onChange={(e) => setNewYangModel({...newYangModel, prefix: e.target.value})}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder="e.g., if"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Revision (YYYY-MM-DD)
                    </label>
                    <input
                      type="text"
                      value={newYangModel.revision}
                      onChange={(e) => setNewYangModel({...newYangModel, revision: e.target.value})}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder="e.g., 2024-01-01"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Vendor
                    </label>
                    <select
                      value={newYangModel.vendor}
                      onChange={(e) => setNewYangModel({...newYangModel, vendor: e.target.value})}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="custom">Custom</option>
                      <option value="ietf">IETF</option>
                      <option value="cisco">Cisco</option>
                      <option value="juniper">Juniper</option>
                      <option value="huawei">Huawei</option>
                      <option value="nokia">Nokia</option>
                      <option value="arista">Arista</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category
                    </label>
                    <select
                      value={newYangModel.category}
                      onChange={(e) => setNewYangModel({...newYangModel, category: e.target.value})}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="interface">Interface</option>
                      <option value="routing">Routing</option>
                      <option value="system">System</option>
                      <option value="security">Security</option>
                      <option value="qos">QoS</option>
                      <option value="monitoring">Monitoring</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Organization
                    </label>
                    <input
                      type="text"
                      value={newYangModel.organization}
                      onChange={(e) => setNewYangModel({...newYangModel, organization: e.target.value})}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder="e.g., IETF NETMOD Working Group"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contact
                    </label>
                    <input
                      type="text"
                      value={newYangModel.contact}
                      onChange={(e) => setNewYangModel({...newYangModel, contact: e.target.value})}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder="e.g., netmod@ietf.org"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={newYangModel.description}
                      onChange={(e) => setNewYangModel({...newYangModel, description: e.target.value})}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      rows="2"
                      placeholder="Brief description of the YANG model"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      YANG Content *
                    </label>
                    <textarea
                      value={newYangModel.yang_content}
                      onChange={(e) => {
                        setNewYangModel({...newYangModel, yang_content: e.target.value});
                        validateYangModel({...newYangModel, yang_content: e.target.value});
                      }}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 font-mono text-sm"
                      rows="12"
                      placeholder="module example-module {
  yang-version 1.1;
  namespace &quot;urn:example:module&quot;;
  prefix &quot;ex&quot;;
  
  description &quot;Example YANG module&quot;;
  
  // Your YANG definitions here
}"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Enter the complete YANG module content
                    </p>
                  </div>
                </div>

                {/* Validation Results */}
                {yangValidation && (
                  <div className="mb-6">
                    <div className={`p-4 rounded-lg border ${
                      yangValidation.isValid 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-red-50 border-red-200'
                    }`}>
                      <div className="flex items-center mb-2">
                        {yangValidation.isValid ? (
                          <CheckCircleIcon className="h-5 w-5 text-green-600 mr-2" />
                        ) : (
                          <ExclamationTriangleIcon className="h-5 w-5 text-red-600 mr-2" />
                        )}
                        <span className={`font-medium ${
                          yangValidation.isValid ? 'text-green-800' : 'text-red-800'
                        }`}>
                          {yangValidation.isValid ? 'Validation Passed' : 'Validation Failed'}
                        </span>
                      </div>
                      
                      {yangValidation.errors.length > 0 && (
                        <div className="mb-3">
                          <p className="text-sm font-medium text-red-800 mb-1">Errors:</p>
                          <ul className="text-sm text-red-700 space-y-1">
                            {yangValidation.errors.map((error, index) => (
                              <li key={index} className="flex items-start">
                                <span className="text-red-500 mr-2">•</span>
                                {error}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {yangValidation.warnings.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-yellow-800 mb-1">Warnings:</p>
                          <ul className="text-sm text-yellow-700 space-y-1">
                            {yangValidation.warnings.map((warning, index) => (
                              <li key={index} className="flex items-start">
                                <span className="text-yellow-500 mr-2">•</span>
                                {warning}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Form Actions */}
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      resetYangForm();
                      setEditingModel(null);
                    }}
                    className="btn btn-secondary btn-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => validateYangModel(newYangModel)}
                    disabled={!newYangModel.yang_content}
                    className="btn btn-secondary btn-sm"
                  >
                    <CommandLineIcon className="h-4 w-4 mr-2" />
                    Validate
                  </button>
                  <button
                    onClick={editingModel ? updateYangModel : uploadYangModel}
                    disabled={loading || (yangValidation && !yangValidation.isValid)}
                    className="btn btn-primary btn-sm"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        {editingModel ? 'Updating...' : 'Uploading...'}
                      </>
                    ) : (
                      <>
                        <CloudArrowUpIcon className="h-4 w-4 mr-2" />
                        {editingModel ? 'Update Model' : 'Upload Model'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Models List */}
            {filteredYangModels.length === 0 ? (
              <div className="text-center py-12">
                <DocumentTextIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {searchTerm || modelFilter !== 'all' ? 'No models match your filter' : 'No YANG models found'}
                </h3>
                <p className="text-gray-500">
                  {searchTerm || modelFilter !== 'all' ? 'Try adjusting your search or filter' : 'Upload YANG models to see them here'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredYangModels.map((model) => (
                  <div key={model.id} className="card p-4 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900 mb-1">{model.name}</h3>
                        <p className="text-sm text-gray-600 mb-2">{model.description}</p>
                        <div className="flex items-center space-x-2 mb-2">
                          <span className={`badge ${
                            model.vendor === 'ietf' ? 'badge-success' :
                            model.vendor === 'cisco' ? 'badge-primary' :
                            model.vendor === 'custom' ? 'badge-secondary' : 'badge-warning'
                          }`}>
                            {model.vendor.toUpperCase()}
                          </span>
                          <span className="badge badge-gray">
                            {model.category}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => previewYangModel(model)}
                          className="p-1 text-gray-400 hover:text-gray-600"
                          title="Preview model"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => editYangModel(model)}
                          className="p-1 text-gray-400 hover:text-blue-600"
                          title="Edit model"
                        >
                          <CogIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteYangModel(model.id)}
                          className="p-1 text-gray-400 hover:text-red-600"
                          title="Delete model"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-600 space-y-1">
                      <div className="flex justify-between">
                        <span>Namespace:</span>
                        <span className="font-mono text-xs truncate ml-2">{model.namespace}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Prefix:</span>
                        <span className="font-mono text-xs">{model.prefix}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Revision:</span>
                        <span className="font-mono text-xs">{model.revision}</span>
                      </div>
                      {model.organization && (
                        <div className="flex justify-between">
                          <span>Organization:</span>
                          <span className="text-xs truncate ml-2">{model.organization}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-3 flex space-x-2">
                      <button
                        onClick={() => setSelectedYangModel(model)}
                        className="btn btn-primary btn-sm flex-1"
                      >
                        <CheckCircleIcon className="h-4 w-4 mr-2" />
                        Select
                      </button>
                      <button
                        onClick={() => previewYangModel(model)}
                        className="btn btn-secondary btn-sm"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Summary Info */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="text-sm font-medium text-blue-900 mb-2">Model Summary</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-blue-800">
                <div>
                  <span className="font-medium">Total Models:</span>
                  <span className="ml-2">{yangModels.length}</span>
                </div>
                <div>
                  <span className="font-medium">Showing:</span>
                  <span className="ml-2">{filteredYangModels.length}</span>
                </div>
                <div>
                  <span className="font-medium">Selected:</span>
                  <span className="ml-2">{selectedYangModel ? selectedYangModel.name : 'None'}</span>
                </div>
                <div>
                  <span className="font-medium">Vendors:</span>
                  <span className="ml-2">{[...new Set(yangModels.map(m => m.vendor))].length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Model Preview Modal */}
      {previewModel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full m-4 max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-medium text-gray-900">
                YANG Model Preview: {previewModel.name}
              </h3>
              <button
                onClick={() => setPreviewModel(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-4">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Model Information</h4>
                  <div className="space-y-1 text-sm">
                    <div><span className="font-medium">Name:</span> {previewModel.name}</div>
                    <div><span className="font-medium">Namespace:</span> {previewModel.namespace}</div>
                    <div><span className="font-medium">Prefix:</span> {previewModel.prefix}</div>
                    <div><span className="font-medium">Revision:</span> {previewModel.revision}</div>
                    <div><span className="font-medium">Vendor:</span> {previewModel.vendor}</div>
                    <div><span className="font-medium">Category:</span> {previewModel.category}</div>
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Additional Details</h4>
                  <div className="space-y-1 text-sm">
                    <div><span className="font-medium">Organization:</span> {previewModel.organization || 'N/A'}</div>
                    <div><span className="font-medium">Contact:</span> {previewModel.contact || 'N/A'}</div>
                    <div><span className="font-medium">Description:</span> {previewModel.description || 'N/A'}</div>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">YANG Content</h4>
                <div className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto max-h-96">
                  <pre className="text-sm font-mono whitespace-pre-wrap">
                    {previewModel.yang_content}
                  </pre>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 p-4 border-t">
              <button
                onClick={() => navigator.clipboard.writeText(previewModel.yang_content)}
                className="btn btn-secondary btn-sm"
              >
                <ClipboardDocumentIcon className="h-4 w-4 mr-2" />
                Copy Content
              </button>
              <button
                onClick={() => setSelectedYangModel(previewModel)}
                className="btn btn-primary btn-sm"
              >
                <CheckCircleIcon className="h-4 w-4 mr-2" />
                Select Model
              </button>
              <button
                onClick={() => setPreviewModel(null)}
                className="btn btn-secondary btn-sm"
              >
                Close
              </button>
            </div>
          </div>
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
            <p className="text-sm text-gray-600 mb-6">
              Generate NETCONF XML configurations using natural language prompts. The AI will create proper XML based on YANG models and device context.
            </p>
            
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
                  <p className="text-xs text-gray-500 mt-1">
                    Helps AI understand device capabilities and context
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    YANG Model (Optional)
                  </label>
                  <select
                    value={selectedYangModel?.id || ''}
                    onChange={(e) => {
                      const model = yangModels.find(m => m.id === e.target.value);
                      setSelectedYangModel(model || null);
                    }}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">Select YANG model...</option>
                    {yangModels.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name} ({model.vendor})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Provides schema context for accurate XML generation
                  </p>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Configuration Prompt *
                </label>
                <textarea
                  value={xmlPrompt}
                  onChange={(e) => setXmlPrompt(e.target.value)}
                  placeholder="Describe the configuration you want to generate..."
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  rows="4"
                />
                <div className="flex justify-between items-center mt-1">
                  <p className="text-xs text-gray-500">
                    Be specific about what you want to configure
                  </p>
                  <p className={`text-xs ${
                    xmlPrompt.length < 10 ? 'text-red-500' : 
                    xmlPrompt.length > 500 ? 'text-red-500' : 'text-green-500'
                  }`}>
                    {xmlPrompt.length}/500 chars {xmlPrompt.length < 10 ? '(min 10)' : ''}
                  </p>
                </div>
              </div>
              
              <button
                onClick={generateNetconfXml}
                disabled={loading || !xmlPrompt.trim() || xmlPrompt.length < 10}
                className="btn btn-primary btn-md w-full"
              >
                <CodeBracketIcon className="h-4 w-4 mr-2" />
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Generating XML...
                  </>
                ) : (
                  'Generate NETCONF XML'
                )}
              </button>
              
              {xmlPrompt.length > 0 && xmlPrompt.length < 10 && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">
                    Prompt must be at least 10 characters long. Currently: {xmlPrompt.length} characters.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Example Prompts */}
          <div className="card p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Example Prompts</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Interface Configuration</h4>
                <div className="space-y-2">
                  {[
                    "Configure interface GigabitEthernet0/1 with IP 192.168.1.1/24",
                    "Set interface FastEthernet0/2 to trunk mode with VLANs 10,20,30",
                    "Enable interface GigabitEthernet0/3 and set description 'Server Link'"
                  ].map((example, index) => (
                    <button
                      key={index}
                      onClick={() => setXmlPrompt(example)}
                      className="text-left text-sm text-blue-600 hover:text-blue-800 block w-full p-2 hover:bg-blue-50 rounded"
                    >
                      • {example}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">VLAN & Routing</h4>
                <div className="space-y-2">
                  {[
                    "Create VLAN 100 named 'Sales' with IP 10.0.100.1/24",
                    "Configure OSPF area 0 on interfaces Gi0/1 and Gi0/2",
                    "Set up BGP AS 65001 with neighbor 192.168.1.2"
                  ].map((example, index) => (
                    <button
                      key={index}
                      onClick={() => setXmlPrompt(example)}
                      className="text-left text-sm text-blue-600 hover:text-blue-800 block w-full p-2 hover:bg-blue-50 rounded"
                    >
                      • {example}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Security & ACL</h4>
                <div className="space-y-2">
                  {[
                    "Create access-list 100 to deny HTTP from 192.168.10.0/24",
                    "Configure SSH access with username admin and enable secret",
                    "Set up port security on interface FastEthernet0/1"
                  ].map((example, index) => (
                    <button
                      key={index}
                      onClick={() => setXmlPrompt(example)}
                      className="text-left text-sm text-blue-600 hover:text-blue-800 block w-full p-2 hover:bg-blue-50 rounded"
                    >
                      • {example}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">System Configuration</h4>
                <div className="space-y-2">
                  {[
                    "Set hostname to 'CoreSwitch01' and domain name 'company.com'",
                    "Configure NTP server 192.168.1.100 and timezone EST",
                    "Enable SNMP community 'public' with read-only access"
                  ].map((example, index) => (
                    <button
                      key={index}
                      onClick={() => setXmlPrompt(example)}
                      className="text-left text-sm text-blue-600 hover:text-blue-800 block w-full p-2 hover:bg-blue-50 rounded"
                    >
                      • {example}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          {/* Generated XML Display */}
          {generatedXml && (
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Generated NETCONF XML</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => navigator.clipboard.writeText(generatedXml)}
                    className="btn btn-secondary btn-sm"
                  >
                    <ClipboardDocumentIcon className="h-4 w-4 mr-2" />
                    Copy XML
                  </button>
                  <button
                    onClick={() => setGeneratedXml('')}
                    className="btn btn-secondary btn-sm"
                  >
                    <XMarkIcon className="h-4 w-4 mr-2" />
                    Clear
                  </button>
                </div>
              </div>
              
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                <div className="flex items-center">
                  <CheckCircleIcon className="h-5 w-5 text-green-600 mr-2" />
                  <span className="text-green-800 text-sm">
                    XML generated successfully! You can validate and deploy this to your Nexus device.
                  </span>
                </div>
              </div>
              
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto max-h-96 text-sm font-mono">
                <code>{generatedXml}</code>
              </pre>
              
              {/* Deploy Actions */}
              {activeSessions.length > 0 && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="text-sm font-medium text-blue-900 mb-3">Deploy to Device</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Active NETCONF Session
                      </label>
                      <select
                        id="deploySession"
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      >
                        <option value="">Choose session...</option>
                        {activeSessions.map((session) => (
                          <option key={session.sessionId} value={session.sessionId}>
                            {session.ip_address} (Session: {session.sessionId})
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="flex space-x-3">
                      <button
                        onClick={() => {
                          const sessionSelect = document.getElementById('deploySession');
                          const sessionId = sessionSelect.value;
                          if (sessionId) {
                            validateXmlConfiguration(sessionId, generatedXml);
                          } else {
                            toast.error('Please select a session first');
                          }
                        }}
                        disabled={loading}
                        className="btn btn-secondary btn-sm"
                      >
                        <CommandLineIcon className="h-4 w-4 mr-2" />
                        {loading ? 'Validating...' : 'Validate XML'}
                      </button>
                      
                      <button
                        onClick={() => {
                          const sessionSelect = document.getElementById('deploySession');
                          const sessionId = sessionSelect.value;
                          if (sessionId) {
                            deployXmlToDevice(sessionId, generatedXml);
                          } else {
                            toast.error('Please select a session first');
                          }
                        }}
                        disabled={deployingXml || loading}
                        className="btn btn-primary btn-sm"
                      >
                        {deployingXml ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Deploying...
                          </>
                        ) : (
                          <>
                            <CloudArrowUpIcon className="h-4 w-4 mr-2" />
                            Deploy to Device
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Deploy Result */}
              {deployResult && (
                <div className={`mt-4 p-4 rounded-lg border ${
                  deployResult.success 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-start">
                    {deployResult.success ? (
                      <CheckCircleIcon className="h-5 w-5 text-green-600 mr-2 mt-0.5" />
                    ) : (
                      <ExclamationTriangleIcon className="h-5 w-5 text-red-600 mr-2 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <h4 className={`text-sm font-medium ${
                        deployResult.success ? 'text-green-900' : 'text-red-900'
                      }`}>
                        {deployResult.success ? 'Deployment Successful' : 'Deployment Failed'}
                      </h4>
                      <p className={`text-sm mt-1 ${
                        deployResult.success ? 'text-green-800' : 'text-red-800'
                      }`}>
                        {deployResult.message}
                      </p>
                      {deployResult.session && (
                        <p className="text-xs text-gray-600 mt-1">
                          Target: {deployResult.session}
                        </p>
                      )}
                      {deployResult.details && (
                        <div className="mt-2">
                          <details className="text-xs">
                            <summary className="cursor-pointer font-medium">
                              View Details
                            </summary>
                            <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-auto">
                              {JSON.stringify(deployResult.details, null, 2)}
                            </pre>
                          </details>
                        </div>
                      )}
                      {deployResult.error && (
                        <div className="mt-2">
                          <p className="text-xs text-red-700 font-mono bg-red-100 p-2 rounded">
                            Error: {deployResult.error}
                          </p>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setDeployResult(null)}
                      className="ml-2 text-gray-400 hover:text-gray-600"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
              
              {/* Usage Instructions */}
              <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Deployment Options:</h4>
                <div className="text-sm text-gray-700 space-y-1">
                  <p><strong>1. Validate XML:</strong> Check configuration syntax before deployment</p>
                  <p><strong>2. Deploy to Device:</strong> Apply configuration directly to running datastore</p>
                  <p><strong>3. Manual Copy:</strong> Copy XML for use in external NETCONF clients</p>
                  <p className="text-xs text-orange-600 mt-2">
                    ⚠️ Always validate configuration before deployment to avoid device issues
                  </p>
                </div>
              </div>
            </div>
          )}
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
    </div>
  );
};

export default NetconfManagement; 