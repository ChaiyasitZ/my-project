import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

function AuthCallback() {
  const { handleAuthCallback, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const processedRef = useRef(false);

  // Process OAuth callback tokens
  useEffect(() => {
    // Prevent duplicate processing (React Strict Mode calls useEffect twice)
    if (processedRef.current) return;
    processedRef.current = true;

    const processCallback = async () => {
      const token = searchParams.get('token');
      const refreshToken = searchParams.get('refreshToken');
      const error = searchParams.get('error');

      if (error) {
        toast.error(`Authentication failed: ${error.replace(/_/g, ' ')}`);
        navigate('/login', { replace: true });
        return;
      }

      if (token) {
        const success = await handleAuthCallback(token, refreshToken);
        if (!success) {
          toast.error('Failed to authenticate');
          navigate('/login', { replace: true });
        }
        // Don't navigate here — let the reactive effect below handle it
        // once isAuthenticated is actually true in React state
      } else {
        navigate('/login', { replace: true });
      }
    };

    processCallback();
  }, [searchParams, handleAuthCallback, navigate]);

  // Navigate to dashboard only after React state confirms authentication
  useEffect(() => {
    if (isAuthenticated && !loading) {
      toast.success('Welcome back!');
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, loading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Completing sign in...</p>
      </div>
    </div>
  );
}

export default AuthCallback;
