"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedContextService = void 0;
const ContextProviderRegistry_1 = require("../context/ContextProviderRegistry");
const promptFormatter_1 = __importDefault(require("../context/utils/promptFormatter"));
const path_1 = __importDefault(require("path"));
class EnhancedContextService {
    constructor(fileService, gitService) {
        this.fileService = fileService;
        this.gitService = gitService;
        this.promptFormatter = new promptFormatter_1.default();
    }
    async getEnhancedContext(options = {}) {
        const { includeGitStatus = true, maxFiles = 20, fileExtensions = [], excludePatterns = [], provider = 'codebase', query = '', includeRepoMap = false, promptFormatting, systemPrompt } = options;
        // Get basic project context (keep existing functionality)
        const basicContext = await this.getBasicProjectContext({
            includeGitStatus,
            maxFiles,
            fileExtensions,
            excludePatterns
        });
        // Get enhanced context using Continue.dev providers
        const contextItems = await this.getContextItems(provider, query);
        // Add repository map if requested
        if (includeRepoMap) {
            const repoMapItems = await this.getContextItems('repo-map', 'entire-codebase');
            contextItems.push(...repoMapItems);
        }
        // Format prompt if requested
        let formattedPrompt;
        if (query && promptFormatting) {
            formattedPrompt = await this.formatPrompt(query, contextItems, promptFormatting, systemPrompt);
        }
        return {
            ...basicContext,
            contextItems,
            formattedPrompt
        };
    }
    async getContextItems(provider, query) {
        try {
            const contextProvider = ContextProviderRegistry_1.contextProviderRegistry.getProvider(provider);
            if (!contextProvider) {
                console.warn(`Context provider '${provider}' not found`);
                return [];
            }
            const workspaceDirs = await this.getWorkspaceDirs();
            const extras = {
                config: {},
                fullInput: query,
                selectedCode: [],
                workspaceDirs
            };
            return await contextProvider.getContextItems(query, extras);
        }
        catch (error) {
            console.error(`Failed to get context items for provider '${provider}':`, error);
            return [];
        }
    }
    async getAvailableProviders() {
        return ContextProviderRegistry_1.contextProviderRegistry.getAllProviderDescriptions();
    }
    async getSubmenuItems(provider) {
        try {
            const contextProvider = ContextProviderRegistry_1.contextProviderRegistry.getProvider(provider);
            if (!contextProvider || !contextProvider.loadSubmenuItems) {
                return [];
            }
            const workspaceDirs = await this.getWorkspaceDirs();
            return await contextProvider.loadSubmenuItems({ workspaceDirs });
        }
        catch (error) {
            console.error(`Failed to get submenu items for provider '${provider}':`, error);
            return [];
        }
    }
    async formatPrompt(userMessage, contextItems, options, systemPrompt) {
        // Use web-friendly formatting instead of API format
        return this.promptFormatter.formatForWebInterface(userMessage, contextItems.map(item => ({
            name: item.name,
            content: item.content,
            description: item.description
        })), systemPrompt);
    }
    async intelligentContextSelection(query, maxItems = 10) {
        const allItems = [];
        // Get items from multiple providers
        const providers = ['codebase', 'file'];
        for (const provider of providers) {
            try {
                const items = await this.getContextItems(provider, query);
                allItems.push(...items);
            }
            catch (error) {
                console.error(`Failed to get items from ${provider}:`, error);
            }
        }
        // Add repository map for additional context
        try {
            const repoMapItems = await this.getContextItems('repo-map', 'entire-codebase');
            allItems.push(...repoMapItems);
        }
        catch (error) {
            console.error('Failed to get repository map:', error);
        }
        // Score and rank items
        const scoredItems = allItems.map(item => ({
            ...item,
            score: this.calculateItemRelevance(item, query)
        }));
        // Sort by score and return top items
        scoredItems.sort((a, b) => b.score - a.score);
        return scoredItems.slice(0, maxItems);
    }
    calculateItemRelevance(item, query) {
        const queryTerms = query.toLowerCase().split(/\s+/);
        let score = 0;
        // Score based on name match
        const nameLower = item.name.toLowerCase();
        for (const term of queryTerms) {
            if (nameLower.includes(term)) {
                score += 10;
            }
        }
        // Score based on description match
        if (item.description) {
            const descLower = item.description.toLowerCase();
            for (const term of queryTerms) {
                if (descLower.includes(term)) {
                    score += 5;
                }
            }
        }
        // Score based on content match (limited to avoid heavy computation)
        const contentSample = item.content.substring(0, 1000).toLowerCase();
        for (const term of queryTerms) {
            const matches = (contentSample.match(new RegExp(term, 'g')) || []).length;
            score += matches * 2;
        }
        // Bonus for certain file types
        if (item.uri?.type === 'file') {
            const ext = path_1.default.extname(item.uri.value);
            const importantExtensions = ['.js', '.ts', '.py', '.java', '.go', '.rs'];
            if (importantExtensions.includes(ext)) {
                score += 3;
            }
        }
        return score;
    }
    // Keep existing basic functionality for backward compatibility
    async getBasicProjectContext(options) {
        const { includeGitStatus = true, maxFiles = 20, fileExtensions = [], excludePatterns = [] } = options;
        // Get project files
        const projectFiles = await this.fileService.getProjectStructure();
        const recentFiles = await this.fileService.getRecentFiles(maxFiles);
        // Get Git information
        const gitStatus = includeGitStatus ? await this.gitService.getStatus() : {
            branch: 'unknown',
            ahead: 0,
            behind: 0,
            staged: [],
            modified: [],
            untracked: [],
            conflicted: []
        };
        // Get recent changes
        const recentChanges = await this.gitService.getChangedFiles();
        // Select most relevant files
        const contextFiles = await this.selectRelevantFiles(recentFiles, maxFiles, fileExtensions, excludePatterns);
        // Generate project structure
        const projectStructure = this.generateProjectStructure(projectFiles);
        // Create summary
        const summary = this.generateProjectSummary(contextFiles, gitStatus);
        return {
            summary,
            files: contextFiles,
            gitStatus,
            recentChanges,
            projectStructure
        };
    }
    async getWorkspaceDirs() {
        // For now, assume current working directory
        // This can be enhanced to detect actual workspace directories
        return [process.cwd()];
    }
    async selectRelevantFiles(files, maxFiles, extensions, excludePatterns) {
        let filteredFiles = files.filter(file => {
            // Filter by extensions if specified
            if (extensions.length > 0) {
                const ext = path_1.default.extname(file.relativePath);
                if (!extensions.includes(ext))
                    return false;
            }
            // Exclude patterns
            if (excludePatterns.some(pattern => file.relativePath.includes(pattern))) {
                return false;
            }
            return true;
        });
        // Sort by relevance (recently modified files first)
        filteredFiles.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
        // Limit number of files
        filteredFiles = filteredFiles.slice(0, maxFiles);
        // Read file contents and create context files
        const contextFiles = [];
        for (const file of filteredFiles) {
            try {
                const content = await this.fileService.readFile(file.relativePath);
                const language = this.detectLanguage(file.relativePath);
                const relevanceScore = this.calculateRelevanceScore(file);
                contextFiles.push({
                    path: file.relativePath,
                    content,
                    language,
                    relevanceScore
                });
            }
            catch (error) {
                console.warn(`Could not read file ${file.relativePath}:`, error);
            }
        }
        return contextFiles.sort((a, b) => b.relevanceScore - a.relevanceScore);
    }
    detectLanguage(filePath) {
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
            '.md': 'markdown'
        };
        return languageMap[ext] || 'text';
    }
    calculateRelevanceScore(file) {
        let score = 0;
        // Recently modified files are more relevant
        const daysSinceModified = (Date.now() - file.mtime.getTime()) / (1000 * 60 * 60 * 24);
        score += Math.max(0, 10 - daysSinceModified);
        // Smaller files are easier to process
        if (file.size < 10000)
            score += 5;
        else if (file.size < 50000)
            score += 3;
        // Prioritize certain file types
        const importantFiles = ['package.json', 'README.md', 'index.js', 'index.ts', 'main.py'];
        if (importantFiles.some(name => file.relativePath.endsWith(name))) {
            score += 10;
        }
        return score;
    }
    generateProjectStructure(files) {
        const structure = {};
        files.forEach(file => {
            const parts = file.relativePath.split(path_1.default.sep);
            let current = structure;
            parts.forEach((part, index) => {
                if (index === parts.length - 1) {
                    current[part] = file.isDirectory ? {} : null;
                }
                else {
                    if (!current[part])
                        current[part] = {};
                    current = current[part];
                }
            });
        });
        return this.formatStructure(structure, '');
    }
    formatStructure(obj, indent) {
        let result = '';
        Object.keys(obj).forEach(key => {
            result += `${indent}${key}\n`;
            if (obj[key] && typeof obj[key] === 'object') {
                result += this.formatStructure(obj[key], indent + '  ');
            }
        });
        return result;
    }
    generateProjectSummary(files, gitStatus) {
        const fileCount = files.length;
        const languages = [...new Set(files.map(f => f.language))];
        const totalLines = files.reduce((sum, f) => sum + f.content.split('\n').length, 0);
        return `Project Summary:
- ${fileCount} relevant files included
- Languages: ${languages.join(', ')}
- Total lines of code: ${totalLines}
- Git branch: ${gitStatus.branch}
- Modified files: ${gitStatus.modified.length}
- Staged files: ${gitStatus.staged.length}`;
    }
}
exports.EnhancedContextService = EnhancedContextService;
//# sourceMappingURL=EnhancedContextService.js.map