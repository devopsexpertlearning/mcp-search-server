/**
 * Type definitions for MCP Browser Search Server
 */

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  domain?: string;
  date?: string;
}

export interface NewsResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  publishedDate?: string;
}

export interface SearchOptions {
  query: string;
  engine?: SearchEngine;
  maxResults?: number;
  language?: string;
  region?: string;
  safeSearch?: boolean;
  useCache?: boolean;
}

export interface ContentExtractionOptions {
  url: string;
  extractLinks?: boolean;
  extractImages?: boolean;
  extractMetadata?: boolean;
  contentType?: 'article' | 'all' | 'text_only';
}

export interface ExtractedContent {
  url: string;
  title?: string;
  content: string;
  metadata?: {
    title?: string;
    description?: string;
    keywords?: string;
    author?: string;
    canonical?: string;
    language?: string;
    published?: string;
  };
  links?: Array<{ text: string; href: string; domain?: string }>;
  images?: Array<{ src: string; alt: string }>;
}

export interface DomainAnalysis {
  domain: string;
  hostname?: string;
  protocol?: string;
  homepage?: {
    title?: string;
    description?: string;
    hasSSL?: boolean;
    language?: string;
  };
  endpoints?: Record<string, string>;
  error?: string;
}

export type SearchEngine = 
  | 'google' 
  | 'bing' 
  | 'duckduckgo' 
  | 'searx' 
  | 'startpage';

export interface CacheEntry<T = any> {
  results: T;
  timestamp: number;
}

export interface ServerConfig {
  name: string;
  version: string;
  cacheTTL?: number;
  maxConcurrent?: number;
  requestTimeout?: number;
  userAgent?: string;
}

export interface ToolSchema {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface MCPRequest {
  jsonrpc: string;
  id: number | string;
  method: string;
  params: any;
}

export interface MCPResponse {
  jsonrpc: string;
  id: number | string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface MCPToolResult {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
}

export interface MCPCallToolResult {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
}