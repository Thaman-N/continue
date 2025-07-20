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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Repository Map Context Provider adapted from Continue.dev
const path_1 = __importDefault(require("path"));
const BaseContextProvider_1 = require("../BaseContextProvider");
const generateRepoMap_1 = __importDefault(require("../utils/generateRepoMap"));
const ENTIRE_PROJECT_ITEM = {
    id: "entire-codebase",
    title: "Entire codebase",
    description: "Search the entire codebase",
};
class RepoMapContextProvider extends BaseContextProvider_1.BaseContextProvider {
    async getContextItems(query, extras) {
        try {
            const repoMapContent = await (0, generateRepoMap_1.default)(extras.workspaceDirs, {
                dirUris: query === ENTIRE_PROJECT_ITEM.id ? undefined : [query],
                outputRelativeUriPaths: true,
                includeSignatures: this.options?.includeSignatures ?? true,
            });
            return [
                {
                    name: "Repository Map",
                    description: "Overview of the repository structure",
                    content: repoMapContent,
                },
            ];
        }
        catch (error) {
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
    async loadSubmenuItems(args) {
        const folders = await this.walkDirsForFolders(args.workspaceDirs);
        const withUniquePaths = this.getShortestUniqueRelativeUriPaths(folders, args.workspaceDirs);
        return [
            ENTIRE_PROJECT_ITEM,
            ...withUniquePaths.map((folder) => ({
                id: folder.uri,
                title: this.getUriPathBasename(folder.uri),
                description: folder.uniquePath,
            })),
        ];
    }
    async walkDirsForFolders(workspaceDirs) {
        const allFolders = [];
        for (const dir of workspaceDirs) {
            try {
                const folders = await this.walkDirectoryForFolders(dir, dir);
                allFolders.push(...folders);
            }
            catch (error) {
                console.error(`Failed to walk directory ${dir}:`, error);
            }
        }
        return allFolders;
    }
    async walkDirectoryForFolders(dirPath, rootDir) {
        const folders = [];
        try {
            const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path_1.default.join(dirPath, entry.name);
                if (this.shouldIgnore(entry.name)) {
                    continue;
                }
                if (entry.isDirectory()) {
                    folders.push(fullPath);
                    const subFolders = await this.walkDirectoryForFolders(fullPath, rootDir);
                    folders.push(...subFolders);
                }
            }
        }
        catch (error) {
            console.error(`Failed to read directory ${dirPath}:`, error);
        }
        return folders;
    }
    shouldIgnore(name) {
        const ignorePatterns = [
            'node_modules', '.git', '.DS_Store', '.vscode', '.idea',
            'dist', 'build', 'coverage', '.nyc_output', 'tmp', 'temp'
        ];
        return ignorePatterns.includes(name);
    }
    getShortestUniqueRelativeUriPaths(folders, workspaceDirs) {
        return folders.map(folder => {
            let uniquePath = folder;
            // Find the workspace dir that contains this folder
            for (const workspaceDir of workspaceDirs) {
                if (folder.startsWith(workspaceDir)) {
                    uniquePath = path_1.default.relative(workspaceDir, folder);
                    break;
                }
            }
            return {
                uri: folder,
                uniquePath: uniquePath || path_1.default.basename(folder)
            };
        });
    }
    getUriPathBasename(uri) {
        return path_1.default.basename(uri);
    }
}
RepoMapContextProvider.description = {
    title: "repo-map",
    displayTitle: "Repository Map",
    description: "Select a folder",
    type: "submenu",
};
exports.default = RepoMapContextProvider;
//# sourceMappingURL=RepoMapContextProvider.js.map