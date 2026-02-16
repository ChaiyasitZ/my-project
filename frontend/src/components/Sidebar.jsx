import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { 
  LayoutDashboardIcon, 
  ServerIcon, 
  BrainCircuitIcon, 
  ClockIcon,
  TerminalIcon,
  HardDriveDownloadIcon,
  MonitorSmartphoneIcon,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Database,
  Sun,
  Moon
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import UserMenu from './UserMenu';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboardIcon },
  { name: 'Devices', href: '/devices', icon: ServerIcon },
  { name: 'Configurations', href: '/configurations', icon: BrainCircuitIcon },
  { name: 'Console Setup', href: '/console', icon: TerminalIcon },
  { name: 'History', href: '/configuration-history', icon: ClockIcon },
  { name: 'Backups', href: '/backups', icon: HardDriveDownloadIcon },
  { name: 'Agent Settings', href: '/agent-settings', icon: MonitorSmartphoneIcon },
];

function Sidebar({ connectionStatus = { backend: 'checking', database: 'checking', version: null }, isCollapsed = false, onToggleCollapse }) {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isDark, toggleTheme } = useTheme();

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
      <nav className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700" aria-label="Mobile navigation">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Left side - Hamburger menu and logo */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
            
            <Link to="/" className="flex items-center space-x-2" onClick={() => setIsMobileMenuOpen(false)}>
              <img src="/Logo-Project - New.svg" alt="Network Management Platform" className="h-8 w-8 rounded-lg" />
              <span className="text-lg font-bold text-gray-900 dark:text-white">NetAutomate</span>
            </Link>
          </div>

          {/* Right side - Theme toggle and Status indicator */}
          <div className="flex items-center space-x-3">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <div className={`h-2 w-2 rounded-full ${getStatusDisplay(overallStatus).color} ${overallStatus === 'checking' ? 'status-pulse' : ''}`}></div>
            <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">
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
        fixed inset-y-0 left-0 z-50 bg-white dark:bg-gray-900 shadow-xl border-r border-gray-200 dark:border-gray-700 sidebar-transition
        lg:translate-x-0 lg:static lg:inset-0
        ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}
        ${isMobileMenuOpen ? 'translate-x-0 w-72' : '-translate-x-full lg:translate-x-0'}
        transition-all duration-300 ease-in-out
      `}>
        <div className="flex flex-col h-full">
          {/* Desktop Logo */}
          <div className="hidden lg:flex items-center justify-between px-4 py-4 border-b border-gray-200 dark:border-gray-700">
            <Link to="/" className={`flex items-center ${isCollapsed ? 'justify-center w-full' : 'space-x-3'}`}>
              <img src="/Logo-Project - New.svg" alt="Network Management Platform" className="h-10 w-10 rounded-lg flex-shrink-0" />
              {!isCollapsed && (
                <div className="overflow-hidden">
                  <span className="text-xl font-bold text-gray-900 dark:text-white whitespace-nowrap">NetAutomate</span>
                  <p className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">Network Platform</p>
                </div>
              )}
            </Link>
          </div>

          {/* Toggle Button - Desktop Only */}
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex absolute -right-3 top-20 z-50 items-center justify-center w-6 h-6 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-full shadow-md hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-400 transition-colors duration-200"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4 text-gray-600 dark:text-gray-300" />
            ) : (
              <ChevronLeft className="h-4 w-4 text-gray-600 dark:text-gray-300" />
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
                      ? 'bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/50 dark:to-blue-800/50 text-blue-700 dark:text-blue-300 shadow-sm border-l-4 border-blue-500'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <Icon className={`h-5 w-5 flex-shrink-0 transition-colors duration-200 ${
                    isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'
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

          {/* User Menu */}
          <div className={`p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
            <UserMenu collapsed={isCollapsed} />
          </div>
        </div>
      </div>
    </>
  );
}

export default Sidebar; 