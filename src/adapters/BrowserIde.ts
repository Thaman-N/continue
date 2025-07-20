// Browser-specific implementation of Continue's IDE interface
import {
  IDE,
  IdeInfo,
  IdeSettings,
  Range,
  Problem,
  IndexTag,
  ToastType,
  Thread,
  ContinueRcJson,
  Location,
  RangeInFile,
  FileType,
  FileStatsMap,
  TerminalOptions
} from '../core-types';

export class BrowserIde implements IDE {
  private projectRoot: string;
  private serverUrl: string;

  constructor(projectRoot: string, serverUrl: string = 'http://localhost:3001') {
    this.projectRoot = projectRoot;
    this.serverUrl = serverUrl;
  }

  // Basic IDE Information
  async getIdeInfo(): Promise<IdeInfo> {
    return {
      ideType: 'vscode', // Use vscode type for compatibility
      name: 'Browser Extension',
      version: '1.0.0',
      remoteName: 'browser-extension',
      extensionVersion: '1.0.0',
      isPrerelease: false
    };
  }

  async getIdeSettings(): Promise<IdeSettings> {
    return {
      remoteConfigServerUrl: undefined,
      remoteConfigSyncPeriod: 60,
      userToken: '',
      continueTestEnvironment: 'none',
      pauseCodebaseIndexOnStart: false
    };
  }

  async getUniqueId(): Promise<string> {
    // Use browser extension ID or generate one
    return chrome.runtime.id || 'browser-extension-' + Date.now();
  }

  // Workspace and File Operations
  async getWorkspaceDirs(): Promise<string[]> {
    return [this.projectRoot];
  }

  async getWorkspaceConfigs(): Promise<ContinueRcJson[]> {
    // For now, return empty array - can be enhanced later
    return [];
  }

  async fileExists(fileUri: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.serverUrl}/api/files/exists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: fileUri })
      });
      const result = await response.json();
      return result.exists;
    } catch (error) {
      console.error('Error checking file existence:', error);
      return false;
    }
  }

  async readFile(fileUri: string): Promise<string> {
    try {
      const response = await fetch(`${this.serverUrl}/api/files/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: fileUri })
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to read file');
      }
      return result.content;
    } catch (error) {
      console.error(`Error reading file ${fileUri}:`, error);
      throw error;
    }
  }

  async writeFile(path: string, contents: string): Promise<void> {
    try {
      const response = await fetch(`${this.serverUrl}/api/files/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, content: contents })
      });
      
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to write file');
      }
    } catch (error) {
      console.error(`Error writing file ${path}:`, error);
      throw error;
    }
  }

  async readRangeInFile(fileUri: string, range: Range): Promise<string> {
    const content = await this.readFile(fileUri);
    const lines = content.split('\n');
    const startLine = Math.max(0, range.start.line);
    const endLine = Math.min(lines.length - 1, range.end.line);
    return lines.slice(startLine, endLine + 1).join('\n');
  }

  async listDir(dir: string): Promise<[string, FileType][]> {
    try {
      const response = await fetch(`${this.serverUrl}/api/files/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: dir })
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to list directory');
      }
      return result.entries;
    } catch (error) {
      console.error(`Error listing directory ${dir}:`, error);
      return [];
    }
  }

  async getFileStats(files: string[]): Promise<FileStatsMap> {
    // Return basic stats - can be enhanced with server endpoint
    const stats: FileStatsMap = {};
    for (const file of files) {
      stats[file] = {
        size: 0,
        lastModified: Date.now()
      };
    }
    return stats;
  }

  // Git Operations
  async getDiff(includeUnstaged: boolean): Promise<string[]> {
    try {
      const response = await fetch(`${this.serverUrl}/api/git/diff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ includeUnstaged })
      });
      const result = await response.json();
      return result.diff || [];
    } catch (error) {
      console.error('Error getting git diff:', error);
      return [];
    }
  }

  async getBranch(dir: string): Promise<string> {
    try {
      const response = await fetch(`${this.serverUrl}/api/git/branch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dir })
      });
      const result = await response.json();
      return result.branch || 'main';
    } catch (error) {
      console.error('Error getting git branch:', error);
      return 'main';
    }
  }

  async getGitRootPath(dir: string): Promise<string | undefined> {
    try {
      const response = await fetch(`${this.serverUrl}/api/git/root`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dir })
      });
      const result = await response.json();
      return result.root;
    } catch (error) {
      console.error('Error getting git root:', error);
      return undefined;
    }
  }

  async getRepoName(dir: string): Promise<string | undefined> {
    try {
      const response = await fetch(`${this.serverUrl}/api/git/repo-name`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dir })
      });
      const result = await response.json();
      return result.name;
    } catch (error) {
      console.error('Error getting repo name:', error);
      return undefined;
    }
  }

  // Search Operations
  async getSearchResults(query: string, maxResults?: number): Promise<string> {
    try {
      const response = await fetch(`${this.serverUrl}/api/search/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, maxResults: maxResults || 50 })
      });
      const result = await response.json();
      return result.results || '';
    } catch (error) {
      console.error('Error performing text search:', error);
      return '';
    }
  }

  async getFileResults(pattern: string, maxResults?: number): Promise<string[]> {
    try {
      const response = await fetch(`${this.serverUrl}/api/search/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pattern, maxResults: maxResults || 50 })
      });
      const result = await response.json();
      return result.files || [];
    } catch (error) {
      console.error('Error performing file search:', error);
      return [];
    }
  }

  // UI Operations
  async showVirtualFile(title: string, contents: string): Promise<void> {
    // For browser extension, we can show this in a new tab or popup
    console.log(`Virtual file: ${title}`, contents);
    // Could implement by creating a data URL and opening in new tab
  }

  async openFile(path: string): Promise<void> {
    // In browser context, we might send a message to open in external editor
    console.log(`Opening file: ${path}`);
  }

  async openUrl(url: string): Promise<void> {
    window.open(url, '_blank');
  }

  async showToast(type: ToastType, message: string, ...otherParams: any[]): Promise<void> {
    console.log(`[${type.toUpperCase()}] ${message}`, ...otherParams);
    // Could implement browser notifications here
    if ('Notification' in window) {
      new Notification(`Continue: ${message}`, {
        icon: chrome.runtime.getURL('icons/icon-48.png')
      });
    }
  }

  async showLines(fileUri: string, startLine: number, endLine: number): Promise<void> {
    console.log(`Show lines ${startLine}-${endLine} in ${fileUri}`);
    // Could implement by highlighting in a viewer
  }

  // Editor Operations (Limited in browser context)
  async getCurrentFile(): Promise<{ isUntitled: boolean; path: string; contents: string; } | undefined> {
    // In browser extension, we don't have a current file concept
    return undefined;
  }

  async getOpenFiles(): Promise<string[]> {
    // Return empty array for now - browser extensions don't have open files
    return [];
  }

  async getPinnedFiles(): Promise<string[]> {
    // Could store in chrome.storage
    return [];
  }

  async saveFile(fileUri: string): Promise<void> {
    // No-op in browser context
    console.log(`Save file: ${fileUri}`);
  }

  // Terminal Operations (Not available in browser)
  async getTerminalContents(): Promise<string> {
    return '';
  }

  async runCommand(command: string, options?: TerminalOptions): Promise<void> {
    console.log(`Run command: ${command}`, options);
    // Could potentially proxy to server for execution
  }

  async subprocess(command: string, cwd?: string): Promise<[string, string]> {
    console.log(`Subprocess: ${command} in ${cwd || 'current dir'}`);
    return ['', ''];
  }

  // Debug Operations (Not available in browser)
  async getDebugLocals(threadIndex: number): Promise<string> {
    return '';
  }

  async getTopLevelCallStackSources(threadIndex: number, stackDepth: number): Promise<string[]> {
    return [];
  }

  async getAvailableThreads(): Promise<Thread[]> {
    return [];
  }

  // Problems/Diagnostics (Limited in browser)
  async getProblems(fileUri?: string): Promise<Problem[]> {
    return [];
  }

  // Clipboard Operations
  async getClipboardContent(): Promise<{ text: string; copiedAt: string }> {
    try {
      const text = await navigator.clipboard.readText();
      return { text, copiedAt: new Date().toISOString() };
    } catch (error) {
      console.error('Error reading clipboard:', error);
      return { text: '', copiedAt: new Date().toISOString() };
    }
  }

  // Settings and Configuration
  async isTelemetryEnabled(): Promise<boolean> {
    return false; // Disable telemetry in browser extension
  }

  async isWorkspaceRemote(): Promise<boolean> {
    return false; // Local workspace in browser extension
  }

  // Indexing Operations
  async getTags(artifactId: string): Promise<IndexTag[]> {
    return [];
  }

  // Secret Storage
  async readSecrets(keys: string[]): Promise<Record<string, string>> {
    // Use chrome.storage for secrets
    try {
      const result = await chrome.storage.local.get(keys);
      return result;
    } catch (error) {
      console.error('Error reading secrets:', error);
      return {};
    }
  }

  async writeSecrets(secrets: { [key: string]: string }): Promise<void> {
    // Use chrome.storage for secrets
    try {
      await chrome.storage.local.set(secrets);
    } catch (error) {
      console.error('Error writing secrets:', error);
    }
  }

  // LSP Operations (Limited in browser)
  async gotoDefinition(location: Location): Promise<RangeInFile[]> {
    return [];
  }

  // Callbacks
  onDidChangeActiveTextEditor(callback: (fileUri: string) => void): void {
    // No-op in browser context
    console.log('onDidChangeActiveTextEditor callback registered');
  }
}