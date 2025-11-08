/**
 * Electron Main Process for MCP Browser Search Desktop Client
 */

import { app, BrowserWindow, ipcMain, Menu, shell, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import Store from 'electron-store';
import log from 'log4js';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure logging
log.configure({
  appenders: {
    file: { type: 'file', filename: 'mcp-desktop.log' },
    console: { type: 'console' }
  },
  categories: {
    default: { appenders: ['file', 'console'], level: 'info' }
  }
});

const logger = log.getLogger();

// Store for app settings
const store = new Store({
  defaults: {
    windowBounds: { width: 1200, height: 800 },
    servers: {
      ollama: {
        command: 'node',
        args: ['../../../dist/servers/OllamaServer.js'],
        env: {
          NODE_ENV: 'production',
          OLLAMA_BASE_URL: 'http://localhost:11434',
          OLLAMA_DEFAULT_MODEL: 'llama2'
        }
      },
      enhanced: {
        command: 'node',
        args: ['../../../dist/servers/EnhancedServer.js'],
        env: { NODE_ENV: 'production' }
      },
      fallback: {
        command: 'node',
        args: ['../../../dist/servers/FallbackServer.js'],
        env: { NODE_ENV: 'production' }
      }
    },
    preferences: {
      theme: 'system',
      defaultServer: 'enhanced',
      autoUpdate: true,
      notifications: true
    }
  }
});

class MCPDesktopClient {
  private clients: Map<string, Client> = new Map();
  private mainWindow: BrowserWindow | null = null;

  constructor() {
    this.setupApp();
    this.setupIPC();
    this.setupAutoUpdater();
  }

  private setupApp() {
    // Set app user model id for Windows
    if (process.platform === 'win32') {
      app.setAppUserModelId('com.mcp.browser-search');
    }

    // Handle app ready
    app.whenReady().then(() => {
      this.createMainWindow();
      this.setupMenu();
      
      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          this.createMainWindow();
        }
      });
    });

    // Handle all windows closed
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    // Handle before quit
    app.on('before-quit', async () => {
      await this.cleanup();
    });
  }

  private createMainWindow() {
    const bounds = store.get('windowBounds') as any;

    this.mainWindow = new BrowserWindow({
      ...bounds,
      minWidth: 800,
      minHeight: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, 'preload.js')
      },
      icon: path.join(__dirname, '../assets/icon.png'),
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      show: false
    });

    // Load the React app
    if (process.env.NODE_ENV === 'development') {
      this.mainWindow.loadURL('http://localhost:3000');
      this.mainWindow.webContents.openDevTools();
    } else {
      this.mainWindow.loadFile(path.join(__dirname, '../renderer/build/index.html'));
    }

    // Show window when ready
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
    });

    // Save window bounds on close
    this.mainWindow.on('close', () => {
      if (this.mainWindow) {
        store.set('windowBounds', this.mainWindow.getBounds());
      }
    });

    // Handle external links
    this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });

    logger.info('Main window created');
  }

  private setupMenu() {
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: 'File',
        submenu: [
          {
            label: 'New Search',
            accelerator: 'CmdOrCtrl+N',
            click: () => {
              this.mainWindow?.webContents.send('menu-new-search');
            }
          },
          {
            label: 'New Chat',
            accelerator: 'CmdOrCtrl+Shift+N',
            click: () => {
              this.mainWindow?.webContents.send('menu-new-chat');
            }
          },
          { type: 'separator' },
          {
            label: 'Preferences',
            accelerator: process.platform === 'darwin' ? 'Cmd+,' : 'Ctrl+,',
            click: () => {
              this.mainWindow?.webContents.send('menu-preferences');
            }
          },
          { type: 'separator' },
          { role: 'quit' }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' }
        ]
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' }
        ]
      },
      {
        label: 'Servers',
        submenu: [
          {
            label: 'Connect to Ollama',
            click: () => {
              this.connectToServer('ollama');
            }
          },
          {
            label: 'Connect to Enhanced',
            click: () => {
              this.connectToServer('enhanced');
            }
          },
          {
            label: 'Connect to Fallback',
            click: () => {
              this.connectToServer('fallback');
            }
          },
          { type: 'separator' },
          {
            label: 'Server Status',
            click: () => {
              this.mainWindow?.webContents.send('menu-server-status');
            }
          }
        ]
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'About',
            click: () => {
              dialog.showMessageBox(this.mainWindow!, {
                type: 'info',
                title: 'About MCP Browser Search',
                message: 'MCP Browser Search Desktop Client',
                detail: 'A desktop application for web search with AI-powered answers using the Model Context Protocol and Ollama integration.'
              });
            }
          },
          {
            label: 'Documentation',
            click: () => {
              shell.openExternal('https://github.com/yourusername/mcp-browser-search');
            }
          }
        ]
      }
    ];

    if (process.platform === 'darwin') {
      template.unshift({
        label: app.getName(),
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      });
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  private setupIPC() {
    // Connect to MCP server
    ipcMain.handle('connect-server', async (event, serverType: string) => {
      return await this.connectToServer(serverType);
    });

    // Call MCP tool
    ipcMain.handle('call-tool', async (event, serverType: string, toolName: string, args: any) => {
      return await this.callTool(serverType, toolName, args);
    });

    // List available tools
    ipcMain.handle('list-tools', async (event, serverType: string) => {
      return await this.listTools(serverType);
    });

    // Get server status
    ipcMain.handle('get-server-status', async (event) => {
      return await this.getServerStatus();
    });

    // Get/set preferences
    ipcMain.handle('get-preferences', () => {
      return store.get('preferences');
    });

    ipcMain.handle('set-preferences', (event, preferences: any) => {
      store.set('preferences', preferences);
      return true;
    });

    // Get/set server configurations
    ipcMain.handle('get-servers', () => {
      return store.get('servers');
    });

    ipcMain.handle('set-servers', (event, servers: any) => {
      store.set('servers', servers);
      return true;
    });

    // Export/import settings
    ipcMain.handle('export-settings', async () => {
      const result = await dialog.showSaveDialog(this.mainWindow!, {
        defaultPath: 'mcp-settings.json',
        filters: [{ name: 'JSON Files', extensions: ['json'] }]
      });

      if (!result.canceled && result.filePath) {
        const settings = {
          servers: store.get('servers'),
          preferences: store.get('preferences')
        };
        require('fs').writeFileSync(result.filePath, JSON.stringify(settings, null, 2));
        return true;
      }
      return false;
    });

    ipcMain.handle('import-settings', async () => {
      const result = await dialog.showOpenDialog(this.mainWindow!, {
        filters: [{ name: 'JSON Files', extensions: ['json'] }],
        properties: ['openFile']
      });

      if (!result.canceled && result.filePaths.length > 0) {
        try {
          const settings = JSON.parse(require('fs').readFileSync(result.filePaths[0], 'utf-8'));
          if (settings.servers) store.set('servers', settings.servers);
          if (settings.preferences) store.set('preferences', settings.preferences);
          return true;
        } catch (error) {
          logger.error('Failed to import settings:', error);
          return false;
        }
      }
      return false;
    });
  }

  private setupAutoUpdater() {
    if (store.get('preferences.autoUpdate')) {
      autoUpdater.checkForUpdatesAndNotify();
    }

    autoUpdater.on('update-available', () => {
      dialog.showMessageBox(this.mainWindow!, {
        type: 'info',
        title: 'Update Available',
        message: 'A new version is available. It will be downloaded in the background.',
        buttons: ['OK']
      });
    });

    autoUpdater.on('update-downloaded', () => {
      dialog.showMessageBox(this.mainWindow!, {
        type: 'info',
        title: 'Update Ready',
        message: 'Update downloaded. The application will restart to apply the update.',
        buttons: ['Restart Now', 'Later']
      }).then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
    });
  }

  private async connectToServer(serverType: string): Promise<boolean> {
    if (this.clients.has(serverType)) {
      return true;
    }

    const servers = store.get('servers') as any;
    const serverConfig = servers[serverType];

    if (!serverConfig) {
      logger.error(`Server configuration not found: ${serverType}`);
      return false;
    }

    try {
      const transport = new StdioClientTransport({
        command: serverConfig.command,
        args: serverConfig.args,
        env: { ...process.env, ...serverConfig.env }
      });

      const client = new Client(
        {
          name: 'mcp-desktop-client',
          version: '1.0.0'
        },
        {
          capabilities: {
            tools: {},
            resources: {}
          }
        }
      );

      await client.connect(transport);
      this.clients.set(serverType, client);

      logger.info(`Connected to ${serverType} server`);
      return true;

    } catch (error) {
      logger.error(`Failed to connect to ${serverType} server:`, error);
      return false;
    }
  }

  private async callTool(serverType: string, toolName: string, args: any): Promise<any> {
    const client = this.clients.get(serverType);
    if (!client) {
      const connected = await this.connectToServer(serverType);
      if (!connected) {
        throw new Error(`Failed to connect to ${serverType} server`);
      }
    }

    const connectedClient = this.clients.get(serverType)!;

    try {
      const result = await connectedClient.request({
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        }
      });

      logger.info(`Tool ${toolName} called successfully on ${serverType}`);
      return result;

    } catch (error) {
      logger.error(`Tool call failed for ${toolName} on ${serverType}:`, error);
      throw error;
    }
  }

  private async listTools(serverType: string): Promise<any[]> {
    const client = this.clients.get(serverType);
    if (!client) {
      const connected = await this.connectToServer(serverType);
      if (!connected) {
        throw new Error(`Failed to connect to ${serverType} server`);
      }
    }

    const connectedClient = this.clients.get(serverType)!;

    try {
      const result = await connectedClient.request({
        method: 'tools/list'
      });

      return result.tools || [];

    } catch (error) {
      logger.error(`Failed to list tools for ${serverType}:`, error);
      throw error;
    }
  }

  private async getServerStatus(): Promise<any> {
    const servers = store.get('servers') as any;
    const status: any = {};

    for (const serverType of Object.keys(servers)) {
      try {
        const connected = this.clients.has(serverType) || await this.connectToServer(serverType);
        status[serverType] = {
          connected,
          error: connected ? null : 'Failed to connect'
        };
      } catch (error) {
        status[serverType] = {
          connected: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    return status;
  }

  private async cleanup(): Promise<void> {
    logger.info('Cleaning up MCP clients...');
    
    for (const [serverType, client] of this.clients) {
      try {
        await client.close();
        logger.info(`Disconnected from ${serverType} server`);
      } catch (error) {
        logger.error(`Error disconnecting from ${serverType}:`, error);
      }
    }
    
    this.clients.clear();
  }
}

// Initialize the desktop client
new MCPDesktopClient();

export {};