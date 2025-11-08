/**
 * Base MCP Server with common functionality
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { 
  ServerConfig, 
  MCPToolResult, 
  ToolSchema 
} from '../types/index.js';
import { logger } from '../utils/logger.js';
import { ValidationError } from '../utils/validation.js';
import { MCP_ERRORS } from '../config/constants.js';

export abstract class BaseMCPServer {
  protected readonly server: Server;
  protected readonly config: ServerConfig;
  protected readonly logger = logger.child('MCPServer');

  constructor(config: ServerConfig) {
    this.config = config;
    this.server = new Server({
      name: config.name,
      version: config.version,
    });

    this.setupBaseHandlers();
    this.setupErrorHandling();
    this.setupCleanup();
    
    this.logger.info(`MCP Server initialized: ${config.name} v${config.version}`);
  }

  /**
   * Abstract method to get tool definitions
   */
  protected abstract getTools(): ToolSchema[];

  /**
   * Abstract method to handle tool calls
   */
  protected abstract handleToolCall(name: string, args: any): Promise<any>;

  /**
   * Setup base request handlers
   */
  private setupBaseHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      try {
        const tools = this.getTools();
        this.logger.debug(`Listed ${tools.length} tools`);
        return { tools };
      } catch (error) {
        this.logger.error('Failed to list tools', error);
        throw this.createMCPError(MCP_ERRORS.INTERNAL_ERROR, 'Failed to list tools');
      }
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        this.logger.debug(`Tool call: ${name}`, args);
        
        // Validate tool exists
        const tools = this.getTools();
        const tool = tools.find(t => t.name === name);
        
        if (!tool) {
          throw this.createMCPError(MCP_ERRORS.METHOD_NOT_FOUND, `Unknown tool: ${name}`);
        }

        // Call the tool handler
        const result = await this.handleToolCall(name, args);
        
        this.logger.debug(`Tool call completed: ${name}`);
        return result;
        
      } catch (error) {
        this.logger.error(`Tool call failed: ${name}`, error);
        
        if (error instanceof ValidationError) {
          return this.createErrorResult(`Validation error: ${error.message}`);
        }
        
        if (this.isMCPError(error)) {
          throw error;
        }
        
        return this.createErrorResult(
          error instanceof Error ? error.message : String(error)
        );
      }
    });
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      this.logger.error('MCP Server error', error);
    };

    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception', error);
      this.cleanup().finally(() => process.exit(1));
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled rejection', reason);
    });
  }

  /**
   * Setup cleanup handlers
   */
  private setupCleanup(): void {
    const signals = ['SIGINT', 'SIGTERM', 'SIGUSR2'] as const;
    
    signals.forEach(signal => {
      process.on(signal, () => {
        this.logger.info(`Received ${signal}, shutting down gracefully...`);
        this.cleanup().finally(() => {
          this.logger.info('Shutdown complete');
          process.exit(0);
        });
      });
    });
  }

  /**
   * Create standardized error result
   */
  protected createErrorResult(message: string): any {
    return {
      content: [{
        type: "text",
        text: `Error: ${message}`,
      }],
      isError: true,
    };
  }

  /**
   * Create standardized success result
   */
  protected createSuccessResult(data: any): any {
    return {
      content: [{
        type: "text",
        text: JSON.stringify(data, null, 2),
      }],
    };
  }

  /**
   * Create MCP protocol error
   */
  protected createMCPError(code: number, message: string, data?: any): Error {
    const error = new Error(message) as any;
    error.code = code;
    error.data = data;
    return error;
  }

  /**
   * Check if error is MCP protocol error
   */
  private isMCPError(error: any): boolean {
    return error && typeof error.code === 'number';
  }

  /**
   * Validate tool arguments against schema
   */
  protected validateToolArgs(toolName: string, args: any, schema: any): void {
    // Basic validation - can be enhanced with JSON schema validation
    if (schema.required) {
      for (const requiredField of schema.required) {
        if (!(requiredField in args) || args[requiredField] === undefined || args[requiredField] === null) {
          throw new ValidationError(`Missing required field: ${requiredField}`, requiredField);
        }
      }
    }
  }

  /**
   * Start the server
   */
  async run(): Promise<void> {
    try {
      await this.initialize();
      
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      this.logger.info(`MCP Server running on stdio: ${this.config.name} v${this.config.version}`);
    } catch (error) {
      this.logger.error('Failed to start MCP server', error);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Initialize server (override in subclasses for custom setup)
   */
  protected async initialize(): Promise<void> {
    // Default implementation - no initialization needed
  }

  /**
   * Cleanup resources (override in subclasses for custom cleanup)
   */
  protected async cleanup(): Promise<void> {
    this.logger.debug('Base cleanup completed');
  }

  /**
   * Get server statistics
   */
  getStats(): any {
    return {
      name: this.config.name,
      version: this.config.version,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      pid: process.pid,
    };
  }
}