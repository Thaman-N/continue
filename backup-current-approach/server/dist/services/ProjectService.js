"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectService = void 0;
class ProjectService {
    constructor(fileService, gitService, contextService) {
        this.fileService = fileService;
        this.gitService = gitService;
        this.contextService = contextService;
    }
    getProjectRoot() {
        return this.fileService.getProjectRoot();
    }
    async getProjectInfo() {
        const [files, gitStatus, context] = await Promise.all([
            this.fileService.getProjectStructure(),
            this.gitService.getStatus(),
            this.contextService.getProjectContext({ maxFiles: 10 })
        ]);
        return {
            totalFiles: files.length,
            codeFiles: files.filter(f => !f.isDirectory).length,
            gitStatus,
            context
        };
    }
    watchFiles(callback) {
        return this.fileService.watchFiles((event, path) => {
            callback({ event, path, timestamp: new Date() });
        });
    }
}
exports.ProjectService = ProjectService;
//# sourceMappingURL=ProjectService.js.map