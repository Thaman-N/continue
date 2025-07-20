"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupRoutes = setupRoutes;
const path_1 = __importDefault(require("path"));
function setupRoutes(app, services) {
    const { fileService, gitService, contextService, projectService } = services;
    // Project context endpoint
    app.get('/api/context', async (req, res) => {
        try {
            const options = {
                maxFiles: parseInt(req.query.maxFiles) || 20,
                includeGitStatus: req.query.includeGitStatus !== 'false',
                fileExtensions: req.query.extensions ? req.query.extensions.split(',') : [],
                excludePatterns: req.query.exclude ? req.query.exclude.split(',') : []
            };
            const context = await contextService.getProjectContext(options);
            res.json(context);
        }
        catch (error) {
            console.error('Context API error:', error);
            res.status(500).json({ error: 'Failed to get project context' });
        }
    });
    // File operations
    app.get('/api/files', async (req, res) => {
        try {
            const files = await fileService.getProjectStructure();
            res.json(files);
        }
        catch (error) {
            console.error('Files API error:', error);
            res.status(500).json({ error: 'Failed to get files' });
        }
    });
    // Read file - using query parameter instead of path parameter for file paths
    app.get('/api/file', async (req, res) => {
        try {
            const filePath = req.query.path;
            if (!filePath) {
                return res.status(400).json({ error: 'File path is required' });
            }
            const content = await fileService.readFile(filePath);
            res.json({ content, path: filePath });
        }
        catch (error) {
            console.error('Read file error:', error);
            res.status(500).json({ error: 'Failed to read file' });
        }
    });
    // Write file - using request body for both path and content
    app.post('/api/file', async (req, res) => {
        try {
            const { path: filePath, content } = req.body;
            if (!filePath || content === undefined) {
                return res.status(400).json({ error: 'File path and content are required' });
            }
            await fileService.writeFile(filePath, content);
            res.json({ success: true, path: filePath });
        }
        catch (error) {
            console.error('Write file error:', error);
            res.status(500).json({ error: 'Failed to write file' });
        }
    });
    // Git operations
    app.get('/api/git/status', async (req, res) => {
        try {
            const status = await gitService.getStatus();
            res.json(status);
        }
        catch (error) {
            console.error('Git status error:', error);
            res.status(500).json({ error: 'Failed to get git status' });
        }
    });
    app.get('/api/git/diff', async (req, res) => {
        try {
            const filePath = req.query.file;
            const diff = await gitService.getDiff(filePath);
            res.json({ diff, file: filePath });
        }
        catch (error) {
            console.error('Git diff error:', error);
            res.status(500).json({ error: 'Failed to get git diff' });
        }
    });
    app.get('/api/git/commits', async (req, res) => {
        try {
            const limit = parseInt(req.query.limit) || 10;
            const commits = await gitService.getRecentCommits(limit);
            res.json(commits);
        }
        catch (error) {
            console.error('Git commits error:', error);
            res.status(500).json({ error: 'Failed to get commits' });
        }
    });
    // Continue integration endpoints for demo
    // File operations (Continue-style)
    app.post('/api/files/exists', async (req, res) => {
        try {
            const { path } = req.body;
            const exists = await fileService.fileExists(path);
            res.json({ exists, path });
        }
        catch (error) {
            console.error('File exists error:', error);
            res.status(500).json({ error: 'Failed to check file existence' });
        }
    });
    app.post('/api/files/read', async (req, res) => {
        try {
            const { path } = req.body;
            const content = await fileService.readFile(path);
            res.json({ content, path });
        }
        catch (error) {
            console.error('File read error:', error);
            res.status(500).json({ error: 'Failed to read file' });
        }
    });
    app.post('/api/files/write', async (req, res) => {
        try {
            const { path, content } = req.body;
            await fileService.writeFile(path, content);
            res.json({ success: true, path });
        }
        catch (error) {
            console.error('File write error:', error);
            res.status(500).json({ error: 'Failed to write file' });
        }
    });
    app.post('/api/files/list', async (req, res) => {
        try {
            const { path } = req.body;
            // For now, return a simple structure
            const entries = [['package.json', 'file'], ['src', 'directory']];
            res.json({ entries, path });
        }
        catch (error) {
            console.error('File list error:', error);
            res.status(500).json({ error: 'Failed to list directory' });
        }
    });
    // Git operations (Continue-style)
    app.post('/api/git/diff', async (req, res) => {
        try {
            const { includeUnstaged } = req.body;
            const diff = await gitService.getDiff();
            res.json({ diff: [diff] }); // Return as array for consistency
        }
        catch (error) {
            console.error('Git diff error:', error);
            res.status(500).json({ error: 'Failed to get git diff' });
        }
    });
    app.post('/api/git/branch', async (req, res) => {
        try {
            const branch = 'main'; // Simplified for demo
            res.json({ branch });
        }
        catch (error) {
            console.error('Git branch error:', error);
            res.status(500).json({ error: 'Failed to get git branch' });
        }
    });
    app.post('/api/git/root', async (req, res) => {
        try {
            const root = '/home/thaman/ai-coding-assistant'; // Simplified for demo
            res.json({ root });
        }
        catch (error) {
            console.error('Git root error:', error);
            res.status(500).json({ error: 'Failed to get git root' });
        }
    });
    app.post('/api/git/repo-name', async (req, res) => {
        try {
            const name = 'ai-coding-assistant'; // Simplified for demo
            res.json({ name });
        }
        catch (error) {
            console.error('Git repo name error:', error);
            res.status(500).json({ error: 'Failed to get repo name' });
        }
    });
    // Context providers (Continue-style)
    app.post('/api/context/intelligent', async (req, res) => {
        try {
            const { query, maxItems } = req.body;
            // Simulate intelligent context selection
            const items = [
                {
                    id: 'context1',
                    name: 'package.json',
                    description: 'Project configuration',
                    content: JSON.stringify({ name: 'ai-coding-assistant', version: '1.0.0' }, null, 2)
                },
                {
                    id: 'context2',
                    name: 'src/index.ts',
                    description: 'Main entry point',
                    content: '// Main application entry point\nconsole.log("Hello World");'
                }
            ].slice(0, maxItems || 10);
            res.json({ items, query });
        }
        catch (error) {
            console.error('Intelligent context error:', error);
            res.status(500).json({ error: 'Failed to get intelligent context' });
        }
    });
    app.post('/api/context/provider/:provider', async (req, res) => {
        try {
            const { provider } = req.params;
            const { query, maxItems } = req.body;
            // Simulate provider-specific context
            const items = [
                {
                    id: `${provider}-1`,
                    name: `${provider}-context`,
                    description: `Context from ${provider} provider`,
                    content: `Sample content from ${provider} provider for query: ${query}`
                }
            ];
            res.json({ items, provider });
        }
        catch (error) {
            console.error('Context provider error:', error);
            res.status(500).json({ error: `Failed to get context from ${req.params.provider}` });
        }
    });
    // Response processing (Continue-style) - Enhanced with intelligent analysis
    app.post('/api/response/process', async (req, res) => {
        try {
            const { extractedCode, fullResponse, provider } = req.body;
            console.log(`Processing response from ${provider} with ${extractedCode?.length || 0} code blocks`);
            // Intelligent analysis like Continue does
            const analysisResult = analyzeResponseForFileChanges(fullResponse, extractedCode || []);
            res.json({
                fileChanges: analysisResult.fileChanges,
                extractedBlocks: extractedCode?.length || 0,
                actualChanges: analysisResult.fileChanges.length,
                provider,
                success: true,
                analysis: analysisResult.analysis
            });
        }
        catch (error) {
            console.error('Response processing error:', error);
            res.status(500).json({ error: 'Failed to process response' });
        }
    });
    // File application (Continue-style) - Actually applies changes to files
    app.post('/api/files/apply-changes', async (req, res) => {
        try {
            const { changes } = req.body;
            console.log(`Applying ${changes.length} file changes...`);
            const results = [];
            for (const change of changes) {
                try {
                    const result = await applyFileChange(change, fileService);
                    results.push(result);
                }
                catch (error) {
                    console.error(`Failed to apply change to ${change.path}:`, error);
                    results.push({
                        path: change.path,
                        success: false,
                        message: `Failed to apply changes: ${error instanceof Error ? error.message : 'Unknown error'}`,
                        error: true
                    });
                }
            }
            const successCount = results.filter(r => r.success).length;
            res.json({
                success: successCount > 0,
                results,
                summary: `Applied ${successCount}/${changes.length} changes successfully`
            });
        }
        catch (error) {
            console.error('Apply changes error:', error);
            res.status(500).json({ error: 'Failed to apply changes' });
        }
    });
    // Helper function to apply individual file changes
    async function applyFileChange(change, fileService) {
        const { path, content, type, confidence } = change;
        console.log(`Applying ${type} change to ${path} (confidence: ${confidence}%)`);
        try {
            if (type === 'create') {
                // Create new file
                await fileService.writeFile(path, content);
                return {
                    path,
                    success: true,
                    message: `Created file ${path}`,
                    type: 'create',
                    confidence
                };
            }
            else if (type === 'modify') {
                // Check if file exists first
                const exists = await fileService.fileExists(path);
                if (!exists) {
                    // Create if doesn't exist
                    await fileService.writeFile(path, content);
                    return {
                        path,
                        success: true,
                        message: `Created file ${path} (was marked as modify but didn't exist)`,
                        type: 'create',
                        confidence
                    };
                }
                else {
                    // For now, replace content (in production, would do precise line edits)
                    await fileService.writeFile(path, content);
                    return {
                        path,
                        success: true,
                        message: `Modified file ${path}`,
                        type: 'modify',
                        confidence
                    };
                }
            }
            else {
                return {
                    path,
                    success: false,
                    message: `Unknown change type: ${type}`,
                    error: true
                };
            }
        }
        catch (error) {
            throw error;
        }
    }
    // Apply files endpoint (for ChangeReviewer component)
    app.post('/api/files/apply', async (req, res) => {
        try {
            const { fileChanges, options } = req.body;
            console.log(`Applying ${fileChanges.length} file changes via /api/files/apply...`);
            const results = [];
            let successful = 0;
            let failed = 0;
            for (const change of fileChanges) {
                try {
                    const result = await applyFileChange(change, fileService);
                    results.push({
                        success: true,
                        filePath: change.path,
                        changeType: change.type,
                        message: result.message,
                        confidence: result.confidence
                    });
                    successful++;
                }
                catch (error) {
                    console.error(`Failed to apply change to ${change.path}:`, error);
                    results.push({
                        success: false,
                        filePath: change.path,
                        changeType: change.type,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                    failed++;
                }
            }
            // Create backup directory info for response
            const backupDirectory = path_1.default.join(fileService.getProjectRoot(), '.ai-assistant-backups');
            res.json({
                totalChanges: fileChanges.length,
                successful,
                failed,
                results,
                backupDirectory
            });
        }
        catch (error) {
            console.error('Apply files error:', error);
            res.status(500).json({ error: 'Failed to apply file changes' });
        }
    });
    // Search operations (Continue-style)
    app.post('/api/search/text', async (req, res) => {
        try {
            const { query, maxResults } = req.body;
            const results = `Search results for "${query}" (simplified for demo)`;
            res.json({ results, query });
        }
        catch (error) {
            console.error('Text search error:', error);
            res.status(500).json({ error: 'Failed to perform text search' });
        }
    });
    app.post('/api/search/files', async (req, res) => {
        try {
            const { pattern, maxResults } = req.body;
            const files = ['package.json', 'src/index.ts', 'README.md'].filter(f => f.includes(pattern) || pattern === '*');
            res.json({ files, pattern });
        }
        catch (error) {
            console.error('File search error:', error);
            res.status(500).json({ error: 'Failed to perform file search' });
        }
    });
    // Helper function for intelligent response analysis (Continue-style)
    function analyzeResponseForFileChanges(fullResponse, extractedCode) {
        const fileChanges = [];
        const analysis = {
            totalBlocks: extractedCode.length,
            actionableBlocks: 0,
            examples: 0,
            explanations: 0
        };
        // Continue-style intelligent analysis
        for (const codeBlock of extractedCode) {
            const blockAnalysis = analyzeCodeBlock(codeBlock, fullResponse);
            if (blockAnalysis.isActionable) {
                fileChanges.push({
                    path: blockAnalysis.suggestedPath,
                    content: codeBlock.content,
                    type: blockAnalysis.changeType,
                    language: codeBlock.language,
                    confidence: blockAnalysis.confidence,
                    reasoning: blockAnalysis.reasoning
                });
                analysis.actionableBlocks++;
            }
            else if (blockAnalysis.isExample) {
                analysis.examples++;
            }
            else {
                analysis.explanations++;
            }
        }
        return { fileChanges, analysis };
    }
    function analyzeCodeBlock(codeBlock, fullResponse) {
        const content = codeBlock.content.toLowerCase();
        const contextBefore = getContextBefore(codeBlock, fullResponse);
        const contextAfter = getContextAfter(codeBlock, fullResponse);
        // Score for actionability
        let score = 0;
        let reasoning = [];
        // Positive indicators (like Continue's heuristics)
        if (codeBlock.filename) {
            score += 30;
            reasoning.push('Has explicit filename');
        }
        // Check for action hints from content script
        if (codeBlock.actionHint) {
            score += 35;
            reasoning.push(`Has action hint: ${codeBlock.actionHint}`);
        }
        if (contextBefore.includes('create') || contextBefore.includes('add') || contextBefore.includes('implement')) {
            score += 25;
            reasoning.push('Context suggests creation/implementation');
        }
        if (contextBefore.includes('update') || contextBefore.includes('modify') || contextBefore.includes('change')) {
            score += 25;
            reasoning.push('Context suggests modification');
        }
        if (content.includes('module.exports') || content.includes('export') || content.includes('import')) {
            score += 15;
            reasoning.push('Contains module structure');
        }
        if (content.includes('function') || content.includes('class') || content.includes('const') || content.includes('let')) {
            score += 10;
            reasoning.push('Contains code constructs');
        }
        // Negative indicators (examples/explanations)
        if (contextBefore.includes('example') || contextBefore.includes('here\'s how') || contextBefore.includes('for instance')) {
            score -= 20;
            reasoning.push('Marked as example');
        }
        if (contextBefore.includes('current') && contextBefore.includes('structure')) {
            score -= 15;
            reasoning.push('Describing current state');
        }
        if (content.includes('console.log("hello world")') || content.includes('placeholder')) {
            score -= 10;
            reasoning.push('Contains placeholder content');
        }
        // Determine actionability
        const isActionable = score >= 20;
        const isExample = !isActionable && (contextBefore.includes('example') || contextBefore.includes('current'));
        // Suggest file path
        let suggestedPath = codeBlock.filename || 'untitled';
        if (!codeBlock.filename) {
            if (codeBlock.language === 'js' || codeBlock.language === 'javascript') {
                suggestedPath = 'utils/generatedCode.js';
            }
            else if (codeBlock.language === 'ts' || codeBlock.language === 'typescript') {
                suggestedPath = 'src/generatedCode.ts';
            }
            else if (codeBlock.language === 'py' || codeBlock.language === 'python') {
                suggestedPath = 'generated_code.py';
            }
            else {
                suggestedPath = `generated_code.${codeBlock.language || 'txt'}`;
            }
        }
        // Determine change type - prioritize actionHint from content script
        let changeType = 'create';
        if (codeBlock.actionHint) {
            if (codeBlock.actionHint === 'update' || codeBlock.actionHint === 'modify') {
                changeType = 'modify';
            }
            else if (codeBlock.actionHint === 'create' || codeBlock.actionHint === 'add') {
                changeType = 'create';
            }
        }
        else if (contextBefore.includes('update') || contextBefore.includes('modify')) {
            changeType = 'modify';
        }
        return {
            isActionable,
            isExample,
            confidence: Math.min(100, Math.max(0, score)),
            suggestedPath,
            changeType,
            reasoning: reasoning.join(', ')
        };
    }
    function getContextBefore(codeBlock, fullResponse) {
        const blockIndex = fullResponse.indexOf(codeBlock.content);
        if (blockIndex === -1)
            return '';
        const before = fullResponse.substring(Math.max(0, blockIndex - 200), blockIndex);
        return before.toLowerCase();
    }
    function getContextAfter(codeBlock, fullResponse) {
        const blockIndex = fullResponse.indexOf(codeBlock.content);
        if (blockIndex === -1)
            return '';
        const after = fullResponse.substring(blockIndex + codeBlock.content.length, Math.min(fullResponse.length, blockIndex + codeBlock.content.length + 200));
        return after.toLowerCase();
    }
    // Process endpoint for complex operations
    app.post('/api/process', async (req, res) => {
        try {
            const { type, data } = req.body;
            switch (type) {
                case 'ANALYZE_CODE':
                    // Future: Implement code analysis
                    res.json({ analysis: 'Code analysis not yet implemented' });
                    break;
                case 'GENERATE_CONTEXT':
                    const context = await contextService.getProjectContext(data.options);
                    res.json({ context });
                    break;
                default:
                    res.status(400).json({ error: 'Unknown process type' });
            }
        }
        catch (error) {
            console.error('Process API error:', error);
            res.status(500).json({ error: 'Processing failed' });
        }
    });
}
//# sourceMappingURL=index.js.map