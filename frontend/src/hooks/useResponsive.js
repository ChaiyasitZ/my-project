import { useState, useEffect } from 'react';

/**
 * Hook to get responsive values based on screen size
 * Targets: Notebook (1366x768), Desktop (1920x1080), Mac Retina (various)
 */
export function useResponsive() {
  const [screenSize, setScreenSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1920,
    height: typeof window !== 'undefined' ? window.innerHeight : 1080,
  });

  useEffect(() => {
    const handleResize = () => {
      setScreenSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Determine device type based on screen dimensions
  const getDeviceType = () => {
    const { width, height } = screenSize;
    
    // Notebook/Laptop: typically 1366x768 or similar
    if (height <= 800) return 'notebook';
    
    // Desktop: typically 1920x1080
    if (height <= 1100) return 'desktop';
    
    // Mac Retina / Large monitors: > 1100px height
    return 'large';
  };

  // Get items per page based on screen height
  const getItemsPerPage = (type = 'default') => {
    const deviceType = getDeviceType();
    
    const itemsConfig = {
      // For list views (devices, history) - odd numbers
      list: {
        notebook: 3,
        desktop: 5,
        large: 7,
      },
      // For grid views (backups - 3 columns) - multiples of 3 that look balanced
      grid: {
        notebook: 3,  // 1 row x 3 cols
        desktop: 6,   // 2 rows x 3 cols
        large: 9,     // 3 rows x 3 cols
      },
      // For dashboard device grid
      dashboard: {
        notebook: 8,
        desktop: 12,
        large: 16,
      },
      default: {
        notebook: 4,
        desktop: 5,
        large: 6,
      }
    };

    return itemsConfig[type]?.[deviceType] || itemsConfig.default[deviceType];
  };

  // Get spacing classes based on screen size
  const getSpacing = () => {
    const deviceType = getDeviceType();
    
    return {
      gap: deviceType === 'notebook' ? 'gap-1' : deviceType === 'desktop' ? 'gap-1.5' : 'gap-2',
      padding: deviceType === 'notebook' ? 'p-2' : deviceType === 'desktop' ? 'p-3' : 'p-4',
      margin: deviceType === 'notebook' ? 'space-y-3' : deviceType === 'desktop' ? 'space-y-4' : 'space-y-5',
    };
  };

  return {
    screenSize,
    deviceType: getDeviceType(),
    getItemsPerPage,
    getSpacing,
    isNotebook: getDeviceType() === 'notebook',
    isDesktop: getDeviceType() === 'desktop',
    isLarge: getDeviceType() === 'large',
  };
}

export default useResponsive;
