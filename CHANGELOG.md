# Changelog

All notable changes to the MCP Browser Search Server will be documented in this file.

## [2.0.0] - 2024-11-08

### Added
- **Enhanced server version** with advanced features:
  - Search result caching with configurable TTL
  - Bulk search capabilities for multiple queries
  - Domain analysis and endpoint discovery
  - News search functionality
  - Advanced content extraction with metadata
  - Image and link extraction options
- **Docker support** with multi-stage build
- **Comprehensive documentation**:
  - Integration guide for multiple MCP clients
  - Complete API reference with examples
  - Deployment guide for various environments
- **Multiple search engines**: Google, Bing, DuckDuckGo, Searx, StartPage
- **Advanced configuration options**:
  - Language and region settings
  - Safe search controls
  - Content type selection
  - Cache management
- **Testing suite** for all server versions
- **npm packaging** with proper bin commands
- **Security features**:
  - Input validation
  - Rate limiting
  - Non-root Docker execution
  - Request timeouts

### Enhanced
- **Error handling** with detailed error messages
- **Performance optimizations** with connection pooling
- **Content parsing** with better HTML extraction
- **URL handling** with domain extraction
- **Logging** with configurable levels

### Changed
- Updated package structure with multiple entry points
- Improved TypeScript configuration
- Enhanced fallback server with better parsing
- Updated dependencies to latest stable versions

## [1.0.0] - 2024-11-08

### Added
- **Initial release** of MCP Browser Search Server
- **Two server versions**:
  - Full browser automation with Playwright
  - Fallback HTTP-based version with curl
- **Core functionality**:
  - Web search with DuckDuckGo
  - Web page content extraction
  - Link extraction capabilities
- **MCP protocol compliance**:
  - Tool discovery via `tools/list`
  - Tool execution via `tools/call`
  - Proper error handling and responses
- **Basic documentation**:
  - README with usage instructions
  - Example configuration files
- **Build system**:
  - TypeScript compilation
  - npm scripts for development
- **Platform compatibility**:
  - Cross-platform support (Linux, macOS, Windows)
  - Fallback for environments without browser support

### Technical Details
- Built on Model Context Protocol SDK v0.4.0
- Uses Cheerio for HTML parsing
- Implements stdio transport for MCP communication
- Supports JSON-RPC 2.0 protocol
- Provides structured error responses

### Dependencies
- @modelcontextprotocol/sdk: ^0.4.0
- playwright: ^1.40.0
- cheerio: ^1.0.0-rc.12
- typescript: ^5.0.0

---

## Future Roadmap

### [2.1.0] - Planned
- [ ] Redis caching support for distributed deployments
- [ ] WebSocket transport option for real-time updates
- [ ] Plugin system for custom search engines
- [ ] Rate limiting with configurable policies
- [ ] Metrics collection and monitoring endpoints

### [2.2.0] - Planned
- [ ] Support for more content types (PDF, documents)
- [ ] AI-powered content summarization
- [ ] Search result ranking and filtering
- [ ] User preference management
- [ ] Advanced security features

### [3.0.0] - Future
- [ ] GraphQL API support
- [ ] Machine learning integration for result optimization
- [ ] Multi-language content translation
- [ ] Advanced analytics and reporting
- [ ] Enterprise features (SSO, audit logs)

---

## Migration Guides

### From v1.0.0 to v2.0.0

**Breaking Changes:**
- None - v2.0.0 is fully backward compatible

**New Features Available:**
1. **Enhanced server**: Use `mcp-browser-search-enhanced` command
2. **Caching**: Enable with `use_cache: true` parameter
3. **Bulk search**: Use new `bulk_search` tool
4. **Domain analysis**: Use new `analyze_domain` tool

**Recommended Upgrades:**
```bash
# Update package
npm install mcp-browser-search@^2.0.0

# Use enhanced server
node dist/enhanced-server.js

# Update MCP client config
{
  "command": "mcp-browser-search-enhanced"
}
```

---

## Support and Contributing

### Reporting Issues
- Use GitHub Issues for bug reports
- Include server version and environment details
- Provide minimal reproduction steps

### Contributing
1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push branch: `git push origin feature/new-feature`
5. Submit Pull Request

### Development Setup
```bash
git clone https://github.com/yourusername/mcp-browser-search.git
cd mcp-browser-search
npm install
npm run build
npm run test
```