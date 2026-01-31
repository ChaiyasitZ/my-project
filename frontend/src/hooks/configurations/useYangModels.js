/**
 * useYangModels Hook
 * Manages YANG model CRUD operations and UI state
 */
import { useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { parseYangFile, getCategoryColor, detectDeviceType, detectCategory } from '../../utils/yangParser';
import { INITIAL_YANG_FORM_DATA, INITIAL_YANG_TEMPLATE, INITIAL_YANG_PATH } from '../../constants/configurationConstants';

/**
 * Custom hook for managing YANG models
 * @param {Function} showConfirmation - Confirmation dialog function
 * @returns {Object} YANG model state and handlers
 */
export const useYangModels = (showConfirmation) => {
  // YANG Models state
  const [yangModels, setYangModels] = useState([]);
  const [yangModelsLoading, setYangModelsLoading] = useState(false);
  const [selectedYangModelsForGen, setSelectedYangModelsForGen] = useState([]);
  const [yangSearchQuery, setYangSearchQuery] = useState('');
  const [selectedYangCategory, setSelectedYangCategory] = useState('all');
  
  // Modal states
  const [showYangUploadModal, setShowYangUploadModal] = useState(false);
  const [showYangDetailModal, setShowYangDetailModal] = useState(false);
  const [selectedYangModel, setSelectedYangModel] = useState(null);
  
  // Form state
  const [yangFormData, setYangFormData] = useState(INITIAL_YANG_FORM_DATA);
  const [yangTemplate, setYangTemplate] = useState(INITIAL_YANG_TEMPLATE);
  const [yangPath, setYangPath] = useState(INITIAL_YANG_PATH);

  /**
   * Fetch YANG models from API
   */
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

  /**
   * Reset YANG form to initial state
   */
  const resetYangForm = useCallback(() => {
    setYangFormData(INITIAL_YANG_FORM_DATA);
    setYangTemplate(INITIAL_YANG_TEMPLATE);
    setYangPath(INITIAL_YANG_PATH);
  }, []);

  /**
   * Handle YANG file upload and parsing
   */
  const handleYangFileUpload = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      if (typeof content !== 'string') return;

      const parsed = parseYangFile(content, file.name);
      
      setYangFormData({
        name: parsed.name,
        description: parsed.description,
        version: parsed.version,
        category: parsed.category,
        device_type: parsed.deviceType,
        yang_content: content,
      });
      
      setYangTemplate(parsed.template);
      setYangPath(parsed.path);
      
      toast.success(`YANG file parsed: ${parsed.name}`);
    };
    
    reader.onerror = () => {
      toast.error('Failed to read YANG file');
    };
    
    reader.readAsText(file);
  }, []);

  /**
   * Submit new YANG model
   */
  const handleYangModelSubmit = useCallback(async (e) => {
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
  }, [yangFormData, resetYangForm, fetchYangModels]);

  /**
   * Delete YANG model
   */
  const handleYangModelDelete = useCallback(async (id) => {
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
  }, [showConfirmation, fetchYangModels]);

  /**
   * View YANG model details
   */
  const handleViewYangModel = useCallback(async (id) => {
    try {
      const response = await axios.get(`/yang-models/${id}`);
      if (response.data.success) {
        setSelectedYangModel(response.data.yangModel);
        setShowYangDetailModal(true);
      }
    } catch (error) {
      toast.error('Failed to load YANG model details');
    }
  }, []);

  /**
   * Toggle YANG model selection for generation
   */
  const toggleYangModelForGen = useCallback((modelId) => {
    setSelectedYangModelsForGen(prev => 
      prev.includes(modelId) 
        ? prev.filter(id => id !== modelId) 
        : [...prev, modelId]
    );
  }, []);

  /**
   * Filter YANG models based on search and category
   */
  const filteredYangModels = useMemo(() => {
    return yangModels.filter(model => {
      const matchesSearch = !yangSearchQuery || 
        model.name?.toLowerCase().includes(yangSearchQuery.toLowerCase()) ||
        model.description?.toLowerCase().includes(yangSearchQuery.toLowerCase());
      
      const matchesCategory = selectedYangCategory === 'all' || 
        model.category === selectedYangCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [yangModels, yangSearchQuery, selectedYangCategory]);

  /**
   * Get unique categories from loaded YANG models
   */
  const yangCategories = useMemo(() => {
    const categories = new Set(yangModels.map(m => m.category).filter(Boolean));
    return ['all', ...Array.from(categories)];
  }, [yangModels]);

  return {
    // State
    yangModels,
    yangModelsLoading,
    selectedYangModelsForGen,
    yangSearchQuery,
    selectedYangCategory,
    showYangUploadModal,
    showYangDetailModal,
    selectedYangModel,
    yangFormData,
    yangTemplate,
    yangPath,
    filteredYangModels,
    yangCategories,
    
    // Actions
    fetchYangModels,
    resetYangForm,
    handleYangFileUpload,
    handleYangModelSubmit,
    handleYangModelDelete,
    handleViewYangModel,
    toggleYangModelForGen,
    setYangSearchQuery,
    setSelectedYangCategory,
    setShowYangUploadModal,
    setShowYangDetailModal,
    setSelectedYangModel,
    setYangFormData,
    setSelectedYangModelsForGen,
    
    // Utilities
    getCategoryColor,
  };
};

export default useYangModels;
