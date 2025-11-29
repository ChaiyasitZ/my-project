import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import axios from 'axios';

// Components
import Sidebar from './components/Sidebar';

// Pages
import Dashboard from './pages/Dashboard';
import Devices from './pages/Devices';
import Configurations from './pages/Configurations';
import ConfigurationHistory from './pages/ConfigurationHistory';
import ConsoleConfiguration from './pages/ConsoleConfiguration';
import BackupManagement from './pages/BackupManagement';
import NotFound from './pages/NotFound';

import './App.css';

// API Configuration - Detect environment based on hostname
const isLocalhost = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1';

const API_BASE_URL = import.meta.env.VITE_API_URL || 
                     (isLocalhost ? 'http://localhost:3001/api' : '/api');

axios.defaults.baseURL = API_BASE_URL;

// Stagewise toolbar - only in development
const isDev = import.meta.env.DEV;

function App() {
  const [serverStatus, setServerStatus] = useState('checking');
  const [StagewiseToolbar, setStagewiseToolbar] = useState(null);

  useEffect(() => {
    // Dynamically load Stagewise toolbar only in development
    if (isDev) {
      Promise.all([
        import('@stagewise/toolbar-react'),
        import('@stagewise-plugins/react')
      ]).then(([toolbar, plugin]) => {
        setStagewiseToolbar(() => toolbar.StagewiseToolbar);
        window.__stagewisePlugin = plugin.default;
      }).catch(() => {
        // Silently fail if Stagewise not available
      });
    }
  }, []);

  useEffect(() => {
    const checkServerStatus = async () => {
      try {
        const response = await axios.get('/health');
        setServerStatus(response.data.success ? 'connected' : 'error');
      } catch (error) {
        console.error('Server health check failed:', error.message);
        setServerStatus('error');
      }
    };

    checkServerStatus();
    const interval = setInterval(checkServerStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Router>
      <div className="flex min-h-screen bg-gray-50 w-full">
        <Sidebar serverStatus={serverStatus} />
        
        {/* Main content area */}
        <div className="flex-1 lg:ml-0 w-full">
          <main className="pt-20 lg:pt-6 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto w-full">
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/devices" element={<Devices />} />
                <Route path="/configurations" element={<Configurations />} />
                <Route path="/configuration-history" element={<ConfigurationHistory />} />
                <Route path="/console" element={<ConsoleConfiguration />} />
                <Route path="/backups" element={<BackupManagement />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </div>
          </main>
        </div>
        
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
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
              style: {
                background: '#059669',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
              style: {
                background: '#dc2626',
              },
            },
            loading: {
              iconTheme: {
                primary: '#3b82f6',
                secondary: '#fff',
              },
              style: {
                background: '#2563eb',
              },
            },
          }}
        />
        
        {/* Stagewise Toolbar - Only in development */}
        {isDev && StagewiseToolbar && (
          <StagewiseToolbar config={{ plugins: [window.__stagewisePlugin] }} />
        )}
      </div>
    </Router>
  );
}

export default App;
