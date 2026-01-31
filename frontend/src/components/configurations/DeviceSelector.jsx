/**
 * DeviceSelector Component
 * Dropdown component for selecting target devices
 */
import React, { memo, useMemo } from 'react';
import { ChevronDownIcon } from 'lucide-react';
import DeviceIcon from '../DeviceIcon';

/**
 * Device Selector Dropdown
 * @param {Object} props - Component props
 * @param {Array} props.devices - List of available devices
 * @param {string} props.selectedDevice - Currently selected device ID
 * @param {boolean} props.showDropdown - Whether dropdown is visible
 * @param {Function} props.onToggleDropdown - Toggle dropdown visibility
 * @param {Function} props.onSelectDevice - Handle device selection
 * @param {Function} props.onClearSelection - Clear current selection
 * @param {React.Ref} props.dropdownRef - Ref for click outside detection
 */
const DeviceSelector = memo(({
  devices,
  selectedDevice,
  showDropdown,
  onToggleDropdown,
  onSelectDevice,
  onClearSelection,
  dropdownRef
}) => {
  // Memoize selected device object
  const selectedDeviceObj = useMemo(() => {
    return devices.find(d => (d.id || d._id) === selectedDevice);
  }, [devices, selectedDevice]);

  /**
   * Get status color for device badge
   */
  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 dark:bg-green-900/50';
      case 'inactive':
        return 'bg-red-100 dark:bg-red-900/50';
      default:
        return 'bg-amber-100 dark:bg-amber-900/50';
    }
  };

  /**
   * Get status icon color
   */
  const getStatusIconColor = (status) => {
    switch (status) {
      case 'active':
        return 'text-green-600 dark:text-green-400';
      case 'inactive':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-amber-600 dark:text-amber-400';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={onToggleDropdown}
        className="input w-full text-left flex items-center justify-between"
      >
        {selectedDeviceObj ? (
          <div className="flex items-center gap-3">
            <DeviceIcon 
              deviceType={selectedDeviceObj.type} 
              layer={selectedDeviceObj.layer}
              className="h-5 w-5 text-gray-600 dark:text-gray-400"
            />
            <span>
              {selectedDeviceObj.name} 
              <span className="text-gray-500 dark:text-gray-400 ml-1">
                ({selectedDeviceObj.type})
              </span>
              <span className="text-gray-400 ml-1">
                - {selectedDeviceObj.ip_address}
              </span>
            </span>
          </div>
        ) : (
          <span className="text-gray-500 dark:text-gray-400">Choose a device...</span>
        )}
        <ChevronDownIcon 
          className={`h-5 w-5 text-gray-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} 
        />
      </button>
      
      {/* Dropdown List */}
      {showDropdown && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-64 overflow-y-auto">
          {/* Clear Selection Option */}
          <div 
            className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700"
            onClick={onClearSelection}
          >
            Choose a device...
          </div>
          
          {/* Device List */}
          {devices.map((device) => {
            const deviceId = device.id || device._id;
            const isSelected = selectedDevice === deviceId;
            
            return (
              <div
                key={deviceId}
                className={`px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer flex items-center gap-3 transition-colors ${
                  isSelected ? 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500' : ''
                }`}
                onClick={() => onSelectDevice(deviceId)}
              >
                {/* Device Icon */}
                <div className={`p-1.5 rounded-lg ${getStatusColor(device.status)}`}>
                  <DeviceIcon 
                    deviceType={device.type} 
                    layer={device.layer}
                    className={`h-5 w-5 ${getStatusIconColor(device.status)}`}
                  />
                </div>
                
                {/* Device Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 dark:text-white truncate">
                    {device.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {device.type}
                    {device.layer ? ` (${device.layer === 'layer-2' ? 'L2' : 'L3'})` : ''} 
                    • {device.ip_address}
                  </div>
                </div>
                
                {/* Status Indicator */}
                {device.status === 'active' && (
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                )}
              </div>
            );
          })}
          
          {/* Empty State */}
          {devices.length === 0 && (
            <div className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
              No devices available
            </div>
          )}
        </div>
      )}
      
      {/* Hidden input for form validation */}
      <input type="hidden" value={selectedDevice} required />
    </div>
  );
});

DeviceSelector.displayName = 'DeviceSelector';

export default DeviceSelector;
