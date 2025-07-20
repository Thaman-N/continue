// Service for extracting and parsing AI responses from web interfaces
import * as fs from 'fs/promises';
import * as path from 'path';

export interface CodeBlock {
  language: string;
  content: string;
  filename?: string;
  startLine?: number;
  endLine?: number;
  isFullFile?: boolean;
  isPartialUpdate?: boolean;
}

export interface FileChange {
  path: string;
  content: string;
  type: 'create' | 'update' | 'delete';
  originalContent?: string;
  isPartialChange?: boolean;
  lineRange?: { start: number; end: number };
}

export interface ExtractedResponse {
  codeBlocks: CodeBlock[];
  fileChanges: FileChange[];
  explanation?: string;
  hasCodeChanges: boolean;
}

export class ResponseExtractor {
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  /**
   * Extract code blocks and file changes from AI response text
   */
  async extractFromResponse(responseText: string): Promise<ExtractedResponse> {
    const codeBlocks = this.extractCodeBlocks(responseText);
    const fileChanges = await this.detectFileChanges(codeBlocks, responseText);
    
    return {
      codeBlocks,
      fileChanges,
      explanation: this.extractExplanation(responseText, codeBlocks),
      hasCodeChanges: fileChanges.length > 0
    };
  }

  /**
   * Extract code blocks from markdown-style responses
   */
  private extractCodeBlocks(text: string): CodeBlock[] {
    const codeBlocks: CodeBlock[] = [];
    
    // Match markdown code blocks with language specifier
    const codeBlockRegex = /```(\w+)?\s*(?:\/\/\s*(.+?))?\n([\s\S]*?)```/g;
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      const [, language = 'text', comment, content] = match;
      
      // Try to extract filename from comment or surrounding text
      const filename = this.extractFilename(comment, text, match.index);
      
      codeBlocks.push({
        language: language.toLowerCase(),
        content: content.trim(),
        filename,
        isFullFile: this.isFullFileContent(content, filename),
        isPartialUpdate: this.isPartialUpdate(content, text, match.index)
      });
    }

    // Also check for inline code with file references
    const inlineCodeRegex = /`([^`]+)`\s+(?:in|for|from)\s+(?:file\s+)?`?([^`\s]+\.[a-zA-Z]+)`?/g;
    while ((match = inlineCodeRegex.exec(text)) !== null) {
      const [, content, filename] = match;
      if (content.length > 10) { // Only meaningful code snippets
        codeBlocks.push({
          language: this.detectLanguageFromFilename(filename),
          content: content.trim(),
          filename,
          isPartialUpdate: true
        });
      }
    }

    return codeBlocks;
  }

  /**
   * Detect potential file changes from code blocks and context (public method)
   */
  async detectFileChanges(codeBlocks: CodeBlock[], responseText: string): Promise<FileChange[]> {
    const fileChanges: FileChange[] = [];
    
    console.log(`[ResponseExtractor] Processing ${codeBlocks.length} code blocks for file changes`);
    
    for (let i = 0; i < codeBlocks.length; i++) {
      const block = codeBlocks[i];
      console.log(`[ResponseExtractor] Block ${i}: language=${block.language}, filename=${block.filename || 'NONE'}, contentLength=${block.content.length}`);
      
      let filename = block.filename;
      
      // If no filename provided, try to extract from response text based on block content and position
      if (!filename) {
        console.log(`[ResponseExtractor] Block ${i}: No filename provided, attempting to extract from context`);
        filename = this.extractFilenameFromContent(block, responseText, i);
        
        if (filename) {
          console.log(`[ResponseExtractor] Block ${i}: Extracted filename from context: ${filename}`);
          // Update the block with the found filename
          block.filename = filename;
        } else {
          console.log(`[ResponseExtractor] Block ${i}: Could not extract filename, attempting fallback strategies`);
          filename = this.generateFilenameFromLanguage(block.language, i);
          if (filename) {
            console.log(`[ResponseExtractor] Block ${i}: Generated fallback filename: ${filename}`);
            block.filename = filename;
          }
        }
      }
      
      if (!filename) {
        console.log(`[ResponseExtractor] Block ${i}: Skipping - no filename could be determined`);
        continue;
      }

      const filePath = this.resolveFilePath(filename);
      console.log(`[ResponseExtractor] Block ${i}: Resolved path=${filePath}`);
      
      const changeType = await this.determineChangeType(filePath, block, responseText);
      console.log(`[ResponseExtractor] Block ${i}: Change type=${changeType || 'NONE'}`);
      
      if (changeType) {
        const originalContent = await this.getOriginalContent(filePath);
        
        // Clean the content before applying
        const cleanedContent = this.cleanCodeContent(block.content, filename);
        
        fileChanges.push({
          path: filePath,
          content: cleanedContent,
          type: changeType,
          originalContent,
          isPartialChange: block.isPartialUpdate,
          lineRange: this.extractLineRange(responseText, block)
        });
        console.log(`[ResponseExtractor] Block ${i}: Added as file change`);
      } else {
        console.log(`[ResponseExtractor] Block ${i}: No valid change type determined`);
      }
    }

    console.log(`[ResponseExtractor] Final result: ${fileChanges.length} file changes from ${codeBlocks.length} code blocks`);
    return fileChanges;
  }

  /**
   * Extract filename from various contexts
   */
  private extractFilename(comment: string | undefined, text: string, position: number): string | undefined {
    if (comment) {
      // Check if comment contains a filename
      const filenameMatch = comment.match(/([^\/\s]+\.[a-zA-Z]+)/);
      if (filenameMatch) {
        console.log(`[ResponseExtractor] Found filename in comment: ${filenameMatch[1]}`);
        return filenameMatch[1];
      }
    }

    // Look for filename references near the code block
    const contextBefore = text.substring(Math.max(0, position - 300), position);
    const contextAfter = text.substring(position, position + 100);
    
    // Enhanced patterns for file references - more comprehensive
    const patterns = [
      // Direct file mentions
      /(?:file|update|modify|create|save(?:\s+(?:to|as))?|write(?:\s+to)?|in)\s+`?([^`\s\/]+\.[a-zA-Z0-9]+)`?/i,
      // File with path
      /(?:file|update|modify|create|save|write)\s+`?([^`\s]+\/[^`\s\/]+\.[a-zA-Z0-9]+)`?/i,
      // Markdown style filename
      /\*\*([^*\/\s]+\.[a-zA-Z0-9]+)\*\*/,
      // Backtick filename
      /`([^`\/\s]+\.[a-zA-Z0-9]+)`/,
      // Colon pattern (filename:)
      /([^\/\s]+\.[a-zA-Z0-9]+):/,
      // Code block comment
      /```[a-zA-Z]*\s*(?:\/\/|#)?\s*([^\/\s]+\.[a-zA-Z0-9]+)/,
      // File extension after language
      /```[a-zA-Z]*\s+([^\/\s]+\.[a-zA-Z0-9]+)/,
      // Here's your ... pattern
      /here(?:'s|'s)?\s+(?:your|the|updated?)\s+`?([^`\s\/]+\.[a-zA-Z0-9]+)`?/i,
      // For filename pattern
      /for\s+`?([^`\s\/]+\.[a-zA-Z0-9]+)`?/i,
      // Add this to filename
      /add\s+(?:this\s+)?(?:to\s+)?`?([^`\s\/]+\.[a-zA-Z0-9]+)`?/i,
      // Update filename
      /update\s+(?:your\s+)?`?([^`\s\/]+\.[a-zA-Z0-9]+)`?/i
    ];

    console.log(`[ResponseExtractor] Searching for filename around position ${position}`);
    console.log(`[ResponseExtractor] Context before: "${contextBefore.slice(-100)}"`);
    console.log(`[ResponseExtractor] Context after: "${contextAfter.slice(0, 100)}"`);

    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      const matchBefore = contextBefore.match(pattern);
      const matchAfter = contextAfter.match(pattern);
      const match = matchBefore || matchAfter;
      
      if (match) {
        const filename = match[1];
        console.log(`[ResponseExtractor] Pattern ${i} matched filename: ${filename}`);
        
        // Validate the filename
        if (this.isValidFilename(filename)) {
          console.log(`[ResponseExtractor] Filename validated: ${filename}`);
          return filename;
        } else {
          console.log(`[ResponseExtractor] Filename rejected (invalid): ${filename}`);
        }
      }
    }

    console.log(`[ResponseExtractor] No filename found in context`);
    return undefined;
  }

  /**
   * Validate if extracted text is a reasonable filename
   */
  private isValidFilename(filename: string): boolean {
    // Must have extension
    if (!filename.includes('.')) return false;
    
    // Must not be too long
    if (filename.length > 100) return false;
    
    // Must not contain invalid characters
    if (/[<>:"|?*]/.test(filename)) return false;
    
    // Must have reasonable extension
    const ext = filename.split('.').pop()?.toLowerCase();
    const validExtensions = [
      'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'go', 'rs', 'cpp', 'c', 'cs',
      'php', 'rb', 'swift', 'kt', 'scala', 'html', 'css', 'scss', 'vue',
      'svelte', 'md', 'json', 'yaml', 'yml', 'xml', 'sql', 'sh', 'bat'
    ];
    
    return validExtensions.includes(ext || '');
  }

  /**
   * Extract filename from response text by finding the code block and analyzing context
   */
  private extractFilenameFromContent(block: CodeBlock, responseText: string, blockIndex: number): string | undefined {
    // Find the code block in the response text by matching content
    const codeBlockPattern = new RegExp(`\`\`\`${block.language || '[a-zA-Z]*'}\n${this.escapeRegex(block.content.substring(0, 100))}`);
    const match = responseText.match(codeBlockPattern);
    
    if (match) {
      const position = match.index || 0;
      console.log(`[ResponseExtractor] Found code block ${blockIndex} at position ${position}`);
      return this.extractFilename(undefined, responseText, position);
    }

    // Alternative approach: search for the code block by looking for partial content matches
    const firstLine = block.content.split('\n')[0].trim();
    if (firstLine.length > 10) {
      const firstLineIndex = responseText.indexOf(firstLine);
      if (firstLineIndex !== -1) {
        console.log(`[ResponseExtractor] Found code block ${blockIndex} by first line at position ${firstLineIndex}`);
        return this.extractFilename(undefined, responseText, firstLineIndex);
      }
    }

    console.log(`[ResponseExtractor] Could not locate code block ${blockIndex} in response text`);
    return undefined;
  }

  /**
   * Generate a reasonable filename based on language and content
   */
  private generateFilenameFromLanguage(language?: string, blockIndex: number = 0): string | undefined {
    if (!language || language === 'text') return undefined;

    const extensionMap: Record<string, string> = {
      'javascript': 'js',
      'typescript': 'ts',
      'jsx': 'jsx',
      'tsx': 'tsx',
      'python': 'py',
      'java': 'java',
      'go': 'go',
      'rust': 'rs',
      'cpp': 'cpp',
      'c': 'c',
      'csharp': 'cs',
      'php': 'php',
      'ruby': 'rb',
      'swift': 'swift',
      'kotlin': 'kt',
      'scala': 'scala',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'json': 'json',
      'yaml': 'yaml',
      'yml': 'yml',
      'xml': 'xml',
      'sql': 'sql',
      'bash': 'sh',
      'shell': 'sh',
      'markdown': 'md'
    };

    const extension = extensionMap[language.toLowerCase()];
    if (!extension) return undefined;

    // Generate contextual filenames based on common patterns
    const contextualNames: Record<string, string[]> = {
      'js': ['app.js', 'index.js', 'server.js', 'script.js'],
      'json': ['package.json', 'config.json', 'data.json'],
      'html': ['index.html', 'page.html'],
      'css': ['style.css', 'main.css'],
      'md': ['README.md', 'docs.md'],
      'py': ['main.py', 'app.py', 'script.py'],
      'sh': ['setup.sh', 'script.sh', 'install.sh']
    };

    const suggestions = contextualNames[extension] || [`file.${extension}`];
    return suggestions[blockIndex % suggestions.length];
  }

  /**
   * Clean code content by removing comments and artifacts that shouldn't be in the final file
   */
  private cleanCodeContent(content: string, filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    let cleaned = content;
    
    // Remove filename comments at the beginning
    const lines = cleaned.split('\n');
    
    // For JSON files, remove any leading comments
    if (ext === '.json') {
      // Remove lines that look like filename comments
      while (lines.length > 0 && (
        lines[0].trim().startsWith('//') ||
        lines[0].trim().startsWith('#') ||
        lines[0].trim() === ''
      )) {
        lines.shift();
      }
      cleaned = lines.join('\n');
    }
    
    // For other files, only remove filename comments that match the actual filename
    else {
      const baseName = path.basename(filename);
      if (lines.length > 0) {
        const firstLine = lines[0].trim();
        // Remove if it's a comment containing just the filename
        if (
          (firstLine.startsWith('//') && firstLine.includes(baseName)) ||
          (firstLine.startsWith('#') && firstLine.includes(baseName)) ||
          (firstLine.startsWith('/*') && firstLine.includes(baseName))
        ) {
          lines.shift();
          cleaned = lines.join('\n');
        }
      }
    }
    
    // Remove trailing whitespace
    cleaned = cleaned.trimEnd();
    
    console.log(`[ResponseExtractor] Cleaned content for ${filename}: removed ${content.length - cleaned.length} characters`);
    return cleaned;
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Determine if content represents a full file or partial update
   */
  private isFullFileContent(content: string, filename?: string): boolean {
    if (!filename) return false;

    // Check for file-level indicators
    const hasImports = /^(import|require|#include|using)\s+/m.test(content);
    const hasExports = /(export|module\.exports|public class)/m.test(content);
    const hasFileStructure = hasImports && hasExports;
    
    // Check line count (full files are usually longer)
    const lineCount = content.split('\n').length;
    
    return hasFileStructure || lineCount > 20;
  }

  /**
   * Determine if this is a partial update based on context
   */
  private isPartialUpdate(content: string, fullText: string, position: number): boolean {
    const contextBefore = fullText.substring(Math.max(0, position - 100), position);
    
    // Look for update indicators
    const updateKeywords = ['update', 'modify', 'change', 'replace', 'add to', 'insert'];
    return updateKeywords.some(keyword => 
      contextBefore.toLowerCase().includes(keyword)
    );
  }

  /**
   * Resolve relative file paths to absolute paths within project
   */
  private resolveFilePath(filename: string): string {
    if (path.isAbsolute(filename)) {
      // Ensure it's within project root
      if (filename.startsWith(this.projectRoot)) {
        return filename;
      }
    }
    
    // Handle relative paths
    if (filename.startsWith('./') || filename.startsWith('../')) {
      return path.resolve(this.projectRoot, filename);
    }
    
    // Handle project-relative paths (src/components/Button.tsx)
    if (filename.includes('/')) {
      return path.join(this.projectRoot, filename);
    }
    
    // Single filename - try to find it in project
    return path.join(this.projectRoot, filename);
  }

  /**
   * Determine the type of change (create, update, delete)
   */
  private async determineChangeType(filePath: string, block: CodeBlock, context: string): Promise<'create' | 'update' | 'delete' | null> {
    try {
      await fs.access(filePath);
      
      // File exists - check if it's a deletion
      if (context.toLowerCase().includes('delete') || context.toLowerCase().includes('remove')) {
        return 'delete';
      }
      
      return 'update';
    } catch {
      // File doesn't exist
      if (block.content.trim().length > 0) {
        return 'create';
      }
    }
    
    return null;
  }

  /**
   * Get original file content if it exists
   */
  private async getOriginalContent(filePath: string): Promise<string | undefined> {
    try {
      return await fs.readFile(filePath, 'utf8');
    } catch {
      return undefined;
    }
  }

  /**
   * Extract line range for partial updates
   */
  private extractLineRange(text: string, block: CodeBlock): { start: number; end: number } | undefined {
    const lineRegex = /lines?\s+(\d+)(?:\s*[-–]\s*(\d+))?/i;
    const match = text.match(lineRegex);
    
    if (match) {
      const start = parseInt(match[1]);
      const end = match[2] ? parseInt(match[2]) : start;
      return { start, end };
    }
    
    return undefined;
  }

  /**
   * Extract explanation text (non-code content)
   */
  private extractExplanation(text: string, codeBlocks: CodeBlock[]): string | undefined {
    let explanation = text;
    
    // Remove code blocks from explanation
    explanation = explanation.replace(/```[\s\S]*?```/g, '');
    
    // Clean up and trim
    explanation = explanation.replace(/\n{3,}/g, '\n\n').trim();
    
    return explanation && explanation.length > 50 ? explanation : undefined;
  }

  /**
   * Detect programming language from filename extension
   */
  private detectLanguageFromFilename(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const langMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.go': 'go',
      '.rs': 'rust',
      '.php': 'php',
      '.rb': 'ruby',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.scala': 'scala',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.less': 'less',
      '.json': 'json',
      '.xml': 'xml',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.md': 'markdown',
      '.sh': 'bash',
      '.sql': 'sql'
    };
    
    return langMap[ext] || 'text';
  }
}