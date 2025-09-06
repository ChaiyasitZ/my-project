import axios from 'axios';
import fs from 'fs';
import path from 'path';

/**
 * Vision LLM Service for Network Topology Analysis
 * Specialized for LLaVA:7b - Image analysis + prompt-based configuration generation
 * Optimized for multimodal vision + text understanding of network topologies
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
    
    // LLaVA-specific parameters for image + text analysis
    this.visionParams = {
      temperature: 0.05,   // Very low for precise technical analysis
      num_predict: 500,    // More tokens for detailed image analysis + config
      top_k: 5,           // Highly focused for technical accuracy
      top_p: 0.7,         // Conservative for network engineering precision
      repeat_penalty: 1.05,
      stop: ['Human:', 'User:', '```']
    };
    
    // Port detection specific parameters (even more precise)
    this.portDetectionParams = {
      temperature: 0.001,  // Ultra-precise for port identification
      num_predict: 400,    // More tokens for detailed port analysis
      top_k: 2,           // Extremely narrow focus
      top_p: 0.5,         // Very conservative for accuracy
      repeat_penalty: 1.01,
      stop: ['Human:', 'ANALYSIS COMPLETE', 'DEVICE ANALYSIS COMPLETE']
    };
    
    // Multi-device topology analysis parameters
    this.multiDeviceAnalysisParams = {
      temperature: 0.02,   // Very precise for multi-device understanding
      num_predict: 800,    // Much more tokens for complex topology analysis
      top_k: 4,           // Focused but allows some variation
      top_p: 0.65,        // Conservative but comprehensive
      repeat_penalty: 1.03,
      stop: ['Human:', 'TOPOLOGY ANALYSIS COMPLETE']
    };
    
    // Configuration generation parameters (balanced for image + prompt)
    this.configGenerationParams = {
      temperature: 0.1,    // Precise but allows some creativity
      num_predict: 600,    // More tokens for complete configurations
      top_k: 8,           // Moderate focus for config variety
      top_p: 0.8,         // Balanced for technical + creative config
      repeat_penalty: 1.08,
      stop: ['Human:', 'User:', 'end\n']
    };
    
    console.log(`🔍 LLaVA Vision LLM Service initialized - Model: ${this.visionModel} @ ${this.host}`);
    console.log(`🎯 Specialized for: Image analysis + Topology-aware configuration generation`);
  }

  /**
   * Enhanced multi-device topology analysis for improved accuracy
   */
  async analyzeMultiDeviceTopology(imagePath, deviceList) {
    const startTime = Date.now();
    
    try {
      console.log(`🔍 Analyzing multi-device topology for ${deviceList.length} devices: ${deviceList.map(d => d.name).join(', ')}`);
      
      const imageBase64 = await this._imageToBase64(imagePath);
      
      const topologyPrompt = `You are a Cisco network topology expert analyzing a network diagram with MULTIPLE devices.

CRITICAL MULTI-DEVICE ANALYSIS TASK:

TARGET DEVICES TO ANALYZE: ${deviceList.map(d => d.name).join(', ')}

STEP-BY-STEP ANALYSIS REQUIRED:

1. **DEVICE IDENTIFICATION:**
   - Locate each device: ${deviceList.map(d => d.name).join(', ')}
   - Identify device types (Router/Switch/Firewall)
   - Note device positions and labels in the image

2. **PORT MAPPING FOR EACH DEVICE:**
   For ${deviceList.map(d => d.name).join(', ')}, identify:
   - ALL interface ports visible on each device
   - Port labels (Gi0/1, Fa0/24, etc.)
   - Port numbers and types
   - Connection endpoints

3. **INTER-DEVICE CONNECTIONS:**
   - Map ALL cables/lines between devices
   - Identify which port connects to which device
   - Note connection types (Ethernet, Serial, etc.)
   - Document connection paths

4. **NETWORK SEGMENTS:**
   - Identify shared network segments
   - Group devices by network connectivity
   - Note redundant paths and backup connections
   - Identify potential HSRP/VRRP segments

OUTPUT FORMAT (BE EXTREMELY DETAILED):

DEVICES FOUND:
${deviceList.map(device => `- ${device.name}: [device type] at [position in image]`).join('\n')}

DETAILED PORT ANALYSIS:
${deviceList.map(device => `
${device.name} PORTS:
- Port 1: [interface name] → connects to [device] [port]
- Port 2: [interface name] → connects to [device] [port]
- [continue for all visible ports]`).join('\n')}

NETWORK TOPOLOGY STRUCTURE:
- Network segments: [list all network segments]
- Redundant paths: [identify backup connections]
- HSRP candidates: [devices that share network segments]

TOPOLOGY ANALYSIS COMPLETE`;

      const response = await this.client.post("/api/generate", {
        model: this.visionModel,
        prompt: topologyPrompt,
        images: [imageBase64],
        stream: false,
        options: this.multiDeviceAnalysisParams
      });

      const analysis = response.data.response?.trim();
      console.log(`📋 Multi-device topology analysis: ${analysis?.length || 0} chars`);
      
      const structuredAnalysis = this._parseMultiDeviceTopology(analysis, deviceList);
      
      console.log(`✅ Multi-device analysis completed in ${Date.now() - startTime}ms`);
      console.log(`📊 Analyzed ${Object.keys(structuredAnalysis.devicePorts).length} devices with ${structuredAnalysis.connections.length} connections`);
      
      return {
        success: true,
        analysis: structuredAnalysis,
        rawAnalysis: analysis,
        executionTime: Date.now() - startTime,
        devicesAnalyzed: Object.keys(structuredAnalysis.devicePorts).length,
        connectionsFound: structuredAnalysis.connections.length
      };
      
    } catch (error) {
      console.error(`❌ Multi-device topology analysis failed:`, error.message);
      return {
        success: false,
        error: error.message,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Parse multi-device topology analysis into structured data
   */
  _parseMultiDeviceTopology(analysis, deviceList) {
    const result = {
      devicePorts: {},
      connections: [],
      networkSegments: [],
      hsrpCandidates: [],
      redundantPaths: []
    };
    
    try {
      // Initialize device ports for each target device
      deviceList.forEach(device => {
        result.devicePorts[device.name.toUpperCase()] = [];
      });
      
      // Enhanced parsing for multi-device scenarios
      const lines = analysis.split('\n');
      let currentDevice = null;
      
      for (const line of lines) {
        const trimmed = line.trim();
        
        // Detect device sections
        const deviceMatch = trimmed.match(/^([A-Z0-9-]+)\s+PORTS?:/i);
        if (deviceMatch) {
          currentDevice = deviceMatch[1].toUpperCase();
          continue;
        }
        
        // Parse port information for current device
        if (currentDevice && trimmed.startsWith('-')) {
          const portMatch = trimmed.match(/-\s*(?:Port\s+\d+:\s*)?([A-Za-z]+\d+\/\d+(?:\/\d+)?)/i);
          if (portMatch) {
            const standardizedPort = this._standardizeCiscoInterface(portMatch[1]);
            if (!result.devicePorts[currentDevice]) {
              result.devicePorts[currentDevice] = [];
            }
            result.devicePorts[currentDevice].push(standardizedPort);
          }
          
          // Parse connections
          const connectionMatch = trimmed.match(/-\s*([A-Za-z]+\d+\/\d+(?:\/\d+)?)\s*[→\->]+\s*connects?\s+to\s+([A-Z0-9-]+)\s+([A-Za-z]+\d+\/\d+(?:\/\d+)?)/i);
          if (connectionMatch) {
            result.connections.push({
              sourceDevice: currentDevice,
              sourcePort: this._standardizeCiscoInterface(connectionMatch[1]),
              targetDevice: connectionMatch[2].toUpperCase(),
              targetPort: this._standardizeCiscoInterface(connectionMatch[3])
            });
          }
        }
        
        // Parse network segments
        if (trimmed.toLowerCase().includes('network segment') || trimmed.toLowerCase().includes('shared segment')) {
          const segmentMatch = trimmed.match(/([A-Z0-9-]+)\s+and\s+([A-Z0-9-]+)\s+share/i);
          if (segmentMatch) {
            result.networkSegments.push({
              device1: segmentMatch[1].toUpperCase(),
              device2: segmentMatch[2].toUpperCase(),
              type: 'shared'
            });
          }
        }
        
        // Parse HSRP candidates
        if (trimmed.toLowerCase().includes('hsrp candidate')) {
          const hsrpMatch = trimmed.match(/([A-Z0-9-]+).*hsrp.*group/i);
          if (hsrpMatch) {
            result.hsrpCandidates.push(hsrpMatch[1].toUpperCase());
          }
        }
      }
      
      console.log(`📋 Parsed multi-device topology:`, {
        devices: Object.keys(result.devicePorts),
        totalPorts: Object.values(result.devicePorts).reduce((sum, ports) => sum + ports.length, 0),
        connections: result.connections.length,
        networkSegments: result.networkSegments.length
      });
      
      return result;
      
    } catch (error) {
      console.error(`❌ Failed to parse multi-device topology:`, error.message);
      return result;
    }
  }

  /**
   * Enhanced port detection specifically for target device in multi-device topology
   */
  async _detectPortsFromImageEnhanced(imagePath, deviceName, allDevices) {
    try {
      console.log(`🔍 Enhanced port detection for ${deviceName} in multi-device topology...`);
      
      const imageBase64 = await this._imageToBase64(imagePath);
      
      const enhancedPortPrompt = `You are analyzing a Cisco network topology diagram with MULTIPLE devices. Focus EXCLUSIVELY on device "${deviceName}".

MULTI-DEVICE CONTEXT:
- Target device: ${deviceName}
- Other devices in topology: ${allDevices.filter(d => d !== deviceName).join(', ')}
- Your task: Find ONLY the ports for ${deviceName}

ENHANCED ANALYSIS INSTRUCTIONS:

1. **LOCATE ${deviceName} SPECIFICALLY:**
   - Find the device labeled "${deviceName}" in the image
   - Ignore all other devices (${allDevices.filter(d => d !== deviceName).join(', ')})
   - Focus only on ${deviceName}'s connections

2. **DETAILED PORT IDENTIFICATION FOR ${deviceName}:**
   - Look at ALL cables/lines connected to ${deviceName}
   - Read port labels directly on or near ${deviceName}
   - Note interface types and numbers
   - Identify connection endpoints from ${deviceName}

3. **CISCO INTERFACE NAMING PRECISION:**
   - Gi0/1, Gi0/2 = GigabitEthernet0/1, GigabitEthernet0/2
   - Fa0/1, Fa0/24 = FastEthernet0/1, FastEthernet0/24
   - Se0/0/0 = Serial0/0/0
   - Te0/1 = TenGigabitEthernet0/1

4. **CONNECTION MAPPING FOR ${deviceName}:**
   - ${deviceName} [port] connects to [other device] [port]
   - Be specific about which device and which port
   - Include ALL visible connections from ${deviceName}

REQUIRED OUTPUT FORMAT:

DEVICE ANALYSIS COMPLETE
TARGET DEVICE: ${deviceName}
PORTS DETECTED:
- [Full interface name 1]
- [Full interface name 2]
- [Continue for all ports]

CONNECTIONS FROM ${deviceName}:
- ${deviceName} [port] connects to [device] [port]
- ${deviceName} [port] connects to [device] [port]
- [Continue for all connections]

DEVICE ANALYSIS COMPLETE`;

      const response = await this.client.post("/api/generate", {
        model: this.visionModel,
        prompt: enhancedPortPrompt,
        images: [imageBase64],
        stream: false,
        options: this.portDetectionParams
      });

      const analysis = response.data.response?.trim();
      console.log(`📋 Enhanced port detection for ${deviceName}: ${analysis}`);
      
      return this._parseEnhancedPortDetection(analysis, deviceName);
      
    } catch (error) {
      console.error(`❌ Enhanced port detection failed for ${deviceName}:`, error.message);
      return { ports: [], connections: [] };
    }
  }

  /**
   * Parse enhanced port detection results with better accuracy
   */
  _parseEnhancedPortDetection(analysis, deviceName) {
    const result = { ports: [], connections: [] };
    
    try {
      const lines = analysis.split('\n');
      let inPortsSection = false;
      let inConnectionsSection = false;
      
      for (const line of lines) {
        const trimmed = line.trim();
        
        // Detect sections
        if (trimmed.includes('PORTS DETECTED:')) {
          inPortsSection = true;
          inConnectionsSection = false;
          continue;
        }
        
        if (trimmed.includes('CONNECTIONS FROM')) {
          inPortsSection = false;
          inConnectionsSection = true;
          continue;
        }
        
        // Parse ports section
        if (inPortsSection && trimmed.startsWith('-')) {
          const portMatch = trimmed.match(/-\s*([A-Za-z]+\d+\/\d+(?:\/\d+)?)/);
          if (portMatch) {
            const standardizedPort = this._standardizeCiscoInterface(portMatch[1]);
            result.ports.push(standardizedPort);
          }
        }
        
        // Parse connections section with enhanced accuracy
        if (inConnectionsSection && trimmed.includes('connects to')) {
          const connectionPatterns = [
            // Pattern: "- R1 GigabitEthernet0/1 connects to SW1 GigabitEthernet0/2"
            new RegExp(`-\\s*${deviceName}\\s+([A-Za-z]+\\d+\\/\\d+(?:\\/\\d+)?)\\s+connects\\s+to\\s+([A-Z0-9-]+)\\s+([A-Za-z]+\\d+\\/\\d+(?:\\/\\d+)?)`, 'i'),
            // Pattern: "- GigabitEthernet0/1 connects to SW1 GigabitEthernet0/2"
            /^\s*-\s*([A-Za-z]+\d+\/\d+(?:\/\d+)?)\s+connects\s+to\s+([A-Z0-9-]+)\s+([A-Za-z]+\d+\/\d+(?:\/\d+)?)/i
          ];
          
          for (const pattern of connectionPatterns) {
            const match = trimmed.match(pattern);
            if (match) {
              result.connections.push({
                device: deviceName,
                port: this._standardizeCiscoInterface(match[1]),
                connectsTo: match[2].toUpperCase(),
                remotePort: this._standardizeCiscoInterface(match[3])
              });
              break;
            }
          }
        }
      }
      
      // Remove duplicates
      result.ports = [...new Set(result.ports)];
      
      console.log(`✅ Enhanced parsing for ${deviceName}:`);
      console.log(`   📍 Ports (${result.ports.length}): ${result.ports.join(', ')}`);
      console.log(`   🔗 Connections (${result.connections.length}): ${result.connections.map(c => `${c.port}→${c.connectsTo}:${c.remotePort}`).join(', ')}`);
      
      return result;
      
    } catch (error) {
      console.error(`❌ Failed to parse enhanced port detection:`, error.message);
      return { ports: [], connections: [] };
    }
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
      
      // Create direct configuration prompt with enhanced multi-device context
      const allDevices = deviceContext.allDevices || [device];
      const configPrompt = await this._buildDirectConfigurationPrompt(prompt, device, deviceContext, imagePath, allDevices);
      
      // Call LLaVA API with image and prompt using specialized parameters
      const response = await this.client.post("/api/generate", {
        model: this.visionModel,
        prompt: configPrompt,
        images: [imageBase64],
        stream: false,
        options: this.configGenerationParams  // Use specialized config generation parameters
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
        options: this.portDetectionParams  // Use specialized port detection parameters
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
   * Build direct configuration prompt from image and text with enhanced multi-device context
   */
  async _buildDirectConfigurationPrompt(prompt, device, deviceContext, imagePath, allDevices = []) {
    // Use enhanced port detection for multi-device scenarios
    const deviceNames = allDevices.length > 0 ? allDevices.map(d => d.name) : [device.name];
    const portInfo = await this._detectPortsFromImageEnhanced(imagePath, device.name, deviceNames);
    
    let detectedPortsText = '';
    if (portInfo.ports.length > 0) {
      detectedPortsText = `
ENHANCED PORT DETECTION FOR ${device.name} (Multi-device topology):
${portInfo.ports.map(port => `- ${port}`).join('\n')}

VERIFIED CONNECTIONS FROM ${device.name}:
${portInfo.connections.map(conn => `- ${conn.port} connects to ${conn.connectsTo} ${conn.remotePort}`).join('\n')}

TOPOLOGY CONTEXT:
- Total devices in topology: ${deviceNames.length}
- Other devices: ${deviceNames.filter(d => d !== device.name).join(', ')}
- Focus device: ${device.name}
`;
    } else {
      // Enhanced fallback for multi-device scenarios
      const fallbackPorts = this._getEnhancedFallbackPorts(device.type, device.name, allDevices.length);
      detectedPortsText = `
ENHANCED FALLBACK INTERFACES FOR ${device.name} (${device.type}) in ${allDevices.length}-device topology:
${fallbackPorts.map(port => `- ${port}`).join('\n')}

NOTE: Enhanced port detection from image failed, using topology-aware standard interfaces.
RECOMMENDATION: Check image quality and device label visibility.
`;
    }

    return `You are an expert Cisco network engineer with deep knowledge of IOS configuration syntax and best practices.

DEVICE CONTEXT:
- Device Name: ${device.name}
- Device Type: ${device.type}
- Model: ${device.model || 'Cisco Router/Switch'}
- Expected IOS: 15.x or higher

USER REQUEST: ${prompt}

${detectedPortsText}

CISCO IOS CONFIGURATION EXPERTISE:
${this._getCiscoConfigurationExpertise(prompt, device.type)}

CRITICAL CONFIGURATION REQUIREMENTS:

1. **INTERFACE CONFIGURATION STANDARDS:**
   - Use full interface names: interface GigabitEthernet0/1 (not gi0/1)
   - IP addressing: ip address [ip] [subnet-mask] (not CIDR notation)
   - Interface activation: no shutdown (required for all active interfaces)
   - Descriptions: description [connection-description]
   - Speed/duplex: speed 1000, duplex full (when needed)

2. **ROUTING PROTOCOL SYNTAX:**
   - OSPF: router ospf [process-id], network [network] [wildcard] area [area]
   - EIGRP: router eigrp [as-number], network [network] [wildcard]
   - BGP: router bgp [as-number], neighbor [ip] remote-as [as]

3. **SWITCHING PROTOCOLS:**
   - VLANs: vlan [id], name [vlan-name]
   - Switchport: switchport mode [access|trunk], switchport access vlan [id]
   - STP: spanning-tree mode [pvst+|rapid-pvst+]

4. **SECURITY BEST PRACTICES:**
   - Access lists: access-list [number] [permit|deny] [source] [wildcard]
   - SSH: ip ssh version 2, crypto key generate rsa modulus 1024
   - Line security: line vty 0 15, login local, transport input ssh

5. **TOPOLOGY-AWARE CONFIGURATION:**
   - Use ONLY the detected ports: ${portInfo.ports.join(', ') || 'standard interfaces'}
   - Configure based on detected connections
   - Follow user request exactly (no additional protocols unless requested)
   - Include proper interface descriptions

CONFIGURATION FORMAT REQUIREMENTS:
- Start: configure terminal
- Proper indentation for sub-commands
- Complete command syntax
- End: end

Generate syntactically correct Cisco IOS configuration for ${device.name}:

configure terminal`;
  }

  /**
   * Get Cisco configuration expertise based on prompt and device type
   */
  _getCiscoConfigurationExpertise(prompt, deviceType) {
    const promptLower = prompt.toLowerCase();
    let expertise = '';
    
    // Interface and IP configuration expertise
    if (promptLower.includes('interface') || promptLower.includes('ip') || promptLower.includes('address')) {
      expertise += `
INTERFACE CONFIGURATION EXPERTISE:
- Interface naming: GigabitEthernet0/1, FastEthernet0/1, Serial0/0/0
- IP configuration: ip address 192.168.1.1 255.255.255.0
- Secondary IPs: ip address 10.1.1.1 255.255.255.0 secondary
- Interface activation: no shutdown (critical for interface to work)
- Descriptions: description Connection_to_Router2_Gi0/1
- Access lists: ip access-group ACL_NAME in/out
`;
    }
    
    // OSPF expertise
    if (promptLower.includes('ospf')) {
      expertise += `
OSPF CONFIGURATION EXPERTISE:
- Process configuration: router ospf 1
- Router ID: router-id 1.1.1.1 (use loopback or highest IP)
- Network statements: network 192.168.1.0 0.0.0.255 area 0
- Area types: area 0 (backbone), area 1 stub, area 2 nssa
- Interface OSPF: ip ospf 1 area 0 (alternative to network command)
- Passive interfaces: passive-interface default, no passive-interface GigabitEthernet0/1
- Cost adjustment: ip ospf cost 100
- Hello/dead timers: ip ospf hello-interval 10, ip ospf dead-interval 40
`;
    }
    
    // EIGRP expertise
    if (promptLower.includes('eigrp')) {
      expertise += `
EIGRP CONFIGURATION EXPERTISE:
- AS configuration: router eigrp 100
- Network statements: network 192.168.1.0 0.0.0.255
- Auto-summary: no auto-summary (disable for modern networks)
- Passive interfaces: passive-interface GigabitEthernet0/1
- Metric tuning: metric weights 0 1 0 1 0 1
- Authentication: key chain EIGRP_KEY, key 1, key-string cisco123
`;
    }
    
    // HSRP expertise
    if (promptLower.includes('hsrp') || promptLower.includes('redundancy')) {
      expertise += `
HSRP CONFIGURATION EXPERTISE:
- Virtual IP: standby 1 ip 192.168.1.254
- Priority: standby 1 priority 110 (higher = active router)
- Preemption: standby 1 preempt (allows takeover when priority is higher)
- Authentication: standby 1 authentication md5 key-string hsrp_key
- Tracking: standby 1 track 1 decrement 20
- Timers: standby 1 timers 3 10 (hello 3s, hold 10s)
`;
    }
    
    // VLAN and switching expertise
    if (deviceType === 'switch' || promptLower.includes('vlan') || promptLower.includes('switch')) {
      expertise += `
SWITCHING CONFIGURATION EXPERTISE:
- VLAN creation: vlan 10, name DATA_VLAN
- Access ports: switchport mode access, switchport access vlan 10
- Trunk ports: switchport mode trunk, switchport trunk allowed vlan 10,20,30
- Native VLAN: switchport trunk native vlan 1
- STP configuration: spanning-tree mode rapid-pvst, spanning-tree vlan 10 priority 4096
- Port security: switchport port-security, switchport port-security maximum 2
`;
    }
    
    // BGP expertise
    if (promptLower.includes('bgp')) {
      expertise += `
BGP CONFIGURATION EXPERTISE:
- BGP process: router bgp 65001
- Router ID: bgp router-id 1.1.1.1
- Neighbors: neighbor 192.168.1.2 remote-as 65002
- Networks: network 10.1.1.0 mask 255.255.255.0
- Attributes: neighbor 192.168.1.2 weight 100
- Route maps: route-map BGP_IN permit 10
`;
    }
    
    // Security expertise
    if (promptLower.includes('acl') || promptLower.includes('access-list') || promptLower.includes('security')) {
      expertise += `
SECURITY CONFIGURATION EXPERTISE:
- Standard ACL: access-list 1 permit 192.168.1.0 0.0.0.255
- Extended ACL: access-list 101 permit tcp 192.168.1.0 0.0.0.255 any eq 80
- Named ACL: ip access-list extended WEB_TRAFFIC
- Apply ACL: ip access-group WEB_TRAFFIC in
- SSH security: ip ssh version 2, line vty 0 15, transport input ssh
`;
    }
    
    return expertise;
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
   * Get enhanced fallback ports for multi-device topology scenarios
   */
  _getEnhancedFallbackPorts(deviceType, deviceName, topologySize = 1) {
    const type = deviceType.toLowerCase();
    const deviceNumber = deviceName.match(/\d+/)?.[0] || '1';
    
    if (type.includes('router')) {
      // More interfaces for multi-device topologies
      const routerPorts = [
        'GigabitEthernet0/0',
        'GigabitEthernet0/1',
        'FastEthernet0/0',
        'FastEthernet0/1'
      ];
      
      // Add more interfaces for larger topologies
      if (topologySize > 2) {
        routerPorts.push('GigabitEthernet0/2', 'Serial0/0/0', 'Serial0/1/0');
      }
      
      return routerPorts;
    } else if (type.includes('switch')) {
      // Comprehensive switch port list for multi-device
      const switchPorts = [
        'GigabitEthernet0/1',
        'GigabitEthernet0/2',
        'FastEthernet0/1',
        'FastEthernet0/2'
      ];
      
      // Add more access ports for larger topologies
      if (topologySize > 2) {
        switchPorts.push(
          'FastEthernet0/3', 'FastEthernet0/4',
          'GigabitEthernet0/3', 'GigabitEthernet0/4'
        );
      }
      
      // Add typical uplink ports
      if (topologySize > 1) {
        switchPorts.push('GigabitEthernet0/24', 'GigabitEthernet0/48');
      }
      
      return switchPorts;
    } else {
      // Enhanced generic device ports
      return [
        'Ethernet0/0',
        'Ethernet0/1',
        'GigabitEthernet0/1',
        'GigabitEthernet0/2'
      ];
    }
  }

  /**
   * Get fallback ports for device type (legacy method)
   */
  _getFallbackPorts(deviceType, deviceName) {
    return this._getEnhancedFallbackPorts(deviceType, deviceName, 1);
  }

  /**
   * Clean configuration output with enhanced Cisco syntax validation
   */
  _cleanConfiguration(rawConfig, userPrompt = '') {
    if (!rawConfig) return '';
    
    console.log(`🧹 Cleaning configuration with Cisco expertise (${rawConfig.length} chars)...`);
    console.log(`🧹 User prompt: "${userPrompt}"`);
    console.log(`🧹 Raw config preview: ${rawConfig.substring(0, 300)}...`);
    
    let cleaned = rawConfig;
    
    // Extract from code blocks if present (handle multiple formats)
    const codeBlockPatterns = [
      /```[\s\S]*?```/g,
      /```plaintext\n([\s\S]*?)```/g,
      /```cisco\n([\s\S]*?)```/g,
      /```ios\n([\s\S]*?)```/g,
      /```config\n([\s\S]*?)```/g
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
      .replace(/^I'll.*$/gmi, '')
      .replace(/^\s*\*\*.*?\*\*\s*$/gm, '')  // Remove markdown headers
      .trim();

    // Split into lines and filter with Cisco expertise
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
      if (!inConfig && (trimmed === '' || trimmed.match(/^[A-Z].*:/) || trimmed.includes('analysis') || trimmed.includes('explanation'))) {
        continue;
      }
      
      // Collect configuration lines with Cisco command validation
      if (inConfig || this._isCiscoCommand(trimmed)) {
        inConfig = true;
        
        // Apply Cisco-specific filtering based on user request
        if (this._shouldIncludeCommand(trimmed, userPrompt)) {
          // Validate and fix Cisco syntax
          const validatedLine = this._validateAndFixCiscoCommand(line);
          configLines.push(validatedLine);
        }
      }
    }

    // Ensure proper Cisco configuration structure
    cleaned = configLines.join('\n').trim();
    
    if (!cleaned.includes('configure terminal')) {
      cleaned = 'configure terminal\n' + cleaned;
    }
    if (!cleaned.includes('end') && !cleaned.endsWith('end')) {
      cleaned = cleaned + '\nend';
    }
    
    // Final Cisco syntax validation
    cleaned = this._applyCiscoSyntaxRules(cleaned);
    
    console.log(`✅ Cleaned and validated with Cisco expertise: ${cleaned.split('\n').length} lines`);
    console.log(`✅ Final Cisco config: ${cleaned.substring(0, 200)}...`);
    
    if (cleaned.length < 20) {
      console.warn(`⚠️ Configuration too short after Cisco validation (${cleaned.length} chars)`);
    }
    
    return cleaned;
  }

  /**
   * Check if a line is a valid Cisco command
   */
  _isCiscoCommand(line) {
    const trimmed = line.trim();
    const ciscoCommands = [
      'interface', 'ip address', 'no shutdown', 'description', 'router ospf', 'router eigrp', 
      'router bgp', 'network', 'neighbor', 'vlan', 'switchport', 'access-list', 'standby',
      'spanning-tree', 'hostname', 'username', 'enable secret', 'line vty', 'crypto key'
    ];
    
    return ciscoCommands.some(cmd => trimmed.startsWith(cmd));
  }

  /**
   * Determine if command should be included based on user request
   */
  _shouldIncludeCommand(command, userPrompt) {
    const userRequest = userPrompt.toLowerCase();
    const commandLower = command.toLowerCase();
    
    // Always include basic interface configuration
    if (commandLower.includes('interface') || commandLower.includes('ip address') || 
        commandLower.includes('no shutdown') || commandLower.includes('description')) {
      return true;
    }
    
    // Protocol-specific filtering
    const isHSRPLine = commandLower.includes('hsrp') || commandLower.includes('standby');
    const isOSPFLine = commandLower.includes('ospf') || commandLower.includes('router ospf');
    const isEIGRPLine = commandLower.includes('eigrp') || commandLower.includes('router eigrp');
    const isBGPLine = commandLower.includes('bgp') || commandLower.includes('router bgp');
    
    // Only include protocol lines if user specifically requested them
    if (isHSRPLine && !userRequest.includes('hsrp')) return false;
    if (isOSPFLine && !userRequest.includes('ospf')) return false;
    if (isEIGRPLine && !userRequest.includes('eigrp')) return false;
    if (isBGPLine && !userRequest.includes('bgp')) return false;
    
    return true;
  }

  /**
   * Validate and fix individual Cisco commands
   */
  _validateAndFixCiscoCommand(line) {
    let fixed = line;
    
    // Fix interface names (gi0/1 → GigabitEthernet0/1)
    const interfaceMap = {
      'gi': 'GigabitEthernet',
      'fa': 'FastEthernet',
      'eth': 'Ethernet', 
      'se': 'Serial',
      'te': 'TenGigabitEthernet'
    };
    
    for (const [abbrev, full] of Object.entries(interfaceMap)) {
      const pattern = new RegExp(`\\b${abbrev}(\\d+(?:\\/\\d+(?:\\/\\d+)?)?)\\b`, 'gi');
      fixed = fixed.replace(pattern, `${full}$1`);
    }
    
    // Fix IP address CIDR notation to subnet mask
    const cidrPattern = /ip\s+address\s+(\d+\.\d+\.\d+\.\d+)\/(\d+)/i;
    if (cidrPattern.test(fixed)) {
      const match = fixed.match(cidrPattern);
      const ip = match[1];
      const prefix = parseInt(match[2]);
      const subnetMask = this._cidrToSubnetMask(prefix);
      fixed = fixed.replace(cidrPattern, `ip address ${ip} ${subnetMask}`);
    }
    
    return fixed;
  }

  /**
   * Apply final Cisco syntax rules
   */
  _applyCiscoSyntaxRules(config) {
    let fixed = config;
    
    // Ensure proper command structure
    const lines = fixed.split('\n');
    const finalLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Add proper indentation for sub-commands
      if (i > 0 && !trimmed.startsWith('configure') && !trimmed.startsWith('end') && 
          !trimmed.startsWith('exit') && !trimmed.startsWith('interface') && 
          !trimmed.startsWith('router') && !trimmed.startsWith('vlan') &&
          !line.startsWith(' ') && trimmed.length > 0) {
        
        // Check if previous line was a mode command
        const prevLine = lines[i-1]?.trim();
        if (prevLine?.startsWith('interface') || prevLine?.startsWith('router') || prevLine?.startsWith('vlan')) {
          finalLines.push(' ' + trimmed);
        } else {
          finalLines.push(line);
        }
      } else {
        finalLines.push(line);
      }
    }
    
    return finalLines.join('\n');
  }

  /**
   * Convert CIDR to subnet mask
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
   * Enhanced image preprocessing for better multi-device analysis
   */
  async _preprocessImageForAnalysis(imagePath) {
    try {
      console.log(`🖼️ Preprocessing image for enhanced analysis: ${imagePath}`);
      
      const imageBuffer = fs.readFileSync(imagePath);
      const stats = fs.statSync(imagePath);
      
      console.log(`📊 Image stats: ${Math.round(stats.size / 1024)}KB, ${path.extname(imagePath)}`);
      
      // For now, return base64 - future: could add image enhancement
      const base64 = imageBuffer.toString('base64');
      
      // Log image characteristics for debugging
      const sizeCategory = stats.size > 5 * 1024 * 1024 ? 'large' : 
                          stats.size > 1 * 1024 * 1024 ? 'medium' : 'small';
      
      console.log(`✅ Image preprocessed: ${sizeCategory} size, ready for LLaVA analysis`);
      
      return {
        base64: base64,
        originalSize: stats.size,
        sizeCategory: sizeCategory,
        format: path.extname(imagePath).toLowerCase()
      };
      
    } catch (error) {
      throw new Error(`Failed to preprocess image: ${error.message}`);
    }
  }

  /**
   * Convert image file to base64 (legacy method)
   */
  async _imageToBase64(imagePath) {
    const processed = await this._preprocessImageForAnalysis(imagePath);
    return processed.base64;
  }

  /**
   * Multi-step image analysis for improved accuracy
   */
  async _performMultiStepImageAnalysis(imagePath, deviceList) {
    try {
      console.log(`🔍 Performing multi-step analysis for ${deviceList.length} devices...`);
      
      // Step 1: Overall topology analysis
      const topologyAnalysis = await this.analyzeMultiDeviceTopology(imagePath, deviceList);
      
      // Step 2: Device-specific port detection for each device
      const devicePortAnalysis = {};
      
      for (const device of deviceList) {
        console.log(`🔌 Analyzing ports for ${device.name}...`);
        const portInfo = await this._detectPortsFromImageEnhanced(
          imagePath, 
          device.name, 
          deviceList.map(d => d.name)
        );
        devicePortAnalysis[device.name] = portInfo;
      }
      
      // Step 3: Cross-validate connections
      const validatedConnections = this._crossValidateConnections(devicePortAnalysis);
      
      console.log(`✅ Multi-step analysis completed:`);
      console.log(`   📊 Topology analysis: ${topologyAnalysis.success ? 'Success' : 'Failed'}`);
      console.log(`   🔌 Device port analysis: ${Object.keys(devicePortAnalysis).length} devices`);
      console.log(`   ✅ Validated connections: ${validatedConnections.length}`);
      
      return {
        success: true,
        topologyAnalysis: topologyAnalysis,
        devicePortAnalysis: devicePortAnalysis,
        validatedConnections: validatedConnections,
        accuracy: this._calculateAnalysisAccuracy(devicePortAnalysis, validatedConnections)
      };
      
    } catch (error) {
      console.error(`❌ Multi-step image analysis failed:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Cross-validate connections between devices for accuracy
   */
  _crossValidateConnections(devicePortAnalysis) {
    const validatedConnections = [];
    
    for (const [deviceName, portInfo] of Object.entries(devicePortAnalysis)) {
      for (const connection of portInfo.connections) {
        // Check if the target device also reports this connection
        const targetDevice = connection.connectsTo;
        const targetPortInfo = devicePortAnalysis[targetDevice];
        
        if (targetPortInfo) {
          // Look for reciprocal connection
          const reciprocalConnection = targetPortInfo.connections.find(conn => 
            conn.connectsTo === deviceName && 
            conn.remotePort === connection.port &&
            conn.port === connection.remotePort
          );
          
          if (reciprocalConnection) {
            // Connection validated from both sides
            validatedConnections.push({
              device1: deviceName,
              port1: connection.port,
              device2: targetDevice,
              port2: connection.remotePort,
              validated: true
            });
          } else {
            // Connection only detected from one side
            validatedConnections.push({
              device1: deviceName,
              port1: connection.port,
              device2: targetDevice,
              port2: connection.remotePort,
              validated: false
            });
          }
        }
      }
    }
    
    // Remove duplicates
    const uniqueConnections = validatedConnections.filter((conn, index, arr) => 
      index === arr.findIndex(c => 
        (c.device1 === conn.device1 && c.device2 === conn.device2) ||
        (c.device1 === conn.device2 && c.device2 === conn.device1)
      )
    );
    
    console.log(`🔗 Connection validation: ${uniqueConnections.length} unique connections, ${uniqueConnections.filter(c => c.validated).length} fully validated`);
    
    return uniqueConnections;
  }

  /**
   * Calculate analysis accuracy metrics
   */
  _calculateAnalysisAccuracy(devicePortAnalysis, validatedConnections) {
    const totalDevices = Object.keys(devicePortAnalysis).length;
    const devicesWithPorts = Object.values(devicePortAnalysis).filter(p => p.ports.length > 0).length;
    const validatedConnectionsCount = validatedConnections.filter(c => c.validated).length;
    const totalConnectionsCount = validatedConnections.length;
    
    const deviceDetectionRate = totalDevices > 0 ? (devicesWithPorts / totalDevices) * 100 : 0;
    const connectionValidationRate = totalConnectionsCount > 0 ? (validatedConnectionsCount / totalConnectionsCount) * 100 : 0;
    
    return {
      deviceDetectionRate: Math.round(deviceDetectionRate),
      connectionValidationRate: Math.round(connectionValidationRate),
      overallAccuracy: Math.round((deviceDetectionRate + connectionValidationRate) / 2),
      metrics: {
        devicesAnalyzed: totalDevices,
        devicesWithPorts: devicesWithPorts,
        totalConnections: totalConnectionsCount,
        validatedConnections: validatedConnectionsCount
      }
    };
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
        service: "LLaVA Vision + Prompt Configuration Generator",
        host: this.host,
        model: this.visionModel,
        modelAvailable: !!currentModel,
        availableModels: models.map(m => m.name),
        timeout: this.timeout,
        specialization: "Image analysis + Prompt-based configuration generation",
        optimizations: {
          port_detection: this.portDetectionParams,
          config_generation: this.configGenerationParams,
          general_vision: this.visionParams
        },
        features: [
          "🔍 Network topology image analysis with LLaVA:7b",
          "🔌 Precise port and connection detection from images",
          "📋 Device identification and classification from diagrams", 
          "🌐 Visual IP addressing and VLAN detection",
          "⚙️ Image-based protocol recommendations",
          "🎯 Multimodal (image + text) configuration generation",
          "🔧 Cisco interface name standardization",
          "📝 Topology-aware configuration synthesis",
          "🚀 Direct image-to-config generation",
          "✅ Enhanced Cisco syntax validation for vision output"
        ]
      };
    } catch (error) {
      return {
        status: "disconnected",
        service: "LLaVA Vision + Prompt Configuration Generator",
        host: this.host,
        model: this.visionModel,
        modelAvailable: false,
        error: error.message
      };
    }
  }
}

export default new VisionLLMService();
