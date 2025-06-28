import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { 
  HomeIcon, 
  ServerIcon, 
  CogIcon, 
  ClockIcon,
  WifiIcon,
  TerminalIcon,
  Archive,
  Menu,
  X,
  Activity
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Devices', href: '/devices', icon: ServerIcon },
  { name: 'Configurations', href: '/configurations', icon: CogIcon },
  { name: 'Console Setup', href: '/console', icon: TerminalIcon },
  { name: 'History', href: '/configuration-history', icon: ClockIcon },
  { name: 'Backups', href: '/backups', icon: Archive },
];

function Sidebar({ serverStatus = 'checking' }) {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const getServerStatusDisplay = () => {
    switch (serverStatus) {
      case 'connected':
        return {
          color: 'bg-green-400',
          text: 'Server Connected',
          textColor: 'text-gray-500'
        };
      case 'error':
        return {
          color: 'bg-red-400',
          text: 'Server Disconnected',
          textColor: 'text-red-500'
        };
      case 'checking':
      default:
        return {
          color: 'bg-yellow-400',
          text: 'Checking Connection...',
          textColor: 'text-yellow-600'
        };
    }
  };

  const statusDisplay = getServerStatusDisplay();

  return (
    <>
      {/* Top Navigation Bar for Mobile/Tablet */}
      <nav className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-b border-gray-200" aria-label="Mobile navigation">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Left side - Hamburger menu and logo */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
            
            <Link to="/" className="flex items-center space-x-2" onClick={() => setIsMobileMenuOpen(false)}>
              <div className="bg-blue-600 p-1.5 rounded-lg">
                <WifiIcon className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold text-gray-900">NetAutomate</span>
            </Link>
          </div>

          {/* Right side - Status indicator */}
          <div className="flex items-center space-x-2">
            <div className={`h-2 w-2 rounded-full ${statusDisplay.color} ${serverStatus === 'checking' ? 'status-pulse' : ''}`}></div>
            <span className="text-xs text-gray-500 hidden sm:inline">
              {serverStatus === 'connected' ? 'Online' : serverStatus === 'error' ? 'Offline' : 'Checking...'}
            </span>
          </div>
        </div>
      </nav>

      {/* Mobile menu overlay */}
      {isMobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 z-40 bg-black bg-opacity-50 overlay-transition"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-xl border-r border-gray-200 sidebar-transition
        lg:translate-x-0 lg:static lg:inset-0 lg:w-64
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          {/* Desktop Logo */}
          <div className="hidden lg:flex items-center px-6 py-4 border-b border-gray-200">
            <Link to="/" className="flex items-center space-x-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <WifiIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <span className="text-xl font-bold text-gray-900">NetAutomate</span>
                <p className="text-sm text-gray-500">Network Management</p>
              </div>
            </Link>
          </div>

          {/* Mobile Header - spacing for fixed navbar */}
          <div className="lg:hidden h-4"></div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto sidebar-scroll">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              const Icon = item.icon;
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group nav-item-hover ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 shadow-sm border-l-4 border-blue-500'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon className={`h-5 w-5 mr-4 flex-shrink-0 transition-colors duration-200 ${
                    isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'
                  }`} />
                  <span className="font-medium">{item.name}</span>
                  {isActive && (
                    <div className="ml-auto">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    </div>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Status indicator */}
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`h-3 w-3 rounded-full ${statusDisplay.color} ${serverStatus === 'checking' ? 'status-pulse' : ''}`}></div>
                <div className="flex flex-col">
                  <span className={`text-sm font-medium ${statusDisplay.textColor}`}>
                    {statusDisplay.text}
                  </span>
                  <span className="text-xs text-gray-400">v1.0.0</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default Sidebar; 