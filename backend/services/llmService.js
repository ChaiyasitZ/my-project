import axios from 'axios';

/**
 * LLM Service for Cisco Configuration Generation
 * Specialized for Qwen2.5-Coder - Text prompts and NETCONF/YANG generation
 * Optimized for code generation and structured configuration output
 */
export class LLMService {
  constructor() {
    // Configuration
    this.host = process.env.OLLAMA_HOST || 'http://localhost:11434';
    this.model = process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b';
    this.timeout = 60000;
    
    // HTTP Client
    this.client = axios.create({
      baseURL: this.host,
      timeout: this.timeout,
    });
    
    // Optimized parameters for Qwen2.5-Coder (code-specialized model)
    this.defaultParams = {
      temperature: 0.1,    // Lower for more precise code generation
      num_predict: 300,    // More tokens for complete configurations
      top_k: 20,          // More focused for code accuracy
      top_p: 0.85,        // Good balance for structured output
      repeat_penalty: 1.02, // Lower penalty for code repetition
      stop: ['```', 'Human:', 'User:']  // Stop at code block end or conversation
    };
    
    // NETCONF/YANG specific parameters
    this.netconfParams = {
      temperature: 0.05,   // Very precise for XML/YANG
      num_predict: 400,    // More tokens for XML structures
      top_k: 10,          // Highly focused for XML syntax
      top_p: 0.8,         // Structured output
      repeat_penalty: 1.01,
      stop: ['```', '</rpc>', 'Human:']
    };
    
    console.log(`🤖 Qwen2.5-Coder LLM Service initialized - Model: ${this.model} @ ${this.host}`);
    console.log(`🎯 Specialized for: Text prompts + NETCONF/YANG generation`);
  }

  /**
   * Generate Cisco configuration from natural language prompt
   */
  async generateConfiguration(prompt, deviceType, deviceContext = {}) {
    const startTime = Date.now();
    
    try {
      console.log(`🚀 Generating config for ${deviceType}: "${prompt}"`);

      // Build AI prompt
      const aiPrompt = this._buildPrompt(prompt, deviceType, deviceContext);
      
      // Call Ollama API
      const response = await this.client.post("/api/generate", {
        model: this.model,
        prompt: aiPrompt,
        stream: false,
        options: this.defaultParams
      });

      const rawConfig = response.data.response?.trim();
      if (!rawConfig) {
        console.error('❌ Empty response received from DeepSeek Coder');
        console.error('Response data:', response.data);
        throw new Error('Empty response from DeepSeek Coder - check model and prompt format');
      }
      
      console.log(`📦 Raw response: ${rawConfig.length} chars`);
      console.log(`🔍 First 100 chars: ${rawConfig.substring(0, 100)}...`);
      
      // Process and validate configuration
      const cleanConfig = this._cleanConfiguration(rawConfig);
      const deploymentConfig = this._createDeploymentVersion(cleanConfig);
      const validation = this._validateConfiguration(cleanConfig, deviceType);
      
      if (cleanConfig.length < 20 || !validation.isValid) {
        const issues = validation.errors.join(', ') || 'insufficient content';
        throw new Error(`Validation failed: ${issues}`);
      }
      
      const executionTime = Date.now() - startTime;
      console.log(`✅ Generated successfully (${executionTime}ms) - Score: ${validation.score}%`);
      
      return {
        success: true,
        configuration: deploymentConfig,
        displayConfig: cleanConfig,
        deploymentConfig,
        model: this.model,
        deviceType,
        method: 'mistral_7b',
        executionTime,
        validation,
        confidenceScore: validation.score
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error("❌ Generation failed:", error.message);
      
      return {
        success: false,
        error: `Generation failed: ${error.message}`,
        configuration: null,
        executionTime
      };
    }
  }

  /**
   * Build optimized AI prompt with comprehensive Cisco context
   */
  _buildPrompt(prompt, deviceType, deviceContext) {
    const deviceName = deviceContext.name || 'Device';
    const enhancedPrompt = this._preprocessPrompt(prompt);
    const ciscoContext = this._getCiscoCommandContext(deviceType, prompt);
    
    return `You are a Cisco network engineer with expert knowledge of IOS configuration.

DEVICE CONTEXT:
- Device: ${deviceName}
- Type: ${deviceType}
- Model: ${deviceContext.model || 'Cisco Router/Switch'}
- IOS Version: ${deviceContext.ios_version || 'IOS 15.x'}

TASK: ${enhancedPrompt}

${ciscoContext}

CISCO IOS CONFIGURATION RULES:
1. Always start with "configure terminal"
2. Use proper command hierarchy and indentation
3. Include "no shutdown" for interface activation
4. Use full interface names (GigabitEthernet, FastEthernet)
5. End with "end" command
6. Include descriptive comments where helpful

COMMAND SYNTAX VALIDATION:
- Interface names: interface GigabitEthernet0/1
- IP addressing: ip address 192.168.1.1 255.255.255.0
- Routing protocols: router ospf 1, router eigrp 100
- Access lists: access-list 1 permit 192.168.1.0 0.0.0.255
- VLANs: vlan 10, name VLAN_NAME
- Descriptions: description [text]

Generate complete, syntactically correct Cisco IOS configuration:

configure terminal`;
  }

  /**
   * Get Cisco command context based on device type and prompt
   */
  _getCiscoCommandContext(deviceType, prompt) {
    const promptLower = prompt.toLowerCase();
    let context = '';
    
    // Interface configuration context
    if (promptLower.includes('interface') || promptLower.includes('ip address')) {
      context += `
INTERFACE CONFIGURATION CONTEXT:
- Common interfaces: GigabitEthernet0/1, FastEthernet0/1, Serial0/0
- IP configuration: ip address [ip] [mask]
- Interface activation: no shutdown
- Descriptions: description [text]
- Speed/duplex: speed 1000, duplex full
- Switchport modes: switchport mode access/trunk
`;
    }
    
    // Routing protocol context
    if (promptLower.includes('ospf')) {
      context += `
OSPF CONFIGURATION CONTEXT:
- Enable OSPF: router ospf [process-id]
- Router ID: router-id [ip-address]
- Network statements: network [network] [wildcard] area [area-id]
- Interface OSPF: ip ospf [process-id] area [area-id]
- OSPF areas: area 0 (backbone), area 1-65535 (standard)
- Passive interfaces: passive-interface [interface]
`;
    }
    
    if (promptLower.includes('eigrp')) {
      context += `
EIGRP CONFIGURATION CONTEXT:
- Enable EIGRP: router eigrp [as-number]
- Network statements: network [network] [wildcard]
- Auto-summary: no auto-summary (recommended)
- Passive interfaces: passive-interface [interface]
- Metric tuning: metric weights 0 1 0 1 0 1
`;
    }
    
    if (promptLower.includes('bgp')) {
      context += `
BGP CONFIGURATION CONTEXT:
- Enable BGP: router bgp [as-number]
- Router ID: bgp router-id [ip-address]
- Neighbors: neighbor [ip] remote-as [as-number]
- Networks: network [network] mask [mask]
- BGP attributes: weight, local-preference, as-path
`;
    }
    
    // Switching context
    if (deviceType === 'switch' || promptLower.includes('vlan') || promptLower.includes('switch')) {
      context += `
SWITCHING CONFIGURATION CONTEXT:
- VLAN creation: vlan [vlan-id], name [vlan-name]
- Switchport access: switchport mode access, switchport access vlan [vlan-id]
- Switchport trunk: switchport mode trunk, switchport trunk allowed vlan [vlan-list]
- STP configuration: spanning-tree mode [pvst+/rapid-pvst+]
- Port security: switchport port-security, switchport port-security mac-address [mac]
`;
    }
    
    // Security context
    if (promptLower.includes('access-list') || promptLower.includes('acl') || promptLower.includes('security')) {
      context += `
SECURITY CONFIGURATION CONTEXT:
- Standard ACL: access-list [1-99] [permit/deny] [source] [wildcard]
- Extended ACL: access-list [100-199] [permit/deny] [protocol] [source] [dest] [port]
- Named ACL: ip access-list [standard/extended] [name]
- Apply ACL: ip access-group [name/number] [in/out]
- SSH configuration: ip ssh version 2, crypto key generate rsa
`;
    }
    
    // HSRP/VRRP context
    if (promptLower.includes('hsrp') || promptLower.includes('vrrp') || promptLower.includes('redundancy')) {
      context += `
HSRP CONFIGURATION CONTEXT:
- HSRP group: standby [group] ip [virtual-ip]
- Priority: standby [group] priority [priority]
- Preemption: standby [group] preempt
- Authentication: standby [group] authentication md5 key-string [key]
- Tracking: standby [group] track [object] decrement [value]
`;
    }
    
    return context;
  }

  /**
   * Check if prompt is for a simple single command
   */
  _isSimpleCommand(prompt) {
    const lower = prompt.toLowerCase();
    return lower.includes('access-list') || 
           lower.includes('hostname') ||
           lower.includes('vlan ') ||
           (lower.includes('interface ') && !lower.includes('and'));
  }

  /**
   * Preprocess prompt to handle multiple networks and improve parsing
   */
  _preprocessPrompt(prompt) {
    let enhanced = prompt;
    
    // Skip preprocessing for simple commands
    if (this._isSimpleCommand(enhanced)) {
      return enhanced;
    }
    
    // Handle multiple network patterns for OSPF/routing
    if (enhanced.toLowerCase().includes('network') && enhanced.toLowerCase().includes('area')) {
      enhanced = enhanced
        .replace(/\s*-\s*(\d+\.\d+\.\d+\.\d+\/\d+)\s+area\s+(\d+)/g, ' and network $1 area $2')
        .replace(/\s*-\s*(\d+\.\d+\.\d+\.\d+\/\d+)/g, ' and network $1')
        .replace(/(\d+\.\d+\.\d+\.\d+\/\d+)\s+area\s+(\d+)\s+(\d+\.\d+\.\d+\.\d+\/\d+)/g, '$1 area $2 and network $3');
    }
    
    // Add CIDR guidance if needed
    if (enhanced.includes('/')) {
      enhanced = this._addCidrGuidance(enhanced);
    }
    
    return enhanced;
  }

  /**
   * Add CIDR to wildcard guidance
   */
  _addCidrGuidance(prompt) {
    const cidrMappings = {
      '/24': '/24 (wildcard 0.0.0.255)',
      '/25': '/25 (wildcard 0.0.0.127)',
      '/26': '/26 (wildcard 0.0.0.63)', 
      '/27': '/27 (wildcard 0.0.0.31)',
      '/28': '/28 (wildcard 0.0.0.15)',
      '/30': '/30 (wildcard 0.0.0.3)'
    };
    
    let enhanced = prompt;
    Object.entries(cidrMappings).forEach(([cidr, replacement]) => {
      if (enhanced.includes(cidr)) {
        enhanced = enhanced.replace(new RegExp(cidr, 'g'), replacement);
      }
    });
    
    return enhanced;
  }

  /**
   * Clean and format AI generated configuration with Cisco syntax validation
   */
  _cleanConfiguration(rawConfig) {
    if (!rawConfig) return '';
    
    console.log('🧹 Cleaning configuration with Cisco syntax validation...');
    
    let cleaned = rawConfig;
    
    // Extract from code blocks if present
    const codeBlockMatch = rawConfig.match(/```[\s\S]*?```/);
    if (codeBlockMatch) {
      const blockContent = codeBlockMatch[0]
        .replace(/```\w*\n?/g, '')
        .replace(/```/g, '')
        .trim();
      if (blockContent.includes('configure terminal') || blockContent.includes('router')) {
        cleaned = blockContent;
      }
    }
    
    // Remove unwanted content
    cleaned = cleaned
      .replace(/```.*$/gm, '')
      .replace(/^Here's.*$/gmi, '')
      .replace(/^This.*$/gmi, '')
      .replace(/^Sure.*$/gmi, '')
      .replace(/^The.*$/gmi, '')
      .replace(/^For.*$/gmi, '')
      .replace(/enable$/gmi, '')  // Remove standalone enable
      .trim();

    // Format with proper indentation and Cisco syntax validation
    const lines = cleaned.split('\n').filter(line => line.trim());
    const formattedLines = this._formatWithCiscoSyntax(lines);
    
    // Ensure proper structure
    this._ensureProperStructure(formattedLines);
    
    // Validate Cisco command syntax
    const validatedLines = this._validateCiscoSyntax(formattedLines);
    
    const finalConfig = validatedLines.join('\n');
    console.log(`✅ Cleaned and validated configuration: ${validatedLines.length} lines`);
    
    return finalConfig;
  }

  /**
   * Format configuration with Cisco-specific syntax rules
   */
  _formatWithCiscoSyntax(lines) {
    const formattedLines = [];
    let configMode = null;
    let indentLevel = 0;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines
      if (!trimmed) continue;
      
      // Global configuration commands
      if (trimmed === 'configure terminal' || trimmed === 'conf t') {
        formattedLines.push('configure terminal');
        configMode = 'global';
        indentLevel = 0;
        continue;
      }
      
      // Configuration mode entry
      if (trimmed.startsWith('router ') || trimmed.startsWith('interface ') || trimmed.startsWith('vlan ') || 
          trimmed.startsWith('ip access-list ') || trimmed.startsWith('line ')) {
        configMode = trimmed.split(' ')[0];
        formattedLines.push(trimmed);
        indentLevel = 1;
        continue;
      }
      
      // Configuration mode exit
      if (trimmed === 'exit' || trimmed === 'end') {
        if (configMode && configMode !== 'global') {
          configMode = 'global';
          indentLevel = 0;
        }
        formattedLines.push(trimmed);
        continue;
      }
      
      // Sub-configuration commands
      if (configMode && configMode !== 'global') {
        formattedLines.push(' '.repeat(indentLevel) + trimmed);
      } else {
        formattedLines.push(trimmed);
      }
    }
    
    return formattedLines;
  }

  /**
   * Validate Cisco command syntax and fix common issues
   */
  _validateCiscoSyntax(lines) {
    const validatedLines = [];
    
    for (const line of lines) {
      let validatedLine = line;
      
      // Fix common interface name issues
      validatedLine = this._fixInterfaceNames(validatedLine);
      
      // Fix IP address syntax
      validatedLine = this._fixIpAddressSyntax(validatedLine);
      
      // Fix routing protocol syntax
      validatedLine = this._fixRoutingProtocolSyntax(validatedLine);
      
      // Fix VLAN syntax
      validatedLine = this._fixVlanSyntax(validatedLine);
      
      validatedLines.push(validatedLine);
    }
    
    return validatedLines;
  }

  /**
   * Fix interface name syntax
   */
  _fixInterfaceNames(line) {
    let fixed = line;
    
    // Fix common interface abbreviations
    const interfaceMap = {
      'gi': 'GigabitEthernet',
      'fa': 'FastEthernet', 
      'eth': 'Ethernet',
      'se': 'Serial',
      'te': 'TenGigabitEthernet',
      'po': 'Port-channel'
    };
    
    // Fix interface command syntax
    for (const [abbrev, full] of Object.entries(interfaceMap)) {
      const pattern = new RegExp(`\\b${abbrev}(\\d+(?:\\/\\d+(?:\\/\\d+)?)?)\\b`, 'gi');
      fixed = fixed.replace(pattern, `${full}$1`);
    }
    
    // Ensure proper interface command format
    if (fixed.trim().startsWith('interface ')) {
      // Make sure there's no extra spaces in interface names
      fixed = fixed.replace(/interface\s+(\w+)\s*(\d+(?:\/\d+(?:\/\d+)?)?)/i, 'interface $1$2');
    }
    
    return fixed;
  }

  /**
   * Fix IP address command syntax
   */
  _fixIpAddressSyntax(line) {
    let fixed = line;
    
    // Fix IP address format with CIDR to subnet mask conversion
    const cidrPattern = /ip\s+address\s+(\d+\.\d+\.\d+\.\d+)\/(\d+)/i;
    const cidrMatch = fixed.match(cidrPattern);
    
    if (cidrMatch) {
      const ip = cidrMatch[1];
      const prefix = parseInt(cidrMatch[2]);
      const subnetMask = this._cidrToSubnetMask(prefix);
      fixed = fixed.replace(cidrPattern, `ip address ${ip} ${subnetMask}`);
    }
    
    return fixed;
  }

  /**
   * Fix routing protocol syntax
   */
  _fixRoutingProtocolSyntax(line) {
    let fixed = line;
    
    // Fix OSPF network statements with wildcard masks
    const ospfNetworkPattern = /network\s+(\d+\.\d+\.\d+\.\d+)\/(\d+)\s+area\s+(\d+)/i;
    const ospfMatch = fixed.match(ospfNetworkPattern);
    
    if (ospfMatch) {
      const network = ospfMatch[1];
      const prefix = parseInt(ospfMatch[2]);
      const area = ospfMatch[3];
      const wildcardMask = this._cidrToWildcardMask(prefix);
      fixed = fixed.replace(ospfNetworkPattern, `network ${network} ${wildcardMask} area ${area}`);
    }
    
    return fixed;
  }

  /**
   * Fix VLAN syntax
   */
  _fixVlanSyntax(line) {
    let fixed = line;
    
    // Ensure VLAN numbers are valid (1-4094)
    const vlanPattern = /vlan\s+(\d+)/i;
    const vlanMatch = fixed.match(vlanPattern);
    
    if (vlanMatch) {
      const vlanId = parseInt(vlanMatch[1]);
      if (vlanId < 1 || vlanId > 4094) {
        console.warn(`⚠️ Invalid VLAN ID: ${vlanId}, using VLAN 10`);
        fixed = fixed.replace(vlanPattern, 'vlan 10');
      }
    }
    
    return fixed;
  }

  /**
   * Convert CIDR prefix to subnet mask
   */
  _cidrToSubnetMask(prefix) {
    const masks = {
      8: '255.0.0.0',
      16: '255.255.0.0', 
      24: '255.255.255.0',
      25: '255.255.255.128',
      26: '255.255.255.192',
      27: '255.255.255.224',
      28: '255.255.255.240',
      29: '255.255.255.248',
      30: '255.255.255.252'
    };
    
    return masks[prefix] || '255.255.255.0';
  }

  /**
   * Convert CIDR prefix to wildcard mask for OSPF
   */
  _cidrToWildcardMask(prefix) {
    const wildcards = {
      8: '0.255.255.255',
      16: '0.0.255.255',
      24: '0.0.0.255',
      25: '0.0.0.127',
      26: '0.0.0.63',
      27: '0.0.0.31',
      28: '0.0.0.15',
      29: '0.0.0.7',
      30: '0.0.0.3'
    };
    
    return wildcards[prefix] || '0.0.0.255';
  }

  /**
   * Create clean deployment version without comments
   */
  _createDeploymentVersion(configuration) {
    if (!configuration) return '';
    
    const deploymentLines = configuration
      .split('\n')
      .filter(line => {
        const trimmed = line.trim();
        return trimmed.length > 0 && !trimmed.startsWith('!');
      });
    
    console.log(`🚀 Created deployment version: ${deploymentLines.length} lines`);
    return deploymentLines.join('\n');
  }



  /**
   * Ensure configuration has proper structure
   */
  _ensureProperStructure(lines) {
    if (lines.length === 0) return;
    
    if (!lines[0].includes('configure terminal')) {
      lines.unshift('configure terminal');
    }
    
    if (!lines[lines.length - 1].includes('end')) {
      lines.push('end');
    }
  }

  /**
   * Validate configuration and provide explanations
   */
  _validateConfiguration(configuration, deviceType) {
    const validation = {
      isValid: true,
      score: 100,
      errors: [],
      warnings: [],
      explanation: []
    };

    if (!configuration || configuration.length < 20) {
      validation.isValid = false;
      validation.score = 0;
      validation.errors.push('Configuration too short');
      return validation;
    }

    // Analyze configuration components
    this._analyzeComponents(configuration, validation);

    // Basic structure validation
    this._validateStructure(configuration, validation);

    // Device-specific validation
    this._validateDeviceSpecific(configuration, deviceType, validation);

    validation.score = Math.max(0, validation.score);
    validation.isValid = validation.score >= 50;

    return validation;
  }

  /**
   * Validate basic configuration structure
   */
  _validateStructure(configuration, validation) {
    if (!configuration.includes('configure terminal')) {
      validation.warnings.push('Missing configure terminal command');
      validation.score -= 10;
    } else {
      validation.explanation.push('✓ Starts with configure terminal');
    }

    if (!configuration.includes('end')) {
      validation.warnings.push('Missing end command');
      validation.score -= 10;
    } else {
      validation.explanation.push('✓ Ends with end command');
    }
  }

  /**
   * Device-specific validation
   */
  _validateDeviceSpecific(configuration, deviceType, validation) {
    if (deviceType === 'router') {
      const hasRoutingProtocol = /router\s+(ospf|eigrp|bgp|rip)/.test(configuration);
      if (!hasRoutingProtocol) {
        validation.warnings.push('No routing protocol configured');
        validation.score -= 20;
      }
    }
  }

  /**
   * Analyze configuration components and add explanations
   */
  _analyzeComponents(configuration, validation) {
    const lines = configuration.split('\n');
    const patterns = {
      ospf: /^router ospf (\d+)/,
      ospfNetwork: /^\s*network ([\d.]+) ([\d.]+) area (\d+)/,
      routerId: /^\s*router-id ([\d.]+)/,
      interface: /^interface (.+)/,
      ipAddress: /^\s*ip address ([\d.]+) ([\d.]+)/,
      noShutdown: /^\s*no shutdown/,
      bgp: /^router bgp (\d+)/,
      bgpNeighbor: /^\s*neighbor ([\d.]+) remote-as (\d+)/,
      vlan: /^vlan (\d+)/,
      vlanName: /^\s*name (.+)/,
      switchportAccess: /^\s*switchport access vlan (\d+)/
    };
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Check each pattern and add explanations
      if (patterns.ospf.test(trimmed)) {
        const [, processId] = trimmed.match(patterns.ospf);
        validation.explanation.push(`✓ OSPF process ${processId} enabled`);
      } else if (patterns.ospfNetwork.test(trimmed)) {
        const [, network, wildcard, area] = trimmed.match(patterns.ospfNetwork);
        validation.explanation.push(`✓ Network ${network} (wildcard ${wildcard}) in area ${area}`);
      } else if (patterns.routerId.test(trimmed)) {
        const [, routerId] = trimmed.match(patterns.routerId);
        validation.explanation.push(`✓ Router ID set to ${routerId}`);
      } else if (patterns.interface.test(trimmed)) {
        const [, interfaceName] = trimmed.match(patterns.interface);
        validation.explanation.push(`✓ Configuring interface ${interfaceName}`);
      } else if (patterns.ipAddress.test(trimmed)) {
        const [, ip, mask] = trimmed.match(patterns.ipAddress);
        validation.explanation.push(`✓ IP address ${ip}/${mask} assigned`);
      } else if (patterns.noShutdown.test(trimmed)) {
        validation.explanation.push(`✓ Interface enabled`);
      } else if (patterns.bgp.test(trimmed)) {
        const [, asn] = trimmed.match(patterns.bgp);
        validation.explanation.push(`✓ BGP AS ${asn} enabled`);
      } else if (patterns.bgpNeighbor.test(trimmed)) {
        const [, neighbor, remoteAs] = trimmed.match(patterns.bgpNeighbor);
        validation.explanation.push(`✓ BGP neighbor ${neighbor} (AS ${remoteAs})`);
      } else if (patterns.vlan.test(trimmed)) {
        const [, vlanId] = trimmed.match(patterns.vlan);
        validation.explanation.push(`✓ VLAN ${vlanId} created`);
      } else if (patterns.vlanName.test(trimmed)) {
        const [, vlanName] = trimmed.match(patterns.vlanName);
        validation.explanation.push(`✓ VLAN named "${vlanName}"`);
      } else if (patterns.switchportAccess.test(trimmed)) {
        const [, vlanId] = trimmed.match(patterns.switchportAccess);
        validation.explanation.push(`✓ Interface assigned to VLAN ${vlanId}`);
      }
    }
    
    if (validation.explanation.length === 0) {
      validation.explanation.push('✓ Basic Cisco IOS configuration detected');
    }
  }

  /**
   * Generate configurations for multiple devices with topology awareness
   */
  async generateMultiDeviceConfiguration(devices, prompt, topologyHints = {}) {
    const startTime = Date.now();
    
    try {
      console.log(`🚀 Multi-device generation for ${devices.length} devices`);
      
      // Check if topology analysis is available
      const hasTopologyAnalysis = topologyHints.topologyAnalysis && topologyHints.portConfigurations;
      
      const promises = devices.map(async (device, index) => {
        console.log(`🔄 Generating ${index + 1}/${devices.length}: ${device.name}`);
        
        let enhancedPrompt = prompt;
        let deviceContext = device;
        
        // Enhance prompt with topology information if available
        let portConfig = null;
        if (hasTopologyAnalysis) {
          portConfig = topologyHints.portConfigurations.find(pc => pc.device_id === device.id);
          if (portConfig) {
            enhancedPrompt = this._buildTopologyAwarePrompt(prompt, device, portConfig, topologyHints.topologyAnalysis);
            deviceContext = { ...device, topologyContext: portConfig.topology_context };
          }
        } else {
          enhancedPrompt = `${prompt} for device ${device.name}`;
        }
        
        const result = await this.generateConfiguration(enhancedPrompt, device.type, deviceContext);

        return {
          device_id: device.id,
          device_name: device.name,
          success: result.success,
          configuration: result.configuration || null,
          displayConfig: result.displayConfig || null,
          deploymentConfig: result.deploymentConfig || null,
          error: result.error || null,
          validation: result.validation || null,
          topology_enhanced: hasTopologyAnalysis,
          port_mappings: portConfig?.connections || []
        };
      });

      const results = await Promise.all(promises);
      const successCount = results.filter(r => r.success).length;
      const executionTime = Date.now() - startTime;

      console.log(`✅ Multi-device: ${successCount}/${devices.length} successful (${executionTime}ms)`);

      return {
        success: successCount > 0,
        results,
        executionTime,
        method: hasTopologyAnalysis ? 'llava_topology_enhanced' : 'mistral_7b_multi',
        model: this.model,
        topology_enhanced: hasTopologyAnalysis,
        summary: {
          successfulDevices: successCount,
          totalDevices: devices.length,
          description: `${successCount}/${devices.length} devices configured${hasTopologyAnalysis ? ' with topology analysis' : ''}`
        }
      };

    } catch (error) {
      console.error("❌ Multi-device error:", error.message);
      
      return {
        success: false,
        error: `Multi-device generation failed: ${error.message}`,
        results: [],
        executionTime: Date.now() - startTime,
        method: 'mistral_7b_multi',
        model: this.model,
        summary: {
          successfulDevices: 0,
          totalDevices: devices.length,
          description: 'Generation failed'
        }
      };
    }
  }

  /**
   * Build topology-aware prompt with port and connection information
   */
  _buildTopologyAwarePrompt(basePrompt, device, portConfig, topologyAnalysis) {
    const connections = portConfig.connections || [];
    const connectionInfo = connections.map(conn => 
      `${conn.local_port} → ${conn.remote_device} ${conn.remote_port}`
    ).join('\n');

    return `Generate Cisco IOS configuration for ${device.name} (${device.type}) based on network topology analysis.

TOPOLOGY CONTEXT:
${topologyAnalysis.networkSummary || 'Network topology provided'}

DEVICE CONNECTIONS:
${connectionInfo || 'No specific connections mapped'}

DETECTED PROTOCOLS: ${(topologyAnalysis.protocols || []).join(', ') || 'Standard protocols'}
NETWORK SEGMENTS: ${(topologyAnalysis.ipRanges || []).join(', ') || 'Auto-assign'}
VLANS DETECTED: ${(topologyAnalysis.vlans || []).join(', ') || 'None specified'}

USER REQUEST: ${basePrompt}

REQUIREMENTS:
1. Configure interfaces for all mapped connections
2. Apply appropriate routing protocols based on topology
3. Use IP addressing that fits the network design
4. Include port descriptions matching the topology
5. Configure VLANs if this is a switch with VLAN requirements

Generate configuration:`;
  }

  /**
   * Generate NETCONF XML configuration using Qwen2.5-Coder
   */
  async generateNetconfXml(prompt, deviceType, deviceContext = {}, yangModel = null) {
    const startTime = Date.now();
    
    try {
      console.log(`🔗 NETCONF/YANG XML generation with Qwen2.5-Coder: "${prompt}"`);

      const xmlPrompt = `You are a Cisco network engineer expert in NETCONF/YANG and XML configuration.

DEVICE CONTEXT:
- Device: ${deviceContext.name || 'Device'}
- Type: ${deviceType}
- Model: ${deviceContext.model || 'Cisco IOS-XE Device'}
- YANG Model: ${yangModel?.name || 'Cisco-IOS-XE-native'}

TASK: ${prompt}

NETCONF/YANG EXPERTISE:
- NETCONF uses XML-based configuration
- YANG models define data structure
- Cisco IOS-XE supports NETCONF 1.0 and 1.1
- Common operations: <edit-config>, <get-config>, <get>
- Datastores: running, candidate, startup

CISCO IOS-XE YANG MODELS:
- Cisco-IOS-XE-native: Main configuration model
- Cisco-IOS-XE-interfaces: Interface configuration
- Cisco-IOS-XE-ospf: OSPF routing protocol
- Cisco-IOS-XE-bgp: BGP routing protocol
- ietf-interfaces: Standard interface model

XML STRUCTURE REQUIREMENTS:
1. Valid XML with proper namespaces
2. NETCONF RPC wrapper with message-id
3. Proper target datastore (running/candidate)
4. Cisco-specific YANG model namespaces
5. Correct XML element hierarchy

NETCONF RPC TEMPLATE:
<?xml version="1.0" encoding="UTF-8"?>
<rpc xmlns="urn:ietf:params:xml:ns:netconf:base:1.0" message-id="1">
  <edit-config>
    <target><running/></target>
    <config>
      <native xmlns="http://cisco.com/ns/yang/Cisco-IOS-XE-native">
        <!-- Your configuration elements here -->
      </native>
    </config>
  </edit-config>
</rpc>

Generate syntactically correct NETCONF XML for: ${prompt}

<?xml version="1.0" encoding="UTF-8"?>`;

      const response = await this.client.post("/api/generate", {
        model: this.model,
        prompt: xmlPrompt,
        stream: false,
        options: this.netconfParams  // Use specialized NETCONF parameters
      });

      const xmlConfiguration = response.data.response?.trim();
      
      if (!xmlConfiguration || !xmlConfiguration.includes('<')) {
        throw new Error('Invalid XML response');
      }
      
      const executionTime = Date.now() - startTime;
      console.log(`✅ NETCONF XML generated (${executionTime}ms)`);
      
      return {
        success: true,
        configuration: xmlConfiguration,
        model: this.model,
        deviceType,
        method: 'mistral_7b_netconf',
        executionTime,
        validation: { isValid: true, errors: [], warnings: [] },
        confidenceScore: 85,
        yangModel: yangModel?.name || 'Cisco-IOS-XE-native',
        outputFormat: 'netconf_xml'
      };
      
    } catch (error) {
      console.error("❌ NETCONF XML error:", error.message);
      
      return {
        success: false,
        error: `NETCONF XML generation failed: ${error.message}`,
        configuration: null,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Explain existing configuration
   */
  async explainConfiguration(configuration) {
    try {
      const prompt = `Explain this Cisco configuration briefly:

${configuration.substring(0, 400)}

Provide a concise technical explanation:`;

      const response = await this.client.post("/api/generate", {
        model: this.model,
        prompt: prompt,
        stream: false,
        options: { ...this.defaultParams, temperature: 0.3, num_predict: 200 }
      });

      return {
        success: true,
        explanation: response.data.response?.trim() || "No explanation generated",
        model: this.model,
        method: 'mistral_7b_explain'
      };
    } catch (error) {
      return {
        success: false,
        explanation: "Configuration explanation failed",
        error: error.message
      };
    }
  }

  /**
   * Get LLM service status and capabilities
   */
  async getServiceStatus() {
    try {
      const response = await this.client.get("/api/tags");
      const models = response.data.models || [];
      const currentModel = models.find(m => m.name === this.model);

      return {
        status: "connected",
        service: "Qwen2.5-Coder Text & NETCONF/YANG Generator",
        host: this.host,
        model: this.model,
        modelAvailable: !!currentModel,
        availableModels: models.map(m => m.name),
        timeout: this.timeout,
        specialization: "Text prompts + NETCONF/YANG XML generation",
        optimizations: {
          text_generation: this.defaultParams,
          netconf_generation: this.netconfParams
        },
        features: [
          "🎯 Text-based Cisco configuration generation",
          "🔧 Code-specialized for network devices", 
          "📝 Expert NETCONF/YANG XML generation",
          "🚀 Multi-device support with topology awareness",
          "✅ Advanced Cisco syntax validation",
          "⚡ Optimized for Qwen2.5-Coder model",
          "🔍 Automatic CIDR to subnet mask conversion",
          "📋 Protocol-specific configuration expertise"
        ]
      };
    } catch (error) {
      return {
        status: "disconnected",
        service: "Qwen2.5-Coder Text & NETCONF/YANG Generator", 
        host: this.host,
        model: this.model,
        modelAvailable: false,
        error: error.message
      };
    }
  }
}

export default new LLMService();
