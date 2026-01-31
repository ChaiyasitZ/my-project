/**
 * ConfigModeToggle Component
 * Toggle between CLI and NETCONF/YANG configuration modes
 */
import React, { memo } from 'react';
import { Code as CodeIcon, Network as NetworkIcon } from 'lucide-react';

/**
 * Configuration Mode Toggle
 * @param {Object} props - Component props
 * @param {'cli' | 'netconf'} props.configMode - Current configuration mode
 * @param {Function} props.onModeChange - Handler for mode change
 */
const ConfigModeToggle = memo(({ configMode, onModeChange }) => {
  return (
    <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
      {/* CLI Mode Button */}
      <button
        onClick={() => onModeChange('cli')}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
          configMode === 'cli' 
            ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-blue-100 dark:ring-blue-800' 
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
        }`}
        aria-pressed={configMode === 'cli'}
      >
        <CodeIcon className="h-4 w-4" />
        CLI
      </button>
      
      {/* NETCONF/YANG Mode Button */}
      <button
        onClick={() => onModeChange('netconf')}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
          configMode === 'netconf' 
            ? 'bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-400 shadow-sm ring-1 ring-purple-100 dark:ring-purple-800' 
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
        }`}
        aria-pressed={configMode === 'netconf'}
      >
        <NetworkIcon className="h-4 w-4" />
        NETCONF/YANG
      </button>
    </div>
  );
});

ConfigModeToggle.displayName = 'ConfigModeToggle';

export default ConfigModeToggle;
