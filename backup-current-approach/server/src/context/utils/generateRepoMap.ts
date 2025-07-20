// Repository map generator adapted from Continue.dev
import fs from 'fs/promises';
import path from 'path';
import { RepoMapOptions } from '../types';

interface FileInfo {
  uri: string;
  relativePath: string;
}

export class RepoMapGenerator {
  private maxRepoMapTokens: number;
  private contentTokens: number = 0;
  private allUris: string[] = [];
  private pathsInDirsWithSignatures: Set<string> = new Set();

  private REPO_MAX_CONTEXT_LENGTH_RATIO = 0.5;
  private PREAMBLE =
    "Below is a repository map. \n" +
    "For each file in the codebase, " +
    "this map contains the name of the file, and the signature for any " +
    "classes, methods, or functions in the file.\n\n";

  constructor(
    private workspaceDirs: string[],
    private options: RepoMapOptions,
    private maxTokens: number = 8000, // Default context length
  ) {
    this.maxRepoMapTokens = maxTokens * this.REPO_MAX_CONTEXT_LENGTH_RATIO;
  }

  async generate(): Promise<string> {
    const dirs = this.options.dirUris ?? this.workspaceDirs;
    this.allUris = await this.walkDirs(dirs);

    let content = this.PREAMBLE;

    if (this.options.includeSignatures) {
      // For now, we'll implement a simplified version without full AST parsing
      // This can be enhanced later with tree-sitter integration
      content += await this.generateWithSignatures();
    } else {
      // Simple file listing
      content += this.generateSimpleMap();
    }

    return content;
  }

  private async generateWithSignatures(): Promise<string> {
    let content = '';
    
    for (const uri of this.allUris) {
      try {
        const fileContent = await fs.readFile(uri, 'utf8');
        const signatures = await this.extractSimpleSignatures(uri, fileContent);
        
        if (signatures.length > 0) {
          this.pathsInDirsWithSignatures.add(uri);
          content += `${this.getUriForWrite(uri)}:\n`;
          
          for (const signature of signatures) {
            content += `\t${signature}\n`;
          }
          content += '\n';
        }
        
        // Check token limit
        if (this.estimateTokens(content) >= this.maxRepoMapTokens) {
          break;
        }
      } catch (error) {
        console.error(`Failed to read file ${uri}:`, error);
      }
    }

    // Add remaining files without signatures
    const urisWithoutSignatures = this.allUris.filter(
      uri => !this.pathsInDirsWithSignatures.has(uri)
    );

    if (urisWithoutSignatures.length > 0) {
      const remainingFiles = urisWithoutSignatures
        .map(uri => this.getUriForWrite(uri))
        .join('\n');
      
      if (this.estimateTokens(content + remainingFiles) < this.maxRepoMapTokens) {
        content += remainingFiles;
      }
    }

    return content;
  }

  private generateSimpleMap(): string {
    return this.allUris
      .map(uri => this.getUriForWrite(uri))
      .join('\n');
  }

  private async extractSimpleSignatures(filePath: string, content: string): Promise<string[]> {
    const signatures: string[] = [];
    const lines = content.split('\n');
    const ext = path.extname(filePath);

    // Simple regex-based signature extraction
    // This is a simplified version - can be enhanced with tree-sitter later
    
    if (['.js', '.ts', '.jsx', '.tsx'].includes(ext)) {
      // JavaScript/TypeScript functions and classes
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Function declarations
        if (line.match(/^(export\s+)?(async\s+)?function\s+\w+/) ||
            line.match(/^(const|let|var)\s+\w+\s*=\s*(async\s+)?\(/) ||
            line.match(/^\w+\s*:\s*(async\s+)?\(/)) {
          signatures.push(line);
        }
        
        // Class declarations
        if (line.match(/^(export\s+)?(abstract\s+)?class\s+\w+/)) {
          signatures.push(line);
        }
        
        // Interface declarations
        if (line.match(/^(export\s+)?interface\s+\w+/)) {
          signatures.push(line);
        }
      }
    } else if (['.py'].includes(ext)) {
      // Python functions and classes
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.match(/^def\s+\w+/) || trimmed.match(/^class\s+\w+/)) {
          signatures.push(trimmed);
        }
      }
    } else if (['.java', '.cs'].includes(ext)) {
      // Java/C# methods and classes
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.match(/^(public|private|protected|static|\w+)\s+.*\s+\w+\s*\(/) ||
            trimmed.match(/^(public|private|protected)?\s*(abstract\s+)?class\s+\w+/)) {
          signatures.push(trimmed);
        }
      }
    } else if (['.go'].includes(ext)) {
      // Go functions and types
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.match(/^func\s+/) || trimmed.match(/^type\s+\w+\s+(struct|interface)/)) {
          signatures.push(trimmed);
        }
      }
    }

    return signatures;
  }

  private async walkDirs(dirs: string[]): Promise<string[]> {
    const allFiles: string[] = [];
    
    for (const dir of dirs) {
      try {
        const files = await this.walkDirectory(dir);
        allFiles.push(...files);
      } catch (error) {
        console.error(`Failed to walk directory ${dir}:`, error);
      }
    }
    
    return allFiles;
  }

  private async walkDirectory(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (this.shouldIgnore(entry.name)) {
          continue;
        }
        
        if (entry.isDirectory()) {
          const subFiles = await this.walkDirectory(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile() && this.isCodeFile(entry.name)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`Failed to read directory ${dirPath}:`, error);
    }
    
    return files;
  }

  private shouldIgnore(name: string): boolean {
    const ignorePatterns = [
      'node_modules', '.git', '.DS_Store', '.vscode', '.idea',
      'dist', 'build', 'coverage', '.nyc_output', 'tmp', 'temp'
    ];
    return ignorePatterns.includes(name);
  }

  private isCodeFile(filename: string): boolean {
    const codeExtensions = [
      '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.rs',
      '.cpp', '.c', '.cs', '.php', '.rb', '.swift', '.kt', '.scala'
    ];
    return codeExtensions.some(ext => filename.endsWith(ext));
  }

  private getUriForWrite(uri: string): string {
    if (this.options.outputRelativeUriPaths) {
      // Find the workspace dir that contains this file
      for (const workspaceDir of this.workspaceDirs) {
        if (uri.startsWith(workspaceDir)) {
          return path.relative(workspaceDir, uri);
        }
      }
    }
    return uri;
  }

  private estimateTokens(text: string): number {
    // Simple token estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}

export default async function generateRepoMap(
  workspaceDirs: string[],
  options: RepoMapOptions,
  maxTokens?: number,
): Promise<string> {
  const generator = new RepoMapGenerator(workspaceDirs, options, maxTokens);
  return generator.generate();
}