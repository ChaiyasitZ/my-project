import axios from "axios";
import { config } from "../config/config.js";

export class AIService {
  constructor() {
    this.host = config.ollama.host;
    this.model = config.ollama.model; // Should be "codellama:13b"

    this.client = axios.create({
      baseURL: this.host,
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 60000, // Increased timeout for 13B model
    });
  }

  async generateConfiguration(prompt, deviceType, deviceContext = {}) {
    try {
      console.log(`🤖 Generating ${deviceType} configuration for: "${prompt}"`);

      const systemPrompt = this.buildSystemPrompt(deviceType, deviceContext);
      const structuredPrompt = this.buildStructuredPrompt(prompt, deviceType, deviceContext);

      const response = await this.client.post("/api/generate", {
        model: this.model,
        prompt: `${systemPrompt}\n\n${structuredPrompt}`,
        stream: false,
        options: {
          temperature: 0.05, // Very low for consistent configuration generation
          top_k: 10,
          top_p: 0.3,
          num_predict: 2000, // Increased for more comprehensive configs
          repeat_penalty: 1.1,
          stop: ["Human:", "User:", "Question:", "Explanation:"], // Stop tokens
        },
      });

      const rawResponse = response.data.response.trim();
      console.log("🤖 Raw AI Response:", rawResponse);

      const cleanConfig = this.extractCommands(rawResponse, deviceType);
      console.log("✅ Clean Configuration:", cleanConfig);

      if (!cleanConfig || cleanConfig.length < 20) {
        return {
          success: false,
          error: `AI could not generate valid ${deviceType} commands. Try being more specific about interfaces, VLANs, or protocols needed.`,
          configuration: null,
          suggestions: this.getConfigurationSuggestions(deviceType),
        };
      }

      return {
        success: true,
        configuration: cleanConfig,
        rawResponse: rawResponse,
        model: this.model,
        deviceType: deviceType,
      };
    } catch (error) {
      console.error("❌ AI Service Error:", error.message);
      return {
        success: false,
        error: `AI Service Error: ${error.message}`,
        configuration: null,
        suggestions: ["Check if Ollama is running", "Verify CodeLlama model is available"],
      };
    }
  }

  buildSystemPrompt(deviceType, deviceContext) {
    const { model = "unknown", ios_version = "15.x" } = deviceContext;
    
    const deviceSpecificPrompts = {
      router: `You are a Cisco router configuration expert. Generate ONLY valid Cisco IOS commands for routers.
DEVICE: ${deviceType.toUpperCase()} (Model: ${model}, IOS: ${ios_version})

RULES:
1. Output ONLY executable Cisco IOS commands
2. No explanations, comments, or markdown
3. Use proper command syntax and hierarchy
4. Include 'configure terminal' at start and 'end' at finish
5. Use realistic interface names (GigabitEthernet0/0, Serial0/0/0, etc.)
6. Include proper subnetting and routing protocols when applicable`,

      switch: `You are a Cisco switch configuration expert. Generate ONLY valid Cisco IOS commands for switches.
DEVICE: ${deviceType.toUpperCase()} (Model: ${model}, IOS: ${ios_version})

RULES:
1. Output ONLY executable Cisco IOS commands
2. No explanations, comments, or markdown
3. Use proper command syntax and hierarchy
4. Include 'configure terminal' at start and 'end' at finish
5. Use realistic interface names (FastEthernet0/1, GigabitEthernet0/1, etc.)
6. Include VLAN configuration and trunk settings when applicable`
    };

    return deviceSpecificPrompts[deviceType.toLowerCase()] || deviceSpecificPrompts.router;
  }

  buildStructuredPrompt(prompt, deviceType, deviceContext) {
    const examples = this.getExampleConfigurations(deviceType);
    
    return `TASK: Configure ${deviceType} based on this request: "${prompt}"

EXAMPLE OUTPUT FORMAT:
${examples}

NOW GENERATE CONFIGURATION FOR: ${prompt}

CONFIGURATION:`;
  }

  getExampleConfigurations(deviceType) {
    const examples = {
      router: `configure terminal
hostname R1
interface GigabitEthernet0/0
ip address 192.168.1.1 255.255.255.0
no shutdown
router ospf 1
network 192.168.1.0 0.0.0.255 area 0
end`,

      switch: `configure terminal
hostname SW1
vlan 10
name DATA
vlan 20
name VOICE
interface FastEthernet0/1
switchport mode access
switchport access vlan 10
interface GigabitEthernet0/1
switchport mode trunk
switchport trunk allowed vlan 10,20
end`
    };

    return examples[deviceType.toLowerCase()] || examples.router;
  }

  extractCommands(response, deviceType) {
    // Remove any markdown code blocks
    let cleaned = response.replace(/```[\s\S]*?```/g, "");
    
    // Remove common non-command patterns
    cleaned = cleaned.replace(/^.*?CONFIGURATION:\s*/gmi, "");
    cleaned = cleaned.replace(/^.*?OUTPUT:\s*/gmi, "");
    cleaned = cleaned.replace(/Here.*?configuration.*?:/gmi, "");
    cleaned = cleaned.replace(/The.*?commands.*?:/gmi, "");
    
    // Split into lines and process
    const lines = cleaned
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => {
        if (!line) return false;

        // Skip explanatory text
        if (
          line.toLowerCase().includes("explanation") ||
          line.toLowerCase().includes("this command") ||
          line.toLowerCase().includes("note:") ||
          line.startsWith("#") ||
          line.startsWith("//") ||
          line.startsWith("!") ||
          line.includes("configures") ||
          line.includes("enables") ||
          line.includes("sets up")
        ) {
          return false;
        }

        // Enhanced Cisco command detection
        const ciscoCommandPatterns = [
          /^configure terminal$/,
          /^end$/,
          /^exit$/,
          /^interface /,
          /^vlan /,
          /^username /,
          /^ip /,
          /^hostname /,
          /^enable /,
          /^service /,
          /^no /,
          /^router /,
          /^access-list /,
          /^line /,
          /^switchport /,
          /^spanning-tree /,
          /^vtp /,
          /^\s+(ip address|no shutdown|switchport|description|encapsulation)/,
          /^\s+(network|area|router-id|passive-interface)/,
          /^\s+\w+/ // Indented commands (sub-commands)
        ];

        return ciscoCommandPatterns.some(pattern => pattern.test(line));
      });

    // Ensure proper command structure
    let commands = lines.join("\n").trim();
    
    // Add configure terminal if not present
    if (!commands.includes("configure terminal")) {
      commands = "configure terminal\n" + commands;
    }
    
    // Add end if not present
    if (!commands.includes("end") && !commands.endsWith("exit")) {
      commands = commands + "\nend";
    }

    return commands;
  }

  async validateConfiguration(configuration, deviceType) {
    try {
      if (!configuration || configuration.trim().length === 0) {
        return {
          isValid: false,
          feedback: "No configuration provided for validation.",
          suggestions: ["Generate a configuration first."],
        };
      }

      const validationPrompt = `Analyze this Cisco ${deviceType} configuration for syntax errors:

${configuration}

Check for:
1. Proper command syntax
2. Correct interface naming
3. Valid IP addressing
4. Proper command hierarchy

Respond with:
- "VALID" if configuration is syntactically correct
- "INVALID - [specific issues found]" if there are problems

ANALYSIS:`;

      const response = await this.client.post("/api/generate", {
        model: this.model,
        prompt: validationPrompt,
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 500,
          top_k: 10,
          top_p: 0.5,
        },
      });

      const validation = response.data.response.trim();
      const isValid = validation.toUpperCase().includes("VALID") && 
                     !validation.toUpperCase().includes("INVALID");

      const configLines = configuration
        .split("\n")
        .filter((line) => line.trim() && !line.startsWith("!"));

      // Enhanced validation metrics
      const validCommands = this.countValidCommands(configuration);
      const totalCommands = configLines.length;
      const accuracy = validCommands / Math.max(totalCommands, 1);

      return {
        isValid,
        feedback: validation,
        accuracy: Math.min(accuracy, 1.0),
        confidence: isValid ? 0.9 : 0.6,
        validCommands,
        totalCommands,
        suggestions: isValid ? [] : this.getValidationSuggestions(validation),
      };
    } catch (error) {
      console.error("❌ Validation error:", error.message);
      return {
        isValid: false,
        feedback: "Validation service unavailable - please check manually",
        accuracy: 0.5,
        confidence: 0.3,
        suggestions: ["Verify Ollama service is running", "Check model availability"],
      };
    }
  }

  countValidCommands(configuration) {
    const commands = configuration.split("\n").filter(line => line.trim());
    const validPatterns = [
      /^configure terminal$/,
      /^interface /,
      /^vlan /,
      /^hostname /,
      /^ip /,
      /^router /,
      /^switchport /,
      /^\s+/,
      /^end$/
    ];

    return commands.filter(cmd => 
      validPatterns.some(pattern => pattern.test(cmd.trim()))
    ).length;
  }

  getValidationSuggestions(validation) {
    const suggestions = [];
    const lowerValidation = validation.toLowerCase();

    if (lowerValidation.includes("interface")) {
      suggestions.push("Check interface naming convention (e.g., GigabitEthernet0/0)");
    }
    if (lowerValidation.includes("ip address")) {
      suggestions.push("Verify IP address format and subnet mask");
    }
    if (lowerValidation.includes("vlan")) {
      suggestions.push("Ensure VLAN IDs are within valid range (1-4094)");
    }
    if (lowerValidation.includes("syntax")) {
      suggestions.push("Review command syntax and hierarchy");
    }

    return suggestions.length > 0 ? suggestions : ["Review configuration manually"];
  }

  getConfigurationSuggestions(deviceType) {
    const suggestions = {
      router: [
        "Specify interfaces needed (e.g., 'configure 2 GigabitEthernet interfaces')",
        "Include routing protocol (e.g., 'enable OSPF routing')",
        "Mention IP addressing scheme (e.g., '192.168.1.0/24 network')",
        "Add security requirements (e.g., 'enable SSH access')"
      ],
      switch: [
        "Specify VLANs needed (e.g., 'create VLANs 10, 20, 30')",
        "Mention port types (e.g., 'configure access and trunk ports')",
        "Include STP settings (e.g., 'enable rapid spanning tree')",
        "Add management interface (e.g., 'configure VLAN 1 management')"
      ]
    };

    return suggestions[deviceType.toLowerCase()] || suggestions.router;
  }

  async getServiceStatus() {
    try {
      const response = await this.client.get("/api/tags");
      const models = response.data.models || [];
      const currentModel = models.find((m) => m.name === this.model);

      // Check for CodeLlama variants
      const codeLlamaModels = models.filter(m => 
        m.name.toLowerCase().includes("codellama")
      );

      return {
        status: "connected",
        service: "Ollama",
        host: this.host,
        model: this.model,
        modelAvailable: !!currentModel,
        availableModels: models.map((m) => m.name),
        recommendedModels: codeLlamaModels.map(m => m.name),
        optimizedFor: "CodeLlama 13B",
      };
    } catch (error) {
      return {
        status: "disconnected",
        service: "Ollama",
        host: this.host,
        model: this.model,
        modelAvailable: false,
        error: error.message,
        recommendation: "Ensure Ollama is running and CodeLlama model is pulled",
      };
    }
  }

  async explainConfiguration(configuration) {
    try {
      const prompt = `Explain this Cisco configuration in clear, technical terms:

${configuration}

Focus on:
1. What each section does
2. Network topology implications
3. Security considerations
4. Best practices used

EXPLANATION:`;

      const response = await this.client.post("/api/generate", {
        model: this.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.4,
          num_predict: 1000,
          top_k: 20,
          top_p: 0.7,
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
        explanation: "Unable to generate explanation - service may be unavailable",
        error: error.message,
      };
    }
  }

  // New method for generating device-specific templates
  async generateTemplate(deviceType, templateType = "basic") {
    const templates = {
      router: {
        basic: "Configure basic router with 2 interfaces, OSPF routing, and SSH access",
        advanced: "Configure enterprise router with VRF, BGP, and security features",
        branch: "Configure branch office router with DMVPN and QoS"
      },
      switch: {
        basic: "Configure basic switch with VLANs 10,20,30 and trunk ports",
        advanced: "Configure distribution switch with STP, VTP, and port security",
        access: "Configure access switch with voice VLANs and PoE"
      }
    };

    const template = templates[deviceType.toLowerCase()]?.[templateType];
    if (!template) {
      return {
        success: false,
        error: "Template not found",
        availableTemplates: Object.keys(templates[deviceType.toLowerCase()] || {})
      };
    }

    return await this.generateConfiguration(template, deviceType);
  }
}

export default new AIService();