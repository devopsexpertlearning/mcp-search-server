#!/bin/bash
set -euo pipefail

# MCP Browser Search Deployment Script
# This script deploys the MCP Browser Search server with Ollama integration

# Configuration
NAMESPACE="mcp-browser-search"
DEPLOYMENT_TYPE="${1:-docker-compose}"  # docker-compose, kubernetes, helm
ENVIRONMENT="${2:-production}"          # development, staging, production
GPU_ENABLED="${3:-true}"                # true, false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    case $DEPLOYMENT_TYPE in
        "docker-compose")
            if ! command -v docker-compose &> /dev/null && ! command -v docker &> /dev/null; then
                log_error "Docker and Docker Compose are required for this deployment type"
                exit 1
            fi
            ;;
        "kubernetes")
            if ! command -v kubectl &> /dev/null; then
                log_error "kubectl is required for Kubernetes deployment"
                exit 1
            fi
            ;;
        "helm")
            if ! command -v helm &> /dev/null; then
                log_error "Helm is required for Helm deployment"
                exit 1
            fi
            if ! command -v kubectl &> /dev/null; then
                log_error "kubectl is required for Helm deployment"
                exit 1
            fi
            ;;
        *)
            log_error "Invalid deployment type: $DEPLOYMENT_TYPE"
            echo "Valid options: docker-compose, kubernetes, helm"
            exit 1
            ;;
    esac

    log_success "Prerequisites check passed"
}

# Build Docker image
build_image() {
    log_info "Building Docker image..."
    
    if [ "$ENVIRONMENT" = "production" ]; then
        docker build -f Dockerfile.prod --target production -t mcp-browser-search:latest .
    else
        docker build -t mcp-browser-search:latest .
    fi
    
    log_success "Docker image built successfully"
}

# Deploy with Docker Compose
deploy_docker_compose() {
    log_info "Deploying with Docker Compose..."
    
    # Choose appropriate compose file
    case $ENVIRONMENT in
        "development")
            COMPOSE_FILE="docker-compose.yml"
            ;;
        "staging")
            COMPOSE_FILE="docker-compose-ollama.yml"
            ;;
        "production")
            COMPOSE_FILE="docker-compose-prod.yml"
            ;;
        *)
            log_error "Invalid environment: $ENVIRONMENT"
            exit 1
            ;;
    esac
    
    log_info "Using compose file: $COMPOSE_FILE"
    
    # Create necessary directories
    mkdir -p logs config/ollama config/nginx/ssl config/redis
    
    # Generate SSL certificates if they don't exist
    if [ ! -f config/nginx/ssl/cert.pem ] || [ ! -f config/nginx/ssl/key.pem ]; then
        log_info "Generating self-signed SSL certificates..."
        openssl req -x509 -newkey rsa:4096 -keyout config/nginx/ssl/key.pem -out config/nginx/ssl/cert.pem -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
    fi
    
    # Start services
    docker-compose -f $COMPOSE_FILE up -d
    
    log_success "Docker Compose deployment completed"
    
    # Wait for services to be ready
    log_info "Waiting for services to be ready..."
    sleep 30
    
    # Check service health
    check_docker_health
}

# Check Docker service health
check_docker_health() {
    log_info "Checking service health..."
    
    services=("mcp-search-enhanced" "redis")
    
    if [ "$ENVIRONMENT" = "staging" ] || [ "$ENVIRONMENT" = "production" ]; then
        services+=("ollama-server" "mcp-search-ollama")
    fi
    
    for service in "${services[@]}"; do
        if docker-compose ps | grep -q "$service.*Up"; then
            log_success "$service is running"
        else
            log_warning "$service is not running properly"
        fi
    done
}

# Deploy to Kubernetes
deploy_kubernetes() {
    log_info "Deploying to Kubernetes..."
    
    # Create namespace
    kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
    
    # Apply configurations in order
    kubectl apply -f k8s/configmap.yaml
    kubectl apply -f k8s/secrets.yaml
    
    # Deploy Redis first
    kubectl apply -f k8s/redis-deployment.yaml
    
    # Wait for Redis to be ready
    log_info "Waiting for Redis to be ready..."
    kubectl wait --for=condition=available --timeout=300s deployment/redis -n $NAMESPACE
    
    # Deploy Ollama if GPU is enabled
    if [ "$GPU_ENABLED" = "true" ]; then
        log_info "Deploying Ollama with GPU support..."
        kubectl apply -f k8s/ollama-deployment.yaml
        kubectl wait --for=condition=available --timeout=600s deployment/ollama -n $NAMESPACE
    fi
    
    # Deploy MCP servers
    kubectl apply -f k8s/mcp-deployment.yaml
    kubectl apply -f k8s/services.yaml
    
    # Deploy load balancer
    kubectl apply -f k8s/nginx-deployment.yaml
    
    # Deploy monitoring if enabled
    if [ "$ENVIRONMENT" = "production" ]; then
        log_info "Deploying monitoring stack..."
        kubectl apply -f k8s/monitoring.yaml
        kubectl apply -f k8s/hpa.yaml
    fi
    
    log_success "Kubernetes deployment completed"
    
    # Check deployment status
    check_kubernetes_health
}

# Check Kubernetes deployment health
check_kubernetes_health() {
    log_info "Checking Kubernetes deployment health..."
    
    # Check if deployments are ready
    deployments=$(kubectl get deployments -n $NAMESPACE -o name)
    
    for deployment in $deployments; do
        if kubectl wait --for=condition=available --timeout=300s $deployment -n $NAMESPACE; then
            log_success "$(basename $deployment) is ready"
        else
            log_warning "$(basename $deployment) is not ready"
        fi
    done
    
    # Show service endpoints
    log_info "Service endpoints:"
    kubectl get services -n $NAMESPACE
}

# Deploy with Helm
deploy_helm() {
    log_info "Deploying with Helm..."
    
    # Add required repositories
    helm repo add bitnami https://charts.bitnami.com/bitnami
    helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
    helm repo update
    
    # Create namespace
    kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
    
    # Install or upgrade the chart
    if helm list -n $NAMESPACE | grep -q mcp-browser-search; then
        log_info "Upgrading existing Helm release..."
        helm upgrade mcp-browser-search ./helm -n $NAMESPACE \
            --set global.storageClass=fast-ssd \
            --set ollama.enabled=$GPU_ENABLED \
            --set monitoring.enabled=$([ "$ENVIRONMENT" = "production" ] && echo "true" || echo "false")
    else
        log_info "Installing new Helm release..."
        helm install mcp-browser-search ./helm -n $NAMESPACE \
            --set global.storageClass=fast-ssd \
            --set ollama.enabled=$GPU_ENABLED \
            --set monitoring.enabled=$([ "$ENVIRONMENT" = "production" ] && echo "true" || echo "false")
    fi
    
    log_success "Helm deployment completed"
    
    # Check Helm deployment status
    check_helm_health
}

# Check Helm deployment health
check_helm_health() {
    log_info "Checking Helm deployment health..."
    
    # Show Helm status
    helm status mcp-browser-search -n $NAMESPACE
    
    # Check pods
    kubectl get pods -n $NAMESPACE
    
    # Show services
    kubectl get services -n $NAMESPACE
}

# Post-deployment setup
post_deployment_setup() {
    log_info "Running post-deployment setup..."
    
    case $DEPLOYMENT_TYPE in
        "docker-compose")
            if [ "$ENVIRONMENT" = "staging" ] || [ "$ENVIRONMENT" = "production" ]; then
                log_info "Pulling default Ollama model..."
                docker-compose exec ollama-server ollama pull llama2 || log_warning "Failed to pull llama2 model"
            fi
            ;;
        "kubernetes"|"helm")
            if [ "$GPU_ENABLED" = "true" ]; then
                log_info "Pulling default Ollama model in Kubernetes..."
                kubectl exec -n $NAMESPACE deployment/ollama -- ollama pull llama2 || log_warning "Failed to pull llama2 model"
            fi
            ;;
    esac
    
    log_success "Post-deployment setup completed"
}

# Main execution
main() {
    echo "======================================"
    echo "MCP Browser Search Deployment Script"
    echo "======================================"
    echo "Deployment Type: $DEPLOYMENT_TYPE"
    echo "Environment: $ENVIRONMENT"
    echo "GPU Enabled: $GPU_ENABLED"
    echo "======================================"
    
    check_prerequisites
    
    if [ "$DEPLOYMENT_TYPE" = "docker-compose" ]; then
        build_image
    fi
    
    case $DEPLOYMENT_TYPE in
        "docker-compose")
            deploy_docker_compose
            ;;
        "kubernetes")
            deploy_kubernetes
            ;;
        "helm")
            deploy_helm
            ;;
    esac
    
    post_deployment_setup
    
    echo "======================================"
    log_success "Deployment completed successfully!"
    echo "======================================"
    
    # Show connection information
    case $DEPLOYMENT_TYPE in
        "docker-compose")
            echo "Services available at:"
            echo "  - Enhanced Server: http://localhost:3001"
            echo "  - Ollama Server: http://localhost:3002 (if enabled)"
            echo "  - Grafana: http://localhost:8080 (if enabled)"
            ;;
        "kubernetes"|"helm")
            echo "Use 'kubectl get services -n $NAMESPACE' to see service endpoints"
            echo "Use 'kubectl port-forward -n $NAMESPACE service/mcp-enhanced-service 3001:3000' for local access"
            ;;
    esac
}

# Error handling
trap 'log_error "Deployment failed on line $LINENO"' ERR

# Execute main function
main "$@"