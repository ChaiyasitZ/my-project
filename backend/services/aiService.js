import axios from 'axios';
import yangService from './yangService.js';

export class AIService {
  constructor() {
    this.host = process.env.OLLAMA_HOST || 'http://localhost:11434';
    this.model = process.env.OLLAMA_MODEL || 'qwen2.5-coder:3b';
    this.timeout = 30000; // 30 seconds
    this.temperature = 0.1;
    this.maxTokens = 300;
    
    this.client = axios.create({
      baseURL: this.host,
      timeout: this.timeout,
    });
    
    console.log(`🤖 AI Service initialized with ${this.model} at ${this.host}`);
    console.log(`🔥 RAW AI generation - Simple and clean`);
  }

  // Simple raw AI configuration generation
  async generateConfiguration(prompt, deviceType, deviceContext = {}) {
    const startTime = Date.now();
    
    try {
      console.log(`🚀 Raw AI generation for ${deviceType}: "${prompt}"`);

      // Auto-convert CIDR in prompt and provide guidance
      const enhancedPrompt = this.enhancePromptWithWildcard(prompt);
      console.log(`🔄 Enhanced prompt: "${enhancedPrompt}"`);

      // Enhanced prompt with wildcard conversion guidance
      const simplePrompt = `Generate complete Cisco IOS configuration for: ${enhancedPrompt}

IMPORTANT - Convert CIDR prefix to wildcard mask:
- /24 = 0.0.0.255 wildcard
- /25 = 0.0.0.127 wildcard  
- /26 = 0.0.0.63 wildcard
- /27 = 0.0.0.31 wildcard
- /28 = 0.0.0.15 wildcard
- /30 = 0.0.0.3 wildcard
- /31 = 0.0.0.1 wildcard
- /32 = 0.0.0.0 wildcard

Example: "192.168.1.0/25" becomes "network 192.168.1.0 0.0.0.127"

Template:
OSPF:
  configure terminal
    router ospf [process-id]
    network [ip-address] [wildcard-mask] area [area]
  exit
  end

RIPv2:
  configure terminal
  router rip
    version 2
    network [ip-address]
    no auto-summary
  exit
  end

Configuration:`;

      console.log(`📝 Raw AI prompt created`);
        
        const response = await this.client.post("/api/generate", {
        model: this.model,
        prompt: simplePrompt,
          stream: false,
          options: {
          temperature: 0.3,
          num_predict: 400,
          top_k: 30,
            top_p: 0.9,
          repeat_penalty: 1.05,
          stop: ["end"]
          },
        });

        let configuration = response.data.response ? response.data.response.trim() : '';
      console.log(`📦 Raw AI response length: ${configuration.length}`);
        
      // Basic cleaning for raw AI output
      configuration = this.cleanRawConfiguration(configuration);
      
      if (configuration && configuration.length > 40 && configuration.includes('router')) {
          const executionTime = Date.now() - startTime;
        console.log(`✅ Raw AI generation completed (${executionTime}ms)`);
          
          return {
            success: true,
            configuration: configuration,
          model: this.model,
            deviceType: deviceType,
          method: 'raw_ai',
            executionTime: executionTime,
          validation: { isValid: true, score: 85 },
          confidenceScore: 85,
          note: `Raw AI generation using ${this.model}`
          };
        } else {
        console.log(`❌ Raw AI generated insufficient content: "${configuration}"`);
        throw new Error(`Raw AI generated insufficient content`);
      }
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error("❌ Raw AI Generation Error:", error.message);
      
      return {
        success: false,
        error: `Raw AI generation failed: ${error.message}`,
        configuration: null,
        executionTime: executionTime,
        note: 'Raw AI generation failed'
      };
    }
  }

  // Enhance prompt with wildcard conversion guidance
  enhancePromptWithWildcard(prompt) {
    console.log('🔍 Analyzing prompt for CIDR conversion...');
    
    // Detect CIDR notation and provide explicit wildcard conversion
    let enhanced = prompt;
    
    // Common CIDR patterns and their wildcard equivalents
    const cidrMappings = {
      '/24': ' with wildcard 0.0.0.255',
      '/25': ' with wildcard 0.0.0.127', 
      '/26': ' with wildcard 0.0.0.63',
      '/27': ' with wildcard 0.0.0.31',
      '/28': ' with wildcard 0.0.0.15',
      '/30': ' with wildcard 0.0.0.3',
      '/16': ' with wildcard 0.0.255.255',
      '/8': ' with wildcard 0.255.255.255'
    };
    
    // Replace CIDR notation with explicit wildcard guidance
    for (const [cidr, wildcard] of Object.entries(cidrMappings)) {
      if (enhanced.includes(cidr)) {
        enhanced = enhanced.replace(new RegExp(cidr, 'g'), wildcard);
        console.log(`✅ Converted ${cidr} to ${wildcard}`);
    }
  }

    // Add specific conversion note if CIDR was found
    if (enhanced !== prompt) {
      enhanced += ' (use the wildcard mask in network command)';
    }
    
    return enhanced;
  }

  // Basic cleaning for raw AI output
  cleanRawConfiguration(rawConfig) {
    if (!rawConfig) return '';
    
    console.log('🧹 Cleaning raw AI output...');
    console.log('📄 Raw input:', rawConfig.substring(0, 200) + '...');
    
    let cleaned = rawConfig
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/Here's.*?:/gi, '') // Remove explanations
      .replace(/Note:.*$/gmi, '') // Remove notes
      .replace(/Configuration:.*$/gmi, '') // Remove "Configuration:" header
      .trim();
    
    // Extract actual commands
    const lines = cleaned.split('\n');
    const configLines = [];
    let foundStart = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // Start collecting from configure terminal or router commands
      if (trimmed.includes('configure terminal') || trimmed.startsWith('router') || foundStart) {
        foundStart = true;
        configLines.push(trimmed);
      }
    }
    
    let finalConfig = configLines.join('\n');
    
    // Ensure proper structure
    if (!finalConfig.includes('configure terminal')) {
      finalConfig = 'configure terminal\n' + finalConfig;
    }
    
    if (!finalConfig.includes('end')) {
      finalConfig = finalConfig + '\nend';
    }
    
    console.log('📄 Cleaned output:', finalConfig);
    console.log(`✅ Cleaned config has ${finalConfig.split('\n').length} lines`);
    return finalConfig;
  }

  // Helper function to convert CIDR to subnet mask
  cidrToMask(cidr) {
    const masks = {
      '8': '255.0.0.0',
      '16': '255.255.0.0',
      '24': '255.255.255.0',
      '25': '255.255.255.128',
      '26': '255.255.255.192',
      '27': '255.255.255.224',
      '28': '255.255.255.240',
      '29': '255.255.255.248',
      '30': '255.255.255.252',
      '31': '255.255.255.254',
      '32': '255.255.255.255'
    };
    return masks[cidr] || '255.255.255.0';
  }

  // Helper function to convert CIDR to wildcard mask
  cidrToWildcard(cidr) {
    const wildcards = {
      '8': '0.255.255.255',
      '16': '0.0.255.255', 
      '24': '0.0.0.255',
      '25': '0.0.0.127',
      '26': '0.0.0.63',
      '27': '0.0.0.31',
      '28': '0.0.0.15',
      '29': '0.0.0.7',
      '30': '0.0.0.3',
      '31': '0.0.0.1',
      '32': '0.0.0.0'
    };
    return wildcards[cidr] || '0.0.0.255';
  }

  // Multi-device generation using raw AI
  async generateMultiDeviceConfiguration(devices, prompt, topologyHints = {}) {
    const startTime = Date.now();
    
    try {
      console.log(`🚀 Raw AI multi-device generation for ${devices.length} devices: "${prompt}"`);

      const promises = devices.map(async (device, index) => {
        console.log(`🔄 Raw AI generating config ${index + 1}/${devices.length} for ${device.name}`);

        const devicePrompt = `${prompt} for device ${device.name}`;
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

      console.log(`✅ Raw AI multi-device completed: ${successCount}/${devices.length} successful (${executionTime}ms)`);

      return {
        success: successCount > 0,
        results: results,
        executionTime: executionTime,
        method: 'raw_ai_multi',
        note: `Raw AI parallel generation for ${devices.length} devices`
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error("❌ Raw AI Multi-Device Error:", error.message);
      
      return {
        success: false,
        error: `Raw AI multi-device generation failed: ${error.message}`,
        results: [],
        executionTime: executionTime
      };
    }
  }

  // NETCONF XML generation - raw AI
  async generateNetconfXml(prompt, deviceType, deviceContext = {}, yangModel = null) {
    const startTime = Date.now();
    
    try {
      console.log(`🔗 Raw AI NETCONF XML generation for ${deviceType}: "${prompt}"`);

      const xmlPrompt = `Generate NETCONF XML for: ${prompt}

<config xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">`;

          const response = await this.client.post("/api/generate", {
        model: this.model,
            prompt: xmlPrompt,
            stream: false,
            options: {
              temperature: 0.1,
          num_predict: 250,
              top_k: 10,
            },
          });

          let xmlConfiguration = response.data.response ? response.data.response.trim() : '';
          
          if (xmlConfiguration && xmlConfiguration.includes('<')) {
            const executionTime = Date.now() - startTime;
        console.log(`✅ Raw AI XML generated (${executionTime}ms)`);
            
            return {
              success: true,
              configuration: xmlConfiguration,
          model: this.model,
              deviceType: deviceType,
          method: 'raw_ai_xml',
        executionTime: executionTime,
        validation: { isValid: true, errors: [], warnings: [] },
        confidenceScore: 80,
        yangModel: yangModel?.name || null,
        outputFormat: 'netconf_xml',
          note: `Raw AI XML generation using ${this.model}`
      };
      }
      
      throw new Error('Raw AI failed to generate valid XML');
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error("❌ Raw AI XML Generation Error:", error.message);
      
      return {
        success: false,
        error: `Raw AI XML generation failed: ${error.message}`,
        configuration: null,
        executionTime: executionTime
      };
    }
  }

  // Service status - raw AI
  async getServiceStatus() {
    try {
      const response = await this.client.get("/api/tags");
      const models = response.data.models || [];
      const currentModel = models.find((m) => m.name === this.model);

      return {
        status: "connected",
        service: "Raw AI Configuration Generator",
        host: this.host,
        model: this.model,
        modelAvailable: !!currentModel,
        availableModels: models.map((m) => m.name),
        timeout: this.timeout,
        features: [
          "🔥 Raw AI generation",
          "⚡ Simple and fast",
          "🧹 Basic output cleaning",
          "🚀 Multi-device support",
          "📝 NETCONF XML generation"
        ]
      };
    } catch (error) {
      return {
        status: "disconnected",
        service: "Raw AI Configuration Generator", 
        host: this.host,
        model: this.model,
        modelAvailable: false,
        error: error.message
      };
    }
  }

  // Configuration explanation - raw AI
  async explainConfiguration(configuration) {
    try {
      const prompt = `Explain this Cisco configuration:

${configuration.substring(0, 300)}

Explanation:`;

      const response = await this.client.post("/api/generate", {
        model: this.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 100,
        },
      });

      return {
        success: true,
        explanation: response.data.response?.trim() || "No explanation generated",
        model: this.model,
        method: 'raw_ai_explain'
      };
    } catch (error) {
      return {
        success: false,
        explanation: "Raw AI explanation failed",
        error: error.message,
      };
    }
  }
}

export default new AIService();