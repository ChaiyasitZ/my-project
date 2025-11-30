/**
 * Test utilities and custom render function
 */
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '../context/ThemeContext';
import { AuthProvider } from '../context/AuthContext';

/**
 * Custom render function that wraps components with necessary providers
 */
export function renderWithRouter(ui, { route = '/' } = {}) {
  window.history.pushState({}, 'Test page', route);
  
  const Wrapper = ({ children }) => (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>{children}</BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  );
  
  return {
    ...render(ui, { wrapper: Wrapper }),
  };
}

/**
 * Create mock device data
 */
export function createMockDevice(overrides = {}) {
  return {
    _id: 'device-' + Math.random().toString(36).substr(2, 9),
    id: Math.floor(Math.random() * 1000),
    name: 'Test Device',
    type: 'router',
    ip_address: '192.168.1.1',
    ssh_port: 22,
    netconf_port: 830,
    netconf_enabled: false,
    username: 'admin',
    status: 'active',
    description: 'Test device description',
    location: 'Test Location',
    model: 'CSR1000v',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  };
}

/**
 * Create mock backup data
 */
export function createMockBackup(overrides = {}) {
  return {
    _id: 'backup-' + Math.random().toString(36).substr(2, 9),
    id: Math.floor(Math.random() * 1000),
    backup_name: 'Test Backup',
    device_id: 'device-123',
    device_name: 'Test Device',
    backup_type: 'manual',
    config_type: 'running-config',
    file_size: 1024,
    status: 'completed',
    is_restore_point: false,
    tags: [],
    created_at: new Date().toISOString(),
    ...overrides
  };
}

/**
 * Create mock configuration history data
 */
export function createMockConfiguration(overrides = {}) {
  return {
    _id: 'config-' + Math.random().toString(36).substr(2, 9),
    id: Math.floor(Math.random() * 1000),
    device_id: 'device-123',
    device_name: 'Test Device',
    prompt: 'Configure VLAN 10',
    generated_config: 'vlan 10\n  name TEST_VLAN',
    status: 'generated',
    generation_method: 'cli',
    execution_time: 1500,
    created_at: new Date().toISOString(),
    ...overrides
  };
}

/**
 * Wait for async operations
 */
export function waitFor(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create mock API response
 */
export function createMockApiResponse(data, options = {}) {
  return {
    data,
    status: options.status || 200,
    statusText: options.statusText || 'OK',
    headers: options.headers || {},
    config: options.config || {}
  };
}

export { render };
