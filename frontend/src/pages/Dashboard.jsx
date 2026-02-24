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
import ZoomControls from '../components/ZoomControls';
import { useResponsive } from '../hooks/useResponsive';

function Dashboard() {
  const { getItemsPerPage, deviceType, getSpacing } = useResponsive();
  const maxDevices = getItemsPerPage('dashboard');
  const spacing = getSpacing();
  
  const [stats, setStats] = useState({
    totalDevices: 0,
    activeDevices: 0,
    inactiveDevices: 0,
    maintenanceDevices: 0,
    totalConfigurations: 0,
    deployedConfigurations: 0,
    recentConfigurations: [],
    routers: 0,
    switches: 0
  });
  const [backupStats, setBackupStats] = useState({
    totalBackups: 0,
    manualBackups: 0,
    restorePoints: 0
  });
  const [analytics, setAnalytics] = useState({
    avgExecutionTime: 0,
    successRate: 0,
    totalGenerations: 0
  });
  const [devices, setDevices] = useState([]);

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
      // Fetch all data in parallel — health check included in the batch
      // instead of blocking sequentially before data calls
      const [
        healthResponse,
        devicesResponse, 
        deviceStatsResponse,
        configurationsResponse, 
        backupsResponse,
        analyticsResponse
      ] = await Promise.all([
        axios.get('/health', { signal }).catch(() => null),
        axios.get('/devices', { signal }),
        axios.get('/devices/stats/summary', { signal }).catch(() => ({ data: { stats: {} } })),
        axios.get('/configurations/history?limit=5', { signal }),
        axios.get('/backups?limit=100', { signal }).catch(() => ({ data: { backups: [], pagination: { total: 0 } } })),
        axios.get('/configurations/analytics?days=7', { signal }).catch(() => ({ data: { analytics: {} } }))
      ]);
      
      if (!healthResponse?.data?.success) {
        // Backend might be unhealthy but data calls may have succeeded
        console.warn('Health check failed, using fetched data if available');
      }

      const devicesData = devicesResponse.data.devices || [];
      const deviceStats = deviceStatsResponse.data.stats || {};
      const configurations = configurationsResponse.data.configurations || [];
      const totalConfigs = configurationsResponse.data.total || 0;
      const backups = backupsResponse.data.backups || [];
      const totalBackups = backupsResponse.data.pagination?.total || backups.length;
      const analyticsData = analyticsResponse.data.analytics || {};

      setDevices(devicesData);
      
      // Calculate deployed configurations
      const deployedCount = configurations.filter(c => c.status === 'deployed').length;
      
      setStats({
        totalDevices: deviceStats.total_devices || devicesData.length,
        activeDevices: deviceStats.active_devices || devicesData.filter(d => d.status === 'active').length,
        inactiveDevices: deviceStats.inactive_devices || devicesData.filter(d => d.status === 'inactive').length,
        maintenanceDevices: deviceStats.maintenance_devices || devicesData.filter(d => d.status === 'maintenance').length,
        totalConfigurations: totalConfigs,
        deployedConfigurations: deployedCount,
        recentConfigurations: configurations,
        routers: deviceStats.routers || devicesData.filter(d => d.type === 'router').length,
        switches: deviceStats.switches || devicesData.filter(d => d.type === 'switch').length
      });

      // Calculate backup stats
      const manualCount = backups.filter(b => b.backup_type === 'manual').length;
      const restorePointCount = backups.filter(b => b.is_restore_point).length;

      setBackupStats({
        totalBackups,
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
      deployed: 'badge-success',
      failed: 'badge-danger',
      rolled_back: 'badge-warning'
    };
    return styles[status] || 'badge-info';
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'deployed':
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <div className="p-1.5 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <LayoutDashboardIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Overview of your Network Management Platform
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <ZoomControls />
          <button
            onClick={fetchDashboardData}
            className="btn btn-secondary btn-sm"
            disabled={loading}
          >
            <RefreshCwIcon className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards - Row 1: Core Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Devices</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.totalDevices}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{stats.routers} routers • {stats.switches} switches</p>
            </div>
            <div className="stat-icon-blue">
              <ServerIcon className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="stat-card py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Device Status</p>
              <p className="text-xl font-bold text-green-600 dark:text-green-400">{stats.activeDevices} Active</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {stats.inactiveDevices > 0 ? `${stats.inactiveDevices} inactive` : 'All online'}
              </p>
            </div>
            <div className="stat-icon-green">
              <ActivityIcon className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="stat-card py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Configurations</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.totalConfigurations}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400"><TrendingUpIcon className="h-3 w-3 inline text-green-500" /> {analytics.successRate}% success rate</p>
            </div>
            <div className="stat-icon-purple">
              <CogIcon className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="stat-card py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Backups</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{backupStats.totalBackups}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{backupStats.restorePoints} restore points</p>
            </div>
            <div className="stat-icon-orange">
              <ArchiveIcon className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Device Health - Left Side (2 columns) */}
        <div className="lg:col-span-2 card">
          <div className="card-header py-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Device Health</h3>
            <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full"></span> Active</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded-full"></span> Inactive</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-500 rounded-full"></span> Maintenance</span>
            </div>
          </div>
          <div className="card-body py-3">
            {devices.length === 0 ? (
              <div className="empty-state">
                <ServerIcon className="empty-state-icon" />
                <p className="empty-state-title">No devices found</p>
                <p className="empty-state-description">
                  Add devices to start monitoring your network
                </p>
              </div>
            ) : (
              <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 ${spacing.gap}`}>
                {devices.slice(0, maxDevices).map((device) => (
                  <div 
                    key={device.id} 
                    className={`relative p-3 rounded-xl border-2 transition-all hover:shadow-md cursor-pointer ${
                      device.status === 'active' ? 'border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-900/20' :
                      device.status === 'inactive' ? 'border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-900/20' :
                      device.status === 'maintenance' ? 'border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/20' :
                      'border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/50'
                    }`}
                  >
                    <div className="flex flex-col items-center text-center">
                      <DeviceIcon 
                        deviceType={device.type} 
                        layer={device.layer}
                        className={`h-8 w-8 mb-2 ${
                          device.status === 'active' ? 'text-green-600' :
                          device.status === 'inactive' ? 'text-red-600' :
                          device.status === 'maintenance' ? 'text-amber-600' :
                          'text-gray-600'
                        }`}
                      />
                      <p className="text-xs font-semibold text-gray-900 dark:text-white truncate w-full">{device.name}</p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate w-full">{device.ip_address}</p>
                    </div>
                    <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
                      device.status === 'active' ? 'bg-green-500' :
                      device.status === 'inactive' ? 'bg-red-500' :
                      device.status === 'maintenance' ? 'bg-amber-500' :
                      'bg-gray-400'
                    }`}></div>
                  </div>
                ))}
              </div>
            )}
            {devices.length > maxDevices && (
              <p className="mt-2 text-center text-xs text-blue-600 hover:text-blue-800">
                <a href="/devices">View all {devices.length} devices →</a>
              </p>
            )}
          </div>
        </div>

        {/* Quick Actions - Right Side (1 column) */}
        <div className="card">
          <div className="card-header py-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Quick Actions</h3>
          </div>
          <div className="p-3 space-y-1.5">
            <a href="/devices" className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-100 dark:border-blue-800 transition-colors">
              <ServerIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-medium text-blue-900 dark:text-blue-200">Manage Devices</span>
            </a>
            <a href="/configurations" className="flex items-center gap-2 p-2 rounded-lg bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 border border-purple-100 dark:border-purple-800 transition-colors">
              <CogIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <span className="text-xs font-medium text-purple-900 dark:text-purple-200">Generate Config</span>
            </a>
            <a href="/backups" className="flex items-center gap-2 p-2 rounded-lg bg-orange-50 dark:bg-orange-900/30 hover:bg-orange-100 dark:hover:bg-orange-900/50 border border-orange-100 dark:border-orange-800 transition-colors">
              <ArchiveIcon className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              <span className="text-xs font-medium text-orange-900 dark:text-orange-200">Backup Management</span>
            </a>
            <a href="/console" className="flex items-center gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 border border-green-100 dark:border-green-800 transition-colors">
              <TerminalIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-xs font-medium text-green-900 dark:text-green-200">Console Access</span>
            </a>
          </div>
        </div>
      </div>

      {/* Recent Configurations */}
      <div className="card">
        <div className="card-header py-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Recent Configurations</h3>
          <a href="/configuration-history" className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800">View All →</a>
        </div>
        <div className="card-body py-2">
          {stats.recentConfigurations.length === 0 ? (
            <div className="text-center py-4 text-gray-500 text-sm">No configurations yet</div>
          ) : (
            <div className="space-y-1">
              {stats.recentConfigurations.slice(0, 3).map((config) => (
                <div key={config.id} className="flex items-center justify-between p-2 bg-gray-50/80 dark:bg-gray-800/50 hover:bg-gray-100/80 dark:hover:bg-gray-700/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(config.status)}
                    <div>
                      <span className="text-xs font-semibold text-gray-900 dark:text-white">{config.device_name}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">({config.device_type})</span>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-sm">{config.prompt.substring(0, 50)}...</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`badge text-xs ${getStatusBadge(config.status)}`}>{config.status}</span>
                    <span className="text-xs text-gray-400">
                      {config.created_at ? new Date(config.created_at).toLocaleDateString() : ''}
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