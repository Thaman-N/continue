import fs from 'fs/promises';
import path from 'path';
import glob from 'fast-glob';
import ignore from 'ignore';
import mime from 'mime-types';
import { watch } from 'chokidar';

export interface FileInfo {
  path: string;
  relativePath: string;
  size: number;
  mtime: Date;
  isDirectory: boolean;
  mimeType: string | false;
  content?: string;
}

export class FileService {
  private projectRoot: string;
  private gitignore: any;

  constructor(projectRoot: string) {
    this.projectRoot = path.resolve(projectRoot);
    this.initializeGitignore();
  }

  getProjectRoot(): string {
    return this.projectRoot;
  }

  private async initializeGitignore() {
    try {
      const gitignorePath = path.join(this.projectRoot, '.gitignore');
      const gitignoreContent = await fs.readFile(gitignorePath, 'utf-8');
      this.gitignore = ignore().add(gitignoreContent);
    } catch (error) {
      // No .gitignore file, create empty ignore
      this.gitignore = ignore();
    }
    
    // Add common ignore patterns
    this.gitignore.add([
      'node_modules/**',
      '.git/**',
      'dist/**',
      'build/**',
      '*.log',
      '.DS_Store',
      'Thumbs.db'
    ]);
  }

  async getProjectStructure(): Promise<FileInfo[]> {
    const files = await glob('**/*', {
      cwd: this.projectRoot,
      ignore: ['node_modules/**', '.git/**'],
      dot: false,
      stats: true
    });

    const fileInfos: FileInfo[] = [];
    
    for (const file of files) {
      const fullPath = path.join(this.projectRoot, file.path);
      const relativePath = file.path;
      
      if (this.gitignore.ignores(relativePath)) continue;
      
      try {
        const stats = file.stats!;
        const mimeType = mime.lookup(fullPath);
        
        fileInfos.push({
          path: fullPath,
          relativePath,
          size: stats.size,
          mtime: stats.mtime,
          isDirectory: stats.isDirectory(),
          mimeType
        });
      } catch (error) {
        console.warn(`Error processing file ${fullPath}:`, error);
      }
    }
    
    return fileInfos;
  }

  async fileExists(filePath: string): Promise<boolean> {
    const fullPath = path.resolve(this.projectRoot, filePath);
    
    // Security check - ensure file is within project root
    const normalizedProjectRoot = path.normalize(this.projectRoot);
    const normalizedFullPath = path.normalize(fullPath);
    
    // Ensure project root ends with separator for proper boundary checking
    const projectRootWithSep = normalizedProjectRoot.endsWith(path.sep) ? normalizedProjectRoot : normalizedProjectRoot + path.sep;
    
    if (!normalizedFullPath.startsWith(normalizedProjectRoot) && !normalizedFullPath.startsWith(projectRootWithSep)) {
      console.error(`Path validation failed: "${normalizedFullPath}" does not start with "${normalizedProjectRoot}"`);
      throw new Error(`Path ${filePath} is outside project boundaries`);
    }
    
    try {
      await fs.access(fullPath);
      return true;
    } catch (error) {
      return false;
    }
  }

  async readFile(filePath: string): Promise<string> {
    const fullPath = path.resolve(this.projectRoot, filePath);
    
    // Security check - ensure file is within project root
    const normalizedProjectRoot = path.normalize(this.projectRoot);
    const normalizedFullPath = path.normalize(fullPath);
    
    // Ensure project root ends with separator for proper boundary checking
    const projectRootWithSep = normalizedProjectRoot.endsWith(path.sep) ? normalizedProjectRoot : normalizedProjectRoot + path.sep;
    
    if (!normalizedFullPath.startsWith(normalizedProjectRoot) && !normalizedFullPath.startsWith(projectRootWithSep)) {
      console.error(`Path validation failed: "${normalizedFullPath}" does not start with "${normalizedProjectRoot}"`);
      throw new Error(`Path ${filePath} is outside project boundaries`);
    }
    
    return await fs.readFile(fullPath, 'utf-8');
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const fullPath = path.resolve(this.projectRoot, filePath);
    
    console.log(`WriteFile Debug: filePath="${filePath}", projectRoot="${this.projectRoot}", fullPath="${fullPath}"`);
    
    // Fix path validation - need to normalize both paths for comparison
    const normalizedProjectRoot = path.normalize(this.projectRoot);
    const normalizedFullPath = path.normalize(fullPath);
    
    if (!normalizedFullPath.startsWith(normalizedProjectRoot)) {
      throw new Error(`Path ${filePath} is outside project boundaries`);
    }
    
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
  }

  async getRecentFiles(limit: number = 10): Promise<FileInfo[]> {
    const files = await this.getProjectStructure();
    return files
      .filter(f => !f.isDirectory && this.isCodeFile(f.relativePath))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
      .slice(0, limit);
  }

  private isCodeFile(filePath: string): boolean {
    const codeExtensions = [
      '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.rs', '.cpp', '.c',
      '.cs', '.php', '.rb', '.swift', '.kt', '.scala', '.clj', '.elm', '.hs',
      '.ml', '.fs', '.jl', '.r', '.sql', '.sh', '.yml', '.yaml', '.json',
      '.xml', '.html', '.css', '.scss', '.less', '.md', '.mdx'
    ];
    
    return codeExtensions.some(ext => filePath.endsWith(ext));
  }

  watchFiles(callback: (event: string, path: string) => void) {
    const watcher = watch(this.projectRoot, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: true
    });
    
    watcher
      .on('add', path => callback('add', path))
      .on('change', path => callback('change', path))
      .on('unlink', path => callback('unlink', path));
      
    return watcher;
  }
}
