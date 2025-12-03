import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { 
  ServerIcon, 
  CogIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  ClockIcon,
  ActivityIcon,
  LayoutDashboardIcon,
  RefreshCwIcon,
  ArchiveIcon,
  TrendingUpIcon,
  TerminalIcon
} from 'lucide-react';
import DeviceIcon from '../components/DeviceIcon';
import PageLoader from '../components/PageLoader';

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
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  
  // AbortController ref for request cancellation
  const abortControllerRef = useRef(null);

  useEffect(() => {
    fetchDashboardData();
    
    // Cleanup: Cancel pending requests on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const fetchDashboardData = useCallback(async () => {
    // Cancel any previous pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    try {
      // First check server health
      const healthResponse = await axios.get('/health', { signal }).catch(() => null);
      
      if (!healthResponse?.data?.success) {
        // Backend is down or database error
        setLoading(false);
        return;
      }

      const [
        devicesResponse, 
        deviceStatsResponse,
        configurationsResponse, 
        backupsResponse,
        schedulesResponse,
        analyticsResponse
      ] = await Promise.all([
        axios.get('/devices', { signal }),
        axios.get('/devices/stats/summary', { signal }).catch(() => ({ data: { stats: {} } })),
        axios.get('/configurations/history?limit=5', { signal }),
        axios.get('/backups?limit=100', { signal }).catch(() => ({ data: { backups: [], pagination: { total: 0 } } })),
        axios.get('/backups/schedules', { signal }).catch(() => ({ data: { schedules: [] } })),
        axios.get('/configurations/analytics?days=7', { signal }).catch(() => ({ data: { analytics: {} } }))
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
      // Ignore cancelled request errors
      if (axios.isCancel(error) || error?.name === 'CanceledError') {
        return;
      }
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, []);

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
      active: 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300',
      inactive: 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300',
      maintenance: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300'
    };
    return styles[status] || 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
  };

  if (loading && initialLoad) {
    return <PageLoader message="Loading dashboard..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-xl">
              <LayoutDashboardIcon className="h-7 w-7 text-blue-600 dark:text-blue-400" />
            </div>
            Dashboard
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
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
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Devices</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.totalDevices}</p>
              <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
                <span>{stats.routers} routers</span>
                <span className="text-gray-300 dark:text-gray-600">•</span>
                <span>{stats.switches} switches</span>
              </div>
            </div>
            <div className="stat-icon-blue">
              <ServerIcon className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Device Status</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{stats.activeDevices} Active</p>
              <div className="flex items-center gap-2 mt-2 text-xs">
                {stats.inactiveDevices > 0 && (
                  <span className="text-red-500">{stats.inactiveDevices} inactive</span>
                )}
                {stats.maintenanceDevices > 0 && (
                  <span className="text-amber-500">{stats.maintenanceDevices} maintenance</span>
                )}
                {stats.inactiveDevices === 0 && stats.maintenanceDevices === 0 && (
                  <span className="text-green-500">All devices online</span>
                )}
              </div>
            </div>
            <div className="stat-icon-green">
              <ActivityIcon className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Configurations</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.totalConfigurations}</p>
              <div className="flex items-center gap-1 mt-2 text-xs text-gray-500 dark:text-gray-400">
                <TrendingUpIcon className="h-3 w-3 text-green-500" />
                <span>{analytics.successRate}% success rate</span>
              </div>
            </div>
            <div className="stat-icon-purple">
              <CogIcon className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Backups</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{backupStats.totalBackups}</p>
              <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
                <span>{backupStats.restorePoints} restore points</span>
              </div>
            </div>
            <div className="stat-icon-orange">
              <ArchiveIcon className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Device Health - Left Side (2 columns) */}
        <div className="lg:col-span-2 card">
          <div className="card-header flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Device Health</h3>
            <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-green-500 rounded-full ring-2 ring-green-500/20"></span> Active
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-red-500/20"></span> Inactive
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-amber-500 rounded-full ring-2 ring-amber-500/20"></span> Maintenance
              </span>
            </div>
          </div>
          <div className="card-body">
            {devices.length === 0 ? (
              <div className="empty-state">
                <ServerIcon className="empty-state-icon" />
                <p className="empty-state-title">No devices found</p>
                <p className="empty-state-description">
                  Add devices to start monitoring your network
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {devices.slice(0, 12).map((device) => (
                  <div 
                    key={device.id} 
                    className={`relative p-3 rounded-xl border-2 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-pointer ${
                      device.status === 'active' ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/20 hover:border-green-300' :
                      device.status === 'inactive' ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/20 hover:border-red-300' :
                      device.status === 'maintenance' ? 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/20 hover:border-amber-300' :
                      'border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex flex-col items-center text-center">
                      <DeviceIcon 
                        deviceType={device.type} 
                        layer={device.layer}
                        className={`h-7 w-7 mb-1.5 ${
                          device.status === 'active' ? 'text-green-600' :
                          device.status === 'inactive' ? 'text-red-600' :
                          device.status === 'maintenance' ? 'text-amber-600' :
                          'text-gray-600'
                        }`}
                      />
                      <p className="text-[11px] font-semibold text-gray-900 dark:text-white truncate w-full" title={device.name}>
                        {device.name}
                      </p>
                      {device.model && (
                        <p className="text-[10px] text-gray-600 dark:text-gray-300 truncate w-full" title={device.model}>
                          {device.model}
                        </p>
                      )}
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate w-full mt-0.5">
                        {device.ip_address}
                      </p>
                    </div>
                    <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ring-2 ${
                      device.status === 'active' ? 'bg-green-500 ring-green-500/30' :
                      device.status === 'inactive' ? 'bg-red-500 ring-red-500/30' :
                      device.status === 'maintenance' ? 'bg-amber-500 ring-amber-500/30' :
                      'bg-gray-400 ring-gray-400/30'
                    }`}></div>
                  </div>
                ))}
              </div>
            )}
            {devices.length > 12 && (
              <div className="mt-4 text-center">
                <a href="/devices" className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors">
                  View all {devices.length} devices →
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions - Right Side (1 column) */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Quick Actions</h3>
          </div>
          <div className="p-4 space-y-2">
            <a href="/devices" className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-100 dark:border-blue-800 hover:border-blue-200 transition-all duration-200 group">
              <div className="p-2 bg-blue-100 dark:bg-blue-800 rounded-lg group-hover:bg-blue-200 dark:group-hover:bg-blue-700 transition-colors">
                <ServerIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-sm font-medium text-blue-900 dark:text-blue-200">Manage Devices</span>
            </a>
            <a href="/configurations" className="flex items-center gap-3 p-3 rounded-xl bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 border border-purple-100 dark:border-purple-800 hover:border-purple-200 transition-all duration-200 group">
              <div className="p-2 bg-purple-100 dark:bg-purple-800 rounded-lg group-hover:bg-purple-200 dark:group-hover:bg-purple-700 transition-colors">
                <CogIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <span className="text-sm font-medium text-purple-900 dark:text-purple-200">Generate Config</span>
            </a>
            <a href="/backups" className="flex items-center gap-3 p-3 rounded-xl bg-orange-50 dark:bg-orange-900/30 hover:bg-orange-100 dark:hover:bg-orange-900/50 border border-orange-100 dark:border-orange-800 hover:border-orange-200 transition-all duration-200 group">
              <div className="p-2 bg-orange-100 dark:bg-orange-800 rounded-lg group-hover:bg-orange-200 dark:group-hover:bg-orange-700 transition-colors">
                <ArchiveIcon className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <span className="text-sm font-medium text-orange-900 dark:text-orange-200">Backup Management</span>
            </a>
            <a href="/console" className="flex items-center gap-3 p-3 rounded-xl bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 border border-green-100 dark:border-green-800 hover:border-green-200 transition-all duration-200 group">
              <div className="p-2 bg-green-100 dark:bg-green-800 rounded-lg group-hover:bg-green-200 dark:group-hover:bg-green-700 transition-colors">
                <TerminalIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <span className="text-sm font-medium text-green-900 dark:text-green-200">Console Access</span>
            </a>
          </div>
        </div>
      </div>

      {/* Recent Configurations */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Configurations</h3>
          <a href="/configuration-history" className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors">
            View All →
          </a>
        </div>
        <div className="card-body">
          {stats.recentConfigurations.length === 0 ? (
            <div className="empty-state">
              <CogIcon className="empty-state-icon" />
              <p className="empty-state-title">No configurations found</p>
              <p className="empty-state-description">
                Start by adding devices and generating configurations
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.recentConfigurations.map((config) => (
                <div key={config.id} className="flex items-center justify-between p-4 bg-gray-50/80 dark:bg-gray-800/50 hover:bg-gray-100/80 dark:hover:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700 transition-all duration-200">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0 p-2 bg-white dark:bg-gray-700 rounded-lg shadow-sm">
                      {getStatusIcon(config.status)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {config.device_name} 
                        <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                          ({config.device_type ? config.device_type.charAt(0).toUpperCase() + config.device_type.slice(1) : 'Unknown'})
                        </span>
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-md">
                        {config.prompt.substring(0, 80)}
                        {config.prompt.length > 80 ? '...' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`badge ${getStatusBadge(config.status)} min-w-[80px] text-center`}>
                      {config.status}
                    </span>
                    <span className="text-xs text-gray-400 w-24 text-right">
                      {(() => {
                        if (!config.created_at) return 'Unknown date';
                        
                        try {
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