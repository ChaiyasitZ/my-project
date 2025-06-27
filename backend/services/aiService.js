import axios from "axios";
import { config } from "../config/config.js";

export class AIService {
  constructor() {
    this.host = config.ollama.host;
    this.model = config.ollama.model;

    this.client = axios.create({
      baseURL: this.host,
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 30000,
    });
  }

  async generateConfiguration(prompt, deviceType, deviceContext = {}) {
    try {
      console.log(`🤖 Generating ${deviceType} configuration for: "${prompt}"`);

      const systemPrompt = `You are a Cisco ${deviceType} configuration expert. Generate valid Cisco IOS commands.

RULES:
1. Output ONLY executable Cisco IOS commands
2. No explanations or comments
3. Start with 'configure terminal' and end with 'end'
4. Use proper command syntax

Generate configuration for: ${prompt}`;

      const response = await this.client.post("/api/generate", {
        model: this.model,
        prompt: systemPrompt,
        stream: false,
        options: {
          temperature: 0.3,
          top_k: 40,
          top_p: 0.9,
          num_predict: 1000,
        },
      });

      const rawResponse = response.data.response.trim();
      console.log("🤖 Raw AI Response:", rawResponse);

      if (!rawResponse || rawResponse.length < 10) {
        return {
          success: false,
          error: `AI could not generate configuration for ${deviceType}`,
          configuration: null,
        };
      }

      return {
        success: true,
        configuration: rawResponse,
        model: this.model,
        deviceType: deviceType,
      };
    } catch (error) {
      console.error("❌ AI Service Error:", error.message);
      return {
        success: false,
        error: `AI Service Error: ${error.message}`,
        configuration: null,
      };
    }
  }

  async validateConfiguration(configuration, deviceType) {
    try {
      if (!configuration || configuration.trim().length === 0) {
        return {
          isValid: false,
          feedback: "No configuration provided",
        };
      }

      // Simple validation - just check if it has basic structure
      const hasConfigTerminal = configuration.includes("configure terminal");
      const hasEnd = configuration.includes("end");
      const lines = configuration.split('\n').filter(line => line.trim());
      
      return {
        isValid: hasConfigTerminal && hasEnd && lines.length > 2,
        feedback: hasConfigTerminal && hasEnd ? "Basic structure looks correct" : "Missing configure terminal or end",
      };
    } catch (error) {
      console.error("❌ Validation error:", error.message);
      return {
        isValid: false,
        feedback: "Validation failed",
      };
    }
  }

  async getServiceStatus() {
    try {
      const response = await this.client.get("/api/tags");
      const models = response.data.models || [];
      const currentModel = models.find((m) => m.name === this.model);

      return {
        status: "connected",
        service: "Ollama",
        host: this.host,
        model: this.model,
        modelAvailable: !!currentModel,
        availableModels: models.map((m) => m.name),
      };
    } catch (error) {
      return {
        status: "disconnected",
        service: "Ollama",
        host: this.host,
        model: this.model,
        modelAvailable: false,
        error: error.message,
      };
    }
  }

  async explainConfiguration(configuration) {
    try {
      const prompt = `Explain this Cisco configuration:

${configuration}

Provide a brief explanation of what this configuration does.`;

      const response = await this.client.post("/api/generate", {
        model: this.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.5,
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