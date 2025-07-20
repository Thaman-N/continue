"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Codebase Context Provider adapted from Continue.dev (simplified without embeddings)
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const BaseContextProvider_1 = require("../BaseContextProvider");
class CodebaseContextProvider extends BaseContextProvider_1.BaseContextProvider {
    async getContextItems(query, extras) {
        // Simple keyword-based search until we implement embeddings
        return this.simpleTextSearch(query, extras.workspaceDirs);
    }
    async simpleTextSearch(query, workspaceDirs) {
        const results = [];
        const searchTerms = query.toLowerCase().split(/\s+/);
        const maxResults = 15;
        for (const workspaceDir of workspaceDirs) {
            try {
                const files = await this.findCodeFiles(workspaceDir);
                for (const file of files.slice(0, 100)) { // Limit for performance
                    try {
                        const content = await promises_1.default.readFile(file, 'utf8');
                        const score = this.calculateRelevanceScore(content, searchTerms);
                        if (score > 0) {
                            const relativePath = path_1.default.relative(workspaceDir, file);
                            const chunks = this.extractRelevantChunks(content, searchTerms);
                            results.push({
                                name: path_1.default.basename(file),
                                description: relativePath,
                                content: `\`\`\`${this.getLanguageFromExtension(file)}\n${chunks}\n\`\`\``,
                                uri: {
                                    type: 'file',
                                    value: file,
                                },
                            });
                        }
                    }
                    catch (error) {
                        // Skip files that can't be read
                        continue;
                    }
                }
            }
            catch (error) {
                console.error(`Failed to search in ${workspaceDir}:`, error);
            }
        }
        // Sort by relevance and return top results
        results.sort((a, b) => this.calculateScore(b.content, searchTerms) - this.calculateScore(a.content, searchTerms));
        return results.slice(0, maxResults);
    }
    async findCodeFiles(dirPath) {
        const files = [];
        try {
            const entries = await promises_1.default.readdir(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path_1.default.join(dirPath, entry.name);
                if (this.shouldIgnore(entry.name)) {
                    continue;
                }
                if (entry.isDirectory()) {
                    const subFiles = await this.findCodeFiles(fullPath);
                    files.push(...subFiles);
                }
                else if (entry.isFile() && this.isCodeFile(entry.name)) {
                    files.push(fullPath);
                }
            }
        }
        catch (error) {
            // Skip directories that can't be read
        }
        return files;
    }
    shouldIgnore(name) {
        const ignorePatterns = [
            'node_modules', '.git', '.DS_Store', '.vscode', '.idea',
            'dist', 'build', 'coverage', '.nyc_output', 'tmp', 'temp',
            '.next', '.nuxt', '.output', 'vendor'
        ];
        return ignorePatterns.includes(name) || name.startsWith('.');
    }
    isCodeFile(filename) {
        const codeExtensions = [
            '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.rs',
            '.cpp', '.c', '.cs', '.php', '.rb', '.swift', '.kt', '.scala',
            '.html', '.css', '.scss', '.vue', '.svelte', '.md', '.json',
            '.yaml', '.yml', '.xml', '.sql'
        ];
        return codeExtensions.some(ext => filename.endsWith(ext));
    }
    calculateRelevanceScore(content, searchTerms) {
        const contentLower = content.toLowerCase();
        let score = 0;
        for (const term of searchTerms) {
            const matches = (contentLower.match(new RegExp(term, 'g')) || []).length;
            score += matches;
        }
        return score;
    }
    calculateScore(content, searchTerms) {
        return this.calculateRelevanceScore(content, searchTerms);
    }
    extractRelevantChunks(content, searchTerms) {
        const lines = content.split('\n');
        const relevantLines = [];
        // Find lines that contain search terms
        lines.forEach((line, index) => {
            const lineLower = line.toLowerCase();
            let score = 0;
            for (const term of searchTerms) {
                if (lineLower.includes(term)) {
                    score += 1;
                }
            }
            if (score > 0) {
                relevantLines.push({ index, line, score });
            }
        });
        if (relevantLines.length === 0) {
            // If no specific matches, return first part of file
            return lines.slice(0, 50).join('\n');
        }
        // Extract chunks around relevant lines
        const chunks = [];
        const contextLines = 3;
        for (const relevant of relevantLines.slice(0, 5)) { // Limit chunks
            const start = Math.max(0, relevant.index - contextLines);
            const end = Math.min(lines.length, relevant.index + contextLines + 1);
            const chunk = lines.slice(start, end).join('\n');
            if (!chunks.includes(chunk)) {
                chunks.push(chunk);
            }
        }
        return chunks.join('\n\n...\n\n');
    }
    getLanguageFromExtension(filePath) {
        const ext = path_1.default.extname(filePath).toLowerCase();
        const languageMap = {
            '.js': 'javascript',
            '.ts': 'typescript',
            '.jsx': 'jsx',
            '.tsx': 'tsx',
            '.py': 'python',
            '.java': 'java',
            '.go': 'go',
            '.rs': 'rust',
            '.cpp': 'cpp',
            '.c': 'c',
            '.cs': 'csharp',
            '.php': 'php',
            '.rb': 'ruby',
            '.swift': 'swift',
            '.kt': 'kotlin',
            '.scala': 'scala',
            '.html': 'html',
            '.css': 'css',
            '.scss': 'scss',
            '.md': 'markdown',
            '.json': 'json',
            '.yaml': 'yaml',
            '.yml': 'yaml',
            '.xml': 'xml',
            '.sql': 'sql'
        };
        return languageMap[ext] || 'text';
    }
}
CodebaseContextProvider.description = {
    title: "codebase",
    displayTitle: "Codebase",
    description: "Automatically find relevant files",
    type: "normal",
    renderInlineAs: "",
};
exports.default = CodebaseContextProvider;
//# sourceMappingURL=CodebaseContextProvider.js.map