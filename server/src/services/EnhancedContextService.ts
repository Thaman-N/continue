// Enhanced Context Service integrating Continue.dev context providers
import { FileService, FileInfo } from './FileService';
import { GitService, GitStatus } from './GitService';
import { contextProviderRegistry } from '../context/ContextProviderRegistry';
import { ContextItem, ContextProviderExtras } from '../context/types';
import PromptFormatter, { ChatMessage, PromptFormatterOptions } from '../context/utils/promptFormatter';
import path from 'path';

// Extended interfaces for enhanced context
export interface EnhancedProjectContext {
  summary: string;
  files: ContextFile[];
  gitStatus: GitStatus;
  recentChanges: string[];
  projectStructure: string;
  contextItems: ContextItem[];
  formattedPrompt?: string;
}

export interface ContextFile {
  path: string;
  content: string;
  language: string;
  relevanceScore: number;
}

export interface EnhancedContextOptions {
  includeGitStatus?: boolean;
  maxFiles?: number;
  fileExtensions?: string[];
  excludePatterns?: string[];
  // New options for enhanced context
  provider?: string;
  query?: string;
  includeRepoMap?: boolean;
  promptFormatting?: PromptFormatterOptions;
  systemPrompt?: string;
}

export class EnhancedContextService {
  private promptFormatter: PromptFormatter;

  constructor(
    private fileService: FileService,
    private gitService: GitService
  ) {
    this.promptFormatter = new PromptFormatter();
  }

  async getEnhancedContext(options: EnhancedContextOptions = {}): Promise<EnhancedProjectContext> {
    const {
      includeGitStatus = true,
      maxFiles = 20,
      fileExtensions = [],
      excludePatterns = [],
      provider = 'codebase',
      query = '',
      includeRepoMap = false,
      promptFormatting,
      systemPrompt
    } = options;

    // Get basic project context (keep existing functionality)
    const basicContext = await this.getBasicProjectContext({
      includeGitStatus,
      maxFiles,
      fileExtensions,
      excludePatterns
    });

    // Get enhanced context using Continue.dev providers
    const contextItems = await this.getContextItems(provider, query);

    // Add repository map if requested
    if (includeRepoMap) {
      const repoMapItems = await this.getContextItems('repo-map', 'entire-codebase');
      contextItems.push(...repoMapItems);
    }

    // Format prompt if requested
    let formattedPrompt: string | undefined;
    if (query && promptFormatting) {
      formattedPrompt = await this.formatPrompt(query, contextItems, promptFormatting, systemPrompt);
    }

    return {
      ...basicContext,
      contextItems,
      formattedPrompt
    };
  }

  async getContextItems(provider: string, query: string): Promise<ContextItem[]> {
    try {
      const contextProvider = contextProviderRegistry.getProvider(provider);
      if (!contextProvider) {
        console.warn(`Context provider '${provider}' not found`);
        return [];
      }

      const workspaceDirs = await this.getWorkspaceDirs();
      const extras: ContextProviderExtras = {
        config: {},
        fullInput: query,
        selectedCode: [],
        workspaceDirs
      };

      return await contextProvider.getContextItems(query, extras);
    } catch (error) {
      console.error(`Failed to get context items for provider '${provider}':`, error);
      return [];
    }
  }

  async getAvailableProviders() {
    return contextProviderRegistry.getAllProviderDescriptions();
  }

  async getSubmenuItems(provider: string): Promise<any[]> {
    try {
      const contextProvider = contextProviderRegistry.getProvider(provider);
      if (!contextProvider || !contextProvider.loadSubmenuItems) {
        return [];
      }

      const workspaceDirs = await this.getWorkspaceDirs();
      return await contextProvider.loadSubmenuItems({ workspaceDirs });
    } catch (error) {
      console.error(`Failed to get submenu items for provider '${provider}':`, error);
      return [];
    }
  }

  async formatPrompt(
    userMessage: string,
    contextItems: ContextItem[],
    options: PromptFormatterOptions,
    systemPrompt?: string
  ): Promise<string> {
    // Use web-friendly formatting instead of API format
    return this.promptFormatter.formatForWebInterface(
      userMessage,
      contextItems.map(item => ({
        name: item.name,
        content: item.content,
        description: item.description
      })),
      systemPrompt
    );
  }

  async intelligentContextSelection(query: string, maxItems: number = 10): Promise<ContextItem[]> {
    const allItems: ContextItem[] = [];

    // Get items from multiple providers
    const providers = ['codebase', 'file'];
    
    for (const provider of providers) {
      try {
        const items = await this.getContextItems(provider, query);
        allItems.push(...items);
      } catch (error) {
        console.error(`Failed to get items from ${provider}:`, error);
      }
    }

    // Add repository map for additional context
    try {
      const repoMapItems = await this.getContextItems('repo-map', 'entire-codebase');
      allItems.push(...repoMapItems);
    } catch (error) {
      console.error('Failed to get repository map:', error);
    }

    // Score and rank items
    const scoredItems = allItems.map(item => ({
      ...item,
      score: this.calculateItemRelevance(item, query)
    }));

    // Sort by score and return top items
    scoredItems.sort((a, b) => b.score - a.score);
    
    return scoredItems.slice(0, maxItems);
  }

  private calculateItemRelevance(item: ContextItem, query: string): number {
    const queryTerms = query.toLowerCase().split(/\s+/);
    let score = 0;

    // Score based on name match
    const nameLower = item.name.toLowerCase();
    for (const term of queryTerms) {
      if (nameLower.includes(term)) {
        score += 10;
      }
    }

    // Score based on description match
    if (item.description) {
      const descLower = item.description.toLowerCase();
      for (const term of queryTerms) {
        if (descLower.includes(term)) {
          score += 5;
        }
      }
    }

    // Score based on content match (limited to avoid heavy computation)
    const contentSample = item.content.substring(0, 1000).toLowerCase();
    for (const term of queryTerms) {
      const matches = (contentSample.match(new RegExp(term, 'g')) || []).length;
      score += matches * 2;
    }

    // Bonus for certain file types
    if (item.uri?.type === 'file') {
      const ext = path.extname(item.uri.value);
      const importantExtensions = ['.js', '.ts', '.py', '.java', '.go', '.rs'];
      if (importantExtensions.includes(ext)) {
        score += 3;
      }
    }

    return score;
  }

  // Keep existing basic functionality for backward compatibility
  private async getBasicProjectContext(options: any): Promise<Omit<EnhancedProjectContext, 'contextItems' | 'formattedPrompt'>> {
    const {
      includeGitStatus = true,
      maxFiles = 20,
      fileExtensions = [],
      excludePatterns = []
    } = options;

    // Get project files
    const projectFiles = await this.fileService.getProjectStructure();
    const recentFiles = await this.fileService.getRecentFiles(maxFiles);
    
    // Get Git information
    const gitStatus = includeGitStatus ? await this.gitService.getStatus() : {
      branch: 'unknown',
      ahead: 0,
      behind: 0,
      staged: [],
      modified: [],
      untracked: [],
      conflicted: []
    };

    // Get recent changes
    const recentChanges = await this.gitService.getChangedFiles();

    // Select most relevant files
    const contextFiles = await this.selectRelevantFiles(
      recentFiles,
      maxFiles,
      fileExtensions,
      excludePatterns
    );

    // Generate project structure
    const projectStructure = this.generateProjectStructure(projectFiles);

    // Create summary
    const summary = this.generateProjectSummary(contextFiles, gitStatus);

    return {
      summary,
      files: contextFiles,
      gitStatus,
      recentChanges,
      projectStructure
    };
  }

  private async getWorkspaceDirs(): Promise<string[]> {
    // For now, assume current working directory
    // This can be enhanced to detect actual workspace directories
    return [process.cwd()];
  }

  private async selectRelevantFiles(
    files: FileInfo[],
    maxFiles: number,
    extensions: string[],
    excludePatterns: string[]
  ): Promise<ContextFile[]> {
    let filteredFiles = files.filter(file => {
      // Filter by extensions if specified
      if (extensions.length > 0) {
        const ext = path.extname(file.relativePath);
        if (!extensions.includes(ext)) return false;
      }

      // Exclude patterns
      if (excludePatterns.some(pattern => file.relativePath.includes(pattern))) {
        return false;
      }

      return true;
    });

    // Sort by relevance (recently modified files first)
    filteredFiles.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    // Limit number of files
    filteredFiles = filteredFiles.slice(0, maxFiles);

    // Read file contents and create context files
    const contextFiles: ContextFile[] = [];
    
    for (const file of filteredFiles) {
      try {
        const content = await this.fileService.readFile(file.relativePath);
        const language = this.detectLanguage(file.relativePath);
        const relevanceScore = this.calculateRelevanceScore(file);

        contextFiles.push({
          path: file.relativePath,
          content,
          language,
          relevanceScore
        });
      } catch (error) {
        console.warn(`Could not read file ${file.relativePath}:`, error);
      }
    }

    return contextFiles.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: Record<string, string> = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.jsx': 'jsx',
      '.tsx': 'tsx',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.php': 'php',
      '.rb': 'ruby',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.scala': 'scala',
      '.md': 'markdown'
    };

    return languageMap[ext] || 'text';
  }

  private calculateRelevanceScore(file: FileInfo): number {
    let score = 0;

    // Recently modified files are more relevant
    const daysSinceModified = (Date.now() - file.mtime.getTime()) / (1000 * 60 * 60 * 24);
    score += Math.max(0, 10 - daysSinceModified);

    // Smaller files are easier to process
    if (file.size < 10000) score += 5;
    else if (file.size < 50000) score += 3;

    // Prioritize certain file types
    const importantFiles = ['package.json', 'README.md', 'index.js', 'index.ts', 'main.py'];
    if (importantFiles.some(name => file.relativePath.endsWith(name))) {
      score += 10;
    }

    return score;
  }

  private generateProjectStructure(files: FileInfo[]): string {
    const structure: Record<string, any> = {};
    
    files.forEach(file => {
      const parts = file.relativePath.split(path.sep);
      let current = structure;
      
      parts.forEach((part, index) => {
        if (index === parts.length - 1) {
          current[part] = file.isDirectory ? {} : null;
        } else {
          if (!current[part]) current[part] = {};
          current = current[part];
        }
      });
    });

    return this.formatStructure(structure, '');
  }

  private formatStructure(obj: any, indent: string): string {
    let result = '';
    Object.keys(obj).forEach(key => {
      result += `${indent}${key}\n`;
      if (obj[key] && typeof obj[key] === 'object') {
        result += this.formatStructure(obj[key], indent + '  ');
      }
    });
    return result;
  }

  private generateProjectSummary(files: ContextFile[], gitStatus: GitStatus): string {
    const fileCount = files.length;
    const languages = [...new Set(files.map(f => f.language))];
    const totalLines = files.reduce((sum, f) => sum + f.content.split('\n').length, 0);
    
    return `Project Summary:
- ${fileCount} relevant files included
- Languages: ${languages.join(', ')}
- Total lines of code: ${totalLines}
- Git branch: ${gitStatus.branch}
- Modified files: ${gitStatus.modified.length}
- Staged files: ${gitStatus.staged.length}`;
  }
}