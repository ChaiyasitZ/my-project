import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  ServerIcon, 
  CogIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  ClockIcon,
  ActivityIcon
} from 'lucide-react';

function Dashboard() {
  const [stats, setStats] = useState({
    totalDevices: 0,
    activeDevices: 0,
    totalConfigurations: 0,
    recentConfigurations: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [devicesResponse, configurationsResponse] = await Promise.all([
        axios.get('/devices'),
        axios.get('/configurations/history?limit=5')
      ]);

      const devices = devicesResponse.data.devices || [];
      const configurations = configurationsResponse.data.configurations || [];

      setStats({
        totalDevices: devices.length,
        activeDevices: devices.filter(d => d.status === 'active').length,
        totalConfigurations: configurations.length,
        recentConfigurations: configurations
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
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Overview of your network automation system
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ServerIcon className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Devices</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalDevices}</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ActivityIcon className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Active Devices</p>
              <p className="text-2xl font-bold text-gray-900">{stats.activeDevices}</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CogIcon className="h-8 w-8 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Configurations</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalConfigurations}</p>
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
                        {config.device_name} ({config.device_type})
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
                      {new Date(config.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <a
              href="/devices"
              className="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors duration-200"
            >
              <ServerIcon className="h-5 w-5 text-gray-600 mr-3" />
              <span className="text-sm text-gray-900">Manage Devices</span>
            </a>
            <a
              href="/configurations"
              className="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors duration-200"
            >
              <CogIcon className="h-5 w-5 text-gray-600 mr-3" />
              <span className="text-sm text-gray-900">Generate Configuration</span>
            </a>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">System Status</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">API Server</span>
              <div className="flex items-center">
                <div className="h-2 w-2 bg-green-400 rounded-full mr-2"></div>
                <span className="text-sm text-green-600">Online</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Database</span>
              <div className="flex items-center">
                <div className="h-2 w-2 bg-green-400 rounded-full mr-2"></div>
                <span className="text-sm text-green-600">Connected</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">AI Service</span>
              <div className="flex items-center">
                <div className="h-2 w-2 bg-green-400 rounded-full mr-2"></div>
                <span className="text-sm text-green-600">Available</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard; 