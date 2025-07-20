import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { ProjectService } from './services/ProjectService';
import { GitService } from './services/GitService';
import { ContextService } from './services/ContextService';
import { EnhancedContextService } from './services/EnhancedContextService';
import { FileService } from './services/FileService';
import { setupRoutes } from './routes';
import { setupEnhancedRoutes } from './routes/enhanced';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Configuration - Use dummy project as project root for testing
const PORT = process.env.PORT || 3001;
const PROJECT_ROOT = process.env.PROJECT_ROOT || path.join(process.cwd(), '..', '..', 'dummy-project');

console.log(`📂 Detected project root: ${PROJECT_ROOT}`);

// Middleware - Enhanced CORS for browser extensions and local files
app.use(cors({
  origin: true, // Allow all origins for development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Initialize services
const fileService = new FileService(PROJECT_ROOT);
const gitService = new GitService(PROJECT_ROOT);
const contextService = new ContextService(fileService, gitService);
const enhancedContextService = new EnhancedContextService(fileService, gitService);
const projectService = new ProjectService(fileService, gitService, contextService);

// Setup routes
setupRoutes(app, {
  fileService,
  gitService,
  contextService,
  projectService
});

// Setup enhanced routes with Continue.dev features
setupEnhancedRoutes(app, {
  fileService,
  gitService,
  enhancedContextService,
  projectService
});

// WebSocket handling
wss.on('connection', (ws) => {
  console.log('Client connected via WebSocket');
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('Received WebSocket message:', data.type);
      
      switch (data.type) {
        case 'GET_PROJECT_CONTEXT':
          const context = await contextService.getProjectContext(data.options);
          ws.send(JSON.stringify({ type: 'PROJECT_CONTEXT', data: context }));
          break;
        case 'WATCH_FILES':
          projectService.watchFiles((changes) => {
            ws.send(JSON.stringify({ type: 'FILE_CHANGES', data: changes }));
          });
          break;
        default:
          ws.send(JSON.stringify({ type: 'ERROR', error: 'Unknown message type' }));
      }
    } catch (error) {
      console.error('WebSocket error:', error);
      ws.send(JSON.stringify({ type: 'ERROR', error: 'Message processing failed' }));
    }
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('Health check requested from:', req.get('origin') || 'unknown');
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    project: PROJECT_ROOT,
    services: {
      file: 'active',
      git: 'active',
      context: 'active',
      enhancedContext: 'active'
    }
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 AI Coding Assistant Server running on port ${PORT}`);
  console.log(`📂 Project root: ${PROJECT_ROOT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`🔌 WebSocket available for real-time communication`);
});
