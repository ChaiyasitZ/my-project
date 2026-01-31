/**
 * YangModelSelector Component
 * Checkbox list for selecting YANG models for configuration generation
 */
import React, { memo } from 'react';
import { getCategoryColor } from '../../utils/yangParser';

/**
 * YANG Model Selector
 * @param {Object} props - Component props
 * @param {Array} props.yangModels - List of available YANG models
 * @param {Array} props.selectedModels - Currently selected model IDs
 * @param {Function} props.onToggleModel - Handler for toggling model selection
 * @param {Function} props.onClearAll - Handler for clearing all selections
 */
const YangModelSelector = memo(({
  yangModels,
  selectedModels,
  onToggleModel,
  onClearAll
}) => {
  if (yangModels.length === 0) {
    return null;
  }

  /**
   * Get device type badge class
   */
  const getDeviceTypeBadge = (deviceType) => {
    switch (deviceType) {
      case 'nexus':
        return 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300';
      case 'ios-xe':
        return 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300';
      case 'ios-xr':
        return 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        YANG Models for Generation
        <span className="text-xs font-normal text-gray-500 ml-2">
          (optional - for accurate XML)
        </span>
      </label>
      
      {/* Model List */}
      <div className="border rounded-lg dark:border-gray-600 max-h-32 overflow-y-auto">
        {yangModels.map((model) => {
          const modelId = model.id || model._id;
          const isSelected = selectedModels.includes(modelId);
          
          return (
            <label 
              key={modelId} 
              className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b last:border-b-0 dark:border-gray-600"
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleModel(modelId)}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {/* Model Name */}
                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {model.name}
                  </span>
                  
                  {/* Device Type Badge */}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${getDeviceTypeBadge(model.device_type)}`}>
                    {model.device_type?.toUpperCase() || 'ALL'}
                  </span>
                  
                  {/* Category Badge */}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${getCategoryColor(model.category)}`}>
                    {model.category}
                  </span>
                </div>
              </div>
            </label>
          );
        })}
      </div>
      
      {/* Selection Summary */}
      {selectedModels.length > 0 && (
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-purple-600 dark:text-purple-400">
            {selectedModels.length} model(s) selected
          </span>
          <button
            type="button"
            onClick={onClearAll}
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
});

YangModelSelector.displayName = 'YangModelSelector';

export default YangModelSelector;
