/**
 * useConfigGeneration Hook
 * Manages configuration generation, deployment, and related state
 */
import { useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { generateNetconfWorkflowXml } from '../../utils/yangParser';
import { detectLanguage } from '../../utils/translationUtils';
import { validateConfigPrompt, getValidationErrorMessage } from '../../utils/promptValidator';

/**
 * Custom hook for configuration generation and deployment
 * @param {Function} showConfirmation - Confirmation dialog function
 * @returns {Object} Configuration generation state and handlers
 */
export const useConfigGeneration = (showConfirmation) => {
  // Form state
  const [prompt, setPrompt] = useState('');
  const [promptLanguage, setPromptLanguage] = useState('en');
  const [isTranslating, setIsTranslating] = useState(false);
  const [configMode, setConfigMode] = useState('cli'); // 'cli' or 'netconf'
  
  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState(null);
  const [showConfigProgressModal, setShowConfigProgressModal] = useState(false);
  
  // Configuration state
  const [generatedConfig, setGeneratedConfig] = useState(null);
  const [validation, setValidation] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedConfig, setEditedConfig] = useState('');
  
  // Deployment state
  const [isApplying, setIsApplying] = useState(false);
  const [validateBeforeApply, setValidateBeforeApply] = useState(true);

  /**
   * Detect language when prompt changes
   */
  const handlePromptChange = useCallback((newPrompt) => {
    setPrompt(newPrompt);
    const detected = detectLanguage(newPrompt);
    setPromptLanguage(detected);
  }, []);

  /**
   * Handle prompt translation between languages using backend LLM
   */
  const handleTranslatePrompt = useCallback(async () => {
    if (!prompt.trim() || isTranslating) return;
    
    setIsTranslating(true);
    const from = promptLanguage;
    const to = promptLanguage === 'en' ? 'th' : 'en';
    const langNames = { en: 'English', th: 'ไทย' };
    
    try {
      const response = await axios.post('/configurations/translate', {
        text: prompt,
        from,
        to
      });
      
      if (response.data.success && response.data.translatedText) {
        setPrompt(response.data.translatedText);
        setPromptLanguage(to);
        toast.success(`Translated to ${langNames[to]}`);
      } else {
        toast.error('Translation failed');
      }
    } catch (error) {
      console.error('Translation error:', error);
      toast.error(error.response?.data?.message || 'Translation failed');
    } finally {
      setIsTranslating(false);
    }
  }, [prompt, promptLanguage, isTranslating]);

  /**
   * Generate configuration from prompt
   */
  const handleGenerateConfiguration = useCallback(async (e, selectedDevice, selectedYangModelsForGen = []) => {
    e.preventDefault();
    if (!selectedDevice || !prompt) return;

    // Validate that the prompt is about network configuration
    const validation = validateConfigPrompt(prompt);
    if (!validation.isValid) {
      const errorMessage = getValidationErrorMessage(validation);
      setGenerationError(errorMessage);
      toast.error('Please enter a valid network configuration prompt', { duration: 5000 });
      
      // Show suggestions in a separate toast
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
    
    try {
      const requestData = {
        device_id: selectedDevice,
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

      if (response.data.configuration) {
        console.log('📥 Received configuration:', response.data.configuration);
        
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
        throw new Error(response.data.error || 'No configuration generated');
      }
    } catch (error) {
      console.error('❌ Error generating configuration:', error);
      
      let errorMessage = '';
      let showSuggestions = false;
      
      if (error.response?.status === 503) {
        errorMessage = 'AI Service Unavailable - Please check if the AI server is running';
        showSuggestions = true;
      } else if (error.response?.status === 400) {
        const errorData = error.response.data;
        
        if (errorData.details) {
          const details = errorData.details.map(d => d.message).join(', ');
          errorMessage = `Validation Error: ${details}`;
        } else if (errorData.error?.includes('ObjectId')) {
          errorMessage = 'Invalid device selection. Please refresh the page and try again.';
        } else if (errorData.message?.includes('AI generation failed')) {
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
      
      setGenerationError(errorMessage);
      
      if (showSuggestions && error.response?.data?.suggestions) {
        const suggestions = error.response.data.suggestions.join('\n• ');
        toast.error(`${errorMessage}\n\nSuggestions:\n• ${suggestions}`, { duration: 8000 });
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, configMode]);

  /**
   * Apply/deploy configuration to device
   */
  const handleApplyConfiguration = useCallback(async () => {
    if (!generatedConfig) return;

    const isNetconf = generatedConfig.config_type === 'netconf-yang';
    const modeLabel = isNetconf ? 'NETCONF' : 'SSH';

    let statusNotes = '';
    if (isNetconf && validateBeforeApply) {
      statusNotes += '\n\n✓ Validation will run before applying.';
    }

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
      const endpoint = isNetconf 
        ? '/configurations/netconf/apply' 
        : '/configurations/apply';

      const configId = generatedConfig.id || generatedConfig._id;
      if (!configId) {
        throw new Error('Configuration ID is missing - please regenerate the configuration');
      }

      const requestPayload = {
        configuration_id: String(configId),
        validate_before_apply: isNetconf ? validateBeforeApply : false,
        mock_deploy: false
      };

      const response = await axios.post(endpoint, requestPayload);

      const isMock = response.data?.mock === true;
      const deploymentTimeSeconds = response.data?.deployment_time_seconds || 
        (response.data?.deployment_time_ms ? (response.data.deployment_time_ms / 1000).toFixed(2) : null);
      
      setGeneratedConfig({
        ...generatedConfig,
        status: 'deployed',
        deployment_time: response.data?.deployment_time,
        mock_deployment: isMock
      });
      
      const successMessage = deploymentTimeSeconds 
        ? `Configuration deployed successfully in ${deploymentTimeSeconds}s!` 
        : `Configuration deployed successfully!`;
      
      toast.success(successMessage, { id: toastId, duration: 5000 });
    } catch (error) {
      console.error('Error applying configuration:', error);
      
      const responseData = error.response?.data;
      const userFriendlyMsg = responseData?.message || 'Deployment failed';
      const actualError = responseData?.error || error.message;
      
      let errorMsg = userFriendlyMsg;
      if (actualError && actualError !== userFriendlyMsg) {
        errorMsg += `\n\nDetails: ${actualError}`;
      }
      
      toast.error(errorMsg, { id: toastId, duration: 10000 });
    } finally {
      setIsApplying(false);
    }
  }, [generatedConfig, validateBeforeApply, showConfirmation]);

  /**
   * Reset the generation form
   */
  const resetForm = useCallback(() => {
    setPrompt('');
    setPromptLanguage('en');
    setGeneratedConfig(null);
    setValidation(null);
    setIsEditing(false);
    setEditedConfig('');
    setGenerationError(null);
  }, []);

  /**
   * Toggle config editing mode
   */
  const toggleEditing = useCallback(() => {
    if (isEditing) {
      // Save edits
      setGeneratedConfig(prev => ({
        ...prev,
        generated_config: editedConfig
      }));
    }
    setIsEditing(!isEditing);
  }, [isEditing, editedConfig]);

  /**
   * Get display configuration with NETCONF workflow
   */
  const displayConfig = useMemo(() => {
    if (generatedConfig?.config_type === 'netconf-yang') {
      return generateNetconfWorkflowXml(generatedConfig?.generated_config, validateBeforeApply);
    }
    return generatedConfig?.generated_config;
  }, [generatedConfig, validateBeforeApply]);

  /**
   * Get validation status utilities
   */
  const getValidationColor = useCallback((isValid) => {
    return isValid ? 'text-green-600' : 'text-red-600';
  }, []);

  const getValidationIcon = useCallback((isValid) => {
    return isValid ? 'check' : 'error';
  }, []);

  return {
    // Form state
    prompt,
    promptLanguage,
    isTranslating,
    configMode,
    
    // Generation state
    isGenerating,
    generationError,
    showConfigProgressModal,
    
    // Configuration state
    generatedConfig,
    validation,
    isEditing,
    editedConfig,
    displayConfig,
    
    // Deployment state
    isApplying,
    validateBeforeApply,
    
    // Setters
    setPrompt: handlePromptChange,
    setConfigMode,
    setShowConfigProgressModal,
    setEditedConfig,
    setValidateBeforeApply,
    setGeneratedConfig,
    
    // Actions
    handleTranslatePrompt,
    handleGenerateConfiguration,
    handleApplyConfiguration,
    resetForm,
    toggleEditing,
    
    // Utilities
    getValidationColor,
    getValidationIcon,
  };
};

export default useConfigGeneration;
