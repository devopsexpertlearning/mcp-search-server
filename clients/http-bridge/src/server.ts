#!/usr/bin/env node

/**
 * MCP HTTP Bridge Server
 * Provides HTTP/WebSocket API access to MCP servers for web and mobile clients
 */

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createClient as createRedisClient } from 'redis';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Joi from 'joi';
import swaggerUi from 'swagger-ui-express';
import winston from 'winston';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Configuration
const PORT = process.env.PORT || 8080;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Logger setup
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Express app setup
const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Redis client
let redisClient: any = null;
if (REDIS_URL) {
  redisClient = createRedisClient({ url: REDIS_URL });
  redisClient.on('error', (err: Error) => logger.error('Redis Client Error', err));
  redisClient.connect().catch((err: Error) => logger.error('Redis connection failed', err));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(limiter);

// Swagger documentation
const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'MCP Browser Search HTTP Bridge API',
    version: '1.0.0',
    description: 'HTTP API for MCP Browser Search with Ollama integration'
  },
  servers: [{ url: `http://localhost:${PORT}` }],
  paths: {
    '/api/health': {
      get: {
        summary: 'Health check',
        responses: { '200': { description: 'Service is healthy' } }
      }
    },
    '/api/auth/login': {
      post: {
        summary: 'User login',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  username: { type: 'string' },
                  password: { type: 'string' }
                },
                required: ['username', 'password']
              }
            }
          }
        },
        responses: { '200': { description: 'Login successful' } }
      }
    },
    '/api/servers': {
      get: {
        summary: 'List available MCP servers',
        responses: { '200': { description: 'List of servers' } }
      }
    },
    '/api/servers/{serverType}/tools': {
      get: {
        summary: 'List tools for a server',
        parameters: [{
          name: 'serverType',
          in: 'path',
          required: true,
          schema: { type: 'string' }
        }],
        responses: { '200': { description: 'List of tools' } }
      }
    },
    '/api/servers/{serverType}/tools/{toolName}': {
      post: {
        summary: 'Call a tool',
        parameters: [
          {
            name: 'serverType',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          },
          {
            name: 'toolName',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object' }
            }
          }
        },
        responses: { '200': { description: 'Tool result' } }
      }
    }
  }
};

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// MCP Client Manager
class MCPBridgeManager {
  private clients: Map<string, Client> = new Map();
  private serverConfigs = {
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
        REDIS_URL: REDIS_URL,
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
  };

  async getClient(serverType: string): Promise<Client> {
    if (this.clients.has(serverType)) {
      return this.clients.get(serverType)!;
    }

    const config = this.serverConfigs[serverType as keyof typeof this.serverConfigs];
    if (!config) {
      throw new Error(`Unknown server type: ${serverType}`);
    }

    try {
      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        env: { ...process.env, ...config.env }
      });

      const client = new Client(
        {
          name: 'mcp-http-bridge',
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
      
      // Initialize the connection properly
      await client.request({
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
            resources: {}
          },
          clientInfo: {
            name: 'mcp-http-bridge',
            version: '1.0.0'
          }
        }
      });
      this.clients.set(serverType, client);
      
      logger.info(`Connected to ${serverType} MCP server`);
      return client;

    } catch (error) {
      logger.error(`Failed to connect to ${serverType} server:`, error);
      throw error;
    }
  }

  async callTool(serverType: string, toolName: string, args: any): Promise<any> {
    const client = await this.getClient(serverType);
    
    try {
      const result = await client.request(
        { 
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: args
          }
        },
        {}
      );

      // Cache result if Redis is available
      if (redisClient) {
        const cacheKey = `tool:${serverType}:${toolName}:${JSON.stringify(args)}`;
        await redisClient.setEx(cacheKey, 3600, JSON.stringify(result)); // Cache for 1 hour
      }

      return result;
    } catch (error) {
      logger.error(`Tool call failed for ${toolName}:`, error);
      throw error;
    }
  }

  async listTools(serverType: string): Promise<any[]> {
    const client = await this.getClient(serverType);
    
    try {
      const result = await client.request(
        { method: 'tools/list' },
        {}
      );

      return (result as any).tools || [];
    } catch (error) {
      logger.error(`Failed to list tools for ${serverType}:`, error);
      throw error;
    }
  }

  async getServerInfo(): Promise<any> {
    const servers = [];
    
    for (const [serverType, config] of Object.entries(this.serverConfigs)) {
      try {
        const client = await this.getClient(serverType);
        const tools = await this.listTools(serverType);
        
        servers.push({
          type: serverType,
          status: 'connected',
          toolCount: tools.length,
          tools: tools.map(tool => ({
            name: tool.name,
            description: tool.description
          }))
        });
      } catch (error) {
        servers.push({
          type: serverType,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return servers;
  }

  async cleanup(): Promise<void> {
    for (const [serverType, client] of this.clients) {
      try {
        await client.close();
        logger.info(`Disconnected from ${serverType} server`);
      } catch (error) {
        logger.error(`Error disconnecting from ${serverType}:`, error);
      }
    }
    this.clients.clear();
  }
}

const mcpManager = new MCPBridgeManager();

// Authentication middleware
const authenticateToken = (req: any, res: any, next: any) => {
  if (NODE_ENV === 'development') {
    return next(); // Skip auth in development
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Input validation schemas
const toolCallSchema = Joi.object({
  query: Joi.string().when('toolName', {
    is: Joi.string().valid('search_web', 'search_and_answer'),
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  engine: Joi.string().valid('google', 'bing', 'duckduckgo', 'searx', 'startpage').optional(),
  max_results: Joi.number().min(1).max(50).optional(),
  model: Joi.string().optional(),
  url: Joi.string().uri().when('toolName', {
    is: 'extract_content',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  messages: Joi.array().when('toolName', {
    is: 'chat_with_search',
    then: Joi.required(),
    otherwise: Joi.optional()
  })
}).unknown(true);

// API Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime()
  });
});

// Authentication routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Simple auth for demo - replace with real authentication
    const validUsers = {
      'admin': '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password
      'demo': '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'   // password
    };

    if (!validUsers[username as keyof typeof validUsers]) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, validUsers[username as keyof typeof validUsers]);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { username } });

  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// MCP API routes
app.get('/api/servers', authenticateToken, async (req, res) => {
  try {
    const servers = await mcpManager.getServerInfo();
    res.json({ servers });
  } catch (error) {
    logger.error('Failed to get server information:', error);
    res.status(500).json({
      error: 'Failed to get server information',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/servers/:serverType/tools', authenticateToken, async (req, res) => {
  try {
    const { serverType } = req.params;
    const tools = await mcpManager.listTools(serverType);
    res.json({ tools });
  } catch (error) {
    logger.error(`Failed to list tools for ${req.params.serverType}:`, error);
    res.status(500).json({
      error: 'Failed to list tools',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/servers/:serverType/tools/:toolName', authenticateToken, async (req, res) => {
  try {
    const { serverType, toolName } = req.params;
    const args = req.body;

    // Validate input
    const { error } = toolCallSchema.validate({ ...args, toolName });
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details
      });
    }

    // Check cache first
    if (redisClient) {
      const cacheKey = `tool:${serverType}:${toolName}:${JSON.stringify(args)}`;
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return res.json({ ...JSON.parse(cached), cached: true });
      }
    }

    const result = await mcpManager.callTool(serverType, toolName, args);
    res.json(result);

  } catch (error) {
    logger.error(`Tool call error for ${req.params.toolName}:`, error);
    res.status(500).json({
      error: 'Tool call failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Convenience endpoints
app.post('/api/search', authenticateToken, async (req, res) => {
  try {
    const { query, withAI = false, engine = 'duckduckgo', maxResults = 5, model = 'llama2' } = req.body;
    
    const serverType = withAI ? 'ollama' : 'enhanced';
    const toolName = withAI ? 'search_and_answer' : 'search_web';
    
    const result = await mcpManager.callTool(serverType, toolName, {
      query,
      engine,
      max_results: maxResults,
      ...(model && { model })
    });

    res.json(result);
  } catch (error) {
    logger.error('Search error:', error);
    res.status(500).json({
      error: 'Search failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/chat', authenticateToken, async (req, res) => {
  try {
    const { messages, model = 'llama2', autoSearch = true } = req.body;
    
    const result = await mcpManager.callTool('ollama', 'chat_with_search', {
      messages,
      model,
      auto_search: autoSearch
    });

    res.json(result);
  } catch (error) {
    logger.error('Chat error:', error);
    res.status(500).json({
      error: 'Chat failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/extract', authenticateToken, async (req, res) => {
  try {
    const { url, extractLinks = false, extractImages = false, extractMetadata = true } = req.body;
    
    const result = await mcpManager.callTool('enhanced', 'extract_content', {
      url,
      extract_links: extractLinks,
      extract_images: extractImages,
      extract_metadata: extractMetadata
    });

    res.json(result);
  } catch (error) {
    logger.error('Content extraction error:', error);
    res.status(500).json({
      error: 'Content extraction failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// WebSocket handling
io.use((socket, next) => {
  if (NODE_ENV === 'development') {
    return next(); // Skip auth in development
  }

  const token = socket.handshake.auth.token;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.userId = (decoded as any).username;
    next();
  } catch {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  socket.on('call_tool', async (data) => {
    try {
      const { serverType, toolName, args, requestId } = data;
      const result = await mcpManager.callTool(serverType, toolName, args);
      
      socket.emit('tool_result', {
        requestId,
        success: true,
        result
      });
    } catch (error) {
      socket.emit('tool_result', {
        requestId: data.requestId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  socket.on('list_tools', async (data) => {
    try {
      const { serverType, requestId } = data;
      const tools = await mcpManager.listTools(serverType);
      
      socket.emit('tools_list', {
        requestId,
        success: true,
        tools
      });
    } catch (error) {
      socket.emit('tools_list', {
        requestId: data.requestId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Error handling middleware
app.use((error: Error, req: any, res: any, next: any) => {
  logger.error('Express error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  await mcpManager.cleanup();
  if (redisClient) await redisClient.quit();
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  await mcpManager.cleanup();
  if (redisClient) await redisClient.quit();
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

// Start server
server.listen(PORT, () => {
  logger.info(`MCP HTTP Bridge Server running on port ${PORT}`);
  logger.info(`API documentation: http://localhost:${PORT}/api-docs`);
  logger.info(`Health check: http://localhost:${PORT}/api/health`);
});

export default app;