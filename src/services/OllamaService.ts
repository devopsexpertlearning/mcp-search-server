/**
 * Ollama Service for integrating with local Ollama instances
 */

import { Ollama } from 'ollama';
import axios from 'axios';
import { logger } from '../utils/logger.js';

export interface OllamaConfig {
  host?: string;
  port?: number;
  baseUrl?: string;
  defaultModel?: string;
  timeout?: number;
}

export interface OllamaModelInfo {
  name: string;
  model: string;
  size: number;
  digest: string;
  details: {
    parent_model: string;
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
  expires_at: string;
  size_vram: number;
}

export interface OllamaGenerateOptions {
  model: string;
  prompt: string;
  system?: string;
  template?: string;
  context?: number[];
  stream?: boolean;
  raw?: boolean;
  format?: string;
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    repeat_penalty?: number;
    seed?: number;
    num_ctx?: number;
    num_predict?: number;
  };
}

export interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface OllamaSearchContext {
  query: string;
  results: any[];
  summary: string;
}

export class OllamaService {
  private ollama: Ollama;
  private config: Required<OllamaConfig>;
  private healthCheckCache: { status: boolean; lastCheck: number } = {
    status: false,
    lastCheck: 0,
  };
  private readonly HEALTH_CHECK_TTL = 30000; // 30 seconds

  constructor(config: OllamaConfig = {}) {
    const defaultConfig: Required<OllamaConfig> = {
      host: config.host || process.env.OLLAMA_HOST || 'localhost',
      port: config.port || parseInt(process.env.OLLAMA_PORT || '11434'),
      baseUrl: config.baseUrl || process.env.OLLAMA_BASE_URL || '',
      defaultModel: config.defaultModel || process.env.OLLAMA_DEFAULT_MODEL || 'llama2',
      timeout: config.timeout || 30000,
    };

    this.config = {
      ...defaultConfig,
      baseUrl: defaultConfig.baseUrl || `http://${defaultConfig.host}:${defaultConfig.port}`,
    };

    this.ollama = new Ollama({
      host: this.config.baseUrl,
    });

    logger.info(`Ollama service initialized with base URL: ${this.config.baseUrl}`);
  }

  /**
   * Check if Ollama is available and healthy
   */
  async isHealthy(): Promise<boolean> {
    const now = Date.now();
    
    // Return cached result if recent
    if (now - this.healthCheckCache.lastCheck < this.HEALTH_CHECK_TTL) {
      return this.healthCheckCache.status;
    }

    try {
      const response = await axios.get(`${this.config.baseUrl}/api/tags`, {
        timeout: 5000,
      });
      
      this.healthCheckCache = {
        status: response.status === 200,
        lastCheck: now,
      };
      
      return this.healthCheckCache.status;
    } catch (error) {
      logger.warn(`Ollama health check failed: ${error instanceof Error ? error.message : String(error)}`);
      this.healthCheckCache = {
        status: false,
        lastCheck: now,
      };
      return false;
    }
  }

  /**
   * List available models
   */
  async listModels(): Promise<OllamaModelInfo[]> {
    try {
      const response = await this.ollama.list();
      return response.models.map(model => ({
        ...model,
        expires_at: model.expires_at instanceof Date ? model.expires_at.toISOString() : model.expires_at
      })) as OllamaModelInfo[];
    } catch (error) {
      logger.error(`Failed to list Ollama models: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to list Ollama models');
    }
  }

  /**
   * Check if a specific model is available
   */
  async isModelAvailable(modelName: string): Promise<boolean> {
    try {
      const models = await this.listModels();
      return models.some(model => model.name === modelName);
    } catch {
      return false;
    }
  }

  /**
   * Pull a model from Ollama registry
   */
  async pullModel(modelName: string): Promise<void> {
    try {
      logger.info(`Pulling Ollama model: ${modelName}`);
      await this.ollama.pull({ model: modelName });
      logger.info(`Successfully pulled model: ${modelName}`);
    } catch (error) {
      logger.error(`Failed to pull model ${modelName}: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Failed to pull model: ${modelName}`);
    }
  }

  /**
   * Generate text using Ollama
   */
  async generate(options: OllamaGenerateOptions): Promise<OllamaResponse> {
    try {
      // Ensure model is available
      if (!(await this.isModelAvailable(options.model))) {
        logger.info(`Model ${options.model} not found, attempting to pull...`);
        await this.pullModel(options.model);
      }

      const response = await this.ollama.generate({
        model: options.model,
        prompt: options.prompt,
        system: options.system,
        template: options.template,
        context: options.context,
        stream: false, // For now, we'll handle non-streaming responses
        raw: options.raw,
        format: options.format,
        options: options.options,
      });

      return {
        ...response,
        created_at: response.created_at instanceof Date ? response.created_at.toISOString() : response.created_at
      } as OllamaResponse;
    } catch (error) {
      logger.error(`Ollama generation failed: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Ollama generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate text with search context
   */
  async generateWithSearchContext(
    searchContext: OllamaSearchContext,
    model?: string,
    customPrompt?: string
  ): Promise<OllamaResponse> {
    const modelToUse = model || this.config.defaultModel;
    
    const systemPrompt = `You are a helpful AI assistant with access to web search results. Use the provided search context to answer questions accurately and comprehensively.`;
    
    const searchResultsText = searchContext.results
      .map((result, index) => `${index + 1}. ${result.title}\n   ${result.description}\n   URL: ${result.url}`)
      .join('\n\n');

    const prompt = customPrompt || `
Based on the following search results for the query "${searchContext.query}", please provide a comprehensive and accurate answer:

Search Results:
${searchResultsText}

Summary: ${searchContext.summary}

Please provide a well-structured response that synthesizes the information from these search results.`;

    return await this.generate({
      model: modelToUse,
      prompt,
      system: systemPrompt,
      options: {
        temperature: 0.7,
        num_ctx: 4096,
      },
    });
  }

  /**
   * Chat with context (for conversation-like interactions)
   */
  async chat(messages: Array<{ role: string; content: string }>, model?: string): Promise<OllamaResponse> {
    const modelToUse = model || this.config.defaultModel;
    
    // Convert messages to a single prompt
    const prompt = messages
      .map(msg => `${msg.role === 'user' ? 'Human' : 'Assistant'}: ${msg.content}`)
      .join('\n') + '\nAssistant:';

    return await this.generate({
      model: modelToUse,
      prompt,
      options: {
        temperature: 0.8,
        num_ctx: 4096,
      },
    });
  }

  /**
   * Summarize search results
   */
  async summarizeSearchResults(query: string, results: any[], model?: string): Promise<string> {
    const modelToUse = model || this.config.defaultModel;
    
    const resultsText = results
      .slice(0, 5) // Limit to first 5 results to avoid token limits
      .map((result, index) => `${index + 1}. ${result.title}: ${result.description}`)
      .join('\n');

    const response = await this.generate({
      model: modelToUse,
      prompt: `Summarize the following search results for the query "${query}" in 2-3 sentences:

${resultsText}`,
      system: 'You are a helpful assistant that provides concise summaries of search results.',
      options: {
        temperature: 0.5,
        num_predict: 150,
      },
    });

    return response.response;
  }

  /**
   * Get model information
   */
  async getModelInfo(modelName: string): Promise<any> {
    try {
      const response = await this.ollama.show({ model: modelName });
      return response;
    } catch (error) {
      logger.error(`Failed to get model info for ${modelName}: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Failed to get model info: ${modelName}`);
    }
  }

  /**
   * Get service configuration
   */
  getConfig(): Required<OllamaConfig> {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<OllamaConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.baseUrl || newConfig.host || newConfig.port) {
      const baseUrl = newConfig.baseUrl || `http://${this.config.host}:${this.config.port}`;
      this.ollama = new Ollama({ host: baseUrl });
      this.config.baseUrl = baseUrl;
    }

    // Reset health check cache when config changes
    this.healthCheckCache = { status: false, lastCheck: 0 };
    
    logger.info(`Ollama configuration updated: ${JSON.stringify(this.config)}`);
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Reset health check cache
    this.healthCheckCache = { status: false, lastCheck: 0 };
    logger.info('Ollama service cleaned up');
  }
}