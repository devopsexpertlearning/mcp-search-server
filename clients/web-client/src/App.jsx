import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import SearchInterface from './components/SearchInterface';
import ChatInterface from './components/ChatInterface';
import ToolExplorer from './components/ToolExplorer';
import ServerStatus from './components/ServerStatus';
import Navigation from './components/Navigation';
import { MCPClientProvider } from './context/MCPContext';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('search');
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socketConnection = io(import.meta.env.VITE_API_URL || 'http://localhost:3001');
    
    socketConnection.on('connect', () => {
      console.log('Connected to MCP server');
      setConnected(true);
    });

    socketConnection.on('disconnect', () => {
      console.log('Disconnected from MCP server');
      setConnected(false);
    });

    socketConnection.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setConnected(false);
    });

    setSocket(socketConnection);

    return () => {
      socketConnection.close();
    };
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'search':
        return <SearchInterface />;
      case 'chat':
        return <ChatInterface />;
      case 'tools':
        return <ToolExplorer />;
      case 'status':
        return <ServerStatus />;
      default:
        return <SearchInterface />;
    }
  };

  return (
    <MCPClientProvider socket={socket}>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <h1 className="text-2xl font-bold text-gray-900">
                  MCP Browser Search
                </h1>
                <div className={`ml-4 px-2 py-1 rounded-full text-xs ${
                  connected 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {connected ? '● Connected' : '● Disconnected'}
                </div>
              </div>
              <div className="text-sm text-gray-500">
                Web Client v1.0.0
              </div>
            </div>
          </div>
        </header>

        {/* Navigation */}
        <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Main Content */}
        <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          {!connected ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">
                    Connection Issue
                  </h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p>
                      Unable to connect to MCP servers. Please ensure the servers are running and accessible.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          
          {renderContent()}
        </main>

        {/* Footer */}
        <footer className="bg-white border-t mt-12">
          <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
            <div className="text-center text-sm text-gray-500">
              <p>
                MCP Browser Search Client - Built with Model Context Protocol
              </p>
              <p className="mt-1">
                Supports Ollama AI, Enhanced Search, and Fallback modes
              </p>
            </div>
          </div>
        </footer>
      </div>
    </MCPClientProvider>
  );
}

export default App;