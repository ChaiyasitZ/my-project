import { AlertTriangleIcon, CheckCircleIcon, XCircleIcon, InfoIcon, X } from 'lucide-react';
import { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

function ConfirmationModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = 'Confirm', 
  cancelText = 'Cancel', 
  type = 'warning', // 'warning', 'danger', 'info', 'success'
  loading = false,
  loadingText = 'Processing...'
}) {
  // Handle ESC key
  const handleEscape = useCallback((e) => {
    if (e.key === 'Escape' && !loading) {
      onClose();
    }
  }, [onClose, loading]);

  // Manage modal body class and keyboard events
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('modal-open');
      document.addEventListener('keydown', handleEscape);
    } else {
      document.body.classList.remove('modal-open');
      document.removeEventListener('keydown', handleEscape);
    }
    
    // Cleanup on unmount
    return () => {
      document.body.classList.remove('modal-open');
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  const getTypeStyles = () => {
    switch (type) {
      case 'danger':
        return {
          icon: <XCircleIcon className="h-6 w-6 text-red-600" />,
          iconBg: 'bg-red-100',
          titleColor: 'text-red-900'
        };
      case 'success':
        return {
          icon: <CheckCircleIcon className="h-6 w-6 text-green-600" />,
          iconBg: 'bg-green-100',
          titleColor: 'text-green-900'
        };
      case 'info':
        return {
          icon: <InfoIcon className="h-6 w-6 text-blue-600" />,
          iconBg: 'bg-blue-100',
          titleColor: 'text-blue-900'
        };
      default: // warning
        return {
          icon: <AlertTriangleIcon className="h-6 w-6 text-yellow-600" />,
          iconBg: 'bg-yellow-100',
          titleColor: 'text-yellow-900'
        };
    }
  };

  const getConfirmButtonClass = (modalType) => {
    switch (modalType) {
      case 'danger':
        return 'btn-danger';
      case 'success':
        return 'btn-success';
      case 'info':
        return 'btn-info';
      default: // warning
        return 'btn-warning';
    }
  };

  const styles = getTypeStyles();

  const handleConfirm = () => {
    if (loading) return;
    onConfirm();
  };

  const handleCancel = () => {
    if (loading) return;
    onClose();
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !loading) {
      onClose();
    }
  };

  return createPortal(
    <div 
      className="fixed inset-0 z-50 overflow-y-auto overlay-scrollbar"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
    >
      {/* Backdrop - separate from content container */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ease-out"
        aria-hidden="true"
        onClick={handleBackdropClick}
      ></div>

      {/* Modal container */}
      <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
        {/* Modal */}
        <div className="relative bg-white rounded-xl px-6 pt-6 pb-4 text-left overflow-hidden shadow-2xl transform transition-all duration-300 ease-out max-w-lg w-full animate-in zoom-in-95 fade-in pointer-events-auto">
          {/* Close button */}
          <div className="absolute top-4 right-4">
            <button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              className="rounded-md bg-white text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="sm:flex sm:items-start">
            {/* Icon */}
            <div className={`mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full ${styles.iconBg} sm:mx-0 sm:h-10 sm:w-10 transition-all duration-200`}>
              {styles.icon}
            </div>
            
            {/* Content */}
            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
              <h3 
                id="modal-title"
                className={`text-lg leading-6 font-semibold ${styles.titleColor}`}
              >
                {title}
              </h3>
              <div className="mt-2">
                <p 
                  id="modal-description"
                  className="text-sm text-gray-600 whitespace-pre-line leading-relaxed"
                >
                  {message}
                </p>
              </div>
            </div>
          </div>
          
          {/* Actions */}
          <div className="mt-6 pt-4 border-t border-gray-100 sm:flex sm:flex-row-reverse sm:gap-3">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className={`btn btn-md w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 focus:scale-105 ${getConfirmButtonClass(type)}`}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  <span>{loadingText}</span>
                </>
              ) : (
                confirmText
              )}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              className="btn btn-secondary btn-md w-full sm:w-auto mt-3 sm:mt-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 focus:scale-105"
            >
              {cancelText}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default ConfirmationModal; 