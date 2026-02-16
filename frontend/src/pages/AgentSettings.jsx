import { useState, useEffect, useCallback } from 'react';
import { 
  MonitorSmartphoneIcon, 
  KeyIcon, 
  CopyIcon, 
  CheckIcon, 
  RefreshCwIcon, 
  TrashIcon,
  WifiIcon,
  WifiOffIcon,
  DownloadIcon,
  ShieldCheckIcon,
  InfoIcon,
  MonitorIcon,
  ClockIcon,
  GlobeIcon,
  TerminalIcon,
  BrainCircuitIcon,
  CpuIcon,
  SparklesIcon,
  AlertTriangleIcon
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { subscribeToAgentStatus } from '../services/socket';

function AgentSettings() {
  const [agentStatus, setAgentStatus] = useState(null); // { online, agentInfo }
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState(null); // { agentOnline, ollama }
  const [ollamaLoading, setOllamaLoading] = useState(false);
  const [changingModel, setChangingModel] = useState(false);

  // Fetch agent status and token on mount
  const fetchAgentData = useCallback(async () => {
    try {
      setLoading(true);
      const [statusRes, tokenRes] = await Promise.all([
        axios.get('/agent/status'),
        axios.get('/agent/token')
      ]);
      setAgentStatus(statusRes.data);
      setToken(tokenRes.data.agentToken || null);
    } catch (error) {
      console.error('Failed to fetch agent data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgentData();
  }, [fetchAgentData]);

  // Fetch Ollama status when agent is online
  const fetchOllamaStatus = useCallback(async () => {
    try {
      setOllamaLoading(true);
      const res = await axios.get('/agent/ollama/status');
      setOllamaStatus(res.data);
    } catch (error) {
      console.error('Failed to fetch Ollama status:', error);
      setOllamaStatus(null);
    } finally {
      setOllamaLoading(false);
    }
  }, []);

  useEffect(() => {
    if (agentStatus?.online) {
      fetchOllamaStatus();
    }
  }, [agentStatus?.online, fetchOllamaStatus]);

  const handleChangeModel = async (modelName) => {
    try {
      setChangingModel(true);
      await axios.post('/agent/ollama/model', { model: modelName });
      toast.success(`Ollama model changed to ${modelName}`);
      await fetchOllamaStatus();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to change model');
    } finally {
      setChangingModel(false);
    }
  };

  // Subscribe to real-time agent status changes
  useEffect(() => {
    const unsubscribe = subscribeToAgentStatus((data) => {
      setAgentStatus(prev => ({
        ...prev,
        online: data.online,
        agentInfo: data.agentInfo || prev?.agentInfo
      }));
    });
    return unsubscribe;
  }, []);

  const handleGenerateToken = async () => {
    try {
      setGenerating(true);
      const res = await axios.post('/agent/generate-token');
      setToken(res.data.agentToken);
      setShowToken(true);
      toast.success('Agent token generated! Copy it and paste into your agent.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to generate token');
    } finally {
      setGenerating(false);
    }
  };

  const handleRevokeToken = async () => {
    try {
      setRevoking(true);
      await axios.delete('/agent/revoke-token');
      setToken(null);
      setShowToken(false);
      setAgentStatus(prev => ({ ...prev, online: false, agentInfo: null }));
      toast.success('Agent token revoked. Your agent will be disconnected.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to revoke token');
    } finally {
      setRevoking(false);
    }
  };

  const handleCopyToken = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      toast.success('Token copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy token');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <RefreshCwIcon className="h-8 w-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  const isOnline = agentStatus?.online;
  const info = agentStatus?.agentInfo;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg">
          <MonitorSmartphoneIcon className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Agent Settings</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage your local NetConfig Agent connection
          </p>
        </div>
      </div>

      {/* Agent Status Card */}
      <div className={`rounded-2xl border-2 p-6 transition-all duration-300 ${
        isOnline
          ? 'border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'
      }`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {/* Status Icon */}
            <div className={`relative p-3 rounded-2xl ${
              isOnline
                ? 'bg-green-100 dark:bg-green-900/50'
                : 'bg-gray-100 dark:bg-gray-800'
            }`}>
              {isOnline ? (
                <WifiIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
              ) : (
                <WifiOffIcon className="h-8 w-8 text-gray-400 dark:text-gray-500" />
              )}
              {/* Pulse indicator */}
              {isOnline && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500"></span>
                </span>
              )}
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {isOnline ? 'Agent Connected' : 'Agent Offline'}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isOnline
                  ? `Connected from ${info?.hostname || 'unknown host'}`
                  : 'Start the agent on your computer to connect'}
              </p>
            </div>
          </div>

          {/* Refresh button */}
          <button
            onClick={fetchAgentData}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Refresh status"
          >
            <RefreshCwIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Agent Info (when connected) */}
        {isOnline && info && (
          <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-xl px-3 py-2.5 shadow-sm">
              <MonitorIcon className="h-4 w-4 text-blue-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-gray-500 dark:text-gray-400">Name</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{info.name || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-xl px-3 py-2.5 shadow-sm">
              <GlobeIcon className="h-4 w-4 text-purple-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-gray-500 dark:text-gray-400">Platform</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{info.platform || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-xl px-3 py-2.5 shadow-sm">
              <TerminalIcon className="h-4 w-4 text-orange-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-gray-500 dark:text-gray-400">Version</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{info.version || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-xl px-3 py-2.5 shadow-sm">
              <ClockIcon className="h-4 w-4 text-green-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-gray-500 dark:text-gray-400">Hostname</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{info.hostname || 'N/A'}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Ollama AI Status Card */}
      {isOnline && (
        <div className={`rounded-2xl border-2 p-6 transition-all duration-300 ${
          ollamaStatus?.ollama?.available
            ? 'border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30'
            : 'border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30'
        }`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl ${
                ollamaStatus?.ollama?.available
                  ? 'bg-purple-100 dark:bg-purple-900/50'
                  : 'bg-amber-100 dark:bg-amber-900/50'
              }`}>
                <BrainCircuitIcon className={`h-8 w-8 ${
                  ollamaStatus?.ollama?.available
                    ? 'text-purple-600 dark:text-purple-400'
                    : 'text-amber-600 dark:text-amber-400'
                }`} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {ollamaStatus?.ollama?.available ? 'Ollama AI Ready' : 'Ollama Not Available'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {ollamaStatus?.ollama?.available
                    ? `v${ollamaStatus.ollama.version} — ${ollamaStatus.ollama.modelCount || 0} model(s) installed`
                    : ollamaStatus?.ollama?.error || 'Install Ollama on your agent machine'}
                </p>
              </div>
            </div>
            <button
              onClick={fetchOllamaStatus}
              disabled={ollamaLoading}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Refresh Ollama status"
            >
              <RefreshCwIcon className={`h-5 w-5 ${ollamaLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {ollamaStatus?.ollama?.available && ollamaStatus.ollama.models?.length > 0 && (
            <div className="mt-5 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <CpuIcon className="h-4 w-4" />
                <span>Available Models</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {ollamaStatus.ollama.models.map((model) => (
                  <button
                    key={model.name}
                    onClick={() => handleChangeModel(model.name)}
                    disabled={changingModel || model.name === ollamaStatus.ollama.currentModel}
                    className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      model.name === ollamaStatus.ollama.currentModel
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/25'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 border border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {model.name === ollamaStatus.ollama.currentModel && (
                        <SparklesIcon className="h-4 w-4" />
                      )}
                      {model.name}
                    </span>
                    <span className="text-xs opacity-70">
                      {model.size ? `${(model.size / 1e9).toFixed(1)}GB` : ''}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!ollamaStatus?.ollama?.available && (
            <div className="mt-5 p-4 bg-white dark:bg-gray-800 rounded-xl border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-3">
                <AlertTriangleIcon className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                  <p className="font-medium">Ollama is required for AI features</p>
                  <p className="text-gray-500 dark:text-gray-400">
                    1. Download from <a href="https://ollama.com/download" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">ollama.com/download</a>
                  </p>
                  <p className="text-gray-500 dark:text-gray-400">2. Run: <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">ollama serve</code></p>
                  <p className="text-gray-500 dark:text-gray-400">3. Pull a model: <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">ollama pull llama3.2</code></p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Token Management Card */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6">
        <div className="flex items-center gap-3 mb-4">
          <KeyIcon className="h-5 w-5 text-amber-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Agent Token</h3>
        </div>
        
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          Generate a token to authenticate your agent. The agent will use this token to securely connect to your account.
        </p>

        {token ? (
          <div className="space-y-4">
            {/* Token display */}
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3 font-mono text-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                {showToken ? (
                  <span className="text-gray-900 dark:text-gray-100 break-all">{token}</span>
                ) : (
                  <span className="text-gray-400">{'•'.repeat(40)}</span>
                )}
              </div>
              <button
                onClick={() => setShowToken(!showToken)}
                className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                title={showToken ? 'Hide token' : 'Show token'}
              >
                <ShieldCheckIcon className="h-5 w-5" />
              </button>
              <button
                onClick={handleCopyToken}
                className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                title="Copy token"
              >
                {copied ? <CheckIcon className="h-5 w-5" /> : <CopyIcon className="h-5 w-5" />}
              </button>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleGenerateToken}
                disabled={generating}
                className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors text-sm font-medium disabled:opacity-50"
              >
                <RefreshCwIcon className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
                Regenerate Token
              </button>
              <button
                onClick={handleRevokeToken}
                disabled={revoking}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors text-sm font-medium disabled:opacity-50"
              >
                <TrashIcon className={`h-4 w-4 ${revoking ? 'animate-spin' : ''}`} />
                Revoke Token
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleGenerateToken}
            disabled={generating}
            className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/25 font-medium disabled:opacity-50"
          >
            <KeyIcon className={`h-5 w-5 ${generating ? 'animate-spin' : ''}`} />
            Generate Agent Token
          </button>
        )}
      </div>

      {/* Setup Instructions Card */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6">
        <div className="flex items-center gap-3 mb-4">
          <InfoIcon className="h-5 w-5 text-blue-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Quick Setup Guide</h3>
        </div>
        
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-sm">
              1
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Install Ollama</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Download and install Ollama, then pull a model for AI configuration generation.
              </p>
              <div className="mt-2 space-y-1">
                <a
                  href="https://ollama.com/download"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <DownloadIcon className="h-4 w-4" />
                  Download Ollama
                </a>
                <div className="bg-gray-900 dark:bg-gray-800 rounded-lg px-4 py-2 font-mono text-sm text-green-400">
                  <span className="text-gray-500">$</span> ollama pull llama3.2
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-sm">
              2
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Download the Agent</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Download the NetConfig Agent for your operating system and extract it.
              </p>
              <a
                href="https://github.com/your-repo/netconfig-agent/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <DownloadIcon className="h-4 w-4" />
                Download Agent
              </a>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-sm">
              3
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Generate a Token</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Click "Generate Agent Token" above and copy the token.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-sm">
              4
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Run the Agent</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Run the agent executable. On first launch, paste your token when prompted. The agent will connect automatically.
              </p>
              <div className="mt-2 bg-gray-900 dark:bg-gray-800 rounded-lg px-4 py-2.5 font-mono text-sm text-green-400 overflow-x-auto">
                <span className="text-gray-500">$</span> ./netconfig-agent
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center text-green-600 dark:text-green-400 font-bold text-sm">
              5
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Start Configuring</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Once connected, all SSH/NETCONF commands will be routed through your agent to reach devices on your local network.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Architecture Info */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">How it works</h3>
        <div className="flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-400 font-mono flex-wrap">
          <span className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-lg font-semibold">Browser</span>
          <span>→</span>
          <span className="px-3 py-1.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-lg font-semibold">Cloud API</span>
          <span>→ HTTP →</span>
          <span className="px-3 py-1.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded-lg font-semibold">Agent (Your PC)</span>
          <span>→</span>
          <span className="px-3 py-1.5 bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 rounded-lg font-semibold">Network Devices</span>
        </div>
        <div className="flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-400 font-mono flex-wrap mt-2">
          <span className="px-3 py-1.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded-lg font-semibold">Agent</span>
          <span>→</span>
          <span className="px-3 py-1.5 bg-fuchsia-100 dark:bg-fuchsia-900/40 text-fuchsia-700 dark:text-fuchsia-300 rounded-lg font-semibold">Ollama AI (Local)</span>
          <span>→ AI Config Generation</span>
        </div>
      </div>
    </div>
  );
}

export default AgentSettings;
