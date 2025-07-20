// Simplified Continue core types for browser extension
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LLMFullCompletionOptions {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
}

export interface CompletionOptions {
  model: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
}

// Basic IDE interfaces
export interface IdeInfo {
  ideType: string;
  name: string;
  version: string;
  remoteName: string;
  extensionVersion: string;
  isPrerelease: boolean;
}

export interface IdeSettings {
  remoteConfigServerUrl?: string;
  remoteConfigSyncPeriod: number;
  userToken: string;
  continueTestEnvironment: string;
  pauseCodebaseIndexOnStart: boolean;
}

export interface Range {
  start: { line: number; character: number };
  end: { line: number; character: number };
}

export interface Problem {
  filepath: string;
  range: Range;
  message: string;
  severity: string;
}

export interface IndexTag {
  id: string;
  name: string;
}

export type ToastType = 'info' | 'warning' | 'error';

export interface Thread {
  id: string;
  name: string;
}

export interface ContinueRcJson {
  [key: string]: any;
}

export interface Location {
  filepath: string;
  position: { line: number; character: number };
}

export interface RangeInFile {
  filepath: string;
  range: Range;
}

export type FileType = 'file' | 'directory';

export interface FileStatsMap {
  [filepath: string]: {
    size: number;
    lastModified: number;
  };
}

export interface TerminalOptions {
  cwd?: string;
}

// Simple logger interface
export interface ILLMLogger {
  createInteractionLog(): {
    logItem: (item: any) => void;
  };
}

// IDE interface
export interface IDE {
  getIdeInfo(): Promise<IdeInfo>;
  getIdeSettings(): Promise<IdeSettings>;
  getUniqueId(): Promise<string>;
  getWorkspaceDirs(): Promise<string[]>;
  getWorkspaceConfigs(): Promise<ContinueRcJson[]>;
  fileExists(fileUri: string): Promise<boolean>;
  readFile(fileUri: string): Promise<string>;
  writeFile(path: string, contents: string): Promise<void>;
  readRangeInFile(fileUri: string, range: Range): Promise<string>;
  listDir(dir: string): Promise<[string, FileType][]>;
  getFileStats(files: string[]): Promise<FileStatsMap>;
  getDiff(includeUnstaged: boolean): Promise<string[]>;
  getBranch(dir: string): Promise<string>;
  getGitRootPath(dir: string): Promise<string | undefined>;
  getRepoName(dir: string): Promise<string | undefined>;
  getSearchResults(query: string, maxResults?: number): Promise<string>;
  getFileResults(pattern: string, maxResults?: number): Promise<string[]>;
  showVirtualFile(title: string, contents: string): Promise<void>;
  openFile(path: string): Promise<void>;
  openUrl(url: string): Promise<void>;
  showToast(type: ToastType, message: string, ...otherParams: any[]): Promise<void>;
  showLines(fileUri: string, startLine: number, endLine: number): Promise<void>;
  getCurrentFile(): Promise<{ isUntitled: boolean; path: string; contents: string; } | undefined>;
  getOpenFiles(): Promise<string[]>;
  getPinnedFiles(): Promise<string[]>;
  saveFile(fileUri: string): Promise<void>;
  getTerminalContents(): Promise<string>;
  runCommand(command: string, options?: TerminalOptions): Promise<void>;
  subprocess(command: string, cwd?: string): Promise<[string, string]>;
  getDebugLocals(threadIndex: number): Promise<string>;
  getTopLevelCallStackSources(threadIndex: number, stackDepth: number): Promise<string[]>;
  getAvailableThreads(): Promise<Thread[]>;
  getProblems(fileUri?: string): Promise<Problem[]>;
  getClipboardContent(): Promise<{ text: string; copiedAt: string }>;
  isTelemetryEnabled(): Promise<boolean>;
  isWorkspaceRemote(): Promise<boolean>;
  getTags(artifactId: string): Promise<IndexTag[]>;
  readSecrets(keys: string[]): Promise<Record<string, string>>;
  writeSecrets(secrets: { [key: string]: string }): Promise<void>;
  gotoDefinition(location: Location): Promise<RangeInFile[]>;
  onDidChangeActiveTextEditor(callback: (fileUri: string) => void): void;
}

// Configuration interfaces (simplified for browser extension)
export interface ContinueConfig {
  allowAnonymousTelemetry?: boolean;
  slashCommands: any[];
  contextProviders: any[];
  tools: any[];
  mcpServerStatuses: any[];
  rules: any[];
  modelsByRole: Record<string, any>;
  selectedModelByRole: Record<string, any>;
  docs: any[];
  experimental: any;
  tabAutocompleteOptions?: any;
}

export interface BrowserSerializedContinueConfig {
  allowAnonymousTelemetry: boolean;
  slashCommands: any[];
  contextProviders: any[];
  tools: any[];
  mcpServerStatuses: any[];
  rules: any[];
  usePlatform: boolean;
  tabAutocompleteOptions?: any;
  modelsByRole: Record<string, any>;
  selectedModelByRole: Record<string, any>;
  docs: any[];
  experimental: any;
}

// Re-export the default config we need
export { defaultConfig } from '../continue/core/config/default';