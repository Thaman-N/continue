"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileService = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const fast_glob_1 = __importDefault(require("fast-glob"));
const ignore_1 = __importDefault(require("ignore"));
const mime_types_1 = __importDefault(require("mime-types"));
const chokidar_1 = require("chokidar");
class FileService {
    constructor(projectRoot) {
        this.projectRoot = path_1.default.resolve(projectRoot);
        this.initializeGitignore();
    }
    getProjectRoot() {
        return this.projectRoot;
    }
    async initializeGitignore() {
        try {
            const gitignorePath = path_1.default.join(this.projectRoot, '.gitignore');
            const gitignoreContent = await promises_1.default.readFile(gitignorePath, 'utf-8');
            this.gitignore = (0, ignore_1.default)().add(gitignoreContent);
        }
        catch (error) {
            // No .gitignore file, create empty ignore
            this.gitignore = (0, ignore_1.default)();
        }
        // Add common ignore patterns
        this.gitignore.add([
            'node_modules/**',
            '.git/**',
            'dist/**',
            'build/**',
            '*.log',
            '.DS_Store',
            'Thumbs.db'
        ]);
    }
    async getProjectStructure() {
        const files = await (0, fast_glob_1.default)('**/*', {
            cwd: this.projectRoot,
            ignore: ['node_modules/**', '.git/**'],
            dot: false,
            stats: true
        });
        const fileInfos = [];
        for (const file of files) {
            const fullPath = path_1.default.join(this.projectRoot, file.path);
            const relativePath = file.path;
            if (this.gitignore.ignores(relativePath))
                continue;
            try {
                const stats = file.stats;
                const mimeType = mime_types_1.default.lookup(fullPath);
                fileInfos.push({
                    path: fullPath,
                    relativePath,
                    size: stats.size,
                    mtime: stats.mtime,
                    isDirectory: stats.isDirectory(),
                    mimeType
                });
            }
            catch (error) {
                console.warn(`Error processing file ${fullPath}:`, error);
            }
        }
        return fileInfos;
    }
    async fileExists(filePath) {
        const fullPath = path_1.default.resolve(this.projectRoot, filePath);
        // Security check - ensure file is within project root
        const normalizedProjectRoot = path_1.default.normalize(this.projectRoot);
        const normalizedFullPath = path_1.default.normalize(fullPath);
        // Ensure project root ends with separator for proper boundary checking
        const projectRootWithSep = normalizedProjectRoot.endsWith(path_1.default.sep) ? normalizedProjectRoot : normalizedProjectRoot + path_1.default.sep;
        if (!normalizedFullPath.startsWith(normalizedProjectRoot) && !normalizedFullPath.startsWith(projectRootWithSep)) {
            console.error(`Path validation failed: "${normalizedFullPath}" does not start with "${normalizedProjectRoot}"`);
            throw new Error(`Path ${filePath} is outside project boundaries`);
        }
        try {
            await promises_1.default.access(fullPath);
            return true;
        }
        catch (error) {
            return false;
        }
    }
    async readFile(filePath) {
        const fullPath = path_1.default.resolve(this.projectRoot, filePath);
        // Security check - ensure file is within project root
        const normalizedProjectRoot = path_1.default.normalize(this.projectRoot);
        const normalizedFullPath = path_1.default.normalize(fullPath);
        // Ensure project root ends with separator for proper boundary checking
        const projectRootWithSep = normalizedProjectRoot.endsWith(path_1.default.sep) ? normalizedProjectRoot : normalizedProjectRoot + path_1.default.sep;
        if (!normalizedFullPath.startsWith(normalizedProjectRoot) && !normalizedFullPath.startsWith(projectRootWithSep)) {
            console.error(`Path validation failed: "${normalizedFullPath}" does not start with "${normalizedProjectRoot}"`);
            throw new Error(`Path ${filePath} is outside project boundaries`);
        }
        return await promises_1.default.readFile(fullPath, 'utf-8');
    }
    async writeFile(filePath, content) {
        const fullPath = path_1.default.resolve(this.projectRoot, filePath);
        console.log(`WriteFile Debug: filePath="${filePath}", projectRoot="${this.projectRoot}", fullPath="${fullPath}"`);
        // Fix path validation - need to normalize both paths for comparison
        const normalizedProjectRoot = path_1.default.normalize(this.projectRoot);
        const normalizedFullPath = path_1.default.normalize(fullPath);
        if (!normalizedFullPath.startsWith(normalizedProjectRoot)) {
            throw new Error(`Path ${filePath} is outside project boundaries`);
        }
        await promises_1.default.mkdir(path_1.default.dirname(fullPath), { recursive: true });
        await promises_1.default.writeFile(fullPath, content, 'utf-8');
    }
    async getRecentFiles(limit = 10) {
        const files = await this.getProjectStructure();
        return files
            .filter(f => !f.isDirectory && this.isCodeFile(f.relativePath))
            .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
            .slice(0, limit);
    }
    isCodeFile(filePath) {
        const codeExtensions = [
            '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.rs', '.cpp', '.c',
            '.cs', '.php', '.rb', '.swift', '.kt', '.scala', '.clj', '.elm', '.hs',
            '.ml', '.fs', '.jl', '.r', '.sql', '.sh', '.yml', '.yaml', '.json',
            '.xml', '.html', '.css', '.scss', '.less', '.md', '.mdx'
        ];
        return codeExtensions.some(ext => filePath.endsWith(ext));
    }
    watchFiles(callback) {
        const watcher = (0, chokidar_1.watch)(this.projectRoot, {
            ignored: /(^|[\/\\])\../, // ignore dotfiles
            persistent: true,
            ignoreInitial: true
        });
        watcher
            .on('add', path => callback('add', path))
            .on('change', path => callback('change', path))
            .on('unlink', path => callback('unlink', path));
        return watcher;
    }
}
exports.FileService = FileService;
//# sourceMappingURL=FileService.js.map