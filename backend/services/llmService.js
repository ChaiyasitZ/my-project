import axios from 'axios';

/**
 * Clean LLM Service for Cisco Configuration Generation
 * Simple and focused text prompt processing
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
    
    // Simple parameters for reliable generation
    this.defaultParams = {
      temperature: 0.3,
      num_predict: 300,
      top_k: 40,
      top_p: 0.9,
      repeat_penalty: 1.1
    };
    
    console.log(`🤖 Clean LLM Service initialized - Model: ${this.model} @ ${this.host}`);
  }

  /**
   * Generate Cisco configuration from text prompt
   */
  async generateConfiguration(prompt, deviceType, deviceContext = {}) {
    const startTime = Date.now();
    
    try {
      console.log(`🚀 Generating config for ${deviceType}: "${prompt}"`);

      // Build simple, clean prompt
      const aiPrompt = this._buildPrompt(prompt, deviceType, deviceContext);
      
      console.log(`📝 Prompt length: ${aiPrompt.length} characters`);
      
      // Call Ollama API
      const response = await this.client.post("/api/generate", {
        model: this.model,
        prompt: aiPrompt,
        stream: false,
        options: this.defaultParams
      });

      const rawConfig = response.data.response?.trim();
      if (!rawConfig) {
        console.error(`❌ Empty response received from ${this.model}`);
        throw new Error(`Empty response from ${this.model}`);
      }
      
      console.log(`📦 Raw response: ${rawConfig.length} chars`);
      
      // Clean and validate configuration
      const cleanConfig = this._cleanConfiguration(rawConfig);
      const deploymentConfig = this._createDeploymentVersion(cleanConfig);
      const validation = this._validateConfiguration(cleanConfig, deviceType);
      
      const executionTime = Date.now() - startTime;
      console.log(`✅ Generated successfully (${executionTime}ms)`);
      
      return {
        success: true,
        configuration: deploymentConfig,
        displayConfig: cleanConfig,
        deploymentConfig,
        model: this.model,
        deviceType,
        method: 'clean_text',
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
   * Build prompt for raw device commands
   */
  _buildPrompt(prompt, deviceType, deviceContext) {
    const deviceName = deviceContext.name || 'Device';
    
    // Pre-process CIDR notation in the prompt
    const processedPrompt = this._preprocessCIDR(prompt);
    
    return `Generate only the raw Cisco IOS commands to send to the device. No configure terminal, no end, just the commands.

Device: ${deviceName} (${deviceType})
Request: ${processedPrompt}

IMPORTANT: Use wildcard masks for OSPF network commands, not subnet masks.

Commands:`;
  }

  /**
   * Pre-process CIDR notation to include wildcard mask hints
   */
  _preprocessCIDR(prompt) {
    // CIDR to wildcard mask conversion
    const cidrToWildcard = {
      '/8': '0.255.255.255',
      '/9': '0.127.255.255',
      '/10': '0.63.255.255',
      '/11': '0.31.255.255',
      '/12': '0.15.255.255',
      '/13': '0.7.255.255',
      '/14': '0.3.255.255',
      '/15': '0.1.255.255',
      '/16': '0.0.255.255', 
      '/17': '0.0.127.255',
      '/18': '0.0.63.255',
      '/19': '0.0.31.255',
      '/20': '0.0.15.255',
      '/21': '0.0.7.255',
      '/22': '0.0.3.255',
      '/23': '0.0.1.255',
      '/24': '0.0.0.255',
      '/25': '0.0.0.127',
      '/26': '0.0.0.63',
      '/27': '0.0.0.31',
      '/28': '0.0.0.15',
      '/29': '0.0.0.7',
      '/30': '0.0.0.3',
      '/31': '0.0.0.1',
      '/32': '0.0.0.0',
    };
    
    let processed = prompt;
    
    // Replace CIDR notation with network and wildcard mask
    for (const [cidr, wildcard] of Object.entries(cidrToWildcard)) {
      const cidrPattern = new RegExp(`(\\d+\\.\\d+\\.\\d+\\.\\d+)${cidr.replace('/', '\\/')}`, 'g');
      processed = processed.replace(cidrPattern, `$1 wildcard ${wildcard}`);
    }
    
    return processed;
  }

  /**
   * Clean configuration output for raw device commands
   */
  _cleanConfiguration(rawConfig) {
    if (!rawConfig) return '';
    
    let cleaned = rawConfig;
    
    // Remove unwanted content
    cleaned = cleaned
      .replace(/```.*$/gm, '')
      .replace(/^Here's.*$/gmi, '')
      .replace(/^This.*$/gmi, '')
      .replace(/^Sure.*$/gmi, '')
      .replace(/^Commands:.*$/gmi, '')
      .trim();

    // Get only the raw command lines
    const lines = cleaned.split('\n')
      .map(line => line.trim())
      .filter(line => {
        // Filter out unwanted lines
        return line && 
               line !== 'configure terminal' && 
               line !== 'end' && 
               line !== 'exit' &&
               !line.includes('Here are') &&
               !line.includes('Commands:');
      });
    
    // Format with proper indentation for device commands
    const formattedLines = [];
    let inConfigMode = false;
    
    for (const line of lines) {
      // Check if entering a config mode
      if (line.startsWith('router ') || line.startsWith('interface ') || 
          line.startsWith('vlan ') || line.startsWith('line ')) {
        formattedLines.push(line);
        inConfigMode = true;
      } 
      // Sub-commands get indented
      else if (inConfigMode && !line.startsWith('!')) {
        formattedLines.push(' ' + line);
      }
      // Global commands
      else {
        formattedLines.push(line);
        inConfigMode = false;
      }
    }
    
    return formattedLines.join('\n');
  }

  /**
   * Create deployment version (no comments)
   */
  _createDeploymentVersion(configuration) {
    if (!configuration) return '';
    
    const deploymentLines = configuration
      .split('\n')
      .filter(line => {
        const trimmed = line.trim();
        return trimmed.length > 0 && !trimmed.startsWith('!');
      });
    
    return deploymentLines.join('\n');
  }

  /**
   * Basic validation for raw device commands
   */
  _validateConfiguration(configuration, deviceType) {
    const validation = {
      isValid: true,
      score: 100,
      errors: [],
      warnings: [],
      explanation: []
    };

    if (!configuration || configuration.length < 5) {
      validation.isValid = false;
      validation.score = 0;
      validation.errors.push('Configuration too short');
      return validation;
    }

    // Check for valid Cisco commands
    const lines = configuration.split('\n');
    let hasValidCommands = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('router ') || trimmed.startsWith('interface ') ||
          trimmed.startsWith('vlan ') || trimmed.startsWith('ip ') ||
          trimmed.startsWith('network ') || trimmed.startsWith('switchport ')) {
        hasValidCommands = true;
        break;
      }
    }
    
    if (!hasValidCommands) {
      validation.warnings.push('No recognizable Cisco commands found');
      validation.score -= 20;
    }

    validation.explanation.push('✓ Raw device commands generated');
    return validation;
  }

  /**
   * Get service status
   */
  async getServiceStatus() {
    try {
      const response = await this.client.get("/api/tags");
      const models = response.data.models || [];
      const currentModel = models.find(m => m.name === this.model);

      return {
        status: "connected",
        service: "Clean LLM Text Generation",
        host: this.host,
        model: this.model,
        modelAvailable: !!currentModel,
        availableModels: models.map(m => m.name),
        features: [
          "🎯 Simple text-based configuration generation",
          "🧹 Clean output formatting",
          "⚡ Fast and reliable",
          "✅ Basic validation"
        ]
      };
    } catch (error) {
      return {
        status: "disconnected",
        service: "Clean LLM Text Generation",
        host: this.host,
        model: this.model,
        modelAvailable: false,
        error: error.message
      };
    }
  }

  /**
   * Explain configuration
   */
  async explainConfiguration(configuration) {
    try {
      const prompt = `Explain this Cisco configuration:

${configuration.substring(0, 400)}

Brief explanation:`;

      const response = await this.client.post("/api/generate", {
        model: this.model,
        prompt: prompt,
        stream: false,
        options: { temperature: 0.3, num_predict: 150 }
      });

      return {
        success: true,
        explanation: response.data.response?.trim() || "No explanation generated",
        model: this.model,
        method: 'clean_explain'
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
   * Multi-device configuration generation
   */
  async generateMultiDeviceConfiguration(devices, prompt, topologyHints = {}) {
    const startTime = Date.now();
    
    try {
      console.log(`🚀 Multi-device generation for ${devices.length} devices`);
      
      const promises = devices.map(async (device, index) => {
        console.log(`🔄 Generating ${index + 1}/${devices.length}: ${device.name}`);
        
        const devicePrompt = `${prompt} for device ${device.name}`;
        const result = await this.generateConfiguration(devicePrompt, device.type, {
          name: device.name,
          model: device.model,
          ios_version: device.ios_version,
          location: device.location
        });

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
        method: 'clean_multi',
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
        method: 'clean_multi',
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
   * NETCONF XML generation
   */
  async generateNetconfXml(prompt, deviceType, deviceContext = {}, yangModel = null) {
    const startTime = Date.now();
    
    try {
      console.log(`🔗 NETCONF XML generation: "${prompt}"`);

      const xmlPrompt = `Generate NETCONF XML configuration for Cisco device:

Request: ${prompt}
Device: ${deviceContext.name || 'Device'} (${deviceType})
YANG Model: ${yangModel?.name || 'Cisco-IOS-XE-native'}

Generate valid NETCONF XML:

<?xml version="1.0" encoding="UTF-8"?>`;

      const response = await this.client.post("/api/generate", {
        model: this.model,
        prompt: xmlPrompt,
        stream: false,
        options: { temperature: 0.2, num_predict: 400 }
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
        method: 'clean_netconf',
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
}

export default new LLMService();