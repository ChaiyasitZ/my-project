import { AlertTriangleIcon } from 'lucide-react';

function PageLayout({ 
  title, 
  subtitle, 
  actions,
  children, 
  showAlert = false, 
  alertType = 'info', 
  alertMessage = '',
  alertAction = null 
}) {
  const alertStyles = {
    info: 'bg-blue-50 border-blue-200 text-blue-700',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-700', 
    error: 'bg-red-50 border-red-200 text-red-700',
    success: 'bg-green-50 border-green-200 text-green-700'
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
          {subtitle && (
            <p className="mt-2 text-gray-600">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex space-x-3">
            {actions}
          </div>
        )}
      </div>

      {/* Alert Banner */}
      {showAlert && (
        <div className={`card p-4 border ${alertStyles[alertType]}`}>
          <div className="flex items-start">
            <AlertTriangleIcon className="h-5 w-5 mt-0.5 mr-3 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">{alertMessage}</p>
              {alertAction && (
                <div className="mt-3">
                  {alertAction}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Page Content */}
      <div className="space-y-6">
        {children}
      </div>
    </div>
  );
}

export default PageLayout; 