import { ZoomInIcon, ZoomOutIcon } from 'lucide-react';
import { useZoom } from '../hooks/useZoom';

function ZoomControls() {
  const { zoom, zoomIn, zoomOut, canZoomIn, canZoomOut } = useZoom();

  return (
    <div className="flex items-center gap-1 mr-2">
      <button
        onClick={zoomOut}
        disabled={!canZoomOut}
        className="p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 
                   hover:bg-gray-100 dark:hover:bg-gray-700 
                   disabled:opacity-40 disabled:cursor-not-allowed
                   text-gray-600 dark:text-gray-400 transition-colors"
        title="Zoom Out"
      >
        <ZoomOutIcon className="h-4 w-4" />
      </button>
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[36px] text-center">
        {zoom}%
      </span>
      <button
        onClick={zoomIn}
        disabled={!canZoomIn}
        className="p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 
                   hover:bg-gray-100 dark:hover:bg-gray-700 
                   disabled:opacity-40 disabled:cursor-not-allowed
                   text-gray-600 dark:text-gray-400 transition-colors"
        title="Zoom In"
      >
        <ZoomInIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

export default ZoomControls;
