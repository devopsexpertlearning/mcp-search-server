#!/usr/bin/env node

/**
 * MCP Browser Search CLI Client
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import { table } from 'table';
import { marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import inquirer from 'inquirer';
import fs from 'fs/promises';
import path from 'path';

// Configure marked for terminal output
marked.use(markedTerminal());

interface MCPConfig {
  servers: {
    [key: string]: {
      command: string;
      args: string[];
      env?: Record<string, string>;
    };
  };
  defaultServer: string;
}

class MCPCLIClient {
  private clients: Map<string, Client> = new Map();
  private config: MCPConfig;

  constructor(config: MCPConfig) {
    this.config = config;
  }

  async connect(serverType: string = this.config.defaultServer): Promise<Client> {
    if (this.clients.has(serverType)) {
      return this.clients.get(serverType)!;
    }

    const serverConfig = this.config.servers[serverType];
    if (!serverConfig) {
      throw new Error(`Server configuration not found: ${serverType}`);
    }

    const spinner = ora(`Connecting to ${serverType} server...`).start();

    try {
      const transport = new StdioClientTransport({
        command: serverConfig.command,
        args: serverConfig.args,
        env: { ...process.env, ...serverConfig.env }
      });

      const client = new Client(
        {
          name: 'mcp-cli-client',
          version: '1.0.0'
        },
        {
          capabilities: {
            tools: {},
            resources: {}
          }
        }
      );

      await client.connect(transport);
      this.clients.set(serverType, client);

      spinner.succeed(`Connected to ${serverType} server`);
      return client;

    } catch (error) {
      spinner.fail(`Failed to connect to ${serverType} server`);
      throw error;
    }
  }

  async listTools(serverType?: string): Promise<void> {
    const client = await this.connect(serverType || this.config.defaultServer);
    
    const spinner = ora('Fetching available tools...').start();
    
    try {
      const result = await client.request({
        method: 'tools/list'
      });

      spinner.stop();

      const tools = result.tools || [];
      
      if (tools.length === 0) {
        console.log(chalk.yellow('No tools available'));
        return;
      }

      const tableData = [
        [chalk.bold('Tool Name'), chalk.bold('Description'), chalk.bold('Parameters')]
      ];

      tools.forEach((tool: any) => {
        const params = tool.inputSchema?.properties 
          ? Object.keys(tool.inputSchema.properties).join(', ')
          : 'None';
        
        tableData.push([
          chalk.cyan(tool.name),
          tool.description || 'No description',
          params
        ]);
      });

      console.log(table(tableData, {
        border: {
          topBody: '─',
          topJoin: '┬',
          topLeft: '┌',
          topRight: '┐',
          bottomBody: '─',
          bottomJoin: '┴',
          bottomLeft: '└',
          bottomRight: '┘',
          bodyLeft: '│',
          bodyRight: '│',
          bodyJoin: '│'
        }
      }));

    } catch (error) {
      spinner.fail('Failed to list tools');
      console.error(chalk.red(error.message));
    }
  }

  async callTool(serverType: string, toolName: string, args: any): Promise<any> {
    const client = await this.connect(serverType);
    
    const spinner = ora(`Calling ${toolName}...`).start();
    
    try {
      const result = await client.request({
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        }
      });

      spinner.succeed(`Tool ${toolName} completed`);
      return result;

    } catch (error) {
      spinner.fail(`Tool ${toolName} failed`);
      throw error;
    }
  }

  async search(query: string, options: any = {}): Promise<void> {
    const {
      server = this.config.defaultServer,
      engine = 'duckduckgo',
      maxResults = 5,
      model,
      withAI = false
    } = options;

    try {
      const toolName = withAI ? 'search_and_answer' : 'search_web';
      const args = {
        query,
        engine,
        max_results: maxResults,
        ...(model && { model })
      };

      const result = await this.callTool(server, toolName, args);

      if (withAI && result.answer) {
        console.log(boxen(
          chalk.green.bold('AI Answer:\n\n') + marked(result.answer),
          {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'green'
          }
        ));
      }

      if (result.searchResults || result.results) {
        const results = result.searchResults || result.results;
        console.log(chalk.blue.bold('\nSearch Results:'));
        
        results.forEach((result: any, index: number) => {
          console.log(chalk.cyan(`\n${index + 1}. ${result.title}`));
          console.log(chalk.gray(result.url));
          if (result.description) {
            console.log(result.description);
          }
        });
      }

    } catch (error) {
      console.error(chalk.red('Search failed:'), error.message);
    }
  }

  async chat(options: any = {}): Promise<void> {
    const {
      server = 'ollama',
      model = 'llama2',
      autoSearch = true
    } = options;

    console.log(boxen(
      chalk.blue.bold('MCP Chat Interface') + '\n\n' +
      chalk.gray('Type your message and press Enter. Type "exit" to quit.\n') +
      chalk.gray('Type "clear" to clear conversation history.'),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'blue'
      }
    ));

    const messages: Array<{ role: string; content: string }> = [];

    while (true) {
      const { input } = await inquirer.prompt({
        type: 'input',
        name: 'input',
        message: chalk.green('You:'),
        prefix: ''
      });

      if (input.toLowerCase() === 'exit') {
        break;
      }

      if (input.toLowerCase() === 'clear') {
        messages.length = 0;
        console.log(chalk.yellow('Conversation history cleared.'));
        continue;
      }

      messages.push({ role: 'user', content: input });

      try {
        const result = await this.callTool(server, 'chat_with_search', {
          messages,
          model,
          auto_search: autoSearch
        });

        if (result.response) {
          console.log(chalk.blue('Assistant:'), marked(result.response));
          messages.push({ role: 'assistant', content: result.response });

          if (result.searchPerformed && result.searchResults?.length > 0) {
            console.log(chalk.gray('\n(Used search results from the web)'));
          }
        }

      } catch (error) {
        console.error(chalk.red('Chat error:'), error.message);
      }
    }

    console.log(chalk.yellow('\nChat session ended.'));
  }

  async extractContent(url: string, options: any = {}): Promise<void> {
    const {
      server = 'enhanced',
      extractLinks = false,
      extractImages = false,
      extractMetadata = true
    } = options;

    try {
      const result = await this.callTool(server, 'extract_content', {
        url,
        extract_links: extractLinks,
        extract_images: extractImages,
        extract_metadata: extractMetadata
      });

      if (result.title) {
        console.log(chalk.green.bold('Title:'), result.title);
      }

      if (result.content) {
        console.log(chalk.blue.bold('\nContent:'));
        console.log(marked(result.content));
      }

      if (result.metadata) {
        console.log(chalk.cyan.bold('\nMetadata:'));
        console.log(JSON.stringify(result.metadata, null, 2));
      }

      if (extractLinks && result.links) {
        console.log(chalk.magenta.bold('\nLinks:'));
        result.links.forEach((link: any, index: number) => {
          console.log(`${index + 1}. ${link.text} - ${chalk.gray(link.url)}`);
        });
      }

    } catch (error) {
      console.error(chalk.red('Content extraction failed:'), error.message);
    }
  }

  async getOllamaStatus(): Promise<void> {
    try {
      const healthResult = await this.callTool('ollama', 'ollama_health', {});
      const modelsResult = await this.callTool('ollama', 'ollama_models', {});

      console.log(boxen(
        chalk.green.bold('Ollama Status\n\n') +
        chalk.cyan('Health: ') + (healthResult.status === 'healthy' ? chalk.green('✓ Healthy') : chalk.red('✗ Unhealthy')) + '\n' +
        chalk.cyan('URL: ') + (healthResult.url || 'Unknown') + '\n' +
        chalk.cyan('Models: ') + (modelsResult.models?.length || 0) + ' available',
        {
          padding: 1,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'green'
        }
      ));

      if (modelsResult.models?.length > 0) {
        const tableData = [
          [chalk.bold('Model Name'), chalk.bold('Size'), chalk.bold('Family')]
        ];

        modelsResult.models.forEach((model: any) => {
          tableData.push([
            chalk.cyan(model.name),
            model.size ? `${(model.size / 1e9).toFixed(1)}GB` : 'Unknown',
            model.family || 'Unknown'
          ]);
        });

        console.log('\n' + table(tableData));
      }

    } catch (error) {
      console.error(chalk.red('Failed to get Ollama status:'), error.message);
    }
  }

  async cleanup(): Promise<void> {
    for (const [serverType, client] of this.clients) {
      try {
        await client.close();
        console.log(chalk.gray(`Disconnected from ${serverType} server`));
      } catch (error) {
        console.error(chalk.red(`Error disconnecting from ${serverType}:`), error.message);
      }
    }
    this.clients.clear();
  }
}

// Default configuration
const defaultConfig: MCPConfig = {
  defaultServer: 'enhanced',
  servers: {
    ollama: {
      command: 'node',
      args: ['../../dist/servers/OllamaServer.js'],
      env: {
        NODE_ENV: 'production',
        OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
        OLLAMA_DEFAULT_MODEL: process.env.OLLAMA_DEFAULT_MODEL || 'llama2',
        LOG_LEVEL: 'warn'
      }
    },
    enhanced: {
      command: 'node',
      args: ['../../dist/servers/EnhancedServer.js'],
      env: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'warn'
      }
    },
    fallback: {
      command: 'node',
      args: ['../../dist/servers/FallbackServer.js'],
      env: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'warn'
      }
    }
  }
};

// Load configuration
async function loadConfig(): Promise<MCPConfig> {
  try {
    const configPath = path.join(process.cwd(), 'mcp-config.json');
    const configData = await fs.readFile(configPath, 'utf-8');
    return { ...defaultConfig, ...JSON.parse(configData) };
  } catch {
    return defaultConfig;
  }
}

// CLI Setup
async function main() {
  const config = await loadConfig();
  const mcpClient = new MCPCLIClient(config);

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log(chalk.yellow('\nShutting down gracefully...'));
    await mcpClient.cleanup();
    process.exit(0);
  });

  const program = new Command();

  program
    .name('mcp-search')
    .description('CLI client for MCP Browser Search with Ollama integration')
    .version('1.0.0');

  program
    .command('search')
    .description('Search the web')
    .argument('<query>', 'Search query')
    .option('-s, --server <type>', 'Server type (ollama, enhanced, fallback)', 'enhanced')
    .option('-e, --engine <engine>', 'Search engine', 'duckduckgo')
    .option('-m, --max-results <number>', 'Maximum results', '5')
    .option('--model <model>', 'Ollama model for AI answers', 'llama2')
    .option('--ai', 'Get AI-powered answers (requires Ollama server)', false)
    .action(async (query, options) => {
      await mcpClient.search(query, options);
      await mcpClient.cleanup();
    });

  program
    .command('chat')
    .description('Start an interactive chat session with search capabilities')
    .option('-s, --server <type>', 'Server type', 'ollama')
    .option('--model <model>', 'Ollama model', 'llama2')
    .option('--no-search', 'Disable automatic search', false)
    .action(async (options) => {
      await mcpClient.chat({
        ...options,
        autoSearch: !options.noSearch
      });
      await mcpClient.cleanup();
    });

  program
    .command('extract')
    .description('Extract content from a webpage')
    .argument('<url>', 'URL to extract content from')
    .option('-s, --server <type>', 'Server type', 'enhanced')
    .option('--links', 'Extract links', false)
    .option('--images', 'Extract images', false)
    .option('--no-metadata', 'Skip metadata extraction', false)
    .action(async (url, options) => {
      await mcpClient.extractContent(url, {
        ...options,
        extractMetadata: !options.noMetadata
      });
      await mcpClient.cleanup();
    });

  program
    .command('tools')
    .description('List available tools')
    .option('-s, --server <type>', 'Server type', 'enhanced')
    .action(async (options) => {
      await mcpClient.listTools(options.server);
      await mcpClient.cleanup();
    });

  program
    .command('status')
    .description('Check Ollama server status')
    .action(async () => {
      await mcpClient.getOllamaStatus();
      await mcpClient.cleanup();
    });

  program
    .command('interactive')
    .description('Start interactive mode')
    .action(async () => {
      console.log(boxen(
        chalk.blue.bold('MCP Browser Search - Interactive Mode'),
        { padding: 1, margin: 1, borderStyle: 'double', borderColor: 'blue' }
      ));

      while (true) {
        const { action } = await inquirer.prompt({
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: '🔍 Search the web', value: 'search' },
            { name: '💬 Start chat session', value: 'chat' },
            { name: '📄 Extract webpage content', value: 'extract' },
            { name: '🛠️  List available tools', value: 'tools' },
            { name: '🤖 Check Ollama status', value: 'status' },
            { name: '❌ Exit', value: 'exit' }
          ]
        });

        if (action === 'exit') {
          break;
        }

        try {
          switch (action) {
            case 'search':
              const { searchQuery, useAI } = await inquirer.prompt([
                {
                  type: 'input',
                  name: 'searchQuery',
                  message: 'Enter your search query:'
                },
                {
                  type: 'confirm',
                  name: 'useAI',
                  message: 'Get AI-powered answer? (requires Ollama)',
                  default: false
                }
              ]);
              await mcpClient.search(searchQuery, { withAI: useAI });
              break;

            case 'chat':
              await mcpClient.chat();
              break;

            case 'extract':
              const { extractUrl } = await inquirer.prompt({
                type: 'input',
                name: 'extractUrl',
                message: 'Enter URL to extract content from:'
              });
              await mcpClient.extractContent(extractUrl);
              break;

            case 'tools':
              await mcpClient.listTools();
              break;

            case 'status':
              await mcpClient.getOllamaStatus();
              break;
          }
        } catch (error) {
          console.error(chalk.red('Error:'), error.message);
        }

        console.log(); // Empty line for spacing
      }

      await mcpClient.cleanup();
    });

  await program.parseAsync(process.argv);
}

// Run CLI
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(chalk.red('Fatal error:'), error.message);
    process.exit(1);
  });
}

export { MCPCLIClient, loadConfig };