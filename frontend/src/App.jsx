import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import axios from 'axios';

// Components
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Devices from './pages/Devices';
import Configurations from './pages/Configurations';
import ConfigurationHistory from './pages/ConfigurationHistory';
import NotFound from './pages/NotFound';

// API Configuration
axios.defaults.baseURL = 'http://localhost:5000/api';

function App() {
  const [isServerHealthy, setIsServerHealthy] = useState(false);
  const [isCheckingHealth, setIsCheckingHealth] = useState(true);

  useEffect(() => {
    checkServerHealth();
  }, []);

  const checkServerHealth = async () => {
    try {
      const response = await axios.get('/health');
      setIsServerHealthy(response.data.success);
    } catch (error) {
      console.error('Server health check failed:', error);
      setIsServerHealthy(false);
    } finally {
      setIsCheckingHealth(false);
    }
  };

  if (isCheckingHealth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking server connection...</p>
        </div>
      </div>
    );
  }

  if (!isServerHealthy) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="bg-red-100 rounded-full p-3 mx-auto w-16 h-16 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Server Connection Failed</h2>
          <p className="text-gray-600 mb-4">
            Unable to connect to the backend server. Please ensure the server is running on port 5000.
          </p>
          <button 
            onClick={checkServerHealth}
            className="btn btn-primary btn-md"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/devices" element={<Devices />} />
            <Route path="/configurations" element={<Configurations />} />
            <Route path="/history" element={<ConfigurationHistory />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
