export interface ProjectContext {
  files: FileInfo[];
  gitStatus: GitInfo;
  recentChanges: string[];
}

export interface FileInfo {
  path: string;
  content: string;
  language: string;
  size: number;
}

export interface GitInfo {
  branch: string;
  status: string;
  uncommittedChanges: string[];
}

export interface ServerMessage {
  type: string;
  payload: any;
  timestamp: number;
}

export type LLMProvider = 'chatgpt' | 'claude' | 'gemini';

export interface ProviderConfig {
  inputSelector: string;
  sendButtonSelector: string;
  messageSelector: string;
}
