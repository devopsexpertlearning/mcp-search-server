#!/usr/bin/env node

/**
 * Fallback MCP Server using HTTP requests
 */

import { BaseMCPServer } from '../core/BaseMCPServer.js';
import { HttpSearchService } from '../services/HttpSearchService.js';
import { 
  ToolSchema, 
  MCPToolResult, 
  SearchOptions, 
  ContentExtractionOptions 
} from '../types/index.js';
import { createSearchToolSchema, createContentExtractionToolSchema } from '../config/toolSchemas.js';
import { SharedValidation } from '../utils/sharedValidation.js';

export class FallbackServer extends BaseMCPServer {
  private searchService: HttpSearchService;

  constructor() {
    super({
      name: "mcp-browser-search-fallback",
      version: "2.0.0",
    });

    this.searchService = new HttpSearchService();
  }

  protected getTools(): ToolSchema[] {
    return [
      createSearchToolSchema('fallback'),
      createContentExtractionToolSchema('fallback')
    ];
  }

  protected async handleToolCall(name: string, args: any): Promise<MCPToolResult> {
    switch (name) {
      case "search_web_fallback":
        return this.handleWebSearch(args);
        
      case "fetch_page":
        return this.handlePageFetch(args);
        
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  private async handleWebSearch(args: any): Promise<MCPToolResult> {
    const options = SharedValidation.validateSearchArgs(args);

    const results = await this.searchService.search(
      options.query,
      options.engine!,
      options.maxResults!
    );

    return SharedValidation.createSuccessResult(results);
  }

  private async handlePageFetch(args: any): Promise<MCPToolResult> {
    const options = SharedValidation.validateContentExtractionArgs(args);

    const content = await this.searchService.extractContent(options);
    return SharedValidation.createSuccessResult(content);
  }
}

// Start server if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new FallbackServer();
  server.run().catch(console.error);
}