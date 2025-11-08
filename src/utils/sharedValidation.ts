/**
 * Shared validation utilities for common MCP operations
 */

import { Validator } from './validation.js';
import { SearchOptions, ContentExtractionOptions, MCPToolResult } from '../types/index.js';

export class SharedValidation {
  /**
   * Validate and normalize search arguments
   */
  static validateSearchArgs(args: any): SearchOptions {
    return {
      query: Validator.validateQuery(args.query),
      engine: Validator.validateSearchEngine(args.engine || 'duckduckgo'),
      maxResults: Validator.validateMaxResults(args.max_results),
      language: Validator.validateLanguage(args.language),
      region: Validator.validateRegion(args.region),
      safeSearch: Validator.validateBoolean(args.safe_search, true),
    };
  }

  /**
   * Validate and normalize content extraction arguments
   */
  static validateContentExtractionArgs(args: any): ContentExtractionOptions {
    return {
      url: Validator.validateUrl(args.url),
      extractLinks: Validator.validateBoolean(args.extract_links, false),
      extractImages: Validator.validateBoolean(args.extract_images, false),
      extractMetadata: Validator.validateBoolean(args.extract_metadata, true),
      contentType: Validator.validateContentType(args.content_type),
    };
  }

  /**
   * Create a standardized success result
   */
  static createSuccessResult(data: any): MCPToolResult {
    return {
      content: [{
        type: "text",
        text: typeof data === 'string' ? data : JSON.stringify(data, null, 2)
      }],
      isError: false
    };
  }

  /**
   * Create a standardized error result
   */
  static createErrorResult(error: string | Error): MCPToolResult {
    const message = error instanceof Error ? error.message : error;
    return {
      content: [{
        type: "text", 
        text: `Error: ${message}`
      }],
      isError: true
    };
  }
}