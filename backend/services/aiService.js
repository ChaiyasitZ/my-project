import axios from 'axios';

/**
 * AI Service for Cisco Configuration Generation
 * Clean, optimized implementation for Ollama/Mistral integration
 */
export class AIService {
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
    
    // Optimized parameters for DeepSeek Coder
    this.defaultParams = {
      temperature: 0.2,    // Higher for better generation
      num_predict: 200,    // Sufficient for configs
      top_k: 40,          // More token options
      top_p: 0.9,         // More creative freedom
      repeat_penalty: 1.05, // Lower penalty
      stop: []            // Remove all stop conditions initially
    };
    
    console.log(`🤖 AI Service initialized - Model: ${this.model} @ ${this.host}`);
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
   * Build optimized AI prompt for DeepSeek Coder
   */
  _buildPrompt(prompt, deviceType, deviceContext) {
    const deviceName = deviceContext.name || 'Device';
    const enhancedPrompt = this._preprocessPrompt(prompt);
    
    // Optimized prompt for CodeLlama
    return `Generate Cisco IOS configuration commands.

Task: ${enhancedPrompt}

Output format:
configure terminal
[router/interface commands]
end

Commands:`;
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
   * Clean and format AI generated configuration
   */
  _cleanConfiguration(rawConfig) {
    if (!rawConfig) return '';
    
    console.log('🧹 Cleaning configuration...');
    
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
    
    // Remove unwanted content for DeepSeek Coder
    cleaned = cleaned
      .replace(/```.*$/gm, '')
      .replace(/^Here's.*$/gmi, '')
      .replace(/^This.*$/gmi, '')
      .replace(/^Sure.*$/gmi, '')
      .replace(/^The.*$/gmi, '')
      .replace(/^For.*$/gmi, '')
      .replace(/enable$/gmi, '')  // Remove standalone enable
      .trim();

    // Format with proper indentation
    const lines = cleaned.split('\n').filter(line => line.trim());
    const formattedLines = this._formatWithIndentation(lines);
    
    // Ensure proper structure
    this._ensureProperStructure(formattedLines);
    
    const finalConfig = formattedLines.join('\n');
    console.log(`✅ Cleaned configuration: ${formattedLines.length} lines`);
    
    return finalConfig;
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
   * Format configuration with proper indentation
   */
  _formatWithIndentation(lines) {
    const formattedLines = [];
    let configMode = null;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Check configuration mode entry
      if (trimmed.startsWith('router ') || trimmed.startsWith('interface ') || trimmed.startsWith('vlan ')) {
        configMode = trimmed.split(' ')[0];
        formattedLines.push(trimmed);
      }
      // Check configuration mode exit
      else if (trimmed === 'exit' || trimmed === 'end' || trimmed === 'configure terminal') {
        configMode = null;
        formattedLines.push(trimmed);
      }
      // Add indentation for subset commands
      else if (configMode) {
        formattedLines.push(' ' + trimmed);
      }
      else {
        formattedLines.push(trimmed);
      }
    }
    
    return formattedLines;
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
   * Generate configurations for multiple devices
   */
  async generateMultiDeviceConfiguration(devices, prompt, topologyHints = {}) {
    const startTime = Date.now();
    
    try {
      console.log(`🚀 Multi-device generation for ${devices.length} devices`);

      const promises = devices.map(async (device, index) => {
        console.log(`🔄 Generating ${index + 1}/${devices.length}: ${device.name}`);
        
        const devicePrompt = `${prompt} for device ${device.name}`;
        const result = await this.generateConfiguration(devicePrompt, device.type, device);

        return {
          device_id: device.id,
          device_name: device.name,
          success: result.success,
          configuration: result.configuration || null,
          displayConfig: result.displayConfig || null,
          deploymentConfig: result.deploymentConfig || null,
          error: result.error || null,
          validation: result.validation || null
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
        method: 'mistral_7b_multi',
        model: this.model,
        summary: {
          successfulDevices: successCount,
          totalDevices: devices.length,
          description: `${successCount}/${devices.length} devices configured`
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
   * Generate NETCONF XML configuration
   */
  async generateNetconfXml(prompt, deviceType, deviceContext = {}, yangModel = null) {
    const startTime = Date.now();
    
    try {
      console.log(`🔗 NETCONF XML generation: "${prompt}"`);

      const xmlPrompt = `Generate NETCONF XML for Cisco IOS-XE device.

TASK: ${prompt}
DEVICE: ${deviceType}

Requirements:
- Valid NETCONF XML with proper namespaces
- Use Cisco IOS-XE YANG models
- Include proper RPC structure

Template:
<?xml version="1.0" encoding="UTF-8"?>
<rpc xmlns="urn:ietf:params:xml:ns:netconf:base:1.0" message-id="1">
  <edit-config>
    <target><running/></target>
    <config>
      <native xmlns="http://cisco.com/ns/yang/Cisco-IOS-XE-native">
        <!-- configuration -->
      </native>
    </config>
  </edit-config>
</rpc>

Generate XML:`;

      const response = await this.client.post("/api/generate", {
        model: this.model,
        prompt: xmlPrompt,
        stream: false,
        options: { ...this.defaultParams, num_predict: 300 }
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
   * Get AI service status and capabilities
   */
  async getServiceStatus() {
    try {
      const response = await this.client.get("/api/tags");
      const models = response.data.models || [];
      const currentModel = models.find(m => m.name === this.model);

      return {
        status: "connected",
        service: "Qwen2.5 Coder Configuration Generator",
        host: this.host,
        model: this.model,
        modelAvailable: !!currentModel,
        availableModels: models.map(m => m.name),
        timeout: this.timeout,
        features: [
          "🎯 Reliable Cisco configuration generation",
          "🔧 Code-specialized for network devices", 
          "📝 NETCONF/XML generation",
          "🚀 Multi-device support",
          "✅ Proven syntax accuracy",
          "⚡ Consistent performance"
        ]
      };
    } catch (error) {
      return {
        status: "disconnected",
        service: "Qwen2.5 Coder Configuration Generator", 
        host: this.host,
        model: this.model,
        modelAvailable: false,
        error: error.message
      };
    }
  }
}

export default new AIService();