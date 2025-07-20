// Repository Map Context Provider adapted from Continue.dev
import path from 'path';
import { BaseContextProvider } from '../BaseContextProvider';
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  ContextSubmenuItem,
  LoadSubmenuItemsArgs,
} from '../types';
import generateRepoMap from '../utils/generateRepoMap';

const ENTIRE_PROJECT_ITEM: ContextSubmenuItem = {
  id: "entire-codebase",
  title: "Entire codebase",
  description: "Search the entire codebase",
};

class RepoMapContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "repo-map",
    displayTitle: "Repository Map",
    description: "Select a folder",
    type: "submenu",
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    try {
      const repoMapContent = await generateRepoMap(
        extras.workspaceDirs,
        {
          dirUris: query === ENTIRE_PROJECT_ITEM.id ? undefined : [query],
          outputRelativeUriPaths: true,
          includeSignatures: this.options?.includeSignatures ?? true,
        }
      );

      return [
        {
          name: "Repository Map",
          description: "Overview of the repository structure",
          content: repoMapContent,
        },
      ];
    } catch (error) {
      console.error('Failed to generate repository map:', error);
      return [
        {
          name: "Repository Map",
          description: "Error generating map",
          content: "Failed to generate repository map. Please check the workspace directories.",
        },
      ];
    }
  }

  async loadSubmenuItems(
    args: LoadSubmenuItemsArgs,
  ): Promise<ContextSubmenuItem[]> {
    const folders = await this.walkDirsForFolders(args.workspaceDirs);
    const withUniquePaths = this.getShortestUniqueRelativeUriPaths(
      folders,
      args.workspaceDirs,
    );

    return [
      ENTIRE_PROJECT_ITEM,
      ...withUniquePaths.map((folder) => ({
        id: folder.uri,
        title: this.getUriPathBasename(folder.uri),
        description: folder.uniquePath,
      })),
    ];
  }

  private async walkDirsForFolders(workspaceDirs: string[]): Promise<string[]> {
    const allFolders: string[] = [];
    
    for (const dir of workspaceDirs) {
      try {
        const folders = await this.walkDirectoryForFolders(dir, dir);
        allFolders.push(...folders);
      } catch (error) {
        console.error(`Failed to walk directory ${dir}:`, error);
      }
    }
    
    return allFolders;
  }

  private async walkDirectoryForFolders(dirPath: string, rootDir: string): Promise<string[]> {
    const folders: string[] = [];
    
    try {
      const fs = await import('fs/promises');
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (this.shouldIgnore(entry.name)) {
          continue;
        }
        
        if (entry.isDirectory()) {
          folders.push(fullPath);
          const subFolders = await this.walkDirectoryForFolders(fullPath, rootDir);
          folders.push(...subFolders);
        }
      }
    } catch (error) {
      console.error(`Failed to read directory ${dirPath}:`, error);
    }
    
    return folders;
  }

  private shouldIgnore(name: string): boolean {
    const ignorePatterns = [
      'node_modules', '.git', '.DS_Store', '.vscode', '.idea',
      'dist', 'build', 'coverage', '.nyc_output', 'tmp', 'temp'
    ];
    return ignorePatterns.includes(name);
  }

  private getShortestUniqueRelativeUriPaths(
    folders: string[],
    workspaceDirs: string[],
  ): Array<{ uri: string; uniquePath: string }> {
    return folders.map(folder => {
      let uniquePath = folder;
      
      // Find the workspace dir that contains this folder
      for (const workspaceDir of workspaceDirs) {
        if (folder.startsWith(workspaceDir)) {
          uniquePath = path.relative(workspaceDir, folder);
          break;
        }
      }
      
      return {
        uri: folder,
        uniquePath: uniquePath || path.basename(folder)
      };
    });
  }

  private getUriPathBasename(uri: string): string {
    return path.basename(uri);
  }
}

export default RepoMapContextProvider;