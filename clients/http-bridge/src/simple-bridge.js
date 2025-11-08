#!/usr/bin/env node

/**
 * Simple HTTP Bridge for MCP Browser Search
 * Works around TypeScript issues with a pure JS implementation
 */

import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8081; // Use different port to avoid conflict

// Middleware
app.use(cors());
app.use(express.json());

// MCP Server configurations
const servers = {
  enhanced: {
    command: 'node',
    args: [join(__dirname, '../../../dist/servers/EnhancedServer.js')],
    env: { NODE_ENV: 'production', LOG_LEVEL: 'warn' }
  },
  fallback: {
    command: 'node',
    args: [join(__dirname, '../../../dist/servers/FallbackServer.js')],
    env: { NODE_ENV: 'production', LOG_LEVEL: 'warn' }
  },
  ollama: {
    command: 'node',
    args: [join(__dirname, '../../../dist/servers/OllamaServer.js')],
    env: {
      NODE_ENV: 'production',
      LOG_LEVEL: 'warn',
      OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      OLLAMA_DEFAULT_MODEL: process.env.OLLAMA_DEFAULT_MODEL || 'llama2'
    }
  }
};

// Test MCP server connectivity
async function testMCPServer(serverType) {
  return new Promise((resolve) => {
    const config = servers[serverType];
    if (!config) {
      resolve({ serverType, status: 'error', error: 'Unknown server type' });
      return;
    }

    const server = spawn(config.command, config.args, {
      env: { ...process.env, ...config.env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let errorOutput = '';

    server.stdout.on('data', (data) => {
      output += data.toString();
    });

    server.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    const cleanup = () => {
      server.kill('SIGTERM');
    };

    server.on('close', (code) => {
      const success = code === 0 || output.includes('MCP Server') || output.length > 0;
      resolve({
        serverType,
        status: success ? 'connected' : 'error',
        error: success ? null : errorOutput || 'Failed to start'
      });
    });

    server.on('error', (error) => {
      resolve({
        serverType,
        status: 'error',
        error: error.message
      });
    });

    // Test for 3 seconds then cleanup
    setTimeout(cleanup, 3000);
  });
}

// Simulate search functionality (bypassing MCP connection issues)
async function simulateSearch(query, withAI = false) {
  // This is a simulation - in a real implementation, you'd call the MCP servers
  const results = [
    {
      title: `Search result for: ${query}`,
      url: 'https://example.com/result1',
      description: 'This is a simulated search result showing that the API structure works correctly.'
    },
    {
      title: `Additional result for: ${query}`,
      url: 'https://example.com/result2', 
      description: 'Another simulated result demonstrating the API response format.'
    }
  ];

  const response = {
    query,
    results,
    resultCount: results.length,
    source: 'simulation'
  };

  if (withAI) {
    response.answer = `Based on the search results for "${query}", here's a summary: The search found ${results.length} relevant results. This is a simulated AI response demonstrating how the system would work with actual Ollama integration.`;
    response.model = 'llama2';
  }

  return response;
}

// Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0-simple',
    note: 'Simple bridge implementation'
  });
});

app.get('/api/servers', async (req, res) => {
  try {
    const serverTypes = Object.keys(servers);
    const serverTests = await Promise.all(
      serverTypes.map(type => testMCPServer(type))
    );
    
    res.json({ servers: serverTests });
  } catch (error) {
    res.status(500).json({ error: 'Failed to test servers', message: error.message });
  }
});

app.post('/api/search', async (req, res) => {
  try {
    const { query, withAI = false, maxResults = 5 } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const result = await simulateSearch(query, withAI);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Search failed', message: error.message });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, model = 'llama2' } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const lastMessage = messages[messages.length - 1];
    const response = {
      response: `This is a simulated chat response to: "${lastMessage.content}". In a full implementation, this would use Ollama to generate contextual responses with search integration.`,
      model,
      searchPerformed: false,
      source: 'simulation'
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({ error: 'Chat failed', message: error.message });
  }
});

app.post('/api/extract', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const result = {
      url,
      title: 'Simulated Page Title',
      content: 'This is simulated extracted content from the webpage. In a real implementation, this would extract actual content using the MCP servers.',
      metadata: {
        description: 'Simulated page description',
        keywords: ['simulation', 'api', 'mcp']
      },
      source: 'simulation'
    };

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Content extraction failed', message: error.message });
  }
});

// API documentation endpoint
app.get('/api/docs', (req, res) => {
  res.json({
    title: 'MCP Browser Search API (Simple Bridge)',
    version: '1.0.0',
    description: 'Simplified HTTP bridge for testing MCP Browser Search functionality',
    endpoints: {
      'GET /api/health': 'Health check',
      'GET /api/servers': 'Test MCP server connectivity',
      'POST /api/search': 'Search with optional AI (simulated)',
      'POST /api/chat': 'Chat interface (simulated)',
      'POST /api/extract': 'Extract webpage content (simulated)'
    },
    note: 'This is a simplified implementation for testing. The actual MCP integration would provide real search and AI capabilities.'
  });
});

// Error handling
app.use((error, req, res, next) => {
  console.error('Express error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🌉 Simple MCP HTTP Bridge running on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📖 API docs: http://localhost:${PORT}/api/docs`);
  console.log(`🧪 Test servers: http://localhost:${PORT}/api/servers`);
});

export default app;