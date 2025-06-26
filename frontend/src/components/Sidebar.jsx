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
  Activity,
  MenuIcon,
  XIcon
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Devices', href: '/devices', icon: ServerIcon },
  { name: 'Configurations', href: '/configurations', icon: CogIcon },
  { name: 'Console Setup', href: '/console', icon: TerminalIcon },
  { name: 'History', href: '/configuration-history', icon: ClockIcon },
  { name: 'Backups', href: '/backups', icon: Archive },
  { name: 'SNMP Monitoring', href: '/snmp', icon: Activity },
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
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="bg-white p-2 rounded-md shadow-lg border border-gray-200 hover:bg-gray-50"
        >
          {isMobileMenuOpen ? (
            <XIcon className="h-6 w-6 text-gray-600" />
          ) : (
            <MenuIcon className="h-6 w-6 text-gray-600" />
          )}
        </button>
      </div>

      {/* Mobile menu overlay */}
      {isMobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 z-40 bg-black bg-opacity-50"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg border-r border-gray-200 transform transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:inset-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center px-6 py-4 border-b border-gray-200">
            <Link to="/" className="flex items-center space-x-3" onClick={() => setIsMobileMenuOpen(false)}>
              <div className="bg-blue-600 p-2 rounded-lg">
                <WifiIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <span className="text-xl font-bold text-gray-900">NetAutomate</span>
                <p className="text-sm text-gray-500">Network Management</p>
              </div>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              const Icon = item.icon;
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200 group ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-500'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon className={`h-5 w-5 mr-3 transition-colors duration-200 ${
                    isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'
                  }`} />
                  <span className="truncate">{item.name}</span>
                  {isActive && (
                    <div className="ml-auto w-2 h-2 bg-blue-500 rounded-full"></div>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Status indicator */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className={`h-2 w-2 rounded-full ${statusDisplay.color} ${serverStatus === 'checking' ? 'animate-pulse' : ''}`}></div>
                <span className={`text-sm ${statusDisplay.textColor}`}>{statusDisplay.text}</span>
              </div>
              <div className="text-xs text-gray-400">v1.0.0</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default Sidebar; 