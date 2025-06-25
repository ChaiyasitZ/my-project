import React, { useState, useEffect } from 'react';

const SNMPMonitoring = () => {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [snmpData, setSnmpData] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [activeTab, setActiveTab] = useState('interfaces');
  const [snmpConfig, setSnmpConfig] = useState({
    snmp_community: 'public',
    snmp_version: 0,
    snmp_port: 161
  });

  // Fetch devices on component mount
  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      const response = await fetch('/api/devices');
      if (response.ok) {
        const data = await response.json();
        setDevices(data.devices || []);
      }
    } catch (error) {
      console.error('Error fetching devices:', error);
    }
  };

  const testSNMPConnection = async () => {
    if (!selectedDevice) return;
    
    setLoading(true);
    setTestResult(null);

    try {
      const response = await fetch(`/api/snmp/devices/${selectedDevice.id}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(snmpConfig),
      });

      const data = await response.json();
      setTestResult(data.snmpTest);
    } catch (error) {
      console.error('Error testing SNMP connection:', error);
      setTestResult({ success: false, message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const fetchSNMPData = async (endpoint) => {
    if (!selectedDevice) return;
    
    setLoading(true);
    setSnmpData(null);

    try {
      const params = new URLSearchParams(snmpConfig);
      const response = await fetch(`/api/snmp/devices/${selectedDevice.id}/${endpoint}?${params}`);
      
      if (response.ok) {
        const data = await response.json();
        setSnmpData(data);
      } else {
        const errorData = await response.json();
        setSnmpData({ success: false, message: errorData.message });
      }
    } catch (error) {
      console.error('Error fetching SNMP data:', error);
      setSnmpData({ success: false, message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'up': return 'text-green-600 bg-green-100';
      case 'down': return 'text-red-600 bg-red-100';
      case 'testing': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatSpeed = (speed) => {
    if (speed >= 1000000000) return `${(speed / 1000000000).toFixed(1)} Gbps`;
    if (speed >= 1000000) return `${(speed / 1000000).toFixed(0)} Mbps`;
    if (speed >= 1000) return `${(speed / 1000).toFixed(0)} Kbps`;
    return `${speed} bps`;
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">SNMP Network Monitoring</h1>
            
            {/* Device Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Device
              </label>
              <select
                value={selectedDevice?.id || ''}
                onChange={(e) => setSelectedDevice(devices.find(d => d.id === parseInt(e.target.value)))}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Choose a device...</option>
                {devices.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.name} ({device.ip_address})
                  </option>
                ))}
              </select>
            </div>

            {selectedDevice && (
              <>
                {/* SNMP Configuration */}
                <div className="mb-6 p-4 border border-gray-200 rounded-lg">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">SNMP Configuration</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Community String
                      </label>
                      <input
                        type="text"
                        value={snmpConfig.snmp_community}
                        onChange={(e) => setSnmpConfig(prev => ({ ...prev, snmp_community: e.target.value }))}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        SNMP Version
                      </label>
                      <select
                        value={snmpConfig.snmp_version}
                        onChange={(e) => setSnmpConfig(prev => ({ ...prev, snmp_version: parseInt(e.target.value) }))}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value={0}>SNMPv1</option>
                        <option value={1}>SNMPv2c</option>
                        <option value={2}>SNMPv3</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        SNMP Port
                      </label>
                      <input
                        type="number"
                        value={snmpConfig.snmp_port}
                        onChange={(e) => setSnmpConfig(prev => ({ ...prev, snmp_port: parseInt(e.target.value) }))}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <button
                      onClick={testSNMPConnection}
                      disabled={loading}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      {loading ? 'Testing...' : 'Test SNMP Connection'}
                    </button>
                  </div>
                </div>

                {/* Test Result */}
                {testResult && (
                  <div className={`mb-6 p-4 rounded-lg ${testResult.success ? 'bg-green-100 border border-green-300' : 'bg-red-100 border border-red-300'}`}>
                    <h4 className={`font-medium ${testResult.success ? 'text-green-800' : 'text-red-800'}`}>
                      Connection Test {testResult.success ? 'Successful' : 'Failed'}
                    </h4>
                    <p className={`mt-1 ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>
                      {testResult.message}
                    </p>
                    {testResult.success && testResult.systemDescription && (
                      <p className="mt-2 text-green-700">
                        <strong>System:</strong> {testResult.systemDescription}
                      </p>
                    )}
                  </div>
                )}

                {/* Action Tabs */}
                <div className="mb-6">
                  <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-8">
                      {[
                        { id: 'interfaces', label: 'Interface Status' },
                        { id: 'ips', label: 'IP Addresses' },
                        { id: 'complete', label: 'Complete Data' },
                        { id: 'system', label: 'System Info' }
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={`py-2 px-1 border-b-2 font-medium text-sm ${
                            activeTab === tab.id
                              ? 'border-blue-500 text-blue-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </nav>
                  </div>
                  
                  <div className="mt-4">
                    <button
                      onClick={() => fetchSNMPData(activeTab)}
                      disabled={loading}
                      className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
                    >
                      {loading ? 'Loading...' : `Get ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`}
                    </button>
                  </div>
                </div>

                {/* SNMP Data Display */}
                {snmpData && (
                  <div className="mt-6">
                    {!snmpData.success ? (
                      <div className="bg-red-100 border border-red-300 rounded-lg p-4">
                        <p className="text-red-800">
                          <strong>Error:</strong> {snmpData.message}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Interface Status Display */}
                        {activeTab === 'interfaces' && snmpData.interfaces && (
                          <div>
                            <h3 className="text-lg font-medium text-gray-900 mb-4">
                              Interface Status ({snmpData.count} interfaces)
                            </h3>
                            <div className="overflow-x-auto">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Interface
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Admin Status
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Oper Status
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Type
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Speed
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {snmpData.interfaces.map((intf) => (
                                    <tr key={intf.index}>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {intf.name}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(intf.adminStatus)}`}>
                                          {intf.adminStatus}
                                        </span>
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(intf.operStatus)}`}>
                                          {intf.operStatus}
                                        </span>
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {intf.type}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {formatSpeed(intf.speed)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* IP Addresses Display */}
                        {activeTab === 'ips' && snmpData.ipAddresses && (
                          <div>
                            <h3 className="text-lg font-medium text-gray-900 mb-4">
                              IP Addresses ({snmpData.count} addresses)
                            </h3>
                            <div className="overflow-x-auto">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      IP Address
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Interface Index
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Subnet Mask
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      CIDR
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Network
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {snmpData.ipAddresses.map((ip, index) => (
                                    <tr key={index}>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {ip.ipAddress}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {ip.interfaceIndex}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {ip.netmask}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        /{ip.cidr}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {ip.network}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Complete Data Display */}
                        {activeTab === 'complete' && snmpData.interfaces && (
                          <div>
                            <h3 className="text-lg font-medium text-gray-900 mb-4">
                              Complete Interface Data
                            </h3>
                            
                            {/* Summary Stats */}
                            {snmpData.summary && (
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                <div className="bg-blue-50 p-4 rounded-lg">
                                  <p className="text-blue-600 text-sm font-medium">Total Interfaces</p>
                                  <p className="text-2xl font-bold text-blue-800">{snmpData.summary.totalInterfaces}</p>
                                </div>
                                <div className="bg-green-50 p-4 rounded-lg">
                                  <p className="text-green-600 text-sm font-medium">Up</p>
                                  <p className="text-2xl font-bold text-green-800">{snmpData.summary.interfacesUp}</p>
                                </div>
                                <div className="bg-red-50 p-4 rounded-lg">
                                  <p className="text-red-600 text-sm font-medium">Down</p>
                                  <p className="text-2xl font-bold text-red-800">{snmpData.summary.interfacesDown}</p>
                                </div>
                                <div className="bg-purple-50 p-4 rounded-lg">
                                  <p className="text-purple-600 text-sm font-medium">With IP</p>
                                  <p className="text-2xl font-bold text-purple-800">{snmpData.summary.interfacesWithIP}</p>
                                </div>
                              </div>
                            )}

                            {/* Detailed Interface List */}
                            <div className="space-y-4">
                              {snmpData.interfaces.map((intf) => (
                                <div key={intf.index} className="border border-gray-200 rounded-lg p-4">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <h4 className="font-medium text-gray-900">{intf.name}</h4>
                                      <p className="text-sm text-gray-500">Index: {intf.index} | Type: {intf.type}</p>
                                    </div>
                                    <div className="flex space-x-2">
                                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(intf.adminStatus)}`}>
                                        Admin: {intf.adminStatus}
                                      </span>
                                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(intf.operStatus)}`}>
                                        Oper: {intf.operStatus}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  {intf.ipAddresses && intf.ipAddresses.length > 0 && (
                                    <div className="mt-3">
                                      <p className="text-sm font-medium text-gray-700 mb-1">IP Addresses:</p>
                                      <div className="space-y-1">
                                        {intf.ipAddresses.map((ip, ipIndex) => (
                                          <p key={ipIndex} className="text-sm text-gray-600">
                                            {ip.ipAddress}/{ip.cidr} (Network: {ip.network})
                                          </p>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  <div className="mt-3 text-sm text-gray-500">
                                    Speed: {formatSpeed(intf.speed)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* System Info Display */}
                        {activeTab === 'system' && snmpData.systemInfo && (
                          <div>
                            <h3 className="text-lg font-medium text-gray-900 mb-4">System Information</h3>
                            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                              <div>
                                <span className="font-medium text-gray-700">Hostname:</span>
                                <span className="ml-2 text-gray-600">{snmpData.systemInfo.hostname}</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700">Description:</span>
                                <span className="ml-2 text-gray-600">{snmpData.systemInfo.description}</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700">Object ID:</span>
                                <span className="ml-2 text-gray-600">{snmpData.systemInfo.objectId}</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700">Uptime:</span>
                                <span className="ml-2 text-gray-600">{snmpData.systemInfo.uptime} ticks</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700">Contact:</span>
                                <span className="ml-2 text-gray-600">{snmpData.systemInfo.contact}</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700">Location:</span>
                                <span className="ml-2 text-gray-600">{snmpData.systemInfo.location}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SNMPMonitoring; 