/**
 * YANG File Parser Utility
 * Extracts metadata from YANG file content
 */

import { DEVICE_TYPE_PATTERNS, CATEGORY_KEYWORDS } from '../constants/configurationConstants';

/**
 * Detect device type from namespace or module name
 * @param {string} text - Text to check (namespace or module name)
 * @returns {string} - Detected device type or 'all'
 */
const detectDeviceType = (text) => {
  if (!text) return 'all';
  const lowerText = text.toLowerCase();
  
  for (const [deviceType, patterns] of Object.entries(DEVICE_TYPE_PATTERNS)) {
    if (patterns.some(pattern => lowerText.includes(pattern))) {
      // Special check for 'ios' to avoid matching 'ios-xe' or 'ios-xr'
      if (deviceType === 'ios' && (lowerText.includes('xe') || lowerText.includes('xr'))) {
        continue;
      }
      return deviceType;
    }
  }
  return 'all';
};

/**
 * Detect category from YANG file content
 * @param {string} content - YANG file content
 * @returns {string} - Detected category
 */
const detectCategory = (content) => {
  if (!content) return 'other';
  const lowerContent = content.toLowerCase();
  
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(keyword => lowerContent.includes(keyword))) {
      return category;
    }
  }
  return 'other';
};

/**
 * Parse YANG file content to extract metadata
 * @param {string} content - YANG file content
 * @param {string} fileName - Original filename (without .yang extension)
 * @returns {Object} - Extracted metadata
 */
export const parseYangFile = (content, fileName) => {
  const result = {
    name: fileName,
    namespace: '',
    prefix: '',
    description: '',
    version: '1.0.0',
    device_type: 'all',
    category: 'other'
  };
  
  if (!content) return result;
  
  try {
    // Extract module/submodule name
    const moduleMatch = content.match(/(?:module|submodule)\s+([^\s{]+)/);
    if (moduleMatch) {
      result.name = moduleMatch[1];
    }
    
    // Extract namespace
    const namespaceMatch = content.match(/namespace\s+"([^"]+)"/);
    if (namespaceMatch) {
      result.namespace = namespaceMatch[1];
      result.device_type = detectDeviceType(namespaceMatch[1]);
    }
    
    // Try to detect from module name if namespace didn't match
    if (result.device_type === 'all' && result.name) {
      result.device_type = detectDeviceType(result.name);
    }
    
    // Extract prefix
    const prefixMatch = content.match(/prefix\s+([^\s;{]+)/);
    if (prefixMatch) {
      result.prefix = prefixMatch[1].replace(/[";]/g, '');
    }
    
    // Extract description (first description found, usually module description)
    const descMatch = content.match(/description\s+"([^"]+)"/);
    if (descMatch) {
      result.description = descMatch[1].substring(0, 200); // Limit to 200 chars
    }
    
    // Extract revision/version
    const revisionMatch = content.match(/revision\s+(\d{4}-\d{2}-\d{2})/);
    if (revisionMatch) {
      result.version = revisionMatch[1];
    }
    
    // Auto-detect category
    result.category = detectCategory(content);
    
  } catch (error) {
    console.warn('Error parsing YANG file:', error);
  }
  
  return result;
};

/**
 * Generate NETCONF workflow XML
 * @param {string} config - Configuration content
 * @param {boolean} shouldValidate - Whether to include validation step
 * @returns {string} - NETCONF workflow XML
 */
export const generateNetconfWorkflowXml = (config, shouldValidate) => {
  if (!config) return config;
  
  // Check if it's XML/NETCONF config
  if (!config.includes('<') || !config.includes('>')) return config;
  
  // Check if already wrapped with workflow
  if (config.includes('<!-- NETCONF Workflow:')) return config;
  
  // Clean any XML declaration from config for embedding
  const cleanConfig = config.replace(/<\?xml[^?]*\?>\s*/g, '').trim();
  
  // Indent the config for proper nesting
  const indentedConfig = cleanConfig.split('\n').map(line => '        ' + line).join('\n');
  
  const baseWorkflow = `<?xml version="1.0" encoding="UTF-8"?>
<!-- NETCONF Workflow: ${shouldValidate ? 'Validate Before Apply' : 'Direct Apply (No Validation)'} -->
<!-- Step 1: Lock candidate datastore -->
<rpc message-id="1" xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
  <lock>
    <target>
      <candidate/>
    </target>
  </lock>
</rpc>

<!-- Step 2: Edit candidate configuration -->
<rpc message-id="2" xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
  <edit-config>
    <target>
      <candidate/>
    </target>
    <default-operation>merge</default-operation>
    <config>
${indentedConfig}
    </config>
  </edit-config>
</rpc>`;

  if (shouldValidate) {
    return `${baseWorkflow}

<!-- Step 3: Validate candidate configuration (RFC 6241) -->
<rpc message-id="3" xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
  <validate>
    <source>
      <candidate/>
    </source>
  </validate>
</rpc>

<!-- Step 4: Commit validated configuration -->
<rpc message-id="4" xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
  <commit/>
</rpc>

<!-- Step 5: Unlock candidate datastore -->
<rpc message-id="5" xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
  <unlock>
    <target>
      <candidate/>
    </target>
  </unlock>
</rpc>`;
  } else {
    return `${baseWorkflow}

<!-- Step 3: Commit configuration -->
<rpc message-id="3" xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
  <commit/>
</rpc>

<!-- Step 4: Unlock candidate datastore -->
<rpc message-id="4" xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
  <unlock>
    <target>
      <candidate/>
    </target>
  </unlock>
</rpc>`;
  }
};

/**
 * Get category color class
 * @param {string} category - Category name
 * @returns {string} - Tailwind CSS classes
 */
export const getCategoryColor = (category) => {
  const colors = {
    interface: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
    routing: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300',
    switching: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300',
    security: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300',
    qos: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300',
    system: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
    other: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
  };
  return colors[category] || colors.other;
};
