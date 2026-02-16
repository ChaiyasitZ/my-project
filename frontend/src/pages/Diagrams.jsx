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
  DownloadIcon
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

        <Arrow direction="down" className="mx-auto" label="REST API / WebSocket" />

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
          </div>
          <div className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
            Node.js + Express + HTTP Polling
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
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">MongoDB</span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">Devices, Configs, Users</span>
              </div>
            </Box>
          </div>
        </div>

        <Arrow direction="down" className="mx-auto" label="Network Protocols" />

        {/* External Systems */}
        <div className="border-2 border-dashed border-orange-300 dark:border-orange-700 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-orange-600 dark:text-orange-400 mb-4">External Systems</h3>
          <div className="flex flex-wrap gap-4 justify-center">
            <Box color="orange" size="sm">
              <div className="flex flex-col items-center text-center">
                <ServerIcon className="h-5 w-5 text-orange-600 dark:text-orange-400 mb-1" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Network Devices</span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">SSH/NETCONF</span>
              </div>
            </Box>
            <Box color="orange" size="sm">
              <div className="flex flex-col items-center text-center">
                <BrainCircuitIcon className="h-5 w-5 text-orange-600 dark:text-orange-400 mb-1" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Ollama AI</span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">LLM Engine</span>
              </div>
            </Box>
            <Box color="orange" size="sm">
              <div className="flex flex-col items-center text-center">
                <CloudIcon className="h-5 w-5 text-orange-600 dark:text-orange-400 mb-1" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Auth0</span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">Authentication</span>
              </div>
            </Box>
          </div>
        </div>
      </div>
    </div>
  );
}

// Context Diagram
function ContextDiagram() {
  return (
    <div className="min-w-[800px]">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-8 text-center">
        Context Diagram
      </h2>
      
      {/* Grid-based Context Diagram */}
      <div className="flex flex-col items-center gap-4">
        {/* Top Row - Auth0 */}
        <div className="flex flex-col items-center">
          <Entity color="gray" className="w-28 h-28">
            <CloudIcon className="h-7 w-7 text-gray-600 dark:text-gray-400 mb-1" />
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Auth0</span>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Provider</span>
          </Entity>
          <div className="text-[10px] text-gray-500 dark:text-gray-400 text-center mt-1">
            <div>Authenticate Users</div>
          </div>
          <Arrow direction="down" className="my-2" />
        </div>

        {/* Middle Row - Admin, System, Devices */}
        <div className="flex items-center gap-6">
          {/* Network Admin */}
          <div className="flex items-center gap-3">
            <Entity color="gray" className="w-28 h-28">
              <UsersIcon className="h-7 w-7 text-gray-600 dark:text-gray-400 mb-1" />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Network</span>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Admin</span>
            </Entity>
            <div className="flex flex-col items-center">
              <Arrow direction="bidirectional" />
              <div className="text-[10px] text-gray-500 dark:text-gray-400 text-center mt-1">
                <div>Manage Devices</div>
                <div>Generate Configs</div>
                <div>View Backups</div>
              </div>
            </div>
          </div>

          {/* Center System */}
          <Box color="indigo" size="lg" className="w-56 h-56 flex items-center justify-center flex-shrink-0">
            <div className="text-center">
              <NetworkIcon className="h-10 w-10 text-indigo-600 dark:text-indigo-400 mx-auto mb-2" />
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Network Config</h3>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Management</h3>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">System</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">AI-Powered</p>
            </div>
          </Box>

          {/* Right Side - Network Devices and AI/LLM */}
          <div className="flex flex-col gap-4">
            {/* Network Devices */}
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-center">
                <Arrow direction="bidirectional" />
                <div className="text-[10px] text-gray-500 dark:text-gray-400 text-center mt-1">
                  <div>SSH/NETCONF</div>
                  <div>Apply Configs</div>
                </div>
              </div>
              <Entity color="gray" className="w-28 h-28">
                <ServerIcon className="h-7 w-7 text-gray-600 dark:text-gray-400 mb-1" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Network</span>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Devices</span>
              </Entity>
            </div>

            {/* AI/LLM Service */}
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-center">
                <Arrow direction="bidirectional" />
                <div className="text-[10px] text-gray-500 dark:text-gray-400 text-center mt-1">
                  <div>Generate</div>
                  <div>Configurations</div>
                </div>
              </div>
              <Entity color="gray" className="w-28 h-28">
                <BrainCircuitIcon className="h-7 w-7 text-gray-600 dark:text-gray-400 mb-1" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">AI/LLM</span>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Service</span>
              </Entity>
            </div>
          </div>
        </div>
      </div>

      {/* Connection Lines Table */}
      <div className="mt-12">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Data Flows</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700">
              <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-300">Source</th>
              <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-300">Destination</th>
              <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-300">Data Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
            <tr>
              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">Network Admin</td>
              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">System</td>
              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">Configuration requests, device management commands</td>
            </tr>
            <tr>
              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">System</td>
              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">Network Admin</td>
              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">Generated configs, device status, backup reports</td>
            </tr>
            <tr>
              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">System</td>
              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">Network Devices</td>
              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">SSH/NETCONF commands, configuration data</td>
            </tr>
            <tr>
              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">Network Devices</td>
              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">System</td>
              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">Running configs, backup data, command responses</td>
            </tr>
            <tr>
              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">System</td>
              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">AI/LLM Service</td>
              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">Configuration prompts, device context</td>
            </tr>
            <tr>
              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">AI/LLM Service</td>
              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">System</td>
              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">Generated CLI/NETCONF configurations</td>
            </tr>
            <tr>
              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">Auth0 Provider</td>
              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">System</td>
              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">Authentication tokens, user profiles</td>
            </tr>
          </tbody>
        </table>
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

// Data Flow Diagram with Multiple Levels
function DataFlowDiagram() {
  const [activeLevel, setActiveLevel] = useState(0);

  const levels = [
    { id: 0, label: 'Level 0 - Context' },
    { id: 1, label: 'Level 1 - Main Processes' },
    { id: 2, label: 'Level 2 - Authentication' },
    { id: 3, label: 'Level 3 - Device Management' },
    { id: 4, label: 'Level 4 - Config Generation' },
    { id: 5, label: 'Level 5 - Backup Management' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white text-center">
        Data Flow Diagrams
      </h2>

      {/* Level Selector */}
      <div className="flex flex-wrap gap-2 justify-center">
        {levels.map((level) => (
          <button
            key={level.id}
            onClick={() => setActiveLevel(level.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeLevel === level.id
                ? 'bg-green-600 text-white shadow-lg'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {level.label}
          </button>
        ))}
      </div>

      {/* Level 0 - Context Diagram */}
      {activeLevel === 0 && (
        <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 text-center">
            Level 0: Context Diagram
          </h3>
          <div className="flex items-center justify-center flex-wrap">
            <ExternalEntity name="Network Admin" icon={UsersIcon} />
            <FlowArrow label="Requests" length="long" />
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl p-6 text-center shadow-xl">
              <NetworkIcon className="h-10 w-10 text-white mx-auto mb-2" />
              <span className="text-sm font-bold text-white block">Network Config</span>
              <span className="text-sm font-bold text-white block">Management System</span>
              <span className="text-xs text-indigo-200 mt-1 block">0.0</span>
            </div>
            <FlowArrow label="Commands" length="long" />
            <ExternalEntity name="Network Devices" icon={ServerIcon} />
          </div>
          
          <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Description</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              The Context Diagram (Level 0) shows the system as a single process with its interactions with external entities.
              Network administrators interact with the system to manage devices and configurations. The system communicates
              with network devices via SSH/NETCONF protocols.
            </p>
          </div>
        </div>
      )}

      {/* Level 1 - Main Processes */}
      {activeLevel === 1 && (
        <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-6 overflow-x-auto">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 text-center">
            Level 1: Main Process Decomposition
          </h3>
          
          <div className="min-w-[900px] space-y-6">
            {/* Row 1: User -> Auth -> User Store */}
            <div className="flex items-center justify-center">
              <ExternalEntity name="User" icon={UsersIcon} />
              <FlowArrow label="Login" />
              <Process id="1.0" name="Authentication" />
              <BiFlowArrow labelTop="Validate" labelBottom="User Data" />
              <DataStore id="D1" name="Users" />
              <FlowArrow label="Token" length="short" />
              <div className="bg-orange-100 dark:bg-orange-900/50 rounded-lg p-3 text-center border-2 border-orange-400">
                <CloudIcon className="h-5 w-5 text-orange-600 dark:text-orange-400 mx-auto" />
                <span className="text-xs font-medium text-orange-800 dark:text-orange-300">Auth0</span>
              </div>
            </div>

            {/* Row 2: Device Management Flow */}
            <div className="flex items-center justify-center">
              <ExternalEntity name="Admin" icon={UsersIcon} />
              <FlowArrow label="CRUD" />
              <Process id="2.0" name="Device Mgmt" />
              <BiFlowArrow labelTop="Read" labelBottom="Write" />
              <DataStore id="D2" name="Devices" />
            </div>

            {/* Row 3: Configuration Generation Flow */}
            <div className="flex items-center justify-center">
              <ExternalEntity name="Admin" icon={UsersIcon} />
              <FlowArrow label="Prompt" />
              <Process id="3.0" name="Config Gen" />
              <BiFlowArrow labelTop="Request" labelBottom="Response" />
              <div className="bg-orange-100 dark:bg-orange-900/50 rounded-lg p-3 text-center border-2 border-orange-400">
                <BrainCircuitIcon className="h-5 w-5 text-orange-600 dark:text-orange-400 mx-auto" />
                <span className="text-xs font-medium text-orange-800 dark:text-orange-300">OpenRouter</span>
              </div>
              <FlowArrow label="Store" />
              <DataStore id="D3" name="Configs" />
            </div>

            {/* Row 4: Deployment Flow */}
            <div className="flex items-center justify-center">
              <Process id="4.0" name="Deployment" />
              <BiFlowArrow labelTop="SSH/NETCONF" labelBottom="Response" />
              <ExternalEntity name="Network Devices" icon={ServerIcon} />
              <FlowArrow label="Backup" />
              <Process id="5.0" name="Backup Mgmt" />
              <FlowArrow label="Store" />
              <DataStore id="D4" name="Backups" />
            </div>
          </div>

          {/* Process Table */}
          <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-700">
                  <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300 w-20">ID</th>
                  <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300 w-36">Process</th>
                  <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300">Description</th>
                  <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300 w-40">Input</th>
                  <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300 w-40">Output</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                <tr><td className="px-4 py-2 font-mono text-green-600">1.0</td><td className="px-4 py-2">Authentication</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">Validates user identity via Auth0 OAuth2</td><td className="px-4 py-2 text-gray-500">Credentials</td><td className="px-4 py-2 text-gray-500">JWT Token</td></tr>
                <tr><td className="px-4 py-2 font-mono text-green-600">2.0</td><td className="px-4 py-2">Device Management</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">CRUD operations for network devices</td><td className="px-4 py-2 text-gray-500">Device Data</td><td className="px-4 py-2 text-gray-500">Device Records</td></tr>
                <tr><td className="px-4 py-2 font-mono text-green-600">3.0</td><td className="px-4 py-2">Config Generation</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">AI-powered CLI/NETCONF generation</td><td className="px-4 py-2 text-gray-500">Prompt + Context</td><td className="px-4 py-2 text-gray-500">Configuration</td></tr>
                <tr><td className="px-4 py-2 font-mono text-green-600">4.0</td><td className="px-4 py-2">Deployment</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">Apply configs via SSH/NETCONF</td><td className="px-4 py-2 text-gray-500">Configuration</td><td className="px-4 py-2 text-gray-500">Deploy Status</td></tr>
                <tr><td className="px-4 py-2 font-mono text-green-600">5.0</td><td className="px-4 py-2">Backup Management</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">Store and restore device configs</td><td className="px-4 py-2 text-gray-500">Running Config</td><td className="px-4 py-2 text-gray-500">Backup Record</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Level 2 - Authentication Decomposition */}
      {activeLevel === 2 && (
        <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-6 overflow-x-auto">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 text-center">
            Level 2: Authentication Process (1.0) Decomposition
          </h3>
          
          <div className="min-w-[800px] space-y-6">
            <div className="flex items-center justify-center">
              <ExternalEntity name="User" icon={UsersIcon} />
              <FlowArrow label="Login Request" />
              <Process id="1.1" name="Validate Input" />
              <FlowArrow label="Credentials" />
              <Process id="1.2" name="Auth0 OAuth" />
              <BiFlowArrow labelTop="Token Request" labelBottom="JWT Token" />
              <div className="bg-orange-100 dark:bg-orange-900/50 rounded-lg p-3 text-center border-2 border-orange-400">
                <CloudIcon className="h-5 w-5 text-orange-600 dark:text-orange-400 mx-auto" />
                <span className="text-xs font-medium text-orange-800 dark:text-orange-300">Auth0</span>
              </div>
            </div>
            
            <div className="flex items-center justify-center">
              <Process id="1.3" name="Token Validation" />
              <FlowArrow label="Verify" />
              <Process id="1.4" name="Session Mgmt" />
              <BiFlowArrow labelTop="Create" labelBottom="Update" />
              <DataStore id="D1" name="Users" />
            </div>
          </div>

          <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-700">
                  <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300 w-20">ID</th>
                  <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300 w-36">Sub-Process</th>
                  <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                <tr><td className="px-4 py-2 font-mono text-green-600">1.1</td><td className="px-4 py-2">Validate Input</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">Sanitize and validate login form data</td></tr>
                <tr><td className="px-4 py-2 font-mono text-green-600">1.2</td><td className="px-4 py-2">Auth0 OAuth</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">Redirect to Auth0 for authentication</td></tr>
                <tr><td className="px-4 py-2 font-mono text-green-600">1.3</td><td className="px-4 py-2">Token Validation</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">Verify JWT token signature and expiry</td></tr>
                <tr><td className="px-4 py-2 font-mono text-green-600">1.4</td><td className="px-4 py-2">Session Management</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">Create session, store refresh token</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Level 3 - Device Management Decomposition */}
      {activeLevel === 3 && (
        <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-6 overflow-x-auto">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 text-center">
            Level 3: Device Management Process (2.0) Decomposition
          </h3>
          
          <div className="min-w-[900px] space-y-6">
            <div className="flex items-center justify-center">
              <ExternalEntity name="Admin" icon={UsersIcon} />
              <FlowArrow label="Device Data" />
              <Process id="2.1" name="Validate Device" />
              <FlowArrow label="Valid Data" />
              <Process id="2.2" name="CRUD Handler" />
              <BiFlowArrow labelTop="Read" labelBottom="Write" />
              <DataStore id="D2" name="Devices" />
            </div>
            
            <div className="flex items-center justify-center">
              <Process id="2.3" name="SSH Test" />
              <BiFlowArrow labelTop="Connect" labelBottom="Status" />
              <ExternalEntity name="Network Device" icon={ServerIcon} />
            </div>
            
            <div className="flex items-center justify-center">
              <Process id="2.4" name="Status Monitor" />
              <FlowArrow label="Update" />
              <DataStore id="D2" name="Devices" />
            </div>
          </div>

          <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-700">
                  <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300 w-20">ID</th>
                  <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300 w-36">Sub-Process</th>
                  <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                <tr><td className="px-4 py-2 font-mono text-green-600">2.1</td><td className="px-4 py-2">Validate Device</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">Validate IP address, port, device type</td></tr>
                <tr><td className="px-4 py-2 font-mono text-green-600">2.2</td><td className="px-4 py-2">CRUD Handler</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">Create, Read, Update, Delete device records</td></tr>
                <tr><td className="px-4 py-2 font-mono text-green-600">2.3</td><td className="px-4 py-2">SSH Test</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">Test SSH connectivity to device</td></tr>
                <tr><td className="px-4 py-2 font-mono text-green-600">2.4</td><td className="px-4 py-2">Status Monitor</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">Track device online/offline status</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Level 4 - Config Generation Decomposition */}
      {activeLevel === 4 && (
        <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-6 overflow-x-auto">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 text-center">
            Level 4: Configuration Generation Process (3.0) Decomposition
          </h3>
          
          <div className="min-w-[1000px] space-y-6">
            <div className="flex items-center justify-center">
              <ExternalEntity name="Admin" icon={UsersIcon} />
              <FlowArrow label="Prompt" />
              <Process id="3.1" name="Parse Prompt" />
              <FlowArrow label="Intent" />
              <Process id="3.2" name="Load Context" />
              <FlowArrow label="Read" />
              <DataStore id="D2" name="Devices" />
            </div>
            
            <div className="flex items-center justify-center">
              <Process id="3.3" name="Build Request" />
              <BiFlowArrow labelTop="AI Prompt" labelBottom="Response" />
              <div className="bg-orange-100 dark:bg-orange-900/50 rounded-lg p-3 text-center border-2 border-orange-400">
                <BrainCircuitIcon className="h-5 w-5 text-orange-600 dark:text-orange-400 mx-auto" />
                <span className="text-xs font-medium text-orange-800 dark:text-orange-300">OpenRouter</span>
              </div>
              <FlowArrow label="Config" />
              <Process id="3.4" name="Parse Response" />
            </div>
            
            <div className="flex items-center justify-center">
              <Process id="3.5" name="Validate Config" />
              <FlowArrow label="Store" />
              <DataStore id="D3" name="Configs" />
              <FlowArrow label="Read" length="short" />
              <DataStore id="D5" name="YANG Models" />
            </div>
          </div>

          <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-700">
                  <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300 w-20">ID</th>
                  <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300 w-36">Sub-Process</th>
                  <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                <tr><td className="px-4 py-2 font-mono text-green-600">3.1</td><td className="px-4 py-2">Parse Prompt</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">Extract configuration intent from natural language</td></tr>
                <tr><td className="px-4 py-2 font-mono text-green-600">3.2</td><td className="px-4 py-2">Load Context</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">Get device info, type, existing config</td></tr>
                <tr><td className="px-4 py-2 font-mono text-green-600">3.3</td><td className="px-4 py-2">Build Request</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">Construct LLM prompt with system message</td></tr>
                <tr><td className="px-4 py-2 font-mono text-green-600">3.4</td><td className="px-4 py-2">Parse Response</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">Extract CLI/NETCONF from LLM response</td></tr>
                <tr><td className="px-4 py-2 font-mono text-green-600">3.5</td><td className="px-4 py-2">Validate Config</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">Syntax validation, YANG schema check</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Level 5 - Backup Management Decomposition */}
      {activeLevel === 5 && (
        <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-6 overflow-x-auto">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 text-center">
            Level 5: Backup Management Process (5.0) Decomposition
          </h3>
          
          <div className="min-w-[900px] space-y-6">
            <div className="flex items-center justify-center">
              <ExternalEntity name="Network Device" icon={ServerIcon} />
              <FlowArrow label="SSH/NETCONF" length="long" />
              <Process id="5.1" name="Fetch Config" />
              <FlowArrow label="Running Config" />
              <Process id="5.2" name="Parse Config" />
            </div>
            
            <div className="flex items-center justify-center">
              <Process id="5.3" name="Diff Check" />
              <FlowArrow label="Changes" />
              <Process id="5.4" name="Store Backup" />
              <FlowArrow label="Write" />
              <DataStore id="D4" name="Backups" />
            </div>
            
            <div className="flex items-center justify-center">
              <Process id="5.5" name="Scheduler" />
              <FlowArrow label="Trigger" length="long" />
              <Process id="5.1" name="Fetch Config" />
            </div>
            
            <div className="flex items-center justify-center">
              <ExternalEntity name="Admin" icon={UsersIcon} />
              <FlowArrow label="Restore" />
              <Process id="5.6" name="Rollback" />
              <BiFlowArrow labelTop="Push Config" labelBottom="Status" />
              <ExternalEntity name="Network Device" icon={ServerIcon} />
            </div>
          </div>

          <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-700">
                  <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300 w-20">ID</th>
                  <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300 w-36">Sub-Process</th>
                  <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                <tr><td className="px-4 py-2 font-mono text-green-600">5.1</td><td className="px-4 py-2">Fetch Config</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">Get running config via SSH/NETCONF</td></tr>
                <tr><td className="px-4 py-2 font-mono text-green-600">5.2</td><td className="px-4 py-2">Parse Config</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">Extract and format configuration data</td></tr>
                <tr><td className="px-4 py-2 font-mono text-green-600">5.3</td><td className="px-4 py-2">Diff Check</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">Compare with previous backup for changes</td></tr>
                <tr><td className="px-4 py-2 font-mono text-green-600">5.4</td><td className="px-4 py-2">Store Backup</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">Save backup with metadata and tags</td></tr>
                <tr><td className="px-4 py-2 font-mono text-green-600">5.5</td><td className="px-4 py-2">Scheduler</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">Automated backup scheduling (cron-based)</td></tr>
                <tr><td className="px-4 py-2 font-mono text-green-600">5.6</td><td className="px-4 py-2">Rollback</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">Restore device to previous configuration</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Data Stores Reference */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Data Stores Reference</h4>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="flex items-center gap-2 p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
            <span className="font-mono text-purple-600 font-bold">D1</span>
            <span className="text-sm text-gray-600 dark:text-gray-400">Users</span>
          </div>
          <div className="flex items-center gap-2 p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
            <span className="font-mono text-purple-600 font-bold">D2</span>
            <span className="text-sm text-gray-600 dark:text-gray-400">Devices</span>
          </div>
          <div className="flex items-center gap-2 p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
            <span className="font-mono text-purple-600 font-bold">D3</span>
            <span className="text-sm text-gray-600 dark:text-gray-400">Configurations</span>
          </div>
          <div className="flex items-center gap-2 p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
            <span className="font-mono text-purple-600 font-bold">D4</span>
            <span className="text-sm text-gray-600 dark:text-gray-400">Backups</span>
          </div>
          <div className="flex items-center gap-2 p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
            <span className="font-mono text-purple-600 font-bold">D5</span>
            <span className="text-sm text-gray-600 dark:text-gray-400">YANG Models</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Diagrams;
