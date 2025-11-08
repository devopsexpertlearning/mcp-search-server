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
# Install globally
npm install -g mcp-browser-search

# Or install locally
npm install mcp-browser-search
```

### Basic Usage

```bash
# Start Enhanced Server (recommended)
mcp-browser-search-enhanced

# Start Fallback Server (maximum compatibility)
mcp-browser-search-fallback

# Start Full Browser Server
mcp-browser-search
```

---

## 🛠️ How to Build

### Prerequisites
- Node.js >= 18
- npm or yarn
- Git

### Build from Source

```bash
# Clone the repository
git clone https://github.com/yourusername/mcp-browser-search.git
cd mcp-browser-search

# Install dependencies
npm install

# Build TypeScript code
npm run build

# Test the build
npm test
```

### Development Mode

```bash
# Watch mode for development
npm run dev

# Build specific server
npm run start:enhanced     # Enhanced features
npm run start:fallback     # Maximum compatibility
npm run start             # Full browser automation
```

---

## 🐳 How to Deploy

### Docker Deployment (Recommended)

#### Basic Docker Setup

```bash
# Build Docker image
docker build -t mcp-browser-search:latest .

# Run container with MCP server
docker run -d \
  --name mcp-search \
  --restart unless-stopped \
  -p 3000:3000 \
  -v $(pwd)/config:/app/config:ro \
  -v $(pwd)/logs:/app/logs \
  -e NODE_ENV=production \
  -e MCP_CACHE_TTL=600 \
  -e MCP_USE_CACHE=true \
  mcp-browser-search:latest

# Test MCP server
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | docker run -i mcp-browser-search:latest

# View logs
docker logs mcp-search -f
```

#### Docker with Different Server Variants

```bash
# Enhanced Server (recommended for production)
docker run -d \
  --name mcp-search-enhanced \
  --restart unless-stopped \
  -p 3001:3000 \
  -e SERVER_TYPE=enhanced \
  -e MCP_CACHE_TTL=300 \
  -e MCP_MAX_RESULTS=20 \
  mcp-browser-search:latest

# Fallback Server (maximum compatibility)
docker run -d \
  --name mcp-search-fallback \
  --restart unless-stopped \
  -p 3002:3000 \
  -e SERVER_TYPE=fallback \
  -e MCP_TIMEOUT=30000 \
  mcp-browser-search:latest

# Full Browser Server (with Playwright)
docker run -d \
  --name mcp-search-browser \
  --restart unless-stopped \
  -p 3003:3000 \
  -e SERVER_TYPE=browser \
  -e MCP_HEADLESS=true \
  --shm-size=2gb \
  mcp-browser-search:latest
```

#### Complete Docker Compose Deployment

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  # Enhanced MCP Server (Primary)
  mcp-enhanced:
    build: .
    container_name: mcp-search-enhanced
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - SERVER_TYPE=enhanced
      - MCP_CACHE_TTL=600
      - MCP_USE_CACHE=true
      - MCP_DEFAULT_ENGINE=google
      - MCP_MAX_RESULTS=20
      - MCP_LOG_LEVEL=info
    volumes:
      - ./config:/app/config:ro
      - ./logs:/app/logs
      - enhanced_cache:/app/cache
    ports:
      - "3001:3000"
    healthcheck:
      test: ["CMD", "node", "-e", "console.log('Health check')"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    networks:
      - mcp-network

  # Fallback MCP Server (Backup)
  mcp-fallback:
    build: .
    container_name: mcp-search-fallback
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - SERVER_TYPE=fallback
      - MCP_TIMEOUT=45000
      - MCP_MAX_RESULTS=15
      - MCP_LOG_LEVEL=warn
    volumes:
      - ./config:/app/config:ro
      - ./logs:/app/logs
    ports:
      - "3002:3000"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health", "||", "exit", "1"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - mcp-network

  # Full Browser Server (Advanced)
  mcp-browser:
    build: .
    container_name: mcp-search-browser
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - SERVER_TYPE=browser
      - MCP_HEADLESS=true
      - MCP_TIMEOUT=60000
      - MCP_MAX_RESULTS=10
      - PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
    volumes:
      - ./config:/app/config:ro
      - ./logs:/app/logs
      - browser_cache:/app/cache
      - playwright_cache:/ms-playwright
    ports:
      - "3003:3000"
    shm_size: 2gb
    healthcheck:
      test: ["CMD", "node", "health-check.js"]
      interval: 45s
      timeout: 15s
      retries: 3
      start_period: 60s
    networks:
      - mcp-network

  # Redis Cache (Optional)
  redis:
    image: redis:7-alpine
    container_name: mcp-redis-cache
    restart: unless-stopped
    command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    networks:
      - mcp-network

  # Nginx Load Balancer
  nginx:
    image: nginx:alpine
    container_name: mcp-nginx
    restart: unless-stopped
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - mcp-enhanced
      - mcp-fallback
      - mcp-browser
    networks:
      - mcp-network

  # Monitoring (Optional)
  prometheus:
    image: prom/prometheus:latest
    container_name: mcp-prometheus
    restart: unless-stopped
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    networks:
      - mcp-network

volumes:
  enhanced_cache:
  browser_cache:
  playwright_cache:
  redis_data:
  prometheus_data:

networks:
  mcp-network:
    driver: bridge
```

#### Nginx Configuration

Create `nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    upstream mcp_servers {
        least_conn;
        server mcp-enhanced:3000 weight=3 max_fails=3 fail_timeout=30s;
        server mcp-fallback:3000 weight=2 max_fails=2 fail_timeout=30s backup;
        server mcp-browser:3000 weight=1 max_fails=5 fail_timeout=60s;
    }

    server {
        listen 80;
        server_name mcp-search.local;

        # Health check endpoint
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }

        # MCP API endpoint
        location /mcp {
            proxy_pass http://mcp_servers;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # MCP specific settings
            proxy_timeout 60s;
            proxy_read_timeout 60s;
            proxy_send_timeout 60s;
            
            # Handle JSON-RPC
            proxy_set_header Content-Type application/json;
        }

        # Metrics endpoint
        location /metrics {
            proxy_pass http://mcp_servers;
            allow 127.0.0.1;
            allow 10.0.0.0/8;
            deny all;
        }
    }
}
```

#### Kubernetes Deployment

Create `k8s-deployment.yaml`:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: mcp-browser-search

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: mcp-config
  namespace: mcp-browser-search
data:
  config.json: |
    {
      "cache": {
        "enabled": true,
        "ttl": 600,
        "maxSize": 5000,
        "redis": {
          "enabled": true,
          "host": "redis-service",
          "port": 6379
        }
      },
      "search": {
        "defaultEngine": "google",
        "maxResults": 20,
        "timeout": 45000
      },
      "browser": {
        "headless": true,
        "timeout": 60000
      },
      "security": {
        "rateLimiting": {
          "enabled": true,
          "maxRequests": 1000,
          "windowMs": 60000
        }
      }
    }

---
apiVersion: v1
kind: Secret
metadata:
  name: mcp-secrets
  namespace: mcp-browser-search
type: Opaque
data:
  # Add any API keys or secrets (base64 encoded)
  google-api-key: ""
  
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-enhanced
  namespace: mcp-browser-search
  labels:
    app: mcp-enhanced
    version: v2.0.0
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 2
  selector:
    matchLabels:
      app: mcp-enhanced
  template:
    metadata:
      labels:
        app: mcp-enhanced
        version: v2.0.0
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
      containers:
      - name: mcp-enhanced
        image: mcp-browser-search:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 3000
          name: http
        env:
        - name: NODE_ENV
          value: "production"
        - name: SERVER_TYPE
          value: "enhanced"
        - name: MCP_CACHE_TTL
          value: "600"
        - name: MCP_USE_CACHE
          value: "true"
        - name: MCP_LOG_LEVEL
          value: "info"
        volumeMounts:
        - name: config-volume
          mountPath: /app/config
          readOnly: true
        - name: cache-volume
          mountPath: /app/cache
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          exec:
            command:
            - node
            - -e
            - "console.log('alive')"
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          exec:
            command:
            - node
            - health-check.js
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 2
      volumes:
      - name: config-volume
        configMap:
          name: mcp-config
      - name: cache-volume
        emptyDir:
          sizeLimit: 1Gi

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-fallback
  namespace: mcp-browser-search
  labels:
    app: mcp-fallback
spec:
  replicas: 2
  selector:
    matchLabels:
      app: mcp-fallback
  template:
    metadata:
      labels:
        app: mcp-fallback
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
      containers:
      - name: mcp-fallback
        image: mcp-browser-search:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: SERVER_TYPE
          value: "fallback"
        - name: MCP_TIMEOUT
          value: "45000"
        volumeMounts:
        - name: config-volume
          mountPath: /app/config
          readOnly: true
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
      volumes:
      - name: config-volume
        configMap:
          name: mcp-config

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-browser
  namespace: mcp-browser-search
  labels:
    app: mcp-browser
spec:
  replicas: 1
  selector:
    matchLabels:
      app: mcp-browser
  template:
    metadata:
      labels:
        app: mcp-browser
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
      containers:
      - name: mcp-browser
        image: mcp-browser-search:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: SERVER_TYPE
          value: "browser"
        - name: MCP_HEADLESS
          value: "true"
        - name: PLAYWRIGHT_BROWSERS_PATH
          value: "/ms-playwright"
        volumeMounts:
        - name: config-volume
          mountPath: /app/config
          readOnly: true
        - name: browser-cache
          mountPath: /app/cache
        - name: playwright-cache
          mountPath: /ms-playwright
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        securityContext:
          allowPrivilegeEscalation: false
          capabilities:
            drop:
            - ALL
      volumes:
      - name: config-volume
        configMap:
          name: mcp-config
      - name: browser-cache
        emptyDir:
          sizeLimit: 2Gi
      - name: playwright-cache
        emptyDir:
          sizeLimit: 1Gi

---
apiVersion: v1
kind: Service
metadata:
  name: mcp-enhanced-service
  namespace: mcp-browser-search
spec:
  selector:
    app: mcp-enhanced
  ports:
  - name: http
    port: 3000
    targetPort: 3000
  type: ClusterIP

---
apiVersion: v1
kind: Service
metadata:
  name: mcp-fallback-service
  namespace: mcp-browser-search
spec:
  selector:
    app: mcp-fallback
  ports:
  - name: http
    port: 3000
    targetPort: 3000
  type: ClusterIP

---
apiVersion: v1
kind: Service
metadata:
  name: mcp-browser-service
  namespace: mcp-browser-search
spec:
  selector:
    app: mcp-browser
  ports:
  - name: http
    port: 3000
    targetPort: 3000
  type: ClusterIP

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: mcp-browser-search
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
        args:
        - redis-server
        - --appendonly
        - "yes"
        - --maxmemory
        - "512mb"
        - --maxmemory-policy
        - allkeys-lru
        volumeMounts:
        - name: redis-data
          mountPath: /data
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "200m"
      volumes:
      - name: redis-data
        emptyDir:
          sizeLimit: 1Gi

---
apiVersion: v1
kind: Service
metadata:
  name: redis-service
  namespace: mcp-browser-search
spec:
  selector:
    app: redis
  ports:
  - name: redis
    port: 6379
    targetPort: 6379
  type: ClusterIP

---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: mcp-ingress
  namespace: mcp-browser-search
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/upstream-hash-by: "$remote_addr"
    nginx.ingress.kubernetes.io/proxy-timeout: "60"
spec:
  ingressClassName: nginx
  rules:
  - host: mcp-search.example.com
    http:
      paths:
      - path: /enhanced
        pathType: Prefix
        backend:
          service:
            name: mcp-enhanced-service
            port:
              number: 3000
      - path: /fallback
        pathType: Prefix
        backend:
          service:
            name: mcp-fallback-service
            port:
              number: 3000
      - path: /browser
        pathType: Prefix
        backend:
          service:
            name: mcp-browser-service
            port:
              number: 3000
      - path: /
        pathType: Prefix
        backend:
          service:
            name: mcp-enhanced-service
            port:
              number: 3000

---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: mcp-enhanced-hpa
  namespace: mcp-browser-search
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: mcp-enhanced
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

#### Kubernetes Deployment Commands

```bash
# Deploy to Kubernetes
kubectl apply -f k8s-deployment.yaml

# Check deployment status
kubectl get pods -n mcp-browser-search
kubectl get services -n mcp-browser-search
kubectl get ingress -n mcp-browser-search

# Scale deployments
kubectl scale deployment mcp-enhanced --replicas=5 -n mcp-browser-search
kubectl scale deployment mcp-fallback --replicas=3 -n mcp-browser-search

# Update deployment
kubectl set image deployment/mcp-enhanced mcp-enhanced=mcp-browser-search:v2.1.0 -n mcp-browser-search

# View logs
kubectl logs -f deployment/mcp-enhanced -n mcp-browser-search
kubectl logs -f deployment/mcp-fallback -n mcp-browser-search

# Port forward for testing
kubectl port-forward service/mcp-enhanced-service 3000:3000 -n mcp-browser-search

# Delete deployment
kubectl delete namespace mcp-browser-search
```

### Production Deployment

```bash
# Install production dependencies only
npm ci --production

# Start with process manager
pm2 start dist/servers/EnhancedServer.js --name mcp-browser-search

# Or use systemd service
sudo systemctl enable mcp-browser-search
sudo systemctl start mcp-browser-search
```

### Environment Variables

```bash
# Cache configuration
MCP_CACHE_TTL=300          # Cache TTL in seconds
MCP_USE_CACHE=true         # Enable caching

# Search configuration
MCP_DEFAULT_ENGINE=google   # Default search engine
MCP_MAX_RESULTS=10         # Default max results
MCP_TIMEOUT=30000          # Request timeout in ms

# Browser configuration
MCP_HEADLESS=true          # Run browser in headless mode
MCP_USER_AGENT="..."       # Custom user agent
```

---

## 🔧 How to Integrate

### Claude Desktop

Add to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "browser-search": {
      "command": "mcp-browser-search-enhanced",
      "args": []
    }
  }
}
```

### n8n Integration

Use the custom node provided in `integrations/n8n-mcp-node.js`:

```javascript
// Copy integrations/n8n-mcp-node.js to your n8n custom nodes
// Configure the node with your MCP server endpoint
{
  "serverPath": "/path/to/mcp-browser-search",
  "serverArgs": ["--enhanced"]
}
```

### Zapier Integration

Deploy using the Zapier app configuration in `integrations/zapier-integration.js`:

```javascript
// Use the provided Zapier integration
// Configure webhook URL and authentication
const zapierApp = {
  // ... configuration from integrations/zapier-integration.js
};
```

### Make.com Integration

Import the scenario template from `integrations/make-scenario.json`:

1. Open Make.com
2. Create new scenario
3. Import from JSON
4. Use the provided template
5. Configure your MCP server endpoint

### Ollama Integration

The MCP Browser Search Server can be integrated with Ollama to provide web search capabilities to local LLMs.

#### Direct Integration with Ollama

```bash
# Start MCP Browser Search Server
mcp-browser-search-enhanced &

# Configure Ollama with MCP tools
cat > ollama-mcp-config.json << 'EOF'
{
  "tools": [
    {
      "name": "web_search",
      "description": "Search the web for information",
      "command": "mcp-browser-search-enhanced",
      "parameters": {
        "query": "string",
        "engine": "string",
        "max_results": "number"
      }
    }
  ]
}
EOF

# Use with Ollama
ollama serve --tools-config ollama-mcp-config.json
```

#### Docker Compose with Ollama

Create `docker-compose-ollama.yml`:

```yaml
version: '3.8'

services:
  # Ollama Server
  ollama:
    image: ollama/ollama:latest
    container_name: ollama-server
    restart: unless-stopped
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
      - ./ollama-config:/app/config:ro
    environment:
      - OLLAMA_HOST=0.0.0.0
      - OLLAMA_MODELS=/root/.ollama/models
    networks:
      - ollama-network

  # MCP Browser Search (Enhanced)
  mcp-search:
    build: .
    container_name: mcp-search-for-ollama
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - SERVER_TYPE=enhanced
      - MCP_CACHE_TTL=900
      - MCP_USE_CACHE=true
      - MCP_DEFAULT_ENGINE=duckduckgo
      - MCP_MAX_RESULTS=10
    volumes:
      - ./config:/app/config:ro
      - ./logs:/app/logs
      - mcp_cache:/app/cache
    ports:
      - "3001:3000"
    networks:
      - ollama-network

  # OpenWebUI (Optional - for web interface)
  openwebui:
    image: ghcr.io/open-webui/open-webui:main
    container_name: open-webui
    restart: unless-stopped
    ports:
      - "3000:8080"
    environment:
      - OLLAMA_BASE_URL=http://ollama:11434
      - WEBUI_SECRET_KEY=your-secret-key
    volumes:
      - open_webui_data:/app/backend/data
    depends_on:
      - ollama
      - mcp-search
    networks:
      - ollama-network

volumes:
  ollama_data:
  mcp_cache:
  open_webui_data:

networks:
  ollama-network:
    driver: bridge
```

#### Ollama Model Configuration

Create a custom modelfile with MCP tools:

```dockerfile
# Modelfile for Ollama with MCP Browser Search
FROM llama3.1:8b

# Set system prompt to use web search capabilities
SYSTEM """
You are an AI assistant with access to real-time web search capabilities through the MCP Browser Search tool.

When users ask questions that would benefit from current information, recent data, or facts that may have changed, you should:

1. Use the web_search tool to find current information
2. Analyze and synthesize the search results
3. Provide accurate, up-to-date responses with source attribution

Available tools:
- web_search: Search the web for current information
- visit_page: Extract content from specific web pages
- search_news: Find recent news articles

Always cite your sources when providing information from web searches.
"""

# Configure tool integration
PARAMETER tools '[
  {
    "name": "web_search", 
    "endpoint": "http://mcp-search:3000",
    "method": "POST",
    "headers": {"Content-Type": "application/json"}
  }
]'

PARAMETER temperature 0.7
PARAMETER top_p 0.9
```

#### Deploy Ollama with MCP Tools

```bash
# Start the Ollama + MCP stack
docker-compose -f docker-compose-ollama.yml up -d

# Wait for services to start
sleep 30

# Pull and create model with tools
docker exec ollama-server ollama create llama-with-search -f /app/config/Modelfile

# Test the integration
curl -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama-with-search",
    "prompt": "What are the latest developments in AI in 2024?",
    "tools": ["web_search"],
    "stream": false
  }'
```

#### Python Client for Ollama + MCP

```python
import requests
import json

class OllamaMCPClient:
    def __init__(self, ollama_url="http://localhost:11434", mcp_url="http://localhost:3001"):
        self.ollama_url = ollama_url
        self.mcp_url = mcp_url
    
    def search_and_answer(self, question, model="llama-with-search"):
        # First, search for relevant information
        search_response = requests.post(f"{self.mcp_url}/mcp", json={
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {
                "name": "search_web",
                "arguments": {
                    "query": question,
                    "max_results": 5
                }
            }
        })
        
        search_results = search_response.json()
        
        # Prepare context with search results
        context = "Search Results:\n"
        if "result" in search_results and "content" in search_results["result"]:
            for result in search_results["result"]["content"][:3]:
                context += f"- {result.get('title', '')}: {result.get('snippet', '')}\n"
        
        # Generate answer with Ollama using search context
        ollama_response = requests.post(f"{self.ollama_url}/api/generate", json={
            "model": model,
            "prompt": f"""Based on the following search results, please answer this question: {question}

{context}

Please provide a comprehensive answer and cite your sources.""",
            "stream": False
        })
        
        return ollama_response.json()

# Usage example
client = OllamaMCPClient()
response = client.search_and_answer("What are the latest AI breakthroughs in 2024?")
print(response["response"])
```

#### Kubernetes Deployment with Ollama

Add to your `k8s-deployment.yaml`:

```yaml
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ollama
  namespace: mcp-browser-search
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ollama
  template:
    metadata:
      labels:
        app: ollama
    spec:
      containers:
      - name: ollama
        image: ollama/ollama:latest
        ports:
        - containerPort: 11434
        env:
        - name: OLLAMA_HOST
          value: "0.0.0.0"
        volumeMounts:
        - name: ollama-data
          mountPath: /root/.ollama
        - name: ollama-config
          mountPath: /app/config
        resources:
          requests:
            memory: "4Gi"
            cpu: "2000m"
          limits:
            memory: "8Gi"
            cpu: "4000m"
      volumes:
      - name: ollama-data
        persistentVolumeClaim:
          claimName: ollama-pvc
      - name: ollama-config
        configMap:
          name: ollama-config

---
apiVersion: v1
kind: Service
metadata:
  name: ollama-service
  namespace: mcp-browser-search
spec:
  selector:
    app: ollama
  ports:
  - name: http
    port: 11434
    targetPort: 11434
  type: ClusterIP

---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: ollama-pvc
  namespace: mcp-browser-search
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 50Gi

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: ollama-config
  namespace: mcp-browser-search
data:
  Modelfile: |
    FROM llama3.1:8b
    SYSTEM """You are an AI assistant with access to real-time web search through MCP Browser Search tools."""
    PARAMETER tools '[{"name": "web_search", "endpoint": "http://mcp-enhanced-service:3000"}]'
```

#### Testing Ollama Integration

```bash
# Test MCP server connectivity
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# Test Ollama connectivity
curl http://localhost:11434/api/tags

# Test integrated search
curl -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama-with-search",
    "prompt": "Search for recent AI news and summarize the top 3 developments",
    "stream": false
  }'
```

### Generic MCP Clients

```bash
# Standard MCP protocol over stdio
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | mcp-browser-search-enhanced
```

---

## 🔧 How to Use in Tools

### VS Code Extension

Create a VS Code extension using the MCP protocol:

```typescript
import { spawn } from 'child_process';

// Start MCP server
const mcpServer = spawn('mcp-browser-search-enhanced');

// Send MCP commands
mcpServer.stdin.write(JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "tools/call",
  params: {
    name: "search_web",
    arguments: {
      query: "TypeScript best practices",
      engine: "google",
      max_results: 5
    }
  }
}));
```

### REST API Wrapper

Create a REST API wrapper:

```javascript
const express = require('express');
const { spawn } = require('child_process');

const app = express();
const mcpServer = spawn('mcp-browser-search-enhanced');

app.post('/search', async (req, res) => {
  const { query, engine = 'google', max_results = 10 } = req.body;
  
  // Send to MCP server
  mcpServer.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    id: Date.now(),
    method: "tools/call",
    params: {
      name: "search_web",
      arguments: { query, engine, max_results }
    }
  }));
  
  // Handle response...
});

app.listen(3000);
```

### Python Integration

```python
import subprocess
import json

def search_web(query, engine='google'):
    # Start MCP server
    process = subprocess.Popen(
        ['mcp-browser-search-enhanced'],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        text=True
    )
    
    # Send request
    request = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": "search_web",
            "arguments": {"query": query, "engine": engine}
        }
    }
    
    stdout, stderr = process.communicate(json.dumps(request))
    return json.loads(stdout)
```

---

## 🛠️ Available Tools

### 🔍 `search_web`
Search the web using various search engines.

**Parameters:**
- `query` (required): Search query string
- `engine` (optional): "google", "bing", "duckduckgo", "searx", "startpage" (default: "google")
- `max_results` (optional): 1-50 (default: 10)
- `language` (optional): Language code (default: "en")
- `region` (optional): Region code (default: "us")
- `safe_search` (optional): "strict", "moderate", "off" (default: "moderate")

**Example:**
```json
{
  "query": "artificial intelligence trends 2024",
  "engine": "google",
  "max_results": 10,
  "language": "en",
  "region": "us"
}
```

### 📄 `visit_page`
Extract content from a specific webpage.

**Parameters:**
- `url` (required): URL to visit
- `extract_links` (optional): Extract page links (default: false)
- `extract_images` (optional): Extract image information (default: false)
- `content_type` (optional): "full", "text", "article" (default: "article")
- `include_metadata` (optional): Include page metadata (default: true)

**Example:**
```json
{
  "url": "https://example.com/article",
  "extract_links": true,
  "extract_images": true,
  "content_type": "article"
}
```

### 📰 `search_news`
Search for recent news articles.

**Parameters:**
- `query` (required): News search query
- `max_results` (optional): 1-20 (default: 10)
- `language` (optional): Language code (default: "en")
- `region` (optional): Region code (default: "us")
- `time_range` (optional): "hour", "day", "week", "month" (default: "week")

### 🔍 `bulk_search`
Perform multiple searches in parallel.

**Parameters:**
- `queries` (required): Array of search queries
- `engine` (optional): Search engine to use
- `max_results_per_query` (optional): Results per query (default: 5)

### 🌐 `analyze_domain`
Analyze a domain for endpoints and information.

**Parameters:**
- `domain` (required): Domain to analyze
- `include_subdomains` (optional): Include subdomains (default: false)
- `check_endpoints` (optional): Check common endpoints (default: true)

### 🔗 `extract_links`
Extract all links from a webpage.

**Parameters:**
- `url` (required): URL to extract links from
- `filter_domain` (optional): Filter links by domain
- `include_external` (optional): Include external links (default: true)

---

## ⚙️ Configuration

### Configuration File

Create `config.json` in your project directory:

```json
{
  "cache": {
    "enabled": true,
    "ttl": 300,
    "maxSize": 1000
  },
  "search": {
    "defaultEngine": "google",
    "maxResults": 10,
    "timeout": 30000,
    "userAgent": "MCP-Browser-Search/2.0.0"
  },
  "browser": {
    "headless": true,
    "timeout": 30000,
    "viewport": {
      "width": 1920,
      "height": 1080
    }
  },
  "security": {
    "allowedDomains": ["*"],
    "blockedDomains": [],
    "rateLimiting": {
      "enabled": true,
      "maxRequests": 100,
      "windowMs": 60000
    }
  }
}
```

### Command Line Options

```bash
# Enhanced server with custom config
mcp-browser-search-enhanced --config ./config.json --cache-ttl 600

# Fallback server with verbose logging
mcp-browser-search-fallback --verbose --timeout 45000

# Full browser server with custom user agent
mcp-browser-search --user-agent "Custom Bot 1.0" --headless false
```

---

## 🔧 Advanced Usage

### Custom Search Engine

```javascript
// Add custom search engine support
const customEngines = {
  'my-engine': {
    url: 'https://my-search.com/search',
    queryParam: 'q',
    resultSelector: '.result',
    titleSelector: '.title',
    urlSelector: 'a',
    snippetSelector: '.snippet'
  }
};
```

### Proxy Configuration

```bash
# Use proxy for requests
export HTTP_PROXY=http://proxy.example.com:8080
export HTTPS_PROXY=https://proxy.example.com:8080
mcp-browser-search-enhanced
```

### Performance Tuning

```javascript
// High-performance configuration
{
  "cache": {
    "enabled": true,
    "ttl": 1800,  // 30 minutes
    "maxSize": 5000
  },
  "browser": {
    "headless": true,
    "timeout": 15000,  // Faster timeout
    "args": [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu"
    ]
  },
  "search": {
    "maxConcurrent": 10,  // Parallel searches
    "retries": 3
  }
}
```

---

## 🧪 Testing

### Run Tests

```bash
# Run all tests
npm test

# Test specific server
npm run test:fallback
npm run test:enhanced

# Test production build
npm run test:production

# Docker tests
npm run docker:test
```

### Manual Testing

```bash
# Test MCP protocol
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | mcp-browser-search-enhanced

# Test search functionality
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_web","arguments":{"query":"test","max_results":3}}}' | mcp-browser-search-enhanced

# Test page extraction
echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"visit_page","arguments":{"url":"https://example.com"}}}' | mcp-browser-search-enhanced
```

---

## 📊 Performance & Monitoring

### Health Check Endpoint

```bash
# Check server health
curl -X POST http://localhost:3000/health \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"ping"}'
```

### Monitoring Metrics

```javascript
// Monitor performance
const metrics = {
  searchCount: 0,
  cacheHitRate: 0.85,
  averageResponseTime: 250,
  errorRate: 0.02
};
```

### Log Analysis

```bash
# Monitor logs
tail -f logs/mcp-browser-search.log | grep ERROR

# Performance analysis
grep "response_time" logs/mcp-browser-search.log | awk '{sum+=$NF} END {print "Avg:", sum/NR}'
```

---

## 🔒 Security Considerations

### Best Practices

- ✅ Run in Docker containers with non-root user
- ✅ Use rate limiting to prevent abuse
- ✅ Validate all input parameters
- ✅ Implement request timeouts
- ✅ Respect robots.txt when possible
- ✅ Use realistic user agents

### Security Configuration

```json
{
  "security": {
    "allowedDomains": ["example.com", "*.safe-domain.org"],
    "blockedDomains": ["malicious.com"],
    "maxUrlLength": 2048,
    "validateUrls": true,
    "rateLimiting": {
      "enabled": true,
      "maxRequests": 100,
      "windowMs": 60000,
      "skipSuccessfulRequests": true
    },
    "headers": {
      "User-Agent": "MCP-Browser-Search/2.0.0",
      "X-Forwarded-For": "127.0.0.1"
    }
  }
}
```

---

## 🚀 Production Deployment

### Systemd Service

Create `/etc/systemd/system/mcp-browser-search.service`:

```ini
[Unit]
Description=MCP Browser Search Server
After=network.target

[Service]
Type=simple
User=mcp
WorkingDirectory=/opt/mcp-browser-search
ExecStart=/usr/bin/node dist/servers/EnhancedServer.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=MCP_LOG_LEVEL=info

[Install]
WantedBy=multi-user.target
```

### Quick Docker Compose Setup

For a simple single-server deployment:

```yaml
version: '3.8'
services:
  mcp-browser-search:
    build: .
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - SERVER_TYPE=enhanced
      - MCP_CACHE_TTL=600
      - MCP_USE_CACHE=true
    volumes:
      - ./config:/app/config:ro
      - ./logs:/app/logs
    ports:
      - "3000:3000"
    healthcheck:
      test: ["CMD", "node", "-e", "console.log('Health check')"]
      interval: 30s
      timeout: 10s
      retries: 3
```

*For a complete production setup with load balancing, Redis, and monitoring, see the full Docker Compose configuration in the deployment section above.*

### Load Balancing

```nginx
upstream mcp_servers {
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
    server 127.0.0.1:3003;
}

server {
    listen 80;
    server_name mcp-search.example.com;
    
    location / {
        proxy_pass http://mcp_servers;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 🐛 Troubleshooting

### Common Issues

**1. Browser Launch Failed**
```bash
# Install browser dependencies
npx playwright install-deps chromium

# Or use fallback server
mcp-browser-search-fallback
```

**2. Search Results Empty**
```bash
# Check internet connectivity
curl -I https://google.com

# Test with different engine
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_web","arguments":{"query":"test","engine":"duckduckgo"}}}' | mcp-browser-search-enhanced
```

**3. High Memory Usage**
```bash
# Reduce cache size
export MCP_CACHE_MAX_SIZE=100

# Use fallback server
mcp-browser-search-fallback
```

**4. Timeout Errors**
```bash
# Increase timeout
export MCP_TIMEOUT=60000

# Check network latency
ping google.com
```

### Debug Mode

```bash
# Enable debug logging
DEBUG=mcp:* mcp-browser-search-enhanced

# Verbose output
mcp-browser-search-enhanced --verbose --log-level debug

# Test specific functionality
npm run test:debug
```

### Performance Issues

```bash
# Monitor resource usage
top -p $(pgrep -f mcp-browser-search)

# Check disk space
df -h

# Monitor network
netstat -an | grep ESTABLISHED | wc -l
```

---

## 📈 Changelog & Migration

### Latest Version: 2.0.0

**New Features:**
- ✨ Enhanced server with caching and bulk operations
- 🔍 Multiple search engines support
- 📰 News search functionality
- 🌐 Domain analysis capabilities
- 🐳 Docker support with security best practices
- 📚 Comprehensive documentation and integration guides

**Breaking Changes:**
- None - fully backward compatible with v1.0.0

**Migration from v1.x:**
```bash
# Update package
npm install mcp-browser-search@^2.0.0

# Use enhanced server for new features
mcp-browser-search-enhanced

# Update MCP client configuration
{
  "mcpServers": {
    "browser-search": {
      "command": "mcp-browser-search-enhanced"
    }
  }
}
```

---

## 🤝 Contributing

### Development Setup

```bash
# Fork and clone
git clone https://github.com/yourusername/mcp-browser-search.git
cd mcp-browser-search

# Install dependencies
npm install

# Run tests
npm test

# Start development server
npm run dev
```

### Contribution Guidelines

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** changes: `git commit -m 'Add amazing feature'`
4. **Push** to branch: `git push origin feature/amazing-feature`
5. **Open** a Pull Request

### Code Standards

- Use TypeScript for all new code
- Follow existing code style
- Add tests for new features
- Update documentation
- Ensure all tests pass

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Model Context Protocol](https://github.com/modelcontextprotocol) for the MCP specification
- [Playwright](https://playwright.dev/) for browser automation
- [Cheerio](https://cheerio.js.org/) for HTML parsing
- The open-source community for inspiration and feedback

---

## 📞 Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/yourusername/mcp-browser-search/issues)
- **Discussions**: [Community discussions and Q&A](https://github.com/yourusername/mcp-browser-search/discussions)
- **Email**: [your.email@example.com](mailto:your.email@example.com)

---

**Made with ❤️ for the MCP community**