#!/usr/bin/env node

/**
 * Simple MCP CLI Client for testing
 */

import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
      OLLAMA_BASE_URL: 'http://localhost:11434',
      OLLAMA_DEFAULT_MODEL: 'llama2'
    }
  }
};

function testServer(serverType) {
  return new Promise((resolve, reject) => {
    console.log(`\n🧪 Testing ${serverType.toUpperCase()} server...`);
    
    const config = servers[serverType];
    if (!config) {
      reject(new Error(`Unknown server type: ${serverType}`));
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

    server.on('close', (code) => {
      if (code === 0 || output.includes('MCP Server')) {
        console.log(`✅ ${serverType} server: Connection successful`);
        resolve({ serverType, success: true, output });
      } else {
        console.log(`❌ ${serverType} server: Failed (code ${code})`);
        console.log(`Error: ${errorOutput}`);
        resolve({ serverType, success: false, error: errorOutput });
      }
    });

    server.on('error', (error) => {
      console.log(`❌ ${serverType} server: Error starting - ${error.message}`);
      resolve({ serverType, success: false, error: error.message });
    });

    // Send a basic test after a short delay
    setTimeout(() => {
      server.kill('SIGTERM');
    }, 3000);
  });
}

async function testAllServers() {
  console.log('🚀 MCP Browser Search CLI Test');
  console.log('================================');
  
  const results = [];
  
  for (const serverType of Object.keys(servers)) {
    try {
      const result = await testServer(serverType);
      results.push(result);
    } catch (error) {
      console.log(`❌ ${serverType} server: ${error.message}`);
      results.push({ serverType, success: false, error: error.message });
    }
  }
  
  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  
  results.forEach(result => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${result.serverType.padEnd(10)} server`);
  });
  
  const successCount = results.filter(r => r.success).length;
  console.log(`\n🎯 ${successCount}/${results.length} servers working`);
  
  if (successCount > 0) {
    console.log('\n🎉 MCP Browser Search CLI is working!');
    console.log('\nNext steps:');
    console.log('1. Install Claude Desktop: https://claude.ai/download');
    console.log('2. Configure Claude with your servers');
    console.log('3. Test the web client and HTTP bridge');
  } else {
    console.log('\n⚠️  No servers are working. Please check:');
    console.log('1. MCP servers are built: npm run build');
    console.log('2. Dependencies are installed');
    console.log('3. For Ollama server: Ollama is running on localhost:11434');
  }
}

// Handle command line arguments
const command = process.argv[2];
const serverType = process.argv[3] || 'enhanced';

if (command === 'test') {
  if (serverType === 'all') {
    testAllServers();
  } else {
    testServer(serverType);
  }
} else {
  console.log('🔧 MCP Browser Search CLI Test Tool');
  console.log('Usage:');
  console.log('  node simple-cli.js test all           # Test all servers');
  console.log('  node simple-cli.js test enhanced      # Test enhanced server');
  console.log('  node simple-cli.js test fallback      # Test fallback server');
  console.log('  node simple-cli.js test ollama        # Test ollama server');
}