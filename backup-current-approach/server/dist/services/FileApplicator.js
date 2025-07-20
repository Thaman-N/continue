"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileApplicator = void 0;
// Service for applying AI-generated code changes to local files
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
class FileApplicator {
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
        this.backupDirectory = path.join(projectRoot, '.ai-assistant-backups');
    }
    /**
     * Apply all file changes with backup and preview
     */
    async applyFileChanges(fileChanges, options = {}) {
        const { createBackups = true, dryRun = false } = options;
        if (createBackups && !dryRun) {
            await this.ensureBackupDirectory();
        }
        const results = [];
        let successful = 0;
        let failed = 0;
        for (const change of fileChanges) {
            try {
                const result = await this.applySingleChange(change, { createBackups, dryRun });
                results.push(result);
                if (result.success) {
                    successful++;
                }
                else {
                    failed++;
                }
            }
            catch (error) {
                const errorResult = {
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
    async generateDiffPreviews(fileChanges) {
        const previews = [];
        for (const change of fileChanges) {
            try {
                const preview = await this.generateSingleDiffPreview(change);
                previews.push(preview);
            }
            catch (error) {
                console.error(`Failed to generate preview for ${change.path}:`, error);
            }
        }
        return previews;
    }
    /**
     * Apply a single file change
     */
    async applySingleChange(change, options) {
        const { createBackups, dryRun } = options;
        // Ensure the file path is within project bounds
        if (!this.isPathSafe(change.path)) {
            throw new Error(`Path ${change.path} is outside project boundaries`);
        }
        let backupPath;
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
        }
        catch (error) {
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
    async createFile(change, options) {
        const { dryRun } = options;
        // Check if file already exists
        try {
            await fs.access(change.path);
            throw new Error('File already exists');
        }
        catch (error) {
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
    async updateFile(change, options) {
        const { dryRun, backupPath } = options;
        if (change.isPartialChange && change.lineRange) {
            return await this.updateFilePartial(change, options);
        }
        else {
            return await this.updateFileFull(change, options);
        }
    }
    /**
     * Update file with full content replacement
     */
    async updateFileFull(change, options) {
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
    async updateFilePartial(change, options) {
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
    async deleteFile(change, options) {
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
    async createBackup(filePath) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = path.basename(filePath);
        const backupFileName = `${fileName}.${timestamp}.backup`;
        const backupPath = path.join(this.backupDirectory, backupFileName);
        try {
            const content = await fs.readFile(filePath, 'utf8');
            await fs.writeFile(backupPath, content, 'utf8');
            return backupPath;
        }
        catch (error) {
            throw new Error(`Failed to create backup: ${error}`);
        }
    }
    /**
     * Generate diff preview for a single change
     */
    async generateSingleDiffPreview(change) {
        let originalContent = '';
        try {
            originalContent = await fs.readFile(change.path, 'utf8');
        }
        catch {
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
    calculateLineChanges(original, updated) {
        const originalLines = original.split('\n');
        const updatedLines = updated.split('\n');
        const changes = [];
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
            }
            else if (updatedLine === undefined) {
                // Line removed
                changes.push({
                    type: 'remove',
                    lineNumber: i + 1,
                    content: originalLine
                });
            }
            else if (originalLine !== updatedLine) {
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
    async ensureBackupDirectory() {
        try {
            await fs.mkdir(this.backupDirectory, { recursive: true });
        }
        catch (error) {
            throw new Error(`Failed to create backup directory: ${error}`);
        }
    }
    /**
     * Check if file path is within project boundaries
     */
    isPathSafe(filePath) {
        const resolvedPath = path.resolve(filePath);
        const resolvedProjectRoot = path.resolve(this.projectRoot);
        return resolvedPath.startsWith(resolvedProjectRoot);
    }
    /**
     * Restore files from backup
     */
    async restoreFromBackup(backupPath, originalPath) {
        try {
            const backupContent = await fs.readFile(backupPath, 'utf8');
            await fs.writeFile(originalPath, backupContent, 'utf8');
        }
        catch (error) {
            throw new Error(`Failed to restore from backup: ${error}`);
        }
    }
    /**
     * List available backups for a file
     */
    async listBackups(filePath) {
        try {
            const fileName = path.basename(filePath);
            const backupFiles = await fs.readdir(this.backupDirectory);
            return backupFiles
                .filter(file => file.startsWith(fileName))
                .map(file => path.join(this.backupDirectory, file))
                .sort((a, b) => b.localeCompare(a)); // Sort by timestamp (newest first)
        }
        catch {
            return [];
        }
    }
}
exports.FileApplicator = FileApplicator;
//# sourceMappingURL=FileApplicator.js.map