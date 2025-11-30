import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { 
  HomeIcon, 
  ServerIcon, 
  CogIcon, 
  ClockIcon,
  TerminalIcon,
  Archive,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Database
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Devices', href: '/devices', icon: ServerIcon },
  { name: 'Configurations', href: '/configurations', icon: CogIcon },
  { name: 'Console Setup', href: '/console', icon: TerminalIcon },
  { name: 'History', href: '/configuration-history', icon: ClockIcon },
  { name: 'Backups', href: '/backups', icon: Archive },
];

function Sidebar({ connectionStatus = { backend: 'checking', database: 'checking', version: null }, isCollapsed = false, onToggleCollapse }) {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const getStatusDisplay = (status) => {
    switch (status) {
      case 'connected':
        return {
          color: 'bg-green-400',
          ringColor: 'ring-green-400/30',
          textColor: 'text-green-600'
        };
      case 'error':
        return {
          color: 'bg-red-400',
          ringColor: 'ring-red-400/30',
          textColor: 'text-red-500'
        };
      case 'checking':
      default:
        return {
          color: 'bg-yellow-400',
          ringColor: 'ring-yellow-400/30',
          textColor: 'text-yellow-600'
        };
    }
  };

  const backendStatus = getStatusDisplay(connectionStatus.backend);
  const databaseStatus = getStatusDisplay(connectionStatus.database);

  // Overall status for mobile header
  const overallStatus = connectionStatus.backend === 'connected' && connectionStatus.database === 'connected' 
    ? 'connected' 
    : connectionStatus.backend === 'checking' || connectionStatus.database === 'checking'
    ? 'checking'
    : 'error';

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
              <img src="/vite.svg" alt="Network Management Platform" className="h-8 w-8 rounded-lg" />
              <span className="text-lg font-bold text-gray-900">NetAutomate</span>
            </Link>
          </div>

          {/* Right side - Status indicator */}
          <div className="flex items-center space-x-2">
            <div className={`h-2 w-2 rounded-full ${getStatusDisplay(overallStatus).color} ${overallStatus === 'checking' ? 'status-pulse' : ''}`}></div>
            <span className="text-xs text-gray-500 hidden sm:inline">
              {overallStatus === 'connected' ? 'Online' : overallStatus === 'error' ? 'Offline' : 'Checking...'}
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
        fixed inset-y-0 left-0 z-50 bg-white shadow-xl border-r border-gray-200 sidebar-transition
        lg:translate-x-0 lg:static lg:inset-0
        ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}
        ${isMobileMenuOpen ? 'translate-x-0 w-72' : '-translate-x-full lg:translate-x-0'}
        transition-all duration-300 ease-in-out
      `}>
        <div className="flex flex-col h-full">
          {/* Desktop Logo */}
          <div className="hidden lg:flex items-center justify-between px-4 py-4 border-b border-gray-200">
            <Link to="/" className={`flex items-center ${isCollapsed ? 'justify-center w-full' : 'space-x-3'}`}>
              <img src="/vite.svg" alt="Network Management Platform" className="h-10 w-10 rounded-lg flex-shrink-0" />
              {!isCollapsed && (
                <div className="overflow-hidden">
                  <span className="text-xl font-bold text-gray-900 whitespace-nowrap">NetAutomate</span>
                  <p className="text-sm text-gray-500 whitespace-nowrap">Network Platform</p>
                </div>
              )}
            </Link>
          </div>

          {/* Toggle Button - Desktop Only */}
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex absolute -right-3 top-20 z-50 items-center justify-center w-6 h-6 bg-white border border-gray-300 rounded-full shadow-md hover:bg-gray-50 hover:border-gray-400 transition-colors duration-200"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4 text-gray-600" />
            ) : (
              <ChevronLeft className="h-4 w-4 text-gray-600" />
            )}
          </button>

          {/* Mobile Header - spacing for fixed navbar */}
          <div className="lg:hidden h-4"></div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              const Icon = item.icon;
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  title={isCollapsed ? item.name : undefined}
                  className={`flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-4'} py-3 rounded-xl text-sm font-medium transition-all duration-200 group nav-item-hover ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 shadow-sm border-l-4 border-blue-500'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon className={`h-5 w-5 flex-shrink-0 transition-colors duration-200 ${
                    isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'
                  } ${!isCollapsed && 'mr-4'}`} />
                  {!isCollapsed && (
                    <>
                      <span className="font-medium whitespace-nowrap">{item.name}</span>
                      {isActive && (
                        <div className="ml-auto">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        </div>
                      )}
                    </>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Status indicator */}
          <div className={`p-4 border-t border-gray-200 bg-gray-50 ${isCollapsed ? 'flex flex-col items-center space-y-2' : ''}`}>
            {isCollapsed ? (
              <>
                <div 
                  className={`h-3 w-3 rounded-full ring-4 ${backendStatus.color} ${backendStatus.ringColor} ${connectionStatus.backend === 'checking' ? 'status-pulse' : ''}`}
                  title={`Backend: ${connectionStatus.backend}`}
                ></div>
                <div 
                  className={`h-3 w-3 rounded-full ring-4 ${databaseStatus.color} ${databaseStatus.ringColor} ${connectionStatus.database === 'checking' ? 'status-pulse' : ''}`}
                  title={`Database: ${connectionStatus.database}`}
                ></div>
              </>
            ) : (
              <div className="space-y-3">
                {/* Backend Status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`h-2.5 w-2.5 rounded-full ring-4 ${backendStatus.color} ${backendStatus.ringColor} ${connectionStatus.backend === 'checking' ? 'status-pulse' : ''}`}></div>
                    <div className="flex items-center space-x-2">
                      <ServerIcon className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-700">Backend</span>
                    </div>
                  </div>
                  <span className={`text-xs font-medium ${backendStatus.textColor}`}>
                    {connectionStatus.backend === 'connected' ? 'Connected' : connectionStatus.backend === 'error' ? 'Disconnected' : 'Checking...'}
                  </span>
                </div>

                {/* Database Status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`h-2.5 w-2.5 rounded-full ring-4 ${databaseStatus.color} ${databaseStatus.ringColor} ${connectionStatus.database === 'checking' ? 'status-pulse' : ''}`}></div>
                    <div className="flex items-center space-x-2">
                      <Database className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-700">Database</span>
                    </div>
                  </div>
                  <span className={`text-xs font-medium ${databaseStatus.textColor}`}>
                    {connectionStatus.database === 'connected' ? 'Connected' : connectionStatus.database === 'error' ? 'Disconnected' : 'Checking...'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default Sidebar; 