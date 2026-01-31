/**
 * Configuration Constants
 * Centralized configuration values for the Configurations module
 */

// Category colors for YANG models
export const YANG_CATEGORY_COLORS = {
  interface: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
  routing: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300',
  switching: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300',
  security: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300',
  qos: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300',
  system: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
  other: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
};

// YANG form initial state
export const INITIAL_YANG_FORM_DATA = {
  name: '',
  namespace: '',
  prefix: '',
  version: '1.0.0',
  device_type: 'all',
  category: 'other',
  description: '',
  yang_content: '',
  xml_templates: [],
  config_paths: []
};

// YANG template initial state
export const INITIAL_YANG_TEMPLATE = {
  name: '',
  description: '',
  template: ''
};

// YANG path initial state
export const INITIAL_YANG_PATH = {
  path: '',
  description: '',
  data_type: '',
  required: false
};

// NETCONF operation types
export const NETCONF_OPERATION_TYPES = [
  { value: 'get', label: 'GET', description: 'Retrieve running configuration' },
  { value: 'get-config', label: 'GET-CONFIG', description: 'Retrieve specific configuration' },
  { value: 'custom', label: 'Custom RPC', description: 'Execute custom NETCONF RPC' }
];

// Device type mapping for YANG auto-detection
export const DEVICE_TYPE_PATTERNS = {
  nexus: ['cisco-nx-os', 'nx-os', 'nxos'],
  'ios-xe': ['cisco-ios-xe', 'ios-xe'],
  'ios-xr': ['cisco-ios-xr', 'ios-xr'],
  ios: ['cisco-ios']
};

// Category detection keywords
export const CATEGORY_KEYWORDS = {
  interface: ['interface', 'ethernet'],
  routing: ['bgp', 'ospf', 'routing'],
  switching: ['vlan', 'spanning-tree', 'switching'],
  security: ['acl', 'security', 'aaa'],
  qos: ['qos', 'policy-map'],
  system: ['system', 'hostname', 'ntp']
};

// Status colors
export const STATUS_COLORS = {
  active: 'text-green-600 dark:text-green-400',
  inactive: 'text-gray-500 dark:text-gray-400',
  error: 'text-red-600 dark:text-red-400',
  connected: 'text-green-600 dark:text-green-400',
  disconnected: 'text-gray-500 dark:text-gray-400'
};

// Toast duration settings
export const TOAST_DURATIONS = {
  success: 3000,
  error: 5000,
  loading: undefined // Infinite until dismissed
};
