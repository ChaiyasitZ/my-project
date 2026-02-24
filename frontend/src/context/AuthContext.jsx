import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

// Session key for detecting fresh browser/tab opens
const SESSION_KEY = 'app_session_active';

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
    // Ensure headers object exists (may be undefined in test environments)
    if (!axios.defaults.headers) {
      axios.defaults.headers = {};
    }
    if (!axios.defaults.headers.common) {
      axios.defaults.headers.common = {};
    }
    
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  };

  // Disconnect all NETCONF sessions
  const disconnectAllSessions = async () => {
    try {
      await axios.post('/devices/netconf/disconnect-all');
      console.log('🔌 All NETCONF sessions disconnected');
    } catch (err) {
      // Ignore errors - sessions may not exist
      console.log('No active NETCONF sessions to disconnect');
    }
  };

  // Check if this is a fresh session (new tab/window)
  const checkFreshSession = useCallback(async () => {
    const isSessionActive = sessionStorage.getItem(SESSION_KEY);
    
    if (!isSessionActive) {
      // Fresh session detected - clear auth and disconnect devices
      console.log('🔄 Fresh session detected - cleaning up...');
      
      // Clear auth tokens
      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
      setAuthHeader(null);
      setUser(null);
      
      // Disconnect all NETCONF sessions (try even without auth)
      try {
        await axios.post('/devices/netconf/disconnect-all');
      } catch (err) {
        // Ignore - may not have permission or sessions
      }
      
      // Mark session as active
      sessionStorage.setItem(SESSION_KEY, 'true');
      
      return true; // Was fresh session
    }
    
    return false; // Existing session
  }, []);

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
      
      // Only clear auth for authentication errors (401/403), not server errors (500/503)
      if (err.response?.status === 401 || err.response?.status === 403) {
        logout();
      }
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

  // Login with Google (redirect or Electron IPC)
  const loginWithGoogle = async () => {
    // Check if running in Electron
    if (window.electronAPI && window.electronAPI.loginWithGoogle) {
      try {
        const result = await window.electronAPI.loginWithGoogle();
        if (result.success && result.token) {
          localStorage.setItem('authToken', result.token);
          if (result.refreshToken) {
            localStorage.setItem('refreshToken', result.refreshToken);
          }
          setAuthHeader(result.token);
          await fetchUser();
          window.location.hash = '#/dashboard';
          return;
        }
      } catch (err) {
        console.error('Electron OAuth error:', err);
      }
      return;
    }
    
    // Standard browser redirect
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
      
      // Retry fetchUser up to 3 times for transient server errors (cold starts)
      for (let attempt = 1; attempt <= 3; attempt++) {
        const user = await fetchUser();
        if (user) return true;
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 1500 * attempt));
        }
      }
      return !!getToken(); // Still return true if token exists (user may load on next render)
    }
    return false;
  };

  // Logout
  const logout = useCallback(async () => {
    try {
      const token = getToken();
      if (token) {
        // Disconnect all NETCONF sessions first
        await disconnectAllSessions();
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
    const initAuth = async () => {
      // Check for fresh session first
      const wasFresh = await checkFreshSession();
      
      if (!wasFresh) {
        // Only fetch user if not a fresh session
        await fetchUser();
      } else {
        setLoading(false);
      }
    };
    
    initAuth();
  }, [fetchUser, checkFreshSession]);

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
