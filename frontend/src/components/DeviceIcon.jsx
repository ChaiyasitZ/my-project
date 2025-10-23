import React from 'react';

const DeviceIcon = ({ deviceType, layer, className = "h-6 w-6" }) => {
  const getIconPath = () => {
    switch (deviceType) {
      case 'router':
        return '/router.svg';
      case 'switch':
        if (layer === 'layer-2') {
          return '/layer-2-switch.svg';
        } else if (layer === 'layer-3') {
          return '/layer-3-switch.svg';
        }
        // Default to layer-2 if no layer specified
        return '/layer-2-switch.svg';
      default:
        return '/layer-2-switch.svg'; // Default fallback
    }
  };

  const getDeviceTitle = () => {
    switch (deviceType) {
      case 'router':
        return 'Router';
      case 'switch':
        if (layer === 'layer-2') {
          return 'Layer 2 Switch';
        } else if (layer === 'layer-3') {
          return 'Layer 3 Switch';
        }
        return 'Switch';
      default:
        return 'Network Device';
    }
  };

  return (
    <img
      src={getIconPath()}
      alt={getDeviceTitle()}
      title={getDeviceTitle()}
      className={className}
      style={{
        filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))'
      }}
    />
  );
};

export default DeviceIcon; 