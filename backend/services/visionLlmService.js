import axios from 'axios';
import fs from 'fs';
import path from 'path';

/**
 * Vision LLM Service for Network Topology Analysis
 * Uses LLaVA model for understanding network diagrams, topology images, and port configurations
 */
export class VisionLLMService {
  constructor() {
    // Configuration
    this.host = process.env.OLLAMA_HOST || 'http://localhost:11434';
    this.visionModel = process.env.OLLAMA_VISION_MODEL || 'llava:7b';
    this.timeout = 180000; // 3 minutes for vision processing
    
    // HTTP Client
    this.client = axios.create({
      baseURL: this.host,
      timeout: this.timeout,
    });
    
    // Vision-specific parameters
    this.visionParams = {
      temperature: 0.1,    // Lower for more precise technical analysis
      num_predict: 400,    // More tokens for detailed topology analysis
      top_k: 10,          // More focused responses
      top_p: 0.8,         // Good balance for technical accuracy
      repeat_penalty: 1.1,
      stop: []
    };
    
    console.log(`🔍 Vision LLM Service initialized - Model: ${this.visionModel} @ ${this.host}`);
  }

  /**
   * Generate configuration directly from topology image and prompt
   */
  async generateConfigurationFromImage(imagePath, prompt, device, deviceContext = {}) {
    const startTime = Date.now();
    
    try {
      console.log(`🔍 Generating config for ${device.name} from topology image: ${imagePath}`);
      
      // Convert image to base64
      const imageBase64 = await this._imageToBase64(imagePath);
      
      // Create direct configuration prompt with enhanced port detection
      const configPrompt = await this._buildDirectConfigurationPrompt(prompt, device, deviceContext, imagePath);
      
      // Call LLaVA API with image and prompt
      const response = await this.client.post("/api/generate", {
        model: this.visionModel,
        prompt: configPrompt,
        images: [imageBase64],
        stream: false,
        options: { 
          ...this.visionParams, 
          num_predict: 500,  // More tokens for complete configs
          temperature: 0.1   // More consistent output
        }
      });

      const configuration = response.data.response?.trim();
      if (!configuration) {
        throw new Error('Empty response from LLaVA model');
      }
      
      console.log(`📋 Raw LLaVA response: ${configuration.length} chars`);
      console.log(`📋 First 200 chars: ${configuration.substring(0, 200)}...`);
      
      // Clean and validate the configuration
      const cleanConfig = this._cleanConfiguration(configuration, prompt);
      
      console.log(`🧹 After cleaning: ${cleanConfig ? cleanConfig.length : 0} chars`);
      console.log(`🧹 Cleaned config preview: ${cleanConfig ? cleanConfig.substring(0, 200) : 'EMPTY'}...`);
      
      const executionTime = Date.now() - startTime;
      console.log(`✅ Configuration generated from image (${executionTime}ms)`);
      
      return {
        success: true,
        configuration: cleanConfig,
        executionTime,
        model: this.visionModel,
        method: 'llava_direct_config',
        device_name: device.name,
        image_enhanced: true
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error("❌ Image-based config generation failed:", error.message);
      
      return {
        success: false,
        error: `Image-based configuration failed: ${error.message}`,
        executionTime,
        device_name: device.name
      };
    }
  }

  /**
   * Generate topology-aware configurations with exact port mapping
   */
  async generatePortConfigurations(topologyAnalysis, devices, basePrompt) {
    try {
      console.log(`🔌 Generating topology-aware configurations for ${devices.length} devices`);
      console.log(`📋 Prompt: "${basePrompt}"`);
      
      const portConfigs = [];
      
      // Detect configuration type for specialized handling
      const isHSRPConfig = basePrompt.toLowerCase().includes('hsrp');
      const isOSPFConfig = basePrompt.toLowerCase().includes('ospf');
      const isEIGRPConfig = basePrompt.toLowerCase().includes('eigrp');
      
      for (const device of devices) {
        // Find device-specific information from topology analysis
        const deviceInfo = this._findDeviceInTopology(device, topologyAnalysis);
        
        let portPrompt;
        
        if (isHSRPConfig) {
          // Specialized HSRP configuration with topology awareness
          portPrompt = this._buildHSRPConfigurationPrompt(device, deviceInfo, topologyAnalysis, basePrompt);
        } else if (isOSPFConfig) {
          // Specialized OSPF configuration
          portPrompt = this._buildOSPFConfigurationPrompt(device, deviceInfo, topologyAnalysis, basePrompt);
        } else {
          // General port-aware configuration
          portPrompt = this._buildPortConfigurationPrompt(device, deviceInfo, topologyAnalysis, basePrompt);
        }
        
        console.log(`🔄 Processing ${device.name} for ${isHSRPConfig ? 'HSRP' : isOSPFConfig ? 'OSPF' : 'general'} configuration...`);
        
        const response = await this.client.post("/api/generate", {
          model: this.visionModel,
          prompt: portPrompt,
          stream: false,
          options: { ...this.visionParams, num_predict: 400 }
        });

        const portConfig = response.data.response?.trim();
        
        portConfigs.push({
          device_id: device.id,
          device_name: device.name,
          device_type: device.type,
          port_configuration: portConfig,
          topology_context: deviceInfo,
          connections: deviceInfo.connections || [],
          exact_ports: topologyAnalysis.devicePorts?.[device.name.toUpperCase()] || [],
          configuration_type: isHSRPConfig ? 'HSRP' : isOSPFConfig ? 'OSPF' : 'General'
        });
      }
      
      return {
        success: true,
        port_configurations: portConfigs,
        model: this.visionModel,
        topology_enhanced: true
      };
      
    } catch (error) {
      console.error("❌ Topology-aware configuration generation failed:", error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Build HSRP-specific configuration prompt with topology awareness
   */
  _buildHSRPConfigurationPrompt(device, deviceInfo, topologyAnalysis, basePrompt) {
    const connections = deviceInfo.connections || [];
    const devicePorts = topologyAnalysis.devicePorts?.[device.name.toUpperCase()] || [];
    const allDevices = Object.keys(topologyAnalysis.devicePorts || {});
    
    // Identify other routers for HSRP group
    const otherRouters = allDevices.filter(d => 
      d !== device.name.toUpperCase() && 
      (d.includes('R') || d.includes('ROUTER'))
    );
    
    // Determine HSRP priority based on device name/position
    const deviceNumber = device.name.match(/\d+/)?.[0] || '1';
    const priority = deviceNumber === '1' ? 110 : (deviceNumber === '2' ? 105 : 100);
    const role = priority === 110 ? 'Active (Primary)' : 'Standby (Backup)';
    
    return `Generate HSRP configuration for Cisco device: ${device.name}

TOPOLOGY ANALYSIS FROM IMAGE:
Device: ${device.name} (${device.type})
Exact Ports Detected: ${devicePorts.join(', ') || 'No ports detected'}
Connected Devices: ${connections.map(c => `${c.remote_device} via ${c.local_port}`).join(', ')}

HSRP GROUP CONTEXT:
- HSRP Group Members: ${[device.name.toUpperCase(), ...otherRouters].join(', ')}
- This Device Role: ${role}
- HSRP Priority: ${priority}
- Group Number: 1

USER REQUEST: ${basePrompt}

CONFIGURATION REQUIREMENTS:

1. **EXACT INTERFACE CONFIGURATION:**
   - Configure ONLY these detected interfaces: ${devicePorts.join(', ')}
   - Use proper interface names (FastEthernet = fa, GigabitEthernet = gi)
   - Assign IP addresses in same subnet for HSRP group

2. **HSRP CONFIGURATION:**
   - standby 1 ip [virtual IP]
   - standby 1 priority ${priority}
   - standby 1 preempt
   - ${priority === 110 ? 'standby 1 authentication md5 key-string hsrp123' : 'standby 1 authentication md5 key-string hsrp123'}

3. **TOPOLOGY-SPECIFIC SETTINGS:**
   - Interface descriptions match topology connections
   - IP addressing considers device position in network
   - Enable interfaces that are shown connected in topology

Generate Cisco IOS configuration that matches the EXACT topology shown in the image:

configure terminal`;
  }

  /**
   * Build OSPF-specific configuration prompt with topology awareness
   */
  _buildOSPFConfigurationPrompt(device, deviceInfo, topologyAnalysis, basePrompt) {
    const connections = deviceInfo.connections || [];
    const devicePorts = topologyAnalysis.devicePorts?.[device.name.toUpperCase()] || [];
    
    return `Generate OSPF configuration for Cisco device: ${device.name}

TOPOLOGY ANALYSIS FROM IMAGE:
Device: ${device.name} (${device.type})
Exact Ports Detected: ${devicePorts.join(', ') || 'No ports detected'}
Connected Devices: ${connections.map(c => `${c.remote_device} via ${c.local_port}`).join(', ')}

USER REQUEST: ${basePrompt}

CONFIGURATION REQUIREMENTS:

1. **EXACT INTERFACE CONFIGURATION:**
   - Configure ONLY these detected interfaces: ${devicePorts.join(', ')}
   - Use proper interface names from topology analysis
   - Assign IP addresses for OSPF areas

2. **OSPF CONFIGURATION:**
   - router ospf 1
   - router-id based on device number
   - network statements for connected segments only
   - area assignments based on topology position

3. **TOPOLOGY-SPECIFIC SETTINGS:**
   - Interface descriptions match topology connections
   - OSPF hello/dead timers for network type
   - Enable interfaces shown connected in topology

Generate Cisco IOS OSPF configuration that matches the EXACT topology:

configure terminal`;
  }

  /**
   * Enhanced port detection from topology image
   */
  async _detectPortsFromImage(imagePath, deviceName) {
    try {
      console.log(`🔍 Detecting ports for ${deviceName} from image...`);
      
      const imageBase64 = await this._imageToBase64(imagePath);
      
      const portDetectionPrompt = `You are analyzing a Cisco network topology diagram. Focus ONLY on device "${deviceName}".

CRITICAL TASK: Find interface port labels for device "${deviceName}" in this network diagram.

CISCO INTERFACE NAMING GUIDE:
- **Gi0/1** = GigabitEthernet0/1 (1000 Mbps)
- **Fa0/1** = FastEthernet0/1 (100 Mbps) 
- **Eth0** = Ethernet0 (10 Mbps)
- **Se0/0** = Serial0/0 (WAN connection)
- **Te0/1** = TenGigabitEthernet0/1 (10 Gbps)

STEP-BY-STEP ANALYSIS:
1. **LOCATE**: Find device "${deviceName}" in the topology
2. **EXAMINE**: Look at ALL cables/lines connected to "${deviceName}"
3. **READ LABELS**: Find port labels on or near "${deviceName}"
4. **STANDARDIZE**: Convert what you see to proper format

COMMON PORT LABEL FORMATS YOU MIGHT SEE:
- Short: Gi0/1, Fa0/24, Eth0, Se0/0
- Medium: GigE0/1, FastE0/24, Ether0
- Long: GigabitEthernet0/1, FastEthernet0/24
- Numbers: 0/1, 0/24, 1, 24

EXAMPLES OF WHAT TO LOOK FOR:
- Text near connection lines: "Gi0/1", "Fa0/24"
- Labels on device ports: "0/1", "0/24" 
- Connection annotations: "G0/1", "F0/24"

OUTPUT FORMAT (convert to standard Cisco names):
DEVICE: ${deviceName}
PORTS: [GigabitEthernet0/1, FastEthernet0/24, etc.]
CONNECTIONS:
- ${deviceName} [standard port name] connects to [other device] [standard port name]

Examine "${deviceName}" carefully. What interface labels or numbers do you see?

DETAILED ANALYSIS:`;

      const response = await this.client.post("/api/generate", {
        model: this.visionModel,
        prompt: portDetectionPrompt,
        images: [imageBase64],
        stream: false,
        options: {
          temperature: 0.05,  // Very precise for port detection
          num_predict: 300,
          top_k: 5,
          top_p: 0.7
        }
      });

      const analysis = response.data.response?.trim();
      console.log(`📋 Port detection for ${deviceName}: ${analysis}`);
      
      return this._parsePortDetection(analysis, deviceName);
      
    } catch (error) {
      console.error(`❌ Port detection failed for ${deviceName}:`, error.message);
      return { ports: [], connections: [] };
    }
  }

  /**
   * Parse port detection results
   */
  _parsePortDetection(analysis, deviceName) {
    const result = { ports: [], connections: [] };
    
    try {
      // Extract ports section - try multiple patterns
      let portsText = '';
      
      // Try bracketed format first
      const portsMatch = analysis.match(/PORTS:\s*\[(.*?)\]/i);
      if (portsMatch) {
        portsText = portsMatch[1];
      } else {
        // Try line-based format
        const portsLineMatch = analysis.match(/PORTS:\s*(.+)/i);
        if (portsLineMatch) {
          portsText = portsLineMatch[1];
        }
      }
      
      if (portsText) {
        // Enhanced port pattern matching
        const portPatterns = [
          /(?:gigabitethernet|gi)\s*\d+\/\d+(?:\/\d+)?/gi,
          /(?:fastethernet|fa)\s*\d+\/\d+(?:\/\d+)?/gi,
          /(?:ethernet|eth)\s*\d+(?:\/\d+)?/gi,
          /(?:serial|se)\s*\d+\/\d+(?:\/\d+)?/gi,
          /(?:port|po)\s*\d+/gi,
          /\b[a-z]{1,3}\d+\/\d+(?:\/\d+)?\b/gi  // Generic pattern
        ];
        
        let allPorts = [];
        portPatterns.forEach(pattern => {
          const matches = portsText.match(pattern) || [];
          allPorts = allPorts.concat(matches);
        });
        
        // Clean and normalize port names using Cisco standards
        result.ports = [...new Set(allPorts.map(port => {
          return this._standardizeCiscoInterface(port.toLowerCase().replace(/\s+/g, ''));
        }))];
      }
      
      // Extract connections
      const connectionLines = analysis.split('\n').filter(line => 
        line.includes('connects to') && line.toLowerCase().includes(deviceName.toLowerCase())
      );
      
      connectionLines.forEach(line => {
        // Parse: "R1 GigabitEthernet0/1 connects to SW1 GigabitEthernet0/2"
        const connMatch = line.match(/(\w+)\s+([\w\/]+)\s+connects\s+to\s+(\w+)\s+([\w\/]+)/i);
        if (connMatch) {
          result.connections.push({
            device: connMatch[1].trim(),
            port: this._standardizeCiscoInterface(connMatch[2].trim()),
            connectsTo: connMatch[3].trim(),
            remotePort: this._standardizeCiscoInterface(connMatch[4].trim())
          });
        }
      });
      
      console.log(`✅ Parsed for ${deviceName}:`);
      console.log(`   📍 Ports (${result.ports.length}): ${result.ports.join(', ')}`);
      console.log(`   🔗 Connections (${result.connections.length}): ${result.connections.map(c => `${c.port}→${c.connectsTo}:${c.remotePort}`).join(', ')}`);
      return result;
      
    } catch (error) {
      console.error(`❌ Failed to parse port detection:`, error.message);
      return { ports: [], connections: [] };
    }
  }

  /**
   * Build direct configuration prompt from image and text
   */
  async _buildDirectConfigurationPrompt(prompt, device, deviceContext, imagePath) {
    // First, detect ports specifically for this device
    const portInfo = await this._detectPortsFromImage(imagePath, device.name);
    
    let detectedPortsText = '';
    if (portInfo.ports.length > 0) {
      detectedPortsText = `
DETECTED PORTS FOR ${device.name}:
${portInfo.ports.map(port => `- ${port}`).join('\n')}

DETECTED CONNECTIONS:
${portInfo.connections.map(conn => `- ${conn.port} connects to ${conn.connectsTo} ${conn.remotePort}`).join('\n')}
`;
    } else {
      // Fallback: Use common router/switch interfaces based on device type
      const fallbackPorts = this._getFallbackPorts(device.type, device.name);
      detectedPortsText = `
FALLBACK INTERFACES FOR ${device.name} (${device.type}):
${fallbackPorts.map(port => `- ${port}`).join('\n')}

NOTE: Port detection from image failed, using standard interfaces.
`;
    }

    return `You are a Cisco network engineer. Generate Cisco IOS configuration for device: ${device.name}

USER REQUEST: ${prompt}

DEVICE INFORMATION:
- Device Name: ${device.name}
- Device Type: ${device.type}
- Model: ${device.model || 'Cisco Router/Switch'}

${detectedPortsText}

CRITICAL INSTRUCTIONS:
1. **USE DETECTED PORTS ONLY:**
   - Configure ONLY the ports listed above for ${device.name}
   - Use the exact port names detected from the image
   - If no ports detected, use standard interfaces (Gi0/1, Fa0/1)

2. **FOLLOW USER REQUEST EXACTLY:**
   - Generate ONLY what the user specifically requested: "${prompt}"
   - DO NOT add protocols unless explicitly mentioned in the user request
   - Focus on the specific task requested

3. **INTERFACE CONFIGURATION:**
   - Use EXACT interface names from detected ports (e.g., "interface GigabitEthernet0/1")
   - Configure IP addresses only if user requests "IP" or "address"
   - Add descriptions based on detected connections
   - Enable interfaces with "no shutdown"
   - Use proper Cisco IOS syntax

4. **FORMAT:**
   - Start with "configure terminal"
   - One "interface [InterfaceName]" block per detected port
   - Use full interface names (GigabitEthernet0/1, not Gi0/1)
   - End with "end"

Generate Cisco IOS configuration for ${device.name}:

configure terminal`;
  }

  /**
   * Standardize Cisco interface names to proper format
   */
  _standardizeCiscoInterface(interfaceName) {
    if (!interfaceName) return '';
    
    let normalized = interfaceName.toLowerCase().trim();
    
    // Handle various formats and convert to standard Cisco naming
    const interfaceMap = {
      // GigabitEthernet variations
      'gigabitethernet': 'GigabitEthernet',
      'gigethernet': 'GigabitEthernet', 
      'gige': 'GigabitEthernet',
      'gig': 'GigabitEthernet',
      'gi': 'GigabitEthernet',
      'ge': 'GigabitEthernet',
      
      // FastEthernet variations
      'fastethernet': 'FastEthernet',
      'fasteth': 'FastEthernet',
      'fast': 'FastEthernet',
      'fa': 'FastEthernet',
      'fe': 'FastEthernet',
      
      // Ethernet variations
      'ethernet': 'Ethernet',
      'eth': 'Ethernet',
      'e': 'Ethernet',
      
      // Serial variations
      'serial': 'Serial',
      'ser': 'Serial',
      'se': 'Serial',
      's': 'Serial',
      
      // TenGigabitEthernet
      'tengigabitethernet': 'TenGigabitEthernet',
      'tengige': 'TenGigabitEthernet',
      'te': 'TenGigabitEthernet',
      
      // Port-channel
      'portchannel': 'Port-channel',
      'port-channel': 'Port-channel',
      'po': 'Port-channel'
    };
    
    // Extract interface type and number
    for (const [shortName, fullName] of Object.entries(interfaceMap)) {
      const pattern = new RegExp(`^${shortName}(\\d+(?:\\/\\d+(?:\\/\\d+)?)?)$`, 'i');
      const match = normalized.match(pattern);
      
      if (match) {
        return `${fullName}${match[1]}`;
      }
    }
    
    // If no match found, try to extract numbers and guess interface type
    const numberMatch = normalized.match(/(\d+(?:\/\d+(?:\/\d+)?)?)/);
    if (numberMatch) {
      // Default to GigabitEthernet if we have numbers but unclear type
      return `GigabitEthernet${numberMatch[1]}`;
    }
    
    // Return as-is if we can't parse it
    return interfaceName;
  }

  /**
   * Get fallback ports for device type
   */
  _getFallbackPorts(deviceType, deviceName) {
    const type = deviceType.toLowerCase();
    
    if (type.includes('router')) {
      return [
        'GigabitEthernet0/0',
        'GigabitEthernet0/1', 
        'FastEthernet0/0',
        'FastEthernet0/1'
      ];
    } else if (type.includes('switch')) {
      return [
        'GigabitEthernet0/1',
        'GigabitEthernet0/2',
        'FastEthernet0/1',
        'FastEthernet0/24'
      ];
    } else {
      // Generic network device
      return [
        'Ethernet0/0',
        'Ethernet0/1',
        'GigabitEthernet0/1'
      ];
    }
  }

  /**
   * Clean configuration output
   */
  _cleanConfiguration(rawConfig, userPrompt = '') {
    if (!rawConfig) return '';
    
    console.log(`🧹 Cleaning configuration (${rawConfig.length} chars)...`);
    console.log(`🧹 User prompt: "${userPrompt}"`);
    console.log(`🧹 Raw config preview: ${rawConfig.substring(0, 300)}...`);
    
    let cleaned = rawConfig;
    
    // Extract from code blocks if present (handle multiple formats)
    const codeBlockPatterns = [
      /```[\s\S]*?```/g,
      /```plaintext\n([\s\S]*?)```/g,
      /```cisco\n([\s\S]*?)```/g,
      /```ios\n([\s\S]*?)```/g
    ];
    
    for (const pattern of codeBlockPatterns) {
      const matches = rawConfig.match(pattern);
      if (matches && matches.length > 0) {
        const blockContent = matches[0]
          .replace(/```\w*\n?/g, '')
          .replace(/```/g, '')
          .trim();
        if (blockContent.includes('configure terminal') || blockContent.includes('interface') || blockContent.includes('ip address')) {
          cleaned = blockContent;
          break;
        }
      }
    }
    
    // Remove unwanted prefixes and explanations
    cleaned = cleaned
      .replace(/```.*$/gm, '')
      .replace(/^Here's.*$/gmi, '')
      .replace(/^This.*$/gmi, '')
      .replace(/^Based on.*$/gmi, '')
      .replace(/^Looking at.*$/gmi, '')
      .replace(/^Below is.*$/gmi, '')
      .replace(/^Certainly!.*$/gmi, '')
      .replace(/^\s*\*\*.*?\*\*\s*$/gm, '')  // Remove markdown headers
      .trim();

    // Split into lines and filter
    const lines = cleaned.split('\n');
    const configLines = [];
    let inConfig = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Start collecting from configure terminal
      if (trimmed === 'configure terminal' || trimmed === 'conf t') {
        inConfig = true;
        configLines.push('configure terminal');
        continue;
      }
      
      // Skip empty lines and explanatory text before config starts
      if (!inConfig && (trimmed === '' || trimmed.match(/^[A-Z].*:/) || trimmed.includes('analysis'))) {
        continue;
      }
      
      // Collect configuration lines
      if (inConfig || trimmed.startsWith('interface') || trimmed.startsWith('ip address') || trimmed.startsWith('no shutdown') || trimmed.startsWith('description')) {
        inConfig = true;
        
        // Skip protocol-specific configs unless they match user request
        const userRequest = userPrompt.toLowerCase();
        const isHSRPLine = trimmed.includes('hsrp') || trimmed.includes('standby');
        const isOSPFLine = trimmed.includes('ospf') || trimmed.includes('router ospf');
        const isEIGRPLine = trimmed.includes('eigrp') || trimmed.includes('router eigrp');
        
        // Only include protocol lines if user specifically requested them
        if (isHSRPLine && !userRequest.includes('hsrp')) {
          continue; // Skip HSRP config if not requested
        }
        if (isOSPFLine && !userRequest.includes('ospf')) {
          continue; // Skip OSPF config if not requested
        }
        if (isEIGRPLine && !userRequest.includes('eigrp')) {
          continue; // Skip EIGRP config if not requested
        }
        
        configLines.push(line);
      }
    }

    // Ensure proper structure
    cleaned = configLines.join('\n').trim();
    
    if (!cleaned.includes('configure terminal')) {
      cleaned = 'configure terminal\n' + cleaned;
    }
    if (!cleaned.includes('end') && !cleaned.endsWith('end')) {
      cleaned = cleaned + '\nend';
    }
    
    console.log(`✅ Cleaned to ${cleaned.split('\n').length} lines`);
    console.log(`✅ Final cleaned config: ${cleaned.substring(0, 200)}...`);
    
    if (cleaned.length < 20) {
      console.warn(`⚠️ Configuration too short after cleaning (${cleaned.length} chars)`);
    }
    
    return cleaned;
  }

  /**
   * Convert image file to base64
   */
  async _imageToBase64(imagePath) {
    try {
      const imageBuffer = fs.readFileSync(imagePath);
      return imageBuffer.toString('base64');
    } catch (error) {
      throw new Error(`Failed to read image file: ${error.message}`);
    }
  }

  /**
   * Build comprehensive topology analysis prompt
   */
  _buildTopologyAnalysisPrompt(userPrompt = '') {
    return `You are a Cisco network engineer analyzing a network topology diagram. Extract EXACT port connections and device details for precise configuration generation.

USER REQUEST: ${userPrompt || 'Analyze network topology for configuration generation'}

CRITICAL ANALYSIS REQUIREMENTS:

1. **EXACT DEVICE IDENTIFICATION:**
   - List every device with exact labels (R1, R2, R3, SW1, etc.)
   - Device types: Router, Switch.
   - Note physical positions in topology

2. **PRECISE PORT MAPPING:**
   - Document EVERY connection with exact port numbers
   - Format: "R1 fa0/1 connects to R2 fa0/0"
   - Include interface types: fa (FastEthernet), gi (GigabitEthernet), se (Serial)
   - Map ALL visible ports between devices

3. **TOPOLOGY STRUCTURE:**
   - Identify network architecture (star, mesh, ring, etc.)
   - Note redundant connections for HSRP/VRRP
   - Identify shared segments and point-to-point links

4. **INTERFACE DETAILS:**
   - Extract exact interface names (fa0/1, gi0/2, etc.)
   - Identify which interfaces share the same network segment
   - Note trunk ports vs access ports

5. **REDUNDANCY ANALYSIS:**
   - Identify devices that can form HSRP/VRRP groups
   - Map shared network segments for HA protocols
   - Note backup paths and failover scenarios

6. **CONFIGURATION CONTEXT:**
   - Group devices by network segments
   - Identify primary/backup router candidates
   - Map interface relationships for protocol configuration

IMPORTANT: Be extremely precise with port numbers and device names. This analysis will be used for automated Cisco configuration generation.

TOPOLOGY ANALYSIS:`;
  }

  /**
   * Build port-specific configuration prompt
   */
  _buildPortConfigurationPrompt(device, deviceInfo, topologyAnalysis, basePrompt) {
    const connections = deviceInfo.connections || [];
    const connectionDetails = connections.map(conn => 
      `${conn.local_port} connects to ${conn.remote_device} ${conn.remote_port}`
    ).join('\n');

    // Extract shared network segments for HSRP/VRRP
    const sharedSegments = this._identifySharedSegments(deviceInfo, topologyAnalysis);
    const hsrpCandidates = this._identifyHSRPCandidates(device, topologyAnalysis);

    return `Generate Cisco IOS configuration for device: ${device.name} (${device.type})

TOPOLOGY ANALYSIS CONTEXT:
${topologyAnalysis.networkSummary || 'Network topology with exact port mappings'}

EXACT PORT CONNECTIONS FOR ${device.name}:
${connectionDetails || 'No connections mapped - check topology analysis'}

SHARED NETWORK SEGMENTS:
${sharedSegments || 'No shared segments identified'}

HSRP/REDUNDANCY CONTEXT:
${hsrpCandidates || 'No HSRP candidates identified'}

USER CONFIGURATION REQUEST: ${basePrompt}

DEVICE SPECIFICATIONS:
- Device Name: ${device.name}
- Device Type: ${device.type}
- Model: ${device.model || 'Cisco Router/Switch'}
- Location: ${device.location || 'Network Infrastructure'}

CONFIGURATION REQUIREMENTS:

1. **INTERFACE CONFIGURATION:**
   - Configure ONLY the exact interfaces shown in topology
   - Use correct interface names (fa0/1, gi0/2, etc.)
   - Add descriptive names matching connected devices
   - Set appropriate IP addresses for network segments

2. **PROTOCOL-SPECIFIC CONFIGURATION:**
   - If HSRP requested: Configure with topology-aware priorities
   - If OSPF requested: Use correct network statements for mapped segments
   - If EIGRP requested: Include only connected networks
   - If VLAN requested: Map to specific trunk/access ports

3. **TOPOLOGY AWARENESS:**
   - Generate config that matches the exact port layout
   - Consider redundancy paths shown in diagram
   - Use appropriate priorities for primary/backup roles

4. **PORT-SPECIFIC SETTINGS:**
   - Interface descriptions match topology connections
   - Speed/duplex based on interface types
   - Security settings appropriate for connection type

Generate ONLY configuration for the interfaces and protocols that match the topology image analysis.

Configuration:`;
  }

  /**
   * Identify shared network segments for HSRP/VRRP
   */
  _identifySharedSegments(deviceInfo, topologyAnalysis) {
    // Logic to identify which devices share network segments
    const connections = topologyAnalysis.connections || [];
    const deviceName = deviceInfo.device_name;
    
    const segments = connections
      .filter(conn => 
        conn.device1.includes(deviceName) || conn.device2.includes(deviceName)
      )
      .map(conn => `${conn.device1} and ${conn.device2} share segment via ${conn.port1}-${conn.port2}`)
      .join('\n');
    
    return segments || 'No shared segments detected';
  }

  /**
   * Identify HSRP candidates and priorities
   */
  _identifyHSRPCandidates(device, topologyAnalysis) {
    const devices = topologyAnalysis.devices || [];
    const deviceName = device.name;
    
    // Simple logic to identify HSRP groups
    const routers = devices.filter(d => d.toLowerCase().includes('r') || d.toLowerCase().includes('router'));
    
    if (routers.length >= 2 && routers.some(r => r.includes(deviceName))) {
      const priority = routers.indexOf(deviceName) === 0 ? 'Primary (Priority 110)' : 'Backup (Priority 100)';
      return `HSRP Group candidate: ${priority} in group with ${routers.join(', ')}`;
    }
    
    return 'Not suitable for HSRP configuration';
  }

  /**
   * Parse topology analysis into structured data
   */
  _parseTopologyAnalysis(analysis) {
    try {
      const structured = {
        devices: [],
        connections: [],
        vlans: [],
        ipRanges: [],
        protocols: [],
        networkSummary: analysis
      };

      // Extract devices using regex patterns
      const deviceMatches = analysis.match(/(?:router|switch|firewall|device)\s*\d*[:\-\s]*([^\n,]+)/gi) || [];
      structured.devices = deviceMatches.map(match => match.trim());

      // Enhanced connection extraction with precise port patterns
      const connectionPatterns = [
        // Pattern: "R1 fa0/1 connects to R2 fa0/0"
        /(\w+)\s+(fa\d+\/\d+|gi\d+\/\d+|se\d+\/\d+|eth\d+\/\d+)\s+(?:connects?\s+to|linked?\s+to|→|->)\s+(\w+)\s+(fa\d+\/\d+|gi\d+\/\d+|se\d+\/\d+|eth\d+\/\d+)/gi,
        // Pattern: "R1-fa0/1 -- R2-fa0/0"
        /(\w+)-?(fa\d+\/\d+|gi\d+\/\d+|se\d+\/\d+|eth\d+\/\d+)\s*[-–—]+\s*(\w+)-?(fa\d+\/\d+|gi\d+\/\d+|se\d+\/\d+|eth\d+\/\d+)/gi,
        // Pattern: "Device1 port1 Device2 port2"
        /(\w+)\s+(fa\d+\/\d+|gi\d+\/\d+|se\d+\/\d+)\s+(\w+)\s+(fa\d+\/\d+|gi\d+\/\d+|se\d+\/\d+)/gi,
        // Pattern for interface names in text
        /(R\d+|SW\d+|router\d+|switch\d+).*?(fa\d+\/\d+|gi\d+\/\d+|se\d+\/\d+|eth\d+\/\d+)/gi
      ];

      const devicePorts = new Map(); // Track ports per device
      
      connectionPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(analysis)) !== null) {
          if (match.length >= 5) {
            // Full connection pattern
            const device1 = match[1].trim().toUpperCase();
            const port1 = match[2].trim().toLowerCase();
            const device2 = match[3].trim().toUpperCase();
            const port2 = match[4].trim().toLowerCase();
            
            structured.connections.push({
              device1,
              port1,
              device2,
              port2
            });
            
            // Track ports per device
            if (!devicePorts.has(device1)) devicePorts.set(device1, []);
            if (!devicePorts.has(device2)) devicePorts.set(device2, []);
            devicePorts.get(device1).push(port1);
            devicePorts.get(device2).push(port2);
          } else if (match.length >= 3) {
            // Device-port pattern
            const device = match[1].trim().toUpperCase();
            const port = match[2].trim().toLowerCase();
            
            if (!devicePorts.has(device)) devicePorts.set(device, []);
            devicePorts.get(device).push(port);
          }
        }
      });
      
      // Add device port information to structured data
      structured.devicePorts = Object.fromEntries(devicePorts);

      // Extract VLANs
      const vlanMatches = analysis.match(/vlan\s*\d+/gi) || [];
      structured.vlans = [...new Set(vlanMatches.map(v => v.toLowerCase()))];

      // Extract IP ranges
      const ipMatches = analysis.match(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?:\/\d{1,2})?/g) || [];
      structured.ipRanges = [...new Set(ipMatches)];

      // Extract protocols
      const protocolMatches = analysis.match(/\b(?:ospf|eigrp|bgp|rip|stp|vtp|lacp|hsrp|vrrp)\b/gi) || [];
      structured.protocols = [...new Set(protocolMatches.map(p => p.toUpperCase()))];

      return structured;
      
    } catch (error) {
      console.error('Failed to parse topology analysis:', error);
      return {
        devices: [],
        connections: [],
        vlans: [],
        ipRanges: [],
        protocols: [],
        networkSummary: analysis
      };
    }
  }

  /**
   * Find device-specific information from topology analysis
   */
  _findDeviceInTopology(device, topologyAnalysis) {
    const deviceInfo = {
      device_name: device.name,
      device_type: device.type,
      connections: [],
      suggested_ips: [],
      required_protocols: []
    };

    // Find connections involving this device
    if (topologyAnalysis.connections) {
      topologyAnalysis.connections.forEach(conn => {
        if (conn.device1.toLowerCase().includes(device.name.toLowerCase()) ||
            conn.device2.toLowerCase().includes(device.name.toLowerCase())) {
          
          const isDevice1 = conn.device1.toLowerCase().includes(device.name.toLowerCase());
          
          deviceInfo.connections.push({
            local_port: isDevice1 ? conn.port1 : conn.port2,
            remote_device: isDevice1 ? conn.device2 : conn.device1,
            remote_port: isDevice1 ? conn.port2 : conn.port1
          });
        }
      });
    }

    // Suggest protocols based on device type and topology
    if (device.type === 'router') {
      deviceInfo.required_protocols = ['OSPF', 'EIGRP'];
    } else if (device.type === 'switch') {
      deviceInfo.required_protocols = ['STP', 'VTP'];
    }

    return deviceInfo;
  }

  /**
   * Get Vision LLM service status
   */
  async getServiceStatus() {
    try {
      const response = await this.client.get("/api/tags");
      const models = response.data.models || [];
      const currentModel = models.find(m => m.name === this.visionModel);

      return {
        status: "connected",
        service: "LLaVA Vision Network Topology Analyzer",
        host: this.host,
        model: this.visionModel,
        modelAvailable: !!currentModel,
        availableModels: models.map(m => m.name),
        timeout: this.timeout,
        features: [
          "🔍 Network topology image analysis",
          "🔌 Port and connection mapping",
          "📋 Device identification and classification", 
          "🌐 IP addressing and VLAN detection",
          "⚙️ Protocol recommendations",
          "🎯 Context-aware configuration generation"
        ]
      };
    } catch (error) {
      return {
        status: "disconnected",
        service: "LLaVA Vision Network Topology Analyzer",
        host: this.host,
        model: this.visionModel,
        modelAvailable: false,
        error: error.message
      };
    }
  }
}

export default new VisionLLMService();
