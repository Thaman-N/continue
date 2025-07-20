"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = require("http");
const ws_1 = require("ws");
const ProjectService_1 = require("./services/ProjectService");
const GitService_1 = require("./services/GitService");
const ContextService_1 = require("./services/ContextService");
const EnhancedContextService_1 = require("./services/EnhancedContextService");
const FileService_1 = require("./services/FileService");
const routes_1 = require("./routes");
const enhanced_1 = require("./routes/enhanced");
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const wss = new ws_1.WebSocketServer({ server });
// Configuration - Use current working directory as project root
const PORT = process.env.PORT || 3001;
const PROJECT_ROOT = process.env.PROJECT_ROOT || process.cwd();
console.log(`📂 Detected project root: ${PROJECT_ROOT}`);
// Middleware - Enhanced CORS for browser extensions and local files
app.use((0, cors_1.default)({
    origin: true, // Allow all origins for development
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
// Initialize services
const fileService = new FileService_1.FileService(PROJECT_ROOT);
const gitService = new GitService_1.GitService(PROJECT_ROOT);
const contextService = new ContextService_1.ContextService(fileService, gitService);
const enhancedContextService = new EnhancedContextService_1.EnhancedContextService(fileService, gitService);
const projectService = new ProjectService_1.ProjectService(fileService, gitService, contextService);
// Setup routes
(0, routes_1.setupRoutes)(app, {
    fileService,
    gitService,
    contextService,
    projectService
});
// Setup enhanced routes with Continue.dev features
(0, enhanced_1.setupEnhancedRoutes)(app, {
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
        }
        catch (error) {
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
//# sourceMappingURL=index.js.map