#!/usr/bin/env node

/**
 * Main entry point - exports browser server
 */

export { BrowserServer } from './servers/BrowserServer.js';
export { FallbackServer } from './servers/FallbackServer.js'; 
export { EnhancedServer } from './servers/EnhancedServer.js';
export { OllamaServer } from './servers/OllamaServer.js';
export { OllamaService } from './services/OllamaService.js';
export * from './types/index.js';

// Start browser server if called directly
import { BrowserServer } from './servers/BrowserServer.js';

if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new BrowserServer();
  server.run().catch(console.error);
}