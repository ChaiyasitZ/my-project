import { AlertTriangleIcon, CheckCircleIcon, XCircleIcon, InfoIcon } from 'lucide-react';
import { useEffect } from 'react';

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
  // Manage modal body class
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    
    // Cleanup on unmount
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [isOpen]);

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

  return (
    <div className="modal-overlay fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Backdrop */}
        <div 
          className="modal-overlay fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={handleCancel}
        ></div>

        {/* Modal */}
        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
          <div className="sm:flex sm:items-start">
            {/* Icon */}
            <div className={`mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full ${styles.iconBg} sm:mx-0 sm:h-10 sm:w-10`}>
              {styles.icon}
            </div>
            
            {/* Content */}
            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
              <h3 className={`text-lg leading-6 font-medium ${styles.titleColor}`}>
                {title}
              </h3>
              <div className="mt-2">
                <p className="text-sm text-gray-500 whitespace-pre-line">
                  {message}
                </p>
              </div>
            </div>
          </div>
          
          {/* Actions */}
          <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className={`btn btn-md w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed ${getConfirmButtonClass(type)}`}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {loadingText}
                </>
              ) : (
                confirmText
              )}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              className="btn btn-secondary btn-md w-full sm:w-auto mt-3 sm:mt-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cancelText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConfirmationModal; 