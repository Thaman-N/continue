/**
 * Adapted from Continue.dev's context provider system
 * Provides intelligent context gathering for LLM requests
 */

export interface ContextItem {
  name: string;
  description: string;
  content: string;
  uri?: {
    type: string;
    value: string;
  };
}

export interface ContextProviderDescription {
  title: string;
  displayTitle: string;
  description: string;
  type: 'normal' | 'submenu' | 'query';
  renderInlineAs?: string;
}

export interface ContextProviderExtras {
  fileService: any; // Simplified IDE interface
  projectRoot: string;
  llmInput: string;
  selectedCode?: { content: string; filepath: string };
}

export interface ContextSubmenuItem {
  id: string;
  title: string;
  description: string;
}

/**
 * Base context provider following Continue's pattern
 */
export abstract class BaseContextProvider {
  options: { [key: string]: any };
  
  constructor(options: { [key: string]: any } = {}) {
    this.options = options;
  }
  
  static description: ContextProviderDescription;
  
  get description(): ContextProviderDescription {
    return (this.constructor as any).description;
  }
  
  abstract getContextItems(
    query: string,
    extras: ContextProviderExtras
  ): Promise<ContextItem[]>;
  
  async loadSubmenuItems(
    extras: ContextProviderExtras
  ): Promise<ContextSubmenuItem[]> {
    return [];
  }
}

/**
 * File context provider - reads specific files
 */
export class FileContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "file",
    displayTitle: "Files",
    description: "Include specific files in context",
    type: "submenu",
  };
  
  async getContextItems(
    query: string,
    extras: ContextProviderExtras
  ): Promise<ContextItem[]> {
    try {
      const filePath = query.trim();
      const content = await extras.fileService.readFile(filePath);
      
      // Detect language for proper syntax highlighting
      const language = this.detectLanguage(filePath);
      const relativePath = filePath.replace(extras.projectRoot, '').replace(/^\//, '');
      
      return [
        {
          name: this.getBaseName(filePath),
          description: relativePath,
          content: `\`\`\`${language}\n${content}\n\`\`\``,
          uri: {
            type: "file",
            value: filePath
          }
        }
      ];
    } catch (error) {
      return [
        {
          name: "Error",
          description: `Failed to read ${query}`,
          content: `Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      ];
    }
  }
  
  async loadSubmenuItems(extras: ContextProviderExtras): Promise<ContextSubmenuItem[]> {
    try {
      const files = await this.walkDirectory(extras.projectRoot, extras.fileService);
      
      return files.slice(0, 100).map(file => ({
        id: file,
        title: this.getBaseName(file),
        description: file.replace(extras.projectRoot, '').replace(/^\//, '')
      }));
    } catch (error) {
      return [];
    }
  }
  
  private async walkDirectory(dir: string, fileService: any): Promise<string[]> {
    const files: string[] = [];
    
    try {
      // Use Node.js fs to actually discover files
      const fs = require('fs');
      const path = require('path');
      
      const walkDir = (currentDir: string): string[] => {
        const items: string[] = [];
        try {
          const entries = fs.readdirSync(currentDir, { withFileTypes: true });
          
          for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);
            
            // Skip hidden files and node_modules
            if (entry.name.startsWith('.') || entry.name === 'node_modules') {
              continue;
            }
            
            if (entry.isDirectory()) {
              items.push(...walkDir(fullPath));
            } else if (entry.isFile()) {
              // Include common code files
              const ext = path.extname(entry.name).toLowerCase();
              if (['.js', '.ts', '.py', '.java', '.json', '.md', '.txt', '.yml', '.yaml', '.html', '.css'].includes(ext)) {
                items.push(fullPath);
              }
            }
          }
        } catch (error) {
          // Directory not accessible
        }
        return items;
      };
      
      return walkDir(dir);
    } catch (error) {
      console.error('Error walking directory:', error);
      return [];
    }
  }
  
  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: { [key: string]: string } = {
      'js': 'javascript',
      'ts': 'typescript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'go': 'go',
      'rs': 'rust',
      'php': 'php',
      'rb': 'ruby',
      'json': 'json',
      'yaml': 'yaml',
      'yml': 'yaml',
      'md': 'markdown',
      'html': 'html',
      'css': 'css',
      'sql': 'sql'
    };
    
    return languageMap[ext || ''] || 'text';
  }
  
  private getBaseName(filePath: string): string {
    return filePath.split('/').pop() || filePath;
  }
}

/**
 * Codebase context provider - intelligent file selection
 */
export class CodebaseContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "codebase",
    displayTitle: "Codebase",
    description: "Automatically find relevant files based on your query",
    type: "normal",
    renderInlineAs: "",
  };
  
  async getContextItems(
    query: string,
    extras: ContextProviderExtras
  ): Promise<ContextItem[]> {
    console.log(`🏃 CodebaseContextProvider.getContextItems called with query: "${query}"`);
    // Simplified intelligent file selection
    // In full implementation, this would use embeddings and semantic search
    
    console.log(`🔧 About to call findRelevantFiles...`);
    const relevantFiles = await this.findRelevantFiles(query, extras);
    console.log(`✅ findRelevantFiles returned ${relevantFiles.length} files`);
    const contextItems: ContextItem[] = [];
    
    for (const file of relevantFiles.slice(0, 5)) { // Limit to 5 most relevant
      try {
        const content = await extras.fileService.readFile(file);
        const language = this.detectLanguage(file);
        const relativePath = file.replace(extras.projectRoot, '').replace(/^\//, '');
        
        contextItems.push({
          name: this.getBaseName(file),
          description: `Relevant file: ${relativePath}`,
          content: `\`\`\`${language}\n${content}\n\`\`\``,
          uri: {
            type: "file",
            value: file
          }
        });
      } catch (error) {
        // Skip files that can't be read
      }
    }
    
    return contextItems;
  }
  
  private async findRelevantFiles(
    query: string,
    extras: ContextProviderExtras
  ): Promise<string[]> {
    console.log(`🔍 findRelevantFiles called with query: "${query}"`);
    // Simplified relevance scoring
    // In Continue.dev, this uses embeddings and vector search
    
    const queryTerms = query.toLowerCase().split(/\s+/);
    console.log(`📝 Query terms: ${queryTerms.join(', ')}`);
    const allFiles = await this.getAllFiles(extras.projectRoot, extras.fileService);
    
    // Score files based on:
    // 1. Filename similarity
    // 2. Content similarity (actual file content search)
    const scoredFiles = await Promise.all(allFiles.map(async file => {
      let score = 0;
      const fileName = this.getBaseName(file).toLowerCase();
      const relativePath = file.replace(extras.projectRoot, '').toLowerCase();
      
      // Filename scoring
      queryTerms.forEach(term => {
        if (fileName.includes(term)) score += 10;
        if (relativePath.includes(term)) score += 5;
      });
      
      // File type relevance
      if (query.includes('test') && file.includes('test')) score += 8;
      if (query.includes('config') && file.includes('config')) score += 8;
      if (query.includes('util') && file.includes('util')) score += 8;
      
      // Content similarity - actually read the file content
      try {
        const content = await extras.fileService.readFile(file);
        const contentLower = content.toLowerCase();
        
        queryTerms.forEach(term => {
          // Count occurrences for more accurate scoring
          const occurrences = (contentLower.match(new RegExp(term, 'g')) || []).length;
          if (occurrences > 0) {
            score += Math.min(20, occurrences * 5); // Cap at 20 points per term
            console.log(`📊 File ${fileName} contains "${term}" ${occurrences} times (+${Math.min(20, occurrences * 5)} points)`);
          }
        });
        
        // Bonus for function definitions
        queryTerms.forEach(term => {
          if (contentLower.includes(`function ${term}`) || contentLower.includes(`${term}(`)) {
            score += 15;
            console.log(`🎯 File ${fileName} defines function "${term}" (+15 points)`);
          }
        });
        
      } catch (error) {
        // Can't read file, skip content scoring
      }
      
      return { file, score };
    }));
    
    const filteredFiles = scoredFiles
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.file);
      
    console.log(`🎯 Relevance scoring results: ${filteredFiles.length} files with score > 0`);
    
    // TEMPORARY: If no files scored > 0, return all files for debugging
    if (filteredFiles.length === 0) {
      console.log(`⚠️ No files scored > 0, returning all files for debugging`);
      return allFiles.slice(0, 3); // Return first 3 files for debugging
    }
    
    return filteredFiles;
  }
  
  private async getAllFiles(projectRoot: string, fileService: any): Promise<string[]> {
    console.log(`📁 CodebaseContextProvider.getAllFiles scanning: ${projectRoot}`);
    const files: string[] = [];
    
    try {
      // Use Node.js fs to actually discover files
      const fs = require('fs');
      const path = require('path');
      
      const walkDir = (dir: string): string[] => {
        const items: string[] = [];
        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          console.log(`📂 Scanning directory: ${dir} (${entries.length} entries)`);
          
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            
            // Skip hidden files and node_modules
            if (entry.name.startsWith('.') || entry.name === 'node_modules') {
              continue;
            }
            
            if (entry.isDirectory()) {
              items.push(...walkDir(fullPath));
            } else if (entry.isFile()) {
              // Include common code files
              const ext = path.extname(entry.name).toLowerCase();
              if (['.js', '.ts', '.py', '.java', '.json', '.md', '.txt', '.yml', '.yaml'].includes(ext)) {
                items.push(fullPath);
                console.log(`📄 Found file: ${fullPath}`);
              }
            }
          }
        } catch (error) {
          console.error(`❌ Error reading directory ${dir}:`, error);
        }
        return items;
      };
      
      const result = walkDir(projectRoot);
      console.log(`✅ CodebaseContextProvider.getAllFiles found ${result.length} total files`);
      return result;
    } catch (error) {
      console.error('Error discovering files:', error);
      return [];
    }
  }
  
  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: { [key: string]: string } = {
      'js': 'javascript',
      'ts': 'typescript',
      'py': 'python',
      'java': 'java'
    };
    return languageMap[ext || ''] || 'text';
  }
  
  private getBaseName(filePath: string): string {
    return filePath.split('/').pop() || filePath;
  }
}

/**
 * Current file context provider
 */
export class CurrentFileContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "current",
    displayTitle: "Current File",
    description: "Include the currently selected file",
    type: "normal",
  };
  
  async getContextItems(
    query: string,
    extras: ContextProviderExtras
  ): Promise<ContextItem[]> {
    if (!extras.selectedCode) {
      return [
        {
          name: "No Selection",
          description: "No file currently selected",
          content: "No file is currently selected or available."
        }
      ];
    }
    
    const { content, filepath } = extras.selectedCode;
    const language = this.detectLanguage(filepath);
    const relativePath = filepath.replace(extras.projectRoot, '').replace(/^\//, '');
    
    return [
      {
        name: this.getBaseName(filepath),
        description: `Current file: ${relativePath}`,
        content: `\`\`\`${language}\n${content}\n\`\`\``,
        uri: {
          type: "file",
          value: filepath
        }
      }
    ];
  }
  
  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: { [key: string]: string } = {
      'js': 'javascript',
      'ts': 'typescript',
      'py': 'python'
    };
    return languageMap[ext || ''] || 'text';
  }
  
  private getBaseName(filePath: string): string {
    return filePath.split('/').pop() || filePath;
  }
}

/**
 * Context provider registry and manager
 */
export class ContextProviderManager {
  private providers: Map<string, BaseContextProvider> = new Map();
  
  constructor() {
    // Register default providers
    this.registerProvider('file', new FileContextProvider());
    this.registerProvider('codebase', new CodebaseContextProvider());
    this.registerProvider('current', new CurrentFileContextProvider());
  }
  
  registerProvider(name: string, provider: BaseContextProvider) {
    this.providers.set(name, provider);
  }
  
  getProvider(name: string): BaseContextProvider | undefined {
    return this.providers.get(name);
  }
  
  getAllProviders(): { [key: string]: ContextProviderDescription } {
    const descriptions: { [key: string]: ContextProviderDescription } = {};
    
    this.providers.forEach((provider, name) => {
      descriptions[name] = provider.description;
    });
    
    return descriptions;
  }
  
  async getContextItems(
    providerName: string,
    query: string,
    extras: ContextProviderExtras
  ): Promise<ContextItem[]> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Context provider '${providerName}' not found`);
    }
    
    return provider.getContextItems(query, extras);
  }
  
  async getSmartContext(
    userInput: string,
    extras: ContextProviderExtras
  ): Promise<ContextItem[]> {
    console.log(`🧠 ContextProviderManager.getSmartContext called with: "${userInput}"`);
    console.log(`📂 Selected code available: ${!!extras.selectedCode}`);
    
    // Automatically determine which context to include based on user input
    const contextItems: ContextItem[] = [];
    
    // Always include current file if available
    if (extras.selectedCode) {
      console.log(`📄 Getting current file context...`);
      const currentItems = await this.getContextItems('current', '', extras);
      contextItems.push(...currentItems);
      console.log(`✅ Got ${currentItems.length} current file items`);
    }
    
    // Add codebase context for complex queries
    const shouldSearchCodebase = userInput.length > 20 || 
                                  userInput.includes('file') || 
                                  userInput.includes('function') ||
                                  userInput.includes('math') ||
                                  userInput.includes('subtract') ||
                                  userInput.includes('code') ||
                                  userInput.length > 0; // Search for any non-empty query
    
    if (shouldSearchCodebase) {
      console.log(`🔍 Getting codebase context for query: "${userInput}" (criteria met: length=${userInput.length})`);
      const codebaseItems = await this.getContextItems('codebase', userInput, extras);
      contextItems.push(...codebaseItems.slice(0, 3)); // Limit to avoid token overflow
      console.log(`✅ Got ${codebaseItems.length} codebase items (using first 3)`);
    } else {
      console.log(`⏭️ Skipping codebase context - query too simple: "${userInput}"`);
    }
    
    console.log(`🎯 ContextProviderManager.getSmartContext returning ${contextItems.length} total items`);
    return contextItems;
  }
}