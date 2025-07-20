// Service for applying AI-generated code changes to local files
import * as fs from 'fs/promises';
import * as path from 'path';
import { FileChange } from './ResponseExtractor';

export interface ApplicationResult {
  success: boolean;
  filePath: string;
  changeType: 'create' | 'update' | 'delete';
  error?: string;
  backupPath?: string;
  linesChanged?: number;
}

export interface ApplicationSummary {
  totalChanges: number;
  successful: number;
  failed: number;
  results: ApplicationResult[];
  backupDirectory?: string;
}

export interface DiffPreview {
  filePath: string;
  originalContent: string;
  newContent: string;
  changeType: 'create' | 'update' | 'delete';
  lineChanges: Array<{
    type: 'add' | 'remove' | 'modify';
    lineNumber: number;
    content: string;
  }>;
}

export class FileApplicator {
  private projectRoot: string;
  private backupDirectory: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.backupDirectory = path.join(projectRoot, '.ai-assistant-backups');
  }

  /**
   * Apply all file changes with backup and preview
   */
  async applyFileChanges(
    fileChanges: FileChange[], 
    options: {
      createBackups?: boolean;
      dryRun?: boolean;
      confirmEach?: boolean;
    } = {}
  ): Promise<ApplicationSummary> {
    const { createBackups = true, dryRun = false } = options;
    
    if (createBackups && !dryRun) {
      await this.ensureBackupDirectory();
    }

    const results: ApplicationResult[] = [];
    let successful = 0;
    let failed = 0;

    for (const change of fileChanges) {
      try {
        const result = await this.applySingleChange(change, { createBackups, dryRun });
        results.push(result);
        
        if (result.success) {
          successful++;
        } else {
          failed++;
        }
      } catch (error) {
        const errorResult: ApplicationResult = {
          success: false,
          filePath: change.path,
          changeType: change.type,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
        results.push(errorResult);
        failed++;
      }
    }

    return {
      totalChanges: fileChanges.length,
      successful,
      failed,
      results,
      backupDirectory: createBackups ? this.backupDirectory : undefined
    };
  }

  /**
   * Generate diff preview for all changes
   */
  async generateDiffPreviews(fileChanges: FileChange[]): Promise<DiffPreview[]> {
    const previews: DiffPreview[] = [];

    for (const change of fileChanges) {
      try {
        const preview = await this.generateSingleDiffPreview(change);
        previews.push(preview);
      } catch (error) {
        console.error(`Failed to generate preview for ${change.path}:`, error);
      }
    }

    return previews;
  }

  /**
   * Apply a single file change
   */
  private async applySingleChange(
    change: FileChange,
    options: { createBackups: boolean; dryRun: boolean }
  ): Promise<ApplicationResult> {
    const { createBackups, dryRun } = options;

    // Ensure the file path is within project bounds
    if (!this.isPathSafe(change.path)) {
      throw new Error(`Path ${change.path} is outside project boundaries`);
    }

    let backupPath: string | undefined;

    try {
      switch (change.type) {
        case 'create':
          return await this.createFile(change, { createBackups, dryRun });
          
        case 'update':
          if (createBackups && !dryRun) {
            backupPath = await this.createBackup(change.path);
          }
          return await this.updateFile(change, { dryRun, backupPath });
          
        case 'delete':
          if (createBackups && !dryRun) {
            backupPath = await this.createBackup(change.path);
          }
          return await this.deleteFile(change, { dryRun, backupPath });
          
        default:
          throw new Error(`Unknown change type: ${change.type}`);
      }
    } catch (error) {
      return {
        success: false,
        filePath: change.path,
        changeType: change.type,
        error: error instanceof Error ? error.message : 'Unknown error',
        backupPath
      };
    }
  }

  /**
   * Create a new file
   */
  private async createFile(
    change: FileChange,
    options: { createBackups: boolean; dryRun: boolean }
  ): Promise<ApplicationResult> {
    const { dryRun } = options;

    // Check if file already exists
    try {
      await fs.access(change.path);
      throw new Error('File already exists');
    } catch (error) {
      // File doesn't exist, which is what we want for creation
    }

    if (!dryRun) {
      // Ensure directory exists
      const directory = path.dirname(change.path);
      await fs.mkdir(directory, { recursive: true });
      
      // Write the file
      await fs.writeFile(change.path, change.content, 'utf8');
    }

    return {
      success: true,
      filePath: change.path,
      changeType: 'create',
      linesChanged: change.content.split('\n').length
    };
  }

  /**
   * Update an existing file
   */
  private async updateFile(
    change: FileChange,
    options: { dryRun: boolean; backupPath?: string }
  ): Promise<ApplicationResult> {
    const { dryRun, backupPath } = options;

    if (change.isPartialChange && change.lineRange) {
      return await this.updateFilePartial(change, options);
    } else {
      return await this.updateFileFull(change, options);
    }
  }

  /**
   * Update file with full content replacement
   */
  private async updateFileFull(
    change: FileChange,
    options: { dryRun: boolean; backupPath?: string }
  ): Promise<ApplicationResult> {
    const { dryRun, backupPath } = options;

    if (!dryRun) {
      await fs.writeFile(change.path, change.content, 'utf8');
    }

    return {
      success: true,
      filePath: change.path,
      changeType: 'update',
      backupPath,
      linesChanged: change.content.split('\n').length
    };
  }

  /**
   * Update file with partial content (specific line ranges)
   */
  private async updateFilePartial(
    change: FileChange,
    options: { dryRun: boolean; backupPath?: string }
  ): Promise<ApplicationResult> {
    const { dryRun, backupPath } = options;

    if (!change.lineRange) {
      throw new Error('Line range required for partial update');
    }

    const originalContent = await fs.readFile(change.path, 'utf8');
    const originalLines = originalContent.split('\n');
    const newLines = change.content.split('\n');

    // Replace the specified line range
    const updatedLines = [
      ...originalLines.slice(0, change.lineRange.start - 1),
      ...newLines,
      ...originalLines.slice(change.lineRange.end)
    ];

    const updatedContent = updatedLines.join('\n');

    if (!dryRun) {
      await fs.writeFile(change.path, updatedContent, 'utf8');
    }

    return {
      success: true,
      filePath: change.path,
      changeType: 'update',
      backupPath,
      linesChanged: newLines.length
    };
  }

  /**
   * Delete a file
   */
  private async deleteFile(
    change: FileChange,
    options: { dryRun: boolean; backupPath?: string }
  ): Promise<ApplicationResult> {
    const { dryRun, backupPath } = options;

    if (!dryRun) {
      await fs.unlink(change.path);
    }

    return {
      success: true,
      filePath: change.path,
      changeType: 'delete',
      backupPath
    };
  }

  /**
   * Create backup of existing file
   */
  private async createBackup(filePath: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = path.basename(filePath);
    const backupFileName = `${fileName}.${timestamp}.backup`;
    const backupPath = path.join(this.backupDirectory, backupFileName);

    try {
      const content = await fs.readFile(filePath, 'utf8');
      await fs.writeFile(backupPath, content, 'utf8');
      return backupPath;
    } catch (error) {
      throw new Error(`Failed to create backup: ${error}`);
    }
  }

  /**
   * Generate diff preview for a single change
   */
  private async generateSingleDiffPreview(change: FileChange): Promise<DiffPreview> {
    let originalContent = '';
    
    try {
      originalContent = await fs.readFile(change.path, 'utf8');
    } catch {
      // File doesn't exist (for create operations)
    }

    let newContent = change.content;
    
    if (change.isPartialChange && change.lineRange && originalContent) {
      const originalLines = originalContent.split('\n');
      const newLines = change.content.split('\n');
      
      const updatedLines = [
        ...originalLines.slice(0, change.lineRange.start - 1),
        ...newLines,
        ...originalLines.slice(change.lineRange.end)
      ];
      
      newContent = updatedLines.join('\n');
    }

    const lineChanges = this.calculateLineChanges(originalContent, newContent);

    return {
      filePath: change.path,
      originalContent,
      newContent,
      changeType: change.type,
      lineChanges
    };
  }

  /**
   * Calculate line-by-line changes for diff display
   */
  private calculateLineChanges(
    original: string, 
    updated: string
  ): Array<{ type: 'add' | 'remove' | 'modify'; lineNumber: number; content: string; }> {
    const originalLines = original.split('\n');
    const updatedLines = updated.split('\n');
    const changes: Array<{ type: 'add' | 'remove' | 'modify'; lineNumber: number; content: string; }> = [];

    const maxLines = Math.max(originalLines.length, updatedLines.length);

    for (let i = 0; i < maxLines; i++) {
      const originalLine = originalLines[i];
      const updatedLine = updatedLines[i];

      if (originalLine === undefined) {
        // Line added
        changes.push({
          type: 'add',
          lineNumber: i + 1,
          content: updatedLine
        });
      } else if (updatedLine === undefined) {
        // Line removed
        changes.push({
          type: 'remove',
          lineNumber: i + 1,
          content: originalLine
        });
      } else if (originalLine !== updatedLine) {
        // Line modified
        changes.push({
          type: 'modify',
          lineNumber: i + 1,
          content: updatedLine
        });
      }
    }

    return changes;
  }

  /**
   * Ensure backup directory exists
   */
  private async ensureBackupDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.backupDirectory, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create backup directory: ${error}`);
    }
  }

  /**
   * Check if file path is within project boundaries
   */
  private isPathSafe(filePath: string): boolean {
    const resolvedPath = path.resolve(filePath);
    const resolvedProjectRoot = path.resolve(this.projectRoot);
    
    return resolvedPath.startsWith(resolvedProjectRoot);
  }

  /**
   * Restore files from backup
   */
  async restoreFromBackup(backupPath: string, originalPath: string): Promise<void> {
    try {
      const backupContent = await fs.readFile(backupPath, 'utf8');
      await fs.writeFile(originalPath, backupContent, 'utf8');
    } catch (error) {
      throw new Error(`Failed to restore from backup: ${error}`);
    }
  }

  /**
   * List available backups for a file
   */
  async listBackups(filePath: string): Promise<string[]> {
    try {
      const fileName = path.basename(filePath);
      const backupFiles = await fs.readdir(this.backupDirectory);
      
      return backupFiles
        .filter(file => file.startsWith(fileName))
        .map(file => path.join(this.backupDirectory, file))
        .sort((a, b) => b.localeCompare(a)); // Sort by timestamp (newest first)
    } catch {
      return [];
    }
  }
}