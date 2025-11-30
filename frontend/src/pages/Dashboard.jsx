import { useState, useEffect } from 'react';
import axios from 'axios';
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
      // First check server health
      const healthResponse = await axios.get('/health').catch(() => null);
      
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
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Devices</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalDevices}</p>
              <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                <span>{stats.routers} routers</span>
                <span className="text-gray-300">•</span>
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
              <p className="text-sm font-medium text-gray-500">Device Status</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{stats.activeDevices} Active</p>
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
              <p className="text-sm font-medium text-gray-500">Configurations</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalConfigurations}</p>
              <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
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
              <p className="text-sm font-medium text-gray-500">Backups</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{backupStats.totalBackups}</p>
              <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
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
            <h3 className="text-lg font-semibold text-gray-900">Device Health</h3>
            <div className="flex items-center gap-4 text-xs">
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
                      device.status === 'active' ? 'border-green-200 bg-green-50/50 hover:border-green-300' :
                      device.status === 'inactive' ? 'border-red-200 bg-red-50/50 hover:border-red-300' :
                      device.status === 'maintenance' ? 'border-amber-200 bg-amber-50/50 hover:border-amber-300' :
                      'border-gray-200 bg-gray-50/50 hover:border-gray-300'
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
                      <p className="text-xs font-semibold text-gray-900 truncate w-full" title={device.name}>
                        {device.name}
                      </p>
                      <p className="text-[11px] text-gray-500 truncate w-full mt-0.5">
                        {device.ip_address}
                      </p>
                    </div>
                    <div className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full ring-2 ${
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
            <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
          </div>
          <div className="p-4 space-y-2">
            <a href="/devices" className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-100 hover:border-blue-200 transition-all duration-200 group">
              <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                <ServerIcon className="h-5 w-5 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-blue-900">Manage Devices</span>
            </a>
            <a href="/configurations" className="flex items-center gap-3 p-3 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-100 hover:border-purple-200 transition-all duration-200 group">
              <div className="p-2 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                <CogIcon className="h-5 w-5 text-purple-600" />
              </div>
              <span className="text-sm font-medium text-purple-900">Generate Config</span>
            </a>
            <a href="/backups" className="flex items-center gap-3 p-3 rounded-xl bg-orange-50 hover:bg-orange-100 border border-orange-100 hover:border-orange-200 transition-all duration-200 group">
              <div className="p-2 bg-orange-100 rounded-lg group-hover:bg-orange-200 transition-colors">
                <ArchiveIcon className="h-5 w-5 text-orange-600" />
              </div>
              <span className="text-sm font-medium text-orange-900">Backup Management</span>
            </a>
            <a href="/console" className="flex items-center gap-3 p-3 rounded-xl bg-green-50 hover:bg-green-100 border border-green-100 hover:border-green-200 transition-all duration-200 group">
              <div className="p-2 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                <TerminalIcon className="h-5 w-5 text-green-600" />
              </div>
              <span className="text-sm font-medium text-green-900">Console Access</span>
            </a>
          </div>
        </div>
      </div>

      {/* Recent Configurations */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Recent Configurations</h3>
          <a href="/history" className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors">
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
                <div key={config.id} className="flex items-center justify-between p-4 bg-gray-50/80 hover:bg-gray-100/80 rounded-xl border border-gray-100 transition-all duration-200">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0 p-2 bg-white rounded-lg shadow-sm">
                      {getStatusIcon(config.status)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {config.device_name} 
                        <span className="ml-2 text-xs font-normal text-gray-500">
                          ({config.device_type ? config.device_type.charAt(0).toUpperCase() + config.device_type.slice(1) : 'Unknown'})
                        </span>
                      </p>
                      <p className="text-sm text-gray-500 mt-0.5 truncate max-w-md">
                        {config.prompt.substring(0, 80)}
                        {config.prompt.length > 80 ? '...' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 flex-shrink-0">
                    <span className={`badge ${getStatusBadge(config.status)}`}>
                      {config.status}
                    </span>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
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