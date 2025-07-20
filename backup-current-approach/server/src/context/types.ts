// Types adapted from Continue.dev for our browser extension context system

export interface ContextItem {
  name: string;
  description: string;
  content: string;
  uri?: {
    type: 'file' | 'directory' | 'url';
    value: string;
  };
  startLine?: number;
  endLine?: number;
}

export interface ContextSubmenuItem {
  id: string;
  title: string;
  description: string;
}

export interface ContextProviderDescription {
  title: string;
  displayTitle: string;
  description: string;
  type: 'normal' | 'submenu';
  dependsOnIndexing?: boolean;
  renderInlineAs?: string;
}

export interface ContextProviderExtras {
  config: any;
  fullInput: string;
  selectedCode?: any[];
  workspaceDirs: string[];
}

export interface LoadSubmenuItemsArgs {
  workspaceDirs: string[];
}

export interface RepoMapOptions {
  includeSignatures?: boolean;
  dirUris?: string[];
  outputRelativeUriPaths: boolean;
}

export interface ChunkWithoutID {
  content: string;
  startLine: number;
  endLine: number;
}

export interface BranchAndDir {
  directory: string;
  branch: string;
}

// Context provider response interface
export interface ContextProviderResponse {
  items: ContextItem[];
  submenuItems?: ContextSubmenuItem[];
}