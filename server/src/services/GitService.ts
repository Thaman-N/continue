import simpleGit, { SimpleGit, StatusResult, DiffResult } from 'simple-git';
import path from 'path';

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: string[];
  modified: string[];
  untracked: string[];
  conflicted: string[];
}

export class GitService {
  private git: SimpleGit;
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.git = simpleGit(projectRoot);
  }

  async getStatus(): Promise<GitStatus> {
    try {
      const status = await this.git.status();
      const branch = await this.git.revparse(['--abbrev-ref', 'HEAD']);
      
      return {
        branch: branch.trim(),
        ahead: status.ahead,
        behind: status.behind,
        staged: status.staged,
        modified: status.modified,
        untracked: status.not_added,
        conflicted: status.conflicted
      };
    } catch (error) {
      console.error('Git status error:', error);
      return {
        branch: 'unknown',
        ahead: 0,
        behind: 0,
        staged: [],
        modified: [],
        untracked: [],
        conflicted: []
      };
    }
  }

  async getDiff(filePath?: string): Promise<string> {
    try {
      if (filePath) {
        return await this.git.diff(['HEAD', '--', filePath]);
      }
      return await this.git.diff(['HEAD']);
    } catch (error) {
      console.error('Git diff error:', error);
      return '';
    }
  }

  async getRecentCommits(limit: number = 10): Promise<any[]> {
    try {
      const log = await this.git.log({ maxCount: limit });
      return [...log.all]; // Spread to make it mutable
    } catch (error) {
      console.error('Git log error:', error);
      return [];
    }
  }

  async getChangedFiles(since: string = 'HEAD~1'): Promise<string[]> {
    try {
      const diff = await this.git.diff([since, '--name-only']);
      return diff.split('\n').filter(line => line.trim());
    } catch (error) {
      console.error('Git changed files error:', error);
      return [];
    }
  }
}
