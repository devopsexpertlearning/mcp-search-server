/**
 * n8n Custom Node for MCP Browser Search Server
 * 
 * This custom node allows n8n workflows to interact with the MCP Browser Search Server
 * for web search and content extraction capabilities.
 */

const { spawn } = require('child_process');

class MCPBrowserSearchNode {
  description = {
    displayName: 'MCP Browser Search',
    name: 'mcpBrowserSearch',
    icon: 'fa:search',
    group: ['search', 'web'],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["query"]}}',
    description: 'Search the web and extract content using MCP Browser Search Server',
    defaults: {
      name: 'MCP Browser Search',
    },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [],
    properties: [
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'Search Web',
            value: 'searchWeb',
            description: 'Search the web using various search engines',
          },
          {
            name: 'Extract Content',
            value: 'extractContent',
            description: 'Extract content from a specific webpage',
          },
          {
            name: 'Bulk Search',
            value: 'bulkSearch',
            description: 'Perform multiple searches in parallel',
          },
          {
            name: 'Analyze Domain',
            value: 'analyzeDomain',
            description: 'Analyze a domain for basic information',
          },
        ],
        default: 'searchWeb',
      },
      {
        displayName: 'MCP Server Path',
        name: 'serverPath',
        type: 'string',
        default: 'mcp-browser-search-fallback',
        description: 'Path to the MCP Browser Search Server executable',
        placeholder: '/path/to/mcp-browser-search/dist/fallback-server.js',
      },
      // Search Web Parameters
      {
        displayName: 'Search Query',
        name: 'query',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['searchWeb'],
          },
        },
        default: '',
        required: true,
        description: 'The search query to execute',
      },
      {
        displayName: 'Search Engine',
        name: 'engine',
        type: 'options',
        displayOptions: {
          show: {
            operation: ['searchWeb'],
          },
        },
        options: [
          { name: 'DuckDuckGo', value: 'duckduckgo' },
          { name: 'Google', value: 'google' },
          { name: 'Bing', value: 'bing' },
          { name: 'Searx', value: 'searx' },
          { name: 'StartPage', value: 'startpage' },
        ],
        default: 'duckduckgo',
      },
      {
        displayName: 'Max Results',
        name: 'maxResults',
        type: 'number',
        displayOptions: {
          show: {
            operation: ['searchWeb'],
          },
        },
        default: 10,
        typeOptions: {
          minValue: 1,
          maxValue: 50,
        },
        description: 'Maximum number of search results to return',
      },
      // Extract Content Parameters
      {
        displayName: 'URL',
        name: 'url',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['extractContent'],
          },
        },
        default: '',
        required: true,
        description: 'The URL to extract content from',
      },
      {
        displayName: 'Extract Links',
        name: 'extractLinks',
        type: 'boolean',
        displayOptions: {
          show: {
            operation: ['extractContent'],
          },
        },
        default: false,
        description: 'Whether to extract links from the page',
      },
      // Bulk Search Parameters
      {
        displayName: 'Search Queries',
        name: 'queries',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['bulkSearch'],
          },
        },
        default: '',
        required: true,
        description: 'Comma-separated list of search queries',
        placeholder: 'query1, query2, query3',
      },
      // Analyze Domain Parameters
      {
        displayName: 'Domain',
        name: 'domain',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['analyzeDomain'],
          },
        },
        default: '',
        required: true,
        description: 'Domain to analyze (e.g., example.com)',
      },
    ],
  };

  async execute() {
    const items = this.getInputData();
    const returnData = [];

    for (let i = 0; i < items.length; i++) {
      const operation = this.getNodeParameter('operation', i);
      const serverPath = this.getNodeParameter('serverPath', i);

      let mcpRequest;
      let toolName;

      try {
        switch (operation) {
          case 'searchWeb':
            toolName = 'search_web_fallback';
            mcpRequest = {
              jsonrpc: '2.0',
              id: Date.now(),
              method: 'tools/call',
              params: {
                name: toolName,
                arguments: {
                  query: this.getNodeParameter('query', i),
                  engine: this.getNodeParameter('engine', i),
                  max_results: this.getNodeParameter('maxResults', i),
                },
              },
            };
            break;

          case 'extractContent':
            toolName = 'fetch_page';
            mcpRequest = {
              jsonrpc: '2.0',
              id: Date.now(),
              method: 'tools/call',
              params: {
                name: toolName,
                arguments: {
                  url: this.getNodeParameter('url', i),
                  extract_links: this.getNodeParameter('extractLinks', i),
                },
              },
            };
            break;

          case 'bulkSearch':
            toolName = 'bulk_search';
            const queriesStr = this.getNodeParameter('queries', i);
            const queries = queriesStr.split(',').map(q => q.trim()).filter(q => q);
            mcpRequest = {
              jsonrpc: '2.0',
              id: Date.now(),
              method: 'tools/call',
              params: {
                name: toolName,
                arguments: {
                  queries: queries,
                },
              },
            };
            break;

          case 'analyzeDomain':
            toolName = 'analyze_domain';
            mcpRequest = {
              jsonrpc: '2.0',
              id: Date.now(),
              method: 'tools/call',
              params: {
                name: toolName,
                arguments: {
                  domain: this.getNodeParameter('domain', i),
                },
              },
            };
            break;

          default:
            throw new Error(`Unknown operation: ${operation}`);
        }

        // Execute MCP request
        const result = await this.executeMCPRequest(serverPath, mcpRequest);
        
        // Parse the result
        let parsedResult;
        if (result.result && result.result.content && result.result.content[0]) {
          parsedResult = JSON.parse(result.result.content[0].text);
        } else {
          throw new Error('Invalid response from MCP server');
        }

        returnData.push({
          json: {
            operation,
            toolName,
            input: mcpRequest.params.arguments,
            result: parsedResult,
            timestamp: new Date().toISOString(),
          },
        });

      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: {
              operation,
              error: error.message,
              timestamp: new Date().toISOString(),
            },
          });
        } else {
          throw error;
        }
      }
    }

    return [returnData];
  }

  async executeMCPRequest(serverPath, request) {
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
        // Look for complete JSON response
        const lines = responseData.split('\n');
        for (const line of lines) {
          if (line.startsWith('{"result"') || line.startsWith('{"error"')) {
            try {
              const response = JSON.parse(line);
              clearTimeout(timeout);
              child.kill();
              resolve(response);
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
        if (!responseData.includes('{"result"')) {
          reject(new Error(`MCP server failed: ${errorData || 'Unknown error'}`));
        }
      });

      child.on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to start MCP server: ${error.message}`));
      });

      // Send the request
      child.stdin.write(JSON.stringify(request) + '\n');
      child.stdin.end();
    });
  }
}

module.exports = {
  MCPBrowserSearchNode,
};