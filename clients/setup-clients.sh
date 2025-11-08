#!/bin/bash
set -euo pipefail

# MCP Browser Search Clients Setup Script
# This script sets up all client variants for the MCP Browser Search system

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

# Configuration
CLIENT_TYPE="${1:-all}"  # all, web, cli, desktop, mobile, bridge
SKIP_BUILD="${2:-false}" # Skip building if dependencies already installed

log_info "Setting up MCP Browser Search clients..."
log_info "Client type: $CLIENT_TYPE"
log_info "Skip build: $SKIP_BUILD"

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is required but not installed"
        exit 1
    fi

    # Check npm
    if ! command -v npm &> /dev/null; then
        log_error "npm is required but not installed"
        exit 1
    fi

    # Check if we're in the right directory
    if [ ! -f "../package.json" ]; then
        log_error "Please run this script from the clients directory"
        exit 1
    fi

    # Check if MCP servers are built
    if [ ! -d "../dist" ]; then
        log_warning "MCP servers not built. Building now..."
        cd .. && npm run build && cd clients
    fi

    log_success "Prerequisites check passed"
}

# Setup Web Client
setup_web_client() {
    if [ "$CLIENT_TYPE" = "web" ] || [ "$CLIENT_TYPE" = "all" ]; then
        log_info "Setting up Web Client..."
        
        cd web-client
        
        if [ "$SKIP_BUILD" = "false" ]; then
            npm install
        fi
        
        # Create necessary directories
        mkdir -p dist logs
        
        # Build TypeScript
        npm run build
        
        # Setup React frontend
        if [ ! -d "src/renderer/node_modules" ]; then
            log_info "Setting up React frontend..."
            cd src && npx create-react-app renderer --template typescript
            cd renderer
            
            # Install additional dependencies
            npm install socket.io-client axios @types/socket.io-client
            
            # Copy our components (would need to be created)
            # cp -r ../../components/* src/components/ 2>/dev/null || true
            
            cd ../..
        fi
        
        cd ..
        log_success "Web client setup completed"
    fi
}

# Setup CLI Client
setup_cli_client() {
    if [ "$CLIENT_TYPE" = "cli" ] || [ "$CLIENT_TYPE" = "all" ]; then
        log_info "Setting up CLI Client..."
        
        cd cli-client
        
        if [ "$SKIP_BUILD" = "false" ]; then
            npm install
        fi
        
        # Create directories
        mkdir -p dist logs
        
        # Build TypeScript
        npm run build
        
        # Make CLI executable
        chmod +x dist/cli.js
        
        # Create symlinks for global access (optional)
        if command -v sudo &> /dev/null; then
            log_info "Creating global CLI symlinks..."
            sudo npm link || log_warning "Failed to create global symlinks"
        fi
        
        cd ..
        log_success "CLI client setup completed"
    fi
}

# Setup Desktop Client
setup_desktop_client() {
    if [ "$CLIENT_TYPE" = "desktop" ] || [ "$CLIENT_TYPE" = "all" ]; then
        log_info "Setting up Desktop Client..."
        
        # Check for Electron prerequisites
        if ! command -v electron &> /dev/null; then
            log_info "Installing Electron globally..."
            npm install -g electron || log_warning "Failed to install Electron globally"
        fi
        
        cd desktop-client
        
        if [ "$SKIP_BUILD" = "false" ]; then
            npm install
        fi
        
        # Create directories
        mkdir -p dist assets logs
        
        # Build TypeScript
        npm run build
        
        # Setup React renderer if it doesn't exist
        if [ ! -d "src/renderer" ]; then
            log_info "Setting up React renderer..."
            mkdir -p src/renderer
            cd src/renderer
            npx create-react-app . --template typescript
            
            # Install additional dependencies
            npm install @types/electron
            
            cd ../..
        fi
        
        # Build renderer
        npm run build:react || log_warning "React build failed"
        
        cd ..
        log_success "Desktop client setup completed"
    fi
}

# Setup Mobile Client
setup_mobile_client() {
    if [ "$CLIENT_TYPE" = "mobile" ] || [ "$CLIENT_TYPE" = "all" ]; then
        log_info "Setting up Mobile Client..."
        
        # Check React Native CLI
        if ! command -v react-native &> /dev/null; then
            log_info "Installing React Native CLI..."
            npm install -g @react-native-community/cli || log_warning "Failed to install React Native CLI"
        fi
        
        cd mobile-client
        
        # Initialize React Native project if it doesn't exist
        if [ ! -f "android/build.gradle" ]; then
            log_info "Initializing React Native project..."
            npx react-native init MCPBrowserSearchMobile --template react-native-template-typescript
            
            # Copy our package.json dependencies
            cp package.json MCPBrowserSearchMobile/
            cd MCPBrowserSearchMobile
            npm install
            cd ..
        else
            if [ "$SKIP_BUILD" = "false" ]; then
                npm install
            fi
        fi
        
        # Install pods for iOS (if on macOS)
        if [[ "$OSTYPE" == "darwin"* ]] && command -v pod &> /dev/null; then
            log_info "Installing iOS dependencies..."
            cd ios && pod install && cd ..
        fi
        
        cd ..
        log_success "Mobile client setup completed"
    fi
}

# Setup HTTP Bridge
setup_http_bridge() {
    if [ "$CLIENT_TYPE" = "bridge" ] || [ "$CLIENT_TYPE" = "all" ]; then
        log_info "Setting up HTTP Bridge..."
        
        cd http-bridge
        
        if [ "$SKIP_BUILD" = "false" ]; then
            npm install
        fi
        
        # Create directories
        mkdir -p dist logs
        
        # Build TypeScript
        npm run build
        
        cd ..
        log_success "HTTP Bridge setup completed"
    fi
}

# Setup Claude Desktop configuration
setup_claude_config() {
    log_info "Setting up Claude Desktop configuration..."
    
    # Detect OS and set config path
    case "$OSTYPE" in
        darwin*)
            CLAUDE_CONFIG_DIR="$HOME/Library/Application Support/Claude"
            ;;
        linux*)
            CLAUDE_CONFIG_DIR="$HOME/.config/claude"
            ;;
        msys*|cygwin*|win32*)
            CLAUDE_CONFIG_DIR="$APPDATA/Claude"
            ;;
        *)
            log_warning "Unknown OS, skipping Claude Desktop setup"
            return
            ;;
    esac
    
    # Create Claude config directory
    mkdir -p "$CLAUDE_CONFIG_DIR"
    
    # Get absolute path to the project
    PROJECT_PATH=$(cd .. && pwd)
    
    # Update Claude config with correct paths
    sed "s|/absolute/path/to/your/project|$PROJECT_PATH|g" \
        claude-config/claude_desktop_config.json > \
        "$CLAUDE_CONFIG_DIR/claude_desktop_config.json"
    
    log_success "Claude Desktop configuration created at: $CLAUDE_CONFIG_DIR/claude_desktop_config.json"
    log_info "Please restart Claude Desktop to load the new configuration"
}

# Create client testing scripts
create_test_scripts() {
    log_info "Creating client testing scripts..."
    
    # Create test script for web client
    cat > test-web-client.sh << 'EOF'
#!/bin/bash
echo "Testing Web Client..."
cd web-client
npm start &
WEB_PID=$!
sleep 5
echo "Web client available at: http://localhost:3001"
echo "Press Ctrl+C to stop"
wait $WEB_PID
EOF
    chmod +x test-web-client.sh
    
    # Create test script for CLI client
    cat > test-cli-client.sh << 'EOF'
#!/bin/bash
echo "Testing CLI Client..."
cd cli-client
echo "Running health check..."
npm start -- --help
echo "Running sample search..."
npm start -- search "test query"
EOF
    chmod +x test-cli-client.sh
    
    # Create test script for HTTP bridge
    cat > test-http-bridge.sh << 'EOF'
#!/bin/bash
echo "Testing HTTP Bridge..."
cd http-bridge
npm start &
BRIDGE_PID=$!
sleep 5
echo "Testing API endpoint..."
curl -X GET http://localhost:8080/api/health
echo -e "\nAPI documentation: http://localhost:8080/api-docs"
echo "Press Ctrl+C to stop"
wait $BRIDGE_PID
EOF
    chmod +x test-http-bridge.sh
    
    # Create comprehensive test script
    cat > test-all-clients.sh << 'EOF'
#!/bin/bash
echo "Testing All MCP Clients..."

echo "1. Testing CLI Client..."
./test-cli-client.sh

echo -e "\n2. Starting HTTP Bridge..."
./test-http-bridge.sh &
BRIDGE_PID=$!

echo -e "\n3. Starting Web Client..."
./test-web-client.sh &
WEB_PID=$!

echo -e "\nAll clients started. Available at:"
echo "  - Web Client: http://localhost:3001"
echo "  - HTTP Bridge: http://localhost:8080"
echo "  - API Docs: http://localhost:8080/api-docs"

echo -e "\nPress Ctrl+C to stop all clients"
trap "kill $BRIDGE_PID $WEB_PID 2>/dev/null" EXIT
wait
EOF
    chmod +x test-all-clients.sh
    
    log_success "Test scripts created"
}

# Main execution
main() {
    echo "======================================"
    echo "MCP Browser Search Clients Setup"
    echo "======================================"
    
    check_prerequisites
    
    case $CLIENT_TYPE in
        "web")
            setup_web_client
            ;;
        "cli")
            setup_cli_client
            ;;
        "desktop")
            setup_desktop_client
            ;;
        "mobile")
            setup_mobile_client
            ;;
        "bridge")
            setup_http_bridge
            ;;
        "all")
            setup_web_client
            setup_cli_client
            setup_desktop_client
            setup_mobile_client
            setup_http_bridge
            ;;
        *)
            log_error "Invalid client type: $CLIENT_TYPE"
            echo "Valid options: web, cli, desktop, mobile, bridge, all"
            exit 1
            ;;
    esac
    
    setup_claude_config
    create_test_scripts
    
    echo "======================================"
    log_success "Client setup completed successfully!"
    echo "======================================"
    
    echo "Next steps:"
    echo "1. Test CLI client: ./test-cli-client.sh"
    echo "2. Test web client: ./test-web-client.sh" 
    echo "3. Test HTTP bridge: ./test-http-bridge.sh"
    echo "4. Test all clients: ./test-all-clients.sh"
    echo "5. Configure Claude Desktop and restart it"
    echo ""
    echo "Client locations:"
    echo "  - CLI: clients/cli-client/dist/cli.js"
    echo "  - Web: clients/web-client/server.js"
    echo "  - Desktop: clients/desktop-client/dist/main.js"
    echo "  - Mobile: clients/mobile-client/"
    echo "  - Bridge: clients/http-bridge/dist/server.js"
}

# Error handling
trap 'log_error "Setup failed on line $LINENO"' ERR

# Execute main function
main "$@"