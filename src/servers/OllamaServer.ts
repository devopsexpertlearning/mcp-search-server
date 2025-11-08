#!/usr/bin/env node

/**
 * Ollama-integrated MCP Server
 */

import { BaseMCPServer } from '../core/BaseMCPServer.js';
import { HttpSearchService } from '../services/HttpSearchService.js';
import { OllamaService, OllamaSearchContext } from '../services/OllamaService.js';
import { CacheService } from '../services/CacheService.js';
import { 
  ToolSchema, 
  MCPToolResult, 
  SearchOptions, 
  ContentExtractionOptions 
} from '../types/index.js';
import { Validator } from '../utils/validation.js';
import { logger } from '../utils/logger.js';
import { DEFAULT_CONFIG } from '../config/constants.js';

export class OllamaServer extends BaseMCPServer {
  private searchService: HttpSearchService;
  private ollamaService: OllamaService;
  private cacheService: CacheService;

  constructor(ollamaConfig?: any) {
    super({
      name: "mcp-browser-search-ollama",
      version: "2.0.0",
      cacheTTL: DEFAULT_CONFIG.CACHE_TTL,
    });

    this.searchService = new HttpSearchService();
    this.ollamaService = new OllamaService(ollamaConfig);
    this.cacheService = new CacheService(this.config.cacheTTL);
  }

  protected getTools(): ToolSchema[] {
    return [
      {
        name: "search_web",
        description: "Search the web and return raw results",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "The search query" },
            engine: {
              type: "string",
              enum: ["google", "bing", "duckduckgo", "searx", "startpage"],
              description: "Search engine to use",
              default: "duckduckgo",
            },
            max_results: { type: "number", default: 10, minimum: 1, maximum: 50 },
            language: { type: "string", description: "Language code", default: "en" },
            region: { type: "string", description: "Region code", default: "us" },
            safe_search: { type: "boolean", description: "Enable safe search", default: true },
            use_cache: { type: "boolean", description: "Use cached results", default: true },
          },
          required: ["query"],
        },
      },
      {
        name: "search_and_answer",
        description: "Search the web and generate an AI-powered answer using Ollama",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "The search query and question" },
            engine: {
              type: "string",
              enum: ["google", "bing", "duckduckgo", "searx", "startpage"],
              default: "duckduckgo",
            },
            max_results: { type: "number", default: 5, minimum: 1, maximum: 20 },
            model: { type: "string", description: "Ollama model to use for answering" },
            custom_prompt: { type: "string", description: "Custom prompt template" },
            use_cache: { type: "boolean", default: true },
          },
          required: ["query"],
        },
      },
      {
        name: "chat_with_search",
        description: "Have a conversation with AI that can search the web for current information",
        inputSchema: {
          type: "object",
          properties: {
            messages: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  role: { type: "string", enum: ["user", "assistant"] },
                  content: { type: "string" },
                },
                required: ["role", "content"],
              },
              description: "Conversation history",
            },
            auto_search: { 
              type: "boolean", 
              default: true,
              description: "Automatically search for information when needed" 
            },
            model: { type: "string", description: "Ollama model to use" },
            search_engine: { type: "string", default: "duckduckgo" },
          },
          required: ["messages"],
        },
      },
      {
        name: "ollama_generate",
        description: "Generate text using Ollama (without search context)",
        inputSchema: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "The prompt to generate from" },
            model: { type: "string", description: "Ollama model to use" },
            system: { type: "string", description: "System prompt" },
            temperature: { type: "number", minimum: 0, maximum: 2, default: 0.7 },
            max_tokens: { type: "number", minimum: 1, maximum: 8192, default: 1000 },
          },
          required: ["prompt"],
        },
      },
      {
        name: "ollama_models",
        description: "List available Ollama models",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "ollama_pull_model",
        description: "Pull a model from Ollama registry",
        inputSchema: {
          type: "object",
          properties: {
            model: { type: "string", description: "Model name to pull" },
          },
          required: ["model"],
        },
      },
      {
        name: "ollama_health",
        description: "Check Ollama service health",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "extract_content",
        description: "Extract content from a webpage",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string", description: "URL to extract content from" },
            extract_links: { type: "boolean", default: false },
            extract_images: { type: "boolean", default: false },
            extract_metadata: { type: "boolean", default: true },
            content_type: {
              type: "string",
              enum: ["article", "all", "text_only"],
              default: "article",
            },
          },
          required: ["url"],
        },
      },
    ];
  }

  protected async handleToolCall(name: string, args: any): Promise<MCPToolResult> {
    switch (name) {
      case "search_web":
        return this.handleWebSearch(args);
        
      case "search_and_answer":
        return this.handleSearchAndAnswer(args);
        
      case "chat_with_search":
        return this.handleChatWithSearch(args);
        
      case "ollama_generate":
        return this.handleOllamaGenerate(args);
        
      case "ollama_models":
        return this.handleOllamaModels();
        
      case "ollama_pull_model":
        return this.handleOllamaPullModel(args);
        
      case "ollama_health":
        return this.handleOllamaHealth();
        
      case "extract_content":
        return this.handleContentExtraction(args);
        
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  private async handleWebSearch(args: any): Promise<MCPToolResult> {
    const options: SearchOptions = {
      query: Validator.validateQuery(args.query),
      engine: Validator.validateSearchEngine(args.engine || 'duckduckgo'),
      maxResults: Validator.validateMaxResults(args.max_results),
      language: Validator.validateLanguage(args.language),
      region: Validator.validateRegion(args.region),
      safeSearch: Validator.validateBoolean(args.safe_search, true),
      useCache: Validator.validateBoolean(args.use_cache, true),
    };

    // Check cache first
    if (options.useCache) {
      const cacheKey = this.cacheService.generateKey(
        'search',
        options.engine!,
        options.query,
        options.maxResults!
      );
      
      const cached = this.cacheService.get(cacheKey);
      if (cached) {
        return this.createSuccessResult({ ...cached, cached: true });
      }
    }

    // Perform search
    const results = await this.searchService.search(
      options.query,
      options.engine!,
      options.maxResults!
    );

    // Cache results
    if (options.useCache) {
      const cacheKey = this.cacheService.generateKey(
        'search',
        options.engine!,
        options.query,
        options.maxResults!
      );
      this.cacheService.set(cacheKey, results);
    }

    return this.createSuccessResult(results);
  }

  private async handleSearchAndAnswer(args: any): Promise<MCPToolResult> {
    const query = Validator.validateQuery(args.query);
    const engine = Validator.validateSearchEngine(args.engine || 'duckduckgo');
    const maxResults = Validator.validateMaxResults(args.max_results || 5);
    const model = args.model;
    const customPrompt = args.custom_prompt;
    const useCache = Validator.validateBoolean(args.use_cache, true);

    // Check if Ollama is healthy
    if (!(await this.ollamaService.isHealthy())) {
      throw new Error('Ollama service is not available. Please ensure Ollama is running and accessible.');
    }

    // Perform search
    const searchResults = await this.searchService.search(query, engine, maxResults);
    
    if (!searchResults || searchResults.length === 0) {
      return this.createSuccessResult({
        query,
        answer: "I couldn't find any search results for your query. Please try rephrasing your question.",
        searchResults: [],
        source: 'fallback',
      });
    }

    try {
      // Generate summary
      const summary = await this.ollamaService.summarizeSearchResults(query, searchResults, model);
      
      // Create search context
      const searchContext: OllamaSearchContext = {
        query,
        results: searchResults,
        summary,
      };

      // Generate AI answer
      const aiResponse = await this.ollamaService.generateWithSearchContext(
        searchContext,
        model,
        customPrompt
      );

      return this.createSuccessResult({
        query,
        answer: aiResponse.response,
        searchResults,
        summary,
        model: aiResponse.model,
        metadata: {
          total_duration: aiResponse.total_duration,
          eval_count: aiResponse.eval_count,
          eval_duration: aiResponse.eval_duration,
        },
        source: 'ollama',
      });

    } catch (error) {
      logger.error(`Ollama generation failed: ${error instanceof Error ? error.message : String(error)}`);
      
      // Fallback to search results only
      return this.createSuccessResult({
        query,
        answer: `I found ${searchResults.length} search results but couldn't generate an AI response. Error: ${error instanceof Error ? error.message : String(error)}`,
        searchResults,
        source: 'search_only',
      });
    }
  }

  private async handleChatWithSearch(args: any): Promise<MCPToolResult> {
    const messages = args.messages || [];
    const autoSearch = Validator.validateBoolean(args.auto_search, true);
    const model = args.model;
    const searchEngine = Validator.validateSearchEngine(args.search_engine || 'duckduckgo');

    if (messages.length === 0) {
      throw new Error('Messages array cannot be empty');
    }

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== 'user') {
      throw new Error('Last message must be from user');
    }

    // Check if Ollama is healthy
    if (!(await this.ollamaService.isHealthy())) {
      throw new Error('Ollama service is not available. Please ensure Ollama is running and accessible.');
    }

    let searchResults: any[] = [];
    let searchPerformed = false;

    // Determine if we need to search (basic heuristics)
    if (autoSearch) {
      const query = lastMessage.content.toLowerCase();
      const searchTriggers = [
        'what is', 'who is', 'when did', 'where is', 'how to', 'latest', 'current',
        'recent', 'news', 'today', 'this year', 'price of', 'information about'
      ];
      
      const needsSearch = searchTriggers.some(trigger => query.includes(trigger));
      
      if (needsSearch) {
        try {
          searchResults = await this.searchService.search(
            lastMessage.content,
            searchEngine,
            5
          );
          searchPerformed = true;
        } catch (error) {
          logger.warn(`Search failed in chat context: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    try {
      let response;

      if (searchPerformed && searchResults.length > 0) {
        // Generate response with search context
        const summary = await this.ollamaService.summarizeSearchResults(
          lastMessage.content,
          searchResults,
          model
        );

        const searchContext: OllamaSearchContext = {
          query: lastMessage.content,
          results: searchResults,
          summary,
        };

        const contextualMessages = [
          ...messages.slice(0, -1),
          {
            role: 'user',
            content: `${lastMessage.content}\n\n[Search Context: ${summary}]`,
          },
        ];

        response = await this.ollamaService.chat(contextualMessages, model);
      } else {
        // Generate response without search context
        response = await this.ollamaService.chat(messages, model);
      }

      return this.createSuccessResult({
        response: response.response,
        model: response.model,
        searchPerformed,
        searchResults: searchPerformed ? searchResults : [],
        metadata: {
          total_duration: response.total_duration,
          eval_count: response.eval_count,
          eval_duration: response.eval_duration,
        },
      });

    } catch (error) {
      logger.error(`Chat generation failed: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Failed to generate chat response: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleOllamaGenerate(args: any): Promise<MCPToolResult> {
    const prompt = Validator.validateQuery(args.prompt);
    const model = args.model;
    const system = args.system;
    const temperature = args.temperature || 0.7;
    const maxTokens = args.max_tokens || 1000;

    // Check if Ollama is healthy
    if (!(await this.ollamaService.isHealthy())) {
      throw new Error('Ollama service is not available. Please ensure Ollama is running and accessible.');
    }

    try {
      const response = await this.ollamaService.generate({
        model: model || this.ollamaService.getConfig().defaultModel,
        prompt,
        system,
        options: {
          temperature,
          num_predict: maxTokens,
        },
      });

      return this.createSuccessResult({
        response: response.response,
        model: response.model,
        metadata: {
          total_duration: response.total_duration,
          eval_count: response.eval_count,
          eval_duration: response.eval_duration,
        },
      });

    } catch (error) {
      logger.error(`Ollama generation failed: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Failed to generate response: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleOllamaModels(): Promise<MCPToolResult> {
    try {
      const models = await this.ollamaService.listModels();
      const config = this.ollamaService.getConfig();

      return this.createSuccessResult({
        models: models.map(model => ({
          name: model.name,
          size: model.size,
          digest: model.digest.slice(0, 12),
          family: model.details?.family,
          parameter_size: model.details?.parameter_size,
        })),
        defaultModel: config.defaultModel,
        ollamaUrl: config.baseUrl,
      });

    } catch (error) {
      logger.error(`Failed to list models: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Failed to list Ollama models: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleOllamaPullModel(args: any): Promise<MCPToolResult> {
    const modelName = args.model;
    if (!modelName) {
      throw new Error('Model name is required');
    }

    try {
      await this.ollamaService.pullModel(modelName);
      return this.createSuccessResult({
        model: modelName,
        status: 'pulled',
        message: `Successfully pulled model: ${modelName}`,
      });

    } catch (error) {
      logger.error(`Failed to pull model: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Failed to pull model ${modelName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleOllamaHealth(): Promise<MCPToolResult> {
    try {
      const isHealthy = await this.ollamaService.isHealthy();
      const config = this.ollamaService.getConfig();

      return this.createSuccessResult({
        status: isHealthy ? 'healthy' : 'unhealthy',
        url: config.baseUrl,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      return this.createSuccessResult({
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
    }
  }

  private async handleContentExtraction(args: any): Promise<MCPToolResult> {
    const options: ContentExtractionOptions = {
      url: Validator.validateUrl(args.url),
      extractLinks: Validator.validateBoolean(args.extract_links, false),
      extractImages: Validator.validateBoolean(args.extract_images, false),
      extractMetadata: Validator.validateBoolean(args.extract_metadata, true),
      contentType: Validator.validateContentType(args.content_type),
    };

    const content = await this.searchService.extractContent(options);
    return this.createSuccessResult(content);
  }

  protected async cleanup(): Promise<void> {
    await this.ollamaService.cleanup();
    this.cacheService.destroy();
    await super.cleanup();
  }
}

// Start server if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new OllamaServer();
  server.run().catch(console.error);
}