import ConfigurationTemplate from '../models/ConfigurationTemplate.js';

export class TemplateService {
  constructor() {
    this.templateCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    console.log('🔧 Template Service initialized');
  }

  /**
   * Parse user prompt to identify configuration type and extract variables
   */
  parsePrompt(prompt, deviceType) {
    const promptLower = prompt.toLowerCase();
    
    // Define pattern mappings for different configuration types
    const patternMappings = {
      // OSPF Patterns
      ospf: {
        keywords: ['ospf', 'open shortest path', 'link state'],
        patterns: [
          { regex: /ospf\s+(\d+)/i, variable: 'process_id' },
          { regex: /network\s+([\d.]+)(?:\/(\d+)|\s+([\d.]+))/i, 
            variables: ['network', 'cidr_or_wildcard'] },
          { regex: /area\s+(\d+)/i, variable: 'area' },
          { regex: /router.?id\s+([\d.]+)/i, variable: 'router_id' }
        ],
        category: 'routing_ospf',
        template: 'OSPF Basic Configuration'
      },

      // EIGRP Patterns  
      eigrp: {
        keywords: ['eigrp', 'enhanced interior gateway'],
        patterns: [
          { regex: /eigrp\s+(\d+)/i, variable: 'as_number' },
          { regex: /as\s+(\d+)/i, variable: 'as_number' },
          { regex: /network\s+([\d.]+)(?:\/(\d+)|\s+([\d.]+))/i, 
            variables: ['network', 'cidr_or_wildcard'] }
        ],
        category: 'routing_eigrp',
        template: 'EIGRP Basic Configuration'
      },

      // RIP Patterns
      rip: {
        keywords: ['rip', 'ripv2', 'rip version 2'],
        patterns: [
          { regex: /network\s+([\d.]+)/i, variable: 'network' },
          { regex: /version\s+2/i, variable: 'version' }
        ],
        category: 'routing_rip',
        template: 'RIPv2 Basic Configuration'
      },

      // BGP Patterns
      bgp: {
        keywords: ['bgp', 'border gateway protocol'],
        patterns: [
          { regex: /bgp\s+(\d+)/i, variable: 'as_number' },
          { regex: /as\s+(\d+)/i, variable: 'as_number' },
          { regex: /neighbor\s+([\d.]+)/i, variable: 'neighbor_ip' },
          { regex: /remote.?as\s+(\d+)/i, variable: 'neighbor_as' }
        ],
        category: 'routing_bgp',
        template: 'BGP Basic Configuration'
      },

      // ISIS Patterns
      isis: {
        keywords: ['isis', 'intermediate system'],
        patterns: [
          { regex: /isis\s+(\w+)/i, variable: 'tag' },
          { regex: /net\s+([\d.]+)/i, variable: 'net_id' },
          { regex: /level.(\d)/i, variable: 'level' }
        ],
        category: 'routing_isis',
        template: 'ISIS Basic Configuration'
      },

      // Interface Patterns
      interface: {
        keywords: ['interface', 'ip address', 'no shutdown'],
        patterns: [
          { regex: /((?:gigabit|fast)?ethernet|serial|loopback)[\d\/\.]+/i, variable: 'interface_name' },
          { regex: /ip\s+address\s+([\d.]+)\s+([\d.]+)/i, 
            variables: ['ip_address', 'subnet_mask'] },
          { regex: /description\s+(\w+)/i, variable: 'description' }
        ],
        category: 'basic_interface',
        template: 'Basic Router Interface Configuration'
      },

      // VLAN Patterns (Switch)
      vlan: {
        keywords: ['vlan', 'switchport', 'trunk', 'access'],
        patterns: [
          { regex: /vlan\s+(\d+)/i, variable: 'vlan_id' },
          { regex: /name\s+(\w+)/i, variable: 'vlan_name' },
          { regex: /access\s+vlan\s+(\d+)/i, variable: 'vlan_id' },
          { regex: /((?:gigabit|fast)?ethernet)[\d\/\.]+/i, variable: 'interface_name' }
        ],
        category: 'switching_vlan',
        template: 'Basic VLAN Configuration'
      },

      // Static Route Patterns
      static: {
        keywords: ['static route', 'ip route', 'default route'],
        patterns: [
          { regex: /route\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i, 
            variables: ['destination_network', 'subnet_mask', 'next_hop'] },
          { regex: /default\s+gateway\s+([\d.]+)/i, variable: 'default_gateway' }
        ],
        category: 'routing_static',
        template: 'Static Routing Configuration'
      },

      // ACL Patterns
      acl: {
        keywords: ['access-list', 'acl', 'permit', 'deny'],
        patterns: [
          { regex: /access.list\s+(\d+)/i, variable: 'acl_number' },
          { regex: /(permit|deny)\s+([\d.]+)\s+([\d.]+)/i, 
            variables: ['action', 'source_network', 'wildcard'] }
        ],
        category: 'security_acl',
        template: 'ACL Standard Configuration'
      },

      // NAT Patterns
      nat: {
        keywords: ['nat', 'network address translation', 'inside', 'outside'],
        patterns: [
          { regex: /pool\s+(\w+)/i, variable: 'pool_name' },
          { regex: /inside\s+([\d.]+)/i, variable: 'internal_network' }
        ],
        category: 'nat',
        template: 'NAT Configuration'
      }
    };

    // Score each pattern type
    let bestMatch = null;
    let bestScore = 0;

    for (const [type, config] of Object.entries(patternMappings)) {
      let score = 0;
      
      // Check keyword matches
      for (const keyword of config.keywords) {
        if (promptLower.includes(keyword)) {
          score += 10;
        }
      }

      // Check pattern matches
      const extractedVars = {};
      for (const pattern of config.patterns) {
        const match = prompt.match(pattern.regex);
        if (match) {
          score += 5;
          if (pattern.variable) {
            extractedVars[pattern.variable] = match[1];
          } else if (pattern.variables) {
            pattern.variables.forEach((varName, index) => {
              if (match[index + 1]) {
                extractedVars[varName] = match[index + 1];
              }
            });
          }
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = {
          type,
          category: config.category,
          template: config.template,
          variables: extractedVars,
          confidence: Math.min(score / 20, 1.0) // Normalize to 0-1
        };
      }
    }

    return bestMatch;
  }

  /**
   * Convert CIDR to wildcard mask
   */
  cidrToWildcard(cidr) {
    const wildcards = {
      '8': '0.255.255.255', '16': '0.0.255.255', '24': '0.0.0.255',
      '25': '0.0.0.127', '26': '0.0.0.63', '27': '0.0.0.31',
      '28': '0.0.0.15', '29': '0.0.0.7', '30': '0.0.0.3'
    };
    return wildcards[cidr] || '0.0.0.255';
  }

  /**
   * Convert subnet mask to wildcard mask
   */
  subnetToWildcard(subnetMask) {
    const parts = subnetMask.split('.').map(num => 255 - parseInt(num));
    return parts.join('.');
  }

  /**
   * Process extracted variables and normalize them
   */
  processVariables(variables, deviceType) {
    const processed = { ...variables };

    // Handle CIDR notation
    if (processed.cidr_or_wildcard) {
      if (processed.cidr_or_wildcard.includes('.')) {
        // It's a subnet mask, convert to wildcard
        processed.wildcard = this.subnetToWildcard(processed.cidr_or_wildcard);
      } else {
        // It's CIDR, convert to wildcard
        processed.wildcard = this.cidrToWildcard(processed.cidr_or_wildcard);
      }
      delete processed.cidr_or_wildcard;
    }

    // Normalize interface names
    if (processed.interface_name) {
      processed.interface_name = this.normalizeInterfaceName(processed.interface_name);
    }

    // Add device-specific defaults
    if (deviceType === 'router') {
      processed.active_interface = processed.interface_name || 'GigabitEthernet0/1';
    } else if (deviceType === 'switch') {
      processed.interface_name = processed.interface_name || 'FastEthernet0/1';
    }

    return processed;
  }

  /**
   * Normalize interface names to proper Cisco format
   */
  normalizeInterfaceName(interfaceName) {
    const name = interfaceName.toLowerCase();
    
    if (name.includes('gigabit') || name.includes('gi')) {
      return interfaceName.replace(/gi|gigabit/i, 'GigabitEthernet');
    } else if (name.includes('fast') || name.includes('fa')) {
      return interfaceName.replace(/fa|fast/i, 'FastEthernet');
    } else if (name.includes('serial') || name.includes('se')) {
      return interfaceName.replace(/se|serial/i, 'Serial');
    } else if (name.includes('loopback') || name.includes('lo')) {
      return interfaceName.replace(/lo|loopback/i, 'Loopback');
    }
    
    return interfaceName;
  }

  /**
   * Get template from database with caching and fallback
   */
  async getTemplate(templateName, category) {
    const cacheKey = `${templateName}-${category}`;
    
    // Check cache first
    if (this.templateCache.has(cacheKey)) {
      const cached = this.templateCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.template;
      }
    }

    try {
      // Try to find by name first, then by category
      let template = await ConfigurationTemplate.findOne({ name: templateName });
      
      if (!template && category) {
        template = await ConfigurationTemplate.findOne({ category: category });
      }

      if (template) {
        // Cache the template
        this.templateCache.set(cacheKey, {
          template: template,
          timestamp: Date.now()
        });
      }

      return template;
    } catch (error) {
      console.warn('⚠️ Database template lookup failed, using fallback:', error.message);
      // Use fallback templates if database is not available
      return this.getFallbackTemplate(templateName, category);
    }
  }

  /**
   * Fallback templates when database is not available
   */
  getFallbackTemplate(templateName, category) {
    const fallbackTemplates = {
      'OSPF Basic Configuration': {
        name: 'OSPF Basic Configuration',
        template_config: `configure terminal
!
router ospf {{process_id}}
 router-id {{router_id}}
 network {{network}} {{wildcard}} area {{area}}
 passive-interface default
 no passive-interface {{active_interface}}
 default-information originate
exit
!
interface {{interface_name}}
 ip ospf {{process_id}} area {{area}}
 ip ospf hello-interval 10
 ip ospf dead-interval 40
exit
!
end`,
        variables: {
          process_id: { default: 1 },
          router_id: { default: '1.1.1.1' },
          network: { default: '192.168.1.0' },
          wildcard: { default: '0.0.0.255' },
          area: { default: 0 },
          active_interface: { default: 'GigabitEthernet0/1' },
          interface_name: { default: 'GigabitEthernet0/1' }
        }
      },
      'EIGRP Basic Configuration': {
        name: 'EIGRP Basic Configuration',
        template_config: `configure terminal
!
router eigrp {{as_number}}
 network {{network}} {{wildcard}}
 passive-interface default
 no passive-interface {{active_interface}}
 eigrp router-id {{router_id}}
exit
!
end`,
        variables: {
          as_number: { default: 100 },
          network: { default: '192.168.1.0' },
          wildcard: { default: '0.0.0.255' },
          active_interface: { default: 'GigabitEthernet0/1' },
          router_id: { default: '1.1.1.1' }
        }
      },
      'BGP Basic Configuration': {
        name: 'BGP Basic Configuration',
        template_config: `configure terminal
!
router bgp {{as_number}}
 bgp router-id {{router_id}}
 bgp log-neighbor-changes
 network {{network}} mask {{subnet_mask}}
 neighbor {{neighbor_ip}} remote-as {{neighbor_as}}
 neighbor {{neighbor_ip}} description {{neighbor_description}}
exit
!
end`,
        variables: {
          as_number: { default: 65001 },
          router_id: { default: '1.1.1.1' },
          network: { default: '192.168.1.0' },
          subnet_mask: { default: '255.255.255.0' },
          neighbor_ip: { default: '10.0.0.2' },
          neighbor_as: { default: 65002 },
          neighbor_description: { default: 'PEER_ROUTER' }
        }
      },
      'Basic VLAN Configuration': {
        name: 'Basic VLAN Configuration',
        template_config: `configure terminal
!
vlan {{vlan_id}}
 name {{vlan_name}}
exit
!
interface {{interface_name}}
 switchport mode access
 switchport access vlan {{vlan_id}}
 spanning-tree portfast
 no shutdown
exit
!
end`,
        variables: {
          vlan_id: { default: 10 },
          vlan_name: { default: 'SALES_VLAN' },
          interface_name: { default: 'FastEthernet0/1' }
        }
      }
    };

    // Try to find by name or category
    let template = fallbackTemplates[templateName];
    if (!template && category) {
      // Try to find first template that might match category
      template = Object.values(fallbackTemplates).find(t => 
        t.name.toLowerCase().includes(category.replace('routing_', '').replace('switching_', ''))
      );
    }

    return template || null;
  }

  /**
   * Substitute variables in template
   */
  substituteVariables(templateConfig, variables, templateVariables) {
    let config = templateConfig;

    // Merge template defaults with user variables
    const allVariables = {};
    
    // Start with template defaults
    if (templateVariables) {
      Object.entries(templateVariables).forEach(([key, value]) => {
        allVariables[key] = value.default || '';
      });
    }

    // Override with user-provided variables
    Object.entries(variables).forEach(([key, value]) => {
      allVariables[key] = value;
    });

    // Substitute all variables
    Object.entries(allVariables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      config = config.replace(regex, value);
    });

    return config;
  }

  /**
   * Generate configuration using template
   */
  async generateFromTemplate(prompt, deviceType, deviceContext = {}) {
    console.log(`🔧 Template-based generation for: "${prompt}"`);
    
    try {
      // Parse the prompt to identify configuration type
      const parseResult = this.parsePrompt(prompt, deviceType);
      
      if (!parseResult || parseResult.confidence < 0.3) {
        return {
          success: false,
          error: 'Could not identify configuration type from prompt',
          suggestion: 'Try being more specific about the configuration needed (e.g., "configure OSPF 1 network 192.168.1.0/24 area 0")'
        };
      }

      console.log(`🎯 Identified: ${parseResult.type} (confidence: ${(parseResult.confidence * 100).toFixed(1)}%)`);

      // Get the appropriate template
      const template = await this.getTemplate(parseResult.template, parseResult.category);
      
      if (!template) {
        return {
          success: false,
          error: `Template not found: ${parseResult.template}`,
          suggestion: 'Template database may not be initialized. Run: node scripts/initConfigurationTemplates.js'
        };
      }

      // Process and normalize variables
      const processedVariables = this.processVariables(parseResult.variables, deviceType);

      // Generate configuration by substituting variables
      const configuration = this.substituteVariables(
        template.template_config,
        processedVariables,
        template.variables
      );

      return {
        success: true,
        configuration: configuration,
        templateUsed: template.name,
        category: template.category,
        extractedVariables: processedVariables,
        confidence: parseResult.confidence,
        executionTime: Date.now(), // Will be calculated by caller
        method: 'template'
      };

    } catch (error) {
      console.error('❌ Template generation error:', error);
      return {
        success: false,
        error: `Template generation failed: ${error.message}`,
        method: 'template'
      };
    }
  }

  /**
   * List available templates by category
   */
  async getAvailableTemplates(deviceType = null, category = null) {
    try {
      const filter = {};
      if (deviceType) filter.device_type = deviceType;
      if (category) filter.category = category;

      const templates = await ConfigurationTemplate.find(filter)
        .select('name description category device_type variables')
        .sort({ category: 1, name: 1 });

      return {
        success: true,
        templates: templates
      };
    } catch (error) {
      console.error('❌ Error fetching templates:', error);
      return {
        success: false,
        error: error.message,
        templates: []
      };
    }
  }

  /**
   * Get template categories
   */
  async getTemplateCategories() {
    try {
      const categories = await ConfigurationTemplate.distinct('category');
      return {
        success: true,
        categories: categories.sort()
      };
    } catch (error) {
      console.error('❌ Error fetching categories:', error);
      return {
        success: false,
        categories: []
      };
    }
  }
}

export default new TemplateService(); 