import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';

// Our services
import { FileService } from './services/FileService';
import { GitService } from './services/GitService';

// Continue algorithm integration
import { BrowserContinueBridge } from '../../src/continue-algorithms/BrowserContinueBridge';
import { ContextProviderExtras } from '../../src/continue-algorithms/ContextProviders';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Configuration
const PORT = process.env.PORT || 3001;
const PROJECT_ROOT = process.env.PROJECT_ROOT || path.join(process.cwd(), '..', '..', 'dummy-project');

console.log(`📂 Detected project root: ${PROJECT_ROOT}`);

// Initialize services
const fileService = new FileService(PROJECT_ROOT);
const gitService = new GitService(PROJECT_ROOT);

// Initialize Continue bridge
const continueBridge = new BrowserContinueBridge(fileService, PROJECT_ROOT);

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoints (multiple routes for compatibility)
app.get('/health', (req, res) => {
  console.log(`Health check requested from: ${req.get('origin') || 'unknown'}`);
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    system: 'Continue-powered AI Coding Assistant',
    projectRoot: PROJECT_ROOT
  });
});

app.get('/api/context/health', (req, res) => {
  console.log(`Context health check requested from: ${req.get('origin') || 'unknown'}`);
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    system: 'Continue-powered Context API',
    projectRoot: PROJECT_ROOT
  });
});

// Main endpoint - Process LLM responses using Continue's intelligence
app.post('/api/response/process', async (req, res) => {
  try {
    const { extractedCode, fullResponse, provider } = req.body;
    
    console.log(`🧠 Processing response from ${provider} with ${extractedCode?.length || 0} code blocks using Continue algorithms`);
    
    // Use Continue's intelligent response analysis
    const result = await continueBridge.processLLMResponse(
      {
        content: fullResponse,
        extractedCode: extractedCode || [],
        fullResponse
      },
      fullResponse
    );
    
    console.log(`✅ Continue analysis: ${result.analysis.actionableBlocks} actionable, ${result.analysis.examples} examples, ${result.analysis.explanations} explanations`);
    
    res.json({ 
      fileChanges: result.fileChanges,
      extractedBlocks: extractedCode?.length || 0,
      actualChanges: result.fileChanges.length,
      provider,
      success: true,
      analysis: result.analysis,
      system: 'Continue-powered'
    });
  } catch (error) {
    console.error('Continue response processing error:', error);
    res.status(500).json({ error: 'Failed to process response with Continue algorithms' });
  }
});

// Apply file changes using Continue's precise editing
app.post('/api/files/apply-changes', async (req, res) => {
  try {
    const { changes } = req.body;
    
    console.log(`🔧 Applying ${changes.length} file changes using Continue's editing algorithms...`);
    
    const results = [];
    
    for (const change of changes) {
      try {
        const editRequest = {
          filepath: change.path,
          userInput: change.content,
          selectedRange: change.targetRange,
          context: [] // Context could be added here
        };
        
        const result = await continueBridge.applyFileEdit(editRequest);
        
        results.push({
          path: change.path,
          success: result.success,
          message: result.message,
          confidence: result.confidence,
          reasoning: result.reasoning,
          diff: result.diff
        });
        
        if (result.success) {
          console.log(`✅ ${result.message}`);
        } else {
          console.log(`❌ ${result.message}`);
        }
        
      } catch (error) {
        console.error(`Failed to apply change to ${change.path}:`, error);
        results.push({
          path: change.path,
          success: false,
          message: `Failed to apply changes: ${error instanceof Error ? error.message : 'Unknown error'}`,
          confidence: 0,
          reasoning: ['Error during Continue edit application']
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    
    res.json({ 
      success: successCount > 0, 
      results,
      summary: `Applied ${successCount}/${changes.length} changes using Continue algorithms`,
      system: 'Continue-powered'
    });
  } catch (error) {
    console.error('Continue apply changes error:', error);
    res.status(500).json({ error: 'Failed to apply changes using Continue algorithms' });
  }
});

// Legacy context endpoint (for browser extension compatibility)
app.post('/api/context/intelligent', async (req, res) => {
  try {
    const { query, maxItems } = req.body;
    
    console.log(`🎯 Getting intelligent context (legacy endpoint) for query: "${query}"`);
    console.log(`📂 Project root being searched: ${PROJECT_ROOT}`);
    
    const extras: ContextProviderExtras = {
      fileService,
      projectRoot: PROJECT_ROOT,
      llmInput: query || '',
    };
    
    // Use Continue's smart context selection
    console.log(`🔄 About to call continueBridge.getSmartContext...`);
    let contextItems: any[] = [];
    try {
      contextItems = await continueBridge.getSmartContext(query || '', extras);
      console.log(`✅ continueBridge.getSmartContext returned successfully`);
    } catch (error) {
      console.error(`❌ Error in continueBridge.getSmartContext:`, error);
      contextItems = [];
    }
    
    // Format response to match legacy browser extension expectations
    const formattedItems = contextItems.map((item, index) => ({
      id: `context${index + 1}`,
      name: item.name,
      description: item.description,
      content: item.content
    }));
    
    console.log(`✅ Retrieved ${contextItems.length} intelligent context items using Continue algorithms`);
    console.log(`📄 Item names: ${formattedItems.map(item => item.name).join(', ')}`);
    
    res.json({
      items: formattedItems.slice(0, maxItems || 10),
      query: query || '',
      system: 'Continue-powered'
    });
  } catch (error) {
    console.error('Intelligent context error:', error);
    res.status(500).json({ error: 'Failed to get intelligent context using Continue algorithms' });
  }
});

// Context endpoint using Continue's context providers
app.post('/api/context/smart', async (req, res) => {
  try {
    const { query, provider, selectedFile } = req.body;
    
    console.log(`🎯 Getting smart context using Continue providers for query: "${query}"`);
    
    const extras: ContextProviderExtras = {
      fileService,
      projectRoot: PROJECT_ROOT,
      llmInput: query,
      selectedCode: selectedFile ? {
        content: await fileService.readFile(selectedFile),
        filepath: selectedFile
      } : undefined
    };
    
    let contextItems;
    
    if (provider) {
      // Use specific provider
      contextItems = await continueBridge.getContextFromProvider(provider, query, extras);
    } else {
      // Use intelligent context selection
      contextItems = await continueBridge.getSmartContext(query, extras);
    }
    
    console.log(`✅ Retrieved ${contextItems.length} context items using Continue providers`);
    
    res.json({
      success: true,
      contextItems,
      provider: provider || 'smart',
      system: 'Continue-powered'
    });
  } catch (error) {
    console.error('Continue context error:', error);
    res.status(500).json({ error: 'Failed to get context using Continue providers' });
  }
});

// Legacy compatibility endpoint
app.post('/api/files/apply', async (req, res) => {
  try {
    const { fileChanges } = req.body;
    
    console.log(`🔄 Legacy endpoint - redirecting ${fileChanges.length} changes to Continue system...`);
    
    // Convert legacy format to Continue format
    const continueChanges = fileChanges.map((change: any) => ({
      path: change.filepath || change.path, // Handle both property names
      content: change.userInput || change.content, // Handle both property names
      type: change.type || 'update',
      confidence: change.confidence || 80,
      reasoning: change.reasoning || []
    }));
    
    // Forward to Continue-powered endpoint
    const continueResponse = await fetch('http://localhost:3001/api/files/apply-changes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ changes: continueChanges })
    });
    
    const result = await continueResponse.json();
    
    // Convert back to legacy format for compatibility
    res.json({
      totalChanges: fileChanges.length,
      successful: result.results.filter((r: any) => r.success).length,
      failed: result.results.filter((r: any) => !r.success).length,
      results: result.results.map((r: any) => ({
        success: r.success,
        filePath: r.path,
        message: r.message,
        confidence: r.confidence
      })),
      backupDirectory: path.join(PROJECT_ROOT, '.ai-assistant-backups'),
      system: 'Continue-powered (legacy compatibility)'
    });
  } catch (error) {
    console.error('Legacy compatibility error:', error);
    res.status(500).json({ error: 'Failed to apply file changes (legacy compatibility)' });
  }
});

// File operations (basic - for compatibility)
app.get('/api/files', async (req, res) => {
  try {
    const workspaceDirs = [PROJECT_ROOT];
    res.json({ workspaceDirs, system: 'Continue-powered' });
  } catch (error) {
    console.error('Files API error:', error);
    res.status(500).json({ error: 'Failed to get files' });
  }
});

app.get('/api/file', async (req, res) => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }
    const content = await fileService.readFile(filePath);
    res.json({ content, path: filePath, system: 'Continue-powered' });
  } catch (error) {
    console.error('Read file error:', error);
    res.status(500).json({ error: 'Failed to read file' });
  }
});

app.post('/api/file', async (req, res) => {
  try {
    const { path: filePath, content } = req.body;
    if (!filePath || content === undefined) {
      return res.status(400).json({ error: 'File path and content are required' });
    }
    await fileService.writeFile(filePath, content);
    res.json({ success: true, path: filePath, system: 'Continue-powered' });
  } catch (error) {
    console.error('Write file error:', error);
    res.status(500).json({ error: 'Failed to write file' });
  }
});

// Bridge endpoint for Continue.dev web LLM providers
app.post('/api/web-llm/chat', async (req, res) => {
  try {
    const { provider, messages, timestamp } = req.body;
    
    console.log(`🌐 Continue.dev → Browser Bridge: ${provider} chat request`);
    
    // Forward to browser extension content script
    // This would need to be implemented with WebSocket or similar for real-time communication
    // For now, return a mock response to demonstrate the architecture
    
    const mockResponse = {
      content: `Mock response from ${provider} web interface via Continue.dev integration`,
      fullResponse: `This is a demonstration of Continue.dev → Browser Extension → ${provider} → Browser Extension → Continue.dev communication flow.`,
      extractedCode: [],
      timestamp: Date.now()
    };
    
    console.log(`✅ Continue.dev ← Browser Bridge: Response sent`);
    
    res.json(mockResponse);
  } catch (error) {
    console.error('Web LLM bridge error:', error);
    res.status(500).json({ 
      error: 'Failed to bridge to web LLM',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Prompt formatting endpoint (for browser extension context insertion)
app.post('/api/prompt/format', async (req, res) => {
  try {
    const { message, contextItems, options, systemPrompt } = req.body;
    
    console.log(`🎨 Formatting prompt with ${contextItems?.length || 0} context items`);
    
    // Build formatted prompt with context
    let formattedPrompt = message || 'Please help me with this code:';
    
    if (contextItems && contextItems.length > 0) {
      formattedPrompt += '\n\n**Context:**\n\n';
      
      contextItems.forEach((item: any, index: number) => {
        formattedPrompt += `**${item.name}** (${item.description}):\n`;
        formattedPrompt += `${item.content}\n\n`;
      });
    }
    
    console.log(`✅ Formatted prompt ready (${formattedPrompt.length} characters)`);
    
    res.json({
      success: true,
      formattedPrompt,
      contextCount: contextItems?.length || 0,
      system: 'Continue-powered'
    });
  } catch (error) {
    console.error('Prompt formatting error:', error);
    res.status(500).json({ error: 'Failed to format prompt' });
  }
});

// Git operations
app.get('/api/git/status', async (req, res) => {
  try {
    const status = await gitService.getStatus();
    res.json({ ...status, system: 'Continue-powered' });
  } catch (error) {
    console.error('Git status error:', error);
    res.status(500).json({ error: 'Failed to get git status' });
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Continue-Powered AI Coding Assistant Server running on port ${PORT}`);
  console.log(`📂 Project root: ${PROJECT_ROOT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`🧠 Powered by Continue.dev algorithms`);
  console.log(`🌟 Features: Precise editing, Smart context, Intelligent analysis`);
});