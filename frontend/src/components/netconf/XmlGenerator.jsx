import React, { useState } from 'react';
import { 
  CodeBracketIcon, 
  CloudArrowUpIcon,
  CommandLineIcon,
  ClipboardDocumentIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { useDeployment } from '../../hooks/useDeployment';

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
  
  const {
    loading,
    deployingXml,
    deployResult,
    generatedXml,
    showSuccessAnimation,
    generateNetconfXml,
    validateXmlConfiguration,
    deployXmlToNexusDevice,
    quickDeploy,
    setDeployResult,
    setGeneratedXml,
    setShowSuccessAnimation
  } = useDeployment();

  const nexusExamples = [
    {
      category: "🔌 Interface",
      prompt: "Configure interface Ethernet1/1 as access port for VLAN 100 with description 'Server-01' and enable CDP"
    },
    {
      category: "🏗️ VLAN",
      prompt: "Create VLAN 200 named 'Production-Web' and assign interfaces Ethernet1/5-10 as trunk with native VLAN 1"
    },
    {
      category: "📡 L3",
      prompt: "Configure SVI interface VLAN 100 with IP 192.168.100.1/24 and enable HSRP group 1 priority 110"
    },
    {
      category: "🔗 Port-Channel",
      prompt: "Create port-channel 10 with interfaces Ethernet1/15-16 using LACP mode active for server uplink"
    }
  ];

  const advancedExamples = [
    {
      category: "🌐 VRF",
      prompt: "Configure VRF 'TENANT-A' with route-distinguisher 65001:100 and import/export route-targets"
    },
    {
      category: "🔄 BGP",
      prompt: "Configure BGP AS 65001 with EVPN address-family and neighbor 10.1.1.2 for spine connection"
    },
    {
      category: "🛡️ Security",
      prompt: "Create ACL 'WEB-SERVERS' permitting HTTP/HTTPS from subnet 10.0.0.0/24 to web VLAN"
    },
    {
      category: "📊 QoS",
      prompt: "Configure QoS policy 'DATACENTER-QOS' with voice priority and data best-effort classes"
    }
  ];

  const nexusSpecificExamples = [
    {
      category: "🔧 NX-API",
      prompt: "Enable NX-API with HTTPS server, certificate authentication and sandbox access"
    },
    {
      category: "🐍 Python",
      prompt: "Configure Python scripting environment and enable EEM for automation scripts"
    },
    {
      category: "📡 VXLAN",
      prompt: "Configure VXLAN VTEP with loopback0 source and VLAN-to-VNI mapping for overlay network"
    },
    {
      category: "🏢 Fabric",
      prompt: "Configure EVPN fabric with spine-leaf topology and BGP route-reflector settings"
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

  return (
    <div className="space-y-6">
      {/* XML Generator Form */}
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
                  onDeviceSelect(device || null);
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
                  onYangModelSelect(model || null);
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
            onClick={handleGenerateXml}
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
          
          {/* Quick Generate & Deploy Buttons */}
          {activeSessions.length > 0 && !loading && xmlPrompt.trim() && xmlPrompt.length >= 10 && (
            <div className="mt-4 p-4 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg">
              <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                <span className="bg-green-600 text-white px-2 py-1 rounded-full text-xs font-semibold mr-2">
                  QUICK DEPLOY
                </span>
                Generate & Deploy to Nexus in One Step
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    🎯 Target Nexus Device
                  </label>
                  <select
                    id="quickDeploySession"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  >
                    <option value="">Select Nexus session...</option>
                    {activeSessions.map((session) => (
                      <option key={session.sessionId} value={session.sessionId}>
                        🚀 {session.ip_address} (ID: {session.sessionId})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    📋 Deployment Mode
                  </label>
                  <select
                    id="quickDeployMode"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                    defaultValue="safe"
                  >
                    <option value="safe">🛡️ Safe Deploy (Candidate + Validate)</option>
                    <option value="stage">📝 Stage Only (No Commit)</option>
                    <option value="direct">⚡ Direct Deploy (Running Config)</option>
                  </select>
                </div>
              </div>
              
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => {
                    const modeSelect = document.getElementById('quickDeployMode');
                    handleQuickDeploy(modeSelect.value);
                  }}
                  disabled={loading}
                  className="btn btn-success btn-md flex-1"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Generating & Deploying...
                    </>
                  ) : (
                    <>
                      <CloudArrowUpIcon className="h-4 w-4 mr-2" />
                      🚀 Generate & Deploy
                    </>
                  )}
                </button>
                
                <button
                  onClick={handleValidateAndGenerate}
                  disabled={loading}
                  className="btn btn-warning btn-md"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Validating...
                    </>
                  ) : (
                    <>
                      <CommandLineIcon className="h-4 w-4 mr-2" />
                      🔍 Generate & Validate
                    </>
                  )}
                </button>
              </div>
              
              <div className="mt-3 text-xs text-gray-600 bg-blue-50 p-2 rounded">
                <strong>💡 Quick Deploy Modes:</strong> 
                <span className="ml-1">Safe Deploy = Full validation + confirmed commit + backup | Stage Only = Load to candidate for review | Direct Deploy = Immediate apply to running config</span>
              </div>
            </div>
          )}
          
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
        <h3 className="text-lg font-medium text-gray-900 mb-4">🔧 Cisco Nexus 9000v Datacenter Configuration Examples</h3>
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-semibold mr-2">
                NEXUS 9000v
              </span>
              Basic Datacenter Operations
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {nexusExamples.map((example, index) => (
                <button
                  key={index}
                  onClick={() => setXmlPrompt(example.prompt)}
                  className="text-left p-4 hover:bg-blue-50 rounded-lg border border-blue-200 transition-colors"
                >
                  <div className="text-xs font-medium text-blue-600 mb-1">{example.category}</div>
                  <div className="text-sm text-gray-700">{example.prompt}</div>
                </button>
              ))}
            </div>
          </div>
          
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
              <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs font-semibold mr-2">
                DATACENTER
              </span>
              Advanced Datacenter Features
            </h4>
            <div className="space-y-2">
              {advancedExamples.map((example, index) => (
                <button
                  key={`advanced-${index}`}
                  onClick={() => setXmlPrompt(example.prompt)}
                  className="text-left w-full p-3 hover:bg-purple-50 rounded-lg border border-purple-200 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-medium text-purple-600">{example.category}</span>
                      <div className="text-sm text-gray-700 mt-1">{example.prompt}</div>
                    </div>
                    <span className="text-purple-400 text-xs">Click to use</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Nexus 9000v Specific Features */}
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900 flex items-center">
              <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-semibold mr-2">
                NEXUS 9000v
              </span>
              Nexus 9000v Specific Features (Click to expand)
            </summary>
            <div className="mt-3 space-y-2">
              {nexusSpecificExamples.map((example, index) => (
                <button
                  key={`nexus-${index}`}
                  onClick={() => setXmlPrompt(example.prompt)}
                  className="text-left w-full p-3 hover:bg-green-50 rounded-lg border border-green-200 transition-colors"
                >
                  <span className="text-xs font-medium text-green-600">{example.category}</span>
                  <div className="text-sm text-gray-700 mt-1">🚀 {example.prompt}</div>
                </button>
              ))}
            </div>
          </details>
        </div>
      </div>

      {/* Generated XML Display */}
      {generatedXml && (
        <div className="card p-6" data-xml-output>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-medium text-gray-900">Generated NETCONF XML for Nexus 9000v</h3>
              {showSuccessAnimation && (
                <div className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm animate-pulse">
                  <CheckCircleIcon className="h-4 w-4" />
                  <span className="font-medium">XML Ready for Deployment</span>
                </div>
              )}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generatedXml);
                  // Add toast notification here if needed
                }}
                className="btn btn-secondary btn-sm"
              >
                <ClipboardDocumentIcon className="h-4 w-4 mr-2" />
                Copy XML
              </button>
              <button
                onClick={() => {
                  setGeneratedXml('');
                  setShowSuccessAnimation(false);
                  setDeployResult(null);
                }}
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
                ✅ XML generated successfully for Cisco Nexus 9000v! Ready for datacenter deployment.
              </span>
            </div>
          </div>
          
          <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto max-h-96 text-sm font-mono">
            <code>{generatedXml}</code>
          </pre>
        </div>
      )}

      {/* Deploy Result Display */}
      {deployResult && (
        <div className={`card p-6 border-l-4 ${
          deployResult.success 
            ? 'bg-green-50 border-green-400' 
            : 'bg-red-50 border-red-400'
        }`}>
          <div className="flex items-start">
            {deployResult.success ? (
              <CheckCircleIcon className="h-6 w-6 text-green-600 mr-3 mt-0.5" />
            ) : (
              <ExclamationTriangleIcon className="h-6 w-6 text-red-600 mr-3 mt-0.5" />
            )}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <h4 className={`text-lg font-medium ${
                  deployResult.success ? 'text-green-900' : 'text-red-900'
                }`}>
                  {deployResult.success ? 
                    (deployResult.mode ? '🎉 Quick Deploy Successful!' : 
                     deployResult.validated && !deployResult.committed ? '✅ XML Generated & Validated!' :
                     '🎉 Nexus 9000v Deployment Successful!') : 
                    '❌ Nexus 9000v Operation Failed'}
                </h4>
                <button
                  onClick={() => setDeployResult(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              
              <p className={`text-sm mb-4 ${
                deployResult.success ? 'text-green-800' : 'text-red-800'
              }`}>
                {deployResult.message}
              </p>

              {/* Show deployment details */}
              {deployResult.success && deployResult.session && (
                <div className="bg-white p-4 rounded-lg border border-green-300 shadow-sm">
                  <h5 className="text-sm font-medium text-green-900 mb-3">
                    📋 Deployment Summary
                  </h5>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="bg-green-50 p-3 rounded">
                      <div className="font-medium text-green-900">🎯 Target Device</div>
                      <div className="text-green-700 mt-1">{deployResult.session}</div>
                    </div>
                    <div className="bg-blue-50 p-3 rounded">
                      <div className="font-medium text-blue-900">💾 Status</div>
                      <div className="text-blue-700 mt-1">
                        {deployResult.committed ? '💾 Committed' : '📝 Staged'}
                      </div>
                    </div>
                    {deployResult.mode && (
                      <div className="bg-purple-50 p-3 rounded">
                        <div className="font-medium text-purple-900">🚀 Deploy Mode</div>
                        <div className="text-purple-700 mt-1">
                          {deployResult.mode === 'safe' ? '🛡️ Safe Deploy' :
                           deployResult.mode === 'stage' ? '📝 Stage Only' : '⚡ Direct Deploy'}
                        </div>
                      </div>
                    )}
                    <div className="bg-yellow-50 p-3 rounded">
                      <div className="font-medium text-yellow-900">🔍 Validation</div>
                      <div className="text-yellow-700 mt-1">
                        {deployResult.validated ? '✅ Passed' : '⚠️ Skipped'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default XmlGenerator; 