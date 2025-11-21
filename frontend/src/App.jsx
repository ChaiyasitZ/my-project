import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import axios from 'axios';
import { StagewiseToolbar } from '@stagewise/toolbar-react';
import ReactPlugin from '@stagewise-plugins/react';

console.log('🚀 App.jsx: Starting imports...');

// Components
import Sidebar from './components/Sidebar';
console.log('✅ Sidebar imported');

// Pages
import Dashboard from './pages/Dashboard';
console.log('✅ Dashboard imported');

import Devices from './pages/Devices';
console.log('✅ Devices imported');

import Configurations from './pages/Configurations';
console.log('✅ Configurations imported');

import ConfigurationHistory from './pages/ConfigurationHistory';
console.log('✅ ConfigurationHistory imported');

import ConsoleConfiguration from './pages/ConsoleConfiguration';
console.log('✅ ConsoleConfiguration imported');

import BackupManagement from './pages/BackupManagement';
console.log('✅ BackupManagement imported');

import NotFound from './pages/NotFound';
console.log('✅ NotFound imported');

import './App.css';
console.log('✅ All imports completed');

// API Configuration - Use environment variable or current origin for API calls
const API_BASE_URL = import.meta.env.VITE_API_URL || 
                     (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api');

axios.defaults.baseURL = API_BASE_URL;
console.log('🌐 API Base URL:', API_BASE_URL);

function App() {
  console.log('🏁 App component rendering...');
  
  const [serverStatus, setServerStatus] = useState('checking');

  useEffect(() => {
    console.log('🔍 Setting up server status check...');
    
    const checkServerStatus = async () => {
      try {
        const response = await axios.get('/health');
        setServerStatus(response.data.success ? 'connected' : 'error');
      } catch (error) {
        console.error('Server health check failed:', error);
        setServerStatus('error');
      }
    };

    checkServerStatus();
    const interval = setInterval(checkServerStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  console.log('🎨 Rendering App JSX...');

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
        <StagewiseToolbar config={{ plugins: [ReactPlugin] }} />
      </div>
    </Router>
  );
}

console.log('✅ App component defined');

export default App;
