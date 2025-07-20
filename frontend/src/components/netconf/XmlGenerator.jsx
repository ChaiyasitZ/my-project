import React, { useState } from 'react';
import { 
  CodeBracketIcon, 
  CloudArrowUpIcon,
  CommandLineIcon,
  ClipboardDocumentIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ServerIcon
} from '@heroicons/react/24/outline';
import { useDeployment } from '../../hooks/useDeployment';
import { useConfirmation } from '../../hooks/useConfirmation';
import ConfirmationModal from '../ConfirmationModal';

const XmlGenerator = ({ 
  devices, 
  yangModels, 
  activeSessions, 
  selectedDevice, 
  selectedYangModel,
  onDeviceSelect,
  onYangModelSelect 
}) => {
  const [xmlPrompt, setXmlPrompt] = useState('');
  const [selectedSession, setSelectedSession] = useState('');
  const [deploymentStatus, setDeploymentStatus] = useState(null);
  
  const {
    loading,
    deployingXml,
    deployResult,
    generatedXml,
    generateNetconfXml,
    validateXmlConfiguration,
    deployXmlToNexusDevice,
    quickDeploy,
    setGeneratedXml,
    setDeployResult
  } = useDeployment();

  const { confirmationState, showConfirmation } = useConfirmation();

  const nexusExamples = [
    {
      category: "🔌 Interface",
      prompt: "Configure interface Ethernet1/1 as access port for VLAN 100 with description 'Server-01' and enable CDP"
    },
    {
      category: "🏗️ VLAN",
      prompt: "Create VLAN 200 named 'Production-Web' and assign interfaces Ethernet1/5-10 as trunk with native VLAN 1"
    }
  ];

  const deleteExamples = [
    {
      category: "🗑️ Remove Interface",
      prompt: "Delete interface Ethernet1/10 configuration and remove all VLAN assignments from this interface"
    },
    {
      category: "🗑️ Remove VLAN",
      prompt: "Delete VLAN 150 and remove all interface assignments associated with this VLAN"
    }
  ];

  const handleGenerateXml = async () => {
    await generateNetconfXml(xmlPrompt, selectedDevice, selectedYangModel);
    
    // Auto-scroll to generated XML section
    setTimeout(() => {
      const xmlSection = document.querySelector('[data-xml-output]');
      if (xmlSection) {
        xmlSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 500);
  };

  const handleQuickDeploy = async (mode) => {
    const sessionSelect = document.getElementById('quickDeploySession');
    const sessionId = sessionSelect.value;
    
    if (!sessionId) {
      return;
    }
    
    const result = await quickDeploy(xmlPrompt, selectedDevice, selectedYangModel, sessionId, mode, activeSessions);
    
    if (result.success) {
      // Auto-scroll to result
      setTimeout(() => {
        const resultSection = document.querySelector('[data-xml-output]');
        if (resultSection) {
          resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 500);
    }
  };

  const handleValidateAndGenerate = async () => {
    const sessionSelect = document.getElementById('quickDeploySession');
    const sessionId = sessionSelect.value;
    
    if (!sessionId) {
      return;
    }
    
    // First generate XML
    const generateResult = await generateNetconfXml(xmlPrompt, selectedDevice, selectedYangModel);
    
    if (generateResult.success) {
      // Then validate
      await validateXmlConfiguration(sessionId, generateResult.xml, activeSessions);
    }
  };

  const handleDeployConfiguration = async (deployMode = 'safe') => {
    if (!selectedSession || !generatedXml) {
      return;
    }

    const session = activeSessions.find(s => s.sessionId === selectedSession);
    if (!session) {
      return;
    }

    const confirmed = await showConfirmation({
      title: 'Deploy NETCONF Configuration',
      message: `Are you sure you want to deploy this XML configuration to ${session.ip_address}?\n\nDeployment Mode: ${deployMode === 'safe' ? 'Safe Deploy (Candidate)' : deployMode === 'stage' ? 'Stage Only' : 'Direct to Running'}\n\nThis action will modify the device configuration.`,
      confirmText: 'Deploy',
      cancelText: 'Cancel',
      type: 'warning'
    });

    if (!confirmed) return;

    // Configure deployment options based on mode
    let deployOptions = {
      device_type: 'cisco_nexus_9000v',
      mode: deployMode
    };
    
    switch (deployMode) {
      case 'safe':
        deployOptions = {
          ...deployOptions,
          datastore: 'candidate',
          validate: true,
          commit: true,
          rollback_on_error: true,
          confirmed_commit: true,
          persist_config: true,
          backup_config: true
        };
        break;
      case 'stage':
        deployOptions = {
          ...deployOptions,
          datastore: 'candidate',
          validate: true,
          commit: false,
          rollback_on_error: true
        };
        break;
      case 'direct':
        deployOptions = {
          ...deployOptions,
          datastore: 'running',
          validate: true,
          commit: true,
          rollback_on_error: true
        };
        break;
    }

    const result = await deployXmlToNexusDevice(selectedSession, generatedXml, deployOptions, activeSessions);
    
    if (result.success) {
      setDeploymentStatus({
        success: true,
        message: `Configuration deployed successfully to ${session.ip_address}`,
        mode: deployMode,
        timestamp: new Date().toISOString()
      });
    } else {
      setDeploymentStatus({
        success: false,
        message: result.result?.message || 'Deployment failed',
        error: result.result?.error,
        timestamp: new Date().toISOString()
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* XML Generator Form */}
        <div className="card p-6">
          <div className="flex items-center mb-4">
            <CodeBracketIcon className="h-6 w-6 text-blue-600 mr-2" />
            <h2 className="text-lg font-medium text-gray-900">NETCONF XML Generator</h2>
          </div>
          <p className="text-sm text-gray-600 mb-6">
            Generate NETCONF XML configurations using natural language prompts.
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
                    onDeviceSelect(device || null);
                  }}
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
                  onChange={(e) => {
                    const model = yangModels.find(m => m.id === e.target.value);
                    onYangModelSelect(model || null);
                  }}
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
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Configuration Prompt
              </label>
              <textarea
                value={xmlPrompt}
                onChange={(e) => setXmlPrompt(e.target.value)}
                placeholder="Describe the configuration you want to generate..."
                className="input"
                rows="4"
                required
                minLength="10"
              />
            </div>
            
            <button
              onClick={handleGenerateXml}
              disabled={loading || !xmlPrompt.trim() || xmlPrompt.length < 10}
              className="btn btn-primary btn-md w-full"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Generating XML...
                </>
              ) : (
                <>
                  <CodeBracketIcon className="h-4 w-4 mr-2" />
                  Generate NETCONF XML
                </>
              )}
            </button>
            
            {/* Quick Generate & Deploy Buttons */}
            {activeSessions.length > 0 && !loading && xmlPrompt.trim() && xmlPrompt.length >= 10 && (
              <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 mb-3">
                  Quick Deploy to Active Sessions
                </h4>
                
                <div className="space-y-3">
                  <select
                    id="quickDeploySession"
                    className="input"
                  >
                    <option value="">Select session...</option>
                    {activeSessions.map((session) => (
                      <option key={session.sessionId} value={session.sessionId}>
                        {session.ip_address} ({session.sessionId})
                      </option>
                    ))}
                  </select>
                  
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleQuickDeploy('safe')}
                      disabled={loading}
                      className="btn btn-success btn-sm flex-1"
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Deploying...
                        </>
                      ) : (
                        <>
                          <CloudArrowUpIcon className="h-4 w-4 mr-2" />
                          Generate & Deploy
                        </>
                      )}
                    </button>
                    
                    <button
                      onClick={handleValidateAndGenerate}
                      disabled={loading}
                      className="btn btn-secondary btn-sm"
                      title="Generate XML and validate against target device"
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Validating...
                        </>
                      ) : (
                        <>
                          <CommandLineIcon className="h-4 w-4 mr-2" />
                          Generate & Validate
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Example Prompts */}
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Example Prompts:</h3>
            <div className="space-y-2">
              {nexusExamples.map((example, index) => (
                <button
                  key={index}
                  onClick={() => setXmlPrompt(example.prompt)}
                  className="text-left text-sm text-blue-600 hover:text-blue-800 block"
                >
                  • {example.prompt}
                </button>
              ))}
              {deleteExamples.map((example, index) => (
                <button
                  key={`delete-${index}`}
                  onClick={() => setXmlPrompt(example.prompt)}
                  className="text-left text-sm text-blue-600 hover:text-blue-800 block"
                >
                  • {example.prompt}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Configuration Preview */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">Configuration Preview</h2>
            {generatedXml && (
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generatedXml);
                  }}
                  className="btn btn-secondary btn-sm"
                >
                  <ClipboardDocumentIcon className="h-4 w-4 mr-2" />
                  Copy XML
                </button>
                <button
                  onClick={() => {
                    setXmlPrompt('');
                    setGeneratedXml('');
                  }}
                  className="btn btn-secondary btn-sm"
                >
                  Generate New
                </button>
              </div>
            )}
          </div>

          {/* No Configuration Display */}
          {!generatedXml && (
            <div className="text-center py-12">
              <CodeBracketIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No XML configuration generated yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Enter a prompt and click "Generate NETCONF XML" to get started
              </p>
            </div>
          )}

          {/* Generated XML Display */}
          {generatedXml && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center">
                  <CheckCircleIcon className="h-5 w-5 text-green-600 mr-2" />
                  <span className="text-green-800 text-sm">
                    Configuration Valid
                  </span>
                </div>
              </div>
              
              {/* Deployment Result Display */}
              {(deployResult || deploymentStatus) && (
                <div className={`p-4 rounded-lg border ${
                  (deployResult?.success || deploymentStatus?.success) 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {(deployResult?.success || deploymentStatus?.success) ? (
                        <CheckCircleIcon className="h-5 w-5 text-green-500" />
                      ) : (
                        <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
                      )}
                      <span className={
                        (deployResult?.success || deploymentStatus?.success) 
                          ? 'text-green-800' 
                          : 'text-red-800'
                      }>
                        {deploymentStatus?.message || deployResult?.message || 'Deployment completed'}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setDeployResult(null);
                        setDeploymentStatus(null);
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      ×
                    </button>
                  </div>
                  {(deploymentStatus?.error || deployResult?.error) && (
                    <div className="mt-2 text-sm text-red-600">
                      Error: {deploymentStatus?.error || deployResult?.error}
                    </div>
                  )}
                </div>
              )}
              
              <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">
                  {generatedXml}
                </pre>
              </div>
              
              {/* Deployment Controls */}
              {activeSessions.length > 0 && (
                <div className="border-t border-gray-200 pt-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">
                    Deploy Configuration
                  </h4>
                  
                  <div className="space-y-3">
                    {/* Session Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Target Session
                      </label>
                      <select
                        value={selectedSession}
                        onChange={(e) => setSelectedSession(e.target.value)}
                        className="input"
                      >
                        <option value="">Select NETCONF session...</option>
                        {activeSessions.map((session) => (
                          <option key={session.sessionId} value={session.sessionId}>
                            {session.ip_address} ({session.sessionId})
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    {/* Deployment Options */}
                    {selectedSession && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <button
                          onClick={() => handleDeployConfiguration('safe')}
                          disabled={deployingXml}
                          className="btn btn-success btn-sm"
                        >
                          {deployingXml ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Deploying...
                            </>
                          ) : (
                            <>
                              <CloudArrowUpIcon className="h-4 w-4 mr-2" />
                              Safe Deploy
                            </>
                          )}
                        </button>
                        
                        <button
                          onClick={() => handleDeployConfiguration('stage')}
                          disabled={deployingXml}
                          className="btn btn-warning btn-sm"
                        >
                          {deployingXml ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Staging...
                            </>
                          ) : (
                            <>
                              <ServerIcon className="h-4 w-4 mr-2" />
                              Stage Only
                            </>
                          )}
                        </button>
                        
                        <button
                          onClick={() => handleDeployConfiguration('direct')}
                          disabled={deployingXml}
                          className="btn btn-danger btn-sm"
                        >
                          {deployingXml ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Deploying...
                            </>
                          ) : (
                            <>
                              <CommandLineIcon className="h-4 w-4 mr-2" />
                              Direct Deploy
                            </>
                          )}
                        </button>
                      </div>
                    )}
                    
                    {/* Deployment Mode Info */}
                    <div className="text-xs text-gray-500 space-y-1">
                      <p><strong>Safe Deploy:</strong> Uses candidate datastore with validation and commit</p>
                      <p><strong>Stage Only:</strong> Stages configuration without committing</p>
                      <p><strong>Direct Deploy:</strong> Deploys directly to running configuration</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Deployment Summary */}
              {(deployResult || deploymentStatus) && (
                <div className="border-t border-gray-200 pt-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      Last Deployment: {deploymentStatus?.mode || deployResult?.operation} 
                    </span>
                    <span className="text-gray-500">
                      {deploymentStatus?.timestamp 
                        ? new Date(deploymentStatus.timestamp).toLocaleTimeString() 
                        : 'Just now'}
                    </span>
                  </div>
                </div>
              )}

              <div className="text-xs text-gray-500">
                Generated: Just now
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
};

export default XmlGenerator; 