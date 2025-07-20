// Content script module for extracting AI responses from web interfaces

interface ExtractedCode {
  content: string;
  language?: string;
  filename?: string;
  provider: string;
  timestamp: number;
  actionHint?: string; // 'create', 'update', 'modify', etc.
}

class ResponseExtractor {
  private provider: string;
  private lastProcessedResponse: string = '';
  private extractionTimer: number | null = null;

  constructor() {
    this.provider = this.detectProvider();
    this.setupResponseWatcher();
  }

  private detectProvider(): string {
    const hostname = window.location.hostname;
    if (hostname.includes('claude.ai')) return 'claude';
    if (hostname.includes('chatgpt.com')) return 'chatgpt';
    if (hostname.includes('gemini.google.com')) return 'gemini';
    if (hostname.includes('perplexity.ai')) return 'perplexity';
    if (hostname.includes('chat.mistral.ai')) return 'mistral';
    return 'unknown';
  }

  private setupResponseWatcher(): void {
    // Watch for new AI responses
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // Debounce extraction to avoid multiple triggers
          if (this.extractionTimer) {
            clearTimeout(this.extractionTimer);
          }
          
          this.extractionTimer = window.setTimeout(() => {
            this.extractLatestResponse();
          }, 1000);
        }
      });
    });

    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    console.log(`Response extractor initialized for ${this.provider}`);
  }

  private async extractLatestResponse(): Promise<void> {
    try {
      const responseText = this.getLatestResponseText();
      console.log('Response text length:', responseText.length);
      
      if (responseText && responseText !== this.lastProcessedResponse) {
        console.log('New response detected, extracting code...');
        console.log('Response preview:', responseText.substring(0, 200));
        
        const extractedCode = this.extractCodeFromResponse(responseText);
        
        if (extractedCode.length > 0) {
          console.log(`Extracted ${extractedCode.length} code blocks`);
          console.log('Extracted code details:', extractedCode);
          this.showExtractionNotification(extractedCode.length);
          
          // Send to background script for processing
          await this.sendCodeToBackground(extractedCode, responseText);
        } else {
          console.log('No code blocks found in response');
        }
        
        this.lastProcessedResponse = responseText;
      }
    } catch (error) {
      console.error('Failed to extract response:', error);
    }
  }

  private getLatestResponseText(): string {
    let responseElement: Element | null = null;

    switch (this.provider) {
      case 'claude':
        // Claude's response containers
        const claudeMessages = document.querySelectorAll('[data-message-role="assistant"]');
        responseElement = claudeMessages[claudeMessages.length - 1];
        break;

      case 'chatgpt':
        // ChatGPT's response containers
        const gptMessages = document.querySelectorAll('[data-message-author-role="assistant"]');
        responseElement = gptMessages[gptMessages.length - 1];
        break;

      case 'gemini':
        // Gemini's response containers
        const geminiMessages = document.querySelectorAll('.model-response');
        responseElement = geminiMessages[geminiMessages.length - 1];
        break;

      default:
        // Generic fallback - look for common response patterns
        const genericMessages = document.querySelectorAll('.message, .response, .chat-message');
        responseElement = genericMessages[genericMessages.length - 1];
    }

    return responseElement ? responseElement.textContent || responseElement.innerHTML : '';
  }

  private extractCodeFromResponse(responseText: string): ExtractedCode[] {
    const extractedCode: ExtractedCode[] = [];

    // First try to extract from artifacts/special containers
    const artifactCode = this.extractFromArtifacts();
    extractedCode.push(...artifactCode);

    // Then extract from markdown code blocks in the text
    const markdownCode = this.extractFromMarkdown(responseText);
    extractedCode.push(...markdownCode);

    // Remove duplicates
    return this.deduplicateCode(extractedCode);
  }

  private extractFromArtifacts(): ExtractedCode[] {
    const artifacts: ExtractedCode[] = [];

    if (this.provider === 'claude') {
      // Claude artifacts
      const artifactContainers = document.querySelectorAll('[data-artifact-id]');
      artifactContainers.forEach((container) => {
        const codeElement = container.querySelector('pre code, .artifact-content');
        if (codeElement) {
          const content = codeElement.textContent || '';
          const language = this.detectLanguageFromArtifact(container);
          const filename = this.extractFilenameFromArtifact(container);

          if (content.trim().length > 10) {
            artifacts.push({
              content: content.trim(),
              language,
              filename,
              provider: this.provider,
              timestamp: Date.now()
            });
          }
        }
      });
    } else if (this.provider === 'chatgpt') {
      // ChatGPT code blocks
      const codeBlocks = document.querySelectorAll('pre code');
      codeBlocks.forEach((codeElement) => {
        const content = codeElement.textContent || '';
        const language = this.detectLanguageFromClass(codeElement);

        if (content.trim().length > 10) {
          artifacts.push({
            content: content.trim(),
            language,
            provider: this.provider,
            timestamp: Date.now()
          });
        }
      });
    }

    return artifacts;
  }

  private extractFromMarkdown(text: string): ExtractedCode[] {
    const codeBlocks: ExtractedCode[] = [];
    
    // Enhanced regex for markdown code blocks with filename detection
    const codeBlockRegex = /```(\w+)?\s*(?:\/\/\s*(.+?))?\n([\s\S]*?)```/g;
    
    // Also look for file headers like "Create file.js:" or "Update package.json:"
    const fileHeaderRegex = /(create|update|modify|add)\s+([^\s:]+\.[a-zA-Z]+):?\s*\n```(\w+)?\n([\s\S]*?)```/gi;
    
    let match;

    // First pass: Extract blocks with file headers
    while ((match = fileHeaderRegex.exec(text)) !== null) {
      const [, action, filename, language, content] = match;
      
      if (content && content.trim().length > 10) {
        codeBlocks.push({
          content: content.trim(),
          language: language?.toLowerCase() || this.detectLanguageFromFilename(filename),
          filename: filename,
          provider: this.provider,
          timestamp: Date.now(),
          actionHint: action.toLowerCase() // Add action hint for better analysis
        });
      }
    }

    // Second pass: Regular code blocks
    while ((match = codeBlockRegex.exec(text)) !== null) {
      const [, language, comment, content] = match;
      
      if (content && content.trim().length > 10) {
        // Skip if already captured by file header regex
        const isDuplicate = codeBlocks.some(block => 
          block.content === content.trim()
        );
        
        if (!isDuplicate) {
          codeBlocks.push({
            content: content.trim(),
            language: language?.toLowerCase(),
            filename: comment ? this.extractFilenameFromComment(comment) : undefined,
            provider: this.provider,
            timestamp: Date.now()
          });
        }
      }
    }

    return codeBlocks;
  }

  private detectLanguageFromFilename(filename: string): string | undefined {
    const ext = filename.split('.').pop()?.toLowerCase();
    const langMap: { [key: string]: string } = {
      'js': 'javascript',
      'ts': 'typescript', 
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'go': 'go',
      'rs': 'rust',
      'php': 'php',
      'rb': 'ruby',
      'swift': 'swift',
      'kt': 'kotlin',
      'json': 'json',
      'yaml': 'yaml',
      'yml': 'yaml'
    };
    return ext ? langMap[ext] : undefined;
  }

  private detectLanguageFromArtifact(container: Element): string | undefined {
    // Look for language indicators in artifact data attributes
    const langAttr = container.getAttribute('data-language');
    if (langAttr) return langAttr;

    // Look for language in title or other attributes
    const title = container.getAttribute('data-title') || container.getAttribute('title');
    if (title) {
      const langMatch = title.match(/\.(ts|js|py|java|cpp|go|rs|php|rb|swift|kt)$/i);
      if (langMatch) return langMatch[1].toLowerCase();
    }

    return undefined;
  }

  private detectLanguageFromClass(element: Element): string | undefined {
    const className = element.className;
    const langMatch = className.match(/language-(\w+)/);
    return langMatch ? langMatch[1] : undefined;
  }

  private extractFilenameFromArtifact(container: Element): string | undefined {
    const title = container.getAttribute('data-title') || container.getAttribute('title');
    if (title) {
      const filenameMatch = title.match(/([^\/\s]+\.[a-zA-Z]+)/);
      if (filenameMatch) return filenameMatch[1];
    }
    return undefined;
  }

  private extractFilenameFromComment(comment: string): string | undefined {
    const filenameMatch = comment.match(/([^\/\s]+\.[a-zA-Z]+)/);
    return filenameMatch ? filenameMatch[1] : undefined;
  }

  private deduplicateCode(codeBlocks: ExtractedCode[]): ExtractedCode[] {
    const seen = new Set<string>();
    return codeBlocks.filter(block => {
      const key = `${block.content.substring(0, 100)}_${block.language}_${block.filename}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private async sendCodeToBackground(extractedCode: ExtractedCode[], fullResponse: string): Promise<void> {
    try {
      console.log('Sending code to background script...');
      const response = await chrome.runtime.sendMessage({
        type: 'CODE_EXTRACTED',
        data: {
          extractedCode,
          fullResponse,
          provider: this.provider,
          url: window.location.href,
          timestamp: Date.now()
        }
      });

      console.log('Background script response:', response);
      if (response && response.success) {
        console.log('Code sent to background script successfully');
      } else {
        console.error('Background script returned error:', response);
      }
    } catch (error) {
      console.error('Failed to send code to background:', error);
    }
  }

  private showExtractionNotification(codeBlockCount: number): void {
    const notification = document.createElement('div');
    notification.innerHTML = `🔍 Extracted ${codeBlockCount} code block${codeBlockCount > 1 ? 's' : ''}`;
    notification.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 10001;
      font-family: system-ui;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      animation: slideInRight 0.3s ease-out;
      cursor: pointer;
    `;

    // Add click handler to show extracted code
    notification.addEventListener('click', () => {
      this.showExtractedCodePreview();
      notification.remove();
    });

    document.body.appendChild(notification);

    // Auto-remove after 4 seconds
    setTimeout(() => {
      notification.style.animation = 'slideInRight 0.3s ease-out reverse';
      setTimeout(() => notification.remove(), 300);
    }, 4000);
  }

  private showExtractedCodePreview(): void {
    // This will be implemented to show a preview of extracted code
    console.log('Code preview will be shown here');
  }

  // Public method to manually trigger extraction
  public manualExtract(): void {
    this.extractLatestResponse();
  }

  // Public method to get current provider
  public getProvider(): string {
    return this.provider;
  }
}

// Initialize the response extractor
const responseExtractor = new ResponseExtractor();

// Add to global scope for manual triggering
(window as any).responseExtractor = responseExtractor;