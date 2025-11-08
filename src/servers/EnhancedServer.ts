#!/usr/bin/env node

/**
 * Enhanced MCP Server with advanced features
 */

import { BaseMCPServer } from '../core/BaseMCPServer.js';
import { HttpSearchService } from '../services/HttpSearchService.js';
import { CacheService } from '../services/CacheService.js';
import { 
  ToolSchema, 
  MCPToolResult, 
  SearchOptions, 
  ContentExtractionOptions,
  DomainAnalysis 
} from '../types/index.js';
import { Validator } from '../utils/validation.js';
import { DEFAULT_CONFIG, COMMON_ENDPOINTS } from '../config/constants.js';

export class EnhancedServer extends BaseMCPServer {
  private searchService: HttpSearchService;
  private cacheService: CacheService;

  constructor() {
    super({
      name: "mcp-browser-search-enhanced",
      version: "2.0.0",
      cacheTTL: DEFAULT_CONFIG.CACHE_TTL,
    });

    this.searchService = new HttpSearchService();
    this.cacheService = new CacheService(this.config.cacheTTL);
  }

  protected getTools(): ToolSchema[] {
    return [
      {
        name: "search_web",
        description: "Search the web with advanced filtering and caching",
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
        name: "extract_content",
        description: "Extract and analyze content from a webpage",
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
              description: "Type of content to extract",
              default: "article",
            },
          },
          required: ["url"],
        },
      },
      {
        name: "bulk_search",
        description: "Perform multiple searches in parallel",
        inputSchema: {
          type: "object",
          properties: {
            queries: {
              type: "array",
              items: { type: "string" },
              description: "Array of search queries to execute",
            },
            engine: { type: "string", default: "duckduckgo" },
            max_results_per_query: { type: "number", default: 5 },
            use_cache: { type: "boolean", default: true },
          },
          required: ["queries"],
        },
      },
      {
        name: "analyze_domain",
        description: "Analyze a domain for basic information",
        inputSchema: {
          type: "object",
          properties: {
            domain: { type: "string", description: "Domain to analyze" },
            check_subdomains: { type: "boolean", default: false },
          },
          required: ["domain"],
        },
      },
      {
        name: "cache_stats",
        description: "Get cache statistics",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ];
  }

  protected async handleToolCall(name: string, args: any): Promise<MCPToolResult> {
    switch (name) {
      case "search_web":
        return this.handleWebSearch(args);
        
      case "extract_content":
        return this.handleContentExtraction(args);
        
      case "bulk_search":
        return this.handleBulkSearch(args);
        
      case "analyze_domain":
        return this.handleDomainAnalysis(args);
        
      case "cache_stats":
        return this.handleCacheStats();
        
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
        options.maxResults!,
        options.language!,
        options.region!
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
        options.maxResults!,
        options.language!,
        options.region!
      );
      this.cacheService.set(cacheKey, results);
    }

    return this.createSuccessResult(results);
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

  private async handleBulkSearch(args: any): Promise<MCPToolResult> {
    const queries = Validator.validateQueries(args.queries);
    const engine = Validator.validateSearchEngine(args.engine || 'duckduckgo');
    const maxResultsPerQuery = Validator.validateMaxResults(args.max_results_per_query || 5);
    const useCache = Validator.validateBoolean(args.use_cache, true);

    const promises = queries.map(async (query) => {
      try {
        // Check cache first
        if (useCache) {
          const cacheKey = this.cacheService.generateKey('search', engine, query, maxResultsPerQuery);
          const cached = this.cacheService.get(cacheKey);
          if (cached) {
            return { query, results: cached, cached: true };
          }
        }

        // Perform search
        const results = await this.searchService.search(query, engine, maxResultsPerQuery);
        
        // Cache results
        if (useCache) {
          const cacheKey = this.cacheService.generateKey('search', engine, query, maxResultsPerQuery);
          this.cacheService.set(cacheKey, results);
        }

        return { query, results };
      } catch (error) {
        return { 
          query, 
          error: error instanceof Error ? error.message : String(error),
          results: []
        };
      }
    });

    const results = await Promise.all(promises);
    return this.createSuccessResult(results);
  }

  private async handleDomainAnalysis(args: any): Promise<MCPToolResult> {
    const domain = Validator.validateDomain(args.domain);
    const checkSubdomains = Validator.validateBoolean(args.check_subdomains, false);

    const analysis: DomainAnalysis = { domain };

    try {
      // Basic domain info
      const url = new URL(`https://${domain}`);
      analysis.protocol = url.protocol;
      analysis.hostname = url.hostname;

      // Try to fetch the homepage
      const content = await this.searchService.extractContent({
        url: `https://${domain}`,
        extractMetadata: true,
      });

      analysis.homepage = {
        title: content.metadata?.title || '',
        description: content.metadata?.description || '',
        hasSSL: true, // If we got here, SSL worked
        language: content.metadata?.language || '',
      };

      // Check common endpoints
      analysis.endpoints = {};
      
      for (const endpoint of COMMON_ENDPOINTS) {
        try {
          await this.searchService.extractContent({
            url: `https://${domain}${endpoint}`,
          });
          analysis.endpoints[endpoint] = 'exists';
        } catch {
          analysis.endpoints[endpoint] = 'not_found';
        }
      }

    } catch (error) {
      analysis.error = error instanceof Error ? error.message : String(error);
    }

    return this.createSuccessResult(analysis);
  }

  private async handleCacheStats(): Promise<MCPToolResult> {
    const stats = {
      cache: this.cacheService.stats(),
      server: this.getStats(),
    };
    
    return this.createSuccessResult(stats);
  }

  protected async cleanup(): Promise<void> {
    this.cacheService.destroy();
    await super.cleanup();
  }
}

// Start server if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new EnhancedServer();
  server.run().catch(console.error);
}