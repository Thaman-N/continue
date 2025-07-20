"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// File Context Provider adapted from Continue.dev
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const BaseContextProvider_1 = require("../BaseContextProvider");
const MAX_SUBMENU_ITEMS = 10000;
class FileContextProvider extends BaseContextProvider_1.BaseContextProvider {
    async getContextItems(query, extras) {
        // Check if query looks like a file path
        const fileUri = query.trim();
        // Skip if query doesn't look like a file path
        if (!this.looksLikeFilePath(fileUri)) {
            console.log(`FileContextProvider: Skipping non-file query: "${fileUri}"`);
            return [];
        }
        try {
            const content = await promises_1.default.readFile(fileUri, 'utf8');
            const { relativePathOrBasename, last2Parts, baseName } = this.getUriDescription(fileUri, extras.workspaceDirs);
            return [
                {
                    name: baseName,
                    description: last2Parts,
                    content: `\`\`\`${relativePathOrBasename}\n${content}\n\`\`\``,
                    uri: {
                        type: "file",
                        value: fileUri,
                    },
                },
            ];
        }
        catch (error) {
            console.error(`Failed to read file ${fileUri}:`, error);
            return [];
        }
    }
    looksLikeFilePath(query) {
        // Check if query has file extension
        if (/\.[a-zA-Z0-9]+$/.test(query)) {
            return true;
        }
        // Check if query has path separators
        if (query.includes('/') || query.includes('\\')) {
            return true;
        }
        // Check if query starts with common path prefixes
        if (query.startsWith('./') || query.startsWith('../') || query.startsWith('/')) {
            return true;
        }
        // Single words without extensions are likely not file paths
        if (!query.includes(' ') && !query.includes('.') && !query.includes('/')) {
            return false;
        }
        return true;
    }
    async loadSubmenuItems(args) {
        const results = await this.walkDirs(args.workspaceDirs);
        const files = results.flat().slice(-MAX_SUBMENU_ITEMS);
        const withUniquePaths = this.getShortestUniqueRelativeUriPaths(files, args.workspaceDirs);
        return withUniquePaths.map((file) => {
            return {
                id: file.uri,
                title: this.getUriPathBasename(file.uri),
                description: file.uniquePath,
            };
        });
    }
    async walkDirs(workspaceDirs) {
        const allFiles = [];
        for (const dir of workspaceDirs) {
            try {
                const files = await this.walkDirectory(dir);
                allFiles.push(...files);
            }
            catch (error) {
                console.error(`Failed to walk directory ${dir}:`, error);
            }
        }
        return allFiles;
    }
    async walkDirectory(dirPath) {
        const files = [];
        try {
            const entries = await promises_1.default.readdir(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path_1.default.join(dirPath, entry.name);
                // Skip hidden files and common ignore patterns
                if (this.shouldIgnore(entry.name, fullPath)) {
                    continue;
                }
                if (entry.isDirectory()) {
                    const subFiles = await this.walkDirectory(fullPath);
                    files.push(...subFiles);
                }
                else if (entry.isFile()) {
                    files.push(fullPath);
                }
            }
        }
        catch (error) {
            console.error(`Failed to read directory ${dirPath}:`, error);
        }
        return files;
    }
    shouldIgnore(name, fullPath) {
        const ignorePatterns = [
            'node_modules',
            '.git',
            '.DS_Store',
            '.vscode',
            '.idea',
            'dist',
            'build',
            'coverage',
            '.nyc_output',
            'tmp',
            'temp',
            '*.log',
            '.env',
            '.env.local'
        ];
        return ignorePatterns.some(pattern => {
            if (pattern.includes('*')) {
                const regex = new RegExp(pattern.replace(/\*/g, '.*'));
                return regex.test(name);
            }
            return name === pattern || fullPath.includes(`/${pattern}/`) || fullPath.includes(`\\${pattern}\\`);
        });
    }
    getUriDescription(uri, workspaceDirs) {
        const baseName = path_1.default.basename(uri);
        let relativePathOrBasename = baseName;
        let last2Parts = baseName;
        // Find the workspace dir that contains this file
        for (const workspaceDir of workspaceDirs) {
            if (uri.startsWith(workspaceDir)) {
                const relativePath = path_1.default.relative(workspaceDir, uri);
                relativePathOrBasename = relativePath;
                const parts = relativePath.split(path_1.default.sep);
                if (parts.length >= 2) {
                    last2Parts = path_1.default.join(...parts.slice(-2));
                }
                else {
                    last2Parts = relativePath;
                }
                break;
            }
        }
        return { relativePathOrBasename, last2Parts, baseName };
    }
    getShortestUniqueRelativeUriPaths(files, workspaceDirs) {
        return files.map(file => {
            const { relativePathOrBasename } = this.getUriDescription(file, workspaceDirs);
            return {
                uri: file,
                uniquePath: relativePathOrBasename
            };
        });
    }
    getUriPathBasename(uri) {
        return path_1.default.basename(uri);
    }
}
FileContextProvider.description = {
    title: "file",
    displayTitle: "Files",
    description: "Type to search",
    type: "submenu",
};
exports.default = FileContextProvider;
//# sourceMappingURL=FileContextProvider.js.map