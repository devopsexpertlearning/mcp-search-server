# 🚀 Quick Start Guide: MCP Browser Search Server

A simple, step-by-step guide to get your MCP Browser Search Server running with LLMs.

---

## 📋 Prerequisites

Before starting, make sure you have:
- **Node.js 18+** installed
- **Git** installed
- **Claude Desktop** (for LLM integration)

---

## ⚡ Installation (5 Minutes)

### Step 1: Clone and Setup
```bash
# Clone the repository
git clone <repository-url>
cd mcp-browser-search

# Install dependencies
npm install

# Build the project
npm run build
```

### Step 2: Test Installation
```bash
# Start the fallback server (most reliable)
npm run start:fallback &

# Test if it works
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' | node dist/servers/FallbackServer.js
```

**✅ Success:** You should see a JSON response listing available tools like `search_web_fallback`, `visit_page_fallback`, etc.

---

## 🤖 Connect to Claude Desktop

### Step 1: Find Your Claude Config
**On macOS:**
```bash
# Open the config file
code ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

**On Windows:**
```bash
# Navigate to:
%APPDATA%\Claude\claude_desktop_config.json
```

**On Linux:**
```bash
# Navigate to:
~/.config/Claude/claude_desktop_config.json
```

### Step 2: Add MCP Server Configuration

Add this configuration to your Claude Desktop config file:

```json
{
  "mcpServers": {
    "browser-search": {
      "command": "node",
      "args": ["/FULL/PATH/TO/mcp-browser-search/dist/servers/FallbackServer.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

**⚠️ Important:** Replace `/FULL/PATH/TO/mcp-browser-search/` with the actual full path to your project folder.

### Step 3: Get Your Full Path
```bash
# In your mcp-browser-search folder, run:
pwd

# Copy the output and use it in the config above
```

### Step 4: Restart Claude Desktop
- Close Claude Desktop completely
- Reopen Claude Desktop
- You should see a small 🔌 icon indicating MCP connection

---

## 🎯 Using the Server with Claude

### Test Basic Functionality

In Claude Desktop, try these commands:

**1. Search the Web:**
```
Can you search for "latest AI news" and give me the top 3 results?
```

**2. Visit a Specific Page:**
```
Can you visit https://example.com and summarize the content?
```

**3. Search for News:**
```
Find recent news about "climate change" and summarize the main points.
```

**4. Bulk Search:**
```
Search for both "machine learning trends" and "AI safety research" and compare the results.
```

---

## 🔧 Server Options

You can use different server types depending on your needs:

### Option 1: Fallback Server (Recommended - Most Reliable)
```json
{
  "mcpServers": {
    "browser-search": {
      "command": "node",
      "args": ["/PATH/TO/mcp-browser-search/dist/servers/FallbackServer.js"]
    }
  }
}
```
- ✅ No browser dependencies
- ✅ Fast and lightweight  
- ✅ Works everywhere

### Option 2: Enhanced Server (Advanced Features)
```json
{
  "mcpServers": {
    "browser-search": {
      "command": "node",
      "args": ["/PATH/TO/mcp-browser-search/dist/servers/EnhancedServer.js"]
    }
  }
}
```
- ✅ Caching for faster searches
- ✅ Bulk operations
- ✅ Advanced content extraction

### Option 3: Full Browser Server (Complete Automation)
```bash
# First install browser dependencies
npx playwright install
```

```json
{
  "mcpServers": {
    "browser-search": {
      "command": "node", 
      "args": ["/PATH/TO/mcp-browser-search/dist/index.js"]
    }
  }
}
```
- ✅ Handles JavaScript-heavy sites
- ✅ Full browser automation
- ⚠️ Requires more resources

---

## 🔍 Available Tools

Once connected, Claude can use these tools:

| Tool | Description | Example |
|------|-------------|---------|
| `search_web_fallback` | Search Google, Bing, DuckDuckGo | "Search for Python tutorials" |
| `visit_page_fallback` | Extract content from any webpage | "Summarize this article: https://..." |
| `search_news_fallback` | Find recent news articles | "Latest news about space exploration" |
| `bulk_search_fallback` | Search multiple queries at once | "Compare reviews of iPhone vs Android" |

---

## ✅ Verification Checklist

- [ ] Node.js 18+ installed
- [ ] Repository cloned and built successfully  
- [ ] Test command returns JSON with tools list
- [ ] Claude Desktop config file updated with correct path
- [ ] Claude Desktop restarted
- [ ] 🔌 icon appears in Claude Desktop
- [ ] Search commands work in Claude chat

---

## 🚨 Troubleshooting

### Problem: "Command not found" or "Path not found"
**Solution:** Make sure you're using the FULL absolute path in your config:
```bash
# Get full path (copy this output)
cd mcp-browser-search && pwd
```

### Problem: No 🔌 icon in Claude Desktop
**Solutions:**
1. Check your JSON syntax is valid (use jsonlint.com)
2. Restart Claude Desktop completely
3. Check the path is correct and file exists

### Problem: "Tool not found" errors
**Solution:** Use the fallback server tools:
- Use `search_web_fallback` instead of `search_web`
- Use `visit_page_fallback` instead of `visit_page`

### Problem: Search returns no results
**Solutions:**
1. Check internet connection
2. Try different search engine: "search using bing instead"
3. Try simpler search terms

### Problem: Browser installation fails
**Solution:** Use the fallback server - it doesn't need browsers:
```json
"args": ["/PATH/TO/mcp-browser-search/dist/servers/FallbackServer.js"]
```

---

## 🎉 You're Ready!

Your MCP Browser Search Server is now connected to Claude Desktop! 

**What you can do now:**
- 🔍 Search the web through Claude
- 📰 Get latest news and articles  
- 📄 Extract content from any webpage
- 🔗 Analyze websites and domains
- 📊 Perform bulk searches and analysis

**Example conversation starters:**
- "Search for the latest trends in AI development"
- "Find and summarize articles about renewable energy"  
- "Visit the OpenAI website and tell me about their latest models"
- "Compare search results for 'best programming languages 2024' across different engines"

---

## 📞 Need Help?

- **Check logs:** Look at Claude Desktop developer console
- **Test manually:** Use the echo commands from Step 2
- **Try fallback:** Switch to FallbackServer if having issues
- **Verify path:** Double-check your file paths are correct

Happy searching! 🚀