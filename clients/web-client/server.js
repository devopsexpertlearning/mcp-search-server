#!/usr/bin/env node

/**
 * MCP Web Client Server - HTTP/WebSocket bridge to MCP servers
 */

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"]
    }
  }
}));

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'dist')));

// MCP Client Manager
class MCPClientManager {
  constructor() {
    this.clients = new Map();
    this.serverConfigs = {
      ollama: {
        command: 'node',
        args: ['../../dist/servers/OllamaServer.js'],
        env: {
          NODE_ENV: 'production',
          OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
          OLLAMA_DEFAULT_MODEL: process.env.OLLAMA_DEFAULT_MODEL || 'llama2',
          LOG_LEVEL: 'info'
        }
      },
      enhanced: {
        command: 'node',
        args: ['../../dist/servers/EnhancedServer.js'],
        env: {
          NODE_ENV: 'production',
          REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
          LOG_LEVEL: 'info'
        }
      },
      fallback: {
        command: 'node',
        args: ['../../dist/servers/FallbackServer.js'],
        env: {
          NODE_ENV: 'production',
          LOG_LEVEL: 'info'
        }
      }
    };
  }

  async getClient(serverType = 'enhanced') {
    if (this.clients.has(serverType)) {
      return this.clients.get(serverType);
    }

    const config = this.serverConfigs[serverType];
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
          name: `web-client-${serverType}`,
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
      
      console.log(`Connected to ${serverType} MCP server`);
      return client;

    } catch (error) {
      console.error(`Failed to connect to ${serverType} server:`, error);
      throw error;
    }
  }

  async callTool(serverType, toolName, args) {
    const client = await this.getClient(serverType);
    
    try {
      const result = await client.request({
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        }
      });

      return result;
    } catch (error) {
      console.error(`Tool call failed for ${toolName}:`, error);
      throw error;
    }
  }

  async listTools(serverType) {
    const client = await this.getClient(serverType);
    
    try {
      const result = await client.request({
        method: 'tools/list'
      });

      return result.tools || [];
    } catch (error) {
      console.error(`Failed to list tools for ${serverType}:`, error);
      throw error;
    }
  }

  async getServerInfo(serverType) {
    const client = await this.getClient(serverType);
    
    try {
      const result = await client.request({
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
            resources: {}
          },
          clientInfo: {
            name: 'web-client',
            version: '1.0.0'
          }
        }
      });

      return result;
    } catch (error) {
      console.error(`Failed to get server info for ${serverType}:`, error);
      return null;
    }
  }

  async cleanup() {
    for (const [serverType, client] of this.clients) {
      try {
        await client.close();
        console.log(`Disconnected from ${serverType} server`);
      } catch (error) {
        console.error(`Error disconnecting from ${serverType}:`, error);
      }
    }
    this.clients.clear();
  }
}

const mcpManager = new MCPClientManager();

// API Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.get('/api/servers', async (req, res) => {
  try {
    const servers = [];
    
    for (const [serverType, config] of Object.entries(mcpManager.serverConfigs)) {
      try {
        const info = await mcpManager.getServerInfo(serverType);
        const tools = await mcpManager.listTools(serverType);
        
        servers.push({
          type: serverType,
          status: 'connected',
          info,
          tools: tools.map(tool => ({
            name: tool.name,
            description: tool.description
          }))
        });
      } catch (error) {
        servers.push({
          type: serverType,
          status: 'error',
          error: error.message
        });
      }
    }

    res.json({ servers });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get server information',
      message: error.message
    });
  }
});

app.get('/api/servers/:serverType/tools', async (req, res) => {
  try {
    const { serverType } = req.params;
    const tools = await mcpManager.listTools(serverType);
    res.json({ tools });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to list tools',
      message: error.message
    });
  }
});

app.post('/api/servers/:serverType/tools/:toolName', async (req, res) => {
  try {
    const { serverType, toolName } = req.params;
    const args = req.body;

    console.log(`Calling ${toolName} on ${serverType} with args:`, args);
    
    const result = await mcpManager.callTool(serverType, toolName, args);
    res.json(result);
  } catch (error) {
    console.error(`Tool call error:`, error);
    res.status(500).json({
      error: 'Tool call failed',
      message: error.message
    });
  }
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on('call_tool', async (data) => {
    try {
      const { serverType, toolName, args, requestId } = data;
      console.log(`WebSocket tool call: ${toolName} on ${serverType}`);
      
      const result = await mcpManager.callTool(serverType, toolName, args);
      
      socket.emit('tool_result', {
        requestId,
        success: true,
        result
      });
    } catch (error) {
      console.error('WebSocket tool call error:', error);
      socket.emit('tool_result', {
        requestId: data.requestId,
        success: false,
        error: error.message
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
        error: error.message
      });
    }
  });

  socket.on('get_server_status', async (data) => {
    try {
      const { requestId } = data;
      const servers = [];
      
      for (const serverType of Object.keys(mcpManager.serverConfigs)) {
        try {
          await mcpManager.getClient(serverType);
          servers.push({ type: serverType, status: 'connected' });
        } catch (error) {
          servers.push({ type: serverType, status: 'error', error: error.message });
        }
      }
      
      socket.emit('server_status', {
        requestId,
        success: true,
        servers
      });
    } catch (error) {
      socket.emit('server_status', {
        requestId: data.requestId,
        success: false,
        error: error.message
      });
    }
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Express error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await mcpManager.cleanup();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await mcpManager.cleanup();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`MCP Web Client Server running on port ${PORT}`);
  console.log(`Web interface: http://localhost:${PORT}`);
  console.log(`API endpoint: http://localhost:${PORT}/api`);
});

export default app;