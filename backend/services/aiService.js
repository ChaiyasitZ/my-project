import axios from 'axios';

/**
 * AI Service for Cisco Configuration Generation
 * Optimized for Mistral 7B model with clean, simple approach
 */
export class AIService {
  constructor() {
    this.host = process.env.OLLAMA_HOST || 'http://localhost:11434';
    this.model = process.env.OLLAMA_MODEL || 'mistral:7b';
    this.timeout = 60000;
    
    this.client = axios.create({
      baseURL: this.host,
      timeout: this.timeout,
    });
    
    // Simple, reliable parameters for Mistral 7B
    this.defaultParams = {
      temperature: 0.1,
      num_predict: 400,
      top_k: 10,
      top_p: 0.7,
      repeat_penalty: 1.1,
      stop: []
    };
    
    console.log(`🤖 AI Service initialized - Model: ${this.model}`);
  }

  /**
   * Generate Cisco configuration
   */
  async generateConfiguration(prompt, deviceType, deviceContext = {}) {
    const startTime = Date.now();
    
    try {
      console.log(`🚀 Generating config for ${deviceType}: "${prompt}"`);

      // Build simple, focused prompt
      const aiPrompt = this.buildPrompt(prompt, deviceType, deviceContext);
      
      // Generate configuration
      const response = await this.client.post("/api/generate", {
        model: this.model,
        prompt: aiPrompt,
        stream: false,
        options: this.defaultParams
      });

      let configuration = response.data.response?.trim() || '';
      console.log(`📦 Response length: ${configuration.length} chars`);
      
      if (!configuration) {
        throw new Error('Empty response from AI model');
      }
        
      // Clean the configuration
      configuration = this.cleanConfiguration(configuration);
      
      // Create deployment version (no comments, pure CLI)
      const deploymentConfig = this.createDeploymentVersion(configuration);
      
      // Basic validation
      const validation = this.validateConfiguration(configuration, deviceType);
      
      if (configuration.length > 20 && validation.isValid) {
        const executionTime = Date.now() - startTime;
        console.log(`✅ Generation completed (${executionTime}ms) - Quality: ${validation.score}%`);
          
        return {
          success: true,
          configuration: deploymentConfig, // Clean version for output panel display
          displayConfig: configuration, // Version with comments for validation explanations
          deploymentConfig, // Same clean version for device deployment
          model: this.model,
          deviceType,
          method: 'mistral_7b',
          executionTime,
          validation,
          confidenceScore: validation.score
        };
      } else {
        const issues = validation.errors.join(', ') || 'insufficient content';
        throw new Error(`Configuration validation failed: ${issues}`);
      }
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error("❌ Configuration generation failed:", error.message);
      
      return {
        success: false,
        error: `Configuration generation failed: ${error.message}`,
        configuration: null,
        executionTime
      };
    }
  }

  /**
   * Build AI prompt for configuration generation
   */
  buildPrompt(prompt, deviceType, deviceContext) {
    const deviceName = deviceContext.name || 'Device';
    
    // Clean and enhance the prompt for better parsing
    let enhancedPrompt = this.preprocessPrompt(prompt);
    
    // Add CIDR guidance if needed
    if (enhancedPrompt.includes('/')) {
      enhancedPrompt = this.addCidrGuidance(enhancedPrompt);
    }
    
    return `Generate Cisco IOS configuration for ${deviceName}. Output only CLI commands.

TASK: ${enhancedPrompt}

REQUIREMENTS:
- Start with "configure terminal"
- End with "end" 
- Use correct wildcard masks for OSPF networks
- For multiple networks, create separate network statements
- Output only executable commands

WILDCARD MASKS:
/24 = 0.0.0.255, /25 = 0.0.0.127, /26 = 0.0.0.63, /27 = 0.0.0.31, /30 = 0.0.0.3

Generate configuration:`;
  }

  /**
   * Preprocess prompt to handle multiple networks and improve parsing
   */
  preprocessPrompt(prompt) {
    // Handle multiple network patterns with dashes or "and"
    let enhanced = prompt;
    
    // Replace "- network" patterns with "and network"
    enhanced = enhanced.replace(/\s*-\s*(\d+\.\d+\.\d+\.\d+\/\d+)\s+area\s+(\d+)/g, ' and network $1 area $2');
    
    // Replace "- ip" patterns with "and network" 
    enhanced = enhanced.replace(/\s*-\s*(\d+\.\d+\.\d+\.\d+\/\d+)/g, ' and network $1');
    
    // Ensure clear separation of network statements
    enhanced = enhanced.replace(/(\d+\.\d+\.\d+\.\d+\/\d+)\s+area\s+(\d+)\s+(\d+\.\d+\.\d+\.\d+\/\d+)/g, '$1 area $2 and network $3');
    
    console.log(`🔄 Preprocessed prompt: "${enhanced}"`);
    return enhanced;
  }

  /**
   * Add CIDR to wildcard guidance
   */
  addCidrGuidance(prompt) {
    const mappings = {
      '/24': '/24 (wildcard 0.0.0.255)',
      '/25': '/25 (wildcard 0.0.0.127)',
      '/26': '/26 (wildcard 0.0.0.63)', 
      '/27': '/27 (wildcard 0.0.0.31)',
      '/28': '/28 (wildcard 0.0.0.15)',
      '/30': '/30 (wildcard 0.0.0.3)'
    };
    
    let enhanced = prompt;
    for (const [cidr, replacement] of Object.entries(mappings)) {
      if (enhanced.includes(cidr)) {
        enhanced = enhanced.replace(new RegExp(cidr, 'g'), replacement);
        console.log(`🔄 Added wildcard guidance for ${cidr}`);
      }
    }
    
    return enhanced;
  }

  /**
   * Clean AI generated configuration and format with proper indentation
   */
  cleanConfiguration(rawConfig) {
    if (!rawConfig) return '';
    
    console.log('🧹 Cleaning configuration...');
    
    let cleaned = rawConfig;
    
    // Extract from code blocks if present
    const codeBlockMatch = rawConfig.match(/```[\s\S]*?```/);
    if (codeBlockMatch) {
      const blockContent = codeBlockMatch[0].replace(/```\w*\n?/g, '').replace(/```/g, '').trim();
      if (blockContent.includes('configure terminal') || blockContent.includes('router')) {
        console.log('📦 Extracting from code block...');
        cleaned = blockContent;
      }
    }
    
    // Basic cleaning
    cleaned = cleaned
      .replace(/```.*$/gm, '') // Remove any remaining code markers
      .replace(/^Here's.*$/gmi, '') // Remove explanation headers
      .replace(/^This.*$/gmi, '') // Remove AI explanations
      .trim();

    // Process lines and add proper indentation
    const lines = cleaned.split('\n').filter(line => line.trim());
    const formattedLines = this.formatConfigWithIndentation(lines);
    
    // Ensure proper structure
    if (formattedLines.length > 0 && !formattedLines[0].includes('configure terminal')) {
      formattedLines.unshift('configure terminal');
    }
    
    if (formattedLines.length > 0 && !formattedLines[formattedLines.length - 1].includes('end')) {
      formattedLines.push('end');
    }
    
    const finalConfig = formattedLines.join('\n');
    console.log(`✅ Cleaned and formatted config: ${formattedLines.length} lines`);
    
    return finalConfig;
  }

  /**
   * Create deployment version - remove comments but keep indentation
   */
  createDeploymentVersion(configuration) {
    if (!configuration) return '';
    
    const lines = configuration.split('\n');
    const deploymentLines = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip comment lines (starting with !)
      if (trimmed.startsWith('!')) {
        continue;
      }
      
      // Keep all other lines including indented commands
      if (trimmed.length > 0) {
        deploymentLines.push(line);
      }
    }
    
    const deploymentConfig = deploymentLines.join('\n');
    console.log(`🚀 Created deployment version: ${deploymentLines.length} lines (removed comments)`);
    
    return deploymentConfig;
  }

  /**
   * Format configuration with proper indentation for subset commands
   */
  formatConfigWithIndentation(lines) {
    const formattedLines = [];
    let inRouterConfig = false;
    let inInterfaceConfig = false;
    let inVlanConfig = false;
    
    for (let line of lines) {
      const trimmedLine = line.trim();
      
      // Check if entering a configuration mode
      if (trimmedLine.startsWith('router ')) {
        inRouterConfig = true;
        inInterfaceConfig = false;
        inVlanConfig = false;
        formattedLines.push(trimmedLine);
      }
      else if (trimmedLine.startsWith('interface ')) {
        inInterfaceConfig = true;
        inRouterConfig = false;
        inVlanConfig = false;
        formattedLines.push(trimmedLine);
      }
      else if (trimmedLine.startsWith('vlan ')) {
        inVlanConfig = true;
        inRouterConfig = false;
        inInterfaceConfig = false;
        formattedLines.push(trimmedLine);
      }
      // Check if exiting configuration mode
      else if (trimmedLine === 'exit' || trimmedLine === 'end' || trimmedLine === 'configure terminal') {
        inRouterConfig = false;
        inInterfaceConfig = false;
        inVlanConfig = false;
        formattedLines.push(trimmedLine);
      }
      // Add indentation for subset commands
      else if (inRouterConfig || inInterfaceConfig || inVlanConfig) {
        // Add one space for indentation (tab equivalent)
        formattedLines.push(' ' + trimmedLine);
      }
      else {
        formattedLines.push(trimmedLine);
      }
    }
    
    return formattedLines;
  }

  /**
   * Validate generated configuration with explanations
   */
  validateConfiguration(configuration, deviceType) {
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

    // Analyze configuration components and add explanations
    this.analyzeConfigurationComponents(configuration, validation);

    // Check basic structure
    if (!configuration.includes('configure terminal')) {
      validation.warnings.push('Missing configure terminal command');
      validation.score -= 10;
    } else {
      validation.explanation.push('✓ Starts with configure terminal - enters global configuration mode');
    }

    if (!configuration.includes('end')) {
      validation.warnings.push('Missing end command');
      validation.score -= 10;
    } else {
      validation.explanation.push('✓ Ends with end command - exits configuration mode');
    }

    // Router-specific validation
    if (deviceType === 'router') {
      const hasRoutingProtocol = /router\s+(ospf|eigrp|bgp|rip)/.test(configuration);
      if (!hasRoutingProtocol) {
        validation.warnings.push('No routing protocol configured');
        validation.score -= 20;
      }
    }

    validation.score = Math.max(0, validation.score);
    if (validation.score < 50) {
      validation.isValid = false;
    }

    return validation;
  }

  /**
   * Analyze configuration components and add simple explanations
   */
  analyzeConfigurationComponents(configuration, validation) {
    const lines = configuration.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // OSPF Analysis
      if (trimmed.match(/^router ospf (\d+)/)) {
        const processId = trimmed.match(/router ospf (\d+)/)[1];
        validation.explanation.push(`✓ OSPF routing protocol enabled with process ID ${processId}`);
      }
      
      if (trimmed.match(/^\s*network ([\d.]+) ([\d.]+) area (\d+)/)) {
        const match = trimmed.match(/^\s*network ([\d.]+) ([\d.]+) area (\d+)/);
        const network = match[1];
        const wildcard = match[2];
        const area = match[3];
        validation.explanation.push(`✓ Network ${network} (wildcard ${wildcard}) advertised in OSPF area ${area}`);
      }
      
      if (trimmed.match(/^\s*router-id ([\d.]+)/)) {
        const routerId = trimmed.match(/^\s*router-id ([\d.]+)/)[1];
        validation.explanation.push(`✓ Router ID set to ${routerId} for OSPF identification`);
      }
      
      // Interface Analysis
      if (trimmed.match(/^interface (.+)/)) {
        const interfaceName = trimmed.match(/^interface (.+)/)[1];
        validation.explanation.push(`✓ Configuring interface ${interfaceName}`);
      }
      
      if (trimmed.match(/^\s*ip address ([\d.]+) ([\d.]+)/)) {
        const match = trimmed.match(/^\s*ip address ([\d.]+) ([\d.]+)/);
        const ip = match[1];
        const mask = match[2];
        validation.explanation.push(`✓ IP address ${ip} with subnet mask ${mask} assigned to interface`);
      }
      
      if (trimmed.match(/^\s*no shutdown/)) {
        validation.explanation.push(`✓ Interface enabled (no shutdown command)`);
      }
      
      // BGP Analysis
      if (trimmed.match(/^router bgp (\d+)/)) {
        const asn = trimmed.match(/router bgp (\d+)/)[1];
        validation.explanation.push(`✓ BGP routing protocol enabled with AS number ${asn}`);
      }
      
      if (trimmed.match(/^\s*neighbor ([\d.]+) remote-as (\d+)/)) {
        const match = trimmed.match(/^\s*neighbor ([\d.]+) remote-as (\d+)/);
        const neighbor = match[1];
        const remoteAs = match[2];
        validation.explanation.push(`✓ BGP neighbor ${neighbor} configured in AS ${remoteAs}`);
      }
      
      // VLAN Analysis
      if (trimmed.match(/^vlan (\d+)/)) {
        const vlanId = trimmed.match(/vlan (\d+)/)[1];
        validation.explanation.push(`✓ VLAN ${vlanId} created`);
      }
      
      if (trimmed.match(/^\s*name (.+)/)) {
        const vlanName = trimmed.match(/^\s*name (.+)/)[1];
        validation.explanation.push(`✓ VLAN named "${vlanName}"`);
      }
      
      if (trimmed.match(/^\s*switchport access vlan (\d+)/)) {
        const vlanId = trimmed.match(/^\s*switchport access vlan (\d+)/)[1];
        validation.explanation.push(`✓ Interface assigned to access VLAN ${vlanId}`);
      }
    }
    
    // Add summary if no specific components found
    if (validation.explanation.length === 0) {
      validation.explanation.push('✓ Basic Cisco IOS configuration structure detected');
    }
  }

  /**
   * Multi-device configuration generation
   */
  async generateMultiDeviceConfiguration(devices, prompt, topologyHints = {}) {
    const startTime = Date.now();
    
    try {
      console.log(`🚀 Multi-device generation for ${devices.length} devices: "${prompt}"`);

      const promises = devices.map(async (device, index) => {
        console.log(`🔄 Generating config ${index + 1}/${devices.length} for ${device.name}`);

        const devicePrompt = `${prompt} for device ${device.name}`;
        const deviceResult = await this.generateConfiguration(devicePrompt, device.type, device);

        return {
          device_id: device.id,
          device_name: device.name,
          success: deviceResult.success,
          configuration: deviceResult.configuration || null, // Clean version for display
          displayConfig: deviceResult.displayConfig || null, // Version with comments
          deploymentConfig: deviceResult.deploymentConfig || null,
          error: deviceResult.error || null,
          validation: deviceResult.validation || null
        };
      });

      const results = await Promise.all(promises);
      const successCount = results.filter(r => r.success).length;
      const executionTime = Date.now() - startTime;

      console.log(`✅ Multi-device completed: ${successCount}/${devices.length} successful (${executionTime}ms)`);

      return {
        success: successCount > 0,
        results,
        executionTime,
        method: 'mistral_7b_multi',
        model: this.model,
        summary: {
          successfulDevices: successCount,
          totalDevices: devices.length,
          description: `${successCount}/${devices.length} devices configured successfully`
        }
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error("❌ Multi-device generation error:", error.message);
      
      return {
        success: false,
        error: `Multi-device generation failed: ${error.message}`,
        results: [],
        executionTime,
        method: 'mistral_7b_multi',
        model: this.model,
        summary: {
          successfulDevices: 0,
          totalDevices: devices.length,
          description: `0/${devices.length} devices configured - error occurred`
        }
      };
    }
  }

  /**
   * Generate NETCONF XML
   */
  async generateNetconfXml(prompt, deviceType, deviceContext = {}, yangModel = null) {
    const startTime = Date.now();
    
    try {
      console.log(`🔗 NETCONF XML generation for ${deviceType}: "${prompt}"`);

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

      const xmlConfiguration = response.data.response?.trim() || '';
          
      if (xmlConfiguration && xmlConfiguration.includes('<')) {
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
      }
      
      throw new Error('Failed to generate valid NETCONF XML');
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error("❌ NETCONF XML generation error:", error.message);
      
      return {
        success: false,
        error: `NETCONF XML generation failed: ${error.message}`,
        configuration: null,
        executionTime
      };
    }
  }

  /**
   * Explain configuration
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
        error: error.message,
      };
    }
  }

  /**
   * Get service status
   */
  async getServiceStatus() {
    try {
      const response = await this.client.get("/api/tags");
      const models = response.data.models || [];
      const currentModel = models.find((m) => m.name === this.model);

      return {
        status: "connected",
        service: "Mistral 7B Configuration Generator",
        host: this.host,
        model: this.model,
        modelAvailable: !!currentModel,
        availableModels: models.map((m) => m.name),
        timeout: this.timeout,
        features: [
          "🎯 Clean configuration generation",
          "🔧 Optimized for Cisco devices", 
          "📝 NETCONF/XML generation",
          "🚀 Multi-device support",
          "✅ Reliable validation"
        ]
      };
    } catch (error) {
      return {
        status: "disconnected",
        service: "Mistral 7B Configuration Generator", 
        host: this.host,
        model: this.model,
        modelAvailable: false,
        error: error.message
      };
    }
  }
}

export default new AIService();