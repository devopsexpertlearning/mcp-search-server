# 🚀 Production Deployment Guide

This guide covers deploying the MCP Browser Search Server with Ollama integration in production environments.

## 📋 Prerequisites

### System Requirements

- **Docker & Docker Compose**: For containerized deployments
- **Kubernetes**: v1.24+ for K8s deployments
- **Helm**: v3.8+ for Helm deployments
- **GPU Support**: NVIDIA GPU with CUDA for Ollama (recommended)
- **Storage**: Fast SSD storage for model caching
- **Memory**: 8GB+ RAM (16GB+ recommended with GPU)
- **CPU**: 4+ cores recommended

### GPU Setup (Optional but Recommended)

```bash
# Install NVIDIA Container Toolkit
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/libnvidia-container/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/libnvidia-container/$distribution/libnvidia-container.list | sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

sudo apt-get update && sudo apt-get install -y nvidia-container-toolkit
sudo systemctl restart docker

# For Kubernetes, install NVIDIA Device Plugin
kubectl apply -f https://raw.githubusercontent.com/NVIDIA/k8s-device-plugin/v0.14.0/nvidia-device-plugin.yml
```

## 🐋 Docker Compose Deployment

### 1. Quick Start (Development)

```bash
# Clone repository
git clone https://github.com/yourusername/mcp-browser-search.git
cd mcp-browser-search

# Build and start services
npm run docker:build
docker-compose up -d

# Services will be available at:
# - Enhanced Server: http://localhost:3001
# - Redis: localhost:6379
```

### 2. Staging Deployment (with Ollama)

```bash
# Start with Ollama integration
docker-compose -f docker-compose-ollama.yml up -d

# Wait for Ollama to start, then pull models
docker-compose exec ollama-server ollama pull llama2
docker-compose exec ollama-server ollama pull mistral

# Services available at:
# - Ollama Server: http://localhost:3002
# - Enhanced Server: http://localhost:3001
# - Ollama UI: http://localhost:8080
# - Grafana: http://localhost:3003
```

### 3. Production Deployment

```bash
# Use production compose file
docker-compose -f docker-compose-prod.yml up -d

# Configure SSL certificates
mkdir -p config/nginx/ssl
# Place your SSL certificates in config/nginx/ssl/

# Services available at:
# - Load Balancer: https://localhost
# - Monitoring: https://localhost/grafana
# - Metrics: https://localhost/prometheus
```

## ☸️ Kubernetes Deployment

### 1. Manual Kubernetes Deployment

```bash
# Apply all Kubernetes manifests
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml

# Deploy storage and cache layer
kubectl apply -f k8s/redis-deployment.yaml

# Deploy Ollama (if GPU available)
kubectl apply -f k8s/ollama-deployment.yaml

# Deploy MCP servers
kubectl apply -f k8s/mcp-deployment.yaml
kubectl apply -f k8s/services.yaml

# Deploy load balancer
kubectl apply -f k8s/nginx-deployment.yaml

# Deploy monitoring (production)
kubectl apply -f k8s/monitoring.yaml
kubectl apply -f k8s/hpa.yaml
```

### 2. Using the Deployment Script

```bash
# Make script executable
chmod +x scripts/deploy.sh

# Deploy to Kubernetes (production with GPU)
./scripts/deploy.sh kubernetes production true

# Deploy to Kubernetes (staging without GPU)
./scripts/deploy.sh kubernetes staging false

# Check deployment status
kubectl get all -n mcp-browser-search
```

### 3. Verify Deployment

```bash
# Check pods
kubectl get pods -n mcp-browser-search

# Check services
kubectl get services -n mcp-browser-search

# Check logs
kubectl logs -f deployment/mcp-ollama -n mcp-browser-search

# Port forward for local testing
kubectl port-forward -n mcp-browser-search service/mcp-ollama-service 3000:3000
```

## 🎡 Helm Deployment

### 1. Install with Default Values

```bash
# Add required repositories
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# Install the chart
helm install mcp-browser-search ./helm -n mcp-browser-search --create-namespace
```

### 2. Production Installation with Custom Values

```bash
# Create custom values file
cat > production-values.yaml << EOF
# Enable all components for production
mcpServers:
  ollama:
    enabled: true
    replicas: 3
  enhanced:
    enabled: true
    replicas: 5
  fallback:
    enabled: true
    replicas: 2

# Enable GPU support
ollama:
  enabled: true
  resources:
    requests:
      nvidia.com/gpu: "1"
    limits:
      nvidia.com/gpu: "1"

# Production monitoring
monitoring:
  enabled: true
  prometheus:
    enabled: true
  grafana:
    enabled: true

# Ingress configuration
ingress:
  enabled: true
  hosts:
    - host: mcp-search.yourdomain.com
      paths:
        - path: /
          pathType: Prefix

# Storage configuration
storage:
  storageClass: "fast-ssd"
EOF

# Install with custom values
helm install mcp-browser-search ./helm -f production-values.yaml -n mcp-browser-search --create-namespace
```

### 3. Upgrade Deployment

```bash
# Upgrade with new values
helm upgrade mcp-browser-search ./helm -f production-values.yaml -n mcp-browser-search

# Check status
helm status mcp-browser-search -n mcp-browser-search
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `LOG_LEVEL` | Logging level | `info` |
| `OLLAMA_BASE_URL` | Ollama server URL | `http://localhost:11434` |
| `OLLAMA_DEFAULT_MODEL` | Default Ollama model | `llama2` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `CACHE_TTL` | Cache time-to-live (ms) | `3600000` |
| `MAX_SEARCH_RESULTS` | Max search results | `20` |

### SSL/TLS Configuration

#### Self-signed Certificates (Development)

```bash
# Generate self-signed certificates
mkdir -p config/nginx/ssl
openssl req -x509 -newkey rsa:4096 -keyout config/nginx/ssl/key.pem -out config/nginx/ssl/cert.pem -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
```

#### Let's Encrypt (Production)

```bash
# Using cert-manager in Kubernetes
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Create ClusterIssuer
cat << EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@domain.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
```

## 📊 Monitoring & Observability

### Grafana Dashboards

Access Grafana at: `https://your-domain/grafana`
- Username: `admin`
- Password: `admin123` (change in production)

### Prometheus Metrics

Metrics available at: `https://your-domain/prometheus`

Key metrics to monitor:
- Request rate and latency
- Error rates
- Resource utilization
- Ollama model performance
- Cache hit rates

### Health Checks

- Application health: `/health`
- Metrics endpoint: `/metrics`
- Ollama health: `/ollama/api/tags`

## 🔒 Security Best Practices

### 1. Network Security

```bash
# Configure firewall rules
sudo ufw allow 22/tcp     # SSH
sudo ufw allow 80/tcp     # HTTP
sudo ufw allow 443/tcp    # HTTPS
sudo ufw enable
```

### 2. Container Security

```bash
# Run containers as non-root user (already configured in Dockerfiles)
# Use secrets for sensitive data
# Enable container image scanning
```

### 3. Kubernetes Security

```bash
# Enable RBAC
kubectl apply -f k8s/rbac.yaml

# Use NetworkPolicies
kubectl apply -f k8s/network-policies.yaml

# Configure Pod Security Standards
kubectl label namespace mcp-browser-search pod-security.kubernetes.io/enforce=restricted
```

## 🚨 Troubleshooting

### Common Issues

#### 1. Ollama GPU Not Detected

```bash
# Check NVIDIA drivers
nvidia-smi

# Check Docker GPU support
docker run --rm --gpus all nvidia/cuda:11.0.3-base-ubuntu20.04 nvidia-smi

# In Kubernetes, check device plugin
kubectl get pods -n kube-system | grep nvidia
```

#### 2. Out of Memory Errors

```bash
# Increase memory limits in Docker Compose
# Or adjust Kubernetes resource limits
kubectl edit deployment mcp-ollama -n mcp-browser-search
```

#### 3. SSL/TLS Issues

```bash
# Check certificate validity
openssl x509 -in config/nginx/ssl/cert.pem -text -noout

# Verify certificate in Kubernetes
kubectl get secret nginx-ssl-secret -n mcp-browser-search -o yaml
```

### Logging and Debugging

```bash
# Docker Compose logs
docker-compose logs -f ollama-server
docker-compose logs -f mcp-search-ollama

# Kubernetes logs
kubectl logs -f deployment/mcp-ollama -n mcp-browser-search
kubectl logs -f deployment/ollama -n mcp-browser-search

# Debug pod issues
kubectl describe pod <pod-name> -n mcp-browser-search
```

## 📈 Scaling

### Horizontal Pod Autoscaler

HPA is automatically configured for production deployments:

```bash
# Check HPA status
kubectl get hpa -n mcp-browser-search

# View HPA details
kubectl describe hpa mcp-ollama-hpa -n mcp-browser-search
```

### Manual Scaling

```bash
# Scale MCP servers
kubectl scale deployment mcp-ollama --replicas=5 -n mcp-browser-search

# Scale using Helm
helm upgrade mcp-browser-search ./helm --set mcpServers.ollama.replicas=5 -n mcp-browser-search
```

## 🔄 Updates and Maintenance

### Rolling Updates

```bash
# Update Docker image
docker build -t mcp-browser-search:v2.1.0 .
docker tag mcp-browser-search:v2.1.0 mcp-browser-search:latest

# Update in Kubernetes
kubectl set image deployment/mcp-ollama mcp-ollama=mcp-browser-search:v2.1.0 -n mcp-browser-search

# Update using Helm
helm upgrade mcp-browser-search ./helm --set image.tag=v2.1.0 -n mcp-browser-search
```

### Backup and Recovery

```bash
# Backup Redis data
kubectl exec -n mcp-browser-search deployment/redis -- redis-cli BGSAVE

# Backup Ollama models
kubectl exec -n mcp-browser-search deployment/ollama -- tar czf /tmp/models-backup.tar.gz /root/.ollama/models

# Backup using velero (if installed)
velero backup create mcp-browser-search-backup --include-namespaces mcp-browser-search
```

## 📞 Support

For issues and questions:
- GitHub Issues: [Repository Issues](https://github.com/yourusername/mcp-browser-search/issues)
- Documentation: [README.md](./README.md)
- Discord: [MCP Community](https://discord.gg/mcp-community)

---

**🎉 Congratulations!** You now have a production-ready MCP Browser Search Server with Ollama integration deployed and running.