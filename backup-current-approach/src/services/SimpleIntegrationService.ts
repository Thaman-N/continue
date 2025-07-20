// Simplified integration service for browser extension with Continue features
import { ChatMessage } from '../core-types';
import { BrowserIde } from '../adapters/BrowserIde';
import { BrowserConfigHandler } from '../adapters/BrowserConfigHandler';
import { SimpleWebLLM, createClaudeWebLLM, createChatGPTWebLLM } from '../adapters/SimpleWebLLM';

// Simple logger for browser
class SimpleLLMLogger {
  createInteractionLog() {
    return {
      logItem: (item: any) => {
        console.log('[LLM Interaction]:', item);
      }
    };
  }
}

interface ContextItem {
  id: string;
  name: string;
  description?: string;
  content: string;
}

export class SimpleIntegrationService {
  private ide: BrowserIde;
  private configHandler: BrowserConfigHandler;
  private llmLogger: SimpleLLMLogger;
  private isInitialized = false;

  constructor(
    private projectRoot: string,
    private serverUrl: string = 'http://localhost:3001'
  ) {
    this.llmLogger = new SimpleLLMLogger();
    this.ide = new BrowserIde(projectRoot, serverUrl);
    this.configHandler = new BrowserConfigHandler(this.ide, this.llmLogger);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Wait for config to initialize
      await this.configHandler.isInitialized;
      
      this.isInitialized = true;
      console.log('[SimpleIntegrationService] Initialized successfully');
    } catch (error) {
      console.error('[SimpleIntegrationService] Error initializing:', error);
      throw error;
    }
  }

  // Context operations using our improved server
  async getContextItems(
    provider: string,
    query: string,
    maxItems: number = 10
  ): Promise<ContextItem[]> {
    if (!this.isInitialized) await this.initialize();

    try {
      const response = await fetch(`${this.serverUrl}/api/context/provider/${provider}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, maxItems })
      });

      if (!response.ok) {
        throw new Error(`Failed to get context from ${provider}`);
      }

      const result = await response.json();
      return result.items || [];
    } catch (error) {
      console.error(`Error getting context items from ${provider}:`, error);
      return [];
    }
  }

  // Enhanced context selection using our existing improved logic
  async intelligentContextSelection(
    query: string,
    maxItems: number = 10
  ): Promise<ContextItem[]> {
    if (!this.isInitialized) await this.initialize();

    try {
      const response = await fetch(`${this.serverUrl}/api/context/intelligent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, maxItems })
      });

      if (!response.ok) {
        throw new Error('Failed to get intelligent context selection');
      }

      const result = await response.json();
      return result.items || [];
    } catch (error) {
      console.error('Error with intelligent context selection:', error);
      return [];
    }
  }

  // LLM interaction using web interface
  async chatWithLLM(
    messages: ChatMessage[],
    model: string = 'claude'
  ): Promise<ChatMessage> {
    if (!this.isInitialized) await this.initialize();

    try {
      let llm: SimpleWebLLM;
      
      switch (model.toLowerCase()) {
        case 'claude':
          llm = createClaudeWebLLM();
          break;
        case 'gpt':
        case 'chatgpt':
          llm = createChatGPTWebLLM();
          break;
        default:
          llm = createClaudeWebLLM();
      }

      return await llm.chat(messages);
    } catch (error) {
      console.error('Error chatting with LLM:', error);
      throw error;
    }
  }

  // File operations using our improved server with Continue-style features
  async generateFileChanges(
    contextItems: ContextItem[],
    userMessage: string,
    model: string = 'claude'
  ): Promise<any> {
    if (!this.isInitialized) await this.initialize();

    try {
      // Format context for the LLM using our improved prompt
      const contextPrompt = this.formatContextForLLM(contextItems);
      
      // Create messages for the LLM with Continue-style system prompt
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: `You are an expert code assistant. When suggesting changes, always:

1. Include explicit filenames for each code block (e.g., "Update app.js:", "Create package.json:")
2. Use clear file references before code blocks
3. Minimize explanatory text - focus on actionable code
4. Structure responses for easy parsing and application
5. Provide precise, targeted changes rather than full file rewrites

When making changes:
- Use \`\`\`language\` code blocks with proper language specifiers
- Include the filename before each code block
- For existing files, provide only the lines that need changes
- For new files, provide complete file content

Context:
${contextPrompt}`
        },
        {
          role: 'user',
          content: userMessage
        }
      ];

      // Get response from LLM
      const response = await this.chatWithLLM(messages, model);
      
      // Process response using our improved server
      const processResponse = await fetch(`${this.serverUrl}/api/response/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extractedCode: [], // Will be extracted from fullResponse
          fullResponse: response.content,
          provider: model
        })
      });

      if (!processResponse.ok) {
        throw new Error('Failed to process response');
      }

      const result = await processResponse.json();
      
      return {
        response: response.content,
        fileChanges: result.fileChanges || [],
        extractedBlocks: result.extractedBlocks || 0,
        contextUsed: contextItems.length
      };
    } catch (error) {
      console.error('Error generating file changes:', error);
      throw error;
    }
  }

  private formatContextForLLM(contextItems: ContextItem[]): string {
    return contextItems.map(item => {
      return `### ${item.name}${item.description ? ` - ${item.description}` : ''}\n\`\`\`\n${item.content}\n\`\`\``;
    }).join('\n\n');
  }

  // Apply file changes using our server
  async applyFileChanges(fileChanges: any[]): Promise<{ success: boolean; results: any[] }> {
    if (!this.isInitialized) await this.initialize();

    try {
      const response = await fetch(`${this.serverUrl}/api/files/apply-changes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes: fileChanges })
      });

      if (!response.ok) {
        throw new Error('Failed to apply file changes');
      }

      return await response.json();
    } catch (error) {
      console.error('Error applying file changes:', error);
      return {
        success: false,
        results: []
      };
    }
  }

  // Configuration management
  async getConfig() {
    if (!this.isInitialized) await this.initialize();
    return this.configHandler.getConfig();
  }

  async updateConfig(newConfig: any): Promise<void> {
    if (!this.isInitialized) await this.initialize();
    await this.configHandler.updateConfig(newConfig);
  }

  // File operations through IDE adapter
  async readFile(path: string): Promise<string> {
    return this.ide.readFile(path);
  }

  async writeFile(path: string, content: string): Promise<void> {
    return this.ide.writeFile(path, content);
  }

  async fileExists(path: string): Promise<boolean> {
    return this.ide.fileExists(path);
  }

  async listDirectory(path: string): Promise<[string, any][]> {
    return this.ide.listDir(path);
  }

  // Git operations
  async getGitDiff(includeUnstaged: boolean = true): Promise<string[]> {
    return this.ide.getDiff(includeUnstaged);
  }

  async getGitBranch(): Promise<string> {
    const workspaceDirs = await this.ide.getWorkspaceDirs();
    if (workspaceDirs.length > 0) {
      return this.ide.getBranch(workspaceDirs[0]);
    }
    return 'main';
  }

  // Health check
  async healthCheck(): Promise<{ status: string; details: any }> {
    const details: any = {
      initialized: this.isInitialized,
      projectRoot: this.projectRoot,
      serverUrl: this.serverUrl
    };

    try {
      // Test server connection
      const response = await fetch(`${this.serverUrl}/health`);
      if (response.ok) {
        const serverHealth = await response.json();
        details.server = serverHealth;
      } else {
        details.server = { status: 'error', message: 'Server unreachable' };
      }

      // Test IDE connection
      const workspaceDirs = await this.ide.getWorkspaceDirs();
      details.workspaceDirs = workspaceDirs;
      details.ideConnection = 'active';

      return {
        status: this.isInitialized && details.server?.status === 'ok' ? 'healthy' : 'degraded',
        details
      };
    } catch (error) {
      return {
        status: 'error',
        details: {
          ...details,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  // Cleanup
  dispose(): void {
    this.configHandler.dispose();
    this.isInitialized = false;
  }
}