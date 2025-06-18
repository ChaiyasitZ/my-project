import { Link } from 'react-router-dom';
import { HomeIcon, ArrowLeftIcon } from 'lucide-react';

function NotFound() {
  return (
    <div className="min-h-96 flex items-center justify-center">
      <div className="text-center max-w-md mx-auto">
        <div className="mb-8">
          <h1 className="text-9xl font-bold text-gray-300">404</h1>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Page Not Found</h2>
          <p className="text-gray-600 mb-8">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>
        
        <div className="space-y-4">
          <Link
            to="/"
            className="btn btn-primary btn-md inline-flex items-center"
          >
            <HomeIcon className="h-4 w-4 mr-2" />
            Go to Dashboard
          </Link>
          
          <button
            onClick={() => window.history.back()}
            className="btn btn-secondary btn-md inline-flex items-center ml-4"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Go Back
          </button>
        </div>
        
        <div className="mt-8 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Need help? Check out these pages:
          </p>
          <div className="mt-3 space-x-4">
            <Link to="/devices" className="text-sm text-blue-600 hover:text-blue-500">
              Devices
            </Link>
            <Link to="/configurations" className="text-sm text-blue-600 hover:text-blue-500">
              Configurations
            </Link>
            <Link to="/history" className="text-sm text-blue-600 hover:text-blue-500">
              History
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NotFound; 