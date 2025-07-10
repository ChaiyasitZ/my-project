import React, { useState } from 'react';
import { WifiIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import ConfirmationModal from '../components/ConfirmationModal';
import { useConfirmation } from '../hooks/useConfirmation';
import { useNetconf } from '../hooks/useNetconf';

// Import the new modular components
import NetconfSessionManager from '../components/netconf/NetconfSessionManager';
import NetconfDeviceManager from '../components/netconf/NetconfDeviceManager';
import YangModelManager from '../components/netconf/YangModelManager';
import NetconfOperations from '../components/netconf/NetconfOperations';
import XmlGenerator from '../components/netconf/XmlGenerator';

const NetconfManagement = () => {
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [selectedYangModel, setSelectedYangModel] = useState(null);
  const [activeTab, setActiveTab] = useState('sessions');

  const { confirmationState } = useConfirmation();

  // Use our custom NETCONF hook
  const {
    devices,
    yangModels,
    activeSessions,
    loading,
    fetchDevices,
    fetchYangModels,
    fetchActiveSessions,
    testConnection,
    connectDevice,
    disconnectSession
  } = useNetconf();

  const tabs = [
    { id: 'sessions', name: 'Active Sessions', icon: WifiIcon },
    { id: 'devices', name: 'NETCONF Devices', icon: WifiIcon },
    { id: 'yang', name: 'YANG Models', icon: WifiIcon },
    { id: 'operations', name: 'Operations', icon: WifiIcon },
    { id: 'generator', name: 'XML Generator', icon: WifiIcon }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <WifiIcon className="h-8 w-8 text-blue-600" />
              NETCONF/YANG Management
            </h1>
            <p className="mt-2 text-gray-600">
              Manage NETCONF sessions, YANG models, and network configurations
            </p>
          </div>
          <button
            onClick={fetchActiveSessions}
            disabled={loading}
            className="btn btn-primary btn-md"
          >
            <ArrowPathIcon className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mt-6">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'sessions' && (
        <NetconfSessionManager
          activeSessions={activeSessions}
          loading={loading}
          onDisconnect={disconnectSession}
          onRefresh={fetchActiveSessions}
        />
      )}

      {activeTab === 'devices' && (
        <NetconfDeviceManager
          devices={devices}
          loading={loading}
          onTestConnection={testConnection}
          onConnect={connectDevice}
          onRefresh={fetchDevices}
        />
      )}

      {activeTab === 'yang' && (
        <YangModelManager
          yangModels={yangModels}
          loading={loading}
          onRefresh={fetchYangModels}
          onModelSelect={setSelectedYangModel}
        />
      )}

      {activeTab === 'operations' && (
        <NetconfOperations
          activeSessions={activeSessions}
        />
      )}

      {activeTab === 'generator' && (
        <XmlGenerator
          devices={devices}
          yangModels={yangModels}
          activeSessions={activeSessions}
          selectedDevice={selectedDevice}
          selectedYangModel={selectedYangModel}
          onDeviceSelect={setSelectedDevice}
          onYangModelSelect={setSelectedYangModel}
        />
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmationState.isOpen}
        onClose={confirmationState.onCancel}
        onConfirm={confirmationState.onConfirm}
        title={confirmationState.title}
        message={confirmationState.message}
        confirmText={confirmationState.confirmText}
        cancelText={confirmationState.cancelText}
        type={confirmationState.type}
        loading={confirmationState.loading}
        loadingText={confirmationState.loadingText}
      />
    </div>
  );
};

export default NetconfManagement; 