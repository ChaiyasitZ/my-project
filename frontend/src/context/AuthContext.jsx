import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Get token from localStorage
  const getToken = () => localStorage.getItem('authToken');
  const getRefreshToken = () => localStorage.getItem('refreshToken');

  // Set auth header for axios
  const setAuthHeader = (token) => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  };

  // Fetch current user
  const fetchUser = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return null;
    }

    try {
      setAuthHeader(token);
      const response = await axios.get('/auth/me');
      if (response.data.success) {
        setUser(response.data.user);
        return response.data.user;
      }
    } catch (err) {
      console.error('Failed to fetch user:', err);
      
      // Try to refresh token if expired
      if (err.response?.status === 401 && err.response?.data?.code === 'TOKEN_EXPIRED') {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          return fetchUser();
        }
      }
      
      // Clear auth state on error
      logout();
    } finally {
      setLoading(false);
    }
    return null;
  }, []);

  // Refresh access token
  const refreshAccessToken = async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;

    try {
      const response = await axios.post('/auth/refresh', { refreshToken });
      if (response.data.success) {
        localStorage.setItem('authToken', response.data.token);
        localStorage.setItem('refreshToken', response.data.refreshToken);
        setAuthHeader(response.data.token);
        return true;
      }
    } catch (err) {
      console.error('Token refresh failed:', err);
    }
    return false;
  };

  // Login with Google (redirect)
  const loginWithGoogle = () => {
    const apiBaseUrl = axios.defaults.baseURL || '';
    window.location.href = `${apiBaseUrl}/auth/google`;
  };

  // Handle OAuth callback
  const handleAuthCallback = async (token, refreshToken) => {
    if (token) {
      localStorage.setItem('authToken', token);
      if (refreshToken) {
        localStorage.setItem('refreshToken', refreshToken);
      }
      setAuthHeader(token);
      await fetchUser();
      return true;
    }
    return false;
  };

  // Logout
  const logout = useCallback(async () => {
    try {
      const token = getToken();
      if (token) {
        await axios.post('/auth/logout');
      }
    } catch (err) {
      // Ignore logout errors
    } finally {
      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
      setAuthHeader(null);
      setUser(null);
    }
  }, []);

  // Update user preferences
  const updatePreferences = async (preferences) => {
    try {
      const response = await axios.put('/auth/preferences', preferences);
      if (response.data.success) {
        setUser(response.data.user);
        return response.data.user;
      }
    } catch (err) {
      console.error('Failed to update preferences:', err);
      throw err;
    }
  };

  // Check if authenticated
  const isAuthenticated = !!user;

  // Check if admin
  const isAdmin = user?.role === 'admin';

  // Initialize auth state on mount
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Setup axios interceptor for token refresh
  useEffect(() => {
    // Guard against axios not being properly configured (e.g., in tests)
    if (!axios.interceptors?.response) {
      return;
    }
    
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        
        if (
          error.response?.status === 401 &&
          error.response?.data?.code === 'TOKEN_EXPIRED' &&
          !originalRequest._retry
        ) {
          originalRequest._retry = true;
          const refreshed = await refreshAccessToken();
          
          if (refreshed) {
            const token = getToken();
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            return axios(originalRequest);
          }
        }
        
        return Promise.reject(error);
      }
    );

    return () => {
      if (axios.interceptors?.response) {
        axios.interceptors.response.eject(interceptor);
      }
    };
  }, []);

  const value = {
    user,
    loading,
    error,
    isAuthenticated,
    isAdmin,
    loginWithGoogle,
    handleAuthCallback,
    logout,
    fetchUser,
    updatePreferences,
    getToken
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
