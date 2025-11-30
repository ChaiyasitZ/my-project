import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import axios from 'axios';

// Components
import Sidebar from './components/Sidebar';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';

// Context
import { AuthProvider, useAuth } from './context/AuthContext';

// Pages
import Dashboard from './pages/Dashboard';
import Devices from './pages/Devices';
import Configurations from './pages/Configurations';
import ConfigurationHistory from './pages/ConfigurationHistory';
import ConsoleConfiguration from './pages/ConsoleConfiguration';
import BackupManagement from './pages/BackupManagement';
import NotFound from './pages/NotFound';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';

import './App.css';

// API Configuration - Detect environment based on hostname
const isLocalhost = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1';

const API_BASE_URL = import.meta.env.VITE_API_URL || 
                     (isLocalhost ? 'http://localhost:3001/api' : '/api');

axios.defaults.baseURL = API_BASE_URL;

// Stagewise toolbar - only in development
const isDev = import.meta.env.DEV;

// Layout component for authenticated pages
function AuthenticatedLayout({ children, connectionStatus, sidebarCollapsed, onToggleSidebar }) {
  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950 w-full transition-colors duration-300">
      <Sidebar 
        connectionStatus={connectionStatus} 
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={onToggleSidebar}
      />
      
      {/* Main content area */}
      <div className="flex-1 lg:ml-0 w-full transition-all duration-300">
        <main className="pt-20 lg:pt-6 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

// Main App content with routing
function AppContent() {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  
  const [connectionStatus, setConnectionStatus] = useState({
    backend: 'checking',
    database: 'checking',
    version: null
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });
  const [StagewiseToolbar, setStagewiseToolbar] = useState(null);

  const handleToggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const newValue = !prev;
      localStorage.setItem('sidebarCollapsed', JSON.stringify(newValue));
      return newValue;
    });
  };

  useEffect(() => {
    if (isDev) {
      Promise.all([
        import('@stagewise/toolbar-react'),
        import('@stagewise-plugins/react')
      ]).then(([toolbar, plugin]) => {
        setStagewiseToolbar(() => toolbar.StagewiseToolbar);
        window.__stagewisePlugin = plugin.default;
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const checkConnectionStatus = async () => {
      try {
        const response = await axios.get('/health');
        if (response.data.success) {
          setConnectionStatus({
            backend: 'connected',
            database: 'connected',
            version: response.data.version || '2.0.0'
          });
        } else {
          setConnectionStatus({
            backend: 'connected',
            database: 'error',
            version: response.data.version || '2.0.0'
          });
        }
      } catch (error) {
        console.error('Server health check failed:', error.message);
        setConnectionStatus({
          backend: 'error',
          database: 'error',
          version: null
        });
      }
    };

    checkConnectionStatus();
    const interval = setInterval(checkConnectionStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // Check if current route is public
  const isPublicRoute = ['/login', '/auth/callback'].includes(location.pathname);

  return (
    <>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        
        {/* Protected Routes */}
        <Route path="/" element={
          <ProtectedRoute>
            <Navigate to="/dashboard" replace />
          </ProtectedRoute>
        } />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <AuthenticatedLayout 
              connectionStatus={connectionStatus} 
              sidebarCollapsed={sidebarCollapsed} 
              onToggleSidebar={handleToggleSidebar}
            >
              <Dashboard />
            </AuthenticatedLayout>
          </ProtectedRoute>
        } />
        <Route path="/devices" element={
          <ProtectedRoute>
            <AuthenticatedLayout 
              connectionStatus={connectionStatus} 
              sidebarCollapsed={sidebarCollapsed} 
              onToggleSidebar={handleToggleSidebar}
            >
              <Devices />
            </AuthenticatedLayout>
          </ProtectedRoute>
        } />
        <Route path="/configurations" element={
          <ProtectedRoute>
            <AuthenticatedLayout 
              connectionStatus={connectionStatus} 
              sidebarCollapsed={sidebarCollapsed} 
              onToggleSidebar={handleToggleSidebar}
            >
              <Configurations />
            </AuthenticatedLayout>
          </ProtectedRoute>
        } />
        <Route path="/configuration-history" element={
          <ProtectedRoute>
            <AuthenticatedLayout 
              connectionStatus={connectionStatus} 
              sidebarCollapsed={sidebarCollapsed} 
              onToggleSidebar={handleToggleSidebar}
            >
              <ConfigurationHistory />
            </AuthenticatedLayout>
          </ProtectedRoute>
        } />
        <Route path="/console" element={
          <ProtectedRoute>
            <AuthenticatedLayout 
              connectionStatus={connectionStatus} 
              sidebarCollapsed={sidebarCollapsed} 
              onToggleSidebar={handleToggleSidebar}
            >
              <ConsoleConfiguration />
            </AuthenticatedLayout>
          </ProtectedRoute>
        } />
        <Route path="/backups" element={
          <ProtectedRoute>
            <AuthenticatedLayout 
              connectionStatus={connectionStatus} 
              sidebarCollapsed={sidebarCollapsed} 
              onToggleSidebar={handleToggleSidebar}
            >
              <BackupManagement />
            </AuthenticatedLayout>
          </ProtectedRoute>
        } />
        <Route path="*" element={<NotFound />} />
      </Routes>
      
      {/* Toast Notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
            borderRadius: '8px',
            padding: '12px 16px',
            fontSize: '14px',
            fontWeight: '500',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)',
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#fff' },
            style: { background: '#059669' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#fff' },
            style: { background: '#dc2626' },
          },
          loading: {
            iconTheme: { primary: '#3b82f6', secondary: '#fff' },
            style: { background: '#2563eb' },
          },
        }}
      />
      
      {/* Stagewise Toolbar - Only in development */}
      {isDev && StagewiseToolbar && (
        <StagewiseToolbar config={{ plugins: [window.__stagewisePlugin] }} />
      )}
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
