/**
 * ConfigPreview Component
 * Displays generated configuration with edit and deploy options
 */
import React, { memo, useCallback } from 'react';
import { 
  BrainCircuit as BrainCircuitIcon, 
  Server as ServerIcon,
  CheckCircle as CheckCircleIcon
} from 'lucide-react';

/**
 * Configuration Preview Panel
 * @param {Object} props - Component props
 * @param {Object} props.generatedConfig - Generated configuration object
 * @param {Object} props.validation - Validation result object
 * @param {string} props.displayConfig - Configuration string to display
 * @param {boolean} props.isEditing - Whether in editing mode
 * @param {string} props.editedConfig - Current edited configuration
 * @param {boolean} props.isApplying - Whether deployment is in progress
 * @param {boolean} props.validateBeforeApply - Whether to validate before applying
 * @param {Function} props.onSetValidateBeforeApply - Toggle validate before apply
 * @param {Function} props.onApplyConfiguration - Handle apply/deploy
 * @param {Function} props.onStartEditing - Start editing mode
 * @param {Function} props.onSaveEdit - Save edited configuration
 * @param {Function} props.onCancelEdit - Cancel editing
 * @param {Function} props.onEditedConfigChange - Handle edit changes
 * @param {Function} props.onResetForm - Reset form to generate new
 */
const ConfigPreview = memo(({
  generatedConfig,
  validation,
  displayConfig,
  isEditing,
  editedConfig,
  isApplying,
  validateBeforeApply,
  onSetValidateBeforeApply,
  onApplyConfiguration,
  onStartEditing,
  onSaveEdit,
  onCancelEdit,
  onEditedConfigChange,
  onResetForm
}) => {
  /**
   * Get validation color based on validity
   */
  const getValidationColor = useCallback((isValid) => {
    return isValid ? 'text-green-600' : 'text-red-600';
  }, []);

  /**
   * Get validation icon based on validity
   */
  const getValidationIcon = useCallback((isValid) => {
    return (
      <CheckCircleIcon 
        className={`h-5 w-5 ${isValid ? 'text-green-600' : 'text-red-600'}`} 
      />
    );
  }, []);

  /**
   * Get status badge class
   */
  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'deployed':
        return 'badge-success';
      case 'failed':
        return 'badge-danger';
      default:
        return 'badge-info';
    }
  };

  return (
    <div className="card p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-medium text-gray-900 dark:text-white">
          Configuration Preview
        </h2>
        
        {/* Deploy Options */}
        {generatedConfig && generatedConfig.status === 'generated' && (
          <div className="flex items-center space-x-4">
            {/* NETCONF Validation Toggle */}
            {generatedConfig.config_type === 'netconf-yang' && (
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={validateBeforeApply}
                  onChange={(e) => onSetValidateBeforeApply(e.target.checked)}
                  className="h-4 w-4 text-purple-600 rounded border-gray-300 dark:border-gray-600 focus:ring-purple-500"
                />
                <span>Validate before apply</span>
              </label>
            )}
            
            {/* Deploy Button */}
            <button
              onClick={onApplyConfiguration}
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

      {/* Empty State */}
      {!generatedConfig && (
        <div className="text-center py-8">
          <BrainCircuitIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No configuration generated yet</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Select a device and enter a prompt to get started
          </p>
        </div>
      )}

      {/* Configuration Display */}
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
                <span className={`badge ${getStatusBadgeClass(generatedConfig.status)}`}>
                  {generatedConfig.status}
                </span>
              </div>
            </div>
            
            {/* Model & Timing Info */}
            <div className="mt-2 flex items-center flex-wrap text-xs text-gray-500 dark:text-gray-400">
              <BrainCircuitIcon className="h-3 w-3 mr-1" />
              <span>
                Generated with: <span className="font-mono font-medium">{generatedConfig.ai_model}</span>
              </span>
              {generatedConfig.execution_time && (
                <span className="ml-3 text-green-600 dark:text-green-400 font-medium">
                  • Generation: {(generatedConfig.execution_time / 1000).toFixed(2)}s
                </span>
              )}
              {generatedConfig.deployment_time && (
                <span className="ml-3 font-medium text-green-600 dark:text-green-400">
                  • Deploy: {(generatedConfig.deployment_time / 1000).toFixed(2)}s
                </span>
              )}
            </div>
          </div>

          {/* Validation Status */}
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
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Configuration
              </h3>
              <div className="flex space-x-2">
                {!isEditing ? (
                  <button
                    onClick={onStartEditing}
                    className="btn btn-secondary btn-sm"
                  >
                    Edit
                  </button>
                ) : (
                  <>
                    <button
                      onClick={onSaveEdit}
                      className="btn btn-primary btn-sm"
                    >
                      Save
                    </button>
                    <button
                      onClick={onCancelEdit}
                      className="btn btn-secondary btn-sm"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
            
            {/* Edit Mode */}
            {isEditing ? (
              <textarea
                value={editedConfig}
                onChange={(e) => onEditedConfigChange(e.target.value)}
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

          {/* Actions Footer */}
          <div className="flex justify-between">
            <button
              onClick={onResetForm}
              className="btn btn-secondary btn-sm"
            >
              Generate New
            </button>
            
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Generated: {generatedConfig.created_at 
                ? new Date(generatedConfig.created_at).toLocaleString() 
                : 'Just now'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

ConfigPreview.displayName = 'ConfigPreview';

export default ConfigPreview;
