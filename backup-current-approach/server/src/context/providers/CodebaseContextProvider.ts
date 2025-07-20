// Codebase Context Provider adapted from Continue.dev (simplified without embeddings)
import fs from 'fs/promises';
import path from 'path';
import { BaseContextProvider } from '../BaseContextProvider';
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from '../types';

class CodebaseContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "codebase",
    displayTitle: "Codebase",
    description: "Automatically find relevant files",
    type: "normal",
    renderInlineAs: "",
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    // Simple keyword-based search until we implement embeddings
    return this.simpleTextSearch(query, extras.workspaceDirs);
  }

  private async simpleTextSearch(
    query: string,
    workspaceDirs: string[]
  ): Promise<ContextItem[]> {
    const results: ContextItem[] = [];
    const searchTerms = query.toLowerCase().split(/\s+/);
    const maxResults = 15;
    
    for (const workspaceDir of workspaceDirs) {
      try {
        const files = await this.findCodeFiles(workspaceDir);
        
        for (const file of files.slice(0, 100)) { // Limit for performance
          try {
            const content = await fs.readFile(file, 'utf8');
            const score = this.calculateRelevanceScore(content, searchTerms);
            
            if (score > 0) {
              const relativePath = path.relative(workspaceDir, file);
              const chunks = this.extractRelevantChunks(content, searchTerms);
              
              results.push({
                name: path.basename(file),
                description: relativePath,
                content: `\`\`\`${this.getLanguageFromExtension(file)}\n${chunks}\n\`\`\``,
                uri: {
                  type: 'file',
                  value: file,
                },
              });
            }
          } catch (error) {
            // Skip files that can't be read
            continue;
          }
        }
      } catch (error) {
        console.error(`Failed to search in ${workspaceDir}:`, error);
      }
    }
    
    // Sort by relevance and return top results
    results.sort((a, b) => this.calculateScore(b.content, searchTerms) - this.calculateScore(a.content, searchTerms));
    
    return results.slice(0, maxResults);
  }

  private async findCodeFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (this.shouldIgnore(entry.name)) {
          continue;
        }
        
        if (entry.isDirectory()) {
          const subFiles = await this.findCodeFiles(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile() && this.isCodeFile(entry.name)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories that can't be read
    }
    
    return files;
  }

  private shouldIgnore(name: string): boolean {
    const ignorePatterns = [
      'node_modules', '.git', '.DS_Store', '.vscode', '.idea',
      'dist', 'build', 'coverage', '.nyc_output', 'tmp', 'temp',
      '.next', '.nuxt', '.output', 'vendor'
    ];
    return ignorePatterns.includes(name) || name.startsWith('.');
  }

  private isCodeFile(filename: string): boolean {
    const codeExtensions = [
      '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.rs',
      '.cpp', '.c', '.cs', '.php', '.rb', '.swift', '.kt', '.scala',
      '.html', '.css', '.scss', '.vue', '.svelte', '.md', '.json',
      '.yaml', '.yml', '.xml', '.sql'
    ];
    return codeExtensions.some(ext => filename.endsWith(ext));
  }

  private calculateRelevanceScore(content: string, searchTerms: string[]): number {
    const contentLower = content.toLowerCase();
    let score = 0;
    
    for (const term of searchTerms) {
      const matches = (contentLower.match(new RegExp(term, 'g')) || []).length;
      score += matches;
    }
    
    return score;
  }

  private calculateScore(content: string, searchTerms: string[]): number {
    return this.calculateRelevanceScore(content, searchTerms);
  }

  private extractRelevantChunks(content: string, searchTerms: string[]): string {
    const lines = content.split('\n');
    const relevantLines: { index: number; line: string; score: number }[] = [];
    
    // Find lines that contain search terms
    lines.forEach((line, index) => {
      const lineLower = line.toLowerCase();
      let score = 0;
      
      for (const term of searchTerms) {
        if (lineLower.includes(term)) {
          score += 1;
        }
      }
      
      if (score > 0) {
        relevantLines.push({ index, line, score });
      }
    });
    
    if (relevantLines.length === 0) {
      // If no specific matches, return first part of file
      return lines.slice(0, 50).join('\n');
    }
    
    // Extract chunks around relevant lines
    const chunks: string[] = [];
    const contextLines = 3;
    
    for (const relevant of relevantLines.slice(0, 5)) { // Limit chunks
      const start = Math.max(0, relevant.index - contextLines);
      const end = Math.min(lines.length, relevant.index + contextLines + 1);
      
      const chunk = lines.slice(start, end).join('\n');
      if (!chunks.includes(chunk)) {
        chunks.push(chunk);
      }
    }
    
    return chunks.join('\n\n...\n\n');
  }

  private getLanguageFromExtension(filePath: string): string {
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
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.md': 'markdown',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.xml': 'xml',
      '.sql': 'sql'
    };

    return languageMap[ext] || 'text';
  }
}

export default CodebaseContextProvider;