import { useState } from 'react';
import { Server, Router, Box } from 'lucide-react';

const DeviceIcon = ({ deviceType, layer, className = "h-6 w-6" }) => {
  const [imageError, setImageError] = useState(false);

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
      case 'nexus':
        return '/nexus-7000.svg';
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
      case 'nexus':
        return 'Cisco Nexus (NX-OS)';
      default:
        return 'Network Device';
    }
  };

  // Fallback to Lucide icons if SVG fails to load
  const getFallbackIcon = () => {
    const iconClass = className;
    switch (deviceType) {
      case 'router':
        return <Router className={iconClass} style={{ color: '#059669' }} />;
      case 'switch':
        return <Server className={iconClass} style={{ color: '#2563eb' }} />;
      case 'nexus':
        return <Box className={iconClass} style={{ color: '#7c3aed' }} />;
      default:
        return <Server className={iconClass} style={{ color: '#6b7280' }} />;
    }
  };

  if (imageError) {
    return getFallbackIcon();
  }

  return (
    <img
      src={getIconPath()}
      alt={getDeviceTitle()}
      title={getDeviceTitle()}
      className={className}
      onError={() => setImageError(true)}
      style={{
        filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))'
      }}
    />
  );
};

export default DeviceIcon; 