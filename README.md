# 🌐 MCP Browser Search Server

A comprehensive Model Context Protocol (MCP) server providing advanced web search and content extraction capabilities. Built for AI applications, Claude Desktop, and any MCP-compatible client.

[![npm version](https://badge.fury.io/js/mcp-browser-search.svg)](https://badge.fury.io/js/mcp-browser-search)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)

## ✨ Key Features

### 🎯 **Three Server Versions**
1. **🚀 Enhanced Server** - Advanced features with caching, bulk operations, and domain analysis  
2. **🔧 Full Browser Server** - Complete Playwright automation for JavaScript-heavy sites
3. **⚡ Fallback Server** - Lightweight curl-based version for maximum compatibility

### 🔍 **Search Capabilities**
- **Multiple Search Engines**: Google, Bing, DuckDuckGo, Searx, StartPage
- **News Search**: Recent articles with source attribution
- **Bulk Search**: Parallel searches across multiple queries
- **Smart Caching**: Configurable result caching for performance

### 📄 **Content Extraction**
- **Intelligent Parsing**: Article content, metadata, links, and images
- **Multiple Formats**: Full HTML, clean text, or article-only extraction
- **Domain Analysis**: Endpoint discovery and basic site information
- **Link Discovery**: Extract and analyze page relationships

---

## 🚀 Quick Start

### Installation

```bash
# Clone and set up locally
git clone https://github.com/devopsexpertlearning/mcp-search-server/tree/main
cd mcp-browser-search

# Install dependencies
npm install

# Build the project
npm run build

# Start the server
npm start
```

### Basic Usage

```bash
# Start Enhanced Server (recommended)
npm run start:enhanced

# Start Fallback Server (maximum compatibility)
npm run start:fallback

# Start Full Browser Server (default)
npm start

# Start Ollama-powered Server
npm run start:ollama
```

---

## 🛠️ Development

### Prerequisites
- Node.js >= 18
- npm or yarn
- Git

### Build from Source

```bash
# Clone the repository
git clone https://github.com/your-repo/mcp-browser-search.git
cd mcp-browser-search

# Install dependencies
npm install

# Build TypeScript code
npm run build

# Test the build
npm start
```

### Development Mode

```bash
# Watch mode for development
npm run dev

# Build specific server
npm run build:enhanced
npm run build:fallback
npm run build:ollama
```

---

## 🐳 Deployment

### Docker Deployment

#### Basic Docker Setup

```bash
# Build Docker image
docker build -t mcp-browser-search .

# Run with Enhanced Server
docker run -p 3000:3000 mcp-browser-search

# Run with environment variables
docker run -e MCP_SERVER_TYPE=enhanced -e CACHE_ENABLED=true mcp-browser-search
```

#### Docker Compose

```yaml
version: '3.8'
services:
  mcp-browser-search:
    build: .
    environment:
      - MCP_SERVER_TYPE=enhanced
      - CACHE_ENABLED=true
      - REDIS_URL=redis://redis:6379
    ports:
      - "3000:3000"
    depends_on:
      - redis
  
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
```

#### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-browser-search
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mcp-browser-search
  template:
    metadata:
      labels:
        app: mcp-browser-search
    spec:
      containers:
      - name: mcp-browser-search
        image: mcp-browser-search:latest
        ports:
        - containerPort: 3000
        env:
        - name: MCP_SERVER_TYPE
          value: "enhanced"
```

---

## 🔧 Integration

### Claude Desktop

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "browser-search": {
      "command": "node",
      "args": ["/path/to/mcp-browser-search/dist/index.js"],
      "env": {
        "MCP_SERVER_TYPE": "enhanced"
      }
    }
  }
}
```

### Generic MCP Clients

The server implements the standard MCP protocol and can be used with any MCP-compatible client.

---

## 🛠️ Available Tools

### 🔍 `search_web`
Search the web using various search engines.

**Parameters:**
- `query` (string): Search query
- `engine` (string, optional): Search engine (google, bing, duckduckgo)
- `max_results` (number, optional): Maximum results to return

### 📄 `visit_page`
Extract content from a specific webpage.

**Parameters:**
- `url` (string): URL to visit
- `extraction_type` (string, optional): Type of extraction (article, full, clean)

### 📰 `search_news`
Search for recent news articles.

**Parameters:**
- `query` (string): News search query
- `max_results` (number, optional): Maximum results to return

### 🔍 `bulk_search`
Perform multiple searches in parallel.

**Parameters:**
- `queries` (array): Array of search queries
- `engine` (string, optional): Search engine to use

### 🌐 `analyze_domain`
Analyze a domain for endpoints and basic information.

**Parameters:**
- `domain` (string): Domain to analyze

### 🔗 `extract_links`
Extract links from a webpage.

**Parameters:**
- `url` (string): URL to extract links from

---

## ⚙️ Configuration

### Environment Variables

```bash
# Server type
MCP_SERVER_TYPE=enhanced|browser|fallback|ollama

# Cache settings
CACHE_ENABLED=true
CACHE_TTL=3600
REDIS_URL=redis://localhost:6379

# Search settings
DEFAULT_SEARCH_ENGINE=google
MAX_SEARCH_RESULTS=10

# Browser settings (for browser server)
HEADLESS=true
TIMEOUT=30000

# Ollama settings
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama2
```

### Configuration File

Create `config.json`:

```json
{
  "server": {
    "type": "enhanced",
    "port": 3000
  },
  "cache": {
    "enabled": true,
    "ttl": 3600,
    "redisUrl": "redis://localhost:6379"
  },
  "search": {
    "defaultEngine": "google",
    "maxResults": 10,
    "engines": {
      "google": {
        "enabled": true
      },
      "bing": {
        "enabled": true
      }
    }
  }
}
```

---

## 🧪 Testing

### Run Tests

```bash
# Run all tests
npm test

# Run specific test suite
npm run test:unit
npm run test:integration

# Watch mode
npm run test:watch
```

### Manual Testing

```bash
# Start server in debug mode
DEBUG=* npm start

# Test with curl
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"method": "search_web", "params": {"query": "test"}}'
```

---

## 🔒 Security Considerations

### Best Practices
- Use environment variables for sensitive configuration
- Enable rate limiting in production
- Use HTTPS in production deployments
- Regularly update dependencies
- Monitor for suspicious activity

### Security Configuration

```bash
# Enable security features
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=900000

# CORS settings
CORS_ENABLED=true
CORS_ORIGIN=https://your-domain.com
```

---

## 🐛 Troubleshooting

### Common Issues

**Installation Issues:**
```bash
# Clear npm cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

**Browser Server Issues:**
```bash
# Install Playwright browsers
npx playwright install

# Check browser dependencies
npx playwright install-deps
```

**Memory Issues:**
```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm start
```

### Debug Mode

```bash
# Enable debug logging
DEBUG=mcp:* npm start

# Verbose logging
LOG_LEVEL=debug npm start
```

---

## 🤝 Contributing

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

### Code Standards

- Follow TypeScript best practices
- Use ESLint and Prettier
- Write comprehensive tests
- Document new features

---

## 📄 License

MIT License - see LICENSE file for details.

---

## 🙏 Acknowledgments

- Model Context Protocol (MCP) team
- Playwright for browser automation
- The open-source community

---

**Made with ❤️ for the MCP community**
