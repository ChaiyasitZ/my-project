import React, { useState } from 'react';
import { 
  DocumentTextIcon, 
  PlusIcon,
  ArrowPathIcon,
  EyeIcon,
  CogIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClipboardDocumentIcon,
  CloudArrowUpIcon,
  CommandLineIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const API_BASE_URL = 'http://localhost:3001/api';

const YangModelManager = ({ 
  yangModels, 
  loading, 
  onRefresh, 
  onModelSelect 
}) => {
  const [showYangUploadForm, setShowYangUploadForm] = useState(false);
  const [uploadMethod, setUploadMethod] = useState('file');
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

  // Filter models
  const filteredYangModels = yangModels.filter(model => {
    const matchesFilter = modelFilter === 'all' || model.vendor === modelFilter;
    const matchesSearch = !searchTerm || 
      model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      model.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      model.vendor.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesFilter && matchesSearch;
  });

  // File handling
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
      await processYangFile(files[0]);
    }
  };

  const processYangFile = async (file) => {
    if (!file.name.endsWith('.yang')) {
      toast.error('Please select a .yang file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setYangFile(file);
    setYangValidation(null);
    
    try {
      const content = await file.text();
      
      // Parse YANG content
      const moduleMatch = content.match(/module\s+([a-zA-Z0-9_-]+)\s*{/);
      const submoduleMatch = content.match(/submodule\s+([a-zA-Z0-9_-]+)\s*{/);
      const namespaceMatch = content.match(/namespace\s+"([^"]+)"/);
      const prefixMatch = content.match(/prefix\s+([a-zA-Z0-9_-]+)/);
      const revisionMatch = content.match(/revision\s+([0-9]{4}-[0-9]{2}-[0-9]{2})/);
      const organizationMatch = content.match(/organization\s+"([^"]+)"/);
      const contactMatch = content.match(/contact\s+"([^"]+)"/);
      const descriptionMatch = content.match(/description\s+"([^"]+)"/);

      // Auto-detect vendor and category
      let detectedVendor = 'custom';
      const namespace = namespaceMatch ? namespaceMatch[1] : '';
      const organization = organizationMatch ? organizationMatch[1] : '';
      
      if (namespace.includes('ietf') || organization.toLowerCase().includes('ietf')) {
        detectedVendor = 'ietf';
      } else if (namespace.includes('cisco') || organization.toLowerCase().includes('cisco')) {
        detectedVendor = 'cisco';
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
        category: 'other'
      };

      setNewYangModel(extractedModel);
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

    if (!model.name) errors.push('Model name is required');
    if (!model.namespace) errors.push('Namespace is required');
    if (!model.prefix) errors.push('Prefix is required');
    if (!model.yang_content) errors.push('YANG content is required');

    if (model.revision && !/^\d{4}-\d{2}-\d{2}$/.test(model.revision)) {
      errors.push('Revision must be in YYYY-MM-DD format');
    }

    if (model.yang_content) {
      const content = model.yang_content;
      
      if (!content.includes('module') && !content.includes('submodule')) {
        errors.push('YANG content must contain a module or submodule');
      }
      
      const openBraces = (content.match(/{/g) || []).length;
      const closeBraces = (content.match(/}/g) || []).length;
      if (openBraces !== closeBraces) {
        errors.push('Unbalanced braces in YANG content');
      }
      
      if (!content.includes('organization')) {
        warnings.push('Organization information is missing');
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

    if (yangValidation && !yangValidation.isValid) {
      toast.error('Please fix validation errors before uploading');
      return;
    }

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
        onRefresh();
      } else {
        toast.error(`Failed to upload YANG model: ${data.message}`, { id: toastId });
      }
    } catch (error) {
      console.error('Error uploading YANG model:', error);
      toast.error('Failed to upload YANG model: ' + error.message, { id: toastId });
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
    setEditingModel(null);
  };

  const deleteYangModel = async (modelId) => {
    const toastId = toast.loading('Deleting YANG model...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/netconf/yang-models/${modelId}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        toast.success('YANG model deleted successfully!', { id: toastId });
        onRefresh();
      } else {
        toast.error(data.message || 'Failed to delete model', { id: toastId });
      }
    } catch (error) {
      console.error('Error deleting YANG model:', error);
      toast.error('Failed to delete YANG model: ' + error.message, { id: toastId });
    }
  };

  return (
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
              onClick={onRefresh}
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
              <option value="custom">Custom</option>
            </select>
          </div>
        </div>

        {/* Models List */}
        {filteredYangModels.length === 0 ? (
          <div className="text-center py-12">
            <DocumentTextIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || modelFilter !== 'all' ? 'No models match your filter' : 'No YANG models found'}
            </h3>
            <p className="text-gray-500 mb-4">
              Upload YANG models to see them here
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
                        'badge-secondary'
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
                      onClick={() => setPreviewModel(model)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                      title="Preview model"
                    >
                      <EyeIcon className="h-4 w-4" />
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
                </div>
                
                <div className="mt-3 flex space-x-2">
                  <button
                    onClick={() => onModelSelect(model)}
                    className="btn btn-primary btn-sm flex-1"
                  >
                    <CheckCircleIcon className="h-4 w-4 mr-2" />
                    Select
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
              <span className="font-medium">Vendors:</span>
              <span className="ml-2">{[...new Set(yangModels.map(m => m.vendor))].length}</span>
            </div>
            <div>
              <span className="font-medium">Categories:</span>
              <span className="ml-2">{[...new Set(yangModels.map(m => m.category))].length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Form Modal */}
      {showYangUploadForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full m-4 max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-medium text-gray-900">
                {editingModel ? 'Edit YANG Model' : 'Add New YANG Model'}
              </h3>
              <button
                onClick={resetYangForm}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[80vh]">
              {/* Upload method selection */}
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
                      <CogIcon className="h-4 w-4 mr-2 inline" />
                      Create Manual Model
                    </button>
                  </div>
                </div>
              )}

              {/* File upload section */}
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
                          className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500"
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

              {/* Form fields (simplified for brevity) */}
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
                  </select>
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
                      <ul className="text-sm text-red-700 space-y-1">
                        {yangValidation.errors.map((error, index) => (
                          <li key={index}>• {error}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {/* Form Actions */}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={resetYangForm}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={uploadYangModel}
                  disabled={yangValidation && !yangValidation.isValid}
                  className="btn btn-primary btn-sm"
                >
                  <CloudArrowUpIcon className="h-4 w-4 mr-2" />
                  Upload Model
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
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
            
            <div className="p-4 overflow-y-auto max-h-[80vh]">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Model Information</h4>
                  <div className="space-y-1 text-sm">
                    <div><span className="font-medium">Name:</span> {previewModel.name}</div>
                    <div><span className="font-medium">Namespace:</span> {previewModel.namespace}</div>
                    <div><span className="font-medium">Prefix:</span> {previewModel.prefix}</div>
                    <div><span className="font-medium">Revision:</span> {previewModel.revision}</div>
                    <div><span className="font-medium">Vendor:</span> {previewModel.vendor}</div>
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Additional Details</h4>
                  <div className="space-y-1 text-sm">
                    <div><span className="font-medium">Organization:</span> {previewModel.organization || 'N/A'}</div>
                    <div><span className="font-medium">Description:</span> {previewModel.description || 'N/A'}</div>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">YANG Content</h4>
                <div className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto max-h-96">
                  <pre className="text-sm font-mono whitespace-pre-wrap">
                    {previewModel.yang_content || 'Content not available'}
                  </pre>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 p-4 border-t">
              <button
                onClick={() => {
                  if (previewModel.yang_content) {
                    navigator.clipboard.writeText(previewModel.yang_content);
                    toast.success('YANG content copied to clipboard!');
                  }
                }}
                className="btn btn-secondary btn-sm"
              >
                <ClipboardDocumentIcon className="h-4 w-4 mr-2" />
                Copy Content
              </button>
              <button
                onClick={() => onModelSelect(previewModel)}
                className="btn btn-primary btn-sm"
              >
                <CheckCircleIcon className="h-4 w-4 mr-2" />
                Select Model
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default YangModelManager; 