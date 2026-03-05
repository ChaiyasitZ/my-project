/**
 * NetConfig Agent - Renderer Script
 */

// ─── State ───
let isConnected = false;
let isConnecting = false;

// ─── DOM Elements ───
const $ = id => document.getElementById(id);

const statusDot = $('status-dot');
const statusText = $('status-text');
const inputServer = $('input-server');
const inputName = $('input-name');
const inputToken = $('input-token');
const btnSave = $('btn-save');
const btnConnect = $('btn-connect');
const btnToggleToken = $('btn-toggle-token');
const logContainer = $('log-container');
const logEmpty = $('log-empty');
const ollamaBadge = $('ollama-badge');
const ollamaStatusText = $('ollama-status-text');
const ollamaVersion = $('ollama-version');
const ollamaModel = $('ollama-model');
const ollamaModelCount = $('ollama-model-count');

// ─── Section Toggle ───
window.toggleSection = function(name) {
  const body = $(`${name}-body`);
  const chevron = $(`${name}-chevron`);
  if (body.classList.contains('collapsed')) {
    body.classList.remove('collapsed');
    if (chevron) chevron.classList.remove('collapsed');
    // Auto-scroll to make the expanded section visible
    setTimeout(() => body.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
  } else {
    body.classList.add('collapsed');
    if (chevron) chevron.classList.add('collapsed');
  }
};

// ─── Title Bar ───
$('btn-minimize').addEventListener('click', () => window.agent.minimize());
$('btn-close').addEventListener('click', () => window.agent.close());

// ─── Token Toggle ───
btnToggleToken.addEventListener('click', () => {
  const isPassword = inputToken.type === 'password';
  inputToken.type = isPassword ? 'text' : 'password';
  btnToggleToken.innerHTML = isPassword
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
});

// ─── Save Config ───
btnSave.addEventListener('click', async () => {
  const data = {
    serverUrl: inputServer.value.trim(),
    agentName: inputName.value.trim(),
    agentToken: inputToken.value.trim()
  };
  await window.agent.saveConfig(data);
  showToast('Settings saved');
});

// ─── Save & Reconnect ───
const btnReconnect = $('btn-reconnect');
if (btnReconnect) {
  btnReconnect.addEventListener('click', async () => {
    await window.agent.saveConfig({
      serverUrl: inputServer.value.trim(),
      agentName: inputName.value.trim(),
      agentToken: inputToken.value.trim()
    });
    if (isConnected) {
      await window.agent.disconnect();
      // Small delay to let disconnect complete
      await new Promise(r => setTimeout(r, 500));
    }
    setConnecting();
    await window.agent.connect();
  });
}

// ─── Connect/Disconnect ───
btnConnect.addEventListener('click', async () => {
  if (isConnected) {
    await window.agent.disconnect();
    return;
  }

  // Save first
  await window.agent.saveConfig({
    serverUrl: inputServer.value.trim(),
    agentName: inputName.value.trim(),
    agentToken: inputToken.value.trim()
  });

  setConnecting();
  await window.agent.connect();
});

function setConnecting() {
  isConnecting = true;
  statusDot.className = 'status-dot connecting';
  statusText.textContent = 'Connecting...';
  btnConnect.className = 'btn btn-connect connecting';
  btnConnect.innerHTML = '<svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6"/><path d="M2 11.5a10 10 0 0 1 18.8-4.3"/></svg> Connecting...';
}

function updateConnectionUI(connected) {
  isConnected = connected;
  isConnecting = false;
  statusDot.className = `status-dot ${connected ? 'connected' : ''}`;
  statusText.textContent = connected ? 'Connected' : 'Disconnected';

  if (connected) {
    btnConnect.className = 'btn btn-connect connected';
    btnConnect.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.36 6.64a9 9 0 0 1 0 12.73"/><path d="M5.64 5.64a9 9 0 0 0 0 12.73"/></svg> Disconnect';
  } else {
    btnConnect.className = 'btn btn-connect';
    btnConnect.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg> Connect';
  }
}

// ─── Log ───
function addLogEntry(entry) {
  if (logEmpty) logEmpty.style.display = 'none';

  const el = document.createElement('div');
  el.className = `log-entry ${entry.type}`;
  el.innerHTML = `
    <span class="log-time">${entry.time}</span>
    <span class="log-dot ${entry.type}"></span>
    <span class="log-message">${escapeHtml(entry.message)}</span>
  `;
  logContainer.appendChild(el);
  logContainer.scrollTop = logContainer.scrollHeight;

  // Keep max 200 entries in DOM
  while (logContainer.children.length > 201) {
    logContainer.removeChild(logContainer.children[1]); // Skip empty message
  }
}

$('btn-clear-log').addEventListener('click', () => {
  while (logContainer.children.length > 1) {
    logContainer.removeChild(logContainer.lastChild);
  }
  if (logEmpty) logEmpty.style.display = 'block';
});

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ─── Ollama ───
function updateOllama(status) {
  if (status.available) {
    ollamaBadge.textContent = 'Online';
    ollamaBadge.className = 'ollama-badge online';
    ollamaStatusText.textContent = '🟢 Available';
    ollamaVersion.textContent = status.version || '—';
    ollamaModel.textContent = status.currentModel || '—';
    ollamaModelCount.textContent = status.modelCount ?? status.models?.length ?? '—';
  } else {
    ollamaBadge.textContent = 'Offline';
    ollamaBadge.className = 'ollama-badge offline';
    ollamaStatusText.textContent = '🔴 Not available';
    ollamaVersion.textContent = '—';
    ollamaModel.textContent = '—';
    ollamaModelCount.textContent = '—';
  }
}

$('btn-refresh-ollama').addEventListener('click', async () => {
  ollamaBadge.textContent = 'Checking...';
  ollamaBadge.className = 'ollama-badge';
  const status = await window.agent.checkOllama();
  updateOllama(status);
});

// ─── Toast ───
function showToast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toast.style.cssText = 'position:fixed;bottom:12px;left:50%;transform:translateX(-50%);background:#22c55e;color:white;padding:6px 16px;border-radius:6px;font-size:12px;font-weight:600;z-index:999;animation:fadeIn 0.15s;';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

// ─── IPC Event Listeners ───
window.agent.onStatus((status) => {
  updateConnectionUI(status.connected);
});

window.agent.onConfig((cfg) => {
  inputServer.value = cfg.serverUrl || '';
  inputName.value = cfg.agentName || '';
  inputToken.value = cfg.agentToken || '';
});

window.agent.onLog((entry) => {
  addLogEntry(entry);
});

window.agent.onLogs((allLogs) => {
  for (const entry of allLogs) {
    addLogEntry(entry);
  }
});

window.agent.onOllamaStatus((status) => {
  updateOllama(status);
});

// ─── Initial Load ───
(async () => {
  const cfg = await window.agent.getConfig();
  inputServer.value = cfg.serverUrl || '';
  inputName.value = cfg.agentName || '';
  inputToken.value = cfg.agentToken || '';

  // Initial Ollama check
  try {
    const ollamaStatus = await window.agent.checkOllama();
    updateOllama(ollamaStatus);
  } catch (e) {
    updateOllama({ available: false });
  }
})();

// ─── Spin animation (CSS injection) ───
const style = document.createElement('style');
style.textContent = `.spin { animation: spin 1s linear infinite; } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
document.head.appendChild(style);


