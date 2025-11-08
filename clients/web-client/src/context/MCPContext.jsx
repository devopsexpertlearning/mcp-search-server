import React, { createContext, useContext, useState, useCallback } from 'react';

const MCPContext = createContext();

export const useMCP = () => {
  const context = useContext(MCPContext);
  if (!context) {
    throw new Error('useMCP must be used within a MCPClientProvider');
  }
  return context;
};

export const MCPClientProvider = ({ children, socket }) => {
  const [loading, setLoading] = useState(false);
  const [servers, setServers] = useState([]);
  const [tools, setTools] = useState({});

  // Call tool via WebSocket
  const callTool = useCallback(async (serverType, toolName, args) => {
    if (!socket) {
      throw new Error('Socket not connected');
    }

    return new Promise((resolve, reject) => {
      const requestId = Date.now().toString();
      setLoading(true);

      const timeout = setTimeout(() => {
        setLoading(false);
        reject(new Error('Request timeout'));
      }, 60000); // 60 second timeout

      const handleResult = (data) => {
        if (data.requestId === requestId) {
          clearTimeout(timeout);
          setLoading(false);
          socket.off('tool_result', handleResult);
          
          if (data.success) {
            resolve(data.result);
          } else {
            reject(new Error(data.error));
          }
        }
      };

      socket.on('tool_result', handleResult);
      socket.emit('call_tool', {
        serverType,
        toolName,
        args,
        requestId
      });
    });
  }, [socket]);

  // Call tool via HTTP API (fallback)
  const callToolHTTP = useCallback(async (serverType, toolName, args) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/servers/${serverType}/tools/${toolName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(args),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Request failed');
      }

      const result = await response.json();
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get server status
  const getServerStatus = useCallback(async () => {
    if (!socket) {
      // Fallback to HTTP
      try {
        const response = await fetch('/api/servers');
        const data = await response.json();
        setServers(data.servers);
        return data.servers;
      } catch (error) {
        console.error('Failed to get server status via HTTP:', error);
        return [];
      }
    }

    return new Promise((resolve, reject) => {
      const requestId = Date.now().toString();

      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 10000);

      const handleStatus = (data) => {
        if (data.requestId === requestId) {
          clearTimeout(timeout);
          socket.off('server_status', handleStatus);
          
          if (data.success) {
            setServers(data.servers);
            resolve(data.servers);
          } else {
            reject(new Error(data.error));
          }
        }
      };

      socket.on('server_status', handleStatus);
      socket.emit('get_server_status', { requestId });
    });
  }, [socket]);

  // Get available tools for a server
  const getTools = useCallback(async (serverType) => {
    if (!socket) {
      // Fallback to HTTP
      try {
        const response = await fetch(`/api/servers/${serverType}/tools`);
        const data = await response.json();
        
        setTools(prev => ({
          ...prev,
          [serverType]: data.tools
        }));
        
        return data.tools;
      } catch (error) {
        console.error(`Failed to get tools for ${serverType} via HTTP:`, error);
        return [];
      }
    }

    return new Promise((resolve, reject) => {
      const requestId = Date.now().toString();

      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 10000);

      const handleToolsList = (data) => {
        if (data.requestId === requestId) {
          clearTimeout(timeout);
          socket.off('tools_list', handleToolsList);
          
          if (data.success) {
            setTools(prev => ({
              ...prev,
              [serverType]: data.tools
            }));
            resolve(data.tools);
          } else {
            reject(new Error(data.error));
          }
        }
      };

      socket.on('tools_list', handleToolsList);
      socket.emit('list_tools', { serverType, requestId });
    });
  }, [socket]);

  // Search with AI answer (convenience method)
  const searchWithAI = useCallback(async (query, options = {}) => {
    const {
      serverType = 'ollama',
      engine = 'duckduckgo',
      maxResults = 5,
      model = 'llama2'
    } = options;

    return await callTool(serverType, 'search_and_answer', {
      query,
      engine,
      max_results: maxResults,
      model
    });
  }, [callTool]);

  // Chat with search context (convenience method)
  const chatWithSearch = useCallback(async (messages, options = {}) => {
    const {
      serverType = 'ollama',
      model = 'llama2',
      autoSearch = true
    } = options;

    return await callTool(serverType, 'chat_with_search', {
      messages,
      model,
      auto_search: autoSearch
    });
  }, [callTool]);

  // Extract content from URL (convenience method)
  const extractContent = useCallback(async (url, options = {}) => {
    const {
      serverType = 'enhanced',
      extractLinks = false,
      extractImages = false,
      extractMetadata = true
    } = options;

    return await callTool(serverType, 'extract_content', {
      url,
      extract_links: extractLinks,
      extract_images: extractImages,
      extract_metadata: extractMetadata
    });
  }, [callTool]);

  // Get Ollama models (convenience method)
  const getOllamaModels = useCallback(async () => {
    return await callTool('ollama', 'ollama_models', {});
  }, [callTool]);

  // Check Ollama health (convenience method)
  const checkOllamaHealth = useCallback(async () => {
    return await callTool('ollama', 'ollama_health', {});
  }, [callTool]);

  const value = {
    // Core methods
    callTool: socket ? callTool : callToolHTTP,
    getServerStatus,
    getTools,
    
    // Convenience methods
    searchWithAI,
    chatWithSearch,
    extractContent,
    getOllamaModels,
    checkOllamaHealth,
    
    // State
    loading,
    servers,
    tools,
    connected: !!socket?.connected
  };

  return (
    <MCPContext.Provider value={value}>
      {children}
    </MCPContext.Provider>
  );
};