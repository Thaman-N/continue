import { FileService, FileInfo } from './FileService';
import { GitService, GitStatus } from './GitService';
import path from 'path';

export interface ProjectContext {
  summary: string;
  files: ContextFile[];
  gitStatus: GitStatus;
  recentChanges: string[];
  projectStructure: string;
}

export interface ContextFile {
  path: string;
  content: string;
  language: string;
  relevanceScore: number;
}

export interface ContextOptions {
  includeGitStatus?: boolean;
  maxFiles?: number;
  fileExtensions?: string[];
  excludePatterns?: string[];
}

export class ContextService {
  constructor(
    private fileService: FileService,
    private gitService: GitService
  ) {}

  async getProjectContext(options: ContextOptions = {}): Promise<ProjectContext> {
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
      '.clj': 'clojure',
      '.hs': 'haskell',
      '.ml': 'ocaml',
      '.fs': 'fsharp',
      '.jl': 'julia',
      '.r': 'r',
      '.sql': 'sql',
      '.sh': 'bash',
      '.yml': 'yaml',
      '.yaml': 'yaml',
      '.json': 'json',
      '.xml': 'xml',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
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
