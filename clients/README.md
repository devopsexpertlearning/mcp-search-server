# 🖥️ MCP Browser Search Clients

This directory contains multiple client implementations for interacting with the MCP Browser Search servers with Ollama integration.

## 🌟 Available Clients

### **1. 🌐 Web Client** (`web-client/`)
- **Description**: Full-featured web application with React frontend
- **Features**: 
  - Real-time search with AI answers
  - Interactive chat interface
  - Tool explorer
  - Server status monitoring
  - WebSocket and HTTP API support

### **2. 💻 CLI Client** (`cli-client/`)
- **Description**: Command-line interface for terminal users
- **Features**:
  - Interactive and non-interactive modes
  - Search, chat, and content extraction
  - Tool listing and server status
  - Colorized output and progress indicators

### **3. 🖥️ Desktop Client** (`desktop-client/`)
- **Description**: Cross-platform Electron application
- **Features**:
  - Native desktop experience
  - Auto-updater support
  - System tray integration
  - Global shortcuts

### **4. 📱 Mobile Client** (`mobile-client/`)
- **Description**: React Native mobile application
- **Features**:
  - iOS and Android support
  - Touch-optimized interface
  - Offline caching
  - Push notifications

### **5. 🌉 HTTP Bridge** (`http-bridge/`)
- **Description**: HTTP/WebSocket bridge for remote access
- **Features**:
  - RESTful API
  - WebSocket support
  - Authentication and rate limiting
  - Swagger documentation
  - Redis caching

### **6. 🤖 Claude Desktop Config** (`claude-config/`)
- **Description**: Configuration for Claude Desktop integration
- **Features**:
  - Pre-configured server connections
  - Global shortcuts
  - Optimized settings

## 🚀 Quick Setup

### **Option 1: Setup All Clients**
```bash
cd clients
chmod +x setup-clients.sh
./setup-clients.sh all
```

### **Option 2: Setup Individual Clients**
```bash
# Web client only
./setup-clients.sh web

# CLI client only
./setup-clients.sh cli

# Desktop client only
./setup-clients.sh desktop

# Mobile client only
./setup-clients.sh mobile

# HTTP bridge only
./setup-clients.sh bridge
```

## 🧪 Testing Clients

After setup, test your clients:

```bash
# Test all clients
./test-all-clients.sh

# Test individual clients
./test-web-client.sh
./test-cli-client.sh
./test-http-bridge.sh
```

## 📋 Prerequisites

### **General Requirements**
- Node.js 18+ and npm
- MCP Browser Search servers built (`npm run build` in root)

### **Client-Specific Requirements**

#### **Web Client**
- Modern web browser
- React 18+

#### **CLI Client**
- Terminal with color support
- Node.js 18+

#### **Desktop Client**
- Electron-supported OS (Windows, macOS, Linux)
- Electron 27+

#### **Mobile Client**
- React Native CLI
- Android Studio (Android)
- Xcode (iOS, macOS only)
- iOS Simulator or Android Emulator

#### **HTTP Bridge**
- Redis (optional, for caching)
- SSL certificates (production)

## 🔧 Configuration

### **Environment Variables**

All clients support these environment variables:

```bash
# MCP Server Configuration
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_DEFAULT_MODEL=llama2
REDIS_URL=redis://localhost:6379

# HTTP Bridge Configuration
PORT=8080
JWT_SECRET=your-secret-key
NODE_ENV=production
LOG_LEVEL=info

# CORS Configuration
CORS_ORIGIN=http://localhost:3000
```

### **Client-Specific Configuration**

#### **Web Client** (`web-client/.env`)
```bash
REACT_APP_API_URL=http://localhost:8080
REACT_APP_WS_URL=ws://localhost:8080
```

#### **CLI Client** (`cli-client/mcp-config.json`)
```json
{
  "defaultServer": "enhanced",
  "servers": {
    "ollama": {
      "command": "node",
      "args": ["../../dist/servers/OllamaServer.js"]
    }
  }
}
```

#### **Desktop Client** (uses Electron Store)
- Preferences stored in OS-specific app data directory
- Configuration UI available in app

#### **Mobile Client** (`mobile-client/config.json`)
```json
{
  "apiUrl": "https://your-api-domain.com",
  "wsUrl": "wss://your-api-domain.com"
}
```

## 🔗 Client Usage Examples

### **Web Client**
```bash
cd web-client
npm start
# Open http://localhost:3001
```

### **CLI Client**
```bash
# Interactive mode
mcp-search interactive

# Direct search
mcp-search search "latest AI news" --ai

# Chat mode
mcp-search chat

# Extract content
mcp-search extract https://example.com
```

### **Desktop Client**
```bash
cd desktop-client
npm start
# Or use the built executable
```

### **HTTP Bridge API**
```bash
# Start the bridge
cd http-bridge
npm start

# Use the API
curl -X POST http://localhost:8080/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "test search", "withAI": true}'
```

## 🔌 Integration with Claude Desktop

### **Setup**
1. Install Claude Desktop from https://claude.ai/download
2. Run the setup script (automatically configures Claude)
3. Restart Claude Desktop
4. Your MCP servers will be available in Claude

### **Configuration Location**
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/claude/claude_desktop_config.json`

### **Usage in Claude**
```
Can you search for "latest AI developments" and give me an AI-powered summary?

What's the content of https://example.com?

Can you have a conversation with me using search results about climate change?
```

## 🏗️ Client Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Claude App    │    │   Web Client    │    │   CLI Client    │
│                 │    │                 │    │                 │
│  ┌──────────┐   │    │  ┌──────────┐   │    │  ┌──────────┐   │
│  │   MCP    │   │    │  │  React   │   │    │  │Commander │   │
│  │ Protocol │   │    │  │   App    │   │    │  │   CLI    │   │
│  └──────────┘   │    │  └──────────┘   │    │  └──────────┘   │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          │ stdio                │ WebSocket/HTTP       │ stdio
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MCP Server Layer                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Ollama    │  │  Enhanced   │  │       Fallback          │  │
│  │   Server    │  │   Server    │  │       Server            │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                   External Services                             │
│     ┌─────────┐     ┌─────────┐     ┌─────────────────────┐     │
│     │ Ollama  │     │  Redis  │     │   Search Engines    │     │
│     │   AI    │     │ Cache   │     │  (DDG, Google, etc) │     │
│     └─────────┘     └─────────┘     └─────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

## 🔒 Security Considerations

### **Authentication**
- HTTP Bridge supports JWT authentication
- CLI and Desktop clients use direct stdio (secure)
- Web client supports token-based auth
- Mobile client uses secure storage for tokens

### **Network Security**
- HTTPS/WSS in production
- Rate limiting on HTTP bridge
- CORS configuration
- Input validation and sanitization

### **Data Privacy**
- No sensitive data logged
- Cache encryption available
- Session management
- Token expiration

## 🚨 Troubleshooting

### **Common Issues**

#### **Connection Errors**
```bash
# Check if MCP servers are running
cd .. && npm run start:ollama

# Check if Ollama is running
ollama serve
ollama list
```

#### **Build Failures**
```bash
# Clean and rebuild
rm -rf node_modules dist
npm install
npm run build
```

#### **Permission Errors**
```bash
# Fix CLI permissions
chmod +x dist/cli.js

# Fix script permissions
chmod +x *.sh
```

#### **Port Conflicts**
```bash
# Check what's using the port
lsof -i :3000
lsof -i :8080

# Kill process using port
kill -9 <PID>
```

### **Debug Mode**

Enable debug logging:
```bash
export LOG_LEVEL=debug
export NODE_ENV=development
```

### **Health Checks**

```bash
# Check MCP servers
curl http://localhost:8080/api/health

# Check Ollama
curl http://localhost:11434/api/tags

# Check Redis
redis-cli ping
```

## 📚 API Documentation

### **HTTP Bridge API**
- Swagger UI: `http://localhost:8080/api-docs`
- Health check: `http://localhost:8080/api/health`

### **WebSocket Events**
- `call_tool`: Call an MCP tool
- `list_tools`: List available tools
- `get_server_status`: Get server status

## 🤝 Contributing

1. Choose a client to work on
2. Follow the existing code patterns
3. Add tests for new features
4. Update documentation
5. Submit a pull request

## 📄 License

MIT License - see main project LICENSE file.

---

**🎉 Happy Searching!** Your MCP Browser Search clients are ready to provide AI-powered web search capabilities across all platforms.