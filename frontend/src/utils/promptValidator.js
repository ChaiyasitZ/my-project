/**
 * Prompt Validation Utility
 * Validates that prompts are related to network configuration
 */

// Keywords that indicate a configuration-related prompt
const CONFIG_KEYWORDS = [
  // Commands
  'configure', 'config', 'set', 'set up', 'setup', 'create', 'add', 'enable', 'disable',
  'remove', 'delete', 'modify', 'change', 'update', 'apply', 'deploy',
  
  // Network interfaces
  'interface', 'ethernet', 'gigabit', 'fastethernet', 'loopback', 'vlan', 'svi',
  'port-channel', 'tunnel', 'nve', 'mgmt',
  
  // Layer 2
  'trunk', 'access', 'switchport', 'spanning-tree', 'vtp', 'lacp', 'pagp',
  'port-security', 'storm-control', 'mac-address',
  
  // Layer 3 / Routing
  'ip', 'ipv6', 'route', 'routing', 'ospf', 'bgp', 'eigrp', 'rip', 'isis',
  'static route', 'default gateway', 'next-hop', 'redistribute', 'area',
  'neighbor', 'network', 'prefix', 'subnet', 'mask', 'cidr',
  
  // VLAN
  'vlan', 'native vlan', 'voice vlan', 'allowed vlan',
  
  // Security
  'acl', 'access-list', 'permit', 'deny', 'firewall', 'nat', 'pat',
  'aaa', 'radius', 'tacacs', 'ssh', 'telnet', 'snmp',
  
  // QoS
  'qos', 'policy-map', 'class-map', 'bandwidth', 'priority', 'dscp', 'cos',
  
  // System
  'hostname', 'banner', 'logging', 'ntp', 'dns', 'dhcp', 'snmp',
  'username', 'password', 'secret', 'enable',
  
  // NETCONF/YANG specific
  'netconf', 'yang', 'xml', 'rpc', 'datastore', 'candidate', 'running',
  'edit-config', 'get-config', 'commit', 'validate',
  
  // Cisco NX-OS specific
  'feature', 'vpc', 'vxlan', 'evpn', 'nve', 'fabric', 'vni',
  'peer-keepalive', 'peer-link', 'domain',
  
  // Hardware
  'mtu', 'speed', 'duplex', 'description', 'shutdown', 'no shutdown',
  
  // Thai keywords
  'ตั้งค่า', 'กำหนด', 'สร้าง', 'เพิ่ม', 'ลบ', 'เปิดใช้งาน', 'ปิดใช้งาน',
  'เครือข่าย', 'เราเตอร์', 'สวิตช์', 'อินเตอร์เฟส'
];

// Keywords that indicate NON-configuration prompts (general chat)
const NON_CONFIG_KEYWORDS = [
  // Greetings
  'hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening',
  'how are you', 'what\'s up', 'whats up',
  
  // General questions
  'who are you', 'what is your name', 'what can you do', 'help me',
  'tell me about', 'explain', 'what is', 'define',
  
  // Off-topic
  'weather', 'joke', 'story', 'game', 'play', 'sing', 'dance',
  'food', 'recipe', 'movie', 'music', 'sport', 'news',
  'translate', 'write a poem', 'write code', 'python', 'javascript',
  
  // Personal
  'my name is', 'i am', 'i want to know', 'can you', 'please tell',
  
  // Thai greetings/off-topic
  'สวัสดี', 'หวัดดี', 'คุณเป็นใคร', 'ช่วยอะไรได้', 'เล่าให้ฟัง',
  'อากาศ', 'ตลก', 'เรื่อง', 'เกม', 'อาหาร', 'หนัง', 'เพลง'
];

// Patterns that indicate configuration context
const CONFIG_PATTERNS = [
  // IP addresses
  /\b(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?\b/,
  // Interface names
  /\b(?:ethernet|eth|gig|gi|fa|fe|lo|vlan|po|nve|tunnel)\s*\d+(?:[\/\.]\d+)*/i,
  // Port numbers
  /\bport\s*\d+/i,
  // VLAN IDs
  /\bvlan\s*\d+/i,
  // AS numbers
  /\b(?:as|asn)\s*\d+/i,
  // Area IDs
  /\barea\s*[\d\.]+/i,
  // MTU values
  /\bmtu\s*\d+/i,
];

/**
 * Validation result object
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid - Whether the prompt is valid
 * @property {string} reason - Reason for validation failure
 * @property {number} confidence - Confidence score (0-1)
 * @property {string[]} suggestions - Suggested valid prompts
 */

/**
 * Check if a prompt is related to network configuration
 * @param {string} prompt - User's prompt text
 * @returns {ValidationResult} - Validation result
 */
export const validateConfigPrompt = (prompt) => {
  if (!prompt || typeof prompt !== 'string') {
    return {
      isValid: false,
      reason: 'Prompt is empty or invalid',
      confidence: 1,
      suggestions: []
    };
  }

  const lowerPrompt = prompt.toLowerCase().trim();
  
  // Check for non-config keywords first
  const nonConfigMatches = NON_CONFIG_KEYWORDS.filter(keyword => 
    lowerPrompt.includes(keyword.toLowerCase())
  );
  
  // Check for config keywords
  const configMatches = CONFIG_KEYWORDS.filter(keyword => 
    lowerPrompt.includes(keyword.toLowerCase())
  );
  
  // Check for config patterns (IP, interface names, etc.)
  const patternMatches = CONFIG_PATTERNS.filter(pattern => 
    pattern.test(prompt)
  );
  
  // Calculate scores
  const nonConfigScore = nonConfigMatches.length;
  const configScore = configMatches.length + (patternMatches.length * 2); // Patterns weighted higher
  
  // Determine if this looks like a config prompt
  const isLikelyConfig = configScore > nonConfigScore && configScore >= 1;
  
  // Calculate confidence
  const totalMatches = configScore + nonConfigScore;
  const confidence = totalMatches > 0 
    ? Math.min(Math.abs(configScore - nonConfigScore) / totalMatches, 1)
    : 0.5;

  if (isLikelyConfig) {
    return {
      isValid: true,
      reason: 'Prompt appears to be configuration-related',
      confidence,
      suggestions: []
    };
  }

  // Not a config prompt - provide helpful suggestions
  const suggestions = [
    "Configure interface Ethernet1/1 with IP 192.168.1.1/24",
    "Create VLAN 100 named PRODUCTION",
    "Set up OSPF area 0 on interface GigabitEthernet0/0",
    "Enable trunk port on interface GigabitEthernet1/0/1 allowing VLANs 10,20,30",
    "Add static route to 10.0.0.0/8 via 192.168.1.254"
  ];

  let reason = 'This prompt does not appear to be about network device configuration.';
  
  if (nonConfigMatches.length > 0) {
    reason += ` Detected non-configuration content: "${nonConfigMatches.slice(0, 3).join('", "')}"`;
  }
  
  if (configScore === 0) {
    reason += ' No configuration-related keywords or patterns found.';
  }

  return {
    isValid: false,
    reason,
    confidence,
    suggestions
  };
};

/**
 * Get a user-friendly error message for invalid prompts
 * @param {ValidationResult} validation - Validation result
 * @returns {string} - User-friendly error message
 */
export const getValidationErrorMessage = (validation) => {
  if (validation.isValid) return '';
  
  let message = '⚠️ Invalid Configuration Prompt\n\n';
  message += validation.reason + '\n\n';
  message += 'This tool is designed for generating Cisco network device configurations.\n\n';
  message += '💡 Try prompts like:\n';
  validation.suggestions.slice(0, 3).forEach(suggestion => {
    message += `  • ${suggestion}\n`;
  });
  
  return message;
};

/**
 * Quick check if prompt might be valid (for UI hints)
 * @param {string} prompt - User's prompt text
 * @returns {boolean} - True if prompt might be valid
 */
export const isPromptLikelyValid = (prompt) => {
  if (!prompt || prompt.length < 5) return true; // Too short to judge
  
  const result = validateConfigPrompt(prompt);
  return result.isValid || result.confidence < 0.6;
};
