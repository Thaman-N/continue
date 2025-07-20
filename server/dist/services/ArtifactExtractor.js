"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArtifactExtractor = void 0;
class ArtifactExtractor {
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
    }
    /**
     * Extract artifacts from Claude's artifact containers
     */
    extractClaudeArtifacts(htmlContent) {
        const artifacts = [];
        // Claude artifacts are in specific containers with data attributes
        const artifactRegex = /<div[^>]*data-artifact[^>]*>([\s\S]*?)<\/div>/g;
        let match;
        while ((match = artifactRegex.exec(htmlContent)) !== null) {
            const artifactHtml = match[1];
            // Extract artifact metadata
            const titleMatch = artifactHtml.match(/data-title="([^"]+)"/);
            const typeMatch = artifactHtml.match(/data-type="([^"]+)"/);
            const languageMatch = artifactHtml.match(/data-language="([^"]+)"/);
            // Extract the actual code content from pre/code elements
            const codeMatch = artifactHtml.match(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/);
            const textMatch = artifactHtml.match(/<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/);
            if (codeMatch || textMatch) {
                const content = codeMatch ? this.decodeHtmlEntities(codeMatch[1]) : (textMatch ? textMatch[1] : '');
                artifacts.push({
                    id: this.generateArtifactId(),
                    title: titleMatch ? titleMatch[1] : 'Untitled',
                    type: (typeMatch ? typeMatch[1] : 'code'),
                    language: languageMatch ? languageMatch[1] : undefined,
                    content: content.trim(),
                    filename: this.extractFilenameFromTitle(titleMatch ? titleMatch[1] : '')
                });
            }
        }
        return artifacts;
    }
    /**
     * Extract code from ChatGPT's code blocks and containers
     */
    extractChatGPTCode(htmlContent) {
        const artifacts = [];
        // ChatGPT uses div containers with specific classes for code
        const codeBlockRegex = /<div[^>]*class="[^"]*code-block[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
        const preCodeRegex = /<pre[^>]*><code[^>]*class="language-(\w+)"[^>]*>([\s\S]*?)<\/code><\/pre>/g;
        let match;
        // Extract from code block containers
        while ((match = codeBlockRegex.exec(htmlContent)) !== null) {
            const blockHtml = match[1];
            const codeMatch = blockHtml.match(/<code[^>]*>([\s\S]*?)<\/code>/);
            if (codeMatch) {
                artifacts.push({
                    id: this.generateArtifactId(),
                    title: 'Code Block',
                    type: 'code',
                    content: this.decodeHtmlEntities(codeMatch[1]).trim()
                });
            }
        }
        // Extract from pre/code elements with language specification
        while ((match = preCodeRegex.exec(htmlContent)) !== null) {
            const [, language, content] = match;
            artifacts.push({
                id: this.generateArtifactId(),
                title: `${language} Code`,
                type: 'code',
                language: language.toLowerCase(),
                content: this.decodeHtmlEntities(content).trim()
            });
        }
        return artifacts;
    }
    /**
     * Extract code from Gemini's response containers
     */
    extractGeminiCode(htmlContent) {
        const artifacts = [];
        // Gemini uses similar markdown-style code blocks
        const codeBlockRegex = /<div[^>]*class="[^"]*code[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
        let match;
        while ((match = codeBlockRegex.exec(htmlContent)) !== null) {
            const blockHtml = match[1];
            const codeMatch = blockHtml.match(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/);
            if (codeMatch) {
                artifacts.push({
                    id: this.generateArtifactId(),
                    title: 'Code Block',
                    type: 'code',
                    content: this.decodeHtmlEntities(codeMatch[1]).trim()
                });
            }
        }
        return artifacts;
    }
    /**
     * Generic extraction from any HTML content with code elements
     */
    extractGenericCode(htmlContent) {
        const artifacts = [];
        // Look for any pre/code combinations
        const genericCodeRegex = /<pre[^>]*>(?:<code[^>]*>)?([\s\S]*?)(?:<\/code>)?<\/pre>/g;
        let match;
        while ((match = genericCodeRegex.exec(htmlContent)) !== null) {
            const content = this.decodeHtmlEntities(match[1]).trim();
            // Only include substantial code blocks
            if (content.length > 20 && content.split('\n').length > 2) {
                artifacts.push({
                    id: this.generateArtifactId(),
                    title: 'Code Block',
                    type: 'code',
                    content
                });
            }
        }
        return artifacts;
    }
    /**
     * Convert artifacts to standardized code blocks
     */
    convertArtifactsToCodeBlocks(artifacts) {
        return artifacts.map(artifact => ({
            language: artifact.language || this.detectLanguageFromContent(artifact.content),
            content: artifact.content,
            filename: artifact.filename || this.inferFilenameFromContent(artifact.content, artifact.language),
            isFullFile: this.isLikelyFullFile(artifact.content),
            isPartialUpdate: !this.isLikelyFullFile(artifact.content)
        }));
    }
    /**
     * Main extraction method that tries all provider-specific extractors
     */
    extractAllArtifacts(htmlContent, provider) {
        let artifacts = [];
        // Try provider-specific extraction first
        if (provider) {
            switch (provider.toLowerCase()) {
                case 'claude':
                case 'anthropic':
                    artifacts = this.extractClaudeArtifacts(htmlContent);
                    break;
                case 'chatgpt':
                case 'openai':
                    artifacts = this.extractChatGPTCode(htmlContent);
                    break;
                case 'gemini':
                case 'google':
                    artifacts = this.extractGeminiCode(htmlContent);
                    break;
            }
        }
        // If no provider-specific artifacts found, try generic extraction
        if (artifacts.length === 0) {
            artifacts = this.extractGenericCode(htmlContent);
        }
        return artifacts;
    }
    /**
     * Decode HTML entities in code content
     */
    decodeHtmlEntities(html) {
        const entities = {
            '&amp;': '&',
            '&lt;': '<',
            '&gt;': '>',
            '&quot;': '"',
            '&#39;': "'",
            '&nbsp;': ' '
        };
        return html.replace(/&[a-zA-Z0-9#]+;/g, (entity) => {
            return entities[entity] || entity;
        });
    }
    /**
     * Generate unique artifact ID
     */
    generateArtifactId() {
        return `artifact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Extract filename from artifact title
     */
    extractFilenameFromTitle(title) {
        const filenameMatch = title.match(/([^\/\s]+\.[a-zA-Z]+)/);
        return filenameMatch ? filenameMatch[1] : undefined;
    }
    /**
     * Detect programming language from code content
     */
    detectLanguageFromContent(content) {
        // Check for language-specific patterns
        if (/import\s+.*from|export\s+.*|interface\s+\w+|type\s+\w+\s*=/.test(content)) {
            return content.includes('tsx') || content.includes('<') ? 'typescript' : 'typescript';
        }
        if (/def\s+\w+\s*\(|import\s+\w+|from\s+\w+\s+import/.test(content)) {
            return 'python';
        }
        if (/public\s+class|import\s+java|package\s+\w+/.test(content)) {
            return 'java';
        }
        if (/#include|int\s+main|std::/.test(content)) {
            return 'cpp';
        }
        if (/func\s+\w+|import\s+"/.test(content)) {
            return 'go';
        }
        if (/fn\s+\w+|use\s+std::/.test(content)) {
            return 'rust';
        }
        if (/<\w+|<\/\w+>|<!DOCTYPE/.test(content)) {
            return 'html';
        }
        if (/\{\s*\w+\s*:|\.\w+\s*\{/.test(content)) {
            return 'css';
        }
        return 'javascript'; // Default fallback
    }
    /**
     * Infer filename from code content and language
     */
    inferFilenameFromContent(content, language) {
        // Look for component/class names that could be filenames
        const componentMatch = content.match(/(?:export\s+(?:default\s+)?(?:class|function|const)\s+)(\w+)/);
        const classMatch = content.match(/(?:class|interface)\s+(\w+)/);
        const name = componentMatch?.[1] || classMatch?.[1];
        if (name && language) {
            const extensions = {
                'typescript': '.ts',
                'javascript': '.js',
                'python': '.py',
                'java': '.java',
                'cpp': '.cpp',
                'go': '.go',
                'rust': '.rs',
                'html': '.html',
                'css': '.css'
            };
            const ext = extensions[language] || '.txt';
            return `${name}${ext}`;
        }
        return undefined;
    }
    /**
     * Determine if content represents a full file
     */
    isLikelyFullFile(content) {
        const lines = content.split('\n');
        const hasImports = /^(import|#include|using|require)/.test(content);
        const hasExports = /(export|module\.exports|public\s+class)/.test(content);
        return lines.length > 15 || (hasImports && hasExports);
    }
}
exports.ArtifactExtractor = ArtifactExtractor;
//# sourceMappingURL=ArtifactExtractor.js.map