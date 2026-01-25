import { useState, useEffect } from 'react';

const ZOOM_KEY = 'app-zoom-level';
const MIN_ZOOM = 80;
const MAX_ZOOM = 120;
const ZOOM_STEP = 10;
const DEFAULT_ZOOM = 100;

/**
 * Hook to manage zoom level across the app
 */
export function useZoom() {
  const [zoom, setZoom] = useState(() => {
    const saved = localStorage.getItem(ZOOM_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_ZOOM;
  });

  useEffect(() => {
    // Apply zoom to root element
    document.documentElement.style.fontSize = `${zoom}%`;
    localStorage.setItem(ZOOM_KEY, zoom.toString());
  }, [zoom]);

  const zoomIn = () => {
    setZoom(prev => Math.min(prev + ZOOM_STEP, MAX_ZOOM));
  };

  const zoomOut = () => {
    setZoom(prev => Math.max(prev - ZOOM_STEP, MIN_ZOOM));
  };

  const resetZoom = () => {
    setZoom(DEFAULT_ZOOM);
  };

  return {
    zoom,
    zoomIn,
    zoomOut,
    resetZoom,
    canZoomIn: zoom < MAX_ZOOM,
    canZoomOut: zoom > MIN_ZOOM,
  };
}

export default useZoom;
