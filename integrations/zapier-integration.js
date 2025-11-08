/**
 * Zapier Integration for MCP Browser Search Server
 * 
 * This file provides Zapier app integration for the MCP Browser Search Server,
 * allowing users to create Zapier workflows with web search and content extraction.
 */

const { spawn } = require('child_process');

// Authentication (if needed for private instances)
const authentication = {
  type: 'api_key',
  test: {
    url: '{{bundle.authData.server_url}}/health',
    method: 'GET',
  },
  fields: [
    {
      key: 'server_url',
      label: 'MCP Server URL',
      required: false,
      helpText: 'URL of your MCP Browser Search Server (leave empty for local)',
      default: 'local',
    },
    {
      key: 'server_path',
      label: 'MCP Server Path',
      required: true,
      helpText: 'Path to the MCP Browser Search Server executable',
      default: 'mcp-browser-search-fallback',
    },
  ],
};

// Helper function to execute MCP requests
const executeMCPRequest = async (z, bundle, toolName, arguments_) => {
  const serverPath = bundle.authData.server_path || 'mcp-browser-search-fallback';
  
  const mcpRequest = {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: arguments_,
    },
  };

  return new Promise((resolve, reject) => {
    const child = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let responseData = '';
    let errorData = '';

    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error('MCP request timeout'));
    }, 30000);

    child.stdout.on('data', (data) => {
      responseData += data.toString();
      const lines = responseData.split('\n');
      for (const line of lines) {
        if (line.startsWith('{"result"') || line.startsWith('{"error"')) {
          try {
            const response = JSON.parse(line);
            clearTimeout(timeout);
            child.kill();
            
            if (response.result && response.result.content && response.result.content[0]) {
              const result = JSON.parse(response.result.content[0].text);
              resolve(result);
            } else {
              reject(new Error('Invalid response from MCP server'));
            }
            return;
          } catch (e) {
            // Continue if JSON parsing fails
          }
        }
      }
    });

    child.stderr.on('data', (data) => {
      errorData += data.toString();
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      reject(new Error(`MCP server failed: ${errorData || 'Unknown error'}`));
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to start MCP server: ${error.message}`));
    });

    child.stdin.write(JSON.stringify(mcpRequest) + '\n');
    child.stdin.end();
  });
};

// Trigger: New Search Results
const newSearchResultsTrigger = {
  key: 'new_search_results',
  noun: 'Search Result',
  display: {
    label: 'New Search Results',
    description: 'Triggers when new search results are found for a query.',
  },
  operation: {
    inputFields: [
      {
        key: 'query',
        label: 'Search Query',
        type: 'string',
        required: true,
        helpText: 'The search query to monitor for new results',
      },
      {
        key: 'engine',
        label: 'Search Engine',
        type: 'string',
        choices: {
          duckduckgo: 'DuckDuckGo',
          google: 'Google',
          bing: 'Bing',
          searx: 'Searx',
        },
        default: 'duckduckgo',
      },
      {
        key: 'max_results',
        label: 'Max Results',
        type: 'integer',
        default: 10,
      },
    ],
    perform: async (z, bundle) => {
      const results = await executeMCPRequest(z, bundle, 'search_web_fallback', {
        query: bundle.inputData.query,
        engine: bundle.inputData.engine || 'duckduckgo',
        max_results: bundle.inputData.max_results || 10,
      });

      return results.map((result, index) => ({
        id: `${bundle.inputData.query}-${index}-${Date.now()}`,
        query: bundle.inputData.query,
        title: result.title,
        url: result.url,
        snippet: result.snippet,
        domain: result.domain,
        timestamp: new Date().toISOString(),
      }));
    },
    sample: {
      id: 'example-search-1',
      query: 'TypeScript tutorial',
      title: 'TypeScript Tutorial - W3Schools',
      url: 'https://www.w3schools.com/typescript/',
      snippet: 'Learn TypeScript with this comprehensive tutorial...',
      domain: 'w3schools.com',
      timestamp: '2024-01-15T10:00:00Z',
    },
  },
};

// Action: Search Web
const searchWebAction = {
  key: 'search_web',
  noun: 'Web Search',
  display: {
    label: 'Search Web',
    description: 'Search the web using various search engines.',
  },
  operation: {
    inputFields: [
      {
        key: 'query',
        label: 'Search Query',
        type: 'string',
        required: true,
        helpText: 'The search query to execute',
      },
      {
        key: 'engine',
        label: 'Search Engine',
        type: 'string',
        choices: {
          duckduckgo: 'DuckDuckGo',
          google: 'Google',
          bing: 'Bing',
          searx: 'Searx',
          startpage: 'StartPage',
        },
        default: 'duckduckgo',
      },
      {
        key: 'max_results',
        label: 'Max Results',
        type: 'integer',
        default: 10,
        helpText: 'Maximum number of results to return (1-50)',
      },
    ],
    perform: async (z, bundle) => {
      const results = await executeMCPRequest(z, bundle, 'search_web_fallback', {
        query: bundle.inputData.query,
        engine: bundle.inputData.engine || 'duckduckgo',
        max_results: bundle.inputData.max_results || 10,
      });

      return {
        results: results,
        count: results.length,
        query: bundle.inputData.query,
        timestamp: new Date().toISOString(),
      };
    },
    sample: {
      results: [
        {
          title: 'Example Result',
          url: 'https://example.com',
          snippet: 'This is an example search result...',
        },
      ],
      count: 1,
      query: 'example query',
      timestamp: '2024-01-15T10:00:00Z',
    },
  },
};

// Action: Extract Content
const extractContentAction = {
  key: 'extract_content',
  noun: 'Content Extraction',
  display: {
    label: 'Extract Content',
    description: 'Extract content and metadata from a webpage.',
  },
  operation: {
    inputFields: [
      {
        key: 'url',
        label: 'URL',
        type: 'string',
        required: true,
        helpText: 'The URL to extract content from',
      },
      {
        key: 'extract_links',
        label: 'Extract Links',
        type: 'boolean',
        default: false,
        helpText: 'Whether to extract links from the page',
      },
    ],
    perform: async (z, bundle) => {
      const result = await executeMCPRequest(z, bundle, 'fetch_page', {
        url: bundle.inputData.url,
        extract_links: bundle.inputData.extract_links || false,
      });

      return {
        ...result,
        timestamp: new Date().toISOString(),
      };
    },
    sample: {
      url: 'https://example.com',
      title: 'Example Page',
      content: 'This is the extracted content...',
      meta: {
        description: 'Example page description',
        keywords: 'example, page, content',
      },
      timestamp: '2024-01-15T10:00:00Z',
    },
  },
};

// Action: Bulk Search
const bulkSearchAction = {
  key: 'bulk_search',
  noun: 'Bulk Search',
  display: {
    label: 'Bulk Search',
    description: 'Perform multiple searches in parallel.',
  },
  operation: {
    inputFields: [
      {
        key: 'queries',
        label: 'Search Queries',
        type: 'text',
        required: true,
        helpText: 'Enter one search query per line',
      },
      {
        key: 'max_results_per_query',
        label: 'Max Results Per Query',
        type: 'integer',
        default: 5,
      },
    ],
    perform: async (z, bundle) => {
      const queries = bundle.inputData.queries.split('\n').map(q => q.trim()).filter(q => q);
      
      const results = await executeMCPRequest(z, bundle, 'bulk_search', {
        queries: queries,
        max_results_per_query: bundle.inputData.max_results_per_query || 5,
      });

      return {
        results: results,
        total_queries: queries.length,
        timestamp: new Date().toISOString(),
      };
    },
    sample: {
      results: [
        {
          query: 'example query 1',
          results: [
            {
              title: 'Example Result 1',
              url: 'https://example1.com',
              snippet: 'First example result...',
            },
          ],
        },
      ],
      total_queries: 1,
      timestamp: '2024-01-15T10:00:00Z',
    },
  },
};

module.exports = {
  version: require('../package.json').version,
  platformVersion: require('zapier-platform-core').version,

  authentication,

  triggers: {
    [newSearchResultsTrigger.key]: newSearchResultsTrigger,
  },

  searches: {
    [searchWebAction.key]: searchWebAction,
  },

  creates: {
    [extractContentAction.key]: extractContentAction,
    [bulkSearchAction.key]: bulkSearchAction,
  },
};