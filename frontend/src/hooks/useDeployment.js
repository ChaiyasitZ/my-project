import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';

const API_BASE_URL = 'http://localhost:3001/api';

export const useDeployment = () => {
  const [loading, setLoading] = useState(false);
  const [deployingXml, setDeployingXml] = useState(false);
  const [deployResult, setDeployResult] = useState(null);
  const [generatedXml, setGeneratedXml] = useState('');
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);

  // Generate NETCONF XML
  const generateNetconfXml = useCallback(async (xmlPrompt, selectedDevice, selectedYangModel) => {
    if (!xmlPrompt.trim()) {
      toast.error('Please enter a prompt for XML generation');
      return { success: false };
    }

    if (xmlPrompt.length < 10) {
      toast.error('Prompt must be at least 10 characters long');
      return { success: false };
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
        setShowSuccessAnimation(true);
        
        const xmlLength = data.data.generated_xml.length;
        const lineCount = data.data.generated_xml.split('\n').length;
        
        toast.success(
          `🎉 NETCONF XML Generated Successfully!\n` +
          `📄 ${lineCount} lines of XML configuration\n` +
          `📊 ${Math.round(xmlLength / 1024 * 10) / 10} KB generated\n` +
          `✅ Ready for validation and deployment`,
          { 
            id: toastId,
            duration: 4000,
            style: {
              background: '#10B981',
              color: 'white',
              fontWeight: '500'
            }
          }
        );
        
        setTimeout(() => {
          setShowSuccessAnimation(false);
        }, 3000);
        
        return { success: true, xml: data.data.generated_xml };
      } else {
        toast.error(`Failed to generate XML: ${data.message}`, { id: toastId });
        return { success: false, error: data.message };
      }
    } catch (error) {
      console.error('Error generating XML:', error);
      toast.error('Failed to generate XML: ' + error.message, { id: toastId });
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, []);

  // Validate XML configuration
  const validateXmlConfiguration = useCallback(async (sessionId, xmlConfig, activeSessions) => {
    if (!sessionId || !xmlConfig) {
      toast.error('Please select a session and ensure XML is generated');
      return { success: false };
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
          validated: true,
          session: activeSessions.find(s => s.sessionId === sessionId)?.ip_address
        });
        return { success: true, details: data.details };
      } else {
        toast.error(`Validation failed: ${data.message}`, { id: toastId });
        setDeployResult({
          success: false,
          message: data.message,
          error: data.error,
          validated: false
        });
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error('Error validating XML:', error);
      toast.error('Failed to validate XML: ' + error.message, { id: toastId });
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, []);

  // Deploy XML to Nexus device
  const deployXmlToNexusDevice = useCallback(async (sessionId, xmlConfig, options = {}, activeSessions) => {
    if (!sessionId || !xmlConfig) {
      toast.error('Please select a session and ensure XML is generated');
      return { success: false };
    }

    const session = activeSessions.find(s => s.sessionId === sessionId);
    if (!session) {
      toast.error('Selected session not found');
      return { success: false };
    }

    setDeployingXml(true);
    setDeployResult(null);
    const toastId = toast.loading(`🚀 Deploying to Nexus ${session.ip_address}...`);
    
    try {
      const response = await fetch(`${API_BASE_URL}/netconf/deploy-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          xml_config: xmlConfig,
          ...options
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        const result = {
          success: true,
          message: data.message,
          details: data.data.deployment_result,
          session: session.ip_address,
          datastore: options.datastore,
          committed: data.data.committed,
          validated: data.data.validated,
          mode: options.mode
        };
        
        setDeployResult(result);
        
        toast.success(
          `🎉 Nexus Configuration Deployed!\n` +
          `📍 Device: ${session.ip_address}\n` +
          `💾 Datastore: ${options.datastore}\n` +
          `✅ Status: ${data.data.committed ? 'Committed' : 'Staged'}`,
          { 
            id: toastId,
            duration: 5000,
            style: {
              background: '#059669',
              color: 'white',
              fontWeight: '500'
            }
          }
        );
        
        return { success: true, result };
      } else {
        const result = {
          success: false,
          message: data.message,
          error: data.error,
          session: session.ip_address,
          datastore: options.datastore
        };
        
        setDeployResult(result);
        toast.error(`❌ Nexus Deployment Failed: ${data.message}`, { id: toastId });
        return { success: false, result };
      }
    } catch (error) {
      console.error('Error deploying XML to Nexus:', error);
      const result = {
        success: false,
        message: 'Network error occurred',
        error: error.message,
        session: session.ip_address
      };
      
      setDeployResult(result);
      toast.error('Failed to deploy to Nexus: ' + error.message, { id: toastId });
      return { success: false, result };
    } finally {
      setDeployingXml(false);
    }
  }, []);

  // Quick deploy (generate + deploy in one step)
  const quickDeploy = useCallback(async (xmlPrompt, selectedDevice, selectedYangModel, sessionId, mode, activeSessions) => {
    if (!sessionId) {
      toast.error('Please select a Nexus session first');
      return { success: false };
    }

    setLoading(true);
    const toastId = toast.loading('🚀 Generating XML and deploying to Nexus...');
    
    try {
      // First generate XML
      const generateResult = await generateNetconfXml(xmlPrompt, selectedDevice, selectedYangModel);
      
      if (!generateResult.success) {
        return generateResult;
      }

      // Configure deployment options based on mode
      let deployOptions = {
        device_type: 'cisco_nexus_9000v',
        mode: mode
      };
      
      switch (mode) {
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
      
      // Deploy the configuration
      toast.loading('📡 Deploying configuration to Nexus...', { id: toastId });
      
      const deployResult = await deployXmlToNexusDevice(sessionId, generateResult.xml, deployOptions, activeSessions);
      
      if (deployResult.success) {
        const session = activeSessions.find(s => s.sessionId === sessionId);
        
        toast.success(
          `🎉 XML Generated & Deployed Successfully!\n` +
          `📍 Device: ${session.ip_address}\n` +
          `💾 Mode: ${mode === 'safe' ? 'Safe Deploy' : mode === 'stage' ? 'Staged' : 'Direct'}\n` +
          `✅ Status: ${deployResult.result.committed ? 'Committed' : 'Staged'}`,
          { 
            id: toastId,
            duration: 6000,
            style: {
              background: '#059669',
              color: 'white',
              fontWeight: '500'
            }
          }
        );
        
        return { success: true, xml: generateResult.xml, deployResult: deployResult.result };
      } else {
        toast.error(`❌ Deployment Failed: ${deployResult.result.message}`, { id: toastId });
        return { success: false, error: deployResult.result.message };
      }
      
    } catch (error) {
      console.error('Error in quick deploy:', error);
      toast.error('Failed to generate & deploy: ' + error.message, { id: toastId });
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, [generateNetconfXml, deployXmlToNexusDevice]);

  return {
    // State
    loading,
    deployingXml,
    deployResult,
    generatedXml,
    showSuccessAnimation,
    
    // Actions
    generateNetconfXml,
    validateXmlConfiguration,
    deployXmlToNexusDevice,
    quickDeploy,
    
    // Setters
    setDeployResult,
    setGeneratedXml,
    setShowSuccessAnimation
  };
};

export default useDeployment; 