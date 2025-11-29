import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { 
  ServerIcon, 
  CogIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  ClockIcon,
  ActivityIcon,
  ChartBarIcon,
  RefreshCwIcon,
  ArchiveIcon,
  TrendingUpIcon,
  DatabaseIcon,
  CalendarIcon,
  TerminalIcon
} from 'lucide-react';
import DeviceIcon from '../components/DeviceIcon';

function Dashboard() {
  const [stats, setStats] = useState({
    totalDevices: 0,
    activeDevices: 0,
    inactiveDevices: 0,
    maintenanceDevices: 0,
    totalConfigurations: 0,
    appliedConfigurations: 0,
    recentConfigurations: [],
    routers: 0,
    switches: 0
  });
  const [backupStats, setBackupStats] = useState({
    totalBackups: 0,
    scheduledBackups: 0,
    manualBackups: 0,
    restorePoints: 0
  });
  const [analytics, setAnalytics] = useState({
    avgExecutionTime: 0,
    successRate: 0,
    totalGenerations: 0
  });
  const [devices, setDevices] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [
        devicesResponse, 
        deviceStatsResponse,
        configurationsResponse, 
        backupsResponse,
        schedulesResponse,
        analyticsResponse
      ] = await Promise.all([
        axios.get('/devices'),
        axios.get('/devices/stats/summary').catch(() => ({ data: { stats: {} } })),
        axios.get('/configurations/history?limit=5'),
        axios.get('/backups?limit=100').catch(() => ({ data: { backups: [], pagination: { total: 0 } } })),
        axios.get('/backups/schedules').catch(() => ({ data: { schedules: [] } })),
        axios.get('/configurations/analytics?days=7').catch(() => ({ data: { analytics: {} } }))
      ]);

      const devicesData = devicesResponse.data.devices || [];
      const deviceStats = deviceStatsResponse.data.stats || {};
      const configurations = configurationsResponse.data.configurations || [];
      const totalConfigs = configurationsResponse.data.total || 0;
      const backups = backupsResponse.data.backups || [];
      const totalBackups = backupsResponse.data.pagination?.total || backups.length;
      const schedulesData = schedulesResponse.data.schedules || [];
      const analyticsData = analyticsResponse.data.analytics || {};

      setDevices(devicesData);
      setSchedules(schedulesData);
      
      // Calculate applied configurations
      const appliedCount = configurations.filter(c => c.status === 'applied').length;
      
      setStats({
        totalDevices: deviceStats.total_devices || devicesData.length,
        activeDevices: deviceStats.active_devices || devicesData.filter(d => d.status === 'active').length,
        inactiveDevices: deviceStats.inactive_devices || devicesData.filter(d => d.status === 'inactive').length,
        maintenanceDevices: deviceStats.maintenance_devices || devicesData.filter(d => d.status === 'maintenance').length,
        totalConfigurations: totalConfigs,
        appliedConfigurations: appliedCount,
        recentConfigurations: configurations,
        routers: deviceStats.routers || devicesData.filter(d => d.type === 'router').length,
        switches: deviceStats.switches || devicesData.filter(d => d.type === 'switch').length
      });

      // Calculate backup stats
      const scheduledCount = backups.filter(b => b.backup_type === 'scheduled').length;
      const manualCount = backups.filter(b => b.backup_type === 'manual').length;
      const restorePointCount = backups.filter(b => b.is_restore_point).length;

      setBackupStats({
        totalBackups,
        scheduledBackups: scheduledCount,
        manualBackups: manualCount,
        restorePoints: restorePointCount
      });

      // Set analytics
      const perf = analyticsData.performance || {};
      const successRate = perf.total_generations > 0 
        ? Math.round((perf.successful_applications / perf.total_generations) * 100) 
        : 0;

      setAnalytics({
        avgExecutionTime: Math.round(perf.avg_execution_time || 0),
        successRate,
        totalGenerations: perf.total_generations || 0
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      generated: 'badge-info',
      applied: 'badge-success',
      failed: 'badge-danger',
      rolled_back: 'badge-warning'
    };
    return styles[status] || 'badge-info';
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'applied':
        return <CheckCircleIcon className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircleIcon className="h-4 w-4 text-red-600" />;
      default:
        return <ClockIcon className="h-4 w-4 text-blue-600" />;
    }
  };

  const getDeviceStatusBadge = (status) => {
    const styles = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-red-100 text-red-800',
      maintenance: 'bg-yellow-100 text-yellow-800'
    };
    return styles[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card p-6">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <ChartBarIcon className="h-8 w-8 text-blue-600" />
            Dashboard
          </h1>
          <p className="mt-2 text-gray-600">
            Overview of your Network Management Platform
          </p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="btn btn-secondary btn-md"
          disabled={loading}
        >
          <RefreshCwIcon className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Stats Cards - Row 1: Core Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Devices</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalDevices}</p>
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                <span>{stats.routers} routers</span>
                <span>•</span>
                <span>{stats.switches} switches</span>
              </div>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <ServerIcon className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Device Status</p>
              <p className="text-2xl font-bold text-green-600">{stats.activeDevices} Active</p>
              <div className="flex items-center gap-2 mt-1 text-xs">
                {stats.inactiveDevices > 0 && (
                  <span className="text-red-500">{stats.inactiveDevices} inactive</span>
                )}
                {stats.maintenanceDevices > 0 && (
                  <span className="text-yellow-500">{stats.maintenanceDevices} maintenance</span>
                )}
                {stats.inactiveDevices === 0 && stats.maintenanceDevices === 0 && (
                  <span className="text-green-500">All devices online</span>
                )}
              </div>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <ActivityIcon className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Configurations</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalConfigurations}</p>
              <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                <TrendingUpIcon className="h-3 w-3 text-green-500" />
                <span>{analytics.successRate}% success rate</span>
              </div>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <CogIcon className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Backups</p>
              <p className="text-2xl font-bold text-gray-900">{backupStats.totalBackups}</p>
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                <span>{backupStats.restorePoints} restore points</span>
              </div>
            </div>
            <div className="p-3 bg-orange-100 rounded-full">
              <ArchiveIcon className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Device Health - Left Side (2 columns) */}
        <div className="lg:col-span-2 card">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Device Health</h3>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span> Active
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-red-500 rounded-full"></span> Inactive
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-yellow-500 rounded-full"></span> Maintenance
              </span>
            </div>
          </div>
          <div className="p-6">
            {devices.length === 0 ? (
              <div className="text-center py-8">
                <ServerIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No devices found</p>
                <p className="text-sm text-gray-400 mt-1">
                  Add devices to start monitoring your network
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {devices.slice(0, 12).map((device) => (
                  <div 
                    key={device.id} 
                    className={`relative p-3 rounded-lg border-2 transition-all hover:shadow-md ${
                      device.status === 'active' ? 'border-green-200 bg-green-50' :
                      device.status === 'inactive' ? 'border-red-200 bg-red-50' :
                      device.status === 'maintenance' ? 'border-yellow-200 bg-yellow-50' :
                      'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex flex-col items-center text-center">
                      <DeviceIcon 
                        deviceType={device.type} 
                        layer={device.layer}
                        className={`h-8 w-8 mb-2 ${
                          device.status === 'active' ? 'text-green-600' :
                          device.status === 'inactive' ? 'text-red-600' :
                          device.status === 'maintenance' ? 'text-yellow-600' :
                          'text-gray-600'
                        }`}
                      />
                      <p className="text-xs font-medium text-gray-900 truncate w-full" title={device.name}>
                        {device.name}
                      </p>
                      <p className="text-[10px] text-gray-500 truncate w-full">
                        {device.ip_address}
                      </p>
                    </div>
                    <div className={`absolute top-1 right-1 w-2 h-2 rounded-full ${
                      device.status === 'active' ? 'bg-green-500' :
                      device.status === 'inactive' ? 'bg-red-500' :
                      device.status === 'maintenance' ? 'bg-yellow-500' :
                      'bg-gray-400'
                    }`}></div>
                  </div>
                ))}
              </div>
            )}
            {devices.length > 12 && (
              <div className="mt-4 text-center">
                <a href="/devices" className="text-sm text-blue-600 hover:text-blue-800">
                  View all {devices.length} devices →
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions - Right Side (1 column) */}
        <div className="card">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Quick Actions</h3>
          </div>
          <div className="p-4 space-y-3">
            <a href="/devices" className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors">
              <ServerIcon className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Manage Devices</span>
            </a>
            <a href="/configurations" className="flex items-center gap-3 p-3 rounded-lg bg-purple-50 hover:bg-purple-100 transition-colors">
              <CogIcon className="h-5 w-5 text-purple-600" />
              <span className="text-sm font-medium text-purple-900">Generate Config</span>
            </a>
            <a href="/backup" className="flex items-center gap-3 p-3 rounded-lg bg-orange-50 hover:bg-orange-100 transition-colors">
              <ArchiveIcon className="h-5 w-5 text-orange-600" />
              <span className="text-sm font-medium text-orange-900">Backup Management</span>
            </a>
            <a href="/console" className="flex items-center gap-3 p-3 rounded-lg bg-green-50 hover:bg-green-100 transition-colors">
              <TerminalIcon className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium text-green-900">Console Access</span>
            </a>
          </div>
          
          {/* Server Status */}
          <div className="px-6 py-4 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Server Status</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Backend API</span>
                <span className="flex items-center gap-1.5 text-xs font-medium text-green-600">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  Connected
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Database</span>
                <span className="flex items-center gap-1.5 text-xs font-medium text-green-600">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  Connected
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Configurations */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Recent Configurations</h3>
        </div>
        <div className="p-6">
          {stats.recentConfigurations.length === 0 ? (
            <div className="text-center py-8">
              <CogIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No configurations found</p>
              <p className="text-sm text-gray-400 mt-1">
                Start by adding devices and generating configurations
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {stats.recentConfigurations.map((config) => (
                <div key={config.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      {getStatusIcon(config.status)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {config.device_name} ({config.device_type ? config.device_type.charAt(0).toUpperCase() + config.device_type.slice(1) : 'Unknown'})
                      </p>
                      <p className="text-sm text-gray-500">
                        {config.prompt.substring(0, 100)}
                        {config.prompt.length > 100 ? '...' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`badge ${getStatusBadge(config.status)}`}>
                      {config.status}
                    </span>
                    <span className="text-xs text-gray-400">
                      {(() => {
                        if (!config.created_at) return 'Unknown date';
                        
                        try {
                          // Handle both timestamps (numbers) and date strings
                          const date = typeof config.created_at === 'number' 
                            ? new Date(config.created_at)
                            : new Date(config.created_at);
                          
                          return isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleDateString();
                        } catch {
                          return 'Unknown date';
                        }
                      })()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard; 