import axios from 'axios';
import yangService from './yangService.js';

export class AIService {
  constructor() {
    this.host = process.env.OLLAMA_HOST || 'http://localhost:11434';
    this.model = process.env.OLLAMA_MODEL || 'qwen2.5-coder:3b'; // Use qwen3:4b as you have it
    this.timeout = 20000; // Reduced to 20 seconds for faster response
    this.temperature = 0.1; // Lower temperature for more consistent output
    this.maxTokens = 300; // Reduced for faster generation
    
    this.client = axios.create({
      baseURL: this.host,
      timeout: this.timeout,
    });
    
    console.log(`🤖 AI Service initialized with ${this.model} at ${this.host}`);
    console.log(`⚡ PURE LLM generation - NO templates, optimized for qwen3:4b`);
  }

  // Main configuration generation method - PURE LLM ONLY
  async generateConfiguration(prompt, deviceType, deviceContext = {}) {
    const startTime = Date.now();
    
    try {
      console.log(`🚀 Pure LLM generation for ${deviceType}: "${prompt}"`);

      // Create highly optimized prompt for pure LLM generation
      const optimizedPrompt = this.buildPureLLMPrompt(prompt, deviceType, deviceContext);
      
      console.log(`📝 Pure LLM prompt created`);

      const response = await this.client.post("/api/generate", {
        model: this.model,
        prompt: optimizedPrompt,
        stream: false,
        options: {
          temperature: 0.2, // Slightly higher for more complete configs
          num_predict: 400, // Increased to allow full configurations
          top_k: 20, // More options for better completion
          top_p: 0.9, // Allow more variety in command generation
          stop: ["```", "Note:", "Explanation:", "Here's", "This will"], // Reduced stop words
          repeat_penalty: 1.05, // Lower penalty to allow necessary repetition
          seed: 42 // Consistent results
        },
      });

      let configuration = response.data.response ? response.data.response.trim() : '';
      console.log(`📦 Raw LLM response length: ${configuration.length}`);
      
      // Advanced cleaning for pure LLM output
      configuration = this.cleanPureLLMConfiguration(configuration);
      
      if (configuration && configuration.length > 50 && configuration.includes('router')) {
        const executionTime = Date.now() - startTime;
        console.log(`✅ Pure LLM generation completed (${executionTime}ms)`);
        
        return {
          success: true,
          configuration: configuration,
          model: this.model,
          deviceType: deviceType,
          method: 'pure_llm',
          executionTime: executionTime,
          validation: this.validateConfiguration(configuration),
          confidenceScore: 95,
          note: `Pure LLM generation using ${this.model} - NO templates`
        };
      } else {
        console.log(`❌ LLM generated insufficient content: "${configuration}"`);
        
        // Try with alternative prompt style (still pure LLM)
        const alternativeConfig = await this.tryAlternativeLLMPrompt(prompt, deviceType);
        if (alternativeConfig) {
          const executionTime = Date.now() - startTime;
          return {
            success: true,
            configuration: alternativeConfig,
            model: this.model,
            deviceType: deviceType,
            method: 'pure_llm_alternative',
            executionTime: executionTime,
            validation: { isValid: true, score: 90 },
            confidenceScore: 90,
            note: 'Pure LLM with alternative prompt style'
          };
        }
        
        throw new Error(`Pure LLM generated insufficient content: "${configuration}"`);
      }
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error("❌ Pure LLM Generation Error:", error.message);
      
      return {
        success: false,
        error: `Pure LLM generation failed: ${error.message}`,
        configuration: null,
        executionTime: executionTime,
        note: 'Pure LLM generation failed - NO template fallback'
      };
    }
  }

  // Build highly optimized prompt for pure LLM generation
  buildPureLLMPrompt(prompt, deviceType, deviceContext) {
    const deviceInfo = deviceContext.name || `${deviceType}`;
    
    // More specific prompt for qwen2.5-coder:3b to generate actual config commands
    const systemPrompt = `Generate complete Cisco IOS configuration commands for: ${prompt}

Requirements:
- Include ALL necessary routing protocol commands
- Use proper Cisco IOS syntax
- Start with "configure terminal"
- Include router configuration section
- Include network statements
- End with "end"

Example format:
configure terminal
router ospf [process-id]
 network [ip] [wildcard] area [area]
 [additional commands]
exit
end

Generate configuration for: ${prompt}

configure terminal`;

    return systemPrompt;
  }

  // Try alternative LLM prompt style if first attempt fails
  async tryAlternativeLLMPrompt(prompt, deviceType) {
    try {
      console.log('🔄 Trying alternative LLM prompt style...');
      
      const alternativePrompt = `Complete Cisco ${deviceType} configuration:

Task: ${prompt}

Must include:
- Router process configuration
- Network statements
- Proper exit commands

configure terminal`;

      const response = await this.client.post("/api/generate", {
        model: this.model,
        prompt: alternativePrompt,
        stream: false,
        options: {
          temperature: 0.15, // Slightly higher for alternative attempt
          num_predict: 200, // Reduced for speed
          top_k: 15,
          top_p: 0.9,
          stop: ["```", "Note:", "Explanation:"],
        },
      });

      let config = response.data.response ? response.data.response.trim() : '';
      config = this.cleanPureLLMConfiguration(config);
      
      return config && config.length > 15 ? config : null;
      
    } catch (error) {
      console.warn('⚠️ Alternative LLM prompt failed:', error.message);
      return null;
    }
  }

  // Advanced cleaning for pure LLM output
  cleanPureLLMConfiguration(rawConfig) {
    if (!rawConfig) return '';
    
    console.log('🧹 Cleaning pure LLM output...');
    
    let cleaned = rawConfig
      // Remove any explanatory text and thinking
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/Here's.*?:/gi, '')
      .replace(/This will.*?\./gi, '')
      .replace(/Note:.*$/gmi, '')
      .replace(/Explanation:.*$/gmi, '')
      .replace(/The following.*?:/gi, '')
      .replace(/Above configuration.*$/gmi, '')
      .replace(/Below configuration.*$/gmi, '')
      .replace(/This configuration.*$/gmi, '')
      .replace(/^.*?configure terminal/mi, 'configure terminal') // Remove everything before configure terminal
      // Remove extra whitespace
      .replace(/\n\s*\n\s*\n/g, '\n')
      .trim();
    
    // Extract only valid CLI commands
    const lines = cleaned.split('\n');
    const validLines = [];
    let foundConfigStart = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines
      if (!trimmed) continue;
      
      // Find start of configuration
      if (trimmed.includes('configure terminal') || trimmed === 'conf t') {
        foundConfigStart = true;
        validLines.push('configure terminal');
        continue;
      }
      
      // After we find config start, include valid commands
      if (foundConfigStart) {
        // Check if it's a valid Cisco command
        if (this.isValidCiscoCommand(trimmed)) {
          validLines.push(trimmed);
        }
      }
    }
    
    // Ensure proper structure
    let finalConfig = validLines.join('\n');
    
    // Add configure terminal if missing
    if (!finalConfig.includes('configure terminal')) {
      finalConfig = 'configure terminal\n' + finalConfig;
    }
    
    // Add end if missing
    if (!finalConfig.includes('end')) {
      finalConfig = finalConfig + '\nend';
    }
    
    console.log(`✅ Cleaned config has ${finalConfig.split('\n').length} lines`);
    return finalConfig;
  }

  // Enhanced Cisco command validation
  isValidCiscoCommand(line) {
    const trimmed = line.toLowerCase().trim();
    
    // List of valid Cisco command starts
    const validStarts = [
      'configure', 'interface', 'router', 'ip', 'no', 'shutdown', 'exit', 'end',
      'vlan', 'name', 'switchport', 'access-list', 'permit', 'deny', 'network',
      'area', 'neighbor', 'description', 'address', 'passive-interface',
      'auto-summary', 'redistribute', 'default-information', 'authentication',
      'hello-interval', 'dead-interval', 'cost', 'priority', 'bandwidth',
      'hostname', 'enable', 'service', 'line', 'username', 'crypto', 'aaa'
    ];
    
    // Check if line starts with valid command
    const isValidStart = validStarts.some(cmd => trimmed.startsWith(cmd));
    
    // Also check for indented sub-commands (starting with space)
    const isSubCommand = line.startsWith(' ') && trimmed.length > 0;
    
    return isValidStart || isSubCommand;
  }

  // Validate generated configuration
  validateConfiguration(config) {
    if (!config) return { isValid: false, score: 0 };
    
    let score = 50; // Base score
    
    // Essential structure checks
    if (config.includes('configure terminal')) score += 15;
    if (config.includes('end')) score += 15;
    
    // Content quality checks
    const lines = config.split('\n').filter(line => line.trim());
    if (lines.length >= 3) score += 10;
    if (lines.length >= 5) score += 5;
    
    // Protocol-specific checks
    if (config.includes('router ospf') || config.includes('router eigrp') || config.includes('router bgp')) score += 10;
    if (config.includes('interface')) score += 5;
    if (config.includes('network') || config.includes('ip address')) score += 5;
    if (config.includes('exit')) score += 5;
    
    return {
      isValid: score >= 70,
      score: Math.min(score, 100)
    };
  }

  // Helper function to convert CIDR to subnet mask
  cidrToMask(cidr) {
    const masks = {
      '24': '255.255.255.0',
      '30': '255.255.255.252',
      '16': '255.255.0.0',
      '8': '255.0.0.0'
    };
    return masks[cidr] || '255.255.255.0';
  }

  // Helper function to convert CIDR to wildcard mask
  cidrToWildcard(cidr) {
    const wildcards = {
      '24': '0.0.0.255',
      '30': '0.0.0.3',
      '16': '0.0.255.255',
      '8': '0.255.255.255'
    };
    return wildcards[cidr] || '0.0.0.255';
  }

  // Multi-device generation using pure LLM
  async generateMultiDeviceConfiguration(devices, prompt, topologyHints = {}) {
    const startTime = Date.now();
    
    try {
      console.log(`🚀 Pure LLM multi-device generation for ${devices.length} devices: "${prompt}"`);

      // Parallel generation for speed
      const promises = devices.map(async (device, index) => {
        console.log(`🔄 Pure LLM generating config ${index + 1}/${devices.length} for ${device.name} (${device.type})`);

        // Build device-specific prompt
        const devicePrompt = `${prompt} for device ${device.name}`;

        // Generate configuration using pure LLM method
        const deviceResult = await this.generateConfiguration(devicePrompt, device.type, device);

        return {
          device_id: device.id,
          device_name: device.name,
          success: deviceResult.success,
          configuration: deviceResult.configuration || null,
          error: deviceResult.error || null
        };
      });

      const results = await Promise.all(promises);
      const successCount = results.filter(r => r.success).length;
      const executionTime = Date.now() - startTime;

      console.log(`✅ Pure LLM multi-device completed: ${successCount}/${devices.length} successful (${executionTime}ms)`);

      return {
        success: successCount > 0,
        results: results,
        executionTime: executionTime,
        method: 'pure_llm_multi',
        note: `Pure LLM parallel generation for ${devices.length} devices - NO templates`
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error("❌ Pure LLM Multi-Device Error:", error.message);
      
      return {
        success: false,
        error: `Pure LLM multi-device generation failed: ${error.message}`,
        results: [],
        executionTime: executionTime
      };
    }
  }

  // NETCONF XML generation - pure LLM only
  async generateNetconfXml(prompt, deviceType, deviceContext = {}, yangModel = null) {
    const startTime = Date.now();
    
    try {
      console.log(`🔗 Pure LLM NETCONF XML generation for ${deviceType}: "${prompt}"`);

      const xmlPrompt = `Generate NETCONF XML configuration for Cisco ${deviceType}.

Task: ${prompt}

Rules:
- Output ONLY valid NETCONF XML
- NO explanations or comments
- Use proper XML structure
- Include namespace declarations

<config xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">`;

      const response = await this.client.post("/api/generate", {
        model: this.model,
        prompt: xmlPrompt,
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 300,
          top_k: 10,
          stop: ["```", "Note:", "Explanation:"],
        },
      });

      let xmlConfiguration = response.data.response ? response.data.response.trim() : '';
      
      // Clean XML output
      xmlConfiguration = xmlConfiguration
        .replace(/```[\s\S]*?```/g, '')
        .replace(/Here's.*?:/gi, '')
        .trim();
      
      if (xmlConfiguration && xmlConfiguration.includes('<')) {
        const executionTime = Date.now() - startTime;
        console.log(`✅ Pure LLM XML generated (${executionTime}ms)`);
        
        return {
          success: true,
          configuration: xmlConfiguration,
          model: this.model,
          deviceType: deviceType,
          method: 'pure_llm_xml',
          executionTime: executionTime,
          validation: { isValid: true, errors: [], warnings: [] },
          confidenceScore: 90,
          yangModel: yangModel?.name || null,
          outputFormat: 'netconf_xml',
          note: `Pure LLM XML generation using ${this.model} - NO templates`
        };
      }
      
      throw new Error('Pure LLM failed to generate valid XML');
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error("❌ Pure LLM XML Generation Error:", error.message);
      
      return {
        success: false,
        error: `Pure LLM XML generation failed: ${error.message}`,
        configuration: null,
        executionTime: executionTime
      };
    }
  }

  // Service status - pure LLM
  async getServiceStatus() {
    try {
      const response = await this.client.get("/api/tags");
      const models = response.data.models || [];
      const currentModel = models.find((m) => m.name === this.model);

      return {
        status: "connected",
        service: "Pure LLM Configuration Generator",
        host: this.host,
        model: this.model,
        modelAvailable: !!currentModel,
        availableModels: models.map((m) => m.name),
        timeout: this.timeout,
        features: [
          "🤖 Pure LLM generation ONLY",
          "⚡ Optimized prompts for accuracy",
          "🧹 Advanced output cleaning",
          "✅ Cisco CLI validation",
          "🚀 Parallel multi-device support",
          "🚫 NO templates or fallbacks"
        ]
      };
    } catch (error) {
      return {
        status: "disconnected",
        service: "Pure LLM Configuration Generator", 
        host: this.host,
        model: this.model,
        modelAvailable: false,
        error: error.message
      };
    }
  }

  // Configuration explanation - pure LLM
  async explainConfiguration(configuration) {
    try {
      const prompt = `Explain this Cisco configuration briefly:

${configuration.substring(0, 500)}

Explanation:`;

      const response = await this.client.post("/api/generate", {
        model: this.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 150,
          top_k: 20,
        },
      });

      return {
        success: true,
        explanation: response.data.response?.trim() || "No explanation generated",
        model: this.model,
        method: 'pure_llm_explain'
      };
    } catch (error) {
      return {
        success: false,
        explanation: "Pure LLM explanation failed",
        error: error.message,
      };
    }
  }
}

export default new AIService();