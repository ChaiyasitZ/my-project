import axios from 'axios';
import agentRelay from './agentRelay.js';

/**
 * LLM Service for Cisco Configuration Generation
 * Supports two providers:
 *   1. OpenRouter (cloud) - direct API call
 *   2. Ollama (local)     - relayed through user's agent to local Ollama instance
 * 
 * Features:
 * - Response caching for repeated prompts
 * - Rate limiting protection
 * - Comprehensive error handling
 * - NETCONF/YANG XML generation support
 */
export class LLMService {
  constructor() {
    // Configuration
    this.provider = process.env.LLM_PROVIDER || 'openrouter';
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
    this.model = process.env.OPENROUTER_MODEL || '';
    this.ollamaModel = process.env.OLLAMA_MODEL || 'llama3.2';
    this.apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
    this.timeout = 120000; // 120 seconds
    
    // HTTP Client for OpenRouter
    this.client = axios.create({
      baseURL: 'https://openrouter.ai/api/v1',
      timeout: this.timeout,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'http://localhost:3001', // Optional: your app URL
        'X-Title': 'Cisco Network Automation', // Optional: app name
        'Content-Type': 'application/json'
      }
    });
    
    // Optimized parameters for Cisco configuration generation
    this.defaultParams = {
      temperature: 0.1,        // Low for deterministic output
      max_tokens: 1000,        // Enough for complex configs
      top_p: 0.85,             // Balanced probability
      frequency_penalty: 0.3,  // Reduce repetition
      presence_penalty: 0.2,   // Encourage variety
      stop: ['```', 'Here are', 'Here is', 'Sure', 'Note:', '---']
    };
    
    // Response cache with TTL (5 minutes default)
    this.cache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes
    this.maxCacheSize = 100;
    
    // Rate limiting protection
    this.rateLimiter = {
      requests: [],
      maxRequests: 30,      // Max requests per minute
      windowMs: 60 * 1000   // 1 minute window
    };
    
    // Statistics tracking
    this.stats = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      totalTokens: 0
    };
    
    // Knowledge base for enhanced context
    this.knowledgeBase = this._initializeKnowledgeBase();

    // In-memory prompt templates (can be strings or functions)
    this.promptTemplates = {
      cisco_cli: {
        system: (prompt, deviceType) => this._buildSystemMessage(prompt, deviceType),
        user: (prompt, deviceType, deviceContext) => this._buildUserMessage(prompt, deviceType, deviceContext)
      }
    };
    
    if (!this.apiKey || this.apiKey === 'your_openrouter_api_key_here') {
      if (this.provider === 'ollama') {
        console.log(`🤖 LLM Provider: Ollama (via agent) — model: ${this.ollamaModel}`);
        console.log(`   OpenRouter API key not needed in Ollama mode.`);
      } else {
        console.warn(`⚠️ OpenRouter API key not configured! Please set OPENROUTER_API_KEY in .env`);
      }
    } else {
      console.log(`..........................`);
    }

    if (this.provider === 'ollama') {
      console.log(`🤖 LLM Provider: Ollama (via agent) — model: ${this.ollamaModel}`);
    }
    
    // Clean up expired cache entries periodically (store interval ID for shutdown)
    this.cacheCleanupInterval = setInterval(() => this._cleanupCache(), 60000);
  }
  
  /**
   * Generate cache key from prompt and parameters
   */
  _getCacheKey(prompt, deviceType, configType = 'cli') {
    return `${configType}:${deviceType}:${prompt.toLowerCase().trim()}`;
  }
  
  /**
   * Get cached response if available and not expired
   */
  _getFromCache(cacheKey) {
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      this.stats.cacheHits++;
      console.log(`📦 Cache hit for: ${cacheKey.substring(0, 50)}...`);
      return cached.data;
    }
    if (cached) {
      this.cache.delete(cacheKey);
    }
    this.stats.cacheMisses++;
    return null;
  }
  
  /**
   * Store response in cache
   */
  _setCache(cacheKey, data) {
    // Limit cache size
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(cacheKey, { data, timestamp: Date.now() });
  }
  
  /**
   * Clean up expired cache entries
   */
  _cleanupCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheTTL) {
        this.cache.delete(key);
      }
    }
  }
  
  /**
   * Check rate limit before making API request
   */
  _checkRateLimit() {
    const now = Date.now();
    // Remove requests outside the window
    this.rateLimiter.requests = this.rateLimiter.requests.filter(
      time => now - time < this.rateLimiter.windowMs
    );
    
    if (this.rateLimiter.requests.length >= this.rateLimiter.maxRequests) {
      const oldestRequest = this.rateLimiter.requests[0];
      const waitTime = Math.ceil((this.rateLimiter.windowMs - (now - oldestRequest)) / 1000);
      throw new Error(`Rate limit exceeded. Please wait ${waitTime} seconds before trying again.`);
    }
    
    this.rateLimiter.requests.push(now);
  }
  
  /**
   * Get service statistics
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.cache.size,
      cacheHitRate: this.stats.totalRequests > 0 
        ? ((this.stats.cacheHits / this.stats.totalRequests) * 100).toFixed(1) + '%'
        : '0%'
    };
  }
  
  /**
   * Clear all cached responses
   */
  clearCache() {
    this.cache.clear();
    console.log('🗑️ LLM response cache cleared');
  }

  /**
   * Check if this service is running in Ollama mode
   */
  isOllamaMode() {
    return this.provider === 'ollama';
  }

  /**
   * Get the effective model name for the current provider
   */
  getActiveModel() {
    return this.provider === 'ollama' ? this.ollamaModel : this.model;
  }

  /**
   * Unified chat completion call — routes to OpenRouter or Ollama via agent.
   * 
   * @param {Array<{role:string,content:string}>} messages - Chat messages
   * @param {Object} params - temperature, max_tokens, top_p, etc.
   * @param {string|null} userId - Required for Ollama mode (to find user's agent)
   * @returns {Object} OpenAI-compatible response: { choices, usage, model, provider, pending?, commandId? }
   */
  async _callChatCompletion(messages, params = {}, userId = null) {
    if (this.provider === 'ollama') {
      return this._chatViaOllama(userId, messages, params);
    }
    // Default: OpenRouter direct API call
    const response = await this.client.post('/chat/completions', {
      model: params.model || this.model,
      messages,
      temperature: params.temperature ?? this.defaultParams.temperature,
      max_tokens: params.max_tokens ?? this.defaultParams.max_tokens,
      top_p: params.top_p ?? this.defaultParams.top_p,
      frequency_penalty: params.frequency_penalty ?? this.defaultParams.frequency_penalty,
      presence_penalty: params.presence_penalty ?? this.defaultParams.presence_penalty,
      stop: params.stop ?? this.defaultParams.stop
    });
    return response.data;
  }

  /**
   * Send a chat completion through the user's agent to local Ollama.
   * Long-polls for up to 8 seconds; returns { pending, commandId } if not done.
   * 
   * @param {string} userId 
   * @param {Array} messages 
   * @param {Object} params 
   * @returns {Object} OpenAI-compatible response or { pending, commandId }
   */
  async _chatViaOllama(userId, messages, params = {}) {
    if (!userId) {
      throw new Error('Ollama mode requires an active agent. Please start the NetConfig Agent on your computer.');
    }

    const isOnline = await agentRelay.isAgentOnline(userId);
    if (!isOnline) {
      throw new Error('Agent not connected. Please start the NetConfig Agent with Ollama to use AI features.');
    }

    const result = await agentRelay.sendToAgent(userId, 'agent:ollama:chat', {
      messages,
      model: params.model || this.ollamaModel,
      temperature: params.temperature ?? this.defaultParams.temperature,
      max_tokens: params.max_tokens ?? this.defaultParams.max_tokens,
      top_p: params.top_p ?? this.defaultParams.top_p,
      frequency_penalty: params.frequency_penalty ?? this.defaultParams.frequency_penalty,
      presence_penalty: params.presence_penalty ?? this.defaultParams.presence_penalty,
      stop: params.stop ?? this.defaultParams.stop
    }, 8000);

    // If the agent didn't respond within 8s, return pending for async polling
    if (result.pending) {
      return { pending: true, commandId: result.commandId };
    }

    // Result should be OpenAI-compatible: { choices, usage, model, provider }
    return result;
  }

  /**
   * Generate a raw text completion from a simple prompt
   * Used for translation and other simple text generation tasks
   * @param {string} prompt 
   * @param {string|null} userId - Required when provider is 'ollama'
   */
  async generateRawCompletion(prompt, userId = null) {
    try {
      // In Ollama mode, skip API key check
      if (this.provider !== 'ollama') {
        if (!this.apiKey || this.apiKey === 'your_openrouter_api_key_here') {
          throw new Error('OpenRouter API key not configured');
        }
      }
      
      // Check rate limit
      this._checkRateLimit();
      
      const messages = [{ role: 'user', content: prompt }];
      const params = { temperature: 0.3, max_tokens: 1000, stop: [] };

      const llmResponse = await this._callChatCompletion(messages, params, userId);

      // Handle async pending (Ollama took longer than 8s)
      if (llmResponse.pending) {
        return { pending: true, commandId: llmResponse.commandId };
      }
      
      const result = llmResponse?.choices?.[0]?.message?.content?.trim();
      
      if (!result) {
        throw new Error('Empty response from LLM');
      }
      
      return result;
    } catch (error) {
      console.error('Raw completion error:', error.message);
      throw error;
    }
  }

  /**
   * Generate backup name and description using LLM based on deployed configuration
   * Used for auto-backup after deployment to create meaningful metadata
   * 
   * @param {string} deployedConfig - The configuration that was deployed
   * @param {string} deviceName - Name of the device
   * @param {string} deviceType - Type of device (e.g., 'cisco_ios', 'cisco_nxos')
   * @param {string} originalPrompt - The original user prompt for the deployment
   * @returns {Object} { backup_name: string, description: string }
   */
  async generateBackupMetadata(deployedConfig, deviceName, deviceType, originalPrompt = '', userId = null) {
    try {
      // Check API key (skip in Ollama mode)
      if (this.provider !== 'ollama') {
        if (!this.apiKey || this.apiKey === 'your_openrouter_api_key_here') {
          console.warn('⚠️ LLM API key not configured, using fallback backup metadata');
          return this._generateFallbackBackupMetadata(deviceName, originalPrompt);
        }
      }
      
      // Check rate limit
      this._checkRateLimit();
      
      const systemPrompt = `You are a network automation assistant. Analyze the deployed configuration and generate a concise backup name and description.

Rules:
1. backup_name: Maximum 50 characters, format: "Post-Deploy: [brief change summary]"
2. description: Maximum 200 characters, summarize what was configured
3. Be specific about the configuration changes (interfaces, VLANs, routing, ACLs, etc.)
4. Use technical but readable language
5. Return ONLY valid JSON, no markdown or extra text

Example output:
{"backup_name": "Post-Deploy: VLAN 100 & Trunk Config", "description": "Configured VLAN 100 for Sales department and trunk port on Gi0/1 with allowed VLANs 100,200"}`;

      const userPrompt = `Device: ${deviceName} (${deviceType})
${originalPrompt ? `Original Request: ${originalPrompt}\n` : ''}
Deployed Configuration:
${deployedConfig.substring(0, 1500)}${deployedConfig.length > 1500 ? '\n... (truncated)' : ''}

Generate backup_name and description as JSON:`;

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];
      const params = { temperature: 0.3, max_tokens: 300, stop: [] };

      const llmResponse = await this._callChatCompletion(messages, params, userId);

      // If pending (Ollama async), use fallback metadata
      if (llmResponse.pending) {
        console.warn('⚠️ Ollama generation pending, using fallback backup metadata');
        return this._generateFallbackBackupMetadata(deviceName, originalPrompt);
      }
      
      const result = llmResponse?.choices?.[0]?.message?.content?.trim();
      
      if (!result) {
        console.warn('⚠️ Empty LLM response, using fallback backup metadata');
        return this._generateFallbackBackupMetadata(deviceName, originalPrompt);
      }
      
      // Parse JSON response
      try {
        // Clean up response - remove markdown code blocks if present
        let cleanResult = result;
        if (result.includes('```')) {
          cleanResult = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        }
        
        const parsed = JSON.parse(cleanResult);
        
        // Validate and sanitize
        const backup_name = (parsed.backup_name || '').substring(0, 100) || 
          `Post-Deploy: ${deviceName} - ${new Date().toISOString().split('T')[0]}`;
        const description = (parsed.description || '').substring(0, 500) || 
          `Auto-generated backup after configuration deployment`;
        
        console.log(`✅ LLM generated backup metadata: ${backup_name}`);
        
        return { backup_name, description };
        
      } catch (parseError) {
        console.warn(`⚠️ Failed to parse LLM response: ${parseError.message}`);
        console.warn(`Raw response: ${result.substring(0, 200)}`);
        return this._generateFallbackBackupMetadata(deviceName, originalPrompt);
      }
      
    } catch (error) {
      console.error('❌ Error generating backup metadata:', error.message);
      return this._generateFallbackBackupMetadata(deviceName, originalPrompt);
    }
  }

  /**
   * Fallback backup metadata when LLM is not available
   */
  _generateFallbackBackupMetadata(deviceName, originalPrompt = '') {
    const timestamp = new Date().toISOString().split('T')[0];
    const shortPrompt = originalPrompt ? originalPrompt.substring(0, 30) : 'Config Change';
    
    return {
      backup_name: `Post-Deploy: ${deviceName} - ${timestamp}`,
      description: originalPrompt 
        ? `Auto backup after deployment: ${originalPrompt.substring(0, 150)}${originalPrompt.length > 150 ? '...' : ''}`
        : `Auto backup after configuration deployment on ${deviceName}`
    };
  }

  /**
   * Generate Cisco configuration from text prompt
   * Routes to OpenRouter (cloud) or Ollama (local via agent) depending on provider setting.
   * 
   * @param {string} prompt
   * @param {string} deviceType
   * @param {Object} deviceContext
   * @param {string} templateName
   * @param {boolean} useCache
   * @param {Object} options - { userId } required for Ollama mode
   * @returns {Object} Generation result or { pending, commandId } for async Ollama
   */
  async generateConfiguration(prompt, deviceType, deviceContext = {}, templateName = 'cisco_cli', useCache = true, options = {}) {
    const startTime = Date.now();
    this.stats.totalRequests++;
    
    try {
      console.log(`🚀 Generating config for ${deviceType}: "${prompt}"`);

      // Check API key (skip in Ollama mode)
      if (this.provider !== 'ollama') {
        if (!this.apiKey || this.apiKey === 'your_openrouter_api_key_here') {
          throw new Error('OpenRouter API key not configured. Please set OPENROUTER_API_KEY in .env file');
        }
      }
      
      // Check cache first (if enabled)
      if (useCache) {
        const cacheKey = this._getCacheKey(prompt, deviceType, 'cli');
        const cachedResult = this._getFromCache(cacheKey);
        if (cachedResult) {
          return {
            ...cachedResult,
            fromCache: true,
            executionTime: Date.now() - startTime
          };
        }
      }
      
      // Check rate limit
      this._checkRateLimit();

      // Build system/user messages - use named template when available
      let systemMessage;
      let userMessage;
      const built = this.buildFromTemplate(templateName, prompt, deviceType, deviceContext);
      if (built.success) {
        systemMessage = built.system;
        userMessage = built.user;
        console.log(`🧩 Using prompt template: ${templateName}`);
      } else {
        // Fallback to default builders
        systemMessage = this._buildSystemMessage(prompt, deviceType);
        userMessage = this._buildUserMessage(prompt, deviceType, deviceContext);
      }
      
      console.log(`📝 System message length: ${systemMessage.length} characters`);
      console.log(`📝 User message length: ${userMessage.length} characters`);
      console.log(`🎯 Using model: ${this.getActiveModel()} (${this.provider})`);
      
      const messages = [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage }
      ];

      // Call LLM (OpenRouter or Ollama via agent) with retry logic
      let llmResponse;
      let retryCount = 0;
      const maxRetries = this.provider === 'ollama' ? 0 : 2; // No retries for Ollama (async)
      
      while (retryCount <= maxRetries) {
        try {
          llmResponse = await this._callChatCompletion(messages, this.defaultParams, options.userId || null);
          break; // Success, exit retry loop
        } catch (apiError) {
          retryCount++;
          if (retryCount > maxRetries) {
            throw this.provider === 'ollama' ? apiError : this._handleApiError(apiError);
          }
          console.log(`⚠️ Retry ${retryCount}/${maxRetries} after error: ${apiError.message}`);
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }

      // Handle async pending (Ollama generation still in progress)
      if (llmResponse.pending) {
        return {
          success: true,
          pending: true,
          commandId: llmResponse.commandId,
          message: 'Configuration generation in progress via Ollama. Poll for result.'
        };
      }

      // Parse LLM response (same format for both OpenRouter and Ollama)
      const rawConfig = llmResponse?.choices?.[0]?.message?.content?.trim();
      
      if (!rawConfig) {
        console.error(`❌ Empty response from ${this.provider}`);
        console.error(`❌ Response structure:`, JSON.stringify(llmResponse, null, 2).substring(0, 500));
        throw new Error(`Empty response from ${this.getActiveModel()} - API may have issues`);
      }
      
      console.log(`📦 Raw response: ${rawConfig.length} chars`);
      console.log(`📄 Raw output preview:\n${rawConfig.substring(0, 200)}...`);
      
      // Clean and validate configuration
      const cleanConfig = this._cleanConfiguration(rawConfig);
      
      if (!cleanConfig || cleanConfig.length < 5) {
        console.error(`❌ Configuration too short after cleaning: ${cleanConfig.length} chars`);
        throw new Error(`Generated configuration is too short or empty`);
      }
      
      // CRITICAL: Log the actual commands to help debug issues
      console.log(`📋 Commands after cleaning (first 500 chars):`);
      const preview = cleanConfig.substring(0, 500);
      console.log(preview);
      
      // Show character codes for first line to detect invisible characters
      const firstLine = cleanConfig.split('\n')[0] || '';
      const charCodes = firstLine.split('').map(c => c.charCodeAt(0)).join(',');
      console.log(`🔍 First line char codes: ${charCodes.substring(0, 100)}...`);
      
  // Ensure trunk allowed VLANs are present when the prompt requests a trunk
  const ensuredConfig = this._ensureTrunkAllowed(cleanConfig, prompt);

  const deploymentConfig = this._createDeploymentVersion(ensuredConfig);
  const validation = this._validateConfiguration(ensuredConfig, deviceType);
      
      const executionTime = Date.now() - startTime;
      const tokensUsed = llmResponse?.usage?.total_tokens || 0;
      
      console.log(`✅ Generated successfully (${executionTime}ms, ${tokensUsed} tokens)`);
      console.log(`📋 Clean config:\n${cleanConfig.substring(0, 200)}...`);
      console.log(`✅ Validation score: ${validation.score}/100`);
      
      const activeModel = this.getActiveModel();
      const result = {
        success: true,
        configuration: deploymentConfig,
        displayConfig: ensuredConfig,
        deploymentConfig,
        model: activeModel,
        provider: this.provider,
        deviceType,
        method: `${this.provider}_chat`,
        executionTime,
        tokensUsed,
        validation,
        confidenceScore: validation.score,
        recommendations: validation.warnings.length > 0 ? validation.warnings : ['Configuration looks good'],
        fromCache: false
      };
      
      // Cache the successful result
      if (useCache) {
        const cacheKey = this._getCacheKey(prompt, deviceType, 'cli');
        this._setCache(cacheKey, result);
      }
      
      // Update stats
      this.stats.totalTokens += tokensUsed;
      
      return result;
      
    } catch (error) { 
      const executionTime = Date.now() - startTime;
      this.stats.errors++;
      console.error("❌ Generation failed:", error.message);
      console.error("❌ Full error:", error);
      
      // Provide helpful error messages
      let userMessage = error.message;
      if (error.response?.status === 401) {
        userMessage = 'Invalid OpenRouter API key. Please check your OPENROUTER_API_KEY in .env';
      } else if (error.response?.status === 429) {
        userMessage = 'Rate limit exceeded. Please wait a moment and try again.';
      } else if (error.response?.status === 402) {
        userMessage = 'Insufficient credits. Please add credits to your OpenRouter account.';
      } else if (error.code === 'ECONNREFUSED') {
        userMessage = 'Cannot connect to OpenRouter API. Check your internet connection.';
      } else if (error.message.includes('timeout')) {
        userMessage = 'Request timed out. The model may be busy.';
      }
      
      return {
        success: false,
        error: `Generation failed: ${userMessage}`,
        configuration: null,
        executionTime,
        suggestions: [
          'Check your internet connection',
          'Try a different model if the current one is unavailable',
          'Simplify your prompt if it\'s too complex'
        ]
      };
    }
  }

  /**
   * Generate coordinated CLI configurations for multiple devices in a single LLM call.
   * The LLM sees all devices and their roles so it can assign different but compatible
   * settings (e.g., matching IPs on point-to-point links).
   *
   * @param {string} prompt - User's configuration request
   * @param {Array} devices - Array of { name, type, model, location, _id }
   * @param {Object} options - { userId } for Ollama relay
   * @returns {Object} { success, configs: { [deviceName]: { configuration, displayConfig, ... } } }
   */
  async generateMultiDeviceConfiguration(prompt, devices, options = {}) {
    const startTime = Date.now();
    this.stats.totalRequests++;

    try {
      console.log(`🚀 Multi-device generation for ${devices.length} devices: "${prompt}"`);

      if (this.provider !== 'ollama') {
        if (!this.apiKey || this.apiKey === 'your_openrouter_api_key_here') {
          throw new Error('OpenRouter API key not configured.');
        }
      }

      this._checkRateLimit();

      // Build device list for the prompt
      const deviceList = devices.map((d, i) => {
        const model = d.model || 'Generic Cisco';
        return `${i + 1}. ${d.name} (${d.type} - ${model})`;
      }).join('\n');
      const deviceNames = devices.map(d => d.name);

      const relevantKnowledge = this._getRelevantKnowledge(prompt);

      // Pre-process prompt
      let processedPrompt = this._preprocessCIDR(prompt);
      processedPrompt = this._standardizeInterfaceNames(processedPrompt);

      const systemMessage = `You are a Cisco IOS command generator expert. Your job is to generate coordinated CLI configurations for MULTIPLE devices that work together as a network.

RELEVANT KNOWLEDGE:
${relevantKnowledge}

CRITICAL PROTOCOL-SPECIFIC RULES:
1. OSPF: Does NOT support "no auto-summary" command (OSPF is classless by default)
2. EIGRP: MUST include "no auto-summary" for modern VLSM networks
3. RIP: Use "version 2" with "no auto-summary" for classless operation
4. BGP: Does not use auto-summary command

MULTI-DEVICE COORDINATION RULES:
1. Each device MUST get its own UNIQUE configuration appropriate for its role
2. For point-to-point links (/30 or /31), assign consecutive IPs (e.g., .1 and .2 for /30, .0 and .1 for /31)
3. Ensure routing neighbor relationships match (OSPF areas, EIGRP AS, BGP neighbors)
4. Interface descriptions should reference the peer device
5. All devices must have consistent and compatible settings

OUTPUT FORMAT:
- Separate each device's config with a line: === DEVICE: <device_name> ===
- Generate ONLY configuration commands (no "configure terminal", no "end", no "exit")
- Use proper indentation (single space before sub-commands)
- NO explanations, NO comments, NO markdown, NO code blocks
- Each device section starts with === DEVICE: <name> === on its own line

EXAMPLE for 2 routers connecting via GigabitEthernet0/0 on 10.0.0.0/30:

=== DEVICE: R1 ===
interface GigabitEthernet0/0
 ip address 10.0.0.1 255.255.255.252
 description Link to R2
 no shutdown
=== DEVICE: R2 ===
interface GigabitEthernet0/0
 ip address 10.0.0.2 255.255.255.252
 description Link to R1
 no shutdown`;

      const userMessage = `Devices in this network:
${deviceList}

Configuration Request: ${processedPrompt}

Generate coordinated Cisco IOS commands for ALL ${devices.length} devices. Use === DEVICE: <name> === to separate each device's config:`;

      console.log(`📝 Multi-device system message: ${systemMessage.length} chars`);
      console.log(`📝 Multi-device user message: ${userMessage.length} chars`);

      const messages = [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage }
      ];

      // Call LLM with retry
      let llmResponse;
      let retryCount = 0;
      const maxRetries = this.provider === 'ollama' ? 0 : 2;

      while (retryCount <= maxRetries) {
        try {
          llmResponse = await this._callChatCompletion(messages, {
            ...this.defaultParams,
            max_tokens: Math.min((this.defaultParams.max_tokens || 4096) * devices.length, 16384)
          }, options.userId || null);
          break;
        } catch (apiError) {
          retryCount++;
          if (retryCount > maxRetries) throw this.provider === 'ollama' ? apiError : this._handleApiError(apiError);
          console.log(`⚠️ Retry ${retryCount}/${maxRetries}: ${apiError.message}`);
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }

      // Handle async Ollama pending
      if (llmResponse.pending) {
        return {
          success: true,
          pending: true,
          commandId: llmResponse.commandId,
          message: 'Multi-device generation in progress via Ollama.'
        };
      }

      const rawResponse = llmResponse?.choices?.[0]?.message?.content?.trim();
      if (!rawResponse) throw new Error('Empty response from LLM');

      console.log(`📦 Multi-device raw response: ${rawResponse.length} chars`);
      console.log(`📄 Preview:\n${rawResponse.substring(0, 400)}...`);

      // Parse per-device configs from the response
      const configs = this._parseMultiDeviceResponse(rawResponse, deviceNames);

      const executionTime = Date.now() - startTime;
      const tokensUsed = llmResponse?.usage?.total_tokens || 0;
      this.stats.totalTokens += tokensUsed;

      console.log(`✅ Multi-device generation complete (${executionTime}ms, ${tokensUsed} tokens)`);

      // Process each device's config (clean, validate, create deployment version)
      const processedConfigs = {};
      for (const device of devices) {
        const rawConfig = configs[device.name];
        if (!rawConfig) {
          processedConfigs[device.name] = {
            success: false,
            error: `No configuration found for ${device.name} in LLM response`
          };
          continue;
        }

        const cleanConfig = this._cleanConfiguration(rawConfig);
        if (!cleanConfig || cleanConfig.length < 5) {
          processedConfigs[device.name] = {
            success: false,
            error: `Configuration too short for ${device.name}`
          };
          continue;
        }

        const ensuredConfig = this._ensureTrunkAllowed(cleanConfig, prompt);
        const deploymentConfig = this._createDeploymentVersion(ensuredConfig);
        const validation = this._validateConfiguration(ensuredConfig, device.type);

        processedConfigs[device.name] = {
          success: true,
          configuration: deploymentConfig,
          displayConfig: ensuredConfig,
          deploymentConfig,
          model: this.getActiveModel(),
          provider: this.provider,
          deviceType: device.type,
          executionTime,
          tokensUsed: Math.round(tokensUsed / devices.length),
          validation,
          confidenceScore: validation.score,
          recommendations: validation.warnings.length > 0 ? validation.warnings : ['Configuration looks good'],
          fromCache: false
        };
      }

      return { success: true, configs: processedConfigs };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.stats.errors++;
      console.error('❌ Multi-device generation failed:', error.message);

      let userMessage = error.message;
      if (error.response?.status === 401) userMessage = 'Invalid API key.';
      else if (error.response?.status === 429) userMessage = 'Rate limit exceeded.';
      else if (error.response?.status === 402) userMessage = 'Insufficient credits.';

      return {
        success: false,
        error: `Multi-device generation failed: ${userMessage}`,
        configs: {}
      };
    }
  }

  /**
   * Parse a multi-device LLM response into per-device config strings.
   * Supports delimiter: === DEVICE: <name> ===
   */
  _parseMultiDeviceResponse(rawResponse, deviceNames) {
    const configs = {};

    // Split on === DEVICE: <name> === pattern
    const delimiter = /^={3,}\s*DEVICE:\s*(.+?)\s*={3,}\s*$/gmi;
    const parts = rawResponse.split(delimiter);

    // parts array: [preamble, name1, config1, name2, config2, ...]
    if (parts.length >= 3) {
      for (let i = 1; i < parts.length; i += 2) {
        const name = parts[i].trim();
        const config = (parts[i + 1] || '').trim();
        // Match to known device name (case-insensitive)
        const matchedDevice = deviceNames.find(d => d.toLowerCase() === name.toLowerCase());
        if (matchedDevice) {
          configs[matchedDevice] = config;
        } else {
          // Try partial match
          const partial = deviceNames.find(d => name.toLowerCase().includes(d.toLowerCase()) || d.toLowerCase().includes(name.toLowerCase()));
          if (partial && !configs[partial]) {
            configs[partial] = config;
          }
        }
      }
    }

    // Fallback: try --- DEVICE: name --- or similar patterns
    if (Object.keys(configs).length < deviceNames.length) {
      const altDelimiter = /^-{3,}\s*DEVICE:\s*(.+?)\s*-{3,}\s*$/gmi;
      const altParts = rawResponse.split(altDelimiter);
      if (altParts.length >= 3) {
        for (let i = 1; i < altParts.length; i += 2) {
          const name = altParts[i].trim();
          const config = (altParts[i + 1] || '').trim();
          const matchedDevice = deviceNames.find(d => d.toLowerCase() === name.toLowerCase());
          if (matchedDevice && !configs[matchedDevice]) {
            configs[matchedDevice] = config;
          }
        }
      }
    }

    // Last fallback: try to find device names as headers in the text
    if (Object.keys(configs).length < deviceNames.length) {
      for (const deviceName of deviceNames) {
        if (configs[deviceName]) continue;
        // Look for "! R1" or "! --- R1 ---" or "hostname R1" as markers
        const namePattern = new RegExp(`(?:^!\\s*${deviceName}\\s*$|^!\\s*---\\s*${deviceName}\\s*---\\s*$|^hostname\\s+${deviceName}\\s*$)`, 'gmi');
        const match = namePattern.exec(rawResponse);
        if (match) {
          const startIdx = match.index + match[0].length;
          // Find next device marker or end
          const nextDevice = deviceNames.find(d => d !== deviceName);
          let endIdx = rawResponse.length;
          if (nextDevice) {
            const nextPattern = new RegExp(`(?:^!\\s*${nextDevice}\\s*$|^!\\s*---\\s*${nextDevice}\\s*---\\s*$|^hostname\\s+${nextDevice}\\s*$|^={3,}\\s*DEVICE:|^-{3,}\\s*DEVICE:)`, 'gmi');
            nextPattern.lastIndex = startIdx;
            const nextMatch = nextPattern.exec(rawResponse);
            if (nextMatch) endIdx = nextMatch.index;
          }
          configs[deviceName] = rawResponse.substring(startIdx, endIdx).trim();
        }
      }
    }

    console.log(`📊 Parsed configs for ${Object.keys(configs).length}/${deviceNames.length} devices: [${Object.keys(configs).join(', ')}]`);
    return configs;
  }
  
  /**
   * Handle API errors with specific messages
   */
  _handleApiError(error) {
    const status = error.response?.status;
    const data = error.response?.data;
    
    if (status === 401) {
      return new Error('Invalid API key. Please verify your OpenRouter API key.');
    } else if (status === 402) {
      return new Error('Insufficient credits. Please add credits to your OpenRouter account.');
    } else if (status === 429) {
      const retryAfter = error.response?.headers?.['retry-after'] || 60;
      return new Error(`Rate limited by OpenRouter. Please wait ${retryAfter} seconds.`);
    } else if (status === 500 || status === 502 || status === 503) {
      return new Error('OpenRouter service temporarily unavailable. Please try again later.');
    } else if (status === 400) {
      return new Error(`Invalid request: ${data?.error?.message || 'Check prompt format'}`);
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return new Error('Cannot connect to OpenRouter. Check your internet connection.');
    } else if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
      return new Error('Request timed out. The AI model may be overloaded.');
    }
    
    return error;
  }

  /**
   * Initialize comprehensive Cisco knowledge base
   */
  _initializeKnowledgeBase() {
    return {
      routing: {
        ospf: {
          context: "OSPF (Open Shortest Path First) is a hierarchical link-state routing protocol that uses areas to scale large networks efficiently",
          syntax: [
            "router ospf [process-id]",
            "network [ip-address] [wildcard-mask] area [area-id]",
            "area [area-id] authentication [message-digest]",
            "area [area-id] stub [no-summary]",
            "area [area-id] nssa [default-information-originate]",
            "area [area-id] virtual-link [router-id]",
            "default-information originate [always] [metric [value]]",
            "redistribute [protocol] [metric [value]] [subnets]",
            "passive-interface [interface]",
            "auto-cost reference-bandwidth [value]",
            "router-id [ip-address]",
            "area [area-id] range [ip-address] [mask] [advertise|not-advertise]"
          ],
          examples: [
            "router ospf 1",
            "router-id 1.1.1.1",
            "network 192.168.1.0 0.0.0.255 area 0",
            "network 10.0.0.0 0.255.255.255 area 1",
            "area 1 stub no-summary",
            "area 2 nssa default-information-originate",
            "area 0 authentication message-digest",
            "default-information originate always metric 100",
            "redistribute static subnets",
            "passive-interface loopback0",
            "auto-cost reference-bandwidth 10000"
          ],
          bestPractices: [
            "Always configure router-id manually for stability",
            "Use area 0 as backbone - all areas must connect to area 0",
            "Always use wildcard masks, not subnet masks",
            "Enable authentication (preferably MD5) for security",
            "Use stub areas to reduce LSA flooding",
            "Configure passive-interface on LAN segments",
            "Adjust reference bandwidth for modern interfaces",
            "Use area summarization to reduce routing table size",
            "Place ABRs and ASBRs in area 0 when possible"
          ],
          areaTypes: [
            "Backbone Area (Area 0): Core area, all other areas connect here",
            "Standard Area: Normal OSPF area with all LSA types",
            "Stub Area: Blocks external LSAs (Type 5), reduces memory usage",
            "Totally Stub Area: Blocks external and summary LSAs (Type 3,4,5)",
            "NSSA: Not-So-Stubby Area, allows limited external route injection",
            "Totally NSSA: Combines NSSA with totally stub characteristics"
          ],
          lsaTypes: [
            "Type 1 (Router LSA): Describes router's links within area",
            "Type 2 (Network LSA): Generated by DR for multi-access networks",
            "Type 3 (Summary LSA): Inter-area routes from ABR",
            "Type 4 (ASBR Summary): Location of ASBR in other areas",
            "Type 5 (External LSA): External routes from ASBR",
            "Type 7 (NSSA External): External routes within NSSA area"
          ]
        },
        eigrp: {
          context: "EIGRP (Enhanced Interior Gateway Routing Protocol) is Cisco's advanced distance vector protocol using DUAL algorithm for loop-free topology",
          syntax: [
            "router eigrp [autonomous-system]",
            "network [ip-address] [wildcard-mask]",
            "no auto-summary",
            "eigrp router-id [ip-address]",
            "eigrp stub [connected] [summary] [redistributed] [receive-only]",
            "metric weights [tos] [k1] [k2] [k3] [k4] [k5]",
            "variance [multiplier]",
            "maximum-paths [paths]",
            "redistribute [protocol] [metric [bandwidth] [delay] [reliability] [load] [mtu]]",
            "passive-interface [interface]",
            "bandwidth [kbps]",
            "delay [tens-of-microseconds]",
            "ip hello-interval eigrp [as] [seconds]",
            "ip hold-time eigrp [as] [seconds]",
            "ip summary-address eigrp [as] [network] [mask]"
          ],
          examples: [
            "router eigrp 100",
            "eigrp router-id 2.2.2.2",
            "network 10.0.0.0 0.255.255.255",
            "network 192.168.1.0 0.0.0.255",
            "no auto-summary",
            "eigrp stub connected summary",
            "variance 2",
            "maximum-paths 4",
            "redistribute static metric 1544 2000 255 1 1500",
            "passive-interface gi0/0",
            "ip summary-address eigrp 100 192.168.0.0 255.255.0.0"
          ],
          bestPractices: [
            "Always disable auto-summary for VLSM networks",
            "Use consistent AS numbers across the network",
            "Configure router-id manually for stability",
            "Use EIGRP stub on spoke routers to reduce queries",
            "Implement manual summarization at network boundaries",
            "Tune hello/hold timers for fast convergence",
            "Use variance for unequal-cost load balancing",
            "Configure passive-interface on LAN segments",
            "Use authentication for security in production"
          ],
          metrics: [
            "Bandwidth: Interface bandwidth in Kbps (K1 weight)",
            "Delay: Interface delay in tens of microseconds (K3 weight)",
            "Reliability: Interface reliability 0-255 (K5 weight)",
            "Load: Interface load 0-255 (K4 weight)",
            "MTU: Maximum Transmission Unit (not used in metric by default)"
          ],
          stubTypes: [
            "Connected: Advertise connected routes only",
            "Summary: Advertise summary routes only", 
            "Redistributed: Advertise redistributed routes only",
            "Receive-only: Don't advertise any routes, only receive"
          ]
        },
        bgp: {
          context: "BGP (Border Gateway Protocol) is the path vector exterior gateway protocol for inter-AS routing, using path attributes for policy-based routing decisions",
          syntax: [
            "router bgp [as-number]",
            "bgp router-id [ip-address]",
            "neighbor [ip-address] remote-as [as-number]",
            "neighbor [ip-address] update-source [interface]",
            "neighbor [ip-address] next-hop-self",
            "neighbor [ip-address] route-reflector-client",
            "neighbor [ip-address] send-community [both|extended|standard]",
            "neighbor [ip-address] soft-reconfiguration inbound",
            "neighbor [ip-address] prefix-list [name] [in|out]",
            "neighbor [ip-address] route-map [name] [in|out]",
            "network [network] mask [subnet-mask]",
            "aggregate-address [network] [mask] [summary-only]",
            "redistribute [protocol] [route-map [name]]",
            "bgp log-neighbor-changes",
            "bgp confederation identifier [as-number]",
            "bgp confederation peers [as-number-list]"
          ],
          examples: [
            "router bgp 65001",
            "bgp router-id 3.3.3.3",
            "bgp log-neighbor-changes",
            "neighbor 10.1.1.2 remote-as 65002",
            "neighbor 10.1.1.2 update-source loopback0",
            "neighbor 192.168.1.1 remote-as 65001",
            "neighbor 192.168.1.1 next-hop-self",
            "neighbor 192.168.1.1 route-reflector-client",
            "network 172.16.0.0 mask 255.255.0.0",
            "aggregate-address 10.0.0.0 255.0.0.0 summary-only",
            "redistribute ospf 1 route-map OSPF-TO-BGP"
          ],
          bestPractices: [
            "Always configure router-id manually",
            "Use loopback interfaces for iBGP peering",
            "Configure next-hop-self for iBGP peers",
            "Use route reflectors to reduce iBGP mesh",
            "Implement prefix-lists and route-maps for filtering",
            "Enable soft reconfiguration for policy changes",
            "Use communities for traffic engineering",
            "Configure authentication for security",
            "Monitor BGP table size and memory usage"
          ],
          pathAttributes: [
            "AS_PATH: List of AS numbers the route has traversed",
            "NEXT_HOP: IP address of next hop router",
            "LOCAL_PREF: Local preference for iBGP (higher preferred)",
            "MED: Multi-Exit Discriminator for inbound traffic control",
            "ORIGIN: How route was injected (IGP, EGP, Incomplete)",
            "COMMUNITY: Optional transitive attribute for policy",
            "WEIGHT: Cisco proprietary, highest weight preferred"
          ],
          peerTypes: [
            "eBGP: External BGP between different autonomous systems",
            "iBGP: Internal BGP within same autonomous system",
            "Route Reflector: Reduces iBGP full mesh requirement",
            "Confederation: Divides AS into sub-AS for scalability"
          ]
        },
        rip: {
          context: "RIP (Routing Information Protocol) is a simple distance vector protocol with 15-hop limit, suitable for small networks",
          syntax: [
            "router rip",
            "version 2",
            "network [network-address]",
            "no auto-summary",
            "passive-interface [interface]",
            "redistribute [protocol] [metric [hops]]",
            "default-information originate",
            "maximum-paths [paths]",
            "timers basic [update] [invalid] [holddown] [flush]",
            "distance [distance] [source-network] [wildcard]"
          ],
          examples: [
            "router rip",
            "version 2",
            "network 192.168.1.0",
            "network 10.0.0.0",
            "no auto-summary",
            "passive-interface gi0/0",
            "redistribute static metric 5",
            "default-information originate",
            "timers basic 30 180 180 240"
          ],
          bestPractices: [
            "Always use RIP version 2 for VLSM support",
            "Disable auto-summary for modern networks",
            "Use passive-interface on LAN segments",
            "Limit to small networks (max 15 hops)",
            "Consider OSPF or EIGRP for larger networks",
            "Use authentication where supported"
          ],
          limitations: [
            "Maximum hop count of 15 (16 is unreachable)",
            "Slow convergence compared to modern protocols",
            "No support for VLSM in version 1",
            "Periodic updates every 30 seconds",
            "Count-to-infinity problem"
          ]
        },
        isis: {
          context: "ISIS (Intermediate System to Intermediate System) is a link-state routing protocol similar to OSPF but with different addressing scheme",
          syntax: [
            "router isis [tag]",
            "net [network-entity-title]",
            "is-type [level-1|level-1-2|level-2-only]",
            "area-password [password]",
            "domain-password [password]",
            "redistribute [protocol] [level-1|level-2] [metric [value]]",
            "summary-address [address] [mask] [level-1|level-2]",
            "ip router isis [tag]",
            "isis circuit-type [level-1|level-1-2|level-2-only]",
            "isis metric [metric] [level-1|level-2]",
            "isis hello-interval [seconds] [level-1|level-2]",
            "isis hello-multiplier [multiplier] [level-1|level-2]"
          ],
          examples: [
            "router isis CORE",
            "net 49.0001.1921.6800.1001.00",
            "is-type level-2-only",
            "area-password cisco123",
            "redistribute ospf 1 level-2 metric 20",
            "summary-address 192.168.0.0 255.255.0.0 level-2",
            "interface gi0/1",
            "ip router isis CORE",
            "isis circuit-type level-2-only",
            "isis metric 10"
          ],
          bestPractices: [
            "Use meaningful process tags",
            "Configure NET address carefully (Area.SystemID.SEL)",
            "Use level-2-only for backbone routers",
            "Use level-1 for stub areas",
            "Configure authentication for security",
            "Use summary addresses to reduce LSP flooding",
            "Tune hello intervals for fast convergence"
          ],
          levels: [
            "Level-1: Routing within area (like OSPF intra-area)",
            "Level-2: Routing between areas (like OSPF inter-area)",
            "Level-1-2: Router participates in both levels"
          ],
          addressing: [
            "NET Format: AFI.Area-ID.System-ID.SEL",
            "AFI: Authority and Format Identifier (49 for private)",
            "Area-ID: Variable length area identifier",
            "System-ID: 6-byte unique system identifier",
            "SEL: Selector byte (always 00 for router)"
          ]
        },
        static: {
          context: "Static routing provides manual route configuration with full administrative control",
          syntax: [
            "ip route [destination] [mask] [next-hop|interface] [distance]",
            "ip route [destination] [mask] [interface] [next-hop] [distance]",
            "ip route [destination] [mask] null0 [distance]",
            "ip route 0.0.0.0 0.0.0.0 [next-hop|interface] [distance]",
            "ipv6 route [destination/prefix-length] [next-hop|interface] [distance]",
            "ip route [destination] [mask] [next-hop] track [object-number]"
          ],
          examples: [
            "ip route 192.168.2.0 255.255.255.0 10.1.1.2",
            "ip route 172.16.0.0 255.255.0.0 gi0/1 10.1.1.2",
            "ip route 10.10.10.0 255.255.255.0 null0 200",
            "ip route 0.0.0.0 0.0.0.0 192.168.1.1 1",
            "ip route 203.0.113.0 255.255.255.0 10.1.1.2 track 1",
            "ipv6 route 2001:db8:2::/64 2001:db8:1::2"
          ],
          bestPractices: [
            "Use administrative distance to control route preference",
            "Configure default routes for internet connectivity",
            "Use null routes for blackhole routing",
            "Implement route tracking for redundancy",
            "Document all static routes for maintenance",
            "Use floating static routes as backup"
          ],
          routeTypes: [
            "Standard Static: Basic static route to destination",
            "Default Route: 0.0.0.0/0 for internet access",
            "Host Route: /32 route to specific host",
            "Null Route: Route to null0 for blackholing",
            "Floating Static: High AD backup route",
            "Recursive Route: Next-hop resolved through routing table"
          ]
        }
      },
      switching: {
        vlan: {
          context: "VLANs (Virtual LANs) logically segment broadcast domains within a physical switch infrastructure, providing network isolation and improved security",
          syntax: [
            "vlan [vlan-id]",
            "name [vlan-name]",
            "switchport mode access",
            "switchport access vlan [vlan-id]",
            "switchport mode trunk",
            "switchport trunk allowed vlan [vlan-list]",
            "switchport trunk native vlan [vlan-id]",
            "switchport trunk encapsulation [dot1q|isl]",
            "switchport nonegotiate",
            "vlan database",
            "vtp mode [server|client|transparent|off]",
            "vtp domain [domain-name]",
            "vtp password [password]"
          ],
          examples: [
            "vlan 10",
            "name SALES_DEPT",
            "state active",
            "vlan 20",
            "name ENGINEERING",
            "interface gi0/1",
            "switchport mode access",
            "switchport access vlan 10",
            "interface gi0/24",
            "switchport mode trunk",
            "switchport trunk allowed vlan 10,20,30",
            "switchport trunk native vlan 99",
            "switchport nonegotiate"
          ],
          bestPractices: [
            "Use meaningful VLAN names for easy identification",
            "Change native VLAN from default (VLAN 1) for security",
            "Use VLAN 1 only for management if necessary",
            "Document VLAN assignments and purposes",
            "Use trunk ports only between switches",
            "Prune unused VLANs from trunk links",
            "Use VTP transparent mode or disable VTP",
            "Assign unused ports to unused VLAN",
            "Use consistent VLAN numbering scheme"
          ],
          trunkingProtocols: [
            "802.1Q: Industry standard VLAN tagging protocol",
            "ISL: Cisco proprietary trunking (legacy)",
            "DTP: Dynamic Trunking Protocol for auto-negotiation"
          ],
          vtpModes: [
            "Server: Creates, modifies, deletes VLANs and propagates changes",
            "Client: Receives VLAN information, cannot modify VLANs",
            "Transparent: Forwards VTP advertisements but maintains own database",
            "Off: Disables VTP completely (recommended for modern networks)"
          ],
          securityBestPractices: [
            "Change native VLAN to unused VLAN (not VLAN 1)",
            "Disable unused ports and assign to unused VLAN",
            "Use VLAN ACLs (VACLs) for intra-VLAN filtering",
            "Implement private VLANs for additional isolation",
            "Enable BPDU Guard on access ports",
            "Disable CDP/LLDP on edge ports if not needed"
          ]
        },
        interVlanRouting: {
          context: "Inter-VLAN routing enables communication between different VLANs using Layer 3 routing functionality",
          syntax: [
            "interface vlan [vlan-id]",
            "ip address [ip-address] [subnet-mask]",
            "no shutdown",
            "ip routing",
            "interface [interface].[subinterface]",
            "encapsulation dot1Q [vlan-id] [native]",
            "ip helper-address [ip-address]",
            "standby [group] ip [virtual-ip]",
            "standby [group] priority [priority]",
            "standby [group] preempt"
          ],
          examples: [
            "ip routing",
            "interface vlan 10",
            "ip address 192.168.10.1 255.255.255.0",
            "description SALES_GATEWAY",
            "no shutdown",
            "interface vlan 20", 
            "ip address 192.168.20.1 255.255.255.0",
            "description ENGINEERING_GATEWAY",
            "no shutdown",
            "interface gi0/1.10",
            "encapsulation dot1Q 10",
            "ip address 192.168.10.1 255.255.255.0"
          ],
          methods: [
            "SVI (Switched Virtual Interface): Layer 3 interface on switch",
            "Router-on-a-Stick: External router with subinterfaces",
            "Layer 3 Switch: Dedicated Layer 3 switching hardware",
            "Routed Ports: Physical ports configured as Layer 3"
          ],
          bestPractices: [
            "Use Layer 3 switches for better performance",
            "Configure HSRP/VRRP for gateway redundancy",
            "Implement proper IP addressing scheme",
            "Use DHCP relay agents for centralized DHCP",
            "Apply ACLs between VLANs for security",
            "Monitor inter-VLAN traffic patterns"
          ]
        },
        stp: {
          context: "STP (Spanning Tree Protocol) prevents loops in switched networks",
          syntax: [
            "spanning-tree mode rapid-pvst",
            "spanning-tree vlan [vlan-id] priority [priority]",
            "spanning-tree portfast",
            "spanning-tree bpduguard enable"
          ],
          examples: [
            "spanning-tree mode rapid-pvst",
            "spanning-tree vlan 1 priority 4096",
            "spanning-tree portfast"
          ]
        },
        etherchannel: {
          context: "EtherChannel bundles multiple physical links into one logical link",
          syntax: [
            "channel-group [number] mode active",
            "channel-group [number] mode passive",
            "interface port-channel [number]",
            "switchport mode trunk"
          ],
          examples: [
            "channel-group 1 mode active",
            "interface port-channel 1",
            "switchport mode trunk"
          ]
        }
      },
      interfaces: {
        naming: {
          context: "Cisco interface naming conventions use both full names and standardized short names for efficient configuration",
          shortNames: {
            "Ethernet": ["Eth", "E"],
            "FastEthernet": ["Fa", "FastEth"],
            "GigabitEthernet": ["Gi", "GigE", "Gig"],
            "TenGigabitEthernet": ["Te", "TenGig", "TG"],
            "TwentyFiveGigabitEthernet": ["TF", "TwentyFiveGig"],
            "FortyGigabitEthernet": ["Fo", "FortyGig"],
            "FiftyGigabitEthernet": ["Fi", "FiftyGig"],
            "HundredGigabitEthernet": ["Hu", "HundredGig"],
            "TwoHundredGigabitEthernet": ["TH", "TwoHundredGig"],
            "FourHundredGigabitEthernet": ["F", "FourHundredGig"],
            "Serial": ["Se", "Ser"],
            "Loopback": ["Lo", "Loop"],
            "Null": ["Nu", "Null0"],
            "Management": ["Mg", "Mgmt"],
            "Port-channel": ["Po", "PC"],
            "Bundle-Ether": ["BE"],
            "Bundle-POS": ["BP"],
            "Tunnel": ["Tu", "Tun"],
            "BRI": ["BRI"],
            "Vlan": ["Vl"]
          },
          syntax: [
            "interface [type][slot/port]",
            "interface [type][slot/port/subport]",
            "interface [type][number]",
            "interface [short-name][slot/port]"
          ],
          examples: [
            "interface GigabitEthernet0/1 (same as: interface Gi0/1)",
            "interface FastEthernet0/24 (same as: interface Fa0/24)",
            "interface TenGigabitEthernet1/0/1 (same as: interface Te1/0/1)",
            "interface Serial0/0/0 (same as: interface Se0/0/0)",
            "interface Loopback0 (same as: interface Lo0)",
            "interface Port-channel1 (same as: interface Po1)"
          ],
          bestPractices: [
            "Use short names for faster configuration",
            "Consistent naming across network devices",
            "Use descriptive descriptions for interfaces",
            "Follow slot/port numbering conventions",
            "Use logical interface numbering for virtual interfaces"
          ]
        },
        ethernet: {
          context: "Ethernet interfaces are physical network connections with various speeds and capabilities",
          types: {
            "Ethernet": "10 Mbps legacy Ethernet (rarely used)",
            "FastEthernet": "100 Mbps Ethernet for access ports",
            "GigabitEthernet": "1 Gbps Ethernet, most common interface type",
            "TenGigabitEthernet": "10 Gbps Ethernet for high-speed connections",
            "TwentyFiveGigabitEthernet": "25 Gbps Ethernet for modern data centers",
            "FortyGigabitEthernet": "40 Gbps Ethernet for backbone connections",
            "FiftyGigabitEthernet": "50 Gbps Ethernet for high-density applications",
            "HundredGigabitEthernet": "100 Gbps Ethernet for core networks",
            "TwoHundredGigabitEthernet": "200 Gbps Ethernet for ultra-high-speed",
            "FourHundredGigabitEthernet": "400 Gbps Ethernet for next-gen networks"
          },
          syntax: [
            "interface [ethernet-type][slot/port]",
            "ip address [ip] [mask]",
            "no shutdown",
            "description [text]",
            "duplex [auto|full|half]",
            "speed [auto|10|100|1000|10000]",
            "switchport mode [access|trunk]",
            "switchport access vlan [vlan-id]",
            "channel-group [number] mode [active|passive|on]"
          ],
          examples: [
            "interface Gi0/1",
            "description CONNECTION_TO_SERVER",
            "ip address 192.168.1.1 255.255.255.0",
            "duplex full",
            "speed 1000",
            "no shutdown",
            "interface Fa0/24",
            "switchport mode access",
            "switchport access vlan 10"
          ],
          bestPractices: [
            "Always use 'no shutdown' to enable interfaces",
            "Set meaningful descriptions for all interfaces",
            "Use auto-negotiation when possible",
            "Configure speed/duplex manually only when needed",
            "Use appropriate interface type for bandwidth requirements"
          ]
        },
        virtual: {
          context: "Virtual interfaces provide logical connectivity and special functions",
          types: {
            "Loopback": "Virtual interface that never goes down, used for management",
            "Null": "Bit bucket interface for discarding traffic",
            "Tunnel": "Virtual interface for VPN and overlay networks",
            "Port-channel": "Logical interface for EtherChannel/Link Aggregation",
            "Vlan": "Switched Virtual Interface (SVI) for inter-VLAN routing",
            "Management": "Dedicated out-of-band management interface"
          },
          syntax: [
            "interface loopback [number]",
            "interface null [number]",
            "interface tunnel [number]",
            "interface port-channel [number]",
            "interface vlan [vlan-id]",
            "interface management [slot/port]"
          ],
          examples: [
            "interface Lo0",
            "ip address 1.1.1.1 255.255.255.255",
            "description ROUTER_ID",
            "interface Po1",
            "switchport mode trunk",
            "interface Vlan10",
            "ip address 192.168.10.1 255.255.255.0",
            "interface Tu0",
            "tunnel source gi0/1",
            "tunnel destination 203.0.113.1"
          ],
          bestPractices: [
            "Use loopback0 for router ID and management",
            "Use /32 mask for loopback interfaces",
            "Configure port-channels before adding member interfaces",
            "Use meaningful tunnel interface numbers",
            "Enable SVIs only when needed for routing"
          ]
        },
        serial: {
          context: "Serial interfaces provide WAN connectivity using various encapsulation methods",
          types: {
            "Serial": "Traditional serial WAN interface",
            "BRI": "Basic Rate Interface for ISDN connections",
            "POS": "Packet over SONET/SDH for high-speed WAN"
          },
          syntax: [
            "interface serial [slot/port]",
            "ip address [ip] [mask]",
            "encapsulation [ppp|hdlc|frame-relay]",
            "clock rate [rate]",
            "bandwidth [kbps]",
            "keepalive [seconds]",
            "no shutdown"
          ],
          examples: [
            "interface Se0/0/0",
            "ip address 10.1.1.1 255.255.255.252",
            "encapsulation ppp",
            "clock rate 1544000",
            "bandwidth 1544",
            "no shutdown"
          ],
          bestPractices: [
            "Set clock rate on DCE side of serial connection",
            "Use PPP encapsulation for authentication",
            "Configure bandwidth for routing protocol metrics",
            "Use point-to-point IP addressing (/30 or /31)",
            "Enable keepalives for link monitoring"
          ]
        }
      },
      security: {
        acl: {
          context: "Access Control Lists filter traffic based on various criteria",
          syntax: [
            "access-list [number] permit/deny [protocol] [source] [destination]",
            "ip access-group [acl-name] in/out",
            "ip access-list extended [name]"
          ],
          examples: [
            "access-list 100 permit tcp 192.168.1.0 0.0.0.255 any eq 80",
            "ip access-group 100 in"
          ]
        }
      },
      general: {
        basic: {
          context: "Essential device configuration commands for initial setup and basic operation",
          syntax: [
            "hostname [name]",
            "enable secret [password]",
            "enable password [password]",
            "service password-encryption",
            "no ip domain-lookup",
            "ip domain-name [domain]",
            "banner motd # [message] #",
            "banner login # [message] #",
            "clock timezone [zone] [offset]",
            "clock set [time] [date]"
          ],
          examples: [
            "hostname CORE-ROUTER-01",
            "enable secret Cisco123!",
            "service password-encryption",
            "no ip domain-lookup",
            "ip domain-name company.com",
            "banner motd # Authorized Access Only #",
            "clock timezone EST -5"
          ],
          bestPractices: [
            "Use descriptive hostnames with location/function",
            "Use strong enable passwords with encryption",
            "Disable DNS lookup to prevent command delays",
            "Set appropriate time zone and NTP",
            "Use warning banners for security",
            "Enable password encryption service"
          ]
        },
        ipConfiguration: {
          context: "IP address configuration on interfaces for network connectivity",
          syntax: [
            "interface [type][number]",
            "ip address [ip] [mask]",
            "ip address [ip] [mask] secondary",
            "ip address dhcp",
            "no shutdown",
            "description [text]",
            "ip default-gateway [gateway-ip]",
            "ip route [destination] [mask] [next-hop]",
            "ip name-server [dns-server]"
          ],
          examples: [
            "interface gi0/0",
            "ip address 192.168.1.1 255.255.255.0",
            "description LAN_INTERFACE",
            "no shutdown",
            "interface gi0/1",
            "ip address dhcp",
            "no shutdown",
            "ip default-gateway 192.168.1.1",
            "ip route 0.0.0.0 0.0.0.0 192.168.1.1",
            "ip name-server 8.8.8.8"
          ],
          bestPractices: [
            "Always use 'no shutdown' to enable interfaces",
            "Add meaningful descriptions to all interfaces",
            "Use consistent IP addressing schemes",
            "Configure default gateway on switches",
            "Set DNS servers for name resolution",
            "Use secondary addresses when needed"
          ],
          addressingTypes: [
            "Static: Manual IP address assignment",
            "DHCP: Dynamic IP from DHCP server",
            "Secondary: Additional IP on same interface",
            "Unnumbered: Borrow IP from another interface"
          ]
        },
        userManagement: {
          context: "User account management and authentication configuration",
          syntax: [
            "username [name] secret [password]",
            "username [name] privilege [level]",
            "username [name] password [password]",
            "enable secret [password]",
            "enable password [password]",
            "service password-encryption",
            "security passwords min-length [length]",
            "login block-for [seconds] attempts [number] within [seconds]"
          ],
          examples: [
            "username admin secret Admin123!",
            "username admin privilege 15",
            "username operator secret Oper456!",
            "username operator privilege 1",
            "enable secret Enable789!",
            "service password-encryption",
            "security passwords min-length 8",
            "login block-for 300 attempts 3 within 60"
          ],
          bestPractices: [
            "Use strong passwords with mixed characters",
            "Set appropriate privilege levels (1-15)",
            "Enable password encryption service",
            "Implement login attempt limits",
            "Use secret instead of password commands",
            "Regular password rotation policy"
          ],
          privilegeLevels: [
            "Level 0: User EXEC commands (limited)",
            "Level 1: User EXEC mode (default user)",
            "Level 15: Privileged EXEC mode (full access)",
            "Levels 2-14: Custom privilege levels"
          ]
        },
        lineConfiguration: {
          context: "Console and VTY line configuration for device access",
          syntax: [
            "line console 0",
            "line vty 0 4",
            "line vty 0 15",
            "password [password]",
            "login",
            "login local",
            "transport input [protocol]",
            "transport output [protocol]",
            "exec-timeout [minutes] [seconds]",
            "logging synchronous",
            "history size [number]"
          ],
          examples: [
            "line console 0",
            "password Console123!",
            "login",
            "logging synchronous",
            "exec-timeout 5 0",
            "line vty 0 15",
            "login local",
            "transport input ssh",
            "exec-timeout 10 0",
            "history size 50"
          ],
          bestPractices: [
            "Secure console access with passwords",
            "Use 'login local' for username authentication",
            "Restrict VTY to SSH only for security",
            "Set reasonable exec timeouts",
            "Enable logging synchronous on console",
            "Configure sufficient VTY lines (0-15)"
          ],
          lineTypes: [
            "Console: Physical console port access",
            "VTY: Virtual terminal (Telnet/SSH) access",
            "AUX: Auxiliary port (modem) access",
            "TTY: Asynchronous terminal lines"
          ]
        },
        sshConfiguration: {
          context: "SSH configuration for secure remote access",
          syntax: [
            "ip domain-name [domain]",
            "crypto key generate rsa [modulus [size]]",
            "ip ssh version 2",
            "ip ssh time-out [seconds]",
            "ip ssh authentication-retries [number]",
            "ip ssh source-interface [interface]",
            "ip ssh logging events",
            "line vty 0 15",
            "transport input ssh",
            "login local"
          ],
          examples: [
            "ip domain-name company.com",
            "crypto key generate rsa modulus 2048",
            "ip ssh version 2",
            "ip ssh time-out 60",
            "ip ssh authentication-retries 3",
            "ip ssh logging events",
            "line vty 0 15",
            "login local",
            "transport input ssh"
          ],
          bestPractices: [
            "Use RSA keys 2048 bits or larger",
            "Configure domain name before generating keys",
            "Use SSH version 2 only",
            "Set reasonable timeout values",
            "Limit authentication retries",
            "Enable SSH event logging",
            "Disable Telnet access"
          ],
          requirements: [
            "Domain name must be configured",
            "RSA keys must be generated",
            "Username database required",
            "VTY lines configured for SSH"
          ]
        },
        configurationManagement: {
          context: "Configuration saving, backup, and management commands",
          syntax: [
            "copy running-config startup-config",
            "write memory",
            "write",
            "copy startup-config running-config",
            "copy running-config tftp:",
            "copy tftp: startup-config",
            "erase startup-config",
            "reload",
            "show running-config",
            "show startup-config",
            "configure terminal",
            "end",
            "exit"
          ],
          examples: [
            "copy running-config startup-config",
            "write memory",
            "copy running-config tftp://192.168.1.100/router-config.txt",
            "copy tftp://192.168.1.100/backup-config.txt startup-config",
            "show running-config | include hostname",
            "configure terminal",
            "end"
          ],
          bestPractices: [
            "Always save configuration after changes",
            "Regular backups to TFTP/FTP servers",
            "Document configuration changes",
            "Test configurations before saving",
            "Keep multiple backup versions",
            "Use configuration archiving"
          ],
          configTypes: [
            "Running-config: Active configuration in RAM",
            "Startup-config: Boot configuration in NVRAM", 
            "TFTP backup: External server backup",
            "Archive: Automated configuration history"
          ]
        }
      }
    };
  }

  /**
   * Build system message with role definition and rules
   */
  _buildSystemMessage(prompt, deviceType) {
    const relevantKnowledge = this._getRelevantKnowledge(prompt);
    
    return `You are a Cisco IOS command generator expert. Your job is to generate ONLY raw Cisco IOS configuration commands.

RELEVANT KNOWLEDGE:
${relevantKnowledge}

CRITICAL PROTOCOL-SPECIFIC RULES:
1. OSPF: Does NOT support "no auto-summary" command (OSPF is classless by default)
2. EIGRP: MUST include "no auto-summary" for modern VLSM networks
3. RIP: Use "version 2" with "no auto-summary" for classless operation
4. BGP: Does not use auto-summary command

STRICT OUTPUT RULES:
1. Generate ONLY configuration commands (no "configure terminal", no "end", no "exit")
2. Use proper indentation (single space before sub-commands)
3. Use wildcard masks for OSPF network commands, NOT subnet masks
4. Accept both full and short interface names (Gi, Fa, Te, etc.)
5. Follow Cisco best practices
6. NO explanations, NO comments, NO markdown, NO code blocks
7. Start directly with the first command
8. DO NOT include commands that are invalid for the protocol being configured

EXAMPLE OUTPUT FORMAT:
interface GigabitEthernet0/1
 ip address 192.168.1.1 255.255.255.0
 description Connection to Core Switch
 no shutdown

Remember: Output ONLY the commands, nothing else.`;
  }

  /**
   * Build user message with specific request
   */
  _buildUserMessage(prompt, deviceType, deviceContext) {
    const deviceName = deviceContext.name || 'Device';
    const deviceModel = deviceContext.model || 'Generic Cisco';
    
    // Pre-process the prompt
    let processedPrompt = this._preprocessCIDR(prompt);
    processedPrompt = this._standardizeInterfaceNames(processedPrompt);
    
    return `Device: ${deviceName} (${deviceType} - ${deviceModel})

Configuration Request: ${processedPrompt}

Generate the Cisco IOS commands now:`;
  }



  /**
   * Get relevant knowledge based on prompt content
   */
  _getRelevantKnowledge(prompt) {
    const lowerPrompt = prompt.toLowerCase();
    let knowledge = [];
    
    // Check for routing protocols
    if (lowerPrompt.includes('ospf') || lowerPrompt.includes('area')) {
      const ospf = this.knowledgeBase.routing.ospf;
      knowledge.push(`OSPF: ${ospf.context}`);
      knowledge.push(`Syntax: ${ospf.syntax.slice(0, 6).join(', ')}`);
      knowledge.push(`Best Practices: ${ospf.bestPractices.slice(0, 4).join(', ')}`);
      if (lowerPrompt.includes('area') || lowerPrompt.includes('stub') || lowerPrompt.includes('nssa')) {
        knowledge.push(`Area Types: ${ospf.areaTypes.slice(0, 3).join(', ')}`);
      }
    }
    
    if (lowerPrompt.includes('eigrp')) {
      const eigrp = this.knowledgeBase.routing.eigrp;
      knowledge.push(`EIGRP: ${eigrp.context}`);
      knowledge.push(`Syntax: ${eigrp.syntax.slice(0, 6).join(', ')}`);
      knowledge.push(`Best Practices: ${eigrp.bestPractices.slice(0, 4).join(', ')}`);
      if (lowerPrompt.includes('stub') || lowerPrompt.includes('metric') || lowerPrompt.includes('variance')) {
        knowledge.push(`Metrics: ${eigrp.metrics.slice(0, 3).join(', ')}`);
      }
    }
    
    if (lowerPrompt.includes('bgp')) {
      const bgp = this.knowledgeBase.routing.bgp;
      knowledge.push(`BGP: ${bgp.context}`);
      knowledge.push(`Syntax: ${bgp.syntax.slice(0, 6).join(', ')}`);
      knowledge.push(`Best Practices: ${bgp.bestPractices.slice(0, 4).join(', ')}`);
      if (lowerPrompt.includes('neighbor') || lowerPrompt.includes('peer')) {
        knowledge.push(`Peer Types: ${bgp.peerTypes.join(', ')}`);
      }
    }
    
    if (lowerPrompt.includes('rip')) {
      const rip = this.knowledgeBase.routing.rip;
      knowledge.push(`RIP: ${rip.context}`);
      knowledge.push(`Syntax: ${rip.syntax.slice(0, 5).join(', ')}`);
      knowledge.push(`Best Practices: ${rip.bestPractices.slice(0, 3).join(', ')}`);
    }
    
    if (lowerPrompt.includes('isis')) {
      const isis = this.knowledgeBase.routing.isis;
      knowledge.push(`ISIS: ${isis.context}`);
      knowledge.push(`Syntax: ${isis.syntax.slice(0, 5).join(', ')}`);
      knowledge.push(`Best Practices: ${isis.bestPractices.slice(0, 4).join(', ')}`);
    }
    
    if (lowerPrompt.includes('static') || lowerPrompt.includes('ip route')) {
      const staticRouting = this.knowledgeBase.routing.static;
      knowledge.push(`Static Routing: ${staticRouting.context}`);
      knowledge.push(`Syntax: ${staticRouting.syntax.slice(0, 4).join(', ')}`);
      knowledge.push(`Best Practices: ${staticRouting.bestPractices.slice(0, 3).join(', ')}`);
    }
    
    // Check for switching
    if (lowerPrompt.includes('vlan') || lowerPrompt.includes('switchport')) {
      const vlan = this.knowledgeBase.switching.vlan;
      knowledge.push(`VLAN: ${vlan.context}`);
      knowledge.push(`Syntax: ${vlan.syntax.slice(0, 6).join(', ')}`);
      knowledge.push(`Best Practices: ${vlan.bestPractices.slice(0, 4).join(', ')}`);
      if (lowerPrompt.includes('trunk') || lowerPrompt.includes('native')) {
        knowledge.push(`Trunking: ${vlan.trunkingProtocols.join(', ')}`);
      }
      if (lowerPrompt.includes('vtp')) {
        knowledge.push(`VTP Modes: ${vlan.vtpModes.join(', ')}`);
      }
    }
    
    if (lowerPrompt.includes('inter-vlan') || lowerPrompt.includes('svi') || lowerPrompt.includes('router-on-stick')) {
      const interVlan = this.knowledgeBase.switching.interVlanRouting;
      knowledge.push(`Inter-VLAN Routing: ${interVlan.context}`);
      knowledge.push(`Syntax: ${interVlan.syntax.slice(0, 5).join(', ')}`);
      knowledge.push(`Methods: ${interVlan.methods.join(', ')}`);
      knowledge.push(`Best Practices: ${interVlan.bestPractices.slice(0, 3).join(', ')}`);
    }
    
    if (lowerPrompt.includes('spanning-tree') || lowerPrompt.includes('stp')) {
      const stp = this.knowledgeBase.switching.stp;
      knowledge.push(`STP: ${stp.context}`);
      knowledge.push(`Syntax: ${stp.syntax.join(', ')}`);
    }
    
    if (lowerPrompt.includes('etherchannel') || lowerPrompt.includes('port-channel')) {
      const etherchannel = this.knowledgeBase.switching.etherchannel;
      knowledge.push(`EtherChannel: ${etherchannel.context}`);
      knowledge.push(`Syntax: ${etherchannel.syntax.join(', ')}`);
    }
    
    // Check for interface naming
    if (lowerPrompt.includes('interface') || this._containsInterfaceShortName(lowerPrompt)) {
      const naming = this.knowledgeBase.interfaces.naming;
      knowledge.push(`Interface Naming: ${naming.context}`);
      knowledge.push(`Short Names: Gi (GigabitEthernet), Fa (FastEthernet), Te (TenGigabitEthernet), Se (Serial), Lo (Loopback), Po (Port-channel)`);
      knowledge.push(`Best Practices: ${naming.bestPractices.slice(0, 3).join(', ')}`);
    }
    
    // Check for Ethernet interfaces
    if (lowerPrompt.includes('ethernet') || lowerPrompt.includes('gi') || lowerPrompt.includes('fa') || lowerPrompt.includes('te')) {
      const ethernet = this.knowledgeBase.interfaces.ethernet;
      knowledge.push(`Ethernet Interfaces: ${ethernet.context}`);
      knowledge.push(`Syntax: ${ethernet.syntax.slice(0, 5).join(', ')}`);
      knowledge.push(`Best Practices: ${ethernet.bestPractices.slice(0, 3).join(', ')}`);
    }
    
    // Check for virtual interfaces
    if (lowerPrompt.includes('loopback') || lowerPrompt.includes('lo') || lowerPrompt.includes('port-channel') || lowerPrompt.includes('po') || lowerPrompt.includes('tunnel')) {
      const virtual = this.knowledgeBase.interfaces.virtual;
      knowledge.push(`Virtual Interfaces: ${virtual.context}`);
      knowledge.push(`Types: ${Object.keys(virtual.types).slice(0, 4).join(', ')}`);
      knowledge.push(`Best Practices: ${virtual.bestPractices.slice(0, 3).join(', ')}`);
    }
    
    // Check for serial interfaces
    if (lowerPrompt.includes('serial') || lowerPrompt.includes('se') || lowerPrompt.includes('wan')) {
      const serial = this.knowledgeBase.interfaces.serial;
      knowledge.push(`Serial Interfaces: ${serial.context}`);
      knowledge.push(`Syntax: ${serial.syntax.slice(0, 4).join(', ')}`);
      knowledge.push(`Best Practices: ${serial.bestPractices.slice(0, 3).join(', ')}`);
    }
    
    // Check for security
    if (lowerPrompt.includes('access-list') || lowerPrompt.includes('acl')) {
      const acl = this.knowledgeBase.security.acl;
      knowledge.push(`ACL: ${acl.context}`);
      knowledge.push(`Syntax: ${acl.syntax.join(', ')}`);
    }
    
    // Check for basic configuration
    if (lowerPrompt.includes('hostname') || lowerPrompt.includes('enable secret') || lowerPrompt.includes('banner')) {
      const basic = this.knowledgeBase.general.basic;
      knowledge.push(`Basic Configuration: ${basic.context}`);
      knowledge.push(`Syntax: ${basic.syntax.slice(0, 5).join(', ')}`);
      knowledge.push(`Best Practices: ${basic.bestPractices.slice(0, 3).join(', ')}`);
    }
    
    // Check for IP configuration
    if (lowerPrompt.includes('ip address') || lowerPrompt.includes('ip route') || lowerPrompt.includes('default-gateway')) {
      const ipConfig = this.knowledgeBase.general.ipConfiguration;
      knowledge.push(`IP Configuration: ${ipConfig.context}`);
      knowledge.push(`Syntax: ${ipConfig.syntax.slice(0, 5).join(', ')}`);
      knowledge.push(`Best Practices: ${ipConfig.bestPractices.slice(0, 3).join(', ')}`);
      knowledge.push(`Types: ${ipConfig.addressingTypes.slice(0, 3).join(', ')}`);
    }
    
    // Check for user management
    if (lowerPrompt.includes('username') || lowerPrompt.includes('privilege') || lowerPrompt.includes('enable secret')) {
      const userMgmt = this.knowledgeBase.general.userManagement;
      knowledge.push(`User Management: ${userMgmt.context}`);
      knowledge.push(`Syntax: ${userMgmt.syntax.slice(0, 4).join(', ')}`);
      knowledge.push(`Best Practices: ${userMgmt.bestPractices.slice(0, 3).join(', ')}`);
      knowledge.push(`Privilege Levels: ${userMgmt.privilegeLevels.slice(0, 3).join(', ')}`);
    }
    
    // Check for line configuration
    if (lowerPrompt.includes('line console') || lowerPrompt.includes('line vty') || lowerPrompt.includes('transport input')) {
      const lineConfig = this.knowledgeBase.general.lineConfiguration;
      knowledge.push(`Line Configuration: ${lineConfig.context}`);
      knowledge.push(`Syntax: ${lineConfig.syntax.slice(0, 5).join(', ')}`);
      knowledge.push(`Best Practices: ${lineConfig.bestPractices.slice(0, 3).join(', ')}`);
      knowledge.push(`Line Types: ${lineConfig.lineTypes.slice(0, 3).join(', ')}`);
    }
    
    // Check for SSH configuration
    if (lowerPrompt.includes('ssh') || lowerPrompt.includes('crypto key') || lowerPrompt.includes('domain-name')) {
      const sshConfig = this.knowledgeBase.general.sshConfiguration;
      knowledge.push(`SSH Configuration: ${sshConfig.context}`);
      knowledge.push(`Syntax: ${sshConfig.syntax.slice(0, 5).join(', ')}`);
      knowledge.push(`Best Practices: ${sshConfig.bestPractices.slice(0, 3).join(', ')}`);
      knowledge.push(`Requirements: ${sshConfig.requirements.join(', ')}`);
    }
    
    // Check for configuration management
    if (lowerPrompt.includes('copy') || lowerPrompt.includes('write') || lowerPrompt.includes('save') || lowerPrompt.includes('backup')) {
      const configMgmt = this.knowledgeBase.general.configurationManagement;
      knowledge.push(`Configuration Management: ${configMgmt.context}`);
      knowledge.push(`Syntax: ${configMgmt.syntax.slice(0, 4).join(', ')}`);
      knowledge.push(`Best Practices: ${configMgmt.bestPractices.slice(0, 3).join(', ')}`);
      knowledge.push(`Config Types: ${configMgmt.configTypes.slice(0, 3).join(', ')}`);
    }
    
    // If no specific knowledge found, add general context
    if (knowledge.length === 0) {
      const basic = this.knowledgeBase.general.basic;
      knowledge.push(`Basic Config: ${basic.context}`);
      knowledge.push(`Common Commands: ${basic.syntax.slice(0, 3).join(', ')}`);
    }
    
    return knowledge.join('\n');
  }

  /**
   * Check if prompt contains interface short names
   */
  _containsInterfaceShortName(prompt) {
    const lowerPrompt = prompt.toLowerCase();
    const shortNames = ['gi', 'fa', 'te', 'se', 'lo', 'po', 'tu', 'hu', 'fo', 'fi', 'tf', 'th', 'f', 'mg', 'vl'];
    
    // Check for short names followed by numbers/slots
    return shortNames.some(shortName => {
      const pattern = new RegExp(`\\b${shortName}\\d+(?:\\/\\d+(?:\\/\\d+)?)?\\b`, 'i');
      return pattern.test(lowerPrompt);
    });
  }



  /**
   * Pre-process CIDR notation to include wildcard mask hints
   */
  _preprocessCIDR(prompt) {
    // CIDR to SUBNET mask conversion (for ip address commands)
    // NOTE: Wildcard masks are only for OSPF network commands
    const cidrToSubnet = {
      '/8': '255.0.0.0',
      '/9': '255.128.0.0',
      '/10': '255.192.0.0',
      '/11': '255.224.0.0',
      '/12': '255.240.0.0',
      '/13': '255.248.0.0',
      '/14': '255.252.0.0',
      '/15': '255.254.0.0',
      '/16': '255.255.0.0', 
      '/17': '255.255.128.0',
      '/18': '255.255.192.0',
      '/19': '255.255.224.0',
      '/20': '255.255.240.0',
      '/21': '255.255.248.0',
      '/22': '255.255.252.0',
      '/23': '255.255.254.0',
      '/24': '255.255.255.0',
      '/25': '255.255.255.128',
      '/26': '255.255.255.192',
      '/27': '255.255.255.224',
      '/28': '255.255.255.240',
      '/29': '255.255.255.248',
      '/30': '255.255.255.252',
      '/31': '255.255.255.254',
      '/32': '255.255.255.255',
    };
    
    let processed = prompt;
    
    // Replace CIDR notation with IP and SUBNET mask (not wildcard)
    for (const [cidr, subnet] of Object.entries(cidrToSubnet)) {
      const cidrPattern = new RegExp(`(\\d+\\.\\d+\\.\\d+\\.\\d+)${cidr.replace('/', '\\/')}`, 'g');
      processed = processed.replace(cidrPattern, `$1 ${subnet}`);
    }
    
    return processed;
  }

  /**
   * Standardize interface names to proper Cisco format
   */
  _standardizeInterfaceNames(prompt) {
    if (!prompt) return prompt;
    
    let standardized = prompt;
    const interfaceMap = this.knowledgeBase.interfaces.naming.shortNames;
    
    // Create reverse mapping for short names to full names
    const shortToFull = {};
    for (const [fullName, shortNames] of Object.entries(interfaceMap)) {
      shortNames.forEach(shortName => {
        shortToFull[shortName.toLowerCase()] = fullName;
      });
    }
    
    // Replace short names with full names in the prompt
    for (const [shortName, fullName] of Object.entries(shortToFull)) {
      // Match interface short names followed by numbers/slots
      const pattern = new RegExp(`\\b${shortName}(\\d+(?:\\/\\d+(?:\\/\\d+)?)?)\\b`, 'gi');
      standardized = standardized.replace(pattern, `${fullName}$1`);
    }
    
    return standardized;
  }

  /**
   * Clean configuration output for raw device commands
   */
  _cleanConfiguration(rawConfig) {
    if (!rawConfig) return '';
    
    let cleaned = rawConfig;
    
    // Remove code blocks and markdown
    cleaned = cleaned
      .replace(/```cisco/gi, '')
      .replace(/```ios/gi, '')
      .replace(/```/g, '')
      .trim();
    
    // Remove explanatory text
    const unwantedPhrases = [
      /^Here's.*$/gmi,
      /^Here are.*$/gmi,
      /^This.*$/gmi,
      /^Sure.*$/gmi,
      /^Commands:.*$/gmi,
      /^Note:.*$/gmi,
      /^The following.*$/gmi,
      /^These commands.*$/gmi,
      /^Configuration:.*$/gmi,
      /^Output:.*$/gmi,
      /^---+$/gm,
      /^===+$/gm,
      /^#{1,6}\s.*$/gm, // Remove markdown headers
    ];
    
    unwantedPhrases.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });

    // CRITICAL: Remove ALL control characters and special characters except newlines
    // This fixes the "^% Invalid input" error caused by invisible characters
    cleaned = cleaned.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '');
    
    // Split into lines and filter
    const lines = cleaned.split('\n')
      .map(line => {
        // Remove ALL leading/trailing whitespace INCLUDING special unicode spaces
        let cleanLine = line.replace(/^\s+|\s+$/g, '');
        
        // If line has indentation (starts with space), preserve SINGLE space
        if (line.match(/^\s+\S/)) {
          cleanLine = ' ' + line.trim(); // Single space prefix for sub-commands
        }
        
        return cleanLine;
      })
      .filter(line => {
        const trimmed = line.trim();
        // Filter out unwanted lines
        return trimmed && 
               trimmed !== 'configure terminal' && 
               trimmed !== 'end' && 
               trimmed !== 'exit' &&
               trimmed !== 'write memory' &&
               trimmed !== 'copy running-config startup-config' &&
               !trimmed.match(/^(Here|This|Sure|Commands?:|Note:|Output:)/i) &&
               !trimmed.match(/^[^\w\s!-]/); // Remove lines starting with weird characters
      });
    
    // Format with proper indentation for device commands
    const formattedLines = [];
    let inConfigMode = false;
    let currentIndentLevel = 0;
    let currentProtocol = null; // Track current routing protocol
    
    for (let line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines
      if (!trimmed) continue;
      
      // CRITICAL: Validate line contains only valid Cisco IOS characters
      // Allow: alphanumeric, spaces, hyphens, underscores, dots, slashes, colons, !, =, and parentheses
      if (!trimmed.match(/^[a-zA-Z0-9\s\-_./:!=()\[\]]+$/)) {
        console.log(`⚠️ Skipping line with invalid characters: "${trimmed}"`);
        continue; // Skip lines with invalid characters
      }
      
      // Detect routing protocol context
      if (trimmed.startsWith('router ospf')) {
        currentProtocol = 'ospf';
        formattedLines.push(trimmed);
        inConfigMode = true;
        currentIndentLevel = 0;
        continue;
      } else if (trimmed.startsWith('router eigrp')) {
        currentProtocol = 'eigrp';
        formattedLines.push(trimmed);
        inConfigMode = true;
        currentIndentLevel = 0;
        continue;
      } else if (trimmed.startsWith('router bgp')) {
        currentProtocol = 'bgp';
        formattedLines.push(trimmed);
        inConfigMode = true;
        currentIndentLevel = 0;
        continue;
      } else if (trimmed.startsWith('router rip')) {
        currentProtocol = 'rip';
        formattedLines.push(trimmed);
        inConfigMode = true;
        currentIndentLevel = 0;
        continue;
      }
      
      // PROTOCOL-SPECIFIC VALIDATION: Filter out invalid commands
      if (currentProtocol === 'ospf') {
        // OSPF does NOT support "no auto-summary" - skip this line
        if (trimmed === 'no auto-summary') {
          console.log(`⚠️ Removing invalid command for OSPF: "${trimmed}"`);
          continue;
        }
      } else if (currentProtocol === 'bgp') {
        // BGP does NOT support "no auto-summary" - skip this line
        if (trimmed === 'no auto-summary') {
          console.log(`⚠️ Removing invalid command for BGP: "${trimmed}"`);
          continue;
        }
      }
      
      // Check if entering a config mode (main command)
      if (trimmed.startsWith('router ') || 
          trimmed.startsWith('interface ') || 
          trimmed.startsWith('vlan ') || 
          trimmed.startsWith('line ') ||
          trimmed.startsWith('ip access-list ') ||
          trimmed.startsWith('access-list ')) {
        formattedLines.push(trimmed);
        inConfigMode = true;
        currentIndentLevel = 0;
      } 
      // Check for exit/end commands within config mode
      else if (trimmed === '!' || trimmed.startsWith('exit') || trimmed.startsWith('end')) {
        inConfigMode = false;
        currentIndentLevel = 0;
        currentProtocol = null; // Reset protocol context
        // Add blank line for readability between sections
        if (formattedLines.length > 0) {
          formattedLines.push('');
        }
      }
      // Sub-commands get indented with single space
      else if (inConfigMode) {
        // If line already has indentation, preserve it; otherwise add one space
        if (line.startsWith(' ')) {
          formattedLines.push(line);
        } else {
          formattedLines.push(' ' + trimmed);
        }
      }
      // Global commands (no indentation needed)
      else {
        formattedLines.push(trimmed);
        inConfigMode = false;
        currentIndentLevel = 0;
      }
    }
    
    // Remove consecutive blank lines and trim
    const result = formattedLines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    
    // FINAL VALIDATION: Ensure no control characters remain
    const finalClean = result.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '');
    
    console.log(`✅ Configuration cleaned: ${finalClean.length} chars, ${finalClean.split('\n').length} lines`);
    
    return finalClean;
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
   * Parse VLAN tokens from a prompt string. Returns a comma-separated list like '10,20,30'
   */
  _parseVlanList(prompt) {
    if (!prompt || typeof prompt !== 'string') return null;

    // First, try to find an explicit VLAN list following the word 'vlan' or 'vlans'
    // Examples it will catch: 'vlan 10,20,30', 'vlans 10-20,30', 'allow VLANs 10,20'
    const explicitPattern = /vlan(?:s)?\s*(?:allow(?:ed|ing)?\s*)?:?\s*([\d\s,\-]+)/i;
    const explicitMatch = prompt.match(explicitPattern);
    if (explicitMatch && explicitMatch[1]) {
      const raw = explicitMatch[1];
      // Split on commas/spaces and normalize ranges
      const parts = raw.split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
      const tokens = [];
      const seen = new Set();
      for (let p of parts) {
        p = p.replace(/\s*-\s*/g, '-'); // normalize ranges like '10 - 20' -> '10-20'
        if (/^\d+$/.test(p) || /^\d+-\d+$/.test(p)) {
          if (!seen.has(p)) { seen.add(p); tokens.push(p); }
        }
      }
      if (tokens.length > 0) return tokens.join(',');
    }

    // Fallback: look for numbers near keywords 'allow' or 'allowed'
    const allowPattern = /allow(?:ing)?\s*(?:vlan(?:s)?\s*)?:?\s*([\d\s,\-]+)/i;
    const allowMatch = prompt.match(allowPattern);
    if (allowMatch && allowMatch[1]) {
      const raw = allowMatch[1];
      const parts = raw.split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
      const tokens = [];
      const seen = new Set();
      for (let p of parts) {
        p = p.replace(/\s*-\s*/g, '-');
        if (/^\d+$/.test(p) || /^\d+-\d+$/.test(p)) {
          if (!seen.has(p)) { seen.add(p); tokens.push(p); }
        }
      }
      if (tokens.length > 0) return tokens.join(',');
    }

    // Last resort: extract numeric tokens but avoid numbers that are part of interface identifiers
    const regex = /(\d+(?:-\d+)?)/g;
    const tokens = [];
    const seen = new Set();
    let m;
    while ((m = regex.exec(prompt)) !== null) {
      const token = m[1];
      const idx = m.index;
      const before = prompt[idx - 1] || '';
      const after = prompt[idx + token.length] || '';
      // Skip numbers that are adjacent to a slash (part of interface like 1/0/1)
      if (before === '/' || after === '/') continue;
      // Skip if token is part of a larger alphanumeric token (e.g., 'Gi1')
      if (/[A-Za-z]/.test(before) || /[A-Za-z]/.test(after)) continue;
      if (!seen.has(token)) { seen.add(token); tokens.push(token); }
    }
    return tokens.length ? tokens.join(',') : null;
  }

  /**
   * Ensure that when the prompt requests a trunk allowing specific VLANs,
   * the generated configuration contains 'switchport trunk allowed vlan <list>'.
   * This inserts the command after 'switchport mode trunk' or creates a trunk block
   * under the first interface found if needed.
   */
  _ensureTrunkAllowed(configuration, prompt) {
    try {
      if (!configuration || !prompt) return configuration;

      const lower = prompt.toLowerCase();
      // Only act when prompt mentions trunk and vlan(s)
      if (!/trunk/i.test(lower) || !/(vlan|vlans)/i.test(lower)) {
        return configuration;
      }

      const vlanList = this._parseVlanList(prompt);
      if (!vlanList) return configuration;

      // If already present, nothing to do
      if (/switchport trunk allowed vlan/i.test(configuration)) return configuration;

      const lines = configuration.split('\n');

      // Try to insert after the first 'switchport mode trunk' occurrence
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().toLowerCase() === 'switchport mode trunk') {
          // Insert a single-space indented allowed vlan line
          const insertLine = ' switchport trunk allowed vlan ' + vlanList;
          lines.splice(i + 1, 0, insertLine);
          console.log(`ℹ️ Inserted 'switchport trunk allowed vlan ${vlanList}' after switchport mode trunk`);
          return lines.join('\n');
        }
      }

      // If no 'switchport mode trunk' found, attempt to add trunk commands under the first interface
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().toLowerCase().startsWith('interface ')) {
          const insertLines = [
            ' switchport mode trunk',
            ` switchport trunk allowed vlan ${vlanList}`,
            ' no shutdown'
          ];
          lines.splice(i + 1, 0, ...insertLines);
          console.log(`ℹ️ Added trunk block with allowed VLANs ${vlanList} under ${lines[i].trim()}`);
          return lines.join('\n');
        }
      }

      return configuration;
    } catch (err) {
      console.error('⚠️ _ensureTrunkAllowed error:', err.message);
      return configuration;
    }
  }

  /**
   * Get service status
   */
  async getServiceStatus() {
    try {
      // Ollama mode - check status via agent (no API key needed)
      if (this.provider === 'ollama') {
        return {
          status: "configured",
          service: "Ollama (Local AI via Agent)",
          provider: 'ollama',
          model: this.ollamaModel,
          modelAvailable: true,
          knowledgeBase: {
            categories: Object.keys(this.knowledgeBase),
            totalProtocols: Object.keys(this.knowledgeBase.routing).length,
            totalFeatures: Object.keys(this.knowledgeBase.switching).length + 
                          Object.keys(this.knowledgeBase.interfaces).length + 
                          Object.keys(this.knowledgeBase.security).length
          },
          features: [
            "🏠 Local Ollama AI (no cloud API needed)",
            "🧠 Comprehensive Cisco knowledge base",
            "🎯 Context-aware configuration generation",
            "📚 Protocol-specific best practices",
            "🔧 Syntax validation and examples",
            "🔒 Private — data stays on your machine"
          ],
          setup: [
            "Ollama runs on agent machine (localhost:11434)",
            "Check agent settings for Ollama status and model selection"
          ]
        };
      }

      // Check if API key is configured
      if (!this.apiKey || this.apiKey === 'your_openrouter_api_key_here') {
        return {
          status: "not_configured",
          service: "OpenRouter API",
          provider: this.provider,
          model: this.model,
          error: "API key not configured",
          setup: [
            "1. Sign up at https://openrouter.ai",
            "2. Get your API key from the dashboard",
            "3. Add OPENROUTER_API_KEY to your .env file",
            "4. Restart the backend server"
          ]
        };
      }

      // Test API connection with a simple request
      const response = await this.client.post('/chat/completions', {
        model: this.model,
        messages: [
          { role: 'user', content: 'Say OK' }
        ],
        max_tokens: 5
      });

      const isWorking = response.data?.choices?.[0]?.message?.content;

      return {
        status: isWorking ? "connected" : "error",
        service: "OpenRouter API - Knowledge-Enhanced Generation",
        provider: this.provider,
        apiUrl: 'https://openrouter.ai/api/v1',
        model: this.model,
        modelAvailable: !!isWorking,
        knowledgeBase: {
          categories: Object.keys(this.knowledgeBase),
          totalProtocols: Object.keys(this.knowledgeBase.routing).length,
          totalFeatures: Object.keys(this.knowledgeBase.switching).length + 
                        Object.keys(this.knowledgeBase.interfaces).length + 
                        Object.keys(this.knowledgeBase.security).length
        },
        features: [
          "🌐 OpenRouter API with multiple model support",
          "🧠 Comprehensive Cisco knowledge base",
          "🎯 Context-aware configuration generation",
          "📚 Protocol-specific best practices",
          "🔧 Syntax validation and examples",
          "🧹 Clean output formatting",
          "✅ CIDR to wildcard conversion"
        ],
        availableModels: [
          "qwen/qwen-2.5-coder-32b-instruct (Recommended)",
          "anthropic/claude-3.5-sonnet",
          "openai/gpt-4-turbo",
          "google/gemini-pro-1.5",
          "meta-llama/llama-3.1-70b-instruct"
        ]
      };
    } catch (error) {
      let errorMessage = error.message;
      let status = "error";
      
      if (error.response?.status === 401) {
        errorMessage = "Invalid API key";
        status = "unauthorized";
      } else if (error.response?.status === 402) {
        errorMessage = "Insufficient credits";
        status = "no_credits";
      } else if (error.response?.status === 429) {
        errorMessage = "Rate limit exceeded";
        status = "rate_limited";
      }
      
      return {
        status,
        service: "OpenRouter API",
        provider: this.provider,
        model: this.model,
        modelAvailable: false,
        error: errorMessage,
        troubleshooting: [
          "Check your OPENROUTER_API_KEY in .env",
          "Verify your OpenRouter account has credits",
          "Check https://openrouter.ai/docs for status",
          "Try a different model if current one is unavailable"
        ]
      };
    }
  }

  /**
   * Add custom knowledge to the knowledge base
   */
  addKnowledge(category, subcategory, knowledgeData) {
    try {
      if (!this.knowledgeBase[category]) {
        this.knowledgeBase[category] = {};
      }
      
      this.knowledgeBase[category][subcategory] = {
        context: knowledgeData.context || '',
        syntax: knowledgeData.syntax || [],
        examples: knowledgeData.examples || [],
        bestPractices: knowledgeData.bestPractices || []
      };
      
      console.log(`📚 Knowledge added: ${category}.${subcategory}`);
      
      return {
        success: true,
        message: `Knowledge added to ${category}.${subcategory}`,
        knowledgeBase: this.getKnowledgeBaseSummary()
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to add knowledge: ${error.message}`
      };
    }
  }

  /**
   * Get knowledge base summary
   */
  getKnowledgeBaseSummary() {
    const summary = {};
    
    for (const [category, subcategories] of Object.entries(this.knowledgeBase)) {
      summary[category] = {
        subcategories: Object.keys(subcategories),
        count: Object.keys(subcategories).length
      };
    }
    
    return summary;
  }

  /**
   * Get specific knowledge entry
   */
  getKnowledge(category, subcategory) {
    try {
      if (this.knowledgeBase[category] && this.knowledgeBase[category][subcategory]) {
        return {
          success: true,
          knowledge: this.knowledgeBase[category][subcategory]
        };
      } else {
        return {
          success: false,
          error: `Knowledge not found: ${category}.${subcategory}`
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to retrieve knowledge: ${error.message}`
      };
    }
  }

  /**
   * Prompt template helpers
   * Templates may be functions (prompt, deviceType, deviceContext) => string
   * or string templates using {{prompt}}, {{deviceType}} and {{deviceName}} placeholders.
   */
  listPromptTemplates() {
    return Object.keys(this.promptTemplates || {});
  }

  getPromptTemplate(name) {
    const tpl = (this.promptTemplates || {})[name];
    if (!tpl) return { success: false, error: 'Template not found' };
    // Provide previews by invoking functions with placeholders
    const previewSystem = typeof tpl.system === 'function' ? tpl.system('{{prompt}}', '{{deviceType}}', { name: '{{deviceName}}' }) : tpl.system;
    const previewUser = typeof tpl.user === 'function' ? tpl.user('{{prompt}}', '{{deviceType}}', { name: '{{deviceName}}' }) : tpl.user;
    return { success: true, templateName: name, hasSystem: !!tpl.system, hasUser: !!tpl.user, previewSystem, previewUser };
  }

  setPromptTemplate(name, { system, user } = {}) {
    if (!this.promptTemplates) this.promptTemplates = {};

    const makeFn = (val, type) => {
      if (!val) return undefined;
      if (typeof val === 'function') return val;
      if (typeof val === 'string') {
        // Return a function that substitutes placeholders
        return (prompt, deviceType, deviceContext) => {
          const ctx = deviceContext || {};
          return val
            .replace(/\{\{prompt\}\}/g, prompt || '')
            .replace(/\{\{deviceType\}\}/g, deviceType || '')
            .replace(/\{\{deviceName\}\}/g, ctx.name || '');
        };
      }
      throw new Error(`${type} must be a string or function`);
    };

    this.promptTemplates[name] = {
      system: makeFn(system, 'system'),
      user: makeFn(user, 'user')
    };

    return { success: true, message: `Template ${name} set`, template: name };
  }

  /**
   * Runtime setters for API key, model and default params
   */
  setApiKey(key) {
    this.apiKey = key;
    if (this.client && this.client.defaults && this.client.defaults.headers) {
      this.client.defaults.headers['Authorization'] = `Bearer ${key}`;
    }
    return { success: true, apiKeySet: !!key };
  }

  setModel(model) {
    this.model = model;
    return { success: true, model: this.model };
  }

  updateDefaultParams(params = {}) {
    this.defaultParams = { ...this.defaultParams, ...params };
    return { success: true, defaultParams: this.defaultParams };
  }

  /**
   * Build system + user messages from a named template
   */
  buildFromTemplate(name, prompt, deviceType, deviceContext = {}) {
    const tpl = (this.promptTemplates || {})[name];
    if (!tpl) return { success: false, error: 'Template not found' };
    const system = tpl.system ? tpl.system(prompt, deviceType, deviceContext) : this._buildSystemMessage(prompt, deviceType);
    const user = tpl.user ? tpl.user(prompt, deviceType, deviceContext) : this._buildUserMessage(prompt, deviceType, deviceContext);
    return { success: true, system, user };
  }







  /**
   * Generate human-readable explanation of configuration
   */
  async generateExplanation(configuration, deviceType, originalPrompt = '', userId = null) {
    const startTime = Date.now();
    
    try {
      console.log(`📖 Generating explanation for ${deviceType} config`);

      // Check API key (skip in Ollama mode)
      if (this.provider !== 'ollama') {
        if (!this.apiKey || this.apiKey === 'your_openrouter_api_key_here') {
          throw new Error('OpenRouter API key not configured');
        }
      }

      // Detect if the original prompt is in Thai
      const isThaiPrompt = /[\u0E00-\u0E7F]/.test(originalPrompt);
      const language = isThaiPrompt ? 'Thai' : 'English';
      
      console.log(`🌐 Detected language: ${language}`);

      const systemMessage = isThaiPrompt 
        ? `คุณเป็นผู้เชี่ยวชาญด้านเครือข่าย อธิบาย configuration ด้วยภาษาไทยที่เข้าใจง่าย

คำอธิบายของคุณต้อง:
- สั้นและกระชับ (3-5 ประโยคเท่านั้น)
- ใช้ภาษาง่ายๆ ที่คนทั่วไปเข้าใจได้
- เน้นว่ามันทำอะไร ไม่ต้องลงรายละเอียดทางเทคนิค
- หลีกเลี่ยงศัพท์เทคนิคที่ยากเกินไป
- ทำให้คนที่ไม่มีความรู้พื้นฐานก็เข้าใจได้
- ห้ามใช้ hashtag (#) หรือ markdown
- เขียนเป็นประโยยธรรมดาๆ เท่านั้น

ตัวอย่างคำอธิบายที่ดี: "การตั้งค่านี้จะเปิดใช้งานพอร์ต GigabitEthernet0/1 และกำหนด IP address เป็น 192.168.1.1 เพื่อเชื่อมต่อกับเครือข่าย LAN ภายในองค์กร"`
        : `You are a network expert. Explain configurations in simple, easy-to-understand language.

Keep your explanation:
- Short and concise (3-5 sentences maximum)
- Use simple, everyday language
- Focus on WHAT it does, not technical details
- Avoid jargon and technical terms when possible
- Make it understandable for beginners
- NO hashtags (#), NO markdown, NO special formatting
- Just plain text sentences

Example good explanation: "This sets up a network connection on port GigabitEthernet0/1 with IP address 192.168.1.1. It enables the port and adds a description to identify it as the LAN connection."`;

      const userMessage = isThaiPrompt
        ? `อธิบาย configuration ของ ${deviceType} นี้ด้วยภาษาไทยง่ายๆ:

Configuration:
${configuration}

อธิบายสั้นๆ ให้เข้าใจง่าย (ห้ามใช้ hashtag หรือ markdown ใช้ประโยคธรรมดาเท่านั้น):`
        : `Explain this ${deviceType} configuration in simple terms:

Configuration:
${configuration}

Give a brief, easy-to-understand explanation in plain text (NO hashtags, NO markdown, just simple sentences):`;

      console.log(`🎯 Calling explanation model: ${this.getActiveModel()}`);
      
      const messages = [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage }
      ];
      const params = { temperature: 0.4, max_tokens: 300, top_p: 0.9, stop: [] };

      const llmResponse = await this._callChatCompletion(messages, params, userId);

      // Handle async pending (Ollama)
      if (llmResponse.pending) {
        return {
          success: true,
          pending: true,
          commandId: llmResponse.commandId,
          explanation: 'Generating explanation via Ollama...'
        };
      }

      const explanation = llmResponse.choices[0]?.message?.content?.trim();
      
      if (!explanation) {
        throw new Error('No explanation generated');
      }

      // Clean the explanation: remove hashtags, markdown headings, and extra formatting
      let cleanExplanation = explanation
        .replace(/^#+\s*/gm, '')  // Remove markdown headings (# ## ###)
        .replace(/\*\*/g, '')      // Remove bold markdown
        .replace(/\*/g, '')        // Remove italic markdown
        .replace(/`/g, '')         // Remove code backticks
        .trim();

      const executionTime = Date.now() - startTime;
      const tokensUsed = llmResponse.usage?.total_tokens || 0;
      
      console.log(`✅ Explanation generated (${executionTime}ms, ${tokensUsed} tokens)`);
      
      return {
        success: true,
        explanation: cleanExplanation,
        executionTime,
        tokensUsed,
        model: this.getActiveModel()
      };
      
    } catch (error) {
      console.error("❌ Explanation generation failed:", error.message);
      
      return {
        success: false,
        error: `Explanation generation failed: ${error.message}`,
        explanation: 'Unable to generate explanation at this time.',
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Generate NETCONF/YANG XML configuration for NX-OS devices
   * @param {string} prompt - User configuration request
   * @param {string} deviceType - Type of device (nexus, ios, etc.)
   * @param {object} deviceContext - Device context (name, model, location)
   * @param {array} customYangModels - Custom YANG models for reference
   * @param {boolean} useCache - Whether to use cached responses (default true)
   */
  async generateNetconfConfig(prompt, deviceType, deviceContext = {}, customYangModels = [], useCache = true, options = {}) {
    const startTime = Date.now();
    this.stats.totalRequests++;
    
    try {
      console.log(`🌐 Generating NETCONF/YANG config for ${deviceType}: "${prompt}"`);
      console.log(`📚 Custom YANG models provided: ${customYangModels.length}`);

      // Check API key (skip in Ollama mode)
      if (this.provider !== 'ollama') {
        if (!this.apiKey || this.apiKey === 'your_openrouter_api_key_here') {
          throw new Error('OpenRouter API key not configured. Please set OPENROUTER_API_KEY in .env file');
        }
      }
      
      // Check cache first (if enabled and no custom models)
      if (useCache && customYangModels.length === 0) {
        const cacheKey = this._getCacheKey(prompt, deviceType, 'netconf');
        const cachedResult = this._getFromCache(cacheKey);
        if (cachedResult) {
          return {
            ...cachedResult,
            fromCache: true,
            executionTime: Date.now() - startTime
          };
        }
      }
      
      // Check rate limit
      this._checkRateLimit();

      const systemMessage = this._buildNetconfSystemMessage(prompt, deviceType, customYangModels);
      const userMessage = this._buildNetconfUserMessage(prompt, deviceType, deviceContext);
      
      console.log(`📝 NETCONF System message length: ${systemMessage.length} characters`);
      console.log(`🎯 Using model: ${this.getActiveModel()} (${this.provider})`);
      console.log(`📤 User message: ${userMessage.substring(0, 200)}...`);
      
      const messages = [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage }
      ];
      const params = {
        temperature: 0.1,
        max_tokens: 4000,
        top_p: 0.9,
        stop: []
      };
      
      // Call LLM (OpenRouter or Ollama via agent) with retry logic
      let llmResponse;
      let retryCount = 0;
      const maxRetries = this.provider === 'ollama' ? 0 : 2;
      
      console.log(`📨 Sending NETCONF request to ${this.provider}...`);
      
      while (retryCount <= maxRetries) {
        try {
          llmResponse = await this._callChatCompletion(messages, params, options.userId || null);
          console.log(`📥 Received response.`);
          if (llmResponse.choices?.[0]) {
            console.log(`📊 Content length: ${llmResponse.choices[0].message?.content?.length || 0}`);
            console.log(`📊 Finish reason: ${llmResponse.choices[0].finish_reason}`);
          }
          break;
        } catch (apiError) {
          retryCount++;
          console.error(`❌ API Error: ${apiError.message}`);
          if (retryCount > maxRetries) throw this.provider === 'ollama' ? apiError : this._handleApiError(apiError);
          console.log(`⚠️ Retry ${retryCount}/${maxRetries}: ${apiError.message}`);
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }

      // Handle async pending (Ollama generation still in progress)
      if (llmResponse.pending) {
        return {
          success: true,
          pending: true,
          commandId: llmResponse.commandId,
          message: 'NETCONF configuration generation in progress via Ollama. Poll for result.'
        };
      }

      const rawConfig = llmResponse?.choices?.[0]?.message?.content?.trim();
      
      if (!rawConfig) {
        console.error('❌ Empty response from API. Full response:', JSON.stringify(llmResponse, null, 2));
        throw new Error(`Empty response from ${this.getActiveModel()}`);
      }
      
      console.log(`📦 Raw NETCONF response: ${rawConfig.length} chars`);
      
      // Clean and validate NETCONF configuration
      const cleanConfig = this._cleanNetconfConfiguration(rawConfig);
      
      if (!cleanConfig || cleanConfig.length < 50) {
        throw new Error('Generated NETCONF configuration is too short or invalid');
      }
      
      const validation = this._validateNetconfConfiguration(cleanConfig, deviceType);
      const executionTime = Date.now() - startTime;
      const tokensUsed = llmResponse?.usage?.total_tokens || 0;
      
      console.log(`✅ NETCONF config generated successfully (${executionTime}ms, ${tokensUsed} tokens)`);
      
      const activeModel = this.getActiveModel();
      const result = {
        success: true,
        configuration: cleanConfig,
        displayConfig: cleanConfig,
        deploymentConfig: cleanConfig,
        model: activeModel,
        provider: this.provider,
        deviceType,
        configType: 'netconf-yang',
        method: `${this.provider}_netconf`,
        executionTime,
        tokensUsed,
        validation,
        confidenceScore: validation.score,
        recommendations: validation.warnings.length > 0 ? validation.warnings : ['NETCONF configuration looks valid'],
        fromCache: false
      };
      
      // Cache the successful result (only if no custom models were used)
      if (useCache && customYangModels.length === 0) {
        const cacheKey = this._getCacheKey(prompt, deviceType, 'netconf');
        this._setCache(cacheKey, result);
      }
      
      // Update stats
      this.stats.totalTokens += tokensUsed;
      
      return result;
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.stats.errors++;
      console.error("❌ NETCONF generation failed:", error.message);
      
      return {
        success: false,
        error: `NETCONF generation failed: ${error.message}`,
        configuration: null,
        executionTime,
        suggestions: [
          'Check your internet connection',
          'Ensure prompt is clear and specific',
          'Try a simpler configuration request'
        ]
      };
    }
  }

  /**
   * Build system message for NETCONF/YANG generation
   * Supports both NX-OS and IOS-XE device types
   * @param {string} prompt - User configuration request
   * @param {string} deviceType - Type of device: 'nexus', 'nxos', 'ios-xe', 'iosxe', 'ios'
   * @param {array} customYangModels - Custom YANG models for enhanced generation
   */
  _buildNetconfSystemMessage(prompt, deviceType, customYangModels = []) {
    // Normalize device type
    const normalizedType = this._normalizeDeviceType(deviceType);
    
    // Build custom YANG models section
    let customModelsSection = '';
    if (customYangModels && customYangModels.length > 0) {
      customModelsSection = `\n\n=== CUSTOM YANG MODELS PROVIDED ===\nUse these YANG models as the PRIMARY reference for generating the configuration:\n\n`;
      
      for (const model of customYangModels) {
        customModelsSection += `--- ${model.name} ---\n`;
        if (model.namespace) customModelsSection += `Namespace: ${model.namespace}\n`;
        if (model.prefix) customModelsSection += `Prefix: ${model.prefix}\n`;
        if (model.description) customModelsSection += `Description: ${model.description}\n`;
        
        // Add full YANG content if available (for accurate XML structure)
        if (model.content && model.content.length > 0) {
          // Truncate very long YANG files but include key structure
          const maxContentLength = 8000;
          const yangContent = model.content.length > maxContentLength 
            ? model.content.substring(0, maxContentLength) + '\n... [YANG content truncated] ...\n'
            : model.content;
          customModelsSection += `\nYANG Model Definition:\n\`\`\`yang\n${yangContent}\n\`\`\`\n`;
        }
        
        // Add XML templates if available
        if (model.templates && model.templates.length > 0) {
          customModelsSection += `\nXML Templates:\n`;
          for (const tmpl of model.templates) {
            customModelsSection += `\n[${tmpl.name}]${tmpl.description ? ` - ${tmpl.description}` : ''}\n`;
            customModelsSection += `${tmpl.template}\n`;
          }
        }
        
        // Add config paths if available
        if (model.paths && model.paths.length > 0) {
          customModelsSection += `\nConfiguration Paths:\n`;
          for (const path of model.paths) {
            customModelsSection += `- ${path.path}${path.data_type ? ` (${path.data_type})` : ''}${path.required ? ' [required]' : ''}\n`;
            if (path.description) customModelsSection += `  ${path.description}\n`;
          }
        }
        
        customModelsSection += `\n`;
      }
      
      customModelsSection += `=== END CUSTOM YANG MODELS ===\n\nCRITICAL: Generate XML that strictly follows the structure defined in the YANG models above. Use the exact namespaces, containers, lists, and leaf names from the YANG definitions. Do NOT use generic patterns if a specific YANG model applies.\n`;
    }

    // Return device-specific system message
    if (normalizedType === 'ios-xe') {
      return this._buildIosXeNetconfSystemMessage(customModelsSection);
    } else {
      return this._buildNxosNetconfSystemMessage(customModelsSection);
    }
  }

  /**
   * Normalize device type string
   * @param {string} deviceType - Raw device type
   * @returns {string} - Normalized: 'nxos' or 'ios-xe'
   */
  _normalizeDeviceType(deviceType) {
    const type = (deviceType || '').toLowerCase().replace(/[_\s]/g, '-');
    
    if (type.includes('xe') || type === 'ios' || type === 'router') {
      return 'ios-xe';
    }
    if (type.includes('nx') || type === 'nexus') {
      return 'nxos';
    }
    // Default to nxos for backward compatibility
    return 'nxos';
  }

  /**
   * Build NX-OS specific NETCONF system message
   */
  _buildNxosNetconfSystemMessage(customModelsSection = '') {
    return `You are a Cisco NX-OS NETCONF expert. Generate VALID YANG-compliant XML for NETCONF edit-config operations.

NAMESPACE: http://cisco.com/ns/yang/cisco-nx-os-device
ROOT ELEMENT: <System xmlns="http://cisco.com/ns/yang/cisco-nx-os-device">

OUTPUT RULES:
1. Output ONLY the XML content (no explanations, no markdown)
2. Start with <System xmlns="http://cisco.com/ns/yang/cisco-nx-os-device">
3. End with </System>
4. Use proper 2-space indentation
5. All tags must be properly closed
${customModelsSection}
NX-OS YANG STRUCTURE REFERENCE:

INTERFACE (Physical):
<System xmlns="http://cisco.com/ns/yang/cisco-nx-os-device">
  <intf-items>
    <phys-items>
      <PhysIf-list>
        <id>Ethernet1/1</id>
        <adminSt>up</adminSt>
        <descr>Description</descr>
        <mode>trunk</mode>
        <layer>Layer2</layer>
      </PhysIf-list>
    </phys-items>
  </intf-items>
</System>

VLAN (Bridge Domain):
<System xmlns="http://cisco.com/ns/yang/cisco-nx-os-device">
  <bd-items>
    <bd-items>
      <BD-list>
        <fabEncap>vlan-100</fabEncap>
        <name>VLAN_NAME</name>
        <adminSt>active</adminSt>
      </BD-list>
    </bd-items>
  </bd-items>
</System>

SVI (VLAN Interface with IP):
<System xmlns="http://cisco.com/ns/yang/cisco-nx-os-device">
  <intf-items>
    <svi-items>
      <SviIf-list>
        <id>vlan100</id>
        <adminSt>up</adminSt>
      </SviIf-list>
    </svi-items>
  </intf-items>
  <ipv4-items>
    <inst-items>
      <Inst-list>
        <name>default</name>
        <dom-items>
          <Dom-list>
            <name>default</name>
            <if-items>
              <If-list>
                <id>vlan100</id>
                <addr-items>
                  <Addr-list>
                    <addr>192.168.100.1/24</addr>
                  </Addr-list>
                </addr-items>
              </If-list>
            </if-items>
          </Dom-list>
        </dom-items>
      </Inst-list>
    </inst-items>
  </ipv4-items>
</System>

LOOPBACK:
<System xmlns="http://cisco.com/ns/yang/cisco-nx-os-device">
  <intf-items>
    <lb-items>
      <LbIf-list>
        <id>lo0</id>
        <adminSt>up</adminSt>
      </LbIf-list>
    </lb-items>
  </intf-items>
</System>

OSPF:
<System xmlns="http://cisco.com/ns/yang/cisco-nx-os-device">
  <ospf-items>
    <inst-items>
      <Inst-list>
        <name>1</name>
        <adminSt>enabled</adminSt>
        <dom-items>
          <Dom-list>
            <name>default</name>
            <rtrId>1.1.1.1</rtrId>
          </Dom-list>
        </dom-items>
      </Inst-list>
    </inst-items>
  </ospf-items>
</System>

BGP:
<System xmlns="http://cisco.com/ns/yang/cisco-nx-os-device">
  <bgp-items>
    <inst-items>
      <Inst-list>
        <adminSt>enabled</adminSt>
        <asn>65001</asn>
        <dom-items>
          <Dom-list>
            <name>default</name>
            <rtrId>1.1.1.1</rtrId>
          </Dom-list>
        </dom-items>
      </Inst-list>
    </inst-items>
  </bgp-items>
</System>

PORT-CHANNEL:
<System xmlns="http://cisco.com/ns/yang/cisco-nx-os-device">
  <intf-items>
    <aggr-items>
      <AggrIf-list>
        <id>port-channel1</id>
        <adminSt>up</adminSt>
        <pcMode>active</pcMode>
      </AggrIf-list>
    </aggr-items>
  </intf-items>
</System>

ELEMENT VALUES:
- adminSt: up/down (interfaces), enabled/disabled (protocols), active/suspend (VLANs)
- mode: trunk/access (interfaces)
- layer: Layer2/Layer3

Output ONLY the XML configuration now:`;
  }

  /**
   * Build IOS-XE specific NETCONF system message
   */
  _buildIosXeNetconfSystemMessage(customModelsSection = '') {
    return `You are a Cisco IOS-XE NETCONF expert. Generate VALID YANG-compliant XML for NETCONF edit-config operations.

NAMESPACE: http://cisco.com/ns/yang/Cisco-IOS-XE-native
ROOT ELEMENT: <native xmlns="http://cisco.com/ns/yang/Cisco-IOS-XE-native">

OUTPUT RULES:
1. Output ONLY the XML content (no explanations, no markdown)
2. Start with <native xmlns="http://cisco.com/ns/yang/Cisco-IOS-XE-native">
3. End with </native>
4. Use proper 2-space indentation
5. All tags must be properly closed
${customModelsSection}
IOS-XE YANG STRUCTURE REFERENCE:

HOSTNAME:
<native xmlns="http://cisco.com/ns/yang/Cisco-IOS-XE-native">
  <hostname>ROUTER-NAME</hostname>
</native>

INTERFACE (GigabitEthernet):
<native xmlns="http://cisco.com/ns/yang/Cisco-IOS-XE-native">
  <interface>
    <GigabitEthernet>
      <name>0/0/0</name>
      <description>WAN Interface</description>
      <ip>
        <address>
          <primary>
            <address>192.168.1.1</address>
            <mask>255.255.255.0</mask>
          </primary>
        </address>
      </ip>
      <shutdown xmlns:nc="urn:ietf:params:xml:ns:netconf:base:1.0" nc:operation="remove"/>
    </GigabitEthernet>
  </interface>
</native>

LOOPBACK INTERFACE:
<native xmlns="http://cisco.com/ns/yang/Cisco-IOS-XE-native">
  <interface>
    <Loopback>
      <name>0</name>
      <description>Router-ID</description>
      <ip>
        <address>
          <primary>
            <address>1.1.1.1</address>
            <mask>255.255.255.255</mask>
          </primary>
        </address>
      </ip>
    </Loopback>
  </interface>
</native>

VLAN INTERFACE (SVI):
<native xmlns="http://cisco.com/ns/yang/Cisco-IOS-XE-native">
  <interface>
    <Vlan>
      <name>100</name>
      <description>Management VLAN</description>
      <ip>
        <address>
          <primary>
            <address>10.0.100.1</address>
            <mask>255.255.255.0</mask>
          </primary>
        </address>
      </ip>
    </Vlan>
  </interface>
</native>

VLAN DATABASE:
<native xmlns="http://cisco.com/ns/yang/Cisco-IOS-XE-native">
  <vlan>
    <vlan-list xmlns="http://cisco.com/ns/yang/Cisco-IOS-XE-vlan">
      <id>100</id>
      <name>DATA-VLAN</name>
    </vlan-list>
  </vlan>
</native>

SWITCHPORT ACCESS:
<native xmlns="http://cisco.com/ns/yang/Cisco-IOS-XE-native">
  <interface>
    <GigabitEthernet>
      <name>1/0/1</name>
      <switchport>
        <access xmlns="http://cisco.com/ns/yang/Cisco-IOS-XE-switch">
          <vlan>
            <vlan>100</vlan>
          </vlan>
        </access>
        <mode xmlns="http://cisco.com/ns/yang/Cisco-IOS-XE-switch">
          <access/>
        </mode>
      </switchport>
    </GigabitEthernet>
  </interface>
</native>

SWITCHPORT TRUNK:
<native xmlns="http://cisco.com/ns/yang/Cisco-IOS-XE-native">
  <interface>
    <GigabitEthernet>
      <name>1/0/24</name>
      <switchport>
        <trunk xmlns="http://cisco.com/ns/yang/Cisco-IOS-XE-switch">
          <allowed>
            <vlan>
              <vlans>100,200,300</vlans>
            </vlan>
          </allowed>
          <native>
            <vlan>1</vlan>
          </native>
        </trunk>
        <mode xmlns="http://cisco.com/ns/yang/Cisco-IOS-XE-switch">
          <trunk/>
        </mode>
      </switchport>
    </GigabitEthernet>
  </interface>
</native>

OSPF ROUTING:
<native xmlns="http://cisco.com/ns/yang/Cisco-IOS-XE-native">
  <router>
    <ospf xmlns="http://cisco.com/ns/yang/Cisco-IOS-XE-ospf">
      <id>1</id>
      <router-id>1.1.1.1</router-id>
      <network>
        <ip>192.168.0.0</ip>
        <wildcard>0.0.255.255</wildcard>
        <area>0</area>
      </network>
    </ospf>
  </router>
</native>

BGP ROUTING:
<native xmlns="http://cisco.com/ns/yang/Cisco-IOS-XE-native">
  <router>
    <bgp xmlns="http://cisco.com/ns/yang/Cisco-IOS-XE-bgp">
      <id>65001</id>
      <bgp>
        <router-id>
          <ip-id>1.1.1.1</ip-id>
        </router-id>
      </bgp>
      <neighbor>
        <id>10.0.0.2</id>
        <remote-as>65002</remote-as>
      </neighbor>
    </bgp>
  </router>
</native>

EIGRP ROUTING:
<native xmlns="http://cisco.com/ns/yang/Cisco-IOS-XE-native">
  <router>
    <eigrp xmlns="http://cisco.com/ns/yang/Cisco-IOS-XE-eigrp">
      <id>100</id>
      <network>
        <number>10.0.0.0</number>
      </network>
    </eigrp>
  </router>
</native>

STATIC ROUTE:
<native xmlns="http://cisco.com/ns/yang/Cisco-IOS-XE-native">
  <ip>
    <route>
      <ip-route-interface-forwarding-list>
        <prefix>0.0.0.0</prefix>
        <mask>0.0.0.0</mask>
        <fwd-list>
          <fwd>10.0.0.1</fwd>
        </fwd-list>
      </ip-route-interface-forwarding-list>
    </route>
  </ip>
</native>

ACL (Standard):
<native xmlns="http://cisco.com/ns/yang/Cisco-IOS-XE-native">
  <ip>
    <access-list>
      <standard xmlns="http://cisco.com/ns/yang/Cisco-IOS-XE-acl">
        <name>10</name>
        <access-list-seq-rule>
          <sequence>10</sequence>
          <permit>
            <std-ace>
              <ipv4-prefix>192.168.1.0</ipv4-prefix>
              <mask>0.0.0.255</mask>
            </std-ace>
          </permit>
        </access-list-seq-rule>
      </standard>
    </access-list>
  </ip>
</native>

INTERFACE NAMING:
- GigabitEthernet: <name>0/0/0</name> or <name>1/0/1</name>
- TenGigabitEthernet: <name>1/0/1</name>
- Loopback: <name>0</name> (just the number)
- Vlan: <name>100</name> (just the VLAN number)
- Port-channel: <name>1</name>

IMPORTANT IOS-XE NOTES:
- Use full subnet masks (255.255.255.0), not CIDR notation
- Interface names use just the port numbers after the type
- Many features require additional YANG namespaces (Cisco-IOS-XE-ospf, Cisco-IOS-XE-bgp, etc.)
- Use nc:operation="remove" to delete/disable features

Output ONLY the XML configuration now:`;
  }

  /**
   * Build user message for NETCONF/YANG generation
   * Supports both NX-OS and IOS-XE devices
   */
  _buildNetconfUserMessage(prompt, deviceType, deviceContext) {
    const normalizedType = this._normalizeDeviceType(deviceType);
    const deviceName = deviceContext.name || (normalizedType === 'ios-xe' ? 'IOS-XE Device' : 'NX-OS Device');
    const deviceModel = deviceContext.model || (normalizedType === 'ios-xe' ? 'Cisco Router/Catalyst' : 'Cisco Nexus');
    
    const rootElement = normalizedType === 'ios-xe' ? '<native xmlns="...">' : '<System xmlns="...">';
    
    return `Target: ${deviceName} (${deviceModel})
Device Type: ${normalizedType === 'ios-xe' ? 'Cisco IOS-XE' : 'Cisco NX-OS'}
Request: ${prompt}

Generate the NETCONF XML configuration. Output only XML, starting with ${rootElement}`;
  }

  /**
   * Clean NETCONF configuration output
   * Handles both NX-OS and IOS-XE formats
   */
  _cleanNetconfConfiguration(rawConfig, deviceType = 'nxos') {
    if (!rawConfig) return '';
    
    let cleaned = rawConfig;
    
    // Remove code blocks and markdown
    cleaned = cleaned
      .replace(/```xml/gi, '')
      .replace(/```netconf/gi, '')
      .replace(/```/g, '')
      .trim();
    
    // Remove explanatory text before XML
    const xmlStartIndex = cleaned.indexOf('<');
    if (xmlStartIndex > 0) {
      cleaned = cleaned.substring(xmlStartIndex);
    }
    
    // Remove any text after closing XML tag
    const lastCloseTag = cleaned.lastIndexOf('>');
    if (lastCloseTag > 0 && lastCloseTag < cleaned.length - 1) {
      cleaned = cleaned.substring(0, lastCloseTag + 1);
    }
    
    // Remove XML declaration if present (we add our own)
    cleaned = cleaned.replace(/<\?xml[^?]*\?>/gi, '').trim();
    
    // Detect device type from content
    const isIosXe = cleaned.includes('Cisco-IOS-XE') || cleaned.includes('<native');
    
    if (isIosXe) {
      // Try to extract <native> with namespace first (preferred for IOS-XE)
      const nativeWithNsMatch = cleaned.match(/(<native\s+xmlns="http:\/\/cisco\.com\/ns\/yang\/Cisco-IOS-XE-native">[\s\S]*<\/native>)/i);
      if (nativeWithNsMatch && nativeWithNsMatch[1]) {
        console.log(`✅ LLM: Extracted <native> with IOS-XE namespace`);
        return nativeWithNsMatch[1].trim();
      }
      
      // Try to extract <native> without namespace and add it
      const nativeWithoutNsMatch = cleaned.match(/(<native>[\s\S]*<\/native>)/i);
      if (nativeWithoutNsMatch && nativeWithoutNsMatch[1]) {
        console.log(`⚠️ LLM: Found <native> without namespace, adding IOS-XE namespace`);
        return nativeWithoutNsMatch[1].replace('<native>', '<native xmlns="http://cisco.com/ns/yang/Cisco-IOS-XE-native">').trim();
      }
    } else {
      // Try to extract <System> with namespace first (preferred for NX-OS)
      const systemWithNsMatch = cleaned.match(/(<System\s+xmlns="http:\/\/cisco\.com\/ns\/yang\/cisco-nx-os-device">[\s\S]*<\/System>)/i);
      if (systemWithNsMatch && systemWithNsMatch[1]) {
        console.log(`✅ LLM: Extracted <System> with NX-OS namespace`);
        return systemWithNsMatch[1].trim();
      }
      
      // Try to extract <System> without namespace and add it
      const systemWithoutNsMatch = cleaned.match(/(<System>[\s\S]*<\/System>)/i);
      if (systemWithoutNsMatch && systemWithoutNsMatch[1]) {
        console.log(`⚠️ LLM: Found <System> without namespace, adding NX-OS namespace`);
        return systemWithoutNsMatch[1].replace('<System>', '<System xmlns="http://cisco.com/ns/yang/cisco-nx-os-device">').trim();
      }
    }
    
    // Remove RPC wrappers if present (keep everything else)
    cleaned = cleaned.replace(/<rpc[^>]*>/gi, '').trim();
    cleaned = cleaned.replace(/<\/rpc>/gi, '').trim();
    
    // Extract content from edit-config if present
    const editConfigMatch = cleaned.match(/<edit-config[^>]*>[\s\S]*?<config[^>]*>([\s\S]*?)<\/config>[\s\S]*?<\/edit-config>/i);
    if (editConfigMatch && editConfigMatch[1]) {
      cleaned = editConfigMatch[1].trim();
    } else {
      // Just remove the wrappers without extraction
      cleaned = cleaned.replace(/<edit-config[^>]*>/gi, '').trim();
      cleaned = cleaned.replace(/<\/edit-config>/gi, '').trim();
      cleaned = cleaned.replace(/<config[^>]*>/gi, '').trim();
      cleaned = cleaned.replace(/<\/config>/gi, '').trim();
      cleaned = cleaned.replace(/<target[^>]*>[\s\S]*?<\/target>/gi, '').trim();
    }
    
    // Final check - if we have <System> without namespace, add it (NX-OS)
    if (cleaned.includes('<System>') && !cleaned.includes('xmlns=')) {
      cleaned = cleaned.replace('<System>', '<System xmlns="http://cisco.com/ns/yang/cisco-nx-os-device">');
      console.log(`✅ LLM: Added NX-OS namespace to <System>`);
    }
    
    // Final check - if we have <native> without namespace, add it (IOS-XE)
    if (cleaned.includes('<native>') && !cleaned.includes('xmlns=')) {
      cleaned = cleaned.replace('<native>', '<native xmlns="http://cisco.com/ns/yang/Cisco-IOS-XE-native">');
      console.log(`✅ LLM: Added IOS-XE namespace to <native>`);
    }
    
    return cleaned.trim();
  }

  /**
   * Validate NETCONF configuration
   * Supports both NX-OS and IOS-XE formats
   */
  _validateNetconfConfiguration(configuration, deviceType) {
    const normalizedType = this._normalizeDeviceType(deviceType);
    const isIosXe = normalizedType === 'ios-xe' || configuration.includes('Cisco-IOS-XE') || configuration.includes('<native');
    
    const validation = {
      isValid: true,
      score: 100,
      errors: [],
      warnings: [],
      explanation: [],
      deviceType: isIosXe ? 'ios-xe' : 'nxos'
    };

    if (!configuration || configuration.length < 50) {
      validation.isValid = false;
      validation.score = 0;
      validation.errors.push('Configuration too short');
      return validation;
    }

    // Check for valid XML structure
    if (!configuration.includes('<') || !configuration.includes('>')) {
      validation.isValid = false;
      validation.score = 0;
      validation.errors.push('Invalid XML structure');
      return validation;
    }

    if (isIosXe) {
      // IOS-XE specific validation
      
      // Check for IOS-XE namespace
      if (!configuration.includes('Cisco-IOS-XE-native')) {
        validation.warnings.push('Missing IOS-XE YANG namespace - this may cause the device to reject the configuration');
        validation.score -= 20;
      }

      // Check for native root element
      if (!configuration.includes('<native')) {
        validation.warnings.push('Missing <native> root element - IOS-XE YANG requires this as the root');
        validation.score -= 15;
      }

      // Check for closing </native> tag
      if (configuration.includes('<native') && !configuration.includes('</native>')) {
        validation.errors.push('Missing closing </native> tag - XML is malformed');
        validation.isValid = false;
        validation.score -= 30;
      }

      // Check for common IOS-XE YANG elements
      const hasInterface = configuration.includes('<interface>');
      const hasRouter = configuration.includes('<router>');
      const hasVlan = configuration.includes('<vlan>') || configuration.includes('<Vlan>');
      const hasIp = configuration.includes('<ip>');
      const hasHostname = configuration.includes('<hostname>');
      
      if (hasInterface || hasRouter || hasVlan || hasIp || hasHostname) {
        validation.explanation.push('✓ Contains valid IOS-XE YANG configuration elements');
      } else {
        validation.warnings.push('No recognized IOS-XE YANG configuration elements found');
        validation.score -= 5;
      }
      
    } else {
      // NX-OS specific validation
      
      // Check for NX-OS namespace
      if (!configuration.includes('cisco.com/ns/yang/cisco-nx-os-device')) {
        validation.warnings.push('Missing NX-OS YANG namespace - this may cause the device to reject the configuration');
        validation.score -= 20;
      }

      // Check for System root element
      if (!configuration.includes('<System')) {
        validation.warnings.push('Missing <System> root element - NX-OS YANG requires this as the root');
        validation.score -= 15;
      }

      // Check for closing </System> tag
      if (configuration.includes('<System') && !configuration.includes('</System>')) {
        validation.errors.push('Missing closing </System> tag - XML is malformed');
        validation.isValid = false;
        validation.score -= 30;
      }

      // Check for common NX-OS YANG elements
      const hasIntfItems = configuration.includes('<intf-items>') || configuration.includes('<intf-items/>');
      const hasBdItems = configuration.includes('<bd-items>') || configuration.includes('<bd-items/>');
      const hasOspfItems = configuration.includes('<ospf-items>');
      const hasBgpItems = configuration.includes('<bgp-items>');
      const hasIpv4Items = configuration.includes('<ipv4-items>');
      
      if (hasIntfItems || hasBdItems || hasOspfItems || hasBgpItems || hasIpv4Items) {
        validation.explanation.push('✓ Contains valid NX-OS YANG configuration elements');
      } else {
        validation.warnings.push('No recognized NX-OS YANG configuration elements found');
        validation.score -= 5;
      }
    }

    // Improved tag balance check - count self-closing tags properly
    const selfClosingTagCount = (configuration.match(/<[^>]+\/>/g) || []).length;
    const openTags = (configuration.match(/<[^/!][^>]*[^/]>/g) || []).length;
    const closeTags = (configuration.match(/<\/[^>]+>/g) || []).length;
    
    // Open tags (minus self-closing) should equal close tags
    const expectedCloseCount = openTags - selfClosingTagCount;
    if (Math.abs(expectedCloseCount - closeTags) > 2) {
      validation.warnings.push(`Possible unbalanced XML tags (open: ${openTags}, close: ${closeTags}, self-closing: ${selfClosingTagCount})`);
      validation.score -= 10;
    }

    validation.explanation.push(`✓ NETCONF/YANG XML configuration generated for ${isIosXe ? 'IOS-XE' : 'NX-OS'}`);
    
    if (validation.score >= 80) {
      validation.explanation.push('✓ Configuration structure looks valid');
    }
    
    // Log validation result for debugging
    console.log(`🔍 NETCONF Validation (${isIosXe ? 'IOS-XE' : 'NX-OS'}): score=${validation.score}, errors=${validation.errors.length}, warnings=${validation.warnings.length}`);
    if (validation.errors.length > 0) {
      console.log(`❌ Validation errors: ${validation.errors.join(', ')}`);
    }
    if (validation.warnings.length > 0) {
      console.log(`⚠️ Validation warnings: ${validation.warnings.join(', ')}`);
    }
    
    return validation;
  }


  // Graceful shutdown - clear intervals and cache
  shutdown() {
    console.log('🤖 LLM Service shutting down...');
    
    // Clear cache cleanup interval
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
    }
    
    // Clear cache
    this.cache.clear();
    
    // Reset stats
    this.stats = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      totalTokens: 0
    };
    
    console.log('✅ LLM Service shutdown complete');
  }
}

export default new LLMService();
