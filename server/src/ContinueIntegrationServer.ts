import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';

// Continue.dev imports
import { Core } from '../continue/core/core';
import { ConfigHandler } from '../continue/core/config/ConfigHandler';
import { CodebaseIndexer } from '../continue/core/indexing/CodebaseIndexer';
import { IMessenger } from '../continue/core/protocol';
import { IDE, ChatMessage, FromCoreProtocol, ToCoreProtocol } from '../core-types';

// Our custom adapters
import { BrowserIde } from './adapters/BrowserIde';
import { ChatGPTWebLLM, ClaudeWebLLM } from './llm/WebLLMProvider';

// Server implementation using Continue Core
export class ContinueIntegrationServer {
  private app: express.Application;
  private server: any;
  private wss: WebSocketServer;
  private core: Core;
  private ide: BrowserIde;
  private messenger: BrowserMessenger;
  
  constructor(private projectRoot: string, private port: number = 3001) {
    this.app = express();
    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });
    
    this.setupMiddleware();
    this.initializeContinueCore();
    this.setupRoutes();
  }

  private setupMiddleware() {
    // Enhanced CORS for browser extensions
    this.app.use(cors({
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
  }

  private async initializeContinueCore() {
    console.log(`📂 Initializing Continue Core with project root: ${this.projectRoot}`);
    
    // Create our custom IDE adapter
    this.ide = new BrowserIde(this.projectRoot);
    
    // Create messenger for protocol communication
    this.messenger = new BrowserMessenger();
    
    // Initialize Continue's Core
    this.core = new Core(
      this.ide,
      this.messenger,
      (error: Error) => console.error('Continue Core Error:', error),
      (message: string) => console.log('Continue Core Log:', message)
    );

    // Add our custom web LLM providers to Continue's config
    await this.registerWebLLMProviders();
    
    console.log('✅ Continue Core initialized successfully');
  }

  private async registerWebLLMProviders() {
    // Register our web LLM providers
    const configHandler = this.core.configHandler;
    
    // Add ChatGPT Web provider
    await configHandler.updateConfig((config) => {
      config.models = config.models || [];
      
      // Add ChatGPT Web if not already present
      if (!config.models.find(m => m.provider === "chatgpt-web")) {
        config.models.push({
          title: "ChatGPT Web",
          provider: "chatgpt-web",
          model: "gpt-4",
          apiKey: "web-interface", // Placeholder since we use web interface
          ...ChatGPTWebLLM.defaultOptions
        });
      }
      
      // Add Claude Web if not already present
      if (!config.models.find(m => m.provider === "claude-web")) {
        config.models.push({
          title: "Claude Web", 
          provider: "claude-web",
          model: "claude-3-5-sonnet-20241022",
          apiKey: "web-interface",
          ...ClaudeWebLLM.defaultOptions
        });
      }
      
      return config;
    });
  }

  private setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      console.log(`Health check requested from: ${req.get('origin') || 'unknown'}`);
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        continueCore: 'initialized',
        projectRoot: this.projectRoot
      });
    });

    // Continue protocol endpoint - main integration point
    this.app.post('/api/continue', async (req, res) => {
      try {
        const { messageType, data } = req.body;
        
        console.log(`Processing Continue message: ${messageType}`);
        
        // Route to Continue's core message handler
        const response = await this.core.handleMessage(messageType, data);
        
        res.json({ success: true, response });
      } catch (error) {
        console.error('Continue message error:', error);
        res.status(500).json({ 
          error: 'Failed to process Continue message',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Chat endpoint - uses Continue's chat system
    this.app.post('/api/chat', async (req, res) => {
      try {
        const { messages, modelTitle } = req.body;
        
        console.log(`Chat request with ${messages.length} messages using model: ${modelTitle}`);
        
        // Use Continue's chat functionality
        const result = await this.core.invoke("llm/streamChat", {
          messages,
          modelTitle
        });
        
        res.json({ success: true, result });
      } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ 
          error: 'Failed to process chat request',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Context endpoint - uses Continue's context providers
    this.app.post('/api/context', async (req, res) => {
      try {
        const { query, providers } = req.body;
        
        console.log(`Context request for query: "${query}" with providers: ${providers?.join(', ') || 'default'}`);
        
        // Use Continue's context system
        const contextItems = await this.core.invoke("context/getContextItems", {
          name: providers?.[0] || "codebase",
          query,
          fullInput: query
        });
        
        res.json({ success: true, contextItems });
      } catch (error) {
        console.error('Context error:', error);
        res.status(500).json({
          error: 'Failed to get context',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Edit endpoint - uses Continue's editing system
    this.app.post('/api/edit', async (req, res) => {
      try {
        const { filepath, edit } = req.body;
        
        console.log(`Edit request for file: ${filepath}`);
        
        // Use Continue's edit system
        const result = await this.core.invoke("edit/applyToFile", {
          filepath,
          edit
        });
        
        res.json({ success: true, result });
      } catch (error) {
        console.error('Edit error:', error);
        res.status(500).json({
          error: 'Failed to apply edit',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // File operations - delegate to Continue's IDE interface
    this.app.get('/api/files', async (req, res) => {
      try {
        const workspaceDirs = await this.ide.getWorkspaceDirs();
        res.json({ workspaceDirs });
      } catch (error) {
        console.error('Files API error:', error);
        res.status(500).json({ error: 'Failed to get files' });
      }
    });

    this.app.get('/api/file', async (req, res) => {
      try {
        const filePath = req.query.path as string;
        if (!filePath) {
          return res.status(400).json({ error: 'File path is required' });
        }
        
        const content = await this.ide.readFile(filePath);
        res.json({ content, path: filePath });
      } catch (error) {
        console.error('Read file error:', error);
        res.status(500).json({ error: 'Failed to read file' });
      }
    });

    this.app.post('/api/file', async (req, res) => {
      try {
        const { path: filePath, content } = req.body;
        if (!filePath || content === undefined) {
          return res.status(400).json({ error: 'File path and content are required' });
        }
        
        await this.ide.writeFile(filePath, content);
        res.json({ success: true, path: filePath });
      } catch (error) {
        console.error('Write file error:', error);
        res.status(500).json({ error: 'Failed to write file' });
      }
    });
  }

  public async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        console.log(`🚀 Continue Integration Server running on port ${this.port}`);
        console.log(`📂 Project root: ${this.projectRoot}`);
        console.log(`🔗 Health check: http://localhost:${this.port}/health`);
        console.log(`🔌 WebSocket available for real-time communication`);
        resolve();
      });
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        console.log('Continue Integration Server stopped');
        resolve();
      });
    });
  }
}

// Browser-specific messenger for Continue protocol
class BrowserMessenger implements IMessenger {
  private listeners: Map<string, Function[]> = new Map();

  send(messageType: keyof FromCoreProtocol, data: any): void {
    // In browser context, we'll send messages via WebSocket or HTTP
    console.log(`Sending message: ${messageType}`, data);
    
    // For now, just log - in full implementation would send to browser extension
    this.notifyListeners(messageType, data);
  }

  on(messageType: keyof ToCoreProtocol, handler: (data: any) => void): void {
    if (!this.listeners.has(messageType)) {
      this.listeners.set(messageType, []);
    }
    this.listeners.get(messageType)!.push(handler);
  }

  private notifyListeners(messageType: string, data: any): void {
    const handlers = this.listeners.get(messageType) || [];
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in message handler for ${messageType}:`, error);
      }
    });
  }
}