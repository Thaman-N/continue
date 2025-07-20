"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepoMapGenerator = void 0;
exports.default = generateRepoMap;
// Repository map generator adapted from Continue.dev
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
class RepoMapGenerator {
    constructor(workspaceDirs, options, maxTokens = 8000) {
        this.workspaceDirs = workspaceDirs;
        this.options = options;
        this.maxTokens = maxTokens;
        this.contentTokens = 0;
        this.allUris = [];
        this.pathsInDirsWithSignatures = new Set();
        this.REPO_MAX_CONTEXT_LENGTH_RATIO = 0.5;
        this.PREAMBLE = "Below is a repository map. \n" +
            "For each file in the codebase, " +
            "this map contains the name of the file, and the signature for any " +
            "classes, methods, or functions in the file.\n\n";
        this.maxRepoMapTokens = maxTokens * this.REPO_MAX_CONTEXT_LENGTH_RATIO;
    }
    async generate() {
        const dirs = this.options.dirUris ?? this.workspaceDirs;
        this.allUris = await this.walkDirs(dirs);
        let content = this.PREAMBLE;
        if (this.options.includeSignatures) {
            // For now, we'll implement a simplified version without full AST parsing
            // This can be enhanced later with tree-sitter integration
            content += await this.generateWithSignatures();
        }
        else {
            // Simple file listing
            content += this.generateSimpleMap();
        }
        return content;
    }
    async generateWithSignatures() {
        let content = '';
        for (const uri of this.allUris) {
            try {
                const fileContent = await promises_1.default.readFile(uri, 'utf8');
                const signatures = await this.extractSimpleSignatures(uri, fileContent);
                if (signatures.length > 0) {
                    this.pathsInDirsWithSignatures.add(uri);
                    content += `${this.getUriForWrite(uri)}:\n`;
                    for (const signature of signatures) {
                        content += `\t${signature}\n`;
                    }
                    content += '\n';
                }
                // Check token limit
                if (this.estimateTokens(content) >= this.maxRepoMapTokens) {
                    break;
                }
            }
            catch (error) {
                console.error(`Failed to read file ${uri}:`, error);
            }
        }
        // Add remaining files without signatures
        const urisWithoutSignatures = this.allUris.filter(uri => !this.pathsInDirsWithSignatures.has(uri));
        if (urisWithoutSignatures.length > 0) {
            const remainingFiles = urisWithoutSignatures
                .map(uri => this.getUriForWrite(uri))
                .join('\n');
            if (this.estimateTokens(content + remainingFiles) < this.maxRepoMapTokens) {
                content += remainingFiles;
            }
        }
        return content;
    }
    generateSimpleMap() {
        return this.allUris
            .map(uri => this.getUriForWrite(uri))
            .join('\n');
    }
    async extractSimpleSignatures(filePath, content) {
        const signatures = [];
        const lines = content.split('\n');
        const ext = path_1.default.extname(filePath);
        // Simple regex-based signature extraction
        // This is a simplified version - can be enhanced with tree-sitter later
        if (['.js', '.ts', '.jsx', '.tsx'].includes(ext)) {
            // JavaScript/TypeScript functions and classes
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                // Function declarations
                if (line.match(/^(export\s+)?(async\s+)?function\s+\w+/) ||
                    line.match(/^(const|let|var)\s+\w+\s*=\s*(async\s+)?\(/) ||
                    line.match(/^\w+\s*:\s*(async\s+)?\(/)) {
                    signatures.push(line);
                }
                // Class declarations
                if (line.match(/^(export\s+)?(abstract\s+)?class\s+\w+/)) {
                    signatures.push(line);
                }
                // Interface declarations
                if (line.match(/^(export\s+)?interface\s+\w+/)) {
                    signatures.push(line);
                }
            }
        }
        else if (['.py'].includes(ext)) {
            // Python functions and classes
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.match(/^def\s+\w+/) || trimmed.match(/^class\s+\w+/)) {
                    signatures.push(trimmed);
                }
            }
        }
        else if (['.java', '.cs'].includes(ext)) {
            // Java/C# methods and classes
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.match(/^(public|private|protected|static|\w+)\s+.*\s+\w+\s*\(/) ||
                    trimmed.match(/^(public|private|protected)?\s*(abstract\s+)?class\s+\w+/)) {
                    signatures.push(trimmed);
                }
            }
        }
        else if (['.go'].includes(ext)) {
            // Go functions and types
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.match(/^func\s+/) || trimmed.match(/^type\s+\w+\s+(struct|interface)/)) {
                    signatures.push(trimmed);
                }
            }
        }
        return signatures;
    }
    async walkDirs(dirs) {
        const allFiles = [];
        for (const dir of dirs) {
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
                if (this.shouldIgnore(entry.name)) {
                    continue;
                }
                if (entry.isDirectory()) {
                    const subFiles = await this.walkDirectory(fullPath);
                    files.push(...subFiles);
                }
                else if (entry.isFile() && this.isCodeFile(entry.name)) {
                    files.push(fullPath);
                }
            }
        }
        catch (error) {
            console.error(`Failed to read directory ${dirPath}:`, error);
        }
        return files;
    }
    shouldIgnore(name) {
        const ignorePatterns = [
            'node_modules', '.git', '.DS_Store', '.vscode', '.idea',
            'dist', 'build', 'coverage', '.nyc_output', 'tmp', 'temp'
        ];
        return ignorePatterns.includes(name);
    }
    isCodeFile(filename) {
        const codeExtensions = [
            '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.rs',
            '.cpp', '.c', '.cs', '.php', '.rb', '.swift', '.kt', '.scala'
        ];
        return codeExtensions.some(ext => filename.endsWith(ext));
    }
    getUriForWrite(uri) {
        if (this.options.outputRelativeUriPaths) {
            // Find the workspace dir that contains this file
            for (const workspaceDir of this.workspaceDirs) {
                if (uri.startsWith(workspaceDir)) {
                    return path_1.default.relative(workspaceDir, uri);
                }
            }
        }
        return uri;
    }
    estimateTokens(text) {
        // Simple token estimation: ~4 characters per token
        return Math.ceil(text.length / 4);
    }
}
exports.RepoMapGenerator = RepoMapGenerator;
async function generateRepoMap(workspaceDirs, options, maxTokens) {
    const generator = new RepoMapGenerator(workspaceDirs, options, maxTokens);
    return generator.generate();
}
//# sourceMappingURL=generateRepoMap.js.map