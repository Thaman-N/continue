import { FileService } from './FileService';
import { GitService } from './GitService';
import { ContextService } from './ContextService';

export class ProjectService {
  constructor(
    private fileService: FileService,
    private gitService: GitService,
    private contextService: ContextService
  ) {}

  getProjectRoot(): string {
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

  watchFiles(callback: (changes: any) => void) {
    return this.fileService.watchFiles((event, path) => {
      callback({ event, path, timestamp: new Date() });
    });
  }
}
