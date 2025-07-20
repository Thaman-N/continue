"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupEnhancedRoutes = setupEnhancedRoutes;
const ResponseExtractor_1 = require("../services/ResponseExtractor");
const ArtifactExtractor_1 = require("../services/ArtifactExtractor");
const FileApplicator_1 = require("../services/FileApplicator");
function setupEnhancedRoutes(app, services) {
    const { fileService, gitService, enhancedContextService, projectService } = services;
    // Enhanced context endpoint with Continue.dev providers
    app.get('/api/context/enhanced', async (req, res) => {
        try {
            const options = {
                maxFiles: parseInt(req.query.maxFiles) || 20,
                includeGitStatus: req.query.includeGitStatus !== 'false',
                fileExtensions: req.query.extensions ? req.query.extensions.split(',') : [],
                excludePatterns: req.query.exclude ? req.query.exclude.split(',') : [],
                provider: req.query.provider || 'codebase',
                query: req.query.query || '',
                includeRepoMap: req.query.includeRepoMap === 'true',
                promptFormatting: req.query.format ? {
                    provider: req.query.format,
                    maxTokens: parseInt(req.query.maxTokens) || 8000
                } : undefined,
                systemPrompt: req.query.systemPrompt
            };
            const context = await enhancedContextService.getEnhancedContext(options);
            res.json(context);
        }
        catch (error) {
            console.error('Enhanced context API error:', error);
            res.status(500).json({ error: 'Failed to get enhanced context' });
        }
    });
    // Context provider endpoints
    app.get('/api/context/providers', async (req, res) => {
        try {
            const providers = await enhancedContextService.getAvailableProviders();
            res.json(providers);
        }
        catch (error) {
            console.error('Context providers API error:', error);
            res.status(500).json({ error: 'Failed to get context providers' });
        }
    });
    // Get context items from a specific provider
    app.post('/api/context/provider/:provider', async (req, res) => {
        try {
            const provider = req.params.provider;
            const { query } = req.body;
            const items = await enhancedContextService.getContextItems(provider, query || '');
            res.json({ provider, items });
        }
        catch (error) {
            console.error(`Context provider ${req.params.provider} API error:`, error);
            res.status(500).json({ error: `Failed to get context from ${req.params.provider}` });
        }
    });
    // Get submenu items for providers that support it
    app.get('/api/context/provider/:provider/submenu', async (req, res) => {
        try {
            const provider = req.params.provider;
            const items = await enhancedContextService.getSubmenuItems(provider);
            res.json({ provider, items });
        }
        catch (error) {
            console.error(`Submenu items API error for ${req.params.provider}:`, error);
            res.status(500).json({ error: `Failed to get submenu items for ${req.params.provider}` });
        }
    });
    // Intelligent context selection endpoint
    app.post('/api/context/intelligent', async (req, res) => {
        try {
            const { query, maxItems = 10 } = req.body;
            if (!query) {
                return res.status(400).json({ error: 'Query is required' });
            }
            const items = await enhancedContextService.intelligentContextSelection(query, maxItems);
            res.json({ query, items });
        }
        catch (error) {
            console.error('Intelligent context selection API error:', error);
            res.status(500).json({ error: 'Failed to perform intelligent context selection' });
        }
    });
    // Prompt formatting endpoint
    app.post('/api/prompt/format', async (req, res) => {
        try {
            const { message, contextItems = [], options = {}, systemPrompt } = req.body;
            if (!message) {
                return res.status(400).json({ error: 'Message is required' });
            }
            const formattedPrompt = await enhancedContextService.formatPrompt(message, contextItems, options, systemPrompt);
            res.json({
                message,
                formattedPrompt,
                options,
                contextItemsCount: contextItems.length
            });
        }
        catch (error) {
            console.error('Prompt formatting API error:', error);
            res.status(500).json({ error: 'Failed to format prompt' });
        }
    });
    // Repository map endpoint
    app.get('/api/repo/map', async (req, res) => {
        try {
            const query = req.query.folder || 'entire-codebase';
            const items = await enhancedContextService.getContextItems('repo-map', query);
            res.json({
                folder: query,
                repoMap: items[0]?.content || 'No repository map generated',
                items
            });
        }
        catch (error) {
            console.error('Repository map API error:', error);
            res.status(500).json({ error: 'Failed to generate repository map' });
        }
    });
    // Quick context endpoints for common use cases
    app.get('/api/context/quick/files', async (req, res) => {
        try {
            const query = req.query.q || '';
            const items = await enhancedContextService.getContextItems('file', query);
            res.json({ query, items });
        }
        catch (error) {
            console.error('Quick files context API error:', error);
            res.status(500).json({ error: 'Failed to get file context' });
        }
    });
    app.get('/api/context/quick/codebase', async (req, res) => {
        try {
            const query = req.query.q || '';
            const items = await enhancedContextService.getContextItems('codebase', query);
            res.json({ query, items });
        }
        catch (error) {
            console.error('Quick codebase context API error:', error);
            res.status(500).json({ error: 'Failed to get codebase context' });
        }
    });
    // Health check for enhanced features
    app.get('/api/context/health', async (req, res) => {
        try {
            const providers = await enhancedContextService.getAvailableProviders();
            const testQuery = 'test';
            const health = {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                providers: providers.length,
                availableProviders: providers.map(p => p.title),
                features: {
                    contextProviders: true,
                    repoMap: true,
                    promptFormatting: true,
                    intelligentSelection: true
                }
            };
            res.json(health);
        }
        catch (error) {
            console.error('Health check error:', error);
            res.status(500).json({
                status: 'unhealthy',
                error: 'Enhanced context features unavailable',
                timestamp: new Date().toISOString()
            });
        }
    });
    // Response processing endpoint - handles extracted AI responses
    app.post('/api/response/process', async (req, res) => {
        try {
            const { extractedCode, fullResponse, provider } = req.body;
            console.log(`Processing response from ${provider} with ${extractedCode?.length || 0} code blocks`);
            if (!extractedCode || !Array.isArray(extractedCode)) {
                console.error('Invalid extracted code data:', extractedCode);
                return res.status(400).json({ error: 'Invalid extracted code data' });
            }
            // Initialize services for response processing
            const responseExtractor = new ResponseExtractor_1.ResponseExtractor(projectService.getProjectRoot());
            const artifactExtractor = new ArtifactExtractor_1.ArtifactExtractor(projectService.getProjectRoot());
            // Process the response text for file changes
            console.log('Extracting from full response...');
            const extractedResponse = await responseExtractor.extractFromResponse(fullResponse);
            console.log('Response extractor found:', extractedResponse.fileChanges.length, 'file changes');
            // Also try to extract from HTML if it looks like it contains artifacts
            let htmlArtifacts = [];
            if (fullResponse.includes('<') && fullResponse.includes('>')) {
                console.log('Trying to extract HTML artifacts...');
                htmlArtifacts = artifactExtractor.extractAllArtifacts(fullResponse, provider);
                console.log('HTML artifacts found:', htmlArtifacts.length);
            }
            // Combine extracted code blocks
            const allCodeBlocks = [
                ...extractedResponse.codeBlocks,
                ...artifactExtractor.convertArtifactsToCodeBlocks(htmlArtifacts),
                ...extractedCode.map((code) => ({
                    language: code.language || 'text',
                    content: code.content,
                    filename: code.filename,
                    isFullFile: code.content.split('\n').length > 20,
                    isPartialUpdate: code.content.split('\n').length <= 20
                }))
            ];
            console.log('Combined code blocks:', allCodeBlocks.length);
            console.log('Debug - extractedCode blocks:', extractedCode.map((code, i) => `Block ${i}: filename=${code.filename || 'NONE'}, language=${code.language}, contentLength=${code.content?.length || 0}`));
            // Generate file changes from ALL code blocks, not just extractedResponse
            console.log('Generating file changes from all code blocks...');
            const allFileChanges = await responseExtractor.detectFileChanges(allCodeBlocks, fullResponse);
            console.log('All file changes generated:', allFileChanges.length);
            const fileApplicator = new FileApplicator_1.FileApplicator(projectService.getProjectRoot());
            const diffPreviews = await fileApplicator.generateDiffPreviews(allFileChanges);
            const result = {
                success: true,
                extractedBlocks: allCodeBlocks.length,
                fileChanges: allFileChanges,
                diffPreviews,
                hasChanges: extractedResponse.hasCodeChanges,
                explanation: extractedResponse.explanation,
                provider,
                timestamp: Date.now()
            };
            console.log('Sending result with', result.fileChanges.length, 'file changes');
            res.json(result);
        }
        catch (error) {
            console.error('Response processing error:', error);
            res.status(500).json({ error: 'Failed to process AI response' });
        }
    });
    // Apply file changes endpoint
    app.post('/api/files/apply', async (req, res) => {
        try {
            const { fileChanges, options = {} } = req.body;
            if (!fileChanges || !Array.isArray(fileChanges)) {
                return res.status(400).json({ error: 'Invalid file changes data' });
            }
            const fileApplicator = new FileApplicator_1.FileApplicator(projectService.getProjectRoot());
            const result = await fileApplicator.applyFileChanges(fileChanges, {
                createBackups: options.createBackups !== false,
                dryRun: options.dryRun === true
            });
            res.json(result);
        }
        catch (error) {
            console.error('File application error:', error);
            res.status(500).json({ error: 'Failed to apply file changes' });
        }
    });
    // Preview file changes endpoint
    app.post('/api/files/preview', async (req, res) => {
        try {
            const { fileChanges } = req.body;
            if (!fileChanges || !Array.isArray(fileChanges)) {
                return res.status(400).json({ error: 'Invalid file changes data' });
            }
            const fileApplicator = new FileApplicator_1.FileApplicator(projectService.getProjectRoot());
            const previews = await fileApplicator.generateDiffPreviews(fileChanges);
            res.json({ previews });
        }
        catch (error) {
            console.error('File preview error:', error);
            res.status(500).json({ error: 'Failed to generate file previews' });
        }
    });
}
//# sourceMappingURL=enhanced.js.map