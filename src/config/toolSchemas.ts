/**
 * Shared tool schemas to reduce duplication across servers
 */

import { ToolSchema } from '../types/index.js';

export const SHARED_SEARCH_SCHEMA: ToolSchema = {
  name: "search_web",
  description: "Search the web with multiple engine support",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query to execute",
      },
      engine: {
        type: "string",
        enum: ["google", "bing", "duckduckgo", "searx", "startpage"],
        description: "The search engine to use (default: duckduckgo)",
        default: "duckduckgo",
      },
      max_results: {
        type: "number",
        description: "Maximum number of results to return (default: 10)",
        default: 10,
        minimum: 1,
        maximum: 50,
      },
      language: {
        type: "string",
        description: "Language code (e.g., 'en', 'es', 'fr')",
        default: "en",
      },
      region: {
        type: "string",
        description: "Region code (e.g., 'us', 'uk', 'de')",
        default: "us",
      },
      safe_search: {
        type: "boolean",
        description: "Enable safe search",
        default: true,
      },
    },
    required: ["query"],
  },
};

export const SHARED_CONTENT_EXTRACTION_SCHEMA: ToolSchema = {
  name: "extract_content",
  description: "Extract content from a specific webpage",
  inputSchema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "The URL to visit",
      },
      extract_links: {
        type: "boolean",
        description: "Whether to extract links from the page",
        default: false,
      },
      extract_images: {
        type: "boolean",
        description: "Whether to extract images from the page",
        default: false,
      },
      extract_metadata: {
        type: "boolean",
        description: "Whether to extract metadata from the page",
        default: true,
      },
      content_type: {
        type: "string",
        enum: ["article", "all", "text_only"],
        description: "Type of content to extract",
        default: "article",
      },
    },
    required: ["url"],
  },
};

/**
 * Factory functions to create server-specific tool schemas
 */
export function createSearchToolSchema(serverType: 'browser' | 'fallback' | 'enhanced'): ToolSchema {
  const baseSchema = { ...SHARED_SEARCH_SCHEMA };
  
  switch (serverType) {
    case 'browser':
      baseSchema.name = "search_web";
      baseSchema.description = "Search the web using a browser with full JavaScript support";
      break;
    case 'fallback':
      baseSchema.name = "search_web_fallback";
      baseSchema.description = "Search the web using HTTP requests (fallback method when browser is not available)";
      break;
    case 'enhanced':
      baseSchema.name = "search_web_enhanced";
      baseSchema.description = "Enhanced web search with caching, content analysis, and multiple fallback options";
      break;
  }
  
  return baseSchema;
}

export function createContentExtractionToolSchema(serverType: 'browser' | 'fallback' | 'enhanced'): ToolSchema {
  const baseSchema = { ...SHARED_CONTENT_EXTRACTION_SCHEMA };
  
  switch (serverType) {
    case 'browser':
      baseSchema.name = "visit_page";
      baseSchema.description = "Visit a specific webpage using a browser and extract content";
      break;
    case 'fallback':
      baseSchema.name = "fetch_page";
      baseSchema.description = "Fetch a webpage and extract content using HTTP requests";
      break;
    case 'enhanced':
      baseSchema.name = "analyze_page";
      baseSchema.description = "Analyze a webpage with enhanced content extraction and metadata analysis";
      break;
  }
  
  return baseSchema;
}