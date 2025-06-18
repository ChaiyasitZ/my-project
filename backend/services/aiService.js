import axios from 'axios';
import { config } from '../config/config.js';

export class AIService {
  constructor() {
    this.apiKey = config.openrouter.apiKey;
    this.model = config.openrouter.model;
    this.baseUrl = config.openrouter.baseUrl;
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:5173', // Your app's URL
        'X-Title': 'Network Automation Tool', // Your app's name
      },
    });
  }

  async generateConfiguration(prompt, deviceType, deviceContext = {}) {
    try {
      const systemPrompt = this.buildSystemPrompt(deviceType, deviceContext);
      
      const response = await this.client.post('/chat/completions', {
        model: this.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1, // Low temperature for consistent technical output
        max_tokens: 2000,
        stream: false
      });

      const generatedConfig = response.data.choices[0].message.content.trim();
      
      // Extract configuration commands (remove explanations if any)
      const configLines = this.extractConfigCommands(generatedConfig);
      
      return {
        success: true,
        configuration: configLines,
        rawResponse: generatedConfig,
        model: this.model,
        tokensUsed: response.data.usage || {}
      };
      
    } catch (error) {
      console.error('❌ AI Service Error:', error.response?.data || error.message);
      
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
        configuration: null
      };
    }
  }

  buildSystemPrompt(deviceType, deviceContext) {
    const { model, ios_version, location } = deviceContext;
    
    return `You are an expert Cisco network engineer with deep knowledge of Cisco IOS configurations.

DEVICE CONTEXT:
- Device Type: ${deviceType} (switch or router)
- Model: ${model || 'Generic Cisco device'}
- IOS Version: ${ios_version || 'Generic IOS'}
- Location: ${location || 'Not specified'}

INSTRUCTIONS:
1. Generate ONLY valid Cisco IOS configuration commands
2. Do NOT include any explanations, comments, or markdown formatting
3. Each command should be on a separate line
4. Use proper Cisco IOS syntax and command structure
5. Consider best practices for security and performance
6. If the request is unclear, make reasonable assumptions based on common configurations
7. Do NOT include "configure terminal", "end", or "write memory" commands as these are handled automatically
8. Focus on the actual configuration commands only

EXAMPLES OF GOOD RESPONSES:
For VLAN configuration:
vlan 100
 name Sales_VLAN
interface vlan100
 ip address 192.168.100.1 255.255.255.0
 no shutdown

For interface configuration:
interface gigabitethernet0/1
 description Connection to Server
 switchport mode access
 switchport access vlan 100
 no shutdown

IMPORTANT: Respond with configuration commands only, no explanations or additional text.`;
  }

  extractConfigCommands(response) {
    // Remove any markdown code blocks
    let config = response.replace(/```[\s\S]*?```/g, '');
    
    // Remove any lines that start with explanatory text or comments
    const lines = config.split('\n')
      .map(line => line.trim())
      .filter(line => {
        // Keep empty lines for formatting
        if (line === '') return true;
        
        // Remove explanatory text (lines that don't start with typical IOS commands)
        const iosCommandPatterns = [
          /^interface\s+/i,
          /^vlan\s+/i,
          /^ip\s+/i,
          /^no\s+/i,
          /^name\s+/i,
          /^description\s+/i,
          /^switchport\s+/i,
          /^spanning-tree\s+/i,
          /^router\s+/i,
          /^network\s+/i,
          /^area\s+/i,
          /^access-list\s+/i,
          /^permit\s+/i,
          /^deny\s+/i,
          /^shutdown/i,
          /^exit/i,
          /^\s+/i, // Indented commands (sub-commands)
        ];
        
        return iosCommandPatterns.some(pattern => pattern.test(line));
      });
    
    return lines.join('\n').trim();
  }

  async validateConfiguration(configuration, deviceType) {
    try {
      const validationPrompt = `Validate this Cisco ${deviceType} configuration for syntax errors and best practices:

${configuration}

Respond with:
1. "VALID" if configuration is correct
2. "INVALID" followed by specific issues if there are problems
3. Keep response concise and technical`;

      const response = await this.client.post('/chat/completions', {
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a Cisco IOS configuration validator. Respond concisely with validation results.'
          },
          {
            role: 'user',
            content: validationPrompt
          }
        ],
        temperature: 0,
        max_tokens: 500
      });

      const validation = response.data.choices[0].message.content.trim();
      
      return {
        isValid: validation.toUpperCase().startsWith('VALID'),
        feedback: validation,
        suggestions: validation.includes('INVALID') ? validation.split('INVALID')[1]?.trim() : null
      };
      
    } catch (error) {
      console.error('❌ Configuration validation error:', error.message);
      return {
        isValid: false,
        feedback: 'Validation service unavailable',
        suggestions: null
      };
    }
  }

  async explainConfiguration(configuration) {
    try {
      const response = await this.client.post('/chat/completions', {
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a Cisco network expert. Explain configuration commands clearly and concisely.'
          },
          {
            role: 'user',
            content: `Explain what this Cisco configuration does:\n\n${configuration}`
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      });

      return {
        success: true,
        explanation: response.data.choices[0].message.content.trim()
      };
      
    } catch (error) {
      return {
        success: false,
        explanation: 'Unable to generate explanation'
      };
    }
  }
}

export default new AIService(); 