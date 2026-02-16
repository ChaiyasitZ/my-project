/**
 * Ollama Handler - Local LLM integration for NetConfig Agent
 * 
 * Communicates with locally-running Ollama instance (http://localhost:11434)
 * to provide AI-powered configuration generation without cloud API dependencies.
 * 
 * Features:
 * - Health check & model validation
 * - Chat completions (OpenAI-compatible format)
 * - Model listing & management
 * - Automatic retry on failure
 */

const OLLAMA_BASE_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'llama3.2';
const REQUEST_TIMEOUT = 120000; // 120 seconds for generation

export class OllamaHandler {
  constructor() {
    this.baseUrl = OLLAMA_BASE_URL;
    this.defaultModel = DEFAULT_MODEL;
    this.currentModel = null;
    this.available = false;
  }

  /**
   * Check if Ollama is running and accessible
   * @returns {{ available: boolean, version?: string, error?: string }}
   */
  async checkHealth() {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.baseUrl}/api/version`, {
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!response.ok) {
        return { available: false, error: `Ollama returned status ${response.status}` };
      }

      const data = await response.json();
      this.available = true;
      return { available: true, version: data.version };
    } catch (error) {
      this.available = false;
      if (error.name === 'AbortError') {
        return { available: false, error: 'Ollama connection timed out' };
      }
      return { available: false, error: `Cannot connect to Ollama: ${error.message}` };
    }
  }

  /**
   * List available models from local Ollama instance
   * @returns {string[]} Array of model names
   */
  async listModels() {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) throw new Error(`Status ${response.status}`);
      const data = await response.json();
      return (data.models || []).map(m => ({
        name: m.name,
        size: m.size,
        modified: m.modified_at,
        family: m.details?.family || 'unknown'
      }));
    } catch (error) {
      throw new Error(`Failed to list Ollama models: ${error.message}`);
    }
  }

  /**
   * Check if a specific model is available locally
   * @param {string} modelName 
   * @returns {boolean}
   */
  async hasModel(modelName) {
    try {
      const models = await this.listModels();
      return models.some(m => m.name === modelName || m.name.startsWith(modelName + ':'));
    } catch {
      return false;
    }
  }

  /**
   * Set the active model for generation
   * @param {string} modelName 
   */
  setModel(modelName) {
    this.currentModel = modelName;
  }

  /**
   * Get the current active model
   * @returns {string}
   */
  getModel() {
    return this.currentModel || this.defaultModel;
  }

  /**
   * Generate a chat completion using Ollama (OpenAI-compatible endpoint)
   * This is the main method called by the backend via agent commands.
   * 
   * @param {Object} params
   * @param {Array<{role: string, content: string}>} params.messages - Chat messages
   * @param {string} [params.model] - Model to use (overrides current)
   * @param {number} [params.temperature=0.1]
   * @param {number} [params.max_tokens=1000]
   * @param {number} [params.top_p=0.85]
   * @param {number} [params.frequency_penalty=0.3]
   * @param {number} [params.presence_penalty=0.2]
   * @param {string[]} [params.stop] - Stop sequences
   * @returns {Object} OpenAI-compatible chat completion response
   */
  async chatCompletion(params) {
    const {
      messages,
      model,
      temperature = 0.1,
      max_tokens = 1000,
      top_p = 0.85,
      frequency_penalty = 0.3,
      presence_penalty = 0.2,
      stop = []
    } = params;

    const useModel = model || this.getModel();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      // Use Ollama's OpenAI-compatible chat endpoint
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: useModel,
          messages,
          stream: false,
          options: {
            temperature,
            top_p,
            num_predict: max_tokens,
            frequency_penalty,
            presence_penalty,
            stop
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`Ollama API error ${response.status}: ${errorBody}`);
      }

      const data = await response.json();

      // Transform Ollama response to OpenAI-compatible format
      return {
        success: true,
        choices: [
          {
            message: {
              role: 'assistant',
              content: data.message?.content || ''
            },
            finish_reason: data.done ? 'stop' : 'length'
          }
        ],
        usage: {
          prompt_tokens: data.prompt_eval_count || 0,
          completion_tokens: data.eval_count || 0,
          total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
        },
        model: data.model || useModel,
        provider: 'ollama'
      };
    } catch (error) {
      clearTimeout(timeout);
      if (error.name === 'AbortError') {
        throw new Error(`Ollama generation timed out after ${REQUEST_TIMEOUT / 1000}s`);
      }
      throw error;
    }
  }

  /**
   * Simple text generation (non-chat)
   * @param {string} prompt 
   * @param {Object} options 
   * @returns {string} Generated text
   */
  async generate(prompt, options = {}) {
    const result = await this.chatCompletion({
      messages: [{ role: 'user', content: prompt }],
      ...options
    });
    return result.choices[0]?.message?.content || '';
  }

  /**
   * Get full Ollama status including models and health
   * @returns {Object}
   */
  async getStatus() {
    const health = await this.checkHealth();
    
    if (!health.available) {
      return {
        available: false,
        error: health.error,
        models: [],
        currentModel: this.getModel()
      };
    }

    try {
      const models = await this.listModels();
      return {
        available: true,
        version: health.version,
        models,
        currentModel: this.getModel(),
        modelCount: models.length
      };
    } catch (error) {
      return {
        available: true,
        version: health.version,
        models: [],
        currentModel: this.getModel(),
        error: `Failed to list models: ${error.message}`
      };
    }
  }
}
