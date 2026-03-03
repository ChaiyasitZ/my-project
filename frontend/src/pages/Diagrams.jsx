import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  NetworkIcon, 
  ServerIcon, 
  DatabaseIcon, 
  BrainCircuitIcon,
  UsersIcon,
  MonitorIcon,
  ShieldIcon,
  CloudIcon,
  ArrowRightIcon,
  ArrowDownIcon,
  LayoutDashboardIcon,
  GitBranchIcon,
  LayersIcon,
  ArrowLeftIcon,
  PrinterIcon,
  DownloadIcon,
  KeyIcon,
  SettingsIcon,
  HistoryIcon,
  WifiIcon,
  TerminalIcon,
  FileTextIcon,
  RefreshCwIcon,
  ZapIcon,
  LockIcon,
  GlobeIcon
} from 'lucide-react';

function Diagrams() {
  const [activeTab, setActiveTab] = useState('overview');

  const tabs = [
    { id: 'overview', label: 'System Overview', icon: LayoutDashboardIcon },
    { id: 'context', label: 'Context Diagram', icon: GitBranchIcon },
    { id: 'dataflow', label: 'Data Flow Diagram', icon: LayersIcon },
  ];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Standalone Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link 
                to="/dashboard" 
                className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <ArrowLeftIcon className="h-5 w-5" />
                <span className="text-sm font-medium">Back to App</span>
              </Link>
              <div className="h-6 w-px bg-gray-300 dark:bg-gray-700"></div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
                  <NetworkIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <span className="text-lg font-bold text-gray-900 dark:text-white">System Documentation</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <PrinterIcon className="h-4 w-4" />
                Print
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Page Title */}
          <div className="print:mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl print:hidden">
                <NetworkIcon className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
              </div>
              System Diagrams
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Visual documentation of the Network Configuration Management System
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
              Project: AI-Powered Network Configuration Management • Version 2.0
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 pb-2 print:hidden">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Diagram Content */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 overflow-x-auto print:shadow-none print:p-0">
            {activeTab === 'overview' && <OverviewDiagram />}
            {activeTab === 'context' && <ContextDiagram />}
            {activeTab === 'dataflow' && <DataFlowDiagram />}
          </div>

          {/* Legend */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 print:shadow-none">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Legend</h3>
            <div className="flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 border-2 border-blue-500"></div>
                <span className="text-gray-600 dark:text-gray-400">Frontend Component</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/50 border-2 border-green-500"></div>
                <span className="text-gray-600 dark:text-gray-400">Backend Service</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/50 border-2 border-purple-500"></div>
                <span className="text-gray-600 dark:text-gray-400">Database</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/50 border-2 border-orange-500"></div>
                <span className="text-gray-600 dark:text-gray-400">External System</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 border-2 border-gray-500"></div>
                <span className="text-gray-600 dark:text-gray-400">External Entity</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-4 print:py-8">
            <p>Network Configuration Management System - Technical Documentation</p>
            <p className="mt-1">Generated: {new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </main>
    </div>
  );
}

// Component Box
function Box({ children, className = '', color = 'blue', size = 'md' }) {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/30 border-blue-400 dark:border-blue-600',
    green: 'bg-green-50 dark:bg-green-900/30 border-green-400 dark:border-green-600',
    purple: 'bg-purple-50 dark:bg-purple-900/30 border-purple-400 dark:border-purple-600',
    orange: 'bg-orange-50 dark:bg-orange-900/30 border-orange-400 dark:border-orange-600',
    red: 'bg-red-50 dark:bg-red-900/30 border-red-400 dark:border-red-600',
    gray: 'bg-gray-50 dark:bg-gray-700/50 border-gray-400 dark:border-gray-500',
    indigo: 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-400 dark:border-indigo-600',
  };

  const sizeClasses = {
    sm: 'p-2 min-w-[100px]',
    md: 'p-3 min-w-[140px]',
    lg: 'p-4 min-w-[180px]',
  };

  return (
    <div className={`rounded-xl border-2 ${colorClasses[color]} ${sizeClasses[size]} ${className}`}>
      {children}
    </div>
  );
}

// Circle Entity
function Entity({ children, className = '', color = 'gray' }) {
  const colorClasses = {
    gray: 'bg-gray-100 dark:bg-gray-700 border-gray-400 dark:border-gray-500',
    blue: 'bg-blue-100 dark:bg-blue-900/50 border-blue-400 dark:border-blue-600',
  };

  return (
    <div className={`rounded-full border-2 p-4 flex flex-col items-center justify-center ${colorClasses[color]} ${className}`}>
      {children}
    </div>
  );
}

// Arrow Component
function Arrow({ direction = 'right', label = '', className = '' }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      {direction === 'right' && (
        <div className="flex flex-col items-center">
          <div className="flex items-center">
            <div className="w-8 h-0.5 bg-gray-400 dark:bg-gray-500"></div>
            <ArrowRightIcon className="h-4 w-4 text-gray-400 dark:text-gray-500 -ml-1" />
          </div>
          {label && <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{label}</span>}
        </div>
      )}
      {direction === 'down' && (
        <div className="flex flex-col items-center">
          <div className="h-6 w-0.5 bg-gray-400 dark:bg-gray-500"></div>
          <ArrowDownIcon className="h-4 w-4 text-gray-400 dark:text-gray-500 -mt-1" />
          {label && <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{label}</span>}
        </div>
      )}
      {direction === 'bidirectional' && (
        <div className="flex flex-col items-center">
          <div className="flex items-center">
            <ArrowRightIcon className="h-3 w-3 text-gray-400 dark:text-gray-500 rotate-180" />
            <div className="w-6 h-0.5 bg-gray-400 dark:bg-gray-500"></div>
            <ArrowRightIcon className="h-3 w-3 text-gray-400 dark:text-gray-500" />
          </div>
          {label && <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{label}</span>}
        </div>
      )}
    </div>
  );
}

// Overview Diagram
function OverviewDiagram() {
  return (
    <div className="min-w-[900px]">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 text-center">
        System Overview Diagram
      </h2>
      
      {/* Architecture Layers */}
      <div className="space-y-6">
        {/* Presentation Layer */}
        <div className="border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-4">Presentation Layer (Frontend)</h3>
          <div className="flex flex-wrap gap-4 justify-center">
            <Box color="blue" size="sm">
              <div className="flex flex-col items-center text-center">
                <LayoutDashboardIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mb-1" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Dashboard</span>
              </div>
            </Box>
            <Box color="blue" size="sm">
              <div className="flex flex-col items-center text-center">
                <ServerIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mb-1" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Devices</span>
              </div>
            </Box>
            <Box color="blue" size="sm">
              <div className="flex flex-col items-center text-center">
                <BrainCircuitIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mb-1" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Configurations</span>
              </div>
            </Box>
            <Box color="blue" size="sm">
              <div className="flex flex-col items-center text-center">
                <ShieldIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mb-1" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Backups</span>
              </div>
            </Box>
            <Box color="blue" size="sm">
              <div className="flex flex-col items-center text-center">
                <MonitorIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mb-1" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Console</span>
              </div>
            </Box>
          </div>
          <div className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
            React + Vite + Tailwind CSS
          </div>
        </div>

        <Arrow direction="down" className="mx-auto" label="REST API / HTTP Polling" />

        {/* Application Layer */}
        <div className="border-2 border-dashed border-green-300 dark:border-green-700 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-green-600 dark:text-green-400 mb-4">Application Layer (Backend)</h3>
          <div className="flex flex-wrap gap-4 justify-center">
            <Box color="green" size="sm">
              <div className="flex flex-col items-center text-center">
                <ShieldIcon className="h-5 w-5 text-green-600 dark:text-green-400 mb-1" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Auth Service</span>
              </div>
            </Box>
            <Box color="green" size="sm">
              <div className="flex flex-col items-center text-center">
                <ServerIcon className="h-5 w-5 text-green-600 dark:text-green-400 mb-1" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Device Service</span>
              </div>
            </Box>
            <Box color="green" size="sm">
              <div className="flex flex-col items-center text-center">
                <BrainCircuitIcon className="h-5 w-5 text-green-600 dark:text-green-400 mb-1" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">LLM Service</span>
              </div>
            </Box>
            <Box color="green" size="sm">
              <div className="flex flex-col items-center text-center">
                <NetworkIcon className="h-5 w-5 text-green-600 dark:text-green-400 mb-1" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">NETCONF Service</span>
              </div>
            </Box>
            <Box color="green" size="sm">
              <div className="flex flex-col items-center text-center">
                <MonitorIcon className="h-5 w-5 text-green-600 dark:text-green-400 mb-1" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">SSH Service</span>
              </div>
            </Box>
            <Box color="green" size="sm">
              <div className="flex flex-col items-center text-center">
                <ShieldIcon className="h-5 w-5 text-green-600 dark:text-green-400 mb-1" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Backup Service</span>
              </div>
            </Box>
            <Box color="green" size="sm">
              <div className="flex flex-col items-center text-center">
                <ZapIcon className="h-5 w-5 text-green-600 dark:text-green-400 mb-1" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Agent Relay</span>
              </div>
            </Box>
          </div>
          <div className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
            Node.js + Express (Vercel Serverless)
          </div>
        </div>

        <Arrow direction="down" className="mx-auto" label="Data Access" />

        {/* Data Layer */}
        <div className="border-2 border-dashed border-purple-300 dark:border-purple-700 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-purple-600 dark:text-purple-400 mb-4">Data Layer</h3>
          <div className="flex flex-wrap gap-4 justify-center">
            <Box color="purple" size="md">
              <div className="flex flex-col items-center text-center">
                <DatabaseIcon className="h-6 w-6 text-purple-600 dark:text-purple-400 mb-1" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">MongoDB Atlas</span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">9 Collections (D1-D9)</span>
              </div>
            </Box>
          </div>
        </div>

        <Arrow direction="down" className="mx-auto" label="Agent Relay / Network Protocols" />

        {/* External Systems */}
        <div className="border-2 border-dashed border-orange-300 dark:border-orange-700 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-orange-600 dark:text-orange-400 mb-4">External Systems</h3>
          <div className="flex flex-wrap gap-4 justify-center">
            <Box color="red" size="sm">
              <div className="flex flex-col items-center text-center">
                <TerminalIcon className="h-5 w-5 text-red-600 dark:text-red-400 mb-1" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Desktop Agent</span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">Electron App</span>
              </div>
            </Box>
            <Box color="orange" size="sm">
              <div className="flex flex-col items-center text-center">
                <ServerIcon className="h-5 w-5 text-orange-600 dark:text-orange-400 mb-1" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Network Devices</span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">NX-OS / IOS-XE</span>
              </div>
            </Box>
            <Box color="orange" size="sm">
              <div className="flex flex-col items-center text-center">
                <BrainCircuitIcon className="h-5 w-5 text-orange-600 dark:text-orange-400 mb-1" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Ollama</span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">LLM API</span>
              </div>
            </Box>
            <Box color="orange" size="sm">
              <div className="flex flex-col items-center text-center">
                <CloudIcon className="h-5 w-5 text-orange-600 dark:text-orange-400 mb-1" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Google OAuth</span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">Authentication</span>
              </div>
            </Box>
          </div>
        </div>
      </div>
    </div>
  );
}

// Context Diagram with Full SVG Arrow Links
function ContextDiagram() {
  return (
    <div className="min-w-[1000px]">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-8 text-center">
        Context Diagram (DFD Level 0)
      </h2>
      
      {/* SVG-based Context Diagram with proper arrows */}
      <div className="relative bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-2xl p-8 overflow-hidden">
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
          <defs>
            {/* Arrow markers */}
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" className="fill-gray-500 dark:fill-gray-400" />
            </marker>
            <marker id="arrowhead-blue" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" className="fill-blue-500" />
            </marker>
            <marker id="arrowhead-green" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" className="fill-green-500" />
            </marker>
            <marker id="arrowhead-orange" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" className="fill-orange-500" />
            </marker>
            <marker id="arrowhead-purple" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" className="fill-purple-500" />
            </marker>
            <marker id="arrowhead-cyan" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" className="fill-cyan-500" />
            </marker>
          </defs>
          
          {/* Admin to System - Blue */}
          <line x1="18%" y1="50%" x2="35%" y2="50%" stroke="#3B82F6" strokeWidth="2" markerEnd="url(#arrowhead-blue)" />
          <line x1="35%" y1="55%" x2="18%" y2="55%" stroke="#3B82F6" strokeWidth="2" markerEnd="url(#arrowhead-blue)" />
          
          {/* System to Desktop Agent (via Agent Relay) - Cyan */}
          <line x1="65%" y1="50%" x2="82%" y2="50%" stroke="#06B6D4" strokeWidth="2" markerEnd="url(#arrowhead-cyan)" />
          <line x1="82%" y1="55%" x2="65%" y2="55%" stroke="#06B6D4" strokeWidth="2" markerEnd="url(#arrowhead-cyan)" />
          
          {/* System to Database - Purple */}
          <line x1="50%" y1="70%" x2="50%" y2="85%" stroke="#A855F7" strokeWidth="2" markerEnd="url(#arrowhead-purple)" />
          <line x1="52%" y1="85%" x2="52%" y2="70%" stroke="#A855F7" strokeWidth="2" markerEnd="url(#arrowhead-purple)" />
          
          {/* Google OAuth to System - Orange */}
          <line x1="50%" y1="15%" x2="50%" y2="30%" stroke="#F97316" strokeWidth="2" markerEnd="url(#arrowhead-orange)" />
          <line x1="52%" y1="30%" x2="52%" y2="15%" stroke="#F97316" strokeWidth="2" markerEnd="url(#arrowhead-orange)" />
          
          {/* AI Service to System */}
          <line x1="82%" y1="25%" x2="65%" y2="40%" stroke="#EC4899" strokeWidth="2" markerEnd="url(#arrowhead)" />
          <line x1="65%" y1="42%" x2="82%" y2="27%" stroke="#EC4899" strokeWidth="2" markerEnd="url(#arrowhead)" />
        </svg>
        
        <div className="relative z-10 grid grid-cols-5 gap-4 min-h-[500px]">
          {/* Top Row - Google OAuth */}
          <div className="col-span-5 flex justify-center">
            <div className="flex flex-col items-center">
              <Entity color="gray" className="w-32 h-32 shadow-lg">
                <CloudIcon className="h-8 w-8 text-orange-500 mb-2" />
                <span className="text-sm font-bold text-gray-800 dark:text-white">Google</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">OAuth 2.0</span>
              </Entity>
              <div className="mt-2 text-center">
                <div className="text-xs font-medium text-orange-600 dark:text-orange-400">↓ JWT Token</div>
                <div className="text-xs font-medium text-orange-600 dark:text-orange-400">↑ Auth Request</div>
              </div>
            </div>
          </div>

          {/* Middle Row */}
          <div className="flex items-center justify-center">
            <div className="flex flex-col items-center">
              <Entity color="gray" className="w-32 h-32 shadow-lg">
                <UsersIcon className="h-8 w-8 text-blue-500 mb-2" />
                <span className="text-sm font-bold text-gray-800 dark:text-white">Network</span>
                <span className="text-sm font-bold text-gray-800 dark:text-white">Admin</span>
              </Entity>
              <div className="mt-2 text-center space-y-1">
                <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">→ Config Requests</div>
                <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">→ Device Commands</div>
                <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">← Status Reports</div>
                <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">← Generated Configs</div>
              </div>
            </div>
          </div>

          <div className="col-span-3 flex items-center justify-center">
            {/* Central System */}
            <Box color="indigo" size="lg" className="w-72 h-64 flex items-center justify-center shadow-2xl border-4">
              <div className="text-center p-4">
                <div className="bg-indigo-600 rounded-full p-4 w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                  <NetworkIcon className="h-10 w-10 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Network Configuration</h3>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Management System</h3>
                <div className="mt-2 px-3 py-1 bg-indigo-100 dark:bg-indigo-900/50 rounded-full inline-block">
                  <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">Process 0.0</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">AI-Powered Automation</p>
              </div>
            </Box>
          </div>

          <div className="flex flex-col gap-4 justify-center">
            {/* Network Devices */}
            <div className="flex flex-col items-center">
              <Entity color="gray" className="w-32 h-32 shadow-lg">
                <ServerIcon className="h-8 w-8 text-green-500 mb-2" />
                <span className="text-sm font-bold text-gray-800 dark:text-white">Network</span>
                <span className="text-sm font-bold text-gray-800 dark:text-white">Devices</span>
              </Entity>
              <div className="mt-2 text-center space-y-1">
                <div className="text-xs text-green-600 dark:text-green-400 font-medium">← SSH/NETCONF</div>
                <div className="text-xs text-green-600 dark:text-green-400 font-medium">→ Config / Response</div>
              </div>
            </div>

            {/* Desktop Agent */}
            <div className="flex flex-col items-center mt-2">
              <Entity color="gray" className="w-32 h-32 shadow-lg border-2 border-cyan-400">
                <MonitorIcon className="h-8 w-8 text-cyan-500 mb-2" />
                <span className="text-sm font-bold text-gray-800 dark:text-white">Desktop</span>
                <span className="text-sm font-bold text-gray-800 dark:text-white">Agent</span>
              </Entity>
              <div className="mt-2 text-center space-y-1">
                <div className="text-xs text-cyan-600 dark:text-cyan-400 font-medium">↕ Agent Relay (HTTP)</div>
                <div className="text-xs text-cyan-600 dark:text-cyan-400 font-medium">↕ SSH/NETCONF Local</div>
                <div className="text-xs text-cyan-600 dark:text-cyan-400 font-medium">↕ Console (Serial Port)</div>
              </div>
            </div>
            
            {/* AI Service */}
            <div className="flex flex-col items-center mt-2">
              <Entity color="gray" className="w-32 h-32 shadow-lg">
                <BrainCircuitIcon className="h-8 w-8 text-pink-500 mb-2" />
                <span className="text-sm font-bold text-gray-800 dark:text-white">Ollama</span>
                <span className="text-sm font-bold text-gray-800 dark:text-white">LLM API</span>
              </Entity>
              <div className="mt-2 text-center space-y-1">
                <div className="text-xs text-pink-600 dark:text-pink-400 font-medium">← AI Prompt</div>
                <div className="text-xs text-pink-600 dark:text-pink-400 font-medium">→ Generated Config</div>
              </div>
            </div>
          </div>

          {/* Bottom Row - Database */}
          <div className="col-span-5 flex justify-center">
            <div className="flex flex-col items-center">
              <div className="mb-2 text-center">
                <div className="text-xs font-medium text-purple-600 dark:text-purple-400">↓ Store Data</div>
                <div className="text-xs font-medium text-purple-600 dark:text-purple-400">↑ Query Data</div>
              </div>
              <Box color="purple" className="px-8 py-4 shadow-lg">
                <div className="flex items-center gap-4">
                  <DatabaseIcon className="h-8 w-8 text-purple-500" />
                  <div>
                    <span className="text-sm font-bold text-gray-800 dark:text-white block">MongoDB Atlas</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Users | Devices | Configs | Backups | YANG | Agent Relay (D1-D9)</span>
                  </div>
                </div>
              </Box>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Data Flow Table */}
      <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4">
          <h3 className="text-lg font-bold text-white">Complete Data Flow Specification</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700">
                <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300 w-16">Flow ID</th>
                <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300">Source Entity</th>
                <th className="px-4 py-3 text-center text-gray-700 dark:text-gray-300 w-20">Direction</th>
                <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300">Destination Entity</th>
                <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300">Data Description</th>
                <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300 w-32">Protocol</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
              <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3 font-mono text-blue-600 font-bold">F1</td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">Network Admin</td>
                <td className="px-4 py-3 text-center"><ArrowRightIcon className="h-4 w-4 inline text-blue-500" /></td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">System</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Login credentials, configuration prompts, device CRUD operations</td>
                <td className="px-4 py-3"><span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded text-xs">HTTPS/REST</span></td>
              </tr>
              <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3 font-mono text-blue-600 font-bold">F2</td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">System</td>
                <td className="px-4 py-3 text-center"><ArrowRightIcon className="h-4 w-4 inline text-blue-500" /></td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">Network Admin</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Generated configs, device status, backup reports, deployment results</td>
                <td className="px-4 py-3"><span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded text-xs">HTTPS/REST</span></td>
              </tr>
              <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3 font-mono text-green-600 font-bold">F3</td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">System</td>
                <td className="px-4 py-3 text-center"><ArrowRightIcon className="h-4 w-4 inline text-green-500" /></td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">Network Devices</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">CLI commands, NETCONF/YANG XML via Agent Relay (NX-OS, IOS-XE)</td>
                <td className="px-4 py-3"><span className="px-2 py-1 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded text-xs">SSH/NETCONF</span></td>
              </tr>
              <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3 font-mono text-green-600 font-bold">F4</td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">Network Devices</td>
                <td className="px-4 py-3 text-center"><ArrowRightIcon className="h-4 w-4 inline text-green-500" /></td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">System</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Running configs, NETCONF responses, device capabilities (via Agent)</td>
                <td className="px-4 py-3"><span className="px-2 py-1 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded text-xs">SSH/NETCONF</span></td>
              </tr>
              <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3 font-mono text-pink-600 font-bold">F5</td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">System</td>
                <td className="px-4 py-3 text-center"><ArrowRightIcon className="h-4 w-4 inline text-pink-500" /></td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">Ollama LLM</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">AI prompts with device type (NX-OS/IOS-XE), YANG templates</td>
                <td className="px-4 py-3"><span className="px-2 py-1 bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300 rounded text-xs">HTTPS/API</span></td>
              </tr>
              <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3 font-mono text-pink-600 font-bold">F6</td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">Ollama LLM</td>
                <td className="px-4 py-3 text-center"><ArrowRightIcon className="h-4 w-4 inline text-pink-500" /></td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">System</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Generated CLI/NETCONF XML (NX-OS/IOS-XE), explanations</td>
                <td className="px-4 py-3"><span className="px-2 py-1 bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300 rounded text-xs">HTTPS/API</span></td>
              </tr>
              <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3 font-mono text-orange-600 font-bold">F7</td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">System</td>
                <td className="px-4 py-3 text-center"><ArrowRightIcon className="h-4 w-4 inline text-orange-500" /></td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">Google OAuth</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">OAuth authorization requests, token verification</td>
                <td className="px-4 py-3"><span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 rounded text-xs">OAuth 2.0</span></td>
              </tr>
              <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3 font-mono text-orange-600 font-bold">F8</td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">Google OAuth</td>
                <td className="px-4 py-3 text-center"><ArrowRightIcon className="h-4 w-4 inline text-orange-500" /></td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">System</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">JWT tokens, user profiles, authentication status</td>
                <td className="px-4 py-3"><span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 rounded text-xs">OAuth 2.0</span></td>
              </tr>
              <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3 font-mono text-purple-600 font-bold">F9</td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">System</td>
                <td className="px-4 py-3 text-center"><ArrowRightIcon className="h-4 w-4 inline text-purple-500" /></td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">MongoDB</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">User data, device records, configurations, backups, YANG models, agent commands (D1-D9)</td>
                <td className="px-4 py-3"><span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded text-xs">MongoDB Wire</span></td>
              </tr>
              <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3 font-mono text-purple-600 font-bold">F10</td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">MongoDB</td>
                <td className="px-4 py-3 text-center"><ArrowRightIcon className="h-4 w-4 inline text-purple-500" /></td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">System</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Query results, aggregated data, stored configurations</td>
                <td className="px-4 py-3"><span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded text-xs">MongoDB Wire</span></td>
              </tr>
              <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3 font-mono text-cyan-600 font-bold">F11</td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">System</td>
                <td className="px-4 py-3 text-center"><ArrowRightIcon className="h-4 w-4 inline text-cyan-500" /></td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">Desktop Agent</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">SSH/NETCONF commands via Agent Relay (HTTP polling)</td>
                <td className="px-4 py-3"><span className="px-2 py-1 bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300 rounded text-xs">HTTP/REST</span></td>
              </tr>
              <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3 font-mono text-cyan-600 font-bold">F12</td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">Desktop Agent</td>
                <td className="px-4 py-3 text-center"><ArrowRightIcon className="h-4 w-4 inline text-cyan-500" /></td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">System</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Command results, device responses via Agent Relay</td>
                <td className="px-4 py-3"><span className="px-2 py-1 bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300 rounded text-xs">HTTP/REST</span></td>
              </tr>
              <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3 font-mono text-cyan-600 font-bold">F13</td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">System</td>
                <td className="px-4 py-3 text-center"><ArrowRightIcon className="h-4 w-4 inline text-cyan-500" /></td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">Desktop Agent</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Console port scan/connect relay (serial port access)</td>
                <td className="px-4 py-3"><span className="px-2 py-1 bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300 rounded text-xs">HTTP/REST</span></td>
              </tr>
              <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3 font-mono text-cyan-600 font-bold">F14</td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">Desktop Agent</td>
                <td className="px-4 py-3 text-center"><ArrowRightIcon className="h-4 w-4 inline text-cyan-500" /></td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">System</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Console output data, serial port list</td>
                <td className="px-4 py-3"><span className="px-2 py-1 bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300 rounded text-xs">HTTP/REST</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Process Box Component for DFD (rectangular style like reference)
function Process({ id, name, subProcesses = [] }) {
  return (
    <div className="flex flex-col items-center">
      <div className="border-2 border-gray-500 dark:border-gray-400 bg-white dark:bg-gray-800 min-w-[120px]">
        {/* Process ID header */}
        <div className="border-b-2 border-gray-500 dark:border-gray-400 px-4 py-1 text-center">
          <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{id}</span>
        </div>
        {/* Process name */}
        <div className="px-4 py-2 text-center">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{name}</span>
        </div>
      </div>
      {subProcesses.length > 0 && (
        <div className="mt-1 text-[9px] text-gray-500 dark:text-gray-400">
          {subProcesses.length} sub-processes
        </div>
      )}
    </div>
  );
}

// Data Store Component for DFD (open-ended rectangle style)
function DataStore({ id, name }) {
  return (
    <div className="flex items-center">
      {/* Left border */}
      <div className="w-[2px] h-12 bg-gray-500 dark:bg-gray-400"></div>
      {/* Content */}
      <div className="border-t-2 border-b-2 border-gray-500 dark:bg-gray-800 bg-white dark:border-gray-400 px-3 py-2 min-w-[80px]">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{id}</span>
          <span className="text-xs text-gray-600 dark:text-gray-400">{name}</span>
        </div>
      </div>
    </div>
  );
}

// External Entity Component for DFD (rectangle style)
function ExternalEntity({ name, icon: Icon }) {
  return (
    <div className="border-2 border-gray-500 dark:border-gray-400 bg-white dark:bg-gray-800 px-4 py-3 min-w-[80px]">
      <div className="flex flex-col items-center gap-1">
        <Icon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{name}</span>
      </div>
    </div>
  );
}

// Flow Arrow Component - Continuous connected arrows with proper arrowheads
function FlowArrow({ label, direction = 'right', length = 'normal' }) {
  const lengthClasses = {
    short: 'w-16',
    normal: 'w-24',
    long: 'w-36'
  };

  if (direction === 'down') {
    return (
      <div className="flex flex-col items-center">
        <div className="relative flex flex-col items-center">
          {/* Vertical line */}
          <div className="w-[2px] h-10 bg-gray-500 dark:bg-gray-400"></div>
          {/* Arrow head pointing down */}
          <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-gray-500 dark:border-t-gray-400"></div>
        </div>
        {label && (
          <span className="text-[10px] text-gray-600 dark:text-gray-300 mt-1 font-medium">
            {label}
          </span>
        )}
      </div>
    );
  }

  if (direction === 'up') {
    return (
      <div className="flex flex-col items-center">
        {label && (
          <span className="text-[10px] text-gray-600 dark:text-gray-300 mb-1 font-medium">
            {label}
          </span>
        )}
        <div className="relative flex flex-col items-center">
          {/* Arrow head pointing up */}
          <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[8px] border-b-gray-500 dark:border-b-gray-400"></div>
          {/* Vertical line */}
          <div className="w-[2px] h-10 bg-gray-500 dark:bg-gray-400"></div>
        </div>
      </div>
    );
  }

  if (direction === 'left') {
    return (
      <div className="flex flex-col items-center">
        <div className="relative flex items-center">
          {/* Arrow head pointing left */}
          <div className="w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[8px] border-r-gray-500 dark:border-r-gray-400"></div>
          {/* Horizontal line */}
          <div className={`h-[2px] bg-gray-500 dark:bg-gray-400 ${lengthClasses[length]}`}></div>
        </div>
        {label && (
          <span className="text-[10px] text-gray-600 dark:text-gray-300 mt-1 font-medium whitespace-nowrap">
            {label}
          </span>
        )}
      </div>
    );
  }

  // Default: right arrow
  return (
    <div className="flex flex-col items-center">
      <div className="relative flex items-center">
        {/* Horizontal line */}
        <div className={`h-[2px] bg-gray-500 dark:bg-gray-400 ${lengthClasses[length]}`}></div>
        {/* Arrow head pointing right */}
        <div className="w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[8px] border-l-gray-500 dark:border-l-gray-400"></div>
      </div>
      {label && (
        <span className="text-[10px] text-gray-600 dark:text-gray-300 mt-1 font-medium whitespace-nowrap">
          {label}
        </span>
      )}
    </div>
  );
}

// Bidirectional Arrow Component (two arrows on both ends)
function BiFlowArrow({ labelTop, labelBottom, length = 'normal' }) {
  const lengthClasses = {
    short: 'w-16',
    normal: 'w-24',
    long: 'w-36'
  };

  return (
    <div className="flex flex-col items-center">
      {labelTop && (
        <span className="text-[10px] text-gray-600 dark:text-gray-300 mb-1 font-medium whitespace-nowrap">
          {labelTop}
        </span>
      )}
      <div className="relative flex items-center">
        {/* Left arrow head */}
        <div className="w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[7px] border-r-gray-500 dark:border-r-gray-400"></div>
        {/* Horizontal line */}
        <div className={`h-[2px] bg-gray-500 dark:bg-gray-400 ${lengthClasses[length]}`}></div>
        {/* Right arrow head */}
        <div className="w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[7px] border-l-gray-500 dark:border-l-gray-400"></div>
      </div>
      {labelBottom && (
        <span className="text-[10px] text-gray-600 dark:text-gray-300 mt-1 font-medium whitespace-nowrap">
          {labelBottom}
        </span>
      )}
    </div>
  );
}

// Connector line for complex flows (no arrow, just line)
function ConnectorLine({ direction = 'horizontal', length = 'normal' }) {
  const hLengthClasses = { short: 'w-8', normal: 'w-16', long: 'w-24' };
  const vLengthClasses = { short: 'h-4', normal: 'h-8', long: 'h-12' };

  if (direction === 'vertical') {
    return <div className={`w-[2px] bg-gray-500 dark:bg-gray-400 ${vLengthClasses[length]}`}></div>;
  }
  return <div className={`h-[2px] bg-gray-500 dark:bg-gray-400 ${hLengthClasses[length]}`}></div>;
}

// Data Flow Diagram with Multiple Levels and SVG Arrows
function DataFlowDiagram() {
  const [activeLevel, setActiveLevel] = useState(0);

  const levels = [
    { id: 0, label: 'Level 0 - Context', desc: 'System Boundary' },
    { id: 1, label: 'Level 1 - Main Processes', desc: 'Main Processes' },
    { id: 2, label: 'Level 2 - Device Mgmt', desc: 'Process 2.0' },
    { id: 3, label: 'Level 3 - Config Gen', desc: 'Process 3.0' },
    { id: 4, label: 'Level 4 - Deployment', desc: 'Process 4.0' },
    { id: 5, label: 'Level 5 - Backup', desc: 'Process 5.0' },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Data Flow Diagrams (DFD)
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Hierarchical decomposition of system processes and data flows
        </p>
      </div>

      {/* Level Selector - Card Style */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {levels.map((level) => (
          <button
            key={level.id}
            onClick={() => setActiveLevel(level.id)}
            className={`p-3 rounded-xl text-left transition-all border-2 ${
              activeLevel === level.id
                ? 'bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg border-green-400 scale-105'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-700'
            }`}
          >
            <div className="text-xs font-bold">Level {level.id}</div>
            <div className={`text-[10px] mt-1 ${activeLevel === level.id ? 'text-green-100' : 'text-gray-400'}`}>
              {level.desc}
            </div>
          </button>
        ))}
      </div>

      {/* Level 0 - Context Diagram */}
      {activeLevel === 0 && <DFDLevel0 />}

      {/* Level 1 - Main Processes */}
      {activeLevel === 1 && <DFDLevel1 />}

      {/* Level 2 - Authentication */}
      {activeLevel === 2 && <DFDLevel2 />}

      {/* Level 3 - Device Management */}
      {activeLevel === 3 && <DFDLevel3 />}

      {/* Level 4 - Configuration Generation */}
      {activeLevel === 4 && <DFDLevel4 />}

      {/* Level 5 - Backup Management */}
      {activeLevel === 5 && <DFDLevel5 />}

      {/* Data Dictionary */}
      <DataDictionary />
    </div>
  );
}

// DFD Level 0 - Context
function DFDLevel0() {
  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-2xl p-8">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 text-center flex items-center justify-center gap-2">
        <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center text-sm font-bold">0</div>
        Context Diagram - System Boundary
      </h3>
      
      <div className="relative min-w-[900px] h-[400px]">
        {/* SVG for arrow connections */}
        <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 0 }}>
          <defs>
            <marker id="arrow-right" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" className="fill-gray-500 dark:fill-gray-400" />
            </marker>
          </defs>
          
          {/* Admin to System */}
          <g className="stroke-blue-500">
            <line x1="150" y1="180" x2="350" y2="180" strokeWidth="2" markerEnd="url(#arrow-right)" />
            <text x="250" y="170" className="fill-blue-600 text-[11px] font-medium" textAnchor="middle">Config Requests</text>
          </g>
          <g className="stroke-blue-400">
            <line x1="350" y1="220" x2="150" y2="220" strokeWidth="2" markerEnd="url(#arrow-right)" />
            <text x="250" y="240" className="fill-blue-600 text-[11px] font-medium" textAnchor="middle">Generated Configs</text>
          </g>
          
          {/* System to Desktop Agent (Agent Relay) */}
          <g className="stroke-cyan-500">
            <line x1="550" y1="180" x2="640" y2="180" strokeWidth="2" markerEnd="url(#arrow-right)" />
            <text x="595" y="170" className="fill-cyan-600 text-[11px] font-medium" textAnchor="middle">Agent Relay</text>
          </g>
          <g className="stroke-cyan-400">
            <line x1="640" y1="220" x2="550" y2="220" strokeWidth="2" markerEnd="url(#arrow-right)" />
            <text x="595" y="240" className="fill-cyan-600 text-[11px] font-medium" textAnchor="middle">Results</text>
          </g>
          
          {/* Desktop Agent to Devices */}
          <g className="stroke-green-500">
            <line x1="720" y1="180" x2="800" y2="180" strokeWidth="2" markerEnd="url(#arrow-right)" />
            <text x="760" y="170" className="fill-green-600 text-[11px] font-medium" textAnchor="middle">SSH/NETCONF</text>
          </g>
          <g className="stroke-green-400">
            <line x1="800" y1="220" x2="720" y2="220" strokeWidth="2" markerEnd="url(#arrow-right)" />
            <text x="760" y="240" className="fill-green-600 text-[11px] font-medium" textAnchor="middle">Config</text>
          </g>
          
          {/* System to AI */}
          <g className="stroke-pink-500">
            <line x1="500" y1="120" x2="650" y2="50" strokeWidth="2" markerEnd="url(#arrow-right)" />
            <text x="580" y="70" className="fill-pink-600 text-[11px] font-medium" textAnchor="middle">AI Prompt</text>
          </g>
          <g className="stroke-pink-400">
            <line x1="680" y1="70" x2="520" y2="120" strokeWidth="2" markerEnd="url(#arrow-right)" />
            <text x="620" y="110" className="fill-pink-600 text-[11px] font-medium" textAnchor="middle">Config</text>
          </g>
          
          {/* System to DB */}
          <g className="stroke-purple-500">
            <line x1="430" y1="280" x2="430" y2="350" strokeWidth="2" markerEnd="url(#arrow-right)" />
            <text x="400" y="320" className="fill-purple-600 text-[11px] font-medium">Write</text>
          </g>
          <g className="stroke-purple-400">
            <line x1="470" y1="350" x2="470" y2="280" strokeWidth="2" markerEnd="url(#arrow-right)" />
            <text x="500" y="320" className="fill-purple-600 text-[11px] font-medium">Read</text>
          </g>
          
          {/* Google OAuth to System */}
          <g className="stroke-orange-500">
            <line x1="300" y1="50" x2="400" y2="120" strokeWidth="2" markerEnd="url(#arrow-right)" />
            <text x="320" y="70" className="fill-orange-600 text-[11px] font-medium">JWT</text>
          </g>
          <g className="stroke-orange-400">
            <line x1="380" y1="120" x2="280" y2="60" strokeWidth="2" markerEnd="url(#arrow-right)" />
            <text x="360" y="110" className="fill-orange-600 text-[11px] font-medium">Auth</text>
          </g>
        </svg>
        
        {/* Entities */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2">
          <div className="w-32 h-32 rounded-full bg-white dark:bg-gray-800 border-3 border-blue-500 flex flex-col items-center justify-center shadow-lg">
            <UsersIcon className="h-8 w-8 text-blue-500 mb-1" />
            <span className="text-sm font-bold text-gray-800 dark:text-white">Network</span>
            <span className="text-sm font-bold text-gray-800 dark:text-white">Admin</span>
          </div>
        </div>
        
        <div className="absolute right-0 top-1/2 -translate-y-1/2">
          <div className="w-32 h-32 rounded-full bg-white dark:bg-gray-800 border-3 border-green-500 flex flex-col items-center justify-center shadow-lg">
            <ServerIcon className="h-8 w-8 text-green-500 mb-1" />
            <span className="text-sm font-bold text-gray-800 dark:text-white">Network</span>
            <span className="text-sm font-bold text-gray-800 dark:text-white">Devices</span>
          </div>
        </div>
        
        {/* Desktop Agent entity */}
        <div className="absolute right-[190px] top-1/2 -translate-y-1/2">
          <div className="w-20 h-20 rounded-full bg-white dark:bg-gray-800 border-3 border-cyan-500 flex flex-col items-center justify-center shadow-lg">
            <MonitorIcon className="h-6 w-6 text-cyan-500 mb-1" />
            <span className="text-[10px] font-bold text-gray-800 dark:text-white">Desktop</span>
            <span className="text-[10px] font-bold text-gray-800 dark:text-white">Agent</span>
          </div>
        </div>
        
        <div className="absolute left-1/4 top-0">
          <div className="w-28 h-28 rounded-full bg-white dark:bg-gray-800 border-3 border-orange-500 flex flex-col items-center justify-center shadow-lg">
            <CloudIcon className="h-7 w-7 text-orange-500 mb-1" />
            <span className="text-xs font-bold text-gray-800 dark:text-white">Google OAuth</span>
          </div>
        </div>
        
        <div className="absolute right-1/4 top-0">
          <div className="w-28 h-28 rounded-full bg-white dark:bg-gray-800 border-3 border-pink-500 flex flex-col items-center justify-center shadow-lg">
            <BrainCircuitIcon className="h-7 w-7 text-pink-500 mb-1" />
            <span className="text-xs font-bold text-gray-800 dark:text-white">Ollama</span>
          </div>
        </div>
        
        <div className="absolute left-1/2 -translate-x-1/2 bottom-0">
          <div className="px-6 py-3 bg-white dark:bg-gray-800 border-3 border-purple-500 rounded-lg flex items-center gap-3 shadow-lg">
            <DatabaseIcon className="h-7 w-7 text-purple-500" />
            <div>
              <span className="text-sm font-bold text-gray-800 dark:text-white block">MongoDB Atlas</span>
              <span className="text-[10px] text-gray-500">D1-D9</span>
            </div>
          </div>
        </div>
        
        {/* Central Process */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="w-48 h-48 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 flex flex-col items-center justify-center shadow-2xl border-4 border-indigo-300">
            <NetworkIcon className="h-12 w-12 text-white mb-2" />
            <span className="text-sm font-bold text-white text-center">Network Config</span>
            <span className="text-sm font-bold text-white text-center">Management</span>
            <span className="text-xs text-indigo-200 mt-1">0.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// DFD Level 1 - Main Processes (Card-Flow Layout)
function DFDLevel1() {
  const processFlows = [
    {
      id: '1.0', name: 'Authentication', color: 'blue',
      icon: ShieldIcon,
      userIn: 'Login Data', userOut: 'Login Result',
      external: { name: 'Google OAuth', icon: CloudIcon, color: 'orange' },
      extIn: 'OAuth Request', extOut: 'JWT Token',
      dataStores: ['D1 Users'],
    },
    {
      id: '2.0', name: 'Device Management', color: 'green',
      icon: ServerIcon,
      userIn: 'Manage Devices', userOut: 'Device List',
      external: { name: 'Desktop Agent', icon: MonitorIcon, color: 'cyan' },
      extIn: 'SSH Test via Agent', extOut: 'Connection Status',
      external2: { name: 'Network Devices', icon: ServerIcon, color: 'emerald' },
      dataStores: ['D2 Devices'],
    },
    {
      id: '3.0', name: 'Config Generation', color: 'pink',
      icon: BrainCircuitIcon,
      userIn: 'NL Prompt', userOut: 'Generated Config',
      external: { name: 'Ollama (LLM)', icon: BrainCircuitIcon, color: 'pink' },
      extIn: 'AI Request + Context', extOut: 'Generated Config',
      dataStores: ['D3 Configs', 'D5 YANG Models'],
    },
    {
      id: '4.0', name: 'Deployment', color: 'indigo',
      icon: ZapIcon,
      userIn: 'Deploy Config', userOut: 'Deploy Status',
      external: { name: 'Desktop Agent', icon: MonitorIcon, color: 'cyan' },
      extIn: 'SSH/NETCONF via Agent', extOut: 'Result',
      external2: { name: 'Network Devices', icon: ServerIcon, color: 'emerald' },
      dataStores: ['D3 Configs', 'D6 Agent Cmds'],
    },
    {
      id: '5.0', name: 'Backup Management', color: 'teal',
      icon: HistoryIcon,
      userIn: 'Create/Restore Backup', userOut: 'Backup List',
      external: { name: 'Desktop Agent', icon: MonitorIcon, color: 'cyan' },
      extIn: 'Fetch via Agent', extOut: 'Running Config',
      external2: { name: 'Network Devices', icon: ServerIcon, color: 'emerald' },
      dataStores: ['D4 Backups', 'D2 Devices'],
    },
    {
      id: '6.0', name: 'Console Management', color: 'violet',
      icon: TerminalIcon,
      userIn: 'Open Console', userOut: 'Shell Output',
      external: { name: 'Desktop Agent', icon: MonitorIcon, color: 'cyan' },
      extIn: 'SSH Session via Agent', extOut: 'Shell Stream',
      external2: { name: 'Network Devices', icon: ServerIcon, color: 'emerald' },
      dataStores: ['D7 Sessions', 'D6 Agent Cmds'],
    },
  ];

  const colorMap = {
    blue: { bg: 'bg-blue-500', border: 'border-blue-500', text: 'text-blue-600 dark:text-blue-400', light: 'bg-blue-50 dark:bg-blue-900/20', line: 'bg-blue-400' },
    green: { bg: 'bg-green-500', border: 'border-green-500', text: 'text-green-600 dark:text-green-400', light: 'bg-green-50 dark:bg-green-900/20', line: 'bg-green-400' },
    pink: { bg: 'bg-pink-500', border: 'border-pink-500', text: 'text-pink-600 dark:text-pink-400', light: 'bg-pink-50 dark:bg-pink-900/20', line: 'bg-pink-400' },
    indigo: { bg: 'bg-indigo-500', border: 'border-indigo-500', text: 'text-indigo-600 dark:text-indigo-400', light: 'bg-indigo-50 dark:bg-indigo-900/20', line: 'bg-indigo-400' },
    teal: { bg: 'bg-teal-500', border: 'border-teal-500', text: 'text-teal-600 dark:text-teal-400', light: 'bg-teal-50 dark:bg-teal-900/20', line: 'bg-teal-400' },
    violet: { bg: 'bg-violet-500', border: 'border-violet-500', text: 'text-violet-600 dark:text-violet-400', light: 'bg-violet-50 dark:bg-violet-900/20', line: 'bg-violet-400' },
    orange: { bg: 'bg-orange-500', border: 'border-orange-500', text: 'text-orange-600', light: 'bg-orange-50', line: 'bg-orange-400' },
    cyan: { bg: 'bg-cyan-500', border: 'border-cyan-500', text: 'text-cyan-600', light: 'bg-cyan-50', line: 'bg-cyan-400' },
    emerald: { bg: 'bg-emerald-500', border: 'border-emerald-500', text: 'text-emerald-600', light: 'bg-emerald-50', line: 'bg-emerald-400' },
  };

  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-2xl p-6">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 text-center flex items-center justify-center gap-2">
        <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center text-sm font-bold">1</div>
        Main Process Decomposition
      </h3>

      {/* Process Flow Rows */}
      <div className="space-y-3">
        {processFlows.map((p) => {
          const c = colorMap[p.color];
          const ExtIcon = p.external.icon;
          const PIcon = p.icon;
          return (
            <div key={p.id} className={`${c.light} rounded-xl p-4 border ${c.border} border-opacity-30`}>
              <div className="flex items-center gap-3 flex-wrap lg:flex-nowrap">
                {/* User Entity */}
                <div className="flex flex-col items-center min-w-[70px]">
                  <div className="w-14 h-14 border-2 border-gray-500 dark:border-gray-400 bg-white dark:bg-gray-800 rounded flex flex-col items-center justify-center">
                    <UsersIcon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                    <span className="text-[9px] font-bold text-gray-700 dark:text-gray-300">User</span>
                  </div>
                </div>

                {/* User → Process arrows */}
                <div className="flex flex-col items-center min-w-[90px]">
                  <span className={`text-[10px] font-medium ${c.text} whitespace-nowrap`}>{p.userIn} →</span>
                  <div className={`h-[2px] w-16 ${c.line} my-1`}></div>
                  <span className={`text-[10px] font-medium ${c.text} whitespace-nowrap`}>← {p.userOut}</span>
                </div>

                {/* Process Box */}
                <div className={`${c.bg} rounded-lg px-4 py-3 min-w-[140px] text-center shadow-md flex-shrink-0`}>
                  <div className="flex items-center justify-center gap-2">
                    <PIcon className="h-4 w-4 text-white" />
                    <span className="text-sm font-bold text-white">{p.id}</span>
                  </div>
                  <span className="text-xs text-white/90 block">{p.name}</span>
                </div>

                {/* Process → External arrows */}
                <div className="flex flex-col items-center min-w-[100px]">
                  <span className={`text-[10px] font-medium ${c.text} whitespace-nowrap`}>{p.extIn} →</span>
                  <div className={`h-[2px] w-16 ${c.line} my-1`}></div>
                  <span className={`text-[10px] font-medium ${c.text} whitespace-nowrap`}>← {p.extOut}</span>
                </div>

                {/* External Entity */}
                <div className={`border-2 ${colorMap[p.external.color]?.border || c.border} bg-white dark:bg-gray-800 rounded px-3 py-2 text-center min-w-[90px] flex-shrink-0`}>
                  <ExtIcon className={`h-5 w-5 mx-auto mb-1 ${colorMap[p.external.color]?.text || c.text}`} />
                  <span className="text-xs font-bold text-gray-800 dark:text-white block">{p.external.name}</span>
                </div>

                {/* Optional second external entity (Network Devices) */}
                {p.external2 && (
                  <>
                    <div className="flex flex-col items-center min-w-[60px]">
                      <span className="text-[10px] font-medium text-emerald-600 whitespace-nowrap">SSH/NETCONF →</span>
                      <div className="h-[2px] w-10 bg-emerald-400 my-1"></div>
                      <span className="text-[10px] font-medium text-emerald-600 whitespace-nowrap">← Response</span>
                    </div>
                    <div className="border-2 border-emerald-500 bg-white dark:bg-gray-800 rounded px-3 py-2 text-center min-w-[80px] flex-shrink-0">
                      <ServerIcon className="h-5 w-5 mx-auto mb-1 text-emerald-600" />
                      <span className="text-xs font-bold text-gray-800 dark:text-white block">Network</span>
                      <span className="text-[9px] text-gray-500 block">Devices</span>
                    </div>
                  </>
                )}

                {/* Data Stores */}
                <div className="flex items-center gap-1 ml-auto">
                  {p.dataStores.map((ds) => (
                    <span key={ds} className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-[9px] font-mono font-bold whitespace-nowrap">
                      {ds}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Data Stores Grid */}
      <div className="mt-6">
        <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
          <DatabaseIcon className="h-4 w-4 text-purple-500" />
          Data Stores
        </h4>
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
          {[
            { id: 'D1', name: 'Users' }, { id: 'D2', name: 'Devices' }, { id: 'D3', name: 'Configs' },
            { id: 'D4', name: 'Backups' }, { id: 'D5', name: 'YANG' }, { id: 'D6', name: 'Agent Cmds' },
            { id: 'D7', name: 'Sessions' },
          ].map((ds) => (
            <div key={ds.id} className="flex items-stretch rounded overflow-hidden border border-purple-300 dark:border-purple-700">
              <div className="px-2 py-1 bg-purple-500 text-white text-xs font-bold flex items-center">{ds.id}</div>
              <div className="px-2 py-1 bg-white dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-300 font-medium">{ds.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Process Table */}
      <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-lg">
        <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-3">
          <h4 className="text-base font-bold text-white">Process Specifications</h4>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-700">
              <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300 w-20">ID</th>
              <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300 w-40">Process Name</th>
              <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300">Description</th>
              <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300 w-48">Input Data</th>
              <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300 w-48">Output Data</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
            <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td className="px-4 py-3"><span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded font-mono text-xs font-bold">1.0</span></td>
              <td className="px-4 py-3 font-medium text-gray-800 dark:text-white">Authentication</td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Validates user identity via Google OAuth 2.0, issues JWT tokens, manages sessions</td>
              <td className="px-4 py-3 text-gray-500">Login credentials, OAuth callback</td>
              <td className="px-4 py-3 text-gray-500">JWT token, User session, Profile</td>
            </tr>
            <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td className="px-4 py-3"><span className="px-2 py-1 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded font-mono text-xs font-bold">2.0</span></td>
              <td className="px-4 py-3 font-medium text-gray-800 dark:text-white">Device Management</td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-400">CRUD for devices (router, switch, nexus, ios-xe), SSH/NETCONF testing via Desktop Agent</td>
              <td className="px-4 py-3 text-gray-500">Device data (IP, credentials, type)</td>
              <td className="px-4 py-3 text-gray-500">Device records, Connection status</td>
            </tr>
            <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td className="px-4 py-3"><span className="px-2 py-1 bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300 rounded font-mono text-xs font-bold">3.0</span></td>
              <td className="px-4 py-3 font-medium text-gray-800 dark:text-white">Config Generation</td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-400">AI-powered CLI/NETCONF XML generation (NX-OS System / IOS-XE native)</td>
              <td className="px-4 py-3 text-gray-500">Prompt, Device type, YANG models</td>
              <td className="px-4 py-3 text-gray-500">CLI/YANG config, Validation</td>
            </tr>
            <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td className="px-4 py-3"><span className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded font-mono text-xs font-bold">4.0</span></td>
              <td className="px-4 py-3 font-medium text-gray-800 dark:text-white">Deployment</td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Deploy via SSH (CLI) or NETCONF (NX-OS/IOS-XE YANG) through Desktop Agent</td>
              <td className="px-4 py-3 text-gray-500">Configuration, Device credentials</td>
              <td className="px-4 py-3 text-gray-500">Deployment status, Response</td>
            </tr>
            <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td className="px-4 py-3"><span className="px-2 py-1 bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 rounded font-mono text-xs font-bold">5.0</span></td>
              <td className="px-4 py-3 font-medium text-gray-800 dark:text-white">Backup Management</td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Store and restore device configurations via Desktop Agent, diff comparison</td>
              <td className="px-4 py-3 text-gray-500">Device ID, Backup parameters</td>
              <td className="px-4 py-3 text-gray-500">Backup records, Restore results</td>
            </tr>
            <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td className="px-4 py-3"><span className="px-2 py-1 bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 rounded font-mono text-xs font-bold">6.0</span></td>
              <td className="px-4 py-3 font-medium text-gray-800 dark:text-white">Console Management</td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Interactive SSH console sessions via Desktop Agent for real-time device management</td>
              <td className="px-4 py-3 text-gray-500">Device ID, Session parameters</td>
              <td className="px-4 py-3 text-gray-500">Shell session, Command output</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Reusable sub-process flow row component
function SubProcessRow({ id, name, color, userLabel, userOut, rightType, rightLabel, rightName, rightIcon: RightIcon, rightColor, rightLabelOut }) {
  const colorClasses = {
    green: 'bg-green-600', teal: 'bg-teal-600', pink: 'bg-pink-600', indigo: 'bg-indigo-600', emerald: 'bg-emerald-600',
  };
  return (
    <div className="flex items-center gap-3 flex-wrap md:flex-nowrap">
      {/* User input */}
      <div className="flex flex-col items-center min-w-[80px]">
        <span className="text-[10px] font-medium text-gray-500 whitespace-nowrap">{userLabel} →</span>
        <div className="h-[2px] w-12 bg-gray-400 my-0.5"></div>
        {userOut && <span className="text-[10px] font-medium text-gray-500 whitespace-nowrap">← {userOut}</span>}
      </div>

      {/* Process */}
      <div className={`${colorClasses[color] || 'bg-gray-600'} rounded-lg px-4 py-2 min-w-[120px] text-center shadow-md flex-shrink-0`}>
        <span className="text-sm font-bold text-white block">{id}</span>
        <span className="text-xs text-white/90 block">{name}</span>
      </div>

      {/* Right side flow */}
      <div className="flex flex-col items-center min-w-[80px]">
        <span className={`text-[10px] font-medium ${rightColor || 'text-gray-500'} whitespace-nowrap`}>{rightLabel} →</span>
        <div className={`h-[2px] w-12 ${rightColor ? 'bg-current' : 'bg-gray-400'} my-0.5`}></div>
        {rightLabelOut && <span className={`text-[10px] font-medium ${rightColor || 'text-gray-500'} whitespace-nowrap`}>← {rightLabelOut}</span>}
      </div>

      {/* Right entity/store */}
      {rightType === 'store' ? (
        <div className="flex items-stretch rounded overflow-hidden border border-purple-300 dark:border-purple-700 flex-shrink-0">
          <div className="px-2 py-1 bg-purple-500 text-white text-xs font-bold flex items-center">{rightName.split(' ')[0]}</div>
          <div className="px-2 py-1 bg-white dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-300 font-medium">{rightName.split(' ').slice(1).join(' ')}</div>
        </div>
      ) : (
        <div className={`border-2 ${rightColor === 'text-emerald-600' ? 'border-emerald-500' : 'border-gray-500'} bg-white dark:bg-gray-800 rounded px-3 py-2 text-center min-w-[80px] flex-shrink-0`}>
          {RightIcon && <RightIcon className={`h-4 w-4 mx-auto mb-0.5 ${rightColor || 'text-gray-600'}`} />}
          <span className="text-xs font-bold text-gray-800 dark:text-white block">{rightName}</span>
        </div>
      )}
    </div>
  );
}

// DFD Level 2 - Device Management Detail (Process 2.0)
function DFDLevel2() {
  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-2xl p-6">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 text-center flex items-center justify-center gap-2">
        <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center text-sm font-bold">2</div>
        Process 2.0 - Device Management Decomposition
      </h3>

      {/* User entity at top */}
      <div className="flex justify-center mb-4">
        <div className="border-2 border-gray-500 dark:border-gray-400 bg-white dark:bg-gray-800 rounded px-4 py-2 text-center">
          <UsersIcon className="h-5 w-5 text-gray-600 dark:text-gray-300 mx-auto" />
          <span className="text-xs font-bold text-gray-700 dark:text-gray-300">User</span>
        </div>
      </div>

      {/* Sub-process flow rows */}
      <div className="space-y-3 max-w-4xl mx-auto">
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-300 dark:border-green-800">
          <SubProcessRow id="2.1" name="Add Device" color="green" userLabel="Device Data" rightType="store" rightLabel="Save Record" rightName="D2 Devices" />
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-300 dark:border-green-800">
          <SubProcessRow id="2.2" name="Edit Device" color="green" userLabel="Edit Data" userOut="Confirmation" rightType="store" rightLabel="Update Record" rightLabelOut="Current Data" rightName="D2 Devices" />
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-300 dark:border-green-800">
          <SubProcessRow id="2.3" name="Delete Device" color="green" userLabel="Delete Request" userOut="Confirmation" rightType="store" rightLabel="Remove Record" rightName="D2 Devices" />
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-300 dark:border-emerald-800">
          <SubProcessRow id="2.4" name="Test Connection" color="emerald" userLabel="Test Request" userOut="Test Result" rightType="entity" rightLabel="SSH/NETCONF" rightLabelOut="Status" rightName="Network Devices" rightIcon={ServerIcon} rightColor="text-emerald-600" />
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-300 dark:border-green-800">
          <SubProcessRow id="2.5" name="List Devices" color="green" userLabel="View Request" userOut="Device List" rightType="store" rightLabel="Query All" rightLabelOut="All Records" rightName="D2 Devices" />
        </div>
      </div>

      {/* Sub-process Table */}
      <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-lg">
        <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-3">
          <h4 className="text-base font-bold text-white">Sub-Process Specifications (2.x)</h4>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-700">
              <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300 w-20">ID</th>
              <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300 w-40">Sub-Process</th>
              <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300">Description</th>
              <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300 w-40">Input</th>
              <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300 w-40">Output</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
            <tr><td className="px-4 py-2 font-mono text-green-600 font-bold">2.1</td><td className="px-4 py-2">Add Device</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">Add new device with IP, credentials, and type (router/switch/nexus/ios-xe)</td><td className="px-4 py-2 text-gray-500">Device data</td><td className="px-4 py-2 text-gray-500">Device record</td></tr>
            <tr><td className="px-4 py-2 font-mono text-green-600 font-bold">2.2</td><td className="px-4 py-2">Edit Device</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">Edit existing device info such as IP, port, credentials</td><td className="px-4 py-2 text-gray-500">Device ID, Updates</td><td className="px-4 py-2 text-gray-500">Updated record</td></tr>
            <tr><td className="px-4 py-2 font-mono text-green-600 font-bold">2.3</td><td className="px-4 py-2">Delete Device</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">Remove device and related data from system</td><td className="px-4 py-2 text-gray-500">Device ID</td><td className="px-4 py-2 text-gray-500">Delete confirmation</td></tr>
            <tr><td className="px-4 py-2 font-mono text-green-600 font-bold">2.4</td><td className="px-4 py-2">Test Connection</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">Test SSH/NETCONF connectivity via Desktop Agent to device</td><td className="px-4 py-2 text-gray-500">Device credentials</td><td className="px-4 py-2 text-gray-500">Connection status</td></tr>
            <tr><td className="px-4 py-2 font-mono text-green-600 font-bold">2.5</td><td className="px-4 py-2">List Devices</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">Display all devices with status and connection info</td><td className="px-4 py-2 text-gray-500">Filter options</td><td className="px-4 py-2 text-gray-500">Device list</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// DFD Level 3 - Configuration Generation Detail (Process 3.0)
function DFDLevel3() {
  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-2xl p-6">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 text-center flex items-center justify-center gap-2">
        <div className="w-8 h-8 rounded-full bg-pink-500 text-white flex items-center justify-center text-sm font-bold">3</div>
        Process 3.0 - Configuration Generation Decomposition
      </h3>

      {/* Vertical flow */}
      <div className="flex justify-center mb-4">
        <div className="border-2 border-gray-500 dark:border-gray-400 bg-white dark:bg-gray-800 rounded px-4 py-2 text-center">
          <UsersIcon className="h-5 w-5 text-gray-600 dark:text-gray-300 mx-auto" />
          <span className="text-xs font-bold text-gray-700 dark:text-gray-300">User</span>
        </div>
      </div>

      <div className="space-y-3 max-w-4xl mx-auto">
        {/* 3.1 Receive Prompt */}
        <div className="bg-pink-50 dark:bg-pink-900/20 rounded-xl p-4 border border-pink-300 dark:border-pink-800">
          <SubProcessRow id="3.1" name="Receive Prompt" color="pink" userLabel="NL Prompt" rightType="store" rightLabel="Read Device Info" rightLabelOut="Device Data" rightName="D2 Devices" />
        </div>

        <div className="flex justify-center"><div className="w-[2px] h-6 bg-gray-400"></div></div>

        {/* 3.2 Prepare Context */}
        <div className="bg-pink-50 dark:bg-pink-900/20 rounded-xl p-4 border border-pink-300 dark:border-pink-800">
          <div className="flex items-center gap-3 flex-wrap md:flex-nowrap">
            <div className="flex flex-col items-center min-w-[80px]">
              <span className="text-[10px] font-medium text-gray-500 whitespace-nowrap">Prompt + Device →</span>
              <div className="h-[2px] w-12 bg-gray-400 my-0.5"></div>
            </div>
            <div className="bg-pink-600 rounded-lg px-4 py-2 min-w-[120px] text-center shadow-md flex-shrink-0">
              <span className="text-sm font-bold text-white block">3.2</span>
              <span className="text-xs text-white/90 block">Prepare Context</span>
            </div>
            <div className="flex flex-col items-center min-w-[80px]">
              <span className="text-[10px] font-medium text-purple-500 whitespace-nowrap">Read YANG →</span>
              <div className="h-[2px] w-12 bg-purple-400 my-0.5"></div>
              <span className="text-[10px] font-medium text-purple-500 whitespace-nowrap">← YANG Models</span>
            </div>
            <div className="flex items-stretch rounded overflow-hidden border border-purple-300 dark:border-purple-700 flex-shrink-0">
              <div className="px-2 py-1 bg-purple-500 text-white text-xs font-bold flex items-center">D5</div>
              <div className="px-2 py-1 bg-white dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-300 font-medium">YANG Models</div>
            </div>
          </div>
        </div>

        <div className="flex justify-center"><div className="w-[2px] h-6 bg-gray-400"></div></div>

        {/* 3.3 Call LLM */}
        <div className="bg-pink-50 dark:bg-pink-900/20 rounded-xl p-4 border border-pink-300 dark:border-pink-800">
          <SubProcessRow id="3.3" name="Call LLM" color="pink" userLabel="Prompt + Context" rightType="entity" rightLabel="AI Request" rightLabelOut="Generated Config" rightName="Ollama (LLM)" rightIcon={BrainCircuitIcon} rightColor="text-pink-600" />
        </div>

        <div className="flex justify-center"><div className="w-[2px] h-6 bg-gray-400"></div></div>

        {/* 3.4 Validate Config */}
        <div className="bg-pink-50 dark:bg-pink-900/20 rounded-xl p-4 border border-pink-300 dark:border-pink-800">
          <SubProcessRow id="3.4" name="Validate Config" color="pink" userLabel="Raw Config" userOut="Review / Edit" rightType="store" rightLabel="Check Syntax" rightName="D5 YANG Models" />
        </div>

        <div className="flex justify-center"><div className="w-[2px] h-6 bg-gray-400"></div></div>

        {/* 3.5 Save Config */}
        <div className="bg-pink-50 dark:bg-pink-900/20 rounded-xl p-4 border border-pink-300 dark:border-pink-800">
          <SubProcessRow id="3.5" name="Save Config" color="pink" userLabel="Confirmed Config" rightType="store" rightLabel="Save to DB" rightName="D3 Configs" />
        </div>
      </div>

      {/* Sub-process Table */}
      <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-lg">
        <div className="bg-gradient-to-r from-pink-600 to-pink-700 px-6 py-3">
          <h4 className="text-base font-bold text-white">Sub-Process Specifications (3.x)</h4>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-700">
              <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300 w-20">ID</th>
              <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300 w-40">Sub-Process</th>
              <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300">Description</th>
              <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300 w-40">Input</th>
              <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300 w-40">Output</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
            <tr><td className="px-4 py-2 font-mono text-pink-600 font-bold">3.1</td><td className="px-4 py-2">Receive Prompt</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">Receive NL prompt from user, validate and detect config type</td><td className="px-4 py-2 text-gray-500">User prompt</td><td className="px-4 py-2 text-gray-500">Validated prompt</td></tr>
            <tr><td className="px-4 py-2 font-mono text-pink-600 font-bold">3.2</td><td className="px-4 py-2">Prepare Context</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">Load device info, detect type (NX-OS/IOS-XE), load YANG models for context</td><td className="px-4 py-2 text-gray-500">Device ID, Prompt</td><td className="px-4 py-2 text-gray-500">Full context + Type</td></tr>
            <tr><td className="px-4 py-2 font-mono text-pink-600 font-bold">3.3</td><td className="px-4 py-2">Call LLM</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">Send prompt to Ollama to generate CLI or NETCONF/YANG XML (NX-OS/IOS-XE)</td><td className="px-4 py-2 text-gray-500">Context + Prompt</td><td className="px-4 py-2 text-gray-500">CLI/YANG config</td></tr>
            <tr><td className="px-4 py-2 font-mono text-pink-600 font-bold">3.4</td><td className="px-4 py-2">Validate Config</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">Validate syntax and namespace (NX-OS: System, IOS-XE: native)</td><td className="px-4 py-2 text-gray-500">Raw config</td><td className="px-4 py-2 text-gray-500">Valid config</td></tr>
            <tr><td className="px-4 py-2 font-mono text-pink-600 font-bold">3.5</td><td className="px-4 py-2">Save Config</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">Save configuration (CLI/NETCONF) and explanation to database</td><td className="px-4 py-2 text-gray-500">Config + Explanation</td><td className="px-4 py-2 text-gray-500">Saved record</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// DFD Level 4 - Deployment Detail (Process 4.0)
function DFDLevel4() {
  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-2xl p-6">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 text-center flex items-center justify-center gap-2">
        <div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center text-sm font-bold">4</div>
        Process 4.0 - Configuration Deployment Decomposition
      </h3>

      <div className="flex justify-center mb-4">
        <div className="border-2 border-gray-500 dark:border-gray-400 bg-white dark:bg-gray-800 rounded px-4 py-2 text-center">
          <UsersIcon className="h-5 w-5 text-gray-600 dark:text-gray-300 mx-auto" />
          <span className="text-xs font-bold text-gray-700 dark:text-gray-300">User</span>
        </div>
      </div>

      <div className="space-y-3 max-w-4xl mx-auto">
        {/* 4.1 Select Config */}
        <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4 border border-indigo-300 dark:border-indigo-800">
          <SubProcessRow id="4.1" name="Select Config" color="indigo" userLabel="Select Config" rightType="store" rightLabel="Read Config" rightLabelOut="Config Data" rightName="D3 Configs" />
        </div>

        <div className="flex justify-center"><div className="w-[2px] h-6 bg-gray-400"></div></div>

        {/* 4.2 Load Device */}
        <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4 border border-indigo-300 dark:border-indigo-800">
          <SubProcessRow id="4.2" name="Load Device" color="indigo" userLabel="Config Data" rightType="store" rightLabel="Read Device" rightLabelOut="Connection Info" rightName="D2 Devices" />
        </div>

        <div className="flex justify-center"><div className="w-[2px] h-6 bg-gray-400"></div></div>

        {/* 4.3 Deploy Config */}
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-300 dark:border-emerald-800">
          <SubProcessRow id="4.3" name="Deploy Config" color="emerald" userLabel="Config + Device" rightType="entity" rightLabel="SSH/NETCONF Cmds" rightLabelOut="Response/ACK" rightName="Network Devices" rightIcon={ServerIcon} rightColor="text-emerald-600" />
        </div>

        <div className="flex justify-center"><div className="w-[2px] h-6 bg-gray-400"></div></div>

        {/* 4.4 Update Status */}
        <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4 border border-indigo-300 dark:border-indigo-800">
          <SubProcessRow id="4.4" name="Update Status" color="indigo" userLabel="Result" userOut="Deploy Result" rightType="store" rightLabel="Update Status" rightName="D3 Configs" />
        </div>
      </div>

      {/* Sub-process Table */}
      <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-lg">
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-3">
          <h4 className="text-base font-bold text-white">Sub-Process Specifications (4.x)</h4>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-700">
              <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300 w-20">ID</th>
              <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300 w-40">Sub-Process</th>
              <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300">Description</th>
              <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300 w-40">Input</th>
              <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300 w-40">Output</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
            <tr><td className="px-4 py-2 font-mono text-indigo-600 font-bold">4.1</td><td className="px-4 py-2">Select Config</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">User selects configuration (CLI/NETCONF) to deploy</td><td className="px-4 py-2 text-gray-500">Config ID</td><td className="px-4 py-2 text-gray-500">Config data</td></tr>
            <tr><td className="px-4 py-2 font-mono text-indigo-600 font-bold">4.2</td><td className="px-4 py-2">Load Device</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">Load device info, detect type (nexus/ios-xe/router/switch)</td><td className="px-4 py-2 text-gray-500">Device ID</td><td className="px-4 py-2 text-gray-500">Connection + Type</td></tr>
            <tr><td className="px-4 py-2 font-mono text-indigo-600 font-bold">4.3</td><td className="px-4 py-2">Deploy Config</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">Send config via SSH (CLI) or NETCONF/YANG (NX-OS: System, IOS-XE: native)</td><td className="px-4 py-2 text-gray-500">Config + Device</td><td className="px-4 py-2 text-gray-500">Deploy result</td></tr>
            <tr><td className="px-4 py-2 font-mono text-indigo-600 font-bold">4.4</td><td className="px-4 py-2">Update Status</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">Update deployment status and save history</td><td className="px-4 py-2 text-gray-500">Result</td><td className="px-4 py-2 text-gray-500">Updated status</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// DFD Level 5 - Backup Management Detail (Process 5.0)
function DFDLevel5() {
  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-2xl p-6">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 text-center flex items-center justify-center gap-2">
        <div className="w-8 h-8 rounded-full bg-teal-500 text-white flex items-center justify-center text-sm font-bold">5</div>
        Process 5.0 - Backup Management Decomposition
      </h3>

      <div className="flex justify-center mb-4">
        <div className="border-2 border-gray-500 dark:border-gray-400 bg-white dark:bg-gray-800 rounded px-4 py-2 text-center">
          <UsersIcon className="h-5 w-5 text-gray-600 dark:text-gray-300 mx-auto" />
          <span className="text-xs font-bold text-gray-700 dark:text-gray-300">User</span>
        </div>
      </div>

      <div className="space-y-3 max-w-4xl mx-auto">
        {/* 5.1 Start Backup */}
        <div className="bg-teal-50 dark:bg-teal-900/20 rounded-xl p-4 border border-teal-300 dark:border-teal-800">
          <SubProcessRow id="5.1" name="Start Backup" color="teal" userLabel="Create Backup" rightType="store" rightLabel="Read Device Info" rightLabelOut="Connection Data" rightName="D2 Devices" />
        </div>

        <div className="flex justify-center"><div className="w-[2px] h-6 bg-gray-400"></div></div>

        {/* 5.2 Fetch Config */}
        <div className="bg-teal-50 dark:bg-teal-900/20 rounded-xl p-4 border border-teal-300 dark:border-teal-800">
          <SubProcessRow id="5.2" name="Fetch Config" color="teal" userLabel="Device Info" rightType="entity" rightLabel="show running-config" rightLabelOut="Running Config" rightName="Network Devices" rightIcon={ServerIcon} rightColor="text-teal-600" />
        </div>

        <div className="flex justify-center"><div className="w-[2px] h-6 bg-gray-400"></div></div>

        {/* 5.3 Check Duplicate */}
        <div className="bg-teal-50 dark:bg-teal-900/20 rounded-xl p-4 border border-teal-300 dark:border-teal-800">
          <SubProcessRow id="5.3" name="Check Duplicate" color="teal" userLabel="Config Content" rightType="store" rightLabel="Check Hash" rightLabelOut="Duplicate Result" rightName="D4 Backups" />
        </div>

        <div className="flex justify-center"><div className="w-[2px] h-6 bg-gray-400"></div></div>

        {/* 5.4 Save Backup */}
        <div className="bg-teal-50 dark:bg-teal-900/20 rounded-xl p-4 border border-teal-300 dark:border-teal-800">
          <SubProcessRow id="5.4" name="Save Backup" color="teal" userLabel="New Backup" userOut="Save Confirmation" rightType="store" rightLabel="Store Backup" rightName="D4 Backups" />
        </div>
      </div>

      {/* Sub-process Table */}
      <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-lg">
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-6 py-3">
          <h4 className="text-base font-bold text-white">Sub-Process Specifications (5.x)</h4>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-700">
              <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300 w-20">ID</th>
              <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300 w-40">Sub-Process</th>
              <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300">Description</th>
              <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300 w-40">Input</th>
              <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300 w-40">Output</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
            <tr><td className="px-4 py-2 font-mono text-teal-600 font-bold">5.1</td><td className="px-4 py-2">Start Backup</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">Initiate backup process and load device info</td><td className="px-4 py-2 text-gray-500">Device ID</td><td className="px-4 py-2 text-gray-500">Device info</td></tr>
            <tr><td className="px-4 py-2 font-mono text-teal-600 font-bold">5.2</td><td className="px-4 py-2">Fetch Config</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">Connect via SSH through Agent Relay and fetch running-config</td><td className="px-4 py-2 text-gray-500">SSH credentials</td><td className="px-4 py-2 text-gray-500">Running config</td></tr>
            <tr><td className="px-4 py-2 font-mono text-teal-600 font-bold">5.3</td><td className="px-4 py-2">Check Duplicate</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">Calculate hash and check for duplicate with previous backups</td><td className="px-4 py-2 text-gray-500">Config content</td><td className="px-4 py-2 text-gray-500">Is duplicate</td></tr>
            <tr><td className="px-4 py-2 font-mono text-teal-600 font-bold">5.4</td><td className="px-4 py-2">Save Backup</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">Save backup with metadata, tags, and timestamp</td><td className="px-4 py-2 text-gray-500">Backup data</td><td className="px-4 py-2 text-gray-500">Backup record</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Data Dictionary Component
function DataDictionary() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <DatabaseIcon className="h-5 w-5" />
          Data Dictionary - Data Stores
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-700">
              <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300 w-20">Store ID</th>
              <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300 w-36">Name</th>
              <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300">Description</th>
              <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300 w-64">Key Attributes</th>
              <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300 w-32">MongoDB Collection</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
            <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td className="px-4 py-3"><span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded font-mono text-xs font-bold">D1</span></td>
              <td className="px-4 py-3 font-medium text-gray-800 dark:text-white">Users</td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-400">User accounts with OAuth integration</td>
              <td className="px-4 py-3 text-gray-500 font-mono text-xs">_id, email, name, googleId, agentToken, avatar, role</td>
              <td className="px-4 py-3"><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-xs">users</code></td>
            </tr>
            <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td className="px-4 py-3"><span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded font-mono text-xs font-bold">D2</span></td>
              <td className="px-4 py-3 font-medium text-gray-800 dark:text-white">Devices</td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Network device inventory with credentials</td>
              <td className="px-4 py-3 text-gray-500 font-mono text-xs">_id, name, type, ip_address, username, password, userId</td>
              <td className="px-4 py-3"><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-xs">devices</code></td>
            </tr>
            <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td className="px-4 py-3"><span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded font-mono text-xs font-bold">D3</span></td>
              <td className="px-4 py-3 font-medium text-gray-800 dark:text-white">Configurations</td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Generated and deployed configurations</td>
              <td className="px-4 py-3 text-gray-500 font-mono text-xs">_id, device_id, prompt, generated_config, status, userId</td>
              <td className="px-4 py-3"><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-xs">configurationhistories</code></td>
            </tr>
            <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td className="px-4 py-3"><span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded font-mono text-xs font-bold">D4</span></td>
              <td className="px-4 py-3 font-medium text-gray-800 dark:text-white">Backups</td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Device configuration backups with versioning</td>
              <td className="px-4 py-3 text-gray-500 font-mono text-xs">_id, device_id, backup_name, running_config, config_hash</td>
              <td className="px-4 py-3"><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-xs">configurationbackups</code></td>
            </tr>
            <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td className="px-4 py-3"><span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded font-mono text-xs font-bold">D5</span></td>
              <td className="px-4 py-3 font-medium text-gray-800 dark:text-white">YANG Models</td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-400">NETCONF data models for device configuration</td>
              <td className="px-4 py-3 text-gray-500 font-mono text-xs">_id, name, namespace, prefix, yang_content, device_type, userId</td>
              <td className="px-4 py-3"><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-xs">yangmodels</code></td>
            </tr>
            <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td className="px-4 py-3"><span className="px-2 py-1 bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300 rounded font-mono text-xs font-bold">D6</span></td>
              <td className="px-4 py-3 font-medium text-gray-800 dark:text-white">Agent Commands</td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-400">SSH/NETCONF commands relayed to Desktop Agent</td>
              <td className="px-4 py-3 text-gray-500 font-mono text-xs">_id, agentId, type, payload, status, result, userId</td>
              <td className="px-4 py-3"><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-xs">agentcommands</code></td>
            </tr>
            <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td className="px-4 py-3"><span className="px-2 py-1 bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300 rounded font-mono text-xs font-bold">D7</span></td>
              <td className="px-4 py-3 font-medium text-gray-800 dark:text-white">Agent Heartbeats</td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Desktop Agent online/offline heartbeat status</td>
              <td className="px-4 py-3 text-gray-500 font-mono text-xs">_id, agentId, timestamp, status, userId</td>
              <td className="px-4 py-3"><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-xs">agentheartbeats</code></td>
            </tr>
            <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td className="px-4 py-3"><span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 rounded font-mono text-xs font-bold">D8</span></td>
              <td className="px-4 py-3 font-medium text-gray-800 dark:text-white">Notifications</td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-400">System notifications for deploy/backup events</td>
              <td className="px-4 py-3 text-gray-500 font-mono text-xs">_id, userId, type, message, read, relatedId</td>
              <td className="px-4 py-3"><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-xs">notifications</code></td>
            </tr>
            <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td className="px-4 py-3"><span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 rounded font-mono text-xs font-bold">D9</span></td>
              <td className="px-4 py-3 font-medium text-gray-800 dark:text-white">Shell Sessions</td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Console / SSH interactive shell sessions via Agent</td>
              <td className="px-4 py-3 text-gray-500 font-mono text-xs">_id, agentId, deviceId, sessionType, status, userId</td>
              <td className="px-4 py-3"><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-xs">shellsessions</code></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// SVG Arrow Link Component with proper styling
function SVGArrowLink({ label, direction = 'right', color = 'gray', length = 'normal' }) {
  const colorClasses = {
    gray: 'text-gray-500 dark:text-gray-400',
    blue: 'text-blue-500',
    green: 'text-green-500',
    pink: 'text-pink-500',
    purple: 'text-purple-500',
    orange: 'text-orange-500',
    teal: 'text-teal-500',
    indigo: 'text-indigo-500',
  };
  
  const bgColorClasses = {
    gray: 'bg-gray-500 dark:bg-gray-400',
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    pink: 'bg-pink-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
    teal: 'bg-teal-500',
    indigo: 'bg-indigo-500',
  };
  
  const lengthClasses = {
    short: 'w-12',
    normal: 'w-20',
    long: 'w-28',
  };

  if (direction === 'both') {
    return (
      <div className="flex flex-col items-center">
        <span className={`text-[10px] font-medium mb-1 ${colorClasses[color]}`}>{label}</span>
        <div className="flex items-center">
          <div className={`w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[6px] ${bgColorClasses[color].replace('bg-', 'border-r-')}`}></div>
          <div className={`h-[2px] ${bgColorClasses[color]} ${lengthClasses[length]}`}></div>
          <div className={`w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[6px] ${bgColorClasses[color].replace('bg-', 'border-l-')}`}></div>
        </div>
      </div>
    );
  }
  
  if (direction === 'left') {
    return (
      <div className="flex flex-col items-center">
        <span className={`text-[10px] font-medium mb-1 ${colorClasses[color]}`}>{label}</span>
        <div className="flex items-center">
          <div className={`w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[6px] ${bgColorClasses[color].replace('bg-', 'border-r-')}`}></div>
          <div className={`h-[2px] ${bgColorClasses[color]} ${lengthClasses[length]}`}></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <span className={`text-[10px] font-medium mb-1 whitespace-nowrap ${colorClasses[color]}`}>{label}</span>
      <div className="flex items-center">
        <div className={`h-[2px] ${bgColorClasses[color]} ${lengthClasses[length]}`}></div>
        <div className={`w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[6px] ${bgColorClasses[color].replace('bg-', 'border-l-')}`}></div>
      </div>
    </div>
  );
}

// Process Circle Component for DFD
function ProcessCircle({ id, name, color = 'green', size = 'md' }) {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600 border-blue-400',
    green: 'from-green-500 to-green-600 border-green-400',
    pink: 'from-pink-500 to-pink-600 border-pink-400',
    purple: 'from-purple-500 to-purple-600 border-purple-400',
    orange: 'from-orange-500 to-orange-600 border-orange-400',
    teal: 'from-teal-500 to-teal-600 border-teal-400',
    indigo: 'from-indigo-500 to-indigo-600 border-indigo-400',
  };
  
  const sizeClasses = {
    sm: 'w-24 h-24',
    md: 'w-28 h-28',
  };

  return (
    <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br ${colorClasses[color]} border-3 flex flex-col items-center justify-center shadow-lg`}>
      <span className="text-white font-bold text-sm">{id}</span>
      <span className="text-white text-[10px] text-center px-2 leading-tight">{name}</span>
    </div>
  );
}

// Data Store Box Component for DFD
function DataStoreBox({ id, name }) {
  return (
    <div className="flex items-stretch">
      <div className="w-1 bg-purple-500"></div>
      <div className="border-t-2 border-b-2 border-purple-500 bg-white dark:bg-gray-800 px-4 py-2 min-w-[80px]">
        <div className="flex items-center gap-2">
          <span className="font-mono text-purple-600 dark:text-purple-400 font-bold text-sm">{id}</span>
          <span className="text-xs text-gray-700 dark:text-gray-300">{name}</span>
        </div>
      </div>
    </div>
  );
}

export default Diagrams;
