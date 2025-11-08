/**
 * Configuration constants for MCP Browser Search Server
 */

export const DEFAULT_CONFIG = {
  CACHE_TTL: 5 * 60 * 1000, // 5 minutes
  MAX_RESULTS: 50,
  DEFAULT_MAX_RESULTS: 10,
  REQUEST_TIMEOUT: 30000, // 30 seconds
  MAX_CONCURRENT: 5,
  MAX_CONTENT_LENGTH: 5000,
  MAX_LINKS: 50,
  MAX_IMAGES: 20,
} as const;

export const SEARCH_ENGINES = {
  GOOGLE: 'google',
  BING: 'bing', 
  DUCKDUCKGO: 'duckduckgo',
  SEARX: 'searx',
  STARTPAGE: 'startpage',
} as const;

export const USER_AGENTS = {
  DEFAULT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  MCP_SERVER: 'MCP Browser Search Server/2.0',
} as const;

export const COMMON_ENDPOINTS = [
  '/robots.txt',
  '/sitemap.xml', 
  '/.well-known/security.txt'
] as const;

export const CONTENT_SELECTORS = {
  ARTICLE: ['article', '[role="main"]', '.content', '.post', '.entry'],
  REMOVE: ['script', 'style', 'nav', 'footer', 'header', 'aside', '.ad', '.advertisement'],
} as const;

export const SEARCH_SELECTORS = {
  GOOGLE: {
    RESULTS: 'div.g',
    TITLE: 'h3',
    LINK: 'a[href^="http"]',
    SNIPPET: 'span:contains("...")',
  },
  BING: {
    RESULTS: 'li.b_algo',
    TITLE: 'h2 a',
    SNIPPET: 'p, .b_caption p',
  },
  DUCKDUCKGO: {
    RESULTS: '.result',
    TITLE: '.result__title a',
    SNIPPET: '.result__snippet',
  },
} as const;

export const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TIMEOUT: 408,
  INTERNAL_ERROR: 500,
} as const;

export const MCP_ERRORS = {
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
} as const;