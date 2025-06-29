import axios from 'axios';
import templateService from './templateService.js';

export class AIService {
  constructor() {
    this.host = process.env.OLLAMA_HOST || 'http://localhost:11434';
    this.model = process.env.OLLAMA_MODEL || 'codellama:13b';
    this.client = axios.create({
      baseURL: this.host,
      timeout: 120000, // Increased timeout for complex configs
    });
    
    console.log(`🤖 Enhanced Cisco AI Service initialized with ${this.model} at ${this.host}`);
    console.log(`🔧 Template-based generation enabled for faster configuration`);
    
    // Strict Cisco IOS command patterns for validation
    this.ciscoPatterns = {
      router: [
        /^router (ospf|eigrp|bgp|rip) \d+$/,  // Must be on separate line
        /^ network \d+\.\d+\.\d+\.\d+ \d+\.\d+\.\d+\.\d+ area \d+$/,  // Indented network command
        /^interface (GigabitEthernet|FastEthernet|Serial|Loopback)\d+(\.\d+)?(\/\d+)*$/,
        /^ip route /,
        /^access-list \d+ (permit|deny)/,
        /^ip access-group/
      ],
      switch: [
        /^vlan \d+$/,  // Must be exact format
        /^ name \w+$/,  // Indented under vlan
        /^interface (GigabitEthernet|FastEthernet|Vlan)\d+(\.\d+)?(\/\d+)*$/,
        /^ switchport mode (access|trunk)$/,  // Must be indented
        /^ switchport access vlan \d+$/,
        /^spanning-tree/
      ],
      common: [
        /^configure terminal$/,
        /^end$/,
        /^exit$/,
        /^hostname \S+$/,
        /^ ip address \d+\.\d+\.\d+\.\d+ \d+\.\d+\.\d+\.\d+$/,
        /^ no shutdown$/,
        /^ description \S+/
      ],
      // Anti-patterns (things that should NOT appear)
      antiPatterns: [
        /^router ospf \d+ network/,  // Wrong: all on one line
        /^interface.*network/,       // Wrong: mixing interface and network
        /^vlan \d+ name/,           // Wrong: should be separate lines
        /[^!].*\S\s+on\s+\w+$/      // Wrong: "on interface" syntax
      ]
    };
  }

  // Enhanced configuration generation with Template-First approach
  async generateConfiguration(prompt, deviceType, deviceContext = {}) {
    const startTime = Date.now();
    
    try {
      console.log(`🤖 Hybrid AI generation for ${deviceType}: "${prompt}"`);

      // STEP 1: Try template-based generation first (FAST)
      console.log('🔧 Attempting template-based generation...');
      const templateResult = await templateService.generateFromTemplate(prompt, deviceType, deviceContext);
      
      if (templateResult.success && templateResult.confidence > 0.7) {
        const executionTime = Date.now() - startTime;
        console.log(`🚀 Template generation successful (${executionTime}ms) - confidence: ${(templateResult.confidence * 100).toFixed(1)}%`);
        
        return {
          success: true,
          configuration: templateResult.configuration,
          model: 'template-based',
          deviceType: deviceType,
          method: 'template',
          templateUsed: templateResult.templateUsed,
          category: templateResult.category,
          extractedVariables: templateResult.extractedVariables,
          confidence: templateResult.confidence,
          executionTime: executionTime,
          validation: this.advancedCiscoValidation(templateResult.configuration, deviceType),
          recommendations: this.getConfigurationRecommendations(templateResult.configuration, deviceType)
        };
      }

      // STEP 2: Fall back to AI generation for complex/unrecognized requests
      console.log('🤖 Template confidence low, falling back to AI generation...');
      return await this.generateWithAI(prompt, deviceType, deviceContext, startTime);

    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error("❌ AI Service Error:", error.message);
      return {
        success: false,
        error: `AI Service Error: ${error.message}`,
        configuration: null,
        executionTime: executionTime
      };
    }
  }

  // Original AI generation method (now private)
  async generateWithAI(prompt, deviceType, deviceContext, startTime) {
    console.log(`🧠 Using AI model for complex generation...`);

    // Build enhanced Cisco-specific prompt
    const aiPrompt = this.buildEnhancedCiscoPrompt(prompt, deviceType, deviceContext);

    // Generate with optimized parameters
    const response = await this.client.post("/api/generate", {
      model: this.model,
      prompt: aiPrompt,
      stream: false,
      options: {
        temperature: 0.1, // Low temperature for consistent syntax
        top_k: 25,
        top_p: 0.8,
        num_predict: 1500, // Increased for complex configurations
        repeat_penalty: 1.1,
        stop: ["```", "---", "Note:", "Explanation:"] // Stop on common non-config patterns
      },
    });

    const rawResponse = response.data.response.trim();
    
    if (!rawResponse || rawResponse.length < 20) {
      return {
        success: false,
        error: `AI generated insufficient configuration for ${deviceType}`,
        configuration: null,
      };
    }

    // Enhanced configuration processing
    let processedConfig = this.processConfiguration(rawResponse, deviceType);
    const validation = this.advancedCiscoValidation(processedConfig, deviceType);
    const executionTime = Date.now() - startTime;

    // Calculate confidence score
    const confidenceScore = this.calculateConfidenceScore(processedConfig, deviceType, validation);

    const result = {
      success: true,
      configuration: processedConfig,
      model: this.model,
      deviceType: deviceType,
      method: 'ai',
      processed: processedConfig !== rawResponse,
      executionTime: executionTime,
      validation: validation,
      confidenceScore: confidenceScore,
      recommendations: this.getConfigurationRecommendations(processedConfig, deviceType)
    };

    console.log(`🔧 AI configuration generated successfully (${executionTime}ms, confidence: ${confidenceScore}%)`);
    return result;
  }

  // New method: Get generation method recommendation
  async getGenerationMethod(prompt, deviceType) {
    try {
      const parseResult = templateService.parsePrompt(prompt, deviceType);
      
      if (parseResult && parseResult.confidence > 0.7) {
        return {
          recommended: 'template',
          confidence: parseResult.confidence,
          type: parseResult.type,
          template: parseResult.template,
          reason: 'High confidence template match found'
        };
      } else if (parseResult && parseResult.confidence > 0.3) {
        return {
          recommended: 'hybrid',
          confidence: parseResult.confidence,
          type: parseResult.type,
          template: parseResult.template,
          reason: 'Moderate template match, will combine with AI'
        };
      } else {
        return {
          recommended: 'ai',
          confidence: 0,
          reason: 'No suitable template found, using AI generation'
        };
      }
    } catch (error) {
      return {
        recommended: 'ai',
        confidence: 0,
        reason: 'Template service unavailable, using AI generation'
      };
    }
  }

  // Template management methods
  async getAvailableTemplates(deviceType, category) {
    try {
      return await templateService.getAvailableTemplates(deviceType, category);
    } catch (error) {
      console.error('❌ Error fetching templates:', error);
      return { success: false, templates: [], error: error.message };
    }
  }

  async getTemplateCategories() {
    try {
      return await templateService.getTemplateCategories();
    } catch (error) {
      console.error('❌ Error fetching categories:', error);
      return { success: false, categories: [], error: error.message };
    }
  }

  // Enhanced configuration generation with Template + AI hybrid approach
  async generateConfigurationHybrid(prompt, deviceType, deviceContext = {}) {
    const startTime = Date.now();
    
    try {
      console.log(`🔀 Hybrid generation for ${deviceType}: "${prompt}"`);

      // Try template-based generation first
      const templateResult = await templateService.generateFromTemplate(prompt, deviceType, deviceContext);
      
      if (templateResult.success && templateResult.confidence > 0.5) {
        // Use template as base, enhance with AI if needed
        const baseConfig = templateResult.configuration;
        
        if (templateResult.confidence < 0.8) {
          console.log('🔧 Enhancing template with AI refinements...');
          
          const enhancePrompt = `Enhance this Cisco configuration based on the request: "${prompt}"
          
Base Configuration:
${baseConfig}

Only add missing commands or improve the configuration. Keep all existing valid commands.`;

          const aiResult = await this.generateWithAI(enhancePrompt, deviceType, deviceContext, startTime);
          
          if (aiResult.success) {
            return {
              ...aiResult,
              method: 'hybrid',
              templateUsed: templateResult.templateUsed,
              baseTemplate: baseConfig,
              confidence: Math.max(templateResult.confidence, aiResult.confidenceScore / 100)
            };
          }
        }
        
        // Return template result if AI enhancement fails or not needed
        const executionTime = Date.now() - startTime;
        return {
          success: true,
          configuration: baseConfig,
          method: 'template',
          templateUsed: templateResult.templateUsed,
          category: templateResult.category,
          confidence: templateResult.confidence,
          executionTime: executionTime,
          validation: this.advancedCiscoValidation(baseConfig, deviceType)
        };
      }

      // Fall back to pure AI generation
      return await this.generateWithAI(prompt, deviceType, deviceContext, startTime);

    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error("❌ Hybrid Generation Error:", error.message);
      return {
        success: false,
        error: `Hybrid generation failed: ${error.message}`,
        configuration: null,
        executionTime: executionTime
      };
    }
  }

  // Enhanced Cisco-specific prompt building
  buildEnhancedCiscoPrompt(prompt, deviceType, deviceContext) {
    const deviceInfo = [
      deviceContext.model && `Model: ${deviceContext.model}`,
      deviceContext.ios_version && `IOS: ${deviceContext.ios_version}`,
      deviceContext.location && `Location: ${deviceContext.location}`
    ].filter(Boolean).join(', ');

    // Device-specific context and constraints
    const deviceSpecifics = this.getDeviceSpecificContext(deviceType, deviceContext);
    const commonPatterns = this.getCommonCiscoPatterns(deviceType);

         return `You are a Senior Cisco Network Engineer with CCIE certification. Generate EXACT Cisco IOS configuration syntax.

DEVICE CONTEXT:
- Type: ${deviceType.toUpperCase()}
${deviceInfo ? `- Details: ${deviceInfo}` : ''}
${deviceSpecifics}

CRITICAL CISCO IOS SYNTAX RULES:
1. Generate ONLY executable Cisco IOS commands with EXACT syntax
2. Start with 'configure terminal' and end with 'end'
3. Use proper command hierarchy and indentation
4. Each configuration mode must have proper 'exit' commands
5. Comments use '!' at the beginning of lines
6. Sub-commands are indented with exactly ONE space
7. NO explanations, markdown, or non-IOS text

${commonPatterns}

EXACT SYNTAX EXAMPLES:
OSPF Configuration:
router ospf 1
 network 192.168.1.0 0.0.0.255 area 0
 passive-interface default
 no passive-interface gigabitethernet0/1
exit

Interface Configuration:
interface gigabitethernet0/1
 description LAN_Interface
 ip address 192.168.1.1 255.255.255.0
 no shutdown
exit

VLAN Configuration:
vlan 10
 name Sales_VLAN
exit
interface fastethernet0/1
 switchport mode access
 switchport access vlan 10
 no shutdown
exit

TASK: ${prompt}

REQUIRED OUTPUT FORMAT:
configure terminal
!
hostname Router_Name
!
[YOUR CONFIGURATION HERE]
!
end

Generate ONLY valid Cisco IOS commands with perfect syntax:`;
  }

  // Get device-specific context and constraints
  getDeviceSpecificContext(deviceType, deviceContext) {
    const contexts = {
      router: `
ROUTER-SPECIFIC CONTEXT:
- Focus on routing protocols (OSPF, EIGRP, BGP)
- Interface configurations with proper IP addressing
- Access control lists (ACLs) for security
- NAT/PAT configurations when relevant
- Static routing when appropriate`,

      switch: `
SWITCH-SPECIFIC CONTEXT:
- VLAN creation and management
- Switchport configurations (access/trunk)
- Spanning Tree Protocol considerations
- Port security when relevant
- Inter-VLAN routing if Layer 3 switch`,

      firewall: `
FIREWALL-SPECIFIC CONTEXT:
- Security zones and policies
- Access control rules
- NAT configurations
- VPN settings when relevant
- Logging and monitoring`
    };

    return contexts[deviceType] || '';
  }

  // Get common Cisco patterns for device type
  getCommonCiscoPatterns(deviceType) {
    const patterns = {
      router: `
COMMON ROUTER PATTERNS:
- router ospf [process-id]
- interface GigabitEthernet0/0
- ip address [ip] [mask]
- ip route [destination] [mask] [next-hop]
- access-list [number] [permit/deny] [source]`,

      switch: `
COMMON SWITCH PATTERNS:
- vlan [id]
- interface FastEthernet0/1
- switchport mode access/trunk
- switchport access vlan [id]
- spanning-tree portfast`,

      firewall: `
COMMON FIREWALL PATTERNS:
- access-list [name] [permit/deny]
- nat (inside,outside) source dynamic
- crypto map [name]
- security-level [level]`
    };

    return patterns[deviceType] || '';
  }

  // Get example commands for device type
  getExampleCommands(deviceType) {
    const examples = {
      router: `interface GigabitEthernet0/1
 description LAN Interface
 ip address 192.168.1.1 255.255.255.0
 no shutdown
exit`,
      switch: `vlan 10
 name Production
exit
interface FastEthernet0/1
 switchport mode access
 switchport access vlan 10
 no shutdown
exit`,
      firewall: `access-list OUTSIDE_IN permit tcp any any eq 80
access-list OUTSIDE_IN permit tcp any any eq 443
access-group OUTSIDE_IN in interface outside`
    };

    return examples[deviceType] || '';
  }

  // Enhanced configuration processing
  processConfiguration(config, deviceType) {
    let processedConfig = config.trim();
    
    // Remove markdown formatting
    processedConfig = processedConfig.replace(/```[a-z]*\n?/g, '').replace(/```/g, '');
    
    // Remove explanatory text and comments outside of configuration
    const lines = processedConfig.split('\n');
    const configLines = [];
    let inConfig = false;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Start configuration section
      if (trimmedLine === 'configure terminal' || inConfig) {
        inConfig = true;
        configLines.push(line);
        
        // End configuration section
        if (trimmedLine === 'end') {
          break;
        }
      }
    }
    
    processedConfig = configLines.join('\n');
    
    // Add configure terminal if missing
    if (!processedConfig.startsWith('configure terminal')) {
      processedConfig = 'configure terminal\n' + processedConfig;
    }
    
    // Add end if missing
    if (!processedConfig.trim().endsWith('end')) {
      processedConfig = processedConfig.trim() + '\nend';
    }
    
    // Fix indentation
    processedConfig = this.fixIndentation(processedConfig);
    
    // Remove excessive blank lines
    processedConfig = processedConfig.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    return processedConfig;
  }

  // Fix Cisco IOS indentation
  fixIndentation(config) {
    const lines = config.split('\n');
    const fixedLines = [];
    let indentLevel = 0;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (!trimmedLine) {
        fixedLines.push('');
        continue;
      }
      
      // Commands that decrease indent level
      if (trimmedLine === 'exit' || trimmedLine === 'end') {
        indentLevel = Math.max(0, indentLevel - 1);
      }
      
      // Apply indentation
      const indent = ' '.repeat(indentLevel);
      fixedLines.push(indent + trimmedLine);
      
      // Commands that increase indent level
      if (trimmedLine.match(/^(interface|router|line|access-list|vlan \d+)/i) && 
          !trimmedLine.includes('exit') && !trimmedLine.includes('end')) {
        indentLevel++;
      }
    }
    
    return fixedLines.join('\n');
  }

  // Advanced Cisco-specific validation
  advancedCiscoValidation(configuration, deviceType) {
    try {
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
      let score = 0;
      const errors = [];
      const warnings = [];
      const feedback = [];

      // Check basic structure (30 points)
      const hasConfigTerminal = configuration.includes("configure terminal");
      const hasEnd = configuration.includes("end");
      
      if (hasConfigTerminal) {
        score += 15;
      } else {
        errors.push("Missing 'configure terminal'");
      }
      
      if (hasEnd) {
        score += 15;
      } else {
        errors.push("Missing 'end' statement");
      }

      // Check for anti-patterns first (immediate errors)
      const antiPatterns = this.ciscoPatterns.antiPatterns || [];
      for (const antiPattern of antiPatterns) {
        const matchingLines = lines.filter(line => antiPattern.test(line.trim()));
        if (matchingLines.length > 0) {
          matchingLines.forEach(line => {
            errors.push(`Incorrect Cisco syntax: "${line.trim()}"`);
          });
          score -= 20; // Heavy penalty for syntax errors
        }
      }

      // Check device-specific patterns (40 points)
      const devicePatterns = this.ciscoPatterns[deviceType] || [];
      const commonPatterns = this.ciscoPatterns.common;
      const allPatterns = [...devicePatterns, ...commonPatterns];
      
      let patternMatches = 0;
      const maxPatternScore = 40;
      
      for (const pattern of allPatterns) {
        if (lines.some(line => pattern.test(line.trim()))) {
          patternMatches++;
        }
      }
      
      score += Math.min(maxPatternScore, (patternMatches / allPatterns.length) * maxPatternScore);

      // Check syntax validity (20 points)
      const syntaxScore = this.validateSyntax(lines, deviceType);
      score += syntaxScore.score;
      errors.push(...syntaxScore.errors);
      warnings.push(...syntaxScore.warnings);

      // Check best practices (10 points)
      const bestPracticesScore = this.validateBestPractices(lines, deviceType);
      score += bestPracticesScore.score;
      warnings.push(...bestPracticesScore.warnings);

      const isValid = score >= 70 && errors.length === 0;
      
      return {
        isValid,
        feedback: isValid ? "Configuration meets Cisco standards" : 
                 `Issues found: ${[...errors, ...warnings].join(", ")}`,
        score: Math.round(score),
        totalLines: lines.length,
        errors,
        warnings,
        patternMatches
      };
      
    } catch (error) {
      console.error("❌ Validation error:", error.message);
      return {
        isValid: false,
        feedback: "Validation failed",
        score: 0,
        errors: ["Validation system error"],
        warnings: []
      };
    }
  }

  // Validate Cisco IOS syntax
  validateSyntax(lines, deviceType) {
    const errors = [];
    const warnings = [];
    let score = 0;
    
    const syntaxChecks = {
      // Interface names
      interfaceFormat: /^interface (GigabitEthernet|FastEthernet|Serial|Loopback|Vlan)\d+(\.\d+)?(\/\d+)*$/i,
      // IP addresses
      ipFormat: /^ip address \d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3} \d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
      // VLAN IDs
      vlanFormat: /^vlan [1-9]\d{0,3}$/,
      // Access lists
      aclFormat: /^access-list (\d+|[\w-]+) (permit|deny)/i
    };
    
    let validCommands = 0;
    let totalCommands = 0;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith('!')) continue;
      
      totalCommands++;
      
      // Check specific syntax patterns
      if (trimmedLine.startsWith('interface ')) {
        if (syntaxChecks.interfaceFormat.test(trimmedLine)) {
          validCommands++;
        } else {
          errors.push(`Invalid interface format: ${trimmedLine}`);
        }
      } else if (trimmedLine.startsWith('ip address ')) {
        if (syntaxChecks.ipFormat.test(trimmedLine)) {
          validCommands++;
        } else {
          errors.push(`Invalid IP address format: ${trimmedLine}`);
        }
      } else if (trimmedLine.startsWith('vlan ')) {
        if (syntaxChecks.vlanFormat.test(trimmedLine)) {
          validCommands++;
        } else {
          warnings.push(`Check VLAN ID range: ${trimmedLine}`);
        }
      } else {
        validCommands++; // Assume other commands are valid for now
      }
    }
    
    if (totalCommands > 0) {
      score = (validCommands / totalCommands) * 20;
    }
    
    return { score, errors, warnings };
  }

  // Validate Cisco best practices
  validateBestPractices(lines, deviceType) {
    const warnings = [];
    let score = 10; // Start with full score, deduct for violations
    
    const bestPractices = {
      hasDescriptions: /^description /i,
      hasNoShutdown: /^no shutdown$/i,
      hasSecurePasswords: /username .+ secret/i,
      hasSSHConfig: /transport input ssh/i
    };
    
    let hasDescriptions = false;
    let hasNoShutdown = false;
    let hasSecureAuth = false;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (bestPractices.hasDescriptions.test(trimmedLine)) hasDescriptions = true;
      if (bestPractices.hasNoShutdown.test(trimmedLine)) hasNoShutdown = true;
      if (bestPractices.hasSecurePasswords.test(trimmedLine) || 
          bestPractices.hasSSHConfig.test(trimmedLine)) hasSecureAuth = true;
    }
    
    if (!hasDescriptions) {
      warnings.push("Consider adding interface descriptions");
      score -= 2;
    }
    
    if (!hasNoShutdown) {
      warnings.push("Remember to add 'no shutdown' for active interfaces");
      score -= 3;
    }
    
    if (!hasSecureAuth) {
      warnings.push("Consider implementing secure authentication");
      score -= 3;
    }
    
    return { score: Math.max(0, score), warnings };
  }

  // Calculate confidence score
  calculateConfidenceScore(configuration, deviceType, validation) {
    let confidence = validation.score || 0;
    
    // Boost confidence for proper structure
    if (validation.isValid) confidence += 10;
    
    // Adjust based on configuration length and complexity
    const lines = configuration.split('\n').filter(line => line.trim());
    if (lines.length >= 5 && lines.length <= 50) {
      confidence += 5; // Good length range
    }
    
    // Check for device-appropriate commands
    const devicePatterns = this.ciscoPatterns[deviceType] || [];
    const hasDeviceSpecific = devicePatterns.some(pattern => 
      lines.some(line => pattern.test(line.trim()))
    );
    
    if (hasDeviceSpecific) confidence += 10;
    
    return Math.min(100, Math.max(0, Math.round(confidence)));
  }

  // Get configuration recommendations
  getConfigurationRecommendations(configuration, deviceType) {
    const recommendations = [];
    const lines = configuration.split('\n').map(line => line.trim());
    
    // Security recommendations
    if (!lines.some(line => /crypto key generate rsa/i.test(line))) {
      recommendations.push({
        type: 'security',
        message: 'Consider generating RSA keys for SSH access',
        priority: 'medium'
      });
    }
    
    if (!lines.some(line => /service password-encryption/i.test(line))) {
      recommendations.push({
        type: 'security',
        message: 'Consider enabling password encryption service',
        priority: 'high'
      });
    }
    
    // Device-specific recommendations
    if (deviceType === 'switch') {
      if (!lines.some(line => /spanning-tree/i.test(line))) {
        recommendations.push({
          type: 'best-practice',
          message: 'Consider configuring Spanning Tree Protocol settings',
          priority: 'medium'
        });
      }
    }
    
    if (deviceType === 'router') {
      if (!lines.some(line => /router (ospf|eigrp)/i.test(line))) {
        recommendations.push({
          type: 'routing',
          message: 'Consider configuring a dynamic routing protocol',
          priority: 'low'
        });
      }
    }
    
    return recommendations;
  }

  // Service status with enhanced info
  async getServiceStatus() {
    try {
      const response = await this.client.get("/api/tags");
      const models = response.data.models || [];
      const currentModel = models.find((m) => m.name === this.model);

      return {
        status: "connected",
        service: "Enhanced Cisco AI",
        host: this.host,
        model: this.model,
        modelAvailable: !!currentModel,
        availableModels: models.map((m) => m.name),
        timeout: 120000,
        features: [
          "Advanced Cisco IOS validation",
          "Device-specific optimization",
          "Best practices checking",
          "Confidence scoring",
          "Smart recommendations"
        ]
      };
    } catch (error) {
      return {
        status: "disconnected",
        service: "Enhanced Cisco AI", 
        host: this.host,
        model: this.model,
        modelAvailable: false,
        error: error.message
      };
    }
  }

  // Enhanced configuration explanation
  async explainConfiguration(configuration) {
    try {
      const prompt = `As a Senior Cisco Network Engineer, provide a comprehensive technical explanation of this configuration:

${configuration}

Structure your explanation as follows:
1. OVERVIEW: What this configuration accomplishes
2. KEY COMPONENTS: Break down major sections
3. NETWORK IMPACT: How this affects network operation
4. SECURITY CONSIDERATIONS: Security implications
5. BEST PRACTICES: Compliance with Cisco standards

Provide a clear, technical explanation suitable for network engineers:`;

      const response = await this.client.post("/api/generate", {
        model: this.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.3,
          top_k: 40,
          top_p: 0.9,
          num_predict: 800,
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