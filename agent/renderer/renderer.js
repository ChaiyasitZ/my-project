/**
 * Renderer process JavaScript
 */

// State
let devices = [];
let logs = [];
let settings = {};

// DOM Elements
const elements = {
  serverStatus: document.getElementById('serverStatus'),
  serverStatusText: document.getElementById('serverStatusText'),
  statDevices: document.getElementById('stat-devices'),
  statOnline: document.getElementById('stat-online'),
  statNetconf: document.getElementById('stat-netconf'),
  statSsh: document.getElementById('stat-ssh'),
  devicesTable: document.getElementById('devices-table'),
  consoleDevice: document.getElementById('console-device'),
  consoleProtocol: document.getElementById('console-protocol'),
  consoleCommands: document.getElementById('console-commands'),
  consoleOutput: document.getElementById('console-output'),
  recentLogs: document.getElementById('recent-logs'),
  fullLogs: document.getElementById('full-logs')
};

// Initialize
async function init() {
  // Load settings
  settings = await window.electronAPI.getSettings();
  populateSettings();
  
  // Setup navigation
  setupNavigation();
  
  // Setup event handlers
  setupEventHandlers();
  
  // Setup IPC listeners
  setupIPCListeners();
  
  // Check server status
  updateServerStatus();
  
  // Add initial log
  addLog('info', 'Agent started');
}

// Navigation
function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const page = item.dataset.page;
      navigateTo(page);
    });
  });
}

function navigateTo(page) {
  // Update nav
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });
  
  // Update pages
  document.querySelectorAll('.page').forEach(p => {
    p.classList.toggle('active', p.id === `page-${page}`);
  });
}

// Event Handlers
function setupEventHandlers() {
  // Scan buttons
  document.getElementById('btn-scan').addEventListener('click', scanNetwork);
  document.getElementById('btn-scan-devices').addEventListener('click', scanNetwork);
  
  // Reconnect button
  document.getElementById('btn-reconnect').addEventListener('click', async () => {
    addLog('info', 'Reconnecting to server...');
    // Settings reload triggers reconnect
    await window.electronAPI.saveSettings(settings);
    updateServerStatus();
  });
  
  // Execute command
  document.getElementById('btn-execute').addEventListener('click', executeCommand);
  
  // Clear logs
  document.getElementById('btn-clear-logs').addEventListener('click', () => {
    logs = [];
    renderLogs();
  });
  
  // Save settings
  document.getElementById('btn-save-settings').addEventListener('click', saveSettings);
}

// IPC Listeners
function setupIPCListeners() {
  window.electronAPI.onScanStarted(() => {
    addLog('info', 'Network scan started...');
    document.getElementById('btn-scan').disabled = true;
    document.getElementById('btn-scan-devices').disabled = true;
  });
  
  window.electronAPI.onScanCompleted((foundDevices) => {
    devices = foundDevices;
    addLog('success', `Scan completed. Found ${devices.length} devices`);
    updateStats();
    renderDevices();
    document.getElementById('btn-scan').disabled = false;
    document.getElementById('btn-scan-devices').disabled = false;
  });
  
  window.electronAPI.onScanError((error) => {
    addLog('error', `Scan error: ${error}`);
    document.getElementById('btn-scan').disabled = false;
    document.getElementById('btn-scan-devices').disabled = false;
  });
  
  window.electronAPI.onServerStatus((status) => {
    updateServerStatusUI(status === 'connected');
    addLog(status === 'connected' ? 'success' : 'warning', 
           status === 'connected' ? 'Connected to server' : 'Disconnected from server');
  });
  
  window.electronAPI.onNavigate((page) => {
    navigateTo(page);
  });
}

// Network Scan
async function scanNetwork() {
  try {
    addLog('info', 'Starting network scan...');
    await window.electronAPI.scanNetwork();
  } catch (error) {
    addLog('error', `Scan failed: ${error.message}`);
  }
}

// Execute Command
async function executeCommand() {
  const deviceIp = elements.consoleDevice.value;
  const protocol = elements.consoleProtocol.value;
  const commands = elements.consoleCommands.value;
  
  if (!deviceIp) {
    addLog('warning', 'Please select a device');
    return;
  }
  
  if (!commands.trim()) {
    addLog('warning', 'Please enter commands');
    return;
  }
  
  const device = devices.find(d => d.ip === deviceIp);
  if (!device) {
    addLog('error', 'Device not found');
    return;
  }
  
  addLog('info', `Executing ${protocol.toUpperCase()} command on ${deviceIp}...`);
  elements.consoleOutput.innerHTML = '<div class="log-entry">Executing...</div>';
  
  try {
    let result;
    if (protocol === 'ssh') {
      result = await window.electronAPI.executeSSH(device, commands.split('\n'));
    } else {
      result = await window.electronAPI.executeNetconf(device, commands);
    }
    
    if (result.success) {
      elements.consoleOutput.innerHTML = `<pre style="white-space: pre-wrap; color: var(--success);">${escapeHtml(result.result)}</pre>`;
      addLog('success', `Command executed successfully on ${deviceIp}`);
    } else {
      elements.consoleOutput.innerHTML = `<pre style="white-space: pre-wrap; color: var(--danger);">Error: ${escapeHtml(result.error)}</pre>`;
      addLog('error', `Command failed: ${result.error}`);
    }
  } catch (error) {
    elements.consoleOutput.innerHTML = `<pre style="color: var(--danger);">Error: ${escapeHtml(error.message)}</pre>`;
    addLog('error', `Command error: ${error.message}`);
  }
}

// Update Stats
function updateStats() {
  elements.statDevices.textContent = devices.length;
  elements.statOnline.textContent = devices.filter(d => d.online).length;
  elements.statNetconf.textContent = devices.filter(d => d.ports?.includes(830)).length;
  elements.statSsh.textContent = devices.filter(d => d.ports?.includes(22)).length;
}

// Render Devices
function renderDevices() {
  if (devices.length === 0) {
    elements.devicesTable.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state">
          <p>No devices found. Click "Scan Network" to discover devices.</p>
        </td>
      </tr>
    `;
    return;
  }
  
  elements.devicesTable.innerHTML = devices.map(device => `
    <tr>
      <td>${device.ip}</td>
      <td>${device.hostname || '-'}</td>
      <td>${device.ports?.join(', ') || '-'}</td>
      <td>
        <span class="badge ${device.online ? 'badge-success' : 'badge-danger'}">
          ${device.online ? 'Online' : 'Offline'}
        </span>
      </td>
      <td>
        <button class="btn btn-secondary" onclick="testDevice('${device.ip}', 'ssh')" style="padding: 5px 10px; font-size: 12px;">
          Test SSH
        </button>
        <button class="btn btn-secondary" onclick="testDevice('${device.ip}', 'netconf')" style="padding: 5px 10px; font-size: 12px; margin-left: 5px;">
          Test NETCONF
        </button>
      </td>
    </tr>
  `).join('');
  
  // Update console device dropdown
  elements.consoleDevice.innerHTML = '<option value="">-- Select a device --</option>' +
    devices.map(d => `<option value="${d.ip}">${d.ip}${d.hostname ? ` (${d.hostname})` : ''}</option>`).join('');
}

// Test Device
async function testDevice(ip, protocol) {
  const device = devices.find(d => d.ip === ip);
  if (!device) return;
  
  addLog('info', `Testing ${protocol.toUpperCase()} connection to ${ip}...`);
  
  try {
    let result;
    if (protocol === 'ssh') {
      result = await window.electronAPI.testSSH(device);
    } else {
      result = await window.electronAPI.testNetconf(device);
    }
    
    if (result.success) {
      addLog('success', `${protocol.toUpperCase()} test passed for ${ip}`);
    } else {
      addLog('error', `${protocol.toUpperCase()} test failed for ${ip}: ${result.error}`);
    }
  } catch (error) {
    addLog('error', `Test error: ${error.message}`);
  }
}

// Make testDevice available globally
window.testDevice = testDevice;

// Server Status
async function updateServerStatus() {
  const connected = await window.electronAPI.getServerStatus();
  updateServerStatusUI(connected);
}

function updateServerStatusUI(connected) {
  elements.serverStatus.classList.toggle('connected', connected);
  elements.serverStatusText.textContent = connected ? 'Connected' : 'Disconnected';
}

// Settings
function populateSettings() {
  document.getElementById('setting-serverUrl').value = settings.serverUrl || '';
  document.getElementById('setting-scanRange').value = settings.scanRange || '';
  document.getElementById('setting-scanOnStartup').checked = settings.scanOnStartup || false;
  document.getElementById('setting-autoStart').checked = settings.autoStart || false;
}

async function saveSettings() {
  const newSettings = {
    serverUrl: document.getElementById('setting-serverUrl').value,
    scanRange: document.getElementById('setting-scanRange').value,
    scanOnStartup: document.getElementById('setting-scanOnStartup').checked,
    autoStart: document.getElementById('setting-autoStart').checked
  };
  
  await window.electronAPI.saveSettings(newSettings);
  settings = newSettings;
  addLog('success', 'Settings saved');
}

// Logging
function addLog(type, message) {
  const log = {
    time: new Date().toLocaleTimeString(),
    type,
    message
  };
  
  logs.unshift(log);
  if (logs.length > 100) logs.pop();
  
  renderLogs();
}

function renderLogs() {
  const renderLog = (log) => `
    <div class="log-entry">
      <span class="log-time">${log.time}</span>
      <span class="log-${log.type}">${log.message}</span>
    </div>
  `;
  
  if (logs.length === 0) {
    elements.recentLogs.innerHTML = '<div class="empty-state"><p>No recent activity</p></div>';
    elements.fullLogs.innerHTML = '<div class="empty-state"><p>No logs yet</p></div>';
  } else {
    elements.recentLogs.innerHTML = logs.slice(0, 5).map(renderLog).join('');
    elements.fullLogs.innerHTML = logs.map(renderLog).join('');
  }
}

// Utility
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Start
init();
