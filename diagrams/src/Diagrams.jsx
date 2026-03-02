import { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
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
  GlobeIcon,
  SunIcon,
  MoonIcon,
  ImageIcon
} from 'lucide-react';

function Diagrams({ darkMode, onToggleDarkMode }) {
  const [activeTab, setActiveTab] = useState('overview');
  const diagramRef = useRef(null);

  const tabs = [
    { id: 'overview', label: 'System Overview', icon: LayoutDashboardIcon },
    { id: 'context', label: 'Context Diagram', icon: GitBranchIcon },
    { id: 'dataflow', label: 'Data Flow Diagram', icon: LayersIcon },
  ];

  const handlePrint = () => {
    window.print();
  };

  const handleExportPNG = async () => {
    if (!diagramRef.current) return;
    
    try {
      const canvas = await html2canvas(diagramRef.current, {
        backgroundColor: darkMode ? '#030712' : '#f9fafb',
        scale: 2,
        useCORS: true,
        logging: false
      });
      
      const link = document.createElement('a');
      link.download = `netconfig-${activeTab}-diagram.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export diagram');
    }
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'dark bg-gray-950' : 'bg-gray-50'}`}>
      {/* Standalone Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
                  <NetworkIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <span className="text-lg font-bold text-gray-900 dark:text-white">NetConfig System Diagrams</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onToggleDarkMode}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                {darkMode ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
                {darkMode ? 'Light' : 'Dark'}
              </button>
              <button
                onClick={handleExportPNG}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <ImageIcon className="h-4 w-4" />
                Export PNG
              </button>
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
          <div ref={diagramRef} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 overflow-x-auto print:shadow-none print:p-0">
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
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">CLI commands, NETCONF/YANG XML (NX-OS System, IOS-XE native) via Agent Relay</td>
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
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">SSH/NETCONF commands, backup requests, console port scan via Agent Relay command queue (MongoDB)</td>
                <td className="px-4 py-3"><span className="px-2 py-1 bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300 rounded text-xs">HTTP Polling</span></td>
              </tr>
              <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3 font-mono text-cyan-600 font-bold">F12</td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">Desktop Agent</td>
                <td className="px-4 py-3 text-center"><ArrowRightIcon className="h-4 w-4 inline text-cyan-500" /></td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">System</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">SSH execution results, device configs, connection status, backup data</td>
                <td className="px-4 py-3"><span className="px-2 py-1 bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300 rounded text-xs">HTTP Polling</span></td>
              </tr>
              <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3 font-mono text-teal-600 font-bold">F13</td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">System</td>
                <td className="px-4 py-3 text-center"><ArrowRightIcon className="h-4 w-4 inline text-teal-500" /></td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">Desktop Agent</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Console port scan requests, serial port open/write commands (serialPortAvailable flag relay)</td>
                <td className="px-4 py-3"><span className="px-2 py-1 bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 rounded text-xs">HTTP Polling</span></td>
              </tr>
              <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3 font-mono text-teal-600 font-bold">F14</td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">Desktop Agent</td>
                <td className="px-4 py-3 text-center"><ArrowRightIcon className="h-4 w-4 inline text-teal-500" /></td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">System</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Available COM/serial port list, console session data, serial port I/O</td>
                <td className="px-4 py-3"><span className="px-2 py-1 bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 rounded text-xs">HTTP Polling</span></td>
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
    { id: 0, label: 'Level 0 - Context', desc: 'ขอบเขตระบบ' },
    { id: 1, label: 'Level 1 - Main Processes', desc: 'กระบวนการหลัก' },
    { id: 2, label: 'Level 2 - Device Mgmt', desc: 'Process 1.0' },
    { id: 3, label: 'Level 3 - Config Gen', desc: 'Process 2.0' },
    { id: 4, label: 'Level 4 - Deployment', desc: 'Process 3.0' },
    { id: 5, label: 'Level 5 - Backup', desc: 'Process 4.0' },
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
      
      <div className="relative min-w-[1100px] h-[520px]">
        <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 0 }}>
          <defs>
            <marker id="arrow-ctx" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" className="fill-gray-500 dark:fill-gray-400" />
            </marker>
          </defs>
          
          {/* Admin → System (blue) */}
          <line x1="155" y1="240" x2="330" y2="240" stroke="#3B82F6" strokeWidth="2" markerEnd="url(#arrow-ctx)" />
          <text x="242" y="230" className="fill-blue-500 dark:fill-blue-400 text-[11px] font-medium" textAnchor="middle">Config Requests</text>
          <line x1="330" y1="280" x2="155" y2="280" stroke="#3B82F6" strokeWidth="2" markerEnd="url(#arrow-ctx)" />
          <text x="242" y="300" className="fill-blue-500 dark:fill-blue-400 text-[11px] font-medium" textAnchor="middle">Generated Configs</text>
          
          {/* System → Desktop Agent (cyan) */}
          <line x1="575" y1="240" x2="685" y2="240" stroke="#06B6D4" strokeWidth="2" markerEnd="url(#arrow-ctx)" />
          <text x="630" y="230" className="fill-cyan-600 dark:fill-cyan-400 text-[11px] font-medium" textAnchor="middle">Commands</text>
          <line x1="685" y1="280" x2="575" y2="280" stroke="#06B6D4" strokeWidth="2" markerEnd="url(#arrow-ctx)" />
          <text x="630" y="300" className="fill-cyan-600 dark:fill-cyan-400 text-[11px] font-medium" textAnchor="middle">Results</text>
          
          {/* Desktop Agent → Network Devices (green) */}
          <line x1="840" y1="240" x2="960" y2="240" stroke="#22C55E" strokeWidth="2" markerEnd="url(#arrow-ctx)" />
          <text x="900" y="230" className="fill-green-600 dark:fill-green-400 text-[11px] font-medium" textAnchor="middle">SSH/NETCONF</text>
          <line x1="960" y1="280" x2="840" y2="280" stroke="#22C55E" strokeWidth="2" markerEnd="url(#arrow-ctx)" />
          <text x="900" y="300" className="fill-green-600 dark:fill-green-400 text-[11px] font-medium" textAnchor="middle">Running Config</text>
          
          {/* Google OAuth ↔ System (orange) */}
          <line x1="335" y1="110" x2="410" y2="170" stroke="#F97316" strokeWidth="2" markerEnd="url(#arrow-ctx)" />
          <text x="345" y="142" className="fill-orange-500 dark:fill-orange-400 text-[11px] font-medium">JWT</text>
          <line x1="430" y1="170" x2="360" y2="110" stroke="#F97316" strokeWidth="2" markerEnd="url(#arrow-ctx)" />
          <text x="415" y="132" className="fill-orange-500 dark:fill-orange-400 text-[11px] font-medium">Auth</text>
          
          {/* Ollama ↔ System (pink) */}
          <line x1="530" y1="170" x2="620" y2="110" stroke="#EC4899" strokeWidth="2" markerEnd="url(#arrow-ctx)" />
          <text x="595" y="132" className="fill-pink-500 dark:fill-pink-400 text-[11px] font-medium">AI Prompt</text>
          <line x1="640" y1="110" x2="550" y2="170" stroke="#EC4899" strokeWidth="2" markerEnd="url(#arrow-ctx)" />
          <text x="565" y="152" className="fill-pink-500 dark:fill-pink-400 text-[11px] font-medium">Config</text>
          
          {/* System ↔ MongoDB (purple) */}
          <line x1="440" y1="365" x2="440" y2="425" stroke="#A855F7" strokeWidth="2" markerEnd="url(#arrow-ctx)" />
          <text x="410" y="400" className="fill-purple-500 dark:fill-purple-400 text-[11px] font-medium">Write</text>
          <line x1="480" y1="425" x2="480" y2="365" stroke="#A855F7" strokeWidth="2" markerEnd="url(#arrow-ctx)" />
          <text x="505" y="400" className="fill-purple-500 dark:fill-purple-400 text-[11px] font-medium">Read</text>
        </svg>
        
        {/* Admin Entity - Left */}
        <div className="absolute left-[15px] top-[195px]">
          <div className="w-[130px] h-[130px] rounded-full bg-white dark:bg-gray-800 border-3 border-blue-500 flex flex-col items-center justify-center shadow-lg">
            <UsersIcon className="h-8 w-8 text-blue-500 mb-1" />
            <span className="text-sm font-bold text-gray-800 dark:text-white">Network</span>
            <span className="text-sm font-bold text-gray-800 dark:text-white">Admin</span>
          </div>
        </div>
        
        {/* Central System Process */}
        <div className="absolute left-[335px] top-[160px]">
          <div className="w-[240px] h-[200px] rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 flex flex-col items-center justify-center shadow-2xl border-4 border-indigo-300">
            <NetworkIcon className="h-12 w-12 text-white mb-2" />
            <span className="text-sm font-bold text-white text-center">Network Config</span>
            <span className="text-sm font-bold text-white text-center">Management</span>
            <span className="text-xs text-indigo-200 mt-1">0.0</span>
          </div>
        </div>
        
        {/* Desktop Agent - Right of Center */}
        <div className="absolute left-[685px] top-[215px]">
          <div className="w-[155px] h-[90px] bg-white dark:bg-gray-800 border-3 border-cyan-500 rounded-xl flex flex-col items-center justify-center shadow-lg">
            <MonitorIcon className="h-7 w-7 text-cyan-500 mb-1" />
            <span className="text-xs font-bold text-gray-800 dark:text-white">Desktop Agent</span>
            <span className="text-[10px] text-gray-500 dark:text-gray-400">(Electron App)</span>
          </div>
        </div>
        
        {/* Network Devices - Far Right */}
        <div className="absolute left-[960px] top-[195px]">
          <div className="w-[130px] h-[130px] rounded-full bg-white dark:bg-gray-800 border-3 border-green-500 flex flex-col items-center justify-center shadow-lg">
            <ServerIcon className="h-8 w-8 text-green-500 mb-1" />
            <span className="text-sm font-bold text-gray-800 dark:text-white">Network</span>
            <span className="text-sm font-bold text-gray-800 dark:text-white">Devices</span>
          </div>
        </div>
        
        {/* Google OAuth - Top Left */}
        <div className="absolute left-[260px] top-[5px]">
          <div className="w-[110px] h-[105px] rounded-full bg-white dark:bg-gray-800 border-3 border-orange-500 flex flex-col items-center justify-center shadow-lg">
            <CloudIcon className="h-7 w-7 text-orange-500 mb-1" />
            <span className="text-xs font-bold text-gray-800 dark:text-white">Google</span>
            <span className="text-[10px] text-gray-500 dark:text-gray-400">OAuth 2.0</span>
          </div>
        </div>
        
        {/* Ollama - Top Right */}
        <div className="absolute left-[590px] top-[5px]">
          <div className="w-[110px] h-[105px] rounded-full bg-white dark:bg-gray-800 border-3 border-pink-500 flex flex-col items-center justify-center shadow-lg">
            <BrainCircuitIcon className="h-7 w-7 text-pink-500 mb-1" />
            <span className="text-xs font-bold text-gray-800 dark:text-white">Ollama</span>
            <span className="text-[10px] text-gray-500 dark:text-gray-400">LLM</span>
          </div>
        </div>
        
        {/* MongoDB - Bottom Center */}
        <div className="absolute left-[355px] top-[425px]">
          <div className="px-6 py-3 bg-white dark:bg-gray-800 border-3 border-purple-500 rounded-lg flex items-center gap-3 shadow-lg">
            <DatabaseIcon className="h-7 w-7 text-purple-500" />
            <div>
              <span className="text-sm font-bold text-gray-800 dark:text-white block">MongoDB Atlas</span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400">D1-D9</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// DFD Level 1 - Main Processes (redesigned layout: minimal crossings, Desktop Agent as SSH gateway)
function DFDLevel1() {
  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-2xl p-6 overflow-x-auto">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 text-center flex items-center justify-center gap-2">
        <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center text-sm font-bold">1</div>
        Main Process Decomposition
      </h3>
      
      <div className="relative min-w-[1100px] h-[750px] mx-auto">
        <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 1 }}>
          <defs>
            <marker id="arrowL1" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#6B7280" />
            </marker>
          </defs>
          
          {/* ===== User → Processes (horizontal, no crossings) ===== */}
          {/* User ↔ 1.0 Auth */}
          <line x1="110" y1="68" x2="240" y2="68" stroke="#3B82F6" strokeWidth="1.5" markerEnd="url(#arrowL1)" />
          <text x="175" y="60" className="text-[10px] fill-blue-500 dark:fill-blue-400" textAnchor="middle">ข้อมูลเข้าสู่ระบบ</text>
          <line x1="240" y1="88" x2="110" y2="88" stroke="#3B82F6" strokeWidth="1.5" markerEnd="url(#arrowL1)" />
          <text x="175" y="106" className="text-[10px] fill-blue-500 dark:fill-blue-400" textAnchor="middle">ผลการเข้าสู่ระบบ</text>
          
          {/* User ↔ 2.0 Device */}
          <line x1="110" y1="188" x2="240" y2="188" stroke="#10B981" strokeWidth="1.5" markerEnd="url(#arrowL1)" />
          <text x="175" y="180" className="text-[10px] fill-green-500 dark:fill-green-400" textAnchor="middle">จัดการอุปกรณ์</text>
          <line x1="240" y1="208" x2="110" y2="208" stroke="#10B981" strokeWidth="1.5" markerEnd="url(#arrowL1)" />
          <text x="175" y="226" className="text-[10px] fill-green-500 dark:fill-green-400" textAnchor="middle">รายการอุปกรณ์</text>
          
          {/* User ↔ 3.0 Config */}
          <line x1="110" y1="308" x2="240" y2="308" stroke="#EC4899" strokeWidth="1.5" markerEnd="url(#arrowL1)" />
          <text x="175" y="300" className="text-[10px] fill-pink-500 dark:fill-pink-400" textAnchor="middle">Prompt ภาษาธรรมชาติ</text>
          <line x1="240" y1="328" x2="110" y2="328" stroke="#EC4899" strokeWidth="1.5" markerEnd="url(#arrowL1)" />
          <text x="175" y="346" className="text-[10px] fill-pink-500 dark:fill-pink-400" textAnchor="middle">คอนฟิกที่สร้าง</text>
          
          {/* User ↔ 4.0 Deploy */}
          <line x1="110" y1="428" x2="240" y2="428" stroke="#6366F1" strokeWidth="1.5" markerEnd="url(#arrowL1)" />
          <text x="175" y="420" className="text-[10px] fill-indigo-500 dark:fill-indigo-400" textAnchor="middle">Deploy คอนฟิก</text>
          <line x1="240" y1="448" x2="110" y2="448" stroke="#6366F1" strokeWidth="1.5" markerEnd="url(#arrowL1)" />
          <text x="175" y="466" className="text-[10px] fill-indigo-500 dark:fill-indigo-400" textAnchor="middle">สถานะ Deploy</text>
          
          {/* User ↔ 5.0 Backup */}
          <line x1="110" y1="548" x2="240" y2="548" stroke="#14B8A6" strokeWidth="1.5" markerEnd="url(#arrowL1)" />
          <text x="175" y="540" className="text-[10px] fill-teal-500 dark:fill-teal-400" textAnchor="middle">สร้าง/กู้คืน Backup</text>
          <line x1="240" y1="568" x2="110" y2="568" stroke="#14B8A6" strokeWidth="1.5" markerEnd="url(#arrowL1)" />
          <text x="175" y="586" className="text-[10px] fill-teal-500 dark:fill-teal-400" textAnchor="middle">รายการ Backup</text>
          
          {/* ===== Process → External Entities (right side, no crossings) ===== */}
          {/* 1.0 ↔ Google OAuth (horizontal - same height) */}
          <line x1="345" y1="68" x2="530" y2="55" stroke="#F97316" strokeWidth="1.5" markerEnd="url(#arrowL1)" />
          <text x="438" y="50" className="text-[10px] fill-orange-500 dark:fill-orange-400" textAnchor="middle">OAuth Request</text>
          <line x1="530" y1="75" x2="345" y2="88" stroke="#F97316" strokeWidth="1.5" markerEnd="url(#arrowL1)" />
          <text x="438" y="96" className="text-[10px] fill-orange-500 dark:fill-orange-400" textAnchor="middle">JWT Token</text>
          
          {/* 3.0 ↔ Ollama (horizontal - same height) */}
          <line x1="345" y1="308" x2="530" y2="175" stroke="#EC4899" strokeWidth="1.5" markerEnd="url(#arrowL1)" />
          <text x="448" y="228" className="text-[10px] fill-pink-500 dark:fill-pink-400" textAnchor="middle">AI Request</text>
          <line x1="530" y1="195" x2="345" y2="328" stroke="#EC4899" strokeWidth="1.5" markerEnd="url(#arrowL1)" />
          <text x="420" y="275" className="text-[10px] fill-pink-500 dark:fill-pink-400" textAnchor="middle">Generated Config</text>
          
          {/* ===== Processes → Desktop Agent (SSH gateway) ===== */}
          {/* 2.0 → Desktop Agent */}
          <line x1="345" y1="195" x2="700" y2="350" stroke="#06B6D4" strokeWidth="1.5" markerEnd="url(#arrowL1)" />
          <text x="540" y="260" className="text-[10px] fill-cyan-600 dark:fill-cyan-400">ทดสอบ SSH</text>
          <line x1="700" y1="370" x2="345" y2="205" stroke="#06B6D4" strokeWidth="1.5" markerEnd="url(#arrowL1)" />
          <text x="500" y="305" className="text-[10px] fill-cyan-600 dark:fill-cyan-400">สถานะเชื่อมต่อ</text>
          
          {/* 4.0 → Desktop Agent */}
          <line x1="345" y1="435" x2="700" y2="390" stroke="#06B6D4" strokeWidth="1.5" markerEnd="url(#arrowL1)" />
          <text x="530" y="400" className="text-[10px] fill-cyan-600 dark:fill-cyan-400">SSH/NETCONF via Agent</text>
          <line x1="700" y1="410" x2="345" y2="450" stroke="#06B6D4" strokeWidth="1.5" markerEnd="url(#arrowL1)" />
          <text x="530" y="445" className="text-[10px] fill-cyan-600 dark:fill-cyan-400">Deploy Result</text>
          
          {/* 5.0 → Desktop Agent */}
          <line x1="345" y1="555" x2="700" y2="430" stroke="#06B6D4" strokeWidth="1.5" markerEnd="url(#arrowL1)" />
          <text x="540" y="480" className="text-[10px] fill-cyan-600 dark:fill-cyan-400">Backup via Agent</text>
          <line x1="700" y1="450" x2="345" y2="565" stroke="#06B6D4" strokeWidth="1.5" markerEnd="url(#arrowL1)" />
          <text x="505" y="525" className="text-[10px] fill-cyan-600 dark:fill-cyan-400">Running Config</text>
          
          {/* Desktop Agent ↔ Network Device (horizontal) */}
          <line x1="830" y1="380" x2="920" y2="380" stroke="#22C55E" strokeWidth="2" markerEnd="url(#arrowL1)" />
          <text x="875" y="370" className="text-[10px] fill-green-600 dark:fill-green-400" textAnchor="middle">SSH</text>
          <line x1="920" y1="410" x2="830" y2="410" stroke="#22C55E" strokeWidth="2" markerEnd="url(#arrowL1)" />
          <text x="875" y="432" className="text-[10px] fill-green-600 dark:fill-green-400" textAnchor="middle">Response</text>
          
          {/* ===== Process → Data Stores (vertical down, minimal crossing) ===== */}
          <line x1="265" y1="100" x2="205" y2="665" stroke="#A855F7" strokeWidth="1" strokeDasharray="4,3" markerEnd="url(#arrowL1)" />
          <text x="218" y="400" className="text-[9px] fill-purple-500 dark:fill-purple-400" transform="rotate(-85, 218, 400)">User CRUD</text>
          
          <line x1="295" y1="220" x2="355" y2="665" stroke="#A855F7" strokeWidth="1" strokeDasharray="4,3" markerEnd="url(#arrowL1)" />
          <text x="340" y="450" className="text-[9px] fill-purple-500 dark:fill-purple-400" transform="rotate(-85, 340, 450)">Device CRUD</text>
          
          <line x1="310" y1="340" x2="505" y2="665" stroke="#A855F7" strokeWidth="1" strokeDasharray="4,3" markerEnd="url(#arrowL1)" />
          <text x="425" y="510" className="text-[9px] fill-purple-500 dark:fill-purple-400" transform="rotate(-75, 425, 510)">บันทึกคอนฟิก</text>
          
          <line x1="290" y1="460" x2="505" y2="665" stroke="#A855F7" strokeWidth="1" strokeDasharray="4,3" markerEnd="url(#arrowL1)" />
          <text x="385" y="580" className="text-[9px] fill-purple-500 dark:fill-purple-400" transform="rotate(-70, 385, 580)">อ่านคอนฟิก</text>
          
          <line x1="310" y1="580" x2="655" y2="665" stroke="#A855F7" strokeWidth="1" strokeDasharray="4,3" markerEnd="url(#arrowL1)" />
          <text x="495" y="625" className="text-[9px] fill-purple-500 dark:fill-purple-400" transform="rotate(-15, 495, 625)">Store Backup</text>
          
          <line x1="310" y1="320" x2="780" y2="665" stroke="#A855F7" strokeWidth="1" strokeDasharray="4,3" markerEnd="url(#arrowL1)" />
          <text x="560" y="500" className="text-[9px] fill-purple-500 dark:fill-purple-400" transform="rotate(-40, 560, 500)">อ่าน YANG</text>
          
          <line x1="760" y1="400" x2="900" y2="665" stroke="#A855F7" strokeWidth="1" strokeDasharray="4,3" markerEnd="url(#arrowL1)" />
          <text x="850" y="540" className="text-[9px] fill-purple-500 dark:fill-purple-400" transform="rotate(-70, 850, 540)">Command Queue</text>
        </svg>
        
        {/* User Entity */}
        <div className="absolute left-[10px] top-[210px] w-[95px]">
          <div className="border-2 border-blue-500 bg-white dark:bg-gray-800 px-3 py-10 text-center rounded-lg">
            <UsersIcon className="h-8 w-8 text-blue-500 mx-auto mb-2" />
            <span className="text-sm font-bold text-gray-800 dark:text-white">ผู้ใช้</span>
          </div>
        </div>
        
        {/* Google OAuth Entity (aligned with 1.0) */}
        <div className="absolute left-[530px] top-[35px]">
          <div className="border-2 border-orange-500 bg-white dark:bg-gray-800 px-5 py-3 text-center rounded-lg">
            <CloudIcon className="h-6 w-6 text-orange-500 mx-auto mb-1" />
            <span className="text-sm font-bold text-gray-800 dark:text-white">Google</span>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 block">OAuth 2.0</span>
          </div>
        </div>
        
        {/* Ollama Entity (between 1.0 and 3.0) */}
        <div className="absolute left-[530px] top-[155px]">
          <div className="border-2 border-pink-500 bg-white dark:bg-gray-800 px-5 py-3 text-center rounded-lg">
            <BrainCircuitIcon className="h-6 w-6 text-pink-500 mx-auto mb-1" />
            <span className="text-sm font-bold text-gray-800 dark:text-white">Ollama</span>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 block">LLM API</span>
          </div>
        </div>
        
        {/* Desktop Agent (SSH gateway, right-center) */}
        <div className="absolute left-[700px] top-[330px]">
          <div className="border-2 border-cyan-500 bg-cyan-50 dark:bg-cyan-900/30 px-4 py-4 text-center rounded-xl shadow-md">
            <MonitorIcon className="h-7 w-7 text-cyan-500 mx-auto mb-1" />
            <span className="text-sm font-bold text-gray-800 dark:text-white">Desktop</span>
            <span className="text-sm font-bold text-gray-800 dark:text-white block">Agent</span>
            <span className="text-[9px] text-cyan-600 dark:text-cyan-400 block mt-1">Agent Relay</span>
          </div>
        </div>
        
        {/* Network Device (far right, aligned with Desktop Agent) */}
        <div className="absolute left-[920px] top-[350px]">
          <div className="border-2 border-green-500 bg-white dark:bg-gray-800 px-4 py-4 text-center rounded-lg">
            <ServerIcon className="h-8 w-8 text-green-500 mx-auto mb-1" />
            <span className="text-sm font-bold text-gray-800 dark:text-white">อุปกรณ์</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 block">เครือข่าย</span>
          </div>
        </div>
        
        {/* Process 1.0 - Authentication */}
        <div className="absolute left-[240px] top-[55px]">
          <div className="w-[105px] h-[50px] rounded-lg bg-blue-500 dark:bg-blue-600 flex flex-col items-center justify-center shadow-md">
            <span className="text-xs font-bold text-white">1.0</span>
            <span className="text-[10px] text-white text-center">Authentication</span>
          </div>
        </div>
        
        {/* Process 2.0 - Device Management */}
        <div className="absolute left-[240px] top-[175px]">
          <div className="w-[105px] h-[50px] rounded-lg bg-green-500 dark:bg-green-600 flex flex-col items-center justify-center shadow-md">
            <span className="text-xs font-bold text-white">2.0</span>
            <span className="text-[10px] text-white text-center">Device Mgmt</span>
          </div>
        </div>
        
        {/* Process 3.0 - Config Generation */}
        <div className="absolute left-[240px] top-[295px]">
          <div className="w-[105px] h-[50px] rounded-lg bg-pink-500 dark:bg-pink-600 flex flex-col items-center justify-center shadow-md">
            <span className="text-xs font-bold text-white">3.0</span>
            <span className="text-[10px] text-white text-center">Config Gen</span>
          </div>
        </div>
        
        {/* Process 4.0 - Deployment */}
        <div className="absolute left-[240px] top-[415px]">
          <div className="w-[105px] h-[50px] rounded-lg bg-indigo-500 dark:bg-indigo-600 flex flex-col items-center justify-center shadow-md">
            <span className="text-xs font-bold text-white">4.0</span>
            <span className="text-[10px] text-white text-center">Deployment</span>
          </div>
        </div>
        
        {/* Process 5.0 - Backup Management */}
        <div className="absolute left-[240px] top-[535px]">
          <div className="w-[105px] h-[50px] rounded-lg bg-teal-500 dark:bg-teal-600 flex flex-col items-center justify-center shadow-md">
            <span className="text-xs font-bold text-white">5.0</span>
            <span className="text-[10px] text-white text-center">Backup Mgmt</span>
          </div>
        </div>
        
        {/* Data Stores - Bottom Row */}
        <div className="absolute left-[160px] bottom-[20px]">
          <div className="flex items-stretch">
            <div className="w-8 bg-white dark:bg-gray-800 border-t-2 border-b-2 border-l-2 border-purple-600 dark:border-purple-500 flex items-center justify-center">
              <span className="font-bold text-xs text-purple-600 dark:text-purple-400">D1</span>
            </div>
            <div className="border-2 border-purple-600 dark:border-purple-500 bg-white dark:bg-gray-800 px-3 py-2">
              <span className="text-xs font-medium text-gray-800 dark:text-white">Users</span>
            </div>
          </div>
        </div>
        
        <div className="absolute left-[310px] bottom-[20px]">
          <div className="flex items-stretch">
            <div className="w-8 bg-white dark:bg-gray-800 border-t-2 border-b-2 border-l-2 border-purple-600 dark:border-purple-500 flex items-center justify-center">
              <span className="font-bold text-xs text-purple-600 dark:text-purple-400">D2</span>
            </div>
            <div className="border-2 border-purple-600 dark:border-purple-500 bg-white dark:bg-gray-800 px-3 py-2">
              <span className="text-xs font-medium text-gray-800 dark:text-white">Devices</span>
            </div>
          </div>
        </div>
        
        <div className="absolute left-[460px] bottom-[20px]">
          <div className="flex items-stretch">
            <div className="w-8 bg-white dark:bg-gray-800 border-t-2 border-b-2 border-l-2 border-purple-600 dark:border-purple-500 flex items-center justify-center">
              <span className="font-bold text-xs text-purple-600 dark:text-purple-400">D3</span>
            </div>
            <div className="border-2 border-purple-600 dark:border-purple-500 bg-white dark:bg-gray-800 px-3 py-2">
              <span className="text-xs font-medium text-gray-800 dark:text-white">Configs</span>
            </div>
          </div>
        </div>
        
        <div className="absolute left-[610px] bottom-[20px]">
          <div className="flex items-stretch">
            <div className="w-8 bg-white dark:bg-gray-800 border-t-2 border-b-2 border-l-2 border-purple-600 dark:border-purple-500 flex items-center justify-center">
              <span className="font-bold text-xs text-purple-600 dark:text-purple-400">D4</span>
            </div>
            <div className="border-2 border-purple-600 dark:border-purple-500 bg-white dark:bg-gray-800 px-3 py-2">
              <span className="text-xs font-medium text-gray-800 dark:text-white">Backups</span>
            </div>
          </div>
        </div>
        
        <div className="absolute left-[740px] bottom-[20px]">
          <div className="flex items-stretch">
            <div className="w-8 bg-white dark:bg-gray-800 border-t-2 border-b-2 border-l-2 border-purple-600 dark:border-purple-500 flex items-center justify-center">
              <span className="font-bold text-xs text-purple-600 dark:text-purple-400">D5</span>
            </div>
            <div className="border-2 border-purple-600 dark:border-purple-500 bg-white dark:bg-gray-800 px-3 py-2">
              <span className="text-xs font-medium text-gray-800 dark:text-white">YANG</span>
            </div>
          </div>
        </div>
        
        <div className="absolute left-[860px] bottom-[20px]">
          <div className="flex items-stretch">
            <div className="w-8 bg-white dark:bg-gray-800 border-t-2 border-b-2 border-l-2 border-purple-600 dark:border-purple-500 flex items-center justify-center">
              <span className="font-bold text-xs text-purple-600 dark:text-purple-400">D6</span>
            </div>
            <div className="border-2 border-purple-600 dark:border-purple-500 bg-white dark:bg-gray-800 px-3 py-2">
              <span className="text-xs font-medium text-gray-800 dark:text-white">Agent Cmds</span>
            </div>
          </div>
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
              <td className="px-4 py-3 text-gray-500">JWT token, User session, User profile</td>
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
              <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Deploy via Agent Relay → Desktop Agent → SSH (CLI) or NETCONF, track status</td>
              <td className="px-4 py-3 text-gray-500">Configuration, Device credentials</td>
              <td className="px-4 py-3 text-gray-500">Deployment status, Device response</td>
            </tr>
            <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td className="px-4 py-3"><span className="px-2 py-1 bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 rounded font-mono text-xs font-bold">5.0</span></td>
              <td className="px-4 py-3 font-medium text-gray-800 dark:text-white">Backup Management</td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Backup/restore via Agent Relay → Desktop Agent → SSH, scheduled backups, diff comparison</td>
              <td className="px-4 py-3 text-gray-500">Device ID, Schedule parameters</td>
              <td className="px-4 py-3 text-gray-500">Backup records, Restore results</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// DFD Level 2 - Device Management Detail (Process 1.0)
function DFDLevel2() {
  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-2xl p-6 overflow-x-auto">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 text-center flex items-center justify-center gap-2">
        <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center text-sm font-bold">2</div>
        Process 1.0 - Device Management Decomposition
      </h3>
      
      {/* SVG-based DFD with connected arrows - increased spacing */}
      <div className="relative min-w-[950px] h-[750px] mx-auto">
        <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 1 }}>
          <defs>
            <marker id="arrowL2" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#6B7280" />
            </marker>
            <marker id="arrowL2Green" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#10B981" />
            </marker>
          </defs>
          
          {/* ===== Row 1: Process 1.1 เพิ่มอุปกรณ์ ===== */}
          {/* User to 1.1 */}
          <line x1="130" y1="70" x2="280" y2="70" stroke="#6B7280" strokeWidth="1.5" markerEnd="url(#arrowL2)" />
          <text x="205" y="60" className="text-[11px] fill-gray-500 dark:fill-gray-400" textAnchor="middle">ยืนยัน</text>
          {/* 1.1 to D1 */}
          <line x1="400" y1="70" x2="770" y2="70" stroke="#6B7280" strokeWidth="1.5" markerEnd="url(#arrowL2)" />
          <text x="585" y="60" className="text-[11px] fill-gray-500 dark:fill-gray-400" textAnchor="middle">บันทึกข้อมูล</text>
          
          {/* ===== Row 2: Process 1.2 แก้ไขอุปกรณ์ ===== */}
          {/* User to 1.2 */}
          <line x1="130" y1="180" x2="280" y2="180" stroke="#6B7280" strokeWidth="1.5" markerEnd="url(#arrowL2)" />
          <text x="205" y="170" className="text-[11px] fill-gray-500 dark:fill-gray-400" textAnchor="middle">แก้ไข</text>
          {/* 1.2 to User (confirm) */}
          <line x1="280" y1="210" x2="130" y2="210" stroke="#6B7280" strokeWidth="1.5" markerEnd="url(#arrowL2)" />
          <text x="205" y="228" className="text-[11px] fill-gray-500 dark:fill-gray-400" textAnchor="middle">ยืนยัน</text>
          {/* 1.2 to D1 */}
          <line x1="400" y1="180" x2="770" y2="180" stroke="#6B7280" strokeWidth="1.5" markerEnd="url(#arrowL2)" />
          <text x="585" y="170" className="text-[11px] fill-gray-500 dark:fill-gray-400" textAnchor="middle">อัปเดตข้อมูลอุปกรณ์</text>
          {/* D1 to 1.2 */}
          <line x1="770" y1="210" x2="400" y2="210" stroke="#6B7280" strokeWidth="1.5" markerEnd="url(#arrowL2)" />
          <text x="585" y="228" className="text-[11px] fill-gray-500 dark:fill-gray-400" textAnchor="middle">ข้อมูลปัจจุบัน</text>
          
          {/* ===== Row 3: Process 1.3 ลบอุปกรณ์ ===== */}
          {/* User to 1.3 */}
          <line x1="130" y1="310" x2="280" y2="310" stroke="#6B7280" strokeWidth="1.5" markerEnd="url(#arrowL2)" />
          <text x="205" y="300" className="text-[11px] fill-gray-500 dark:fill-gray-400" textAnchor="middle">ลบ</text>
          {/* 1.3 to User (confirm) */}
          <line x1="280" y1="340" x2="130" y2="340" stroke="#6B7280" strokeWidth="1.5" markerEnd="url(#arrowL2)" />
          <text x="205" y="358" className="text-[11px] fill-gray-500 dark:fill-gray-400" textAnchor="middle">ยืนยัน</text>
          {/* 1.3 to D1 */}
          <line x1="400" y1="310" x2="770" y2="310" stroke="#6B7280" strokeWidth="1.5" markerEnd="url(#arrowL2)" />
          <text x="585" y="300" className="text-[11px] fill-gray-500 dark:fill-gray-400" textAnchor="middle">ข้อมูลอุปกรณ์</text>
          {/* D1 to delete */}
          <line x1="770" y1="340" x2="400" y2="340" stroke="#6B7280" strokeWidth="1.5" markerEnd="url(#arrowL2)" />
          <text x="585" y="358" className="text-[11px] fill-gray-500 dark:fill-gray-400" textAnchor="middle">ลบอุปกรณ์</text>
          
          {/* ===== Row 4: Process 1.4 ทดสอบการเชื่อมต่อ ===== */}
          {/* User to 1.4 */}
          <line x1="130" y1="450" x2="280" y2="450" stroke="#6B7280" strokeWidth="1.5" markerEnd="url(#arrowL2)" />
          <text x="205" y="440" className="text-[11px] fill-gray-500 dark:fill-gray-400" textAnchor="middle">ทดสอบ</text>
          {/* 1.4 to User (result) */}
          <line x1="280" y1="480" x2="130" y2="480" stroke="#6B7280" strokeWidth="1.5" markerEnd="url(#arrowL2)" />
          <text x="205" y="498" className="text-[11px] fill-gray-500 dark:fill-gray-400" textAnchor="middle">ผลการทดสอบ</text>
          {/* 1.4 to Network Device */}
          <line x1="400" y1="465" x2="770" y2="465" stroke="#10B981" strokeWidth="1.5" markerEnd="url(#arrowL2Green)" />
          <text x="585" y="455" className="text-[11px] fill-emerald-600 dark:fill-emerald-400" textAnchor="middle">เชื่อมต่อ SSH/NETCONF</text>
          
          {/* ===== Row 5: Process 1.5 รายการอุปกรณ์ ===== */}
          {/* User to 1.5 */}
          <line x1="130" y1="590" x2="280" y2="590" stroke="#6B7280" strokeWidth="1.5" markerEnd="url(#arrowL2)" />
          <text x="205" y="580" className="text-[11px] fill-gray-500 dark:fill-gray-400" textAnchor="middle">ดูรายการ</text>
          {/* 1.5 to User (result) */}
          <line x1="280" y1="620" x2="130" y2="620" stroke="#6B7280" strokeWidth="1.5" markerEnd="url(#arrowL2)" />
          <text x="205" y="638" className="text-[11px] fill-gray-500 dark:fill-gray-400" textAnchor="middle">รายการอุปกรณ์</text>
          {/* 1.5 to D1 */}
          <line x1="400" y1="605" x2="770" y2="605" stroke="#6B7280" strokeWidth="1.5" markerEnd="url(#arrowL2)" />
          <text x="585" y="595" className="text-[11px] fill-gray-500 dark:fill-gray-400" textAnchor="middle">ข้อมูลอุปกรณ์ทั้งหมด</text>
        </svg>
        
        {/* User Entity - Centered Left */}
        <div className="absolute left-[20px] top-[280px] w-24">
          <div className="border-2 border-gray-600 dark:border-gray-500 bg-white dark:bg-gray-800 px-4 py-10 text-center">
            <span className="text-base font-bold text-gray-800 dark:text-white">ผู้ใช้</span>
          </div>
        </div>
        
        {/* Process 1.1 - เพิ่มอุปกรณ์ */}
        <div className="absolute left-[280px] top-[45px]">
          <div className="w-28 h-16 rounded-lg bg-teal-600 dark:bg-teal-700 flex flex-col items-center justify-center shadow-md">
            <span className="text-sm font-bold text-white">1.1</span>
            <span className="text-xs text-white text-center">เพิ่มอุปกรณ์</span>
          </div>
        </div>
        
        {/* Process 1.2 - แก้ไขอุปกรณ์ */}
        <div className="absolute left-[280px] top-[170px]">
          <div className="w-28 h-16 rounded-lg bg-teal-600 dark:bg-teal-700 flex flex-col items-center justify-center shadow-md">
            <span className="text-sm font-bold text-white">1.2</span>
            <span className="text-xs text-white text-center">แก้ไขอุปกรณ์</span>
          </div>
        </div>
        
        {/* Process 1.3 - ลบอุปกรณ์ */}
        <div className="absolute left-[280px] top-[300px]">
          <div className="w-28 h-16 rounded-lg bg-teal-600 dark:bg-teal-700 flex flex-col items-center justify-center shadow-md">
            <span className="text-sm font-bold text-white">1.3</span>
            <span className="text-xs text-white text-center">ลบอุปกรณ์</span>
          </div>
        </div>
        
        {/* Process 1.4 - ทดสอบการเชื่อมต่อ */}
        <div className="absolute left-[280px] top-[440px]">
          <div className="w-28 h-16 rounded-lg bg-teal-600 dark:bg-teal-700 flex flex-col items-center justify-center shadow-md">
            <span className="text-sm font-bold text-white">1.4</span>
            <span className="text-xs text-white text-center">ทดสอบการเชื่อมต่อ</span>
          </div>
        </div>
        
        {/* Process 1.5 - รายการอุปกรณ์ */}
        <div className="absolute left-[280px] top-[580px]">
          <div className="w-28 h-16 rounded-lg bg-teal-600 dark:bg-teal-700 flex flex-col items-center justify-center shadow-md">
            <span className="text-sm font-bold text-white">1.5</span>
            <span className="text-xs text-white text-center">รายการอุปกรณ์</span>
          </div>
        </div>
        
        {/* D1 Data Store - Centered Right */}
        <div className="absolute right-[30px] top-[200px]">
          <div className="flex items-stretch">
            <div className="w-10 bg-white dark:bg-gray-800 border-t-2 border-b-2 border-l-2 border-gray-600 dark:border-gray-500 flex items-center justify-center">
              <span className="font-bold text-base text-gray-800 dark:text-white">D1</span>
            </div>
            <div className="border-2 border-gray-600 dark:border-gray-500 bg-white dark:bg-gray-800 px-6 py-4">
              <span className="text-base font-medium text-gray-800 dark:text-white">ฐานข้อมูลอุปกรณ์</span>
            </div>
          </div>
        </div>
        
        {/* Network Device Entity */}
        <div className="absolute right-[30px] top-[430px]">
          <div className="border-2 border-emerald-500 bg-white dark:bg-gray-800 px-6 py-4 text-center">
            <ServerIcon className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
            <span className="text-base font-bold text-gray-800 dark:text-white">อุปกรณ์</span>
          </div>
        </div>
      </div>

      {/* Sub-process Table */}
      <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-lg">
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-6 py-3">
          <h4 className="text-base font-bold text-white">Sub-Process Specifications (1.x)</h4>
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
            <tr><td className="px-4 py-2 font-mono text-teal-600 font-bold">1.1</td><td className="px-4 py-2">เพิ่มอุปกรณ์</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">เพิ่มอุปกรณ์ใหม่ลงในระบบ พร้อมข้อมูล IP, credentials, ประเภท</td><td className="px-4 py-2 text-gray-500">Device data</td><td className="px-4 py-2 text-gray-500">Device record</td></tr>
            <tr><td className="px-4 py-2 font-mono text-teal-600 font-bold">1.2</td><td className="px-4 py-2">แก้ไขอุปกรณ์</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">แก้ไขข้อมูลอุปกรณ์ที่มีอยู่ เช่น IP, port, credentials</td><td className="px-4 py-2 text-gray-500">Device ID, Updates</td><td className="px-4 py-2 text-gray-500">Updated record</td></tr>
            <tr><td className="px-4 py-2 font-mono text-teal-600 font-bold">1.3</td><td className="px-4 py-2">ลบอุปกรณ์</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">ลบอุปกรณ์ออกจากระบบ พร้อมลบข้อมูลที่เกี่ยวข้อง</td><td className="px-4 py-2 text-gray-500">Device ID</td><td className="px-4 py-2 text-gray-500">Delete confirm</td></tr>
            <tr><td className="px-4 py-2 font-mono text-teal-600 font-bold">1.4</td><td className="px-4 py-2">ทดสอบการเชื่อมต่อ</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">ทดสอบการเชื่อมต่อ SSH/NETCONF ไปยังอุปกรณ์</td><td className="px-4 py-2 text-gray-500">Device credentials</td><td className="px-4 py-2 text-gray-500">Connection status</td></tr>
            <tr><td className="px-4 py-2 font-mono text-teal-600 font-bold">1.5</td><td className="px-4 py-2">รายการอุปกรณ์</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">แสดงรายการอุปกรณ์ทั้งหมดพร้อมสถานะ</td><td className="px-4 py-2 text-gray-500">Filter options</td><td className="px-4 py-2 text-gray-500">Device list</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// DFD Level 3 - Configuration Generation Detail (Process 2.0)
function DFDLevel3() {
  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-2xl p-6 overflow-x-auto">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 text-center flex items-center justify-center gap-2">
        <div className="w-8 h-8 rounded-full bg-pink-500 text-white flex items-center justify-center text-sm font-bold">3</div>
        Process 2.0 - Configuration Generation Decomposition
      </h3>
      
      {/* SVG-based DFD with connected arrows - increased spacing */}
      <div className="relative min-w-[950px] h-[800px] mx-auto">
        <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 1 }}>
          <defs>
            <marker id="arrowL3" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#6B7280" />
            </marker>
            <marker id="arrowL3Pink" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#EC4899" />
            </marker>
            <marker id="arrowL3Purple" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#A855F7" />
            </marker>
          </defs>
          
          {/* ===== Row 1: Process 2.1 รับ prompts ===== */}
          {/* User to 2.1 */}
          <line x1="130" y1="70" x2="280" y2="70" stroke="#6B7280" strokeWidth="1.5" markerEnd="url(#arrowL3)" />
          <text x="205" y="60" className="text-[11px] fill-gray-500 dark:fill-gray-400" textAnchor="middle">ข้อความ prompts</text>
          {/* 2.1 to D1 */}
          <line x1="400" y1="70" x2="770" y2="70" stroke="#6B7280" strokeWidth="1.5" markerEnd="url(#arrowL3)" />
          <text x="585" y="60" className="text-[11px] fill-gray-500 dark:fill-gray-400" textAnchor="middle">อ่านข้อมูลอุปกรณ์</text>
          
          {/* ===== Row 2: Process 2.2 เตรียมบริบท ===== */}
          {/* 2.1 to 2.2 vertical */}
          <line x1="340" y1="100" x2="340" y2="170" stroke="#6B7280" strokeWidth="1.5" markerEnd="url(#arrowL3)" />
          <text x="265" y="145" className="text-[11px] fill-gray-500 dark:fill-gray-400">prompts</text>
          {/* D1 to 2.2 */}
          <line x1="770" y1="90" x2="400" y2="185" stroke="#6B7280" strokeWidth="1.5" markerEnd="url(#arrowL3)" />
          <text x="585" y="130" className="text-[11px] fill-gray-500 dark:fill-gray-400" textAnchor="middle">ข้อมูลอุปกรณ์</text>
          
          {/* ===== Row 3: Process 2.3 เรียกใช้ LLM ===== */}
          {/* 2.2 to 2.3 vertical */}
          <line x1="340" y1="230" x2="340" y2="300" stroke="#6B7280" strokeWidth="1.5" markerEnd="url(#arrowL3)" />
          <text x="230" y="275" className="text-[11px] fill-gray-500 dark:fill-gray-400">prompts + context</text>
          {/* 2.3 to Ollama */}
          <line x1="400" y1="320" x2="770" y2="260" stroke="#EC4899" strokeWidth="1.5" markerEnd="url(#arrowL3Pink)" />
          <text x="585" y="280" className="text-[11px] fill-pink-500 dark:fill-pink-400" textAnchor="middle">ส่ง prompts</text>
          {/* Ollama to 2.3 */}
          <line x1="770" y1="280" x2="400" y2="340" stroke="#EC4899" strokeWidth="1.5" markerEnd="url(#arrowL3Pink)" />
          <text x="585" y="320" className="text-[11px] fill-pink-500 dark:fill-pink-400" textAnchor="middle">คอนฟิกที่สร้าง</text>
          
          {/* ===== Row 4: Process 2.4 ตรวจสอบคอนฟิก ===== */}
          {/* 2.3 to 2.4 vertical */}
          <line x1="340" y1="370" x2="340" y2="440" stroke="#6B7280" strokeWidth="1.5" markerEnd="url(#arrowL3)" />
          <text x="250" y="415" className="text-[11px] fill-gray-500 dark:fill-gray-400">คอนฟิกที่สร้าง</text>
          {/* 2.4 to User (review) */}
          <line x1="280" y1="460" x2="130" y2="460" stroke="#6B7280" strokeWidth="1.5" markerEnd="url(#arrowL3)" />
          <text x="205" y="450" className="text-[11px] fill-gray-500 dark:fill-gray-400" textAnchor="middle">ตรวจสอบคอนฟิก</text>
          {/* User to 2.4 (feedback) */}
          <line x1="130" y1="490" x2="280" y2="490" stroke="#6B7280" strokeWidth="1.5" markerEnd="url(#arrowL3)" />
          <text x="205" y="508" className="text-[11px] fill-gray-500 dark:fill-gray-400" textAnchor="middle">ยืนยัน/แก้ไข</text>
          
          {/* ===== Row 5: Process 2.5 บันทึกคอนฟิก ===== */}
          {/* 2.4 to 2.5 vertical */}
          <line x1="340" y1="510" x2="340" y2="580" stroke="#6B7280" strokeWidth="1.5" markerEnd="url(#arrowL3)" />
          <text x="265" y="555" className="text-[11px] fill-gray-500 dark:fill-gray-400">คอนฟิก</text>
          {/* 2.5 to D2 */}
          <line x1="400" y1="605" x2="770" y2="605" stroke="#A855F7" strokeWidth="1.5" markerEnd="url(#arrowL3Purple)" />
          <text x="585" y="595" className="text-[11px] fill-purple-500 dark:fill-purple-400" textAnchor="middle">บันทึกประวัติการสร้างคอนฟิก</text>
        </svg>
        
        {/* User Entity - Centered Left */}
        <div className="absolute left-[20px] top-[250px] w-24">
          <div className="border-2 border-gray-600 dark:border-gray-500 bg-white dark:bg-gray-800 px-4 py-10 text-center">
            <span className="text-base font-bold text-gray-800 dark:text-white">ผู้ใช้</span>
          </div>
        </div>
        
        {/* Process 2.1 - รับ prompts */}
        <div className="absolute left-[280px] top-[45px]">
          <div className="w-28 h-16 rounded-lg bg-pink-600 dark:bg-pink-700 flex flex-col items-center justify-center shadow-md">
            <span className="text-sm font-bold text-white">2.1</span>
            <span className="text-xs text-white text-center">รับ prompts</span>
          </div>
        </div>
        
        {/* Process 2.2 - เตรียมบริบท */}
        <div className="absolute left-[280px] top-[175px]">
          <div className="w-28 h-16 rounded-lg bg-pink-600 dark:bg-pink-700 flex flex-col items-center justify-center shadow-md">
            <span className="text-sm font-bold text-white">2.2</span>
            <span className="text-xs text-white text-center">เตรียมบริบท</span>
          </div>
        </div>
        
        {/* Process 2.3 - เรียกใช้ LLM */}
        <div className="absolute left-[280px] top-[305px]">
          <div className="w-28 h-16 rounded-lg bg-pink-600 dark:bg-pink-700 flex flex-col items-center justify-center shadow-md">
            <span className="text-sm font-bold text-white">2.3</span>
            <span className="text-xs text-white text-center">เรียกใช้ LLM</span>
          </div>
        </div>
        
        {/* Process 2.4 - ตรวจสอบคอนฟิก */}
        <div className="absolute left-[280px] top-[445px]">
          <div className="w-28 h-16 rounded-lg bg-pink-600 dark:bg-pink-700 flex flex-col items-center justify-center shadow-md">
            <span className="text-sm font-bold text-white">2.4</span>
            <span className="text-xs text-white text-center">ตรวจสอบคอนฟิก</span>
          </div>
        </div>
        
        {/* Process 2.5 - บันทึกคอนฟิก */}
        <div className="absolute left-[280px] top-[585px]">
          <div className="w-28 h-16 rounded-lg bg-pink-600 dark:bg-pink-700 flex flex-col items-center justify-center shadow-md">
            <span className="text-sm font-bold text-white">2.5</span>
            <span className="text-xs text-white text-center">บันทึกคอนฟิก</span>
          </div>
        </div>
        
        {/* D1 Data Store - Devices */}
        <div className="absolute right-[30px] top-[45px]">
          <div className="flex items-stretch">
            <div className="w-10 bg-white dark:bg-gray-800 border-t-2 border-b-2 border-l-2 border-gray-600 dark:border-gray-500 flex items-center justify-center">
              <span className="font-bold text-base text-gray-800 dark:text-white">D1</span>
            </div>
            <div className="border-2 border-gray-600 dark:border-gray-500 bg-white dark:bg-gray-800 px-6 py-4">
              <span className="text-base font-medium text-gray-800 dark:text-white">ฐานข้อมูลอุปกรณ์</span>
            </div>
          </div>
        </div>
        
        {/* Ollama External Entity */}
        <div className="absolute right-[30px] top-[235px]">
          <div className="border-2 border-pink-500 bg-white dark:bg-gray-800 px-6 py-4 text-center">
            <BrainCircuitIcon className="h-8 w-8 text-pink-500 mx-auto mb-2" />
            <span className="text-base font-bold text-gray-800 dark:text-white">Ollama</span>
            <div className="text-[10px] text-gray-500 mt-1">(LLM API)</div>
          </div>
        </div>
        
        {/* D2 Data Store - Config History */}
        <div className="absolute right-[30px] top-[580px]">
          <div className="flex items-stretch">
            <div className="w-10 bg-white dark:bg-gray-800 border-t-2 border-b-2 border-l-2 border-gray-600 dark:border-gray-500 flex items-center justify-center">
              <span className="font-bold text-base text-gray-800 dark:text-white">D2</span>
            </div>
            <div className="border-2 border-gray-600 dark:border-gray-500 bg-white dark:bg-gray-800 px-5 py-4">
              <span className="text-sm font-medium text-gray-800 dark:text-white">ฐานข้อมูลประวัติการคอนฟิก</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-process Table */}
      <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-lg">
        <div className="bg-gradient-to-r from-pink-600 to-pink-700 px-6 py-3">
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
            <tr><td className="px-4 py-2 font-mono text-pink-600 font-bold">2.1</td><td className="px-4 py-2">รับ prompts</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">รับข้อความ prompts จากผู้ใช้และตรวจสอบความถูกต้อง พร้อมตรวจจับประเภทคอนฟิก</td><td className="px-4 py-2 text-gray-500">User prompt</td><td className="px-4 py-2 text-gray-500">Validated prompt</td></tr>
            <tr><td className="px-4 py-2 font-mono text-pink-600 font-bold">2.2</td><td className="px-4 py-2">เตรียมบริบท</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">โหลดข้อมูลอุปกรณ์ ตรวจจับประเภท (NX-OS/IOS-XE) และ YANG models เพื่อสร้าง context</td><td className="px-4 py-2 text-gray-500">Device ID, Prompt</td><td className="px-4 py-2 text-gray-500">Full context + Type</td></tr>
            <tr><td className="px-4 py-2 font-mono text-pink-600 font-bold">2.3</td><td className="px-4 py-2">เรียกใช้ LLM</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">ส่ง prompt ไปยัง Ollama เพื่อสร้าง CLI หรือ NETCONF/YANG XML (NX-OS/IOS-XE)</td><td className="px-4 py-2 text-gray-500">Context + Prompt</td><td className="px-4 py-2 text-gray-500">CLI/YANG config</td></tr>
            <tr><td className="px-4 py-2 font-mono text-pink-600 font-bold">2.4</td><td className="px-4 py-2">ตรวจสอบคอนฟิก</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">ตรวจสอบ syntax และ namespace (NX-OS: System, IOS-XE: native)</td><td className="px-4 py-2 text-gray-500">Raw config</td><td className="px-4 py-2 text-gray-500">Valid config</td></tr>
            <tr><td className="px-4 py-2 font-mono text-pink-600 font-bold">2.5</td><td className="px-4 py-2">บันทึกคอนฟิก</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">บันทึก configuration (CLI/NETCONF) และ explanation ลงฐานข้อมูล</td><td className="px-4 py-2 text-gray-500">Config + Explanation</td><td className="px-4 py-2 text-gray-500">Saved record</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// DFD Level 4 - Deployment Detail (Process 3.0)
function DFDLevel4() {
  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-2xl p-6 overflow-x-auto">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 text-center flex items-center justify-center gap-2">
        <div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center text-sm font-bold">4</div>
        Process 3.0 - Configuration Deployment Decomposition
      </h3>
      
      {/* SVG-based DFD with connected arrows */}
      {/* SVG-based DFD with connected arrows - increased spacing */}
      <div className="relative min-w-[950px] h-[650px] mx-auto">
        <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 1 }}>
          <defs>
            <marker id="arrowL4" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#6B7280" />
            </marker>
            <marker id="arrowL4Green" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#10B981" />
            </marker>
            <marker id="arrowL4Purple" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#A855F7" />
            </marker>
          </defs>
          
          {/* ===== Row 1: Process 3.1 เลือกคอนฟิก ===== */}
          {/* User to 3.1 */}
          <line x1="130" y1="70" x2="280" y2="70" stroke="#6B7280" strokeWidth="1.5" markerEnd="url(#arrowL4)" />
          <text x="205" y="60" className="text-[11px] fill-gray-500 dark:fill-gray-400" textAnchor="middle">เลือกคอนฟิก</text>
          {/* 3.1 to D1 (read config) */}
          <line x1="400" y1="70" x2="770" y2="70" stroke="#6B7280" strokeWidth="1.5" markerEnd="url(#arrowL4)" />
          <text x="585" y="60" className="text-[11px] fill-gray-500 dark:fill-gray-400" textAnchor="middle">อ่านคอนฟิก</text>
          {/* D1 to 3.1 */}
          <line x1="770" y1="90" x2="400" y2="90" stroke="#6B7280" strokeWidth="1.5" markerEnd="url(#arrowL4)" />
          <text x="585" y="108" className="text-[11px] fill-gray-500 dark:fill-gray-400" textAnchor="middle">ข้อมูลคอนฟิก</text>
          
          {/* ===== Row 2: Process 3.2 โหลดอุปกรณ์ ===== */}
          {/* 3.1 to 3.2 vertical */}
          <line x1="340" y1="100" x2="340" y2="170" stroke="#6B7280" strokeWidth="1.5" markerEnd="url(#arrowL4)" />
          <text x="270" y="145" className="text-[11px] fill-gray-500 dark:fill-gray-400">คอนฟิก</text>
          {/* 3.2 to D2 (read device) */}
          <line x1="400" y1="190" x2="770" y2="190" stroke="#6B7280" strokeWidth="1.5" markerEnd="url(#arrowL4)" />
          <text x="585" y="180" className="text-[11px] fill-gray-500 dark:fill-gray-400" textAnchor="middle">อ่านข้อมูลอุปกรณ์</text>
          {/* D2 to 3.2 */}
          <line x1="770" y1="210" x2="400" y2="210" stroke="#6B7280" strokeWidth="1.5" markerEnd="url(#arrowL4)" />
          <text x="585" y="228" className="text-[11px] fill-gray-500 dark:fill-gray-400" textAnchor="middle">ข้อมูลการเชื่อมต่อ</text>
          
          {/* ===== Row 3: Process 3.3 Deploy คอนฟิก ===== */}
          {/* 3.2 to 3.3 vertical */}
          <line x1="340" y1="230" x2="340" y2="310" stroke="#6B7280" strokeWidth="1.5" markerEnd="url(#arrowL4)" />
          <text x="240" y="280" className="text-[11px] fill-gray-500 dark:fill-gray-400">คอนฟิก+อุปกรณ์</text>
          {/* 3.3 to Network Device */}
          <line x1="400" y1="330" x2="770" y2="330" stroke="#10B981" strokeWidth="1.5" markerEnd="url(#arrowL4Green)" />
          <text x="585" y="320" className="text-[11px] fill-emerald-600 dark:fill-emerald-400" textAnchor="middle">SSH/NETCONF via Agent</text>
          {/* Network Device to 3.3 */}
          <line x1="770" y1="360" x2="400" y2="360" stroke="#10B981" strokeWidth="1.5" markerEnd="url(#arrowL4Green)" />
          <text x="585" y="378" className="text-[11px] fill-emerald-600 dark:fill-emerald-400" textAnchor="middle">Response/ACK</text>
          
          {/* ===== Row 4: Process 3.4 อัปเดตสถานะ ===== */}
          {/* 3.3 to 3.4 vertical */}
          <line x1="340" y1="390" x2="340" y2="460" stroke="#6B7280" strokeWidth="1.5" markerEnd="url(#arrowL4)" />
          <text x="270" y="435" className="text-[11px] fill-gray-500 dark:fill-gray-400">ผลลัพธ์</text>
          {/* 3.4 to User */}
          <line x1="280" y1="480" x2="130" y2="480" stroke="#6B7280" strokeWidth="1.5" markerEnd="url(#arrowL4)" />
          <text x="205" y="470" className="text-[11px] fill-gray-500 dark:fill-gray-400" textAnchor="middle">แสดงผลลัพธ์</text>
          {/* 3.4 to D1 (update status) */}
          <line x1="400" y1="480" x2="770" y2="480" stroke="#A855F7" strokeWidth="1.5" markerEnd="url(#arrowL4Purple)" />
          <text x="585" y="470" className="text-[11px] fill-purple-500 dark:fill-purple-400" textAnchor="middle">อัปเดตสถานะ Deploy</text>
        </svg>
        
        {/* User Entity - Centered Left */}
        <div className="absolute left-[20px] top-[230px] w-24">
          <div className="border-2 border-gray-600 dark:border-gray-500 bg-white dark:bg-gray-800 px-4 py-10 text-center">
            <span className="text-base font-bold text-gray-800 dark:text-white">ผู้ใช้</span>
          </div>
        </div>
        
        {/* Process 3.1 - เลือกคอนฟิก */}
        <div className="absolute left-[280px] top-[45px]">
          <div className="w-28 h-16 rounded-lg bg-indigo-600 dark:bg-indigo-700 flex flex-col items-center justify-center shadow-md">
            <span className="text-sm font-bold text-white">3.1</span>
            <span className="text-xs text-white text-center">เลือกคอนฟิก</span>
          </div>
        </div>
        
        {/* Process 3.2 - โหลดอุปกรณ์ */}
        <div className="absolute left-[280px] top-[175px]">
          <div className="w-28 h-16 rounded-lg bg-indigo-600 dark:bg-indigo-700 flex flex-col items-center justify-center shadow-md">
            <span className="text-sm font-bold text-white">3.2</span>
            <span className="text-xs text-white text-center">โหลดอุปกรณ์</span>
          </div>
        </div>
        
        {/* Process 3.3 - Deploy คอนฟิก */}
        <div className="absolute left-[280px] top-[315px]">
          <div className="w-28 h-16 rounded-lg bg-emerald-600 dark:bg-emerald-700 flex flex-col items-center justify-center shadow-md">
            <span className="text-sm font-bold text-white">3.3</span>
            <span className="text-xs text-white text-center">Deploy คอนฟิก</span>
          </div>
        </div>
        
        {/* Process 3.4 - อัปเดตสถานะ */}
        <div className="absolute left-[280px] top-[455px]">
          <div className="w-28 h-16 rounded-lg bg-indigo-600 dark:bg-indigo-700 flex flex-col items-center justify-center shadow-md">
            <span className="text-sm font-bold text-white">3.4</span>
            <span className="text-xs text-white text-center">อัปเดตสถานะ</span>
          </div>
        </div>
        
        {/* D1 Data Store - Configs */}
        <div className="absolute right-[30px] top-[45px]">
          <div className="flex items-stretch">
            <div className="w-10 bg-white dark:bg-gray-800 border-t-2 border-b-2 border-l-2 border-gray-600 dark:border-gray-500 flex items-center justify-center">
              <span className="font-bold text-base text-gray-800 dark:text-white">D1</span>
            </div>
            <div className="border-2 border-gray-600 dark:border-gray-500 bg-white dark:bg-gray-800 px-6 py-4">
              <span className="text-base font-medium text-gray-800 dark:text-white">ฐานข้อมูลคอนฟิก</span>
            </div>
          </div>
        </div>
        
        {/* D2 Data Store - Devices */}
        <div className="absolute right-[30px] top-[175px]">
          <div className="flex items-stretch">
            <div className="w-10 bg-white dark:bg-gray-800 border-t-2 border-b-2 border-l-2 border-gray-600 dark:border-gray-500 flex items-center justify-center">
              <span className="font-bold text-base text-gray-800 dark:text-white">D2</span>
            </div>
            <div className="border-2 border-gray-600 dark:border-gray-500 bg-white dark:bg-gray-800 px-6 py-4">
              <span className="text-base font-medium text-gray-800 dark:text-white">ฐานข้อมูลอุปกรณ์</span>
            </div>
          </div>
        </div>
        
        {/* Network Device Entity */}
        <div className="absolute right-[30px] top-[310px]">
          <div className="border-2 border-emerald-500 bg-white dark:bg-gray-800 px-6 py-4 text-center">
            <ServerIcon className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
            <span className="text-base font-bold text-gray-800 dark:text-white">อุปกรณ์</span>
            <div className="text-[10px] text-gray-500 mt-1">(NX-OS/IOS-XE)</div>
          </div>
        </div>
      </div>

      {/* Sub-process Table */}
      <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-lg">
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-3">
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
            <tr><td className="px-4 py-2 font-mono text-indigo-600 font-bold">3.1</td><td className="px-4 py-2">เลือกคอนฟิก</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">ผู้ใช้เลือก configuration (CLI/NETCONF) ที่ต้องการ deploy</td><td className="px-4 py-2 text-gray-500">Config ID</td><td className="px-4 py-2 text-gray-500">Config data</td></tr>
            <tr><td className="px-4 py-2 font-mono text-indigo-600 font-bold">3.2</td><td className="px-4 py-2">โหลดอุปกรณ์</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">โหลดข้อมูลอุปกรณ์ ตรวจจับประเภท (nexus/ios-xe/router/switch)</td><td className="px-4 py-2 text-gray-500">Device ID</td><td className="px-4 py-2 text-gray-500">Connection + Type</td></tr>
            <tr><td className="px-4 py-2 font-mono text-indigo-600 font-bold">3.3</td><td className="px-4 py-2">Deploy คอนฟิก</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">ส่ง config ผ่าน Agent Relay → Desktop Agent → SSH (CLI) หรือ NETCONF/YANG</td><td className="px-4 py-2 text-gray-500">Config + Device</td><td className="px-4 py-2 text-gray-500">Deploy result</td></tr>
            <tr><td className="px-4 py-2 font-mono text-indigo-600 font-bold">3.4</td><td className="px-4 py-2">อัปเดตสถานะ</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">อัปเดตสถานะการ deploy และบันทึกประวัติ</td><td className="px-4 py-2 text-gray-500">Result</td><td className="px-4 py-2 text-gray-500">Updated status</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// DFD Level 5 - Backup Management Detail (Process 4.0)
function DFDLevel5() {
  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-2xl p-6 overflow-x-auto">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 text-center flex items-center justify-center gap-2">
        <div className="w-8 h-8 rounded-full bg-teal-500 text-white flex items-center justify-center text-sm font-bold">5</div>
        Process 4.0 - Backup Management Decomposition
      </h3>
      
      {/* SVG-based DFD with connected arrows - increased spacing */}
      <div className="relative min-w-[950px] h-[750px] mx-auto">
        <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 1 }}>
          <defs>
            <marker id="arrowL5" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#6B7280" />
            </marker>
            <marker id="arrowL5Teal" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#14B8A6" />
            </marker>
            <marker id="arrowL5Purple" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#A855F7" />
            </marker>
            <marker id="arrowL5Orange" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#F97316" />
            </marker>
          </defs>
          
          {/* ===== Row 1: Process 4.1 เริ่ม Backup ===== */}
          {/* User to 4.1 */}
          <line x1="130" y1="70" x2="280" y2="70" stroke="#6B7280" strokeWidth="1.5" markerEnd="url(#arrowL5)" />
          <text x="205" y="60" className="text-[11px] fill-gray-500 dark:fill-gray-400" textAnchor="middle">สร้าง Backup</text>
          {/* 4.1 to D1 (read device) */}
          <line x1="400" y1="70" x2="770" y2="70" stroke="#6B7280" strokeWidth="1.5" markerEnd="url(#arrowL5)" />
          <text x="585" y="60" className="text-[11px] fill-gray-500 dark:fill-gray-400" textAnchor="middle">อ่านข้อมูลอุปกรณ์</text>
          {/* D1 to 4.1 */}
          <line x1="770" y1="90" x2="400" y2="90" stroke="#6B7280" strokeWidth="1.5" markerEnd="url(#arrowL5)" />
          <text x="585" y="108" className="text-[11px] fill-gray-500 dark:fill-gray-400" textAnchor="middle">ข้อมูลการเชื่อมต่อ</text>
          
          {/* ===== Row 2: Process 4.2 ดึงคอนฟิก ===== */}
          {/* 4.1 to 4.2 vertical */}
          <line x1="340" y1="100" x2="340" y2="180" stroke="#6B7280" strokeWidth="1.5" markerEnd="url(#arrowL5)" />
          <text x="270" y="150" className="text-[11px] fill-gray-500 dark:fill-gray-400">อุปกรณ์</text>
          {/* 4.2 to Network Device */}
          <line x1="400" y1="200" x2="770" y2="200" stroke="#14B8A6" strokeWidth="1.5" markerEnd="url(#arrowL5Teal)" />
          <text x="585" y="190" className="text-[11px] fill-teal-600 dark:fill-teal-400" textAnchor="middle">SSH via Agent: show run</text>
          {/* Network Device to 4.2 */}
          <line x1="770" y1="230" x2="400" y2="230" stroke="#14B8A6" strokeWidth="1.5" markerEnd="url(#arrowL5Teal)" />
          <text x="585" y="248" className="text-[11px] fill-teal-600 dark:fill-teal-400" textAnchor="middle">Running Config</text>
          
          {/* ===== Row 3: Process 4.3 ตรวจสอบซ้ำ ===== */}
          {/* 4.2 to 4.3 vertical */}
          <line x1="340" y1="260" x2="340" y2="340" stroke="#6B7280" strokeWidth="1.5" markerEnd="url(#arrowL5)" />
          <text x="270" y="310" className="text-[11px] fill-gray-500 dark:fill-gray-400">คอนฟิก</text>
          {/* 4.3 to D2 (check duplicate) */}
          <line x1="400" y1="360" x2="770" y2="360" stroke="#A855F7" strokeWidth="1.5" markerEnd="url(#arrowL5Purple)" />
          <text x="585" y="350" className="text-[11px] fill-purple-500 dark:fill-purple-400" textAnchor="middle">ตรวจสอบ Hash</text>
          {/* D2 to 4.3 */}
          <line x1="770" y1="390" x2="400" y2="390" stroke="#A855F7" strokeWidth="1.5" markerEnd="url(#arrowL5Purple)" />
          <text x="585" y="408" className="text-[11px] fill-purple-500 dark:fill-purple-400" textAnchor="middle">ผลการตรวจสอบ</text>
          
          {/* ===== Row 4: Process 4.4 บันทึก Backup ===== */}
          {/* 4.3 to 4.4 vertical */}
          <line x1="340" y1="420" x2="340" y2="500" stroke="#6B7280" strokeWidth="1.5" markerEnd="url(#arrowL5)" />
          <text x="250" y="470" className="text-[11px] fill-gray-500 dark:fill-gray-400">Backup ใหม่</text>
          {/* 4.4 to D2 (save backup) */}
          <line x1="400" y1="520" x2="770" y2="520" stroke="#A855F7" strokeWidth="1.5" markerEnd="url(#arrowL5Purple)" />
          <text x="585" y="510" className="text-[11px] fill-purple-500 dark:fill-purple-400" textAnchor="middle">บันทึก Backup</text>
          {/* 4.4 to User */}
          <line x1="280" y1="530" x2="130" y2="530" stroke="#6B7280" strokeWidth="1.5" markerEnd="url(#arrowL5)" />
          <text x="205" y="548" className="text-[11px] fill-gray-500 dark:fill-gray-400" textAnchor="middle">ยืนยันการบันทึก</text>
          
          {/* Scheduler to 4.1 (dashed auto trigger) */}
          <line x1="130" y1="640" x2="280" y2="100" stroke="#F97316" strokeWidth="1.5" markerEnd="url(#arrowL5Orange)" strokeDasharray="6,4" />
          <text x="160" y="380" className="text-[11px] fill-orange-500 dark:fill-orange-400">Auto Trigger</text>
        </svg>
        
        {/* User Entity - Centered Left */}
        <div className="absolute left-[20px] top-[250px] w-24">
          <div className="border-2 border-gray-600 dark:border-gray-500 bg-white dark:bg-gray-800 px-4 py-10 text-center">
            <span className="text-base font-bold text-gray-800 dark:text-white">ผู้ใช้</span>
          </div>
        </div>
        
        {/* Scheduler Entity */}
        <div className="absolute left-[20px] top-[600px] w-24">
          <div className="border-2 border-orange-500 bg-white dark:bg-gray-800 px-3 py-4 text-center">
            <RefreshCwIcon className="h-6 w-6 text-orange-500 mx-auto mb-2" />
            <span className="text-sm font-bold text-gray-800 dark:text-white">Scheduler</span>
          </div>
        </div>
        
        {/* Process 4.1 - เริ่ม Backup */}
        <div className="absolute left-[280px] top-[45px]">
          <div className="w-28 h-16 rounded-lg bg-teal-600 dark:bg-teal-700 flex flex-col items-center justify-center shadow-md">
            <span className="text-sm font-bold text-white">4.1</span>
            <span className="text-xs text-white text-center">เริ่ม Backup</span>
          </div>
        </div>
        
        {/* Process 4.2 - ดึงคอนฟิก */}
        <div className="absolute left-[280px] top-[185px]">
          <div className="w-28 h-16 rounded-lg bg-teal-600 dark:bg-teal-700 flex flex-col items-center justify-center shadow-md">
            <span className="text-sm font-bold text-white">4.2</span>
            <span className="text-xs text-white text-center">ดึงคอนฟิก</span>
          </div>
        </div>
        
        {/* Process 4.3 - ตรวจสอบซ้ำ */}
        <div className="absolute left-[280px] top-[345px]">
          <div className="w-28 h-16 rounded-lg bg-teal-600 dark:bg-teal-700 flex flex-col items-center justify-center shadow-md">
            <span className="text-sm font-bold text-white">4.3</span>
            <span className="text-xs text-white text-center">ตรวจสอบซ้ำ</span>
          </div>
        </div>
        
        {/* Process 4.4 - บันทึก Backup */}
        <div className="absolute left-[280px] top-[505px]">
          <div className="w-28 h-16 rounded-lg bg-teal-600 dark:bg-teal-700 flex flex-col items-center justify-center shadow-md">
            <span className="text-sm font-bold text-white">4.4</span>
            <span className="text-xs text-white text-center">บันทึก Backup</span>
          </div>
        </div>
        
        {/* D1 Data Store - Devices */}
        <div className="absolute right-[30px] top-[45px]">
          <div className="flex items-stretch">
            <div className="w-10 bg-white dark:bg-gray-800 border-t-2 border-b-2 border-l-2 border-gray-600 dark:border-gray-500 flex items-center justify-center">
              <span className="font-bold text-base text-gray-800 dark:text-white">D1</span>
            </div>
            <div className="border-2 border-gray-600 dark:border-gray-500 bg-white dark:bg-gray-800 px-6 py-4">
              <span className="text-base font-medium text-gray-800 dark:text-white">ฐานข้อมูลอุปกรณ์</span>
            </div>
          </div>
        </div>
        
        {/* Network Device Entity */}
        <div className="absolute right-[30px] top-[180px]">
          <div className="border-2 border-teal-500 bg-white dark:bg-gray-800 px-6 py-4 text-center">
            <ServerIcon className="h-8 w-8 text-teal-500 mx-auto mb-2" />
            <span className="text-base font-bold text-gray-800 dark:text-white">อุปกรณ์</span>
          </div>
        </div>
        
        {/* D2 Data Store - Backups */}
        <div className="absolute right-[30px] top-[350px]">
          <div className="flex items-stretch">
            <div className="w-10 bg-white dark:bg-gray-800 border-t-2 border-b-2 border-l-2 border-gray-600 dark:border-gray-500 flex items-center justify-center">
              <span className="font-bold text-base text-gray-800 dark:text-white">D2</span>
            </div>
            <div className="border-2 border-gray-600 dark:border-gray-500 bg-white dark:bg-gray-800 px-6 py-4">
              <span className="text-base font-medium text-gray-800 dark:text-white">ฐานข้อมูล Backup</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-process Table */}
      <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-lg">
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-6 py-3">
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
            <tr><td className="px-4 py-2 font-mono text-teal-600 font-bold">4.1</td><td className="px-4 py-2">เริ่ม Backup</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">เริ่มกระบวนการ backup โหลดข้อมูลอุปกรณ์</td><td className="px-4 py-2 text-gray-500">Device ID</td><td className="px-4 py-2 text-gray-500">Device info</td></tr>
            <tr><td className="px-4 py-2 font-mono text-teal-600 font-bold">4.2</td><td className="px-4 py-2">ดึงคอนฟิก</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">ส่งคำสั่งผ่าน Agent Relay → Desktop Agent เชื่อมต่อ SSH ดึง running-config</td><td className="px-4 py-2 text-gray-500">SSH credentials</td><td className="px-4 py-2 text-gray-500">Running config</td></tr>
            <tr><td className="px-4 py-2 font-mono text-teal-600 font-bold">4.3</td><td className="px-4 py-2">ตรวจสอบซ้ำ</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">คำนวณ hash และตรวจสอบว่าซ้ำกับ backup ก่อนหน้าหรือไม่</td><td className="px-4 py-2 text-gray-500">Config content</td><td className="px-4 py-2 text-gray-500">Is duplicate</td></tr>
            <tr><td className="px-4 py-2 font-mono text-teal-600 font-bold">4.4</td><td className="px-4 py-2">บันทึก Backup</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">บันทึก backup พร้อม metadata, tags และ timestamp</td><td className="px-4 py-2 text-gray-500">Backup data</td><td className="px-4 py-2 text-gray-500">Backup record</td></tr>
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
              <td className="px-4 py-3 text-gray-500 font-mono text-xs">_id, email, name, googleId, avatar, role, agentToken</td>
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
              <td className="px-4 py-3"><span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded font-mono text-xs font-bold">D6</span></td>
              <td className="px-4 py-3 font-medium text-gray-800 dark:text-white">Agent Commands</td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Command queue for Agent Relay (HTTP Polling)</td>
              <td className="px-4 py-3 text-gray-500 font-mono text-xs">_id, userId, event, data, status, result, error, createdAt</td>
              <td className="px-4 py-3"><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-xs">agentcommands</code></td>
            </tr>
            <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td className="px-4 py-3"><span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded font-mono text-xs font-bold">D7</span></td>
              <td className="px-4 py-3 font-medium text-gray-800 dark:text-white">Agent Heartbeats</td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Agent online status tracking via heartbeat polling</td>
              <td className="px-4 py-3 text-gray-500 font-mono text-xs">_id, userId, agentName, agentVersion, platform, lastHeartbeat</td>
              <td className="px-4 py-3"><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-xs">agentheartbeats</code></td>
            </tr>
            <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td className="px-4 py-3"><span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded font-mono text-xs font-bold">D8</span></td>
              <td className="px-4 py-3 font-medium text-gray-800 dark:text-white">Notifications</td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Event notifications for frontend polling (replaces Socket.IO)</td>
              <td className="px-4 py-3 text-gray-500 font-mono text-xs">_id, channel, event, data, createdAt</td>
              <td className="px-4 py-3"><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-xs">notifications</code></td>
            </tr>
            <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td className="px-4 py-3"><span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded font-mono text-xs font-bold">D9</span></td>
              <td className="px-4 py-3 font-medium text-gray-800 dark:text-white">Shell Sessions</td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Interactive SSH shell I/O buffer for polling-based terminal</td>
              <td className="px-4 py-3 text-gray-500 font-mono text-xs">_id, userId, deviceId, sessionId, status, outputChunks, inputQueue</td>
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
