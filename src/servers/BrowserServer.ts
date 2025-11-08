#!/usr/bin/env node

/**
 * Browser-based MCP Server using Playwright
 */

import { BaseMCPServer } from '../core/BaseMCPServer.js';
import { BrowserSearchService } from '../services/BrowserSearchService.js';
import { 
  ToolSchema, 
  MCPToolResult, 
  SearchOptions, 
  ContentExtractionOptions 
} from '../types/index.js';
import { createSearchToolSchema, createContentExtractionToolSchema } from '../config/toolSchemas.js';
import { SharedValidation } from '../utils/sharedValidation.js';

export class BrowserServer extends BaseMCPServer {
  private searchService: BrowserSearchService;

  constructor() {
    super({
      name: "mcp-browser-search",
      version: "2.0.0",
    });

    this.searchService = new BrowserSearchService();
  }

  protected getTools(): ToolSchema[] {
    return [
      createSearchToolSchema('browser'),
      createContentExtractionToolSchema('browser')
    ];
  }

  protected async handleToolCall(name: string, args: any): Promise<MCPToolResult> {
    switch (name) {
      case "search_web":
        return this.handleWebSearch(args);
        
      case "visit_page":
        return this.handlePageVisit(args);
        
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

  private async handlePageVisit(args: any): Promise<MCPToolResult> {
    const options = SharedValidation.validateContentExtractionArgs(args);

    const content = await this.searchService.extractContent(options);
    return SharedValidation.createSuccessResult(content);
  }

  protected async cleanup(): Promise<void> {
    await this.searchService.cleanup();
    await super.cleanup();
  }
}

// Start server if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new BrowserServer();
  server.run().catch(console.error);
}