import { IDE, IdeInfo, IdeSettings, Problem, Range, RangeInFile, Thread, Location, IndexTag, FileType, FileStatsMap, ToastType, TerminalOptions } from "../core-types";
import { FileService } from "../services/FileService";
import { GitService } from "../services/GitService";
import path from 'path';
import fs from 'fs';

/**
 * Browser-based implementation of Continue's IDE interface
 * Adapts Continue's IDE abstraction to work in browser extension context
 */
export class BrowserIde implements IDE {
  private fileService: FileService;
  private gitService: GitService;
  private activeTextEditorCallback?: (fileUri: string) => void;

  constructor(private projectRoot: string) {
    this.fileService = new FileService(projectRoot);
    this.gitService = new GitService(projectRoot);
  }

  // IDE Information
  async getIdeInfo(): Promise<IdeInfo> {
    return {
      ideType: "browser-extension",
      name: "AI Coding Assistant",
      version: "1.0.0",
      remoteName: undefined,
      extensionVersion: "1.0.0"
    };
  }

  async getIdeSettings(): Promise<IdeSettings> {
    return {
      remoteConfigServerUrl: undefined,
      remoteConfigSyncPeriod: 60,
      userToken: undefined,
      enableControlServerBeta: false
    };
  }

  // File Operations
  async fileExists(fileUri: string): Promise<boolean> {
    try {
      return await this.fileService.fileExists(fileUri);
    } catch (error) {
      return false;
    }
  }

  async writeFile(path: string, contents: string): Promise<void> {
    await this.fileService.writeFile(path, contents);
  }

  async readFile(fileUri: string): Promise<string> {
    return await this.fileService.readFile(fileUri);
  }

  async readRangeInFile(fileUri: string, range: Range): Promise<string> {
    const content = await this.readFile(fileUri);
    const lines = content.split('\n');
    const startLine = Math.max(0, range.start.line);
    const endLine = Math.min(lines.length - 1, range.end.line);
    
    if (startLine === endLine) {
      const line = lines[startLine] || '';
      return line.substring(range.start.character, range.end.character);
    }
    
    const selectedLines = lines.slice(startLine, endLine + 1);
    if (selectedLines.length > 0) {
      selectedLines[0] = selectedLines[0].substring(range.start.character);
      selectedLines[selectedLines.length - 1] = selectedLines[selectedLines.length - 1].substring(0, range.end.character);
    }
    
    return selectedLines.join('\n');
  }

  async saveFile(fileUri: string): Promise<void> {
    // In browser context, files are automatically saved when written
    console.log(`Save file requested: ${fileUri}`);
  }

  // Workspace Operations
  async getWorkspaceDirs(): Promise<string[]> {
    return [this.projectRoot];
  }

  async getWorkspaceConfigs(): Promise<any[]> {
    // Return empty array - no specific workspace configs in browser context
    return [];
  }

  async listDir(dir: string): Promise<[string, FileType][]> {
    try {
      const fullPath = path.resolve(this.projectRoot, dir);
      const entries = await fs.promises.readdir(fullPath, { withFileTypes: true });
      
      return entries.map(entry => {
        const fileType: FileType = entry.isDirectory() ? 1 : entry.isFile() ? 0 : 2;
        return [entry.name, fileType] as [string, FileType];
      });
    } catch (error) {
      console.error(`Error listing directory ${dir}:`, error);
      return [];
    }
  }

  async getFileStats(files: string[]): Promise<FileStatsMap> {
    const stats: FileStatsMap = {};
    
    for (const file of files) {
      try {
        const fullPath = path.resolve(this.projectRoot, file);
        const stat = await fs.promises.stat(fullPath);
        stats[file] = {
          size: stat.size,
          lastModified: stat.mtime.getTime()
        };
      } catch (error) {
        // File doesn't exist or can't be accessed
        stats[file] = {
          size: 0,
          lastModified: 0
        };
      }
    }
    
    return stats;
  }

  // Git Operations
  async getDiff(includeUnstaged: boolean): Promise<string[]> {
    try {
      const diff = await this.gitService.getDiff();
      return [diff];
    } catch (error) {
      console.error('Error getting git diff:', error);
      return [];
    }
  }

  async getBranch(dir: string): Promise<string> {
    try {
      const status = await this.gitService.getStatus();
      return status.current || 'main';
    } catch (error) {
      return 'main';
    }
  }

  async getGitRootPath(dir: string): Promise<string | undefined> {
    try {
      return this.projectRoot; // Assume project root is git root
    } catch (error) {
      return undefined;
    }
  }

  async getRepoName(dir: string): Promise<string | undefined> {
    return path.basename(this.projectRoot);
  }

  // Editor Operations
  async openFile(path: string): Promise<void> {
    console.log(`Open file requested: ${path}`);
    // In browser context, we can't actually open files in an IDE
    // This would need to communicate back to the browser extension
  }

  async showVirtualFile(title: string, contents: string): Promise<void> {
    console.log(`Show virtual file: ${title}`);
    // Could potentially send this to browser extension to display
  }

  async showLines(fileUri: string, startLine: number, endLine: number): Promise<void> {
    console.log(`Show lines in ${fileUri}: ${startLine}-${endLine}`);
    // Would need to communicate with browser extension to highlight lines
  }

  async getCurrentFile(): Promise<undefined | { isUntitled: boolean; path: string; contents: string; }> {
    // In browser context, we don't have a concept of "current file"
    // Could potentially track this based on last accessed file
    return undefined;
  }

  async getOpenFiles(): Promise<string[]> {
    // In browser context, return empty array since we don't track open files
    return [];
  }

  async getPinnedFiles(): Promise<string[]> {
    return []; // No pinned files concept in browser context
  }

  // Search Operations
  async getSearchResults(query: string, maxResults?: number): Promise<string> {
    try {
      // Simple grep-style search through project files
      const { subprocess } = await import('child_process');
      const { promisify } = await import('util');
      const exec = promisify(subprocess);
      
      const [stdout] = await exec(`grep -r "${query}" "${this.projectRoot}" --include="*.js" --include="*.ts" --include="*.py" --include="*.java" -n | head -${maxResults || 10}`);
      return stdout;
    } catch (error) {
      return `No search results found for: ${query}`;
    }
  }

  async getFileResults(pattern: string, maxResults?: number): Promise<string[]> {
    try {
      const { subprocess } = await import('child_process');
      const { promisify } = await import('util');
      const exec = promisify(subprocess);
      
      const [stdout] = await exec(`find "${this.projectRoot}" -name "${pattern}" -type f | head -${maxResults || 20}`);
      return stdout.trim().split('\n').filter(f => f.length > 0);
    } catch (error) {
      return [];
    }
  }

  // System Operations
  async subprocess(command: string, cwd?: string): Promise<[string, string]> {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const { stdout, stderr } = await execAsync(command, { 
        cwd: cwd || this.projectRoot 
      });
      return [stdout, stderr];
    } catch (error: any) {
      return ['', error.message || 'Command failed'];
    }
  }

  async runCommand(command: string, options?: TerminalOptions): Promise<void> {
    console.log(`Run command: ${command}`);
    try {
      await this.subprocess(command);
    } catch (error) {
      console.error(`Command failed: ${command}`, error);
    }
  }

  async openUrl(url: string): Promise<void> {
    console.log(`Open URL requested: ${url}`);
    // Would need to send message to browser extension to open URL
  }

  // Clipboard Operations
  async getClipboardContent(): Promise<{ text: string; copiedAt: string }> {
    // Browser security prevents direct clipboard access
    // Would need to use browser extension APIs
    return {
      text: '',
      copiedAt: new Date().toISOString()
    };
  }

  // Settings and Configuration
  async isTelemetryEnabled(): Promise<boolean> {
    return false; // Disable telemetry in browser context
  }

  async isWorkspaceRemote(): Promise<boolean> {
    return false; // Browser extension works with local files
  }

  async getUniqueId(): Promise<string> {
    // Generate a unique ID for this browser session
    return `browser-extension-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Terminal and Debug Operations
  async getTerminalContents(): Promise<string> {
    return ''; // No terminal access in browser context
  }

  async getDebugLocals(threadIndex: number): Promise<string> {
    return ''; // No debug access in browser context
  }

  async getTopLevelCallStackSources(threadIndex: number, stackDepth: number): Promise<string[]> {
    return []; // No debug access in browser context
  }

  async getAvailableThreads(): Promise<Thread[]> {
    return []; // No debug access in browser context
  }

  // Problem/Diagnostics
  async getProblems(fileUri?: string): Promise<Problem[]> {
    return []; // No LSP integration in browser context
  }

  // UI Operations
  async showToast(type: ToastType, message: string, ...otherParams: any[]): Promise<any> {
    console.log(`Toast [${type}]: ${message}`, otherParams);
    // Could send to browser extension to show notification
  }

  // Indexing Operations
  async getTags(artifactId: string): Promise<IndexTag[]> {
    return []; // No indexing in basic browser implementation
  }

  // Security
  async readSecrets(keys: string[]): Promise<Record<string, string>> {
    // Use browser storage for secrets
    const secrets: Record<string, string> = {};
    // Would integrate with chrome.storage.local
    return secrets;
  }

  async writeSecrets(secrets: { [key: string]: string }): Promise<void> {
    // Store in browser storage
    console.log('Writing secrets to browser storage');
  }

  // LSP Operations
  async gotoDefinition(location: Location): Promise<RangeInFile[]> {
    return []; // No LSP in browser context
  }

  // Callbacks
  onDidChangeActiveTextEditor(callback: (fileUri: string) => void): void {
    this.activeTextEditorCallback = callback;
  }

  // Helper method to trigger active file change
  private notifyActiveFileChange(fileUri: string) {
    if (this.activeTextEditorCallback) {
      this.activeTextEditorCallback(fileUri);
    }
  }
}