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
  AlertTriangleIcon,
  AppWindowMacIcon
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { subscribeToAgentStatus } from '../services/socket';

function AgentSettings() {
  const [agentStatus, setAgentStatus] = useState(null); // { online, agentInfo }
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState(null); // { agentOnline, ollama }
  const [ollamaLoading, setOllamaLoading] = useState(false);
  const [changingModel, setChangingModel] = useState(false);

  // Fetch agent status only (used by refresh button)
  const refreshStatus = useCallback(async () => {
    try {
      setRefreshing(true);
      const res = await axios.get('/agent/status');
      setAgentStatus(res.data);
    } catch (error) {
      console.error('Failed to refresh status:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Fetch both status and token on initial mount
  useEffect(() => {
    let cancelled = false;
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        // Fetch status and token independently so one failure doesn't block the other
        const [statusRes, tokenRes] = await Promise.allSettled([
          axios.get('/agent/status'),
          axios.get('/agent/token')
        ]);
        if (cancelled) return;
        if (statusRes.status === 'fulfilled') {
          setAgentStatus(statusRes.value.data);
        }
        if (tokenRes.status === 'fulfilled') {
          setToken(tokenRes.value.data.agentToken || null);
        }
      } catch (error) {
        console.error('Failed to fetch agent data:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchInitialData();
    return () => { cancelled = true; };
  }, []);

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
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg">
          <MonitorSmartphoneIcon className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Agent Settings</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Manage your local NetConfig Agent connection
          </p>
        </div>
      </div>

      {/* Top Row: Status + Token side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Agent Status Card */}
        <div className={`rounded-xl border-2 p-4 transition-all duration-300 ${
          isOnline
            ? 'border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30'
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`relative p-2.5 rounded-xl ${
                isOnline
                  ? 'bg-green-100 dark:bg-green-900/50'
                  : 'bg-gray-100 dark:bg-gray-800'
              }`}>
                {isOnline ? (
                  <WifiIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                ) : (
                  <WifiOffIcon className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                )}
                {isOnline && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                  </span>
                )}
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {isOnline ? 'Agent Connected' : 'Agent Offline'}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {isOnline
                    ? `From ${info?.hostname || 'unknown host'}`
                    : 'Start the agent to connect'}
                </p>
              </div>
            </div>
            <button
              onClick={refreshStatus}
              disabled={refreshing}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              title="Refresh status"
            >
              <RefreshCwIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Agent Info (when connected) */}
          {isOnline && info && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                { icon: MonitorIcon, color: 'text-blue-500', label: 'Name', value: info.name },
                { icon: GlobeIcon, color: 'text-purple-500', label: 'Platform', value: info.platform },
                { icon: TerminalIcon, color: 'text-orange-500', label: 'Version', value: info.version },
                { icon: ClockIcon, color: 'text-green-500', label: 'Hostname', value: info.hostname },
              ].map(({ icon: Icon, color, label, value }) => (
                <div key={label} className="flex items-center gap-1.5 bg-white dark:bg-gray-800 rounded-lg px-2 py-1.5 shadow-sm">
                  <Icon className={`h-3.5 w-3.5 ${color} flex-shrink-0`} />
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">{label}</p>
                    <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{value || 'N/A'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Token Management Card */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
          <div className="flex items-center gap-2 mb-2">
            <KeyIcon className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Agent Token</h3>
          </div>
          
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Generate a token to authenticate your agent connection.
          </p>

          {token ? (
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5">
                <div className="flex-1 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2 font-mono text-xs border border-gray-200 dark:border-gray-700 overflow-hidden">
                  {showToken ? (
                    <span className="text-gray-900 dark:text-gray-100 break-all">{token}</span>
                  ) : (
                    <span className="text-gray-400">{'•'.repeat(32)}</span>
                  )}
                </div>
                <button
                  onClick={() => setShowToken(!showToken)}
                  className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  title={showToken ? 'Hide token' : 'Show token'}
                >
                  <ShieldCheckIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={handleCopyToken}
                  className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                  title="Copy token"
                >
                  {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleGenerateToken}
                  disabled={generating}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors text-xs font-medium disabled:opacity-50"
                >
                  <RefreshCwIcon className={`h-3.5 w-3.5 ${generating ? 'animate-spin' : ''}`} />
                  Regenerate
                </button>
                <button
                  onClick={handleRevokeToken}
                  disabled={revoking}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors text-xs font-medium disabled:opacity-50"
                >
                  <TrashIcon className={`h-3.5 w-3.5 ${revoking ? 'animate-spin' : ''}`} />
                  Revoke
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleGenerateToken}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/25 text-sm font-medium disabled:opacity-50"
            >
              <KeyIcon className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
              Generate Agent Token
            </button>
          )}
        </div>
      </div>

      {/* Ollama AI Status Card (only when online) */}
      {isOnline && (
        <div className={`rounded-xl border-2 p-4 transition-all duration-300 ${
          ollamaStatus?.ollama?.available
            ? 'border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30'
            : 'border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${
                ollamaStatus?.ollama?.available
                  ? 'bg-purple-100 dark:bg-purple-900/50'
                  : 'bg-amber-100 dark:bg-amber-900/50'
              }`}>
                <BrainCircuitIcon className={`h-5 w-5 ${
                  ollamaStatus?.ollama?.available
                    ? 'text-purple-600 dark:text-purple-400'
                    : 'text-amber-600 dark:text-amber-400'
                }`} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {ollamaStatus?.ollama?.available ? 'Ollama Model Ready' : 'Ollama Not Available'}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {ollamaStatus?.ollama?.available
                    ? `v${ollamaStatus.ollama.version} — ${ollamaStatus.ollama.modelCount || 0} model(s)`
                    : ollamaStatus?.ollama?.error || 'Install Ollama on your agent machine'}
                </p>
              </div>
            </div>
            <button
              onClick={fetchOllamaStatus}
              disabled={ollamaLoading}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Refresh Ollama status"
            >
              <RefreshCwIcon className={`h-4 w-4 ${ollamaLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {ollamaStatus?.ollama?.available && ollamaStatus.ollama.models?.length > 0 && (
            <div className="mt-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                <CpuIcon className="h-3.5 w-3.5" />
                <span>Models</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1.5">
                {ollamaStatus.ollama.models.map((model) => (
                  <button
                    key={model.name}
                    onClick={() => handleChangeModel(model.name)}
                    disabled={changingModel || model.name === ollamaStatus.ollama.currentModel}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      model.name === ollamaStatus.ollama.currentModel
                        ? 'bg-purple-600 text-white shadow-md shadow-purple-500/25'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 border border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      {model.name === ollamaStatus.ollama.currentModel && (
                        <SparklesIcon className="h-3.5 w-3.5" />
                      )}
                      {model.name}
                    </span>
                    <span className="text-[10px] opacity-70">
                      {model.size ? `${(model.size / 1e9).toFixed(1)}GB` : ''}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!ollamaStatus?.ollama?.available && (
            <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-2">
                <AlertTriangleIcon className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                  <p className="font-medium text-gray-700 dark:text-gray-300">Ollama is required for AI features</p>
                  <p>1. Download from <a href="https://ollama.com/download" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">ollama.com</a></p>
                  <p>2. Run: <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">ollama serve</code></p>
                  <p>3. Pull: <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">ollama pull qwen2.5-coder:7b</code></p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bottom Row: Setup Guide + Architecture side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Setup Instructions - takes 2 columns */}
        <div className="lg:col-span-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
          <div className="flex items-center gap-2 mb-3">
            <InfoIcon className="h-4 w-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Quick Setup Guide</h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
            {/* Step 1 */}
            <div className="flex gap-2.5">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs">1</div>
              <div>
                <h4 className="text-xs font-semibold text-gray-900 dark:text-white">Install Ollama</h4>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Download Ollama and pull a model.</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <a href="https://ollama.com/download" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded text-[11px] hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                    <DownloadIcon className="h-3 w-3" /> Ollama
                  </a>
                  <code className="px-2 py-1 bg-gray-900 dark:bg-gray-800 rounded text-[11px] text-green-400 font-mono">ollama pull qwen2.5-coder:7b</code>
                </div>
              </div>
            </div>

            {/* Step 2 - Downloads */}
            <div className="flex gap-2.5">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs">2</div>
              <div className="w-full">
                <h4 className="text-xs font-semibold text-gray-900 dark:text-white">Download Agent</h4>
                
                {/* GUI Agent (Primary) */}
                <div className="mt-1.5">
                  <a href="https://github.com/ChaiyasitZ/my-project/releases/download/v1.0.0/NetConfigAgent-GUI-win-x64.zip" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-2.5 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded text-[11px] hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors border border-blue-200 dark:border-blue-800">
                    <MonitorIcon className="h-3.5 w-3.5 flex-shrink-0" />
                    <div className="flex-1">
                      <span className="font-semibold">Windows GUI</span>
                      <span className="text-[10px] opacity-60 ml-1">x64 • Recommended</span>
                    </div>
                    <DownloadIcon className="h-3.5 w-3.5 flex-shrink-0" />
                  </a>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 ml-0.5">Extract zip → Run &quot;NetConfig Agent.exe&quot; • System tray, auto-connect</p>
                </div>

                {/* CLI Agents (Secondary) */}
                <details className="mt-1.5">
                  <summary className="text-[10px] text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 select-none">CLI versions (macOS / Linux)</summary>
                  <div className="mt-1 flex flex-col gap-1">
                    <a href="https://github.com/ChaiyasitZ/my-project/releases/download/v1.0.0/NetConfigAgent.exe" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded text-[11px] hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700">
                      <MonitorIcon className="h-3 w-3 flex-shrink-0" />
                      <span className="font-medium">Windows CLI</span>
                      <span className="text-[10px] opacity-60">x64</span>
                      <DownloadIcon className="h-3 w-3 ml-auto flex-shrink-0" />
                    </a>
                    <a href="https://github.com/ChaiyasitZ/my-project/releases/download/v1.0.0/NetConfigAgent-macos-x64" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded text-[11px] hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700">
                      <AppWindowMacIcon className="h-3 w-3 flex-shrink-0" />
                      <span className="font-medium">macOS CLI</span>
                      <span className="text-[10px] opacity-60">Intel/ARM</span>
                      <DownloadIcon className="h-3 w-3 ml-auto flex-shrink-0" />
                    </a>
                    <a href="https://github.com/ChaiyasitZ/my-project/releases/download/v1.0.0/NetConfigAgent-linux-x64" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded text-[11px] hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700">
                      <TerminalIcon className="h-3 w-3 flex-shrink-0" />
                      <span className="font-medium">Linux CLI</span>
                      <span className="text-[10px] opacity-60">x64</span>
                      <DownloadIcon className="h-3 w-3 ml-auto flex-shrink-0" />
                    </a>
                  </div>
                </details>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-2.5">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs">3</div>
              <div>
                <h4 className="text-xs font-semibold text-gray-900 dark:text-white">Generate & Copy Token</h4>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Click &quot;Generate Agent Token&quot; above and copy it.</p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex gap-2.5">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs">4</div>
              <div>
                <h4 className="text-xs font-semibold text-gray-900 dark:text-white">Run & Connect</h4>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Open the app, paste server URL & token, click Connect. Minimizes to system tray.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Architecture Info - takes 1 column */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 flex flex-col justify-center">
          <h3 className="text-xs font-semibold text-gray-900 dark:text-white mb-3">How it works</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 font-mono flex-wrap">
              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded font-semibold">Browser</span>
              <span>→</span>
              <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded font-semibold">API</span>
              <span>→</span>
              <span className="px-2 py-1 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded font-semibold">Agent</span>
              <span>→</span>
              <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 rounded font-semibold">Devices</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 font-mono flex-wrap">
              <span className="px-2 py-1 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded font-semibold">Agent</span>
              <span>→</span>
              <span className="px-2 py-1 bg-fuchsia-100 dark:bg-fuchsia-900/40 text-fuchsia-700 dark:text-fuchsia-300 rounded font-semibold">Ollama AI</span>
              <span>→ Config Gen</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AgentSettings;
