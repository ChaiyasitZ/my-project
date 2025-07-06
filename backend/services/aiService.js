import axios from 'axios';
import yangService from './yangService.js';

export class AIService {
  constructor() {
    this.host = process.env.OLLAMA_HOST || 'http://localhost:11434';
    this.model = process.env.OLLAMA_MODEL || 'codellama:13b';
    this.client = axios.create({
      baseURL: this.host,
      timeout: 120000,
    });
    
    console.log(`🤖 Enhanced AI Service initialized with ${this.model} at ${this.host}`);
    console.log(`🗂️ YANG/NETCONF support enabled`);
  }

  // Main configuration generation method
  async generateConfiguration(prompt, deviceType, deviceContext = {}) {
    const startTime = Date.now();
    
    try {
      console.log(`🤖 Generating configuration for ${deviceType}: "${prompt}"`);

      // Build focused prompt
      const aiPrompt = this.buildEnhancedPrompt(prompt, deviceType, deviceContext);
      console.log(`📝 Using prompt length: ${aiPrompt.length} characters`);

      // Generate with AI
      const response = await this.client.post("/api/generate", {
        model: this.model,
        prompt: aiPrompt,
        stream: false,
        options: {
          temperature: 0.1, // Lower temperature for more consistent output
          top_k: 20,
          top_p: 0.7,
          num_predict: 800, // Ensure enough tokens for complete config
          repeat_penalty: 1.1,
          stop: ["```", "---", "Note:", "Explanation:", "Remember:", "Note that", "Here's", "This configuration"]
        },
      });

      let configuration = response.data.response ? response.data.response.trim() : '';
      console.log(`📦 Raw AI response length: ${configuration.length} characters`);
      console.log(`📦 Raw AI response preview: "${configuration.substring(0, 200)}..."`);
      
      // More lenient length check
      if (!configuration || configuration.length < 5) {
        console.log(`❌ Response too short, trying alternative approach`);
        return await this.generateFallbackConfiguration(prompt, deviceType, deviceContext);
      }

      // Clean and format configuration
      configuration = this.cleanConfiguration(configuration);
      console.log(`🧹 Cleaned configuration length: ${configuration.length} characters`);
      
      // If cleaning resulted in empty config, try fallback
      if (!configuration || configuration.length < 20) {
        console.log(`❌ Cleaned configuration too short, using fallback`);
        return await this.generateFallbackConfiguration(prompt, deviceType, deviceContext);
      }
      
      // Basic validation
      const validation = this.validateConfiguration(configuration, deviceType);
      const executionTime = Date.now() - startTime;

      const result = {
        success: true,
        configuration: configuration,
        model: this.model,
        deviceType: deviceType,
        method: 'raw_ai',
        executionTime: executionTime,
        validation: validation,
        confidenceScore: validation.score,
        recommendations: this.getBasicRecommendations(configuration, deviceType)
      };

      console.log(`✅ Configuration generated successfully (${executionTime}ms, confidence: ${validation.score}%)`);
      return result;
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error("❌ AI Service Error:", error.message);
      
      // Try fallback if main generation fails
      if (error.code === 'ECONNREFUSED' || error.message.includes('timeout')) {
        console.log(`🔄 Connection issue, trying fallback generation`);
        return await this.generateFallbackConfiguration(prompt, deviceType, deviceContext);
      }
      
      return {
        success: false,
        error: `Failed to generate configuration: ${error.message}. Please check if Ollama is running.`,
        configuration: null,
        executionTime: executionTime
      };
    }
  }

  // 🆕 Multi-Device Configuration Generation
  async generateMultiDeviceConfiguration(devices, prompt, topologyHints = {}) {
    const startTime = Date.now();
    
    try {
      console.log(`🤖 Generating multi-device configuration for ${devices.length} devices: "${prompt}"`);

      const results = [];
      const deviceConfigs = [];

      // Phase 1: Analyze topology and build relationships
      const topology = this.analyzeTopology(devices, topologyHints);
      console.log(`🔗 Detected topology:`, topology);

      // Phase 2: Generate configuration for each device with topology awareness
      for (let i = 0; i < devices.length; i++) {
        const device = devices[i];
        const devicePosition = i + 1;
        const totalDevices = devices.length;
        
        console.log(`🔄 Generating config ${devicePosition}/${totalDevices} for ${device.name} (${device.type})`);

        // Build topology-aware prompt for this device
        const devicePrompt = this.buildMultiDevicePrompt(
          prompt, 
          device, 
          devices, 
          topology, 
          devicePosition
        );

        // Generate configuration
        const deviceResult = await this.generateConfiguration(
          devicePrompt, 
          device.type, 
          {
            ...device,
            isMultiDevice: true,
            position: devicePosition,
            totalDevices: totalDevices,
            peers: topology.peers[device.id] || []
          }
        );

        if (deviceResult.success) {
          deviceConfigs.push({
            device: device,
            config: deviceResult.configuration,
            validation: deviceResult.validation,
            recommendations: deviceResult.recommendations
          });
          
          results.push({
            device_id: device.id,
            device_name: device.name,
            success: true,
            configuration: deviceResult.configuration,
            validation: deviceResult.validation
          });
        } else {
          results.push({
            device_id: device.id,
            device_name: device.name,
            success: false,
            error: deviceResult.error
          });
        }
      }

      // Phase 3: Cross-validate configurations for consistency
      const crossValidation = this.validateMultiDeviceConsistency(deviceConfigs, topology);

      const executionTime = Date.now() - startTime;
      const successCount = results.filter(r => r.success).length;

      console.log(`✅ Multi-device generation completed: ${successCount}/${devices.length} successful (${executionTime}ms)`);

      return {
        success: successCount > 0,
        results: results,
        topology: topology,
        crossValidation: crossValidation,
        executionTime: executionTime,
        summary: {
          totalDevices: devices.length,
          successfulDevices: successCount,
          failedDevices: devices.length - successCount
        }
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error("❌ Multi-Device AI Service Error:", error.message);
      
      return {
        success: false,
        error: `Failed to generate multi-device configuration: ${error.message}`,
        results: [],
        executionTime: executionTime
      };
    }
  }

  // Analyze topology relationships between devices
  analyzeTopology(devices, hints) {
    const topology = {
      devices: devices.map(d => ({
        id: d.id,
        name: d.name,
        type: d.type,
        role: this.inferDeviceRole(d, devices)
      })),
      peers: {},
      networks: []
    };

    // Build peer relationships (simplified - assumes sequential connectivity)
    devices.forEach((device, index) => {
      topology.peers[device.id] = [];
      
      // Connect to previous device
      if (index > 0) {
        topology.peers[device.id].push({
          peer_id: devices[index - 1].id,
          peer_name: devices[index - 1].name,
          connection_type: 'primary'
        });
      }
      
      // Connect to next device
      if (index < devices.length - 1) {
        topology.peers[device.id].push({
          peer_id: devices[index + 1].id,
          peer_name: devices[index + 1].name,
          connection_type: 'secondary'
        });
      }
    });

    // Generate network ranges
    topology.networks = this.generateNetworkRanges(devices.length);

    return topology;
  }

  // Infer device role in topology
  inferDeviceRole(device, allDevices) {
    const index = allDevices.findIndex(d => d.id === device.id);
    const total = allDevices.length;
    
    if (total === 1) return 'standalone';
    if (index === 0) return 'edge';
    if (index === total - 1) return 'edge';
    return 'intermediate';
  }

  // Generate network ranges for inter-device connectivity
  generateNetworkRanges(deviceCount) {
    const networks = [];
    let networkBase = 192;
    let subnetIndex = 1;

    for (let i = 0; i < deviceCount - 1; i++) {
      networks.push({
        network: `192.168.${subnetIndex}.0/30`,
        device1_ip: `192.168.${subnetIndex}.1`,
        device2_ip: `192.168.${subnetIndex}.2`,
        description: `Link between device ${i + 1} and device ${i + 2}`
      });
      subnetIndex += 1;
    }

    return networks;
  }

  // Build multi-device aware prompt
  buildMultiDevicePrompt(originalPrompt, currentDevice, allDevices, topology, position) {
    const deviceInfo = `${currentDevice.name} (${currentDevice.type})`;
    const peers = topology.peers[currentDevice.id] || [];
    const networks = topology.networks;
    
    // Find relevant networks for this device
    const deviceNetworks = networks.filter((net, index) => 
      index === position - 2 || index === position - 1
    );

    let connectivityInfo = '';
    if (peers.length > 0) {
      connectivityInfo = `
DEVICE CONNECTIVITY:
- This device connects to: ${peers.map(p => p.peer_name).join(', ')}
- Position in topology: ${position} of ${allDevices.length}`;

      if (deviceNetworks.length > 0) {
        connectivityInfo += `
- Network assignments: ${deviceNetworks.map(net => net.network).join(', ')}`;
      }
    }

    // Build topology-aware examples
    const topologyExamples = this.getTopologyExamples(originalPrompt, currentDevice.type, position, allDevices.length);

    return `You are an expert Cisco network engineer. Generate configuration for ${deviceInfo} as part of a ${allDevices.length}-device topology.

${connectivityInfo}

TASK: ${originalPrompt}

${topologyExamples}

IMPORTANT: 
1. Consider this device's position in the topology
2. Use appropriate interface addressing for connectivity
3. Ensure routing/switching protocols are compatible with other devices
4. Generate complete, functional configuration

Configuration for ${deviceInfo}:`;
  }

  // Get topology-specific examples
  getTopologyExamples(prompt, deviceType, position, totalDevices) {
    const isOSPF = prompt.toLowerCase().includes('ospf');
    const isEIGRP = prompt.toLowerCase().includes('eigrp');
    const isBGP = prompt.toLowerCase().includes('bgp');
    const isVLAN = prompt.toLowerCase().includes('vlan');

    if (isOSPF && deviceType === 'router') {
      return this.getOSPFTopologyExample(position, totalDevices);
    }
    
    if (isEIGRP && deviceType === 'router') {
      return this.getEIGRPTopologyExample(position, totalDevices);
    }
    
    if (isBGP && deviceType === 'router') {
      return this.getBGPTopologyExample(position, totalDevices);
    }
    
    if (isVLAN && deviceType === 'switch') {
      return this.getVLANTopologyExample(position, totalDevices);
    }

    return this.getGenericTopologyExample(deviceType, position, totalDevices);
  }

  // OSPF topology examples
  getOSPFTopologyExample(position, total) {
    if (position === 1) {
      return `
EXAMPLE OSPF CONFIG (First Router):
configure terminal
router ospf 10
 router-id 1.1.1.1
 network 192.168.1.0 0.0.0.3 area 0
exit
interface GigabitEthernet0/1
 ip address 192.168.1.1 255.255.255.252
 description to-Router2
 no shutdown
exit
end`;
    } else if (position === total) {
      return `
EXAMPLE OSPF CONFIG (Last Router):
configure terminal
router ospf 10
 router-id ${position}.${position}.${position}.${position}
 network 192.168.${position-1}.0 0.0.0.3 area 0
exit
interface GigabitEthernet0/0
 ip address 192.168.${position-1}.2 255.255.255.252
 description from-Router${position-1}
 no shutdown
exit
end`;
    } else {
      return `
EXAMPLE OSPF CONFIG (Middle Router):
configure terminal
router ospf 10
 router-id ${position}.${position}.${position}.${position}
 network 192.168.${position-1}.0 0.0.0.3 area 0
 network 192.168.${position}.0 0.0.0.3 area 0
exit
interface GigabitEthernet0/0
 ip address 192.168.${position-1}.2 255.255.255.252
 description from-Router${position-1}
 no shutdown
exit
interface GigabitEthernet0/1
 ip address 192.168.${position}.1 255.255.255.252
 description to-Router${position+1}
 no shutdown
exit
end`;
    }
  }

  // EIGRP topology examples
  getEIGRPTopologyExample(position, total) {
    return `
EXAMPLE EIGRP CONFIG:
configure terminal
router eigrp 100
 network 192.168.${position}.0 0.0.0.255
 no auto-summary
exit
interface GigabitEthernet0/1
 ip address 192.168.${position}.1 255.255.255.252
 no shutdown
exit
end`;
  }

  // BGP topology examples  
  getBGPTopologyExample(position, total) {
    const asn = 65000 + position;
    return `
EXAMPLE BGP CONFIG:
configure terminal
router bgp ${asn}
 bgp router-id ${position}.${position}.${position}.${position}
 neighbor 192.168.${position}.2 remote-as ${asn + 1}
 network 10.${position}.0.0 mask 255.255.0.0
exit
end`;
  }

  // VLAN topology examples
  getVLANTopologyExample(position, total) {
    return `
EXAMPLE VLAN CONFIG:
configure terminal
vlan ${10 + position}
 name Department${position}
exit
interface range FastEthernet0/1-24
 switchport mode access
 switchport access vlan ${10 + position}
 no shutdown
exit
end`;
  }

  // Generic topology example
  getGenericTopologyExample(deviceType, position, total) {
    return `
EXAMPLE ${deviceType.toUpperCase()} CONFIG:
configure terminal
hostname ${deviceType.charAt(0).toUpperCase() + deviceType.slice(1)}${position}
interface GigabitEthernet0/1
 description Connection-${position}
 ip address 192.168.${position}.1 255.255.255.252
 no shutdown
exit
end`;
  }

  // Validate multi-device consistency
  validateMultiDeviceConsistency(deviceConfigs, topology) {
    const issues = [];
    const warnings = [];
    
    // Check for IP addressing conflicts
    const ipAddresses = new Set();
    deviceConfigs.forEach(config => {
      const ips = this.extractIPAddresses(config.config);
      ips.forEach(ip => {
        if (ipAddresses.has(ip)) {
          issues.push(`IP address conflict: ${ip} used on multiple devices`);
        }
        ipAddresses.add(ip);
      });
    });

    // Check for routing protocol consistency
    const routingProtocols = deviceConfigs.map(config => {
      return this.detectRoutingProtocols(config.config);
    });
    
    const uniqueProtocols = [...new Set(routingProtocols.flat())];
    if (uniqueProtocols.length > 1) {
      warnings.push(`Multiple routing protocols detected: ${uniqueProtocols.join(', ')}`);
    }

    return {
      isConsistent: issues.length === 0,
      issues: issues,
      warnings: warnings,
      summary: `${issues.length} conflicts, ${warnings.length} warnings`
    };
  }

  // Extract IP addresses from configuration
  extractIPAddresses(config) {
    const ipRegex = /ip address (\d+\.\d+\.\d+\.\d+)/g;
    const ips = [];
    let match;
    
    while ((match = ipRegex.exec(config)) !== null) {
      ips.push(match[1]);
    }
    
    return ips;
  }

  // Detect routing protocols in configuration
  detectRoutingProtocols(config) {
    const protocols = [];
    
    if (config.includes('router ospf')) protocols.push('OSPF');
    if (config.includes('router eigrp')) protocols.push('EIGRP');
    if (config.includes('router bgp')) protocols.push('BGP');
    if (config.includes('router rip')) protocols.push('RIP');
    
    return protocols;
  }

  // Enhanced prompt building
  buildEnhancedPrompt(prompt, deviceType, deviceContext) {
    const deviceInfo = [
      deviceContext.model && `Model: ${deviceContext.model}`,
      deviceContext.ios_version && `IOS: ${deviceContext.ios_version}`,
      deviceContext.location && `Location: ${deviceContext.location}`
    ].filter(Boolean).join(', ');

    const examples = this.getExamplesByType(deviceType);

    return `You are an expert Cisco network engineer. Generate a COMPLETE Cisco IOS configuration for a ${deviceType}.

${deviceInfo ? `Device: ${deviceInfo}` : ''}

MANDATORY REQUIREMENTS:
1. Start with "configure terminal"
2. End with "end"
3. Generate at least 5-10 lines of configuration
4. Use proper Cisco IOS command syntax
5. Use proper indentation (space for sub-commands)
6. No explanations, just commands

${examples}

TASK: Create configuration for: ${prompt}

IMPORTANT: Generate a COMPLETE working configuration with proper structure. Do not include any explanatory text.

Configuration:`;
  }

  // Fallback configuration generation
  async generateFallbackConfiguration(prompt, deviceType, deviceContext) {
    console.log(`🔄 Generating fallback configuration for ${deviceType}`);
    
    try {
      // Use a simpler, more direct prompt
      const fallbackPrompt = `Generate Cisco IOS commands for ${deviceType}:

Task: ${prompt}

Start with 'configure terminal' and end with 'end'. Generate complete configuration:`;

      const response = await this.client.post("/api/generate", {
        model: this.model,
        prompt: fallbackPrompt,
        stream: false,
        options: {
          temperature: 0.05, // Very low temperature
          top_k: 10,
          top_p: 0.5,
          num_predict: 500,
          repeat_penalty: 1.2,
        },
      });

      let configuration = response.data.response ? response.data.response.trim() : '';
      
      if (!configuration || configuration.length < 5) {
        // Last resort: generate basic template
        return this.generateTemplateConfiguration(prompt, deviceType, deviceContext);
      }

      configuration = this.cleanConfiguration(configuration);
      
      if (!configuration || configuration.length < 20) {
        return this.generateTemplateConfiguration(prompt, deviceType, deviceContext);
      }

      const validation = this.validateConfiguration(configuration, deviceType);

      return {
        success: true,
        configuration: configuration,
        model: this.model,
        deviceType: deviceType,
        method: 'fallback_ai',
        validation: validation,
        confidenceScore: validation.score,
        recommendations: this.getBasicRecommendations(configuration, deviceType)
      };

    } catch (error) {
      console.error("❌ Fallback generation failed:", error.message);
      return this.generateTemplateConfiguration(prompt, deviceType, deviceContext);
    }
  }

  // Template-based configuration (last resort)
  generateTemplateConfiguration(prompt, deviceType, deviceContext) {
    console.log(`🔧 Generating template configuration for ${deviceType}`);
    
    const templates = {
      router: `configure terminal
hostname ${deviceContext.name || 'Router'}
!
router ospf 1
 network 192.168.1.0 0.0.0.255 area 0
exit
!
interface GigabitEthernet0/1
 description LAN Interface
 ip address 192.168.1.1 255.255.255.0
 no shutdown
exit
!
end`,

      switch: `configure terminal
hostname ${deviceContext.name || 'Switch'}
!
vlan 10
 name Production
exit
!
interface FastEthernet0/1
 description User Port
 switchport mode access
 switchport access vlan 10
 no shutdown
exit
!
end`,

      firewall: `configure terminal
hostname ${deviceContext.name || 'Firewall'}
!
access-list 100 permit tcp any any eq 80
access-list 100 permit tcp any any eq 443
access-list 100 deny ip any any
!
interface GigabitEthernet0/1
 description Outside Interface
 ip address dhcp
 no shutdown
exit
!
end`
    };

    const configuration = templates[deviceType] || templates.router;
    const validation = this.validateConfiguration(configuration, deviceType);

    return {
      success: true,
      configuration: configuration,
      model: 'template',
      deviceType: deviceType,
      method: 'template',
      validation: validation,
      confidenceScore: validation.score,
      recommendations: this.getBasicRecommendations(configuration, deviceType),
      note: 'Generated using template due to AI service issues'
    };
  }

  // Get examples by device type
  getExamplesByType(deviceType) {
    const examples = {
      router: `
EXAMPLE ROUTER CONFIG:
configure terminal
router ospf 1
 network 192.168.1.0 0.0.0.255 area 0
exit
interface GigabitEthernet0/1
 ip address 192.168.1.1 255.255.255.0
 no shutdown
exit
end`,
      
      switch: `
EXAMPLE SWITCH CONFIG:
configure terminal
vlan 10
 name Sales
exit
interface FastEthernet0/1
 switchport mode access
 switchport access vlan 10
 no shutdown
exit
end`,
      
      firewall: `
EXAMPLE FIREWALL CONFIG:
configure terminal
access-list 100 permit tcp any any eq 80
interface outside
 nameif outside
 security-level 0
exit
end`
    };

    return examples[deviceType] || examples.router;
  }

  // Clean and format configuration
  cleanConfiguration(config) {
    if (!config) return '';
    
    let cleaned = config.trim();
    
    // Remove markdown formatting
    cleaned = cleaned.replace(/```[a-z]*\n?/g, '').replace(/```/g, '');
    
    // Remove explanatory text before configuration
    const lines = cleaned.split('\n');
    const configLines = [];
    let foundConfig = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip explanatory lines
      if (trimmed.toLowerCase().includes('configuration') && 
          trimmed.toLowerCase().includes('for') && 
          !trimmed.startsWith('configure')) {
        continue;
      }
      
      // Start collecting from configure terminal or first command
      if (!foundConfig && (trimmed === 'configure terminal' || 
          trimmed.match(/^(interface|router|vlan|hostname|access-list|crypto)/i))) {
        foundConfig = true;
      }
      
      if (foundConfig) {
        configLines.push(line);
        
        // Stop at end command
        if (trimmed === 'end') {
          break;
        }
      }
    }
    
    cleaned = configLines.join('\n');
    
    // Ensure proper structure
    if (!cleaned.startsWith('configure terminal')) {
      cleaned = 'configure terminal\n' + cleaned;
    }
    
    if (!cleaned.trim().endsWith('end')) {
      cleaned = cleaned.trim() + '\nend';
    }
    
    // Fix basic indentation
    cleaned = this.fixBasicIndentation(cleaned);
    
    return cleaned;
  }

  // Fix basic indentation
  fixBasicIndentation(config) {
    const lines = config.split('\n');
    const result = [];
    let indent = 0;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (!trimmed) {
        result.push('');
        continue;
      }
      
      // Commands that end current mode
      if (trimmed === 'exit' || trimmed === 'end') {
        indent = Math.max(0, indent - 1);
        result.push(' '.repeat(indent) + trimmed);
        continue;
      }
      
      // Add current line with proper indentation
      result.push(' '.repeat(indent) + trimmed);
      
      // Commands that start new mode (increase indentation)
      if (trimmed.match(/^(interface|router|line|vlan \d+|access-list|crypto)/i) && 
          !trimmed.includes('exit')) {
        indent++;
      }
    }
    
    return result.join('\n');
  }

  // Simplified validation
  validateConfiguration(configuration, deviceType) {
    const errors = [];
    const warnings = [];
    let score = 50; // Start with base score
    
    if (!configuration || configuration.trim().length === 0) {
      return {
        isValid: false,
        feedback: "No configuration provided",
        score: 0,
        errors: ["Empty configuration"],
        warnings: []
      };
    }

    const lines = configuration.split('\n').filter(line => line.trim());
    
    // Check basic structure
    const hasConfigTerminal = configuration.includes("configure terminal");
    const hasEnd = configuration.includes("end");
    
    if (hasConfigTerminal) score += 15;
    if (hasEnd) score += 15;
    
    // Check for basic Cisco commands
    const ciscoCommands = [
      /^interface /i,
      /^router /i,
      /^vlan \d+/i,
      /^hostname /i,
      /^ip address /i,
      /^access-list /i,
      /^switchport /i
    ];
    
    let commandMatches = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (ciscoCommands.some(pattern => pattern.test(trimmed))) {
        commandMatches++;
      }
    }
    
    if (commandMatches > 0) {
      score += Math.min(20, commandMatches * 5);
    }
    
    // Check for proper structure
    if (lines.length >= 3) score += 10;
    
    // Basic syntax check
    let syntaxErrors = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('!')) continue;
      
      // Check for common syntax issues
      if (trimmed.includes('<<') || trimmed.includes('>>') || 
          trimmed.includes('[') || trimmed.includes(']')) {
        syntaxErrors++;
        errors.push(`Possible syntax issue: ${trimmed}`);
      }
    }
    
    if (syntaxErrors > 0) {
      score -= syntaxErrors * 5;
    }
    
    // Final validation
    const isValid = score >= 50 && syntaxErrors === 0; // Lowered threshold
    
    return {
      isValid,
      feedback: isValid ? "Configuration appears valid" : 
               `Configuration needs improvement. ${errors.join(', ')}`,
      score: Math.max(0, Math.min(100, Math.round(score))),
      errors,
      warnings,
      totalLines: lines.length
    };
  }

  // Get basic recommendations
  getBasicRecommendations(configuration, deviceType) {
    const recommendations = [];
    const lines = configuration.split('\n').map(line => line.trim());
    
    // Security recommendations
    if (!lines.some(line => /no shutdown/i.test(line))) {
      recommendations.push({
        type: 'interface',
        message: 'Consider adding "no shutdown" to enable interfaces',
        priority: 'medium'
      });
    }
    
    if (!lines.some(line => /description /i.test(line))) {
      recommendations.push({
        type: 'documentation',
        message: 'Consider adding descriptions to interfaces',
        priority: 'low'
      });
    }
    
    // Device-specific recommendations
    if (deviceType === 'router' && !lines.some(line => /router /i.test(line))) {
      recommendations.push({
        type: 'routing',
        message: 'Consider configuring a routing protocol',
        priority: 'medium'
      });
    }
    
    if (deviceType === 'switch' && !lines.some(line => /vlan /i.test(line))) {
      recommendations.push({
        type: 'switching',
        message: 'Consider creating VLANs for network segmentation',
        priority: 'medium'
      });
    }
    
    return recommendations;
  }

  // Generate NETCONF XML configuration
  async generateNetconfXml(prompt, deviceType, deviceContext = {}, yangModel = null) {
    const startTime = Date.now();
    
    try {
      console.log(`🔗 Generating NETCONF XML for ${deviceType}: "${prompt}"`);

      // Build NETCONF-specific prompt
      const xmlPrompt = this.buildNetconfPrompt(prompt, deviceType, deviceContext, yangModel);
      console.log(`📝 Using NETCONF prompt length: ${xmlPrompt.length} characters`);

      // Generate with AI
      const response = await this.client.post("/api/generate", {
        model: this.model,
        prompt: xmlPrompt,
        stream: false,
        options: {
          temperature: 0.05, // Very low for XML structure
          top_k: 10,
          top_p: 0.5,
          num_predict: 1000,
          repeat_penalty: 1.2,
          stop: ["```", "---", "Note:", "Explanation:", "Remember:"]
        },
      });

      let xmlConfiguration = response.data.response ? response.data.response.trim() : '';
      console.log(`📦 Raw AI XML response length: ${xmlConfiguration.length} characters`);
      
      if (!xmlConfiguration || xmlConfiguration.length < 10) {
        console.log(`❌ XML response too short, using template fallback`);
        return await this.generateNetconfXmlTemplate(prompt, deviceType, yangModel);
      }

      // Clean and format XML
      xmlConfiguration = this.cleanNetconfXml(xmlConfiguration);
      console.log(`🧹 Cleaned XML length: ${xmlConfiguration.length} characters`);
      
      if (!xmlConfiguration || xmlConfiguration.length < 50) {
        console.log(`❌ Cleaned XML too short, using template fallback`);
        return await this.generateNetconfXmlTemplate(prompt, deviceType, yangModel);
      }
      
      // Validate XML if YANG model is provided
      let validation = { isValid: true, errors: [], warnings: [] };
      if (yangModel) {
        try {
          validation = yangService.validateXmlAgainstYang(xmlConfiguration, yangModel);
        } catch (error) {
          console.warn(`⚠️ XML validation failed: ${error.message}`);
        }
      }
      
      const executionTime = Date.now() - startTime;

      const result = {
        success: true,
        configuration: xmlConfiguration,
        model: this.model,
        deviceType: deviceType,
        method: 'netconf_xml_ai',
        executionTime: executionTime,
        validation: validation,
        confidenceScore: validation.isValid ? 85 : 65,
        yangModel: yangModel?.name || null,
        outputFormat: 'netconf_xml'
      };

      console.log(`✅ NETCONF XML generated successfully (${executionTime}ms, validation: ${validation.isValid})`);
      return result;
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error("❌ NETCONF XML Generation Error:", error.message);
      
      // Fallback to template generation
      return await this.generateNetconfXmlTemplate(prompt, deviceType, yangModel);
    }
  }

  // Build NETCONF-specific prompt
  buildNetconfPrompt(prompt, deviceType, deviceContext, yangModel) {
    const deviceInfo = [
      deviceContext.model && `Model: ${deviceContext.model}`,
      deviceContext.ios_version && `IOS: ${deviceContext.ios_version}`,
      deviceContext.location && `Location: ${deviceContext.location}`
    ].filter(Boolean).join(', ');

    const yangInfo = yangModel ? `
YANG Model: ${yangModel.name}
Namespace: ${yangModel.namespace}
Prefix: ${yangModel.prefix || 'target'}
Revision: ${yangModel.revision}
` : '';

    const netconfExamples = this.getNetconfExamplesByType(deviceType, yangModel);

    return `You are an expert network engineer specialized in NETCONF/YANG. Generate a valid NETCONF XML configuration.

${deviceInfo ? `Device: ${deviceInfo}` : ''}
${yangInfo}

MANDATORY REQUIREMENTS:
1. Generate valid NETCONF XML with proper structure
2. Use correct XML namespaces and syntax
3. Follow YANG model structure if provided
4. Include proper NETCONF envelope (config element)
5. Use appropriate namespace declarations
6. NO explanations, just XML

${netconfExamples}

TASK: Create NETCONF XML configuration for: ${prompt}

IMPORTANT: Generate COMPLETE, VALID NETCONF XML. Start with <config> element and include proper namespaces.

NETCONF XML:`;
  }

  // Get NETCONF examples by device type
  getNetconfExamplesByType(deviceType, yangModel) {
    if (yangModel && yangModel.name === 'ietf-interfaces') {
      return `
EXAMPLE IETF-INTERFACES XML:
<config xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
  <interfaces xmlns="urn:ietf:params:xml:ns:yang:ietf-interfaces">
    <interface>
      <name>GigabitEthernet0/0/1</name>
      <description>Management Interface</description>
      <type xmlns:ianaift="urn:ietf:params:xml:ns:yang:iana-if-type">ianaift:gigabitEthernet</type>
      <enabled>true</enabled>
      <ipv4 xmlns="urn:ietf:params:xml:ns:yang:ietf-ip">
        <enabled>true</enabled>
        <address>
          <ip>192.168.1.10</ip>
          <prefix-length>24</prefix-length>
        </address>
      </ipv4>
    </interface>
  </interfaces>
</config>`;
    }

    if (yangModel && yangModel.name === 'cisco-nx-os-device') {
      return `
EXAMPLE CISCO NX-OS XML:
<config xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
  <System xmlns="http://cisco.com/ns/yang/cisco-nx-os-device">
    <intf-items>
      <phys-items>
        <id>eth1/1</id>
        <adminSt>up</adminSt>
        <descr>Server Connection</descr>
        <rshIfMain-items>
          <addr-items>
            <addr>192.168.10.1</addr>
            <mask>24</mask>
          </addr-items>
        </rshIfMain-items>
      </phys-items>
    </intf-items>
  </System>
</config>`;
    }

    // Generic examples by device type
    const examples = {
      router: `
EXAMPLE ROUTER NETCONF XML:
<config xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
  <interfaces xmlns="urn:ietf:params:xml:ns:yang:ietf-interfaces">
    <interface>
      <name>GigabitEthernet0/0/1</name>
      <description>LAN Interface</description>
      <type xmlns:ianaift="urn:ietf:params:xml:ns:yang:iana-if-type">ianaift:gigabitEthernet</type>
      <enabled>true</enabled>
    </interface>
  </interfaces>
</config>`,
      
      switch: `
EXAMPLE SWITCH NETCONF XML:
<config xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
  <interfaces xmlns="urn:ietf:params:xml:ns:yang:ietf-interfaces">
    <interface>
      <name>FastEthernet0/1</name>
      <description>Access Port</description>
      <type xmlns:ianaift="urn:ietf:params:xml:ns:yang:iana-if-type">ianaift:fastEther</type>
      <enabled>true</enabled>
    </interface>
  </interfaces>
</config>`
    };

    return examples[deviceType] || examples.router;
  }

  // Clean NETCONF XML
  cleanNetconfXml(xml) {
    if (!xml) return '';
    
    let cleaned = xml.trim();
    
    // Remove markdown formatting
    cleaned = cleaned.replace(/```[a-z]*\n?/g, '').replace(/```/g, '');
    
    // Remove explanatory text
    const lines = cleaned.split('\n');
    const xmlLines = [];
    let foundXml = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip explanatory lines
      if (trimmed.includes('<?xml') || trimmed.includes('<config')) {
        foundXml = true;
      }
      
      if (foundXml) {
        xmlLines.push(line);
      }
    }
    
    cleaned = xmlLines.join('\n');
    
    // Ensure proper XML structure
    if (!cleaned.includes('<?xml')) {
      cleaned = '<?xml version="1.0" encoding="UTF-8"?>\n' + cleaned;
    }
    
    if (!cleaned.includes('<config')) {
      cleaned = cleaned.replace(/^/, '<config xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">\n');
      cleaned += '\n</config>';
    }
    
    return cleaned;
  }

  // Generate NETCONF XML template (fallback)
  async generateNetconfXmlTemplate(prompt, deviceType, yangModel) {
    console.log(`🔧 Generating NETCONF XML template for ${deviceType}`);
    
    try {
      if (yangModel) {
        const template = yangService.generateXmlTemplate(yangModel, 'edit-config');
        const xmlExample = Object.values(template.examples)[0];
        
        if (xmlExample) {
          const xmlString = yangService.xmlBuilder.build({
            config: {
              '@_xmlns': 'urn:ietf:params:xml:ns:netconf:base:1.0',
              ...xmlExample
            }
          });
          
          return {
            success: true,
            configuration: xmlString,
            model: 'template',
            deviceType: deviceType,
            method: 'netconf_xml_template',
            validation: { isValid: true, errors: [], warnings: [] },
            confidenceScore: 75,
            yangModel: yangModel.name,
            outputFormat: 'netconf_xml',
            note: 'Generated using YANG template due to AI service issues'
          };
        }
      }
      
      // Generic template
      const templates = {
        router: `<?xml version="1.0" encoding="UTF-8"?>
<config xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
  <interfaces xmlns="urn:ietf:params:xml:ns:yang:ietf-interfaces">
    <interface>
      <name>GigabitEthernet0/0/1</name>
      <description>Router Interface</description>
      <type xmlns:ianaift="urn:ietf:params:xml:ns:yang:iana-if-type">ianaift:gigabitEthernet</type>
      <enabled>true</enabled>
      <ipv4 xmlns="urn:ietf:params:xml:ns:yang:ietf-ip">
        <enabled>true</enabled>
        <address>
          <ip>192.168.1.1</ip>
          <prefix-length>24</prefix-length>
        </address>
      </ipv4>
    </interface>
  </interfaces>
</config>`,

        switch: `<?xml version="1.0" encoding="UTF-8"?>
<config xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
  <interfaces xmlns="urn:ietf:params:xml:ns:yang:ietf-interfaces">
    <interface>
      <name>FastEthernet0/1</name>
      <description>Switch Access Port</description>
      <type xmlns:ianaift="urn:ietf:params:xml:ns:yang:iana-if-type">ianaift:fastEther</type>
      <enabled>true</enabled>
    </interface>
  </interfaces>
</config>`
      };

      const configuration = templates[deviceType] || templates.router;
      
      return {
        success: true,
        configuration: configuration,
        model: 'template',
        deviceType: deviceType,
        method: 'netconf_xml_template',
        validation: { isValid: true, errors: [], warnings: [] },
        confidenceScore: 70,
        yangModel: yangModel?.name || null,
        outputFormat: 'netconf_xml',
        note: 'Generated using generic template'
      };
      
    } catch (error) {
      console.error("❌ Template generation failed:", error.message);
      throw new Error(`NETCONF XML template generation failed: ${error.message}`);
    }
  }

  // Service status
  async getServiceStatus() {
    try {
      const response = await this.client.get("/api/tags");
      const models = response.data.models || [];
      const currentModel = models.find((m) => m.name === this.model);

      return {
        status: "connected",
        service: "Enhanced Raw AI",
        host: this.host,
        model: this.model,
        modelAvailable: !!currentModel,
        availableModels: models.map((m) => m.name),
        timeout: 120000,
        features: [
          "Enhanced Cisco IOS generation",
          "Fallback mechanisms",
          "Template generation",
          "Better error handling"
        ]
      };
    } catch (error) {
      return {
        status: "disconnected",
        service: "Enhanced Raw AI", 
        host: this.host,
        model: this.model,
        modelAvailable: false,
        error: error.message
      };
    }
  }

  // Simple configuration explanation
  async explainConfiguration(configuration) {
    try {
      const prompt = `Explain this Cisco configuration in simple terms:

${configuration}

Provide a brief explanation of what each section does:`;

      const response = await this.client.post("/api/generate", {
        model: this.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.3,
          top_k: 40,
          top_p: 0.9,
          num_predict: 500,
        },
      });

      return {
        success: true,
        explanation: response.data.response.trim(),
        model: this.model,
      };
    } catch (error) {
      return {
        success: false,
        explanation: "Unable to generate explanation",
        error: error.message,
      };
    }
  }
}

export default new AIService();