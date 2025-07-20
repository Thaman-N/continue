"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitService = void 0;
const simple_git_1 = __importDefault(require("simple-git"));
class GitService {
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
        this.git = (0, simple_git_1.default)(projectRoot);
    }
    async getStatus() {
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
        }
        catch (error) {
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
    async getDiff(filePath) {
        try {
            if (filePath) {
                return await this.git.diff(['HEAD', '--', filePath]);
            }
            return await this.git.diff(['HEAD']);
        }
        catch (error) {
            console.error('Git diff error:', error);
            return '';
        }
    }
    async getRecentCommits(limit = 10) {
        try {
            const log = await this.git.log({ maxCount: limit });
            return [...log.all]; // Spread to make it mutable
        }
        catch (error) {
            console.error('Git log error:', error);
            return [];
        }
    }
    async getChangedFiles(since = 'HEAD~1') {
        try {
            const diff = await this.git.diff([since, '--name-only']);
            return diff.split('\n').filter(line => line.trim());
        }
        catch (error) {
            console.error('Git changed files error:', error);
            return [];
        }
    }
}
exports.GitService = GitService;
//# sourceMappingURL=GitService.js.map