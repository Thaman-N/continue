/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./src/content/responseExtractor.ts":
/*!******************************************!*\
  !*** ./src/content/responseExtractor.ts ***!
  \******************************************/
/***/ (() => {

// Content script module for extracting AI responses from web interfaces
class ResponseExtractor {
    provider;
    lastProcessedResponse = '';
    extractionTimer = null;
    constructor() {
        this.provider = this.detectProvider();
        this.setupResponseWatcher();
    }
    detectProvider() {
        const hostname = window.location.hostname;
        if (hostname.includes('claude.ai'))
            return 'claude';
        if (hostname.includes('chatgpt.com'))
            return 'chatgpt';
        if (hostname.includes('gemini.google.com'))
            return 'gemini';
        if (hostname.includes('perplexity.ai'))
            return 'perplexity';
        if (hostname.includes('chat.mistral.ai'))
            return 'mistral';
        return 'unknown';
    }
    setupResponseWatcher() {
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
    async extractLatestResponse() {
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
                }
                else {
                    console.log('No code blocks found in response');
                }
                this.lastProcessedResponse = responseText;
            }
        }
        catch (error) {
            console.error('Failed to extract response:', error);
        }
    }
    getLatestResponseText() {
        let responseElement = null;
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
    extractCodeFromResponse(responseText) {
        const extractedCode = [];
        // First try to extract from artifacts/special containers
        const artifactCode = this.extractFromArtifacts();
        extractedCode.push(...artifactCode);
        // Then extract from markdown code blocks in the text
        const markdownCode = this.extractFromMarkdown(responseText);
        extractedCode.push(...markdownCode);
        // Remove duplicates
        return this.deduplicateCode(extractedCode);
    }
    extractFromArtifacts() {
        const artifacts = [];
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
        }
        else if (this.provider === 'chatgpt') {
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
    extractFromMarkdown(text) {
        const codeBlocks = [];
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
                const isDuplicate = codeBlocks.some(block => block.content === content.trim());
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
    detectLanguageFromFilename(filename) {
        const ext = filename.split('.').pop()?.toLowerCase();
        const langMap = {
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
    detectLanguageFromArtifact(container) {
        // Look for language indicators in artifact data attributes
        const langAttr = container.getAttribute('data-language');
        if (langAttr)
            return langAttr;
        // Look for language in title or other attributes
        const title = container.getAttribute('data-title') || container.getAttribute('title');
        if (title) {
            const langMatch = title.match(/\.(ts|js|py|java|cpp|go|rs|php|rb|swift|kt)$/i);
            if (langMatch)
                return langMatch[1].toLowerCase();
        }
        return undefined;
    }
    detectLanguageFromClass(element) {
        const className = element.className;
        const langMatch = className.match(/language-(\w+)/);
        return langMatch ? langMatch[1] : undefined;
    }
    extractFilenameFromArtifact(container) {
        const title = container.getAttribute('data-title') || container.getAttribute('title');
        if (title) {
            const filenameMatch = title.match(/([^\/\s]+\.[a-zA-Z]+)/);
            if (filenameMatch)
                return filenameMatch[1];
        }
        return undefined;
    }
    extractFilenameFromComment(comment) {
        const filenameMatch = comment.match(/([^\/\s]+\.[a-zA-Z]+)/);
        return filenameMatch ? filenameMatch[1] : undefined;
    }
    deduplicateCode(codeBlocks) {
        const seen = new Set();
        return codeBlocks.filter(block => {
            const key = `${block.content.substring(0, 100)}_${block.language}_${block.filename}`;
            if (seen.has(key))
                return false;
            seen.add(key);
            return true;
        });
    }
    async sendCodeToBackground(extractedCode, fullResponse) {
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
            }
            else {
                console.error('Background script returned error:', response);
            }
        }
        catch (error) {
            console.error('Failed to send code to background:', error);
        }
    }
    showExtractionNotification(codeBlockCount) {
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
    showExtractedCodePreview() {
        // This will be implemented to show a preview of extracted code
        console.log('Code preview will be shown here');
    }
    // Public method to manually trigger extraction
    manualExtract() {
        this.extractLatestResponse();
    }
    // Public method to get current provider
    getProvider() {
        return this.provider;
    }
}
// Initialize the response extractor
const responseExtractor = new ResponseExtractor();
// Add to global scope for manual triggering
window.responseExtractor = responseExtractor;


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be in strict mode.
(() => {
"use strict";
/*!******************************!*\
  !*** ./src/content/index.ts ***!
  \******************************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _responseExtractor__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./responseExtractor */ "./src/content/responseExtractor.ts");
/* harmony import */ var _responseExtractor__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_responseExtractor__WEBPACK_IMPORTED_MODULE_0__);
// Content script for LLM provider websites
console.log('AI Coding Assistant content script loaded on:', window.location.hostname);
// Import response extractor

// Detect which LLM provider we're on
const detectProvider = () => {
    const hostname = window.location.hostname;
    if (hostname.includes('chatgpt.com'))
        return 'chatgpt';
    if (hostname.includes('claude.ai'))
        return 'claude';
    if (hostname.includes('gemini.google.com'))
        return 'gemini';
    if (hostname.includes('perplexity.ai'))
        return 'perplexity';
    if (hostname.includes('chat.mistral.ai'))
        return 'mistral';
    if (hostname.includes('huggingface.co'))
        return 'huggingface';
    return 'unknown';
};
const provider = detectProvider();
console.log('Detected provider:', provider);
// Enhanced provider-specific selectors and logic
const providerConfig = {
    chatgpt: {
        inputSelector: [
            '#prompt-textarea',
            'textarea[data-id="root"]',
            'textarea[placeholder*="message"]',
            '.ProseMirror'
        ],
        sendButtonSelector: [
            'button[data-testid="send-button"]',
            'button[aria-label="Send message"]',
            'button:has(svg[data-testid="send-icon"])'
        ],
        messageSelector: '[data-message-author-role="assistant"]',
        waitForElement: true,
    },
    claude: {
        inputSelector: [
            'div[contenteditable="true"]',
            '.ProseMirror',
            'textarea'
        ],
        sendButtonSelector: [
            'button[aria-label="Send Message"]',
            'button:has(svg[viewBox="0 0 24 24"])',
            'button[type="submit"]'
        ],
        messageSelector: '.message-content',
        waitForElement: true,
    },
    gemini: {
        inputSelector: [
            'rich-textarea',
            'textarea',
            '.ql-editor'
        ],
        sendButtonSelector: [
            'button[aria-label="Send message"]',
            'button:has(svg)',
            'button[type="submit"]'
        ],
        messageSelector: '.model-response-text',
        waitForElement: true,
    },
    mistral: {
        inputSelector: [
            'textarea',
            '.ProseMirror',
            'div[contenteditable="true"]'
        ],
        sendButtonSelector: [
            'button[type="submit"]',
            'button:has(svg)',
            'button[aria-label*="send"]'
        ],
        messageSelector: '.message',
        waitForElement: true,
    },
    huggingface: {
        inputSelector: [
            'textarea',
            'input[type="text"]',
            '.ProseMirror'
        ],
        sendButtonSelector: [
            'button[type="submit"]',
            'button:has(svg)',
            'button[aria-label*="send"]'
        ],
        messageSelector: '.message',
        waitForElement: true,
    },
    perplexity: {
        inputSelector: [
            'textarea[placeholder*="Ask"]',
            'textarea',
            '.ProseMirror'
        ],
        sendButtonSelector: [
            'button[aria-label*="Submit"]',
            'button:has(svg)',
            'button[type="submit"]'
        ],
        messageSelector: '.message-content',
        waitForElement: true,
    },
};
// Initialize provider-specific functionality
if (provider !== 'unknown') {
    initializeProvider(provider);
}
function initializeProvider(providerType) {
    console.log(`Initializing ${providerType} integration`);
    // Add visual indicators
    addExtensionIndicator();
    // Set up DOM observers
    setupDOMObservers();
    // Add keyboard shortcuts
    setupKeyboardShortcuts();
    // Set up message listener for prompt injection
    setupMessageListener();
}
function addExtensionIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'ai-assistant-indicator';
    indicator.innerHTML = '🤖 AI Assistant Enhanced';
    indicator.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 12px;
    z-index: 10000;
    font-family: system-ui;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    transition: opacity 0.3s ease;
  `;
    document.body.appendChild(indicator);
    // Auto-fade after 3 seconds
    setTimeout(() => {
        indicator.style.opacity = '0.7';
    }, 3000);
    // Remove after 10 seconds
    setTimeout(() => {
        indicator.remove();
    }, 10000);
}
function setupDOMObservers() {
    // Watch for new messages and UI changes
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                // Handle new messages or UI changes
                console.log('DOM changed, checking for new content');
            }
        });
    });
    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });
}
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl+Shift+K for inserting context (now handled by background script)
        if (e.ctrlKey && e.shiftKey && e.key === 'K') {
            e.preventDefault();
            console.log('Ctrl+Shift+K pressed - background script will handle context insertion');
        }
    });
}
function setupMessageListener() {
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('Content script received message:', message);
        switch (message.type) {
            case 'INJECT_FORMATTED_PROMPT':
                handleInjectFormattedPrompt(message, sendResponse);
                return true; // Keep channel open for async response
            case 'GET_SELECTED_TEXT':
                const selectedText = window.getSelection()?.toString() || '';
                sendResponse({ selectedText });
                break;
            case 'GET_CURRENT_INPUT':
                const currentText = getCurrentInputText();
                sendResponse({ text: currentText });
                break;
            default:
                sendResponse({ error: 'Unknown message type' });
        }
    });
}
async function handleInjectFormattedPrompt(message, sendResponse) {
    try {
        const { prompt, provider: llmProvider, contextItems } = message;
        if (!prompt) {
            sendResponse({ error: 'No prompt provided' });
            return;
        }
        // Show a temporary notification
        showTemporaryNotification(`Inserting ${contextItems?.length || 0} context items...`);
        // Find the input element
        const inputElement = await findInputElement();
        if (!inputElement) {
            sendResponse({ error: 'Could not find input element' });
            return;
        }
        // Insert the formatted prompt
        await insertFormattedPrompt(inputElement, prompt);
        // Show success notification
        showTemporaryNotification('✅ Context inserted successfully!', 'success');
        sendResponse({ success: true, inserted: true });
    }
    catch (error) {
        console.error('Failed to inject formatted prompt:', error);
        sendResponse({ error: 'Failed to inject prompt' });
    }
}
async function findInputElement() {
    const config = providerConfig[provider];
    if (!config)
        return null;
    // Try multiple selectors
    for (const selector of config.inputSelector) {
        const element = document.querySelector(selector);
        if (element && isElementVisible(element)) {
            console.log('Found input element with selector:', selector);
            return element;
        }
    }
    // If waiting is enabled, try waiting for element to appear
    if (config.waitForElement) {
        console.log('Waiting for input element to appear...');
        return waitForElement(config.inputSelector, 5000);
    }
    return null;
}
function waitForElement(selectors, timeout) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        const checkForElement = () => {
            for (const selector of selectors) {
                const element = document.querySelector(selector);
                if (element && isElementVisible(element)) {
                    resolve(element);
                    return;
                }
            }
            if (Date.now() - startTime > timeout) {
                resolve(null);
                return;
            }
            setTimeout(checkForElement, 100);
        };
        checkForElement();
    });
}
function isElementVisible(element) {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        element.offsetWidth > 0 &&
        element.offsetHeight > 0;
}
async function insertFormattedPrompt(inputElement, prompt) {
    // Clear existing content first
    clearInputElement(inputElement);
    // Wait a bit for UI to update
    await new Promise(resolve => setTimeout(resolve, 100));
    // Insert the new prompt
    if (inputElement.tagName === 'TEXTAREA') {
        const textarea = inputElement;
        textarea.value = prompt;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
    }
    else if (inputElement.contentEditable === 'true') {
        inputElement.textContent = prompt;
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    }
    else if (inputElement.classList.contains('ProseMirror')) {
        // Handle ProseMirror editor
        inputElement.textContent = prompt;
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    }
    // Focus the element
    inputElement.focus();
    // Trigger any additional events that might be needed
    inputElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
}
function clearInputElement(inputElement) {
    if (inputElement.tagName === 'TEXTAREA') {
        inputElement.value = '';
    }
    else if (inputElement.contentEditable === 'true') {
        inputElement.textContent = '';
    }
}
function getCurrentInputText() {
    const config = providerConfig[provider];
    if (!config)
        return '';
    // Try to find the input element and get its current text
    for (const selector of config.inputSelector) {
        const element = document.querySelector(selector);
        if (element && isElementVisible(element)) {
            if (element.tagName === 'TEXTAREA') {
                return element.value;
            }
            else if (element.contentEditable === 'true') {
                return element.textContent || '';
            }
        }
    }
    return '';
}
function showTemporaryNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
    position: fixed;
    top: 50px;
    right: 20px;
    background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 14px;
    z-index: 10001;
    font-family: system-ui;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    animation: slideInRight 0.3s ease-out;
  `;
    // Add animation keyframes
    if (!document.querySelector('#ai-assistant-animations')) {
        const style = document.createElement('style');
        style.id = 'ai-assistant-animations';
        style.textContent = `
      @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
        document.head.appendChild(style);
    }
    document.body.appendChild(notification);
    // Auto-remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideInRight 0.3s ease-out reverse';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

})();

/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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O0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esb0RBQW9ELGVBQWU7QUFDbkUscURBQXFELGVBQWU7QUFDcEU7QUFDQTtBQUNBO0FBQ0Esd0RBQXdELGVBQWU7QUFDdkU7QUFDQTtBQUNBO0FBQ0E7QUFDQSx3REFBd0QsZUFBZTtBQUN2RTtBQUNBO0FBQ0E7QUFDQTtBQUNBLDhEQUE4RCw2QkFBNkI7QUFDM0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxrQkFBa0I7QUFDbEI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsZUFBZSw2QkFBNkI7QUFDNUMsYUFBYSwwQkFBMEI7QUFDdkM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vYnJvd3Nlci1leHRlbnNpb24vLi9zcmMvY29udGVudC9yZXNwb25zZUV4dHJhY3Rvci50cyIsIndlYnBhY2s6Ly9icm93c2VyLWV4dGVuc2lvbi93ZWJwYWNrL2Jvb3RzdHJhcCIsIndlYnBhY2s6Ly9icm93c2VyLWV4dGVuc2lvbi93ZWJwYWNrL3J1bnRpbWUvY29tcGF0IGdldCBkZWZhdWx0IGV4cG9ydCIsIndlYnBhY2s6Ly9icm93c2VyLWV4dGVuc2lvbi93ZWJwYWNrL3J1bnRpbWUvZGVmaW5lIHByb3BlcnR5IGdldHRlcnMiLCJ3ZWJwYWNrOi8vYnJvd3Nlci1leHRlbnNpb24vd2VicGFjay9ydW50aW1lL2hhc093blByb3BlcnR5IHNob3J0aGFuZCIsIndlYnBhY2s6Ly9icm93c2VyLWV4dGVuc2lvbi93ZWJwYWNrL3J1bnRpbWUvbWFrZSBuYW1lc3BhY2Ugb2JqZWN0Iiwid2VicGFjazovL2Jyb3dzZXItZXh0ZW5zaW9uLy4vc3JjL2NvbnRlbnQvaW5kZXgudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29udGVudCBzY3JpcHQgbW9kdWxlIGZvciBleHRyYWN0aW5nIEFJIHJlc3BvbnNlcyBmcm9tIHdlYiBpbnRlcmZhY2VzXG5jbGFzcyBSZXNwb25zZUV4dHJhY3RvciB7XG4gICAgcHJvdmlkZXI7XG4gICAgbGFzdFByb2Nlc3NlZFJlc3BvbnNlID0gJyc7XG4gICAgZXh0cmFjdGlvblRpbWVyID0gbnVsbDtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgdGhpcy5wcm92aWRlciA9IHRoaXMuZGV0ZWN0UHJvdmlkZXIoKTtcbiAgICAgICAgdGhpcy5zZXR1cFJlc3BvbnNlV2F0Y2hlcigpO1xuICAgIH1cbiAgICBkZXRlY3RQcm92aWRlcigpIHtcbiAgICAgICAgY29uc3QgaG9zdG5hbWUgPSB3aW5kb3cubG9jYXRpb24uaG9zdG5hbWU7XG4gICAgICAgIGlmIChob3N0bmFtZS5pbmNsdWRlcygnY2xhdWRlLmFpJykpXG4gICAgICAgICAgICByZXR1cm4gJ2NsYXVkZSc7XG4gICAgICAgIGlmIChob3N0bmFtZS5pbmNsdWRlcygnY2hhdGdwdC5jb20nKSlcbiAgICAgICAgICAgIHJldHVybiAnY2hhdGdwdCc7XG4gICAgICAgIGlmIChob3N0bmFtZS5pbmNsdWRlcygnZ2VtaW5pLmdvb2dsZS5jb20nKSlcbiAgICAgICAgICAgIHJldHVybiAnZ2VtaW5pJztcbiAgICAgICAgaWYgKGhvc3RuYW1lLmluY2x1ZGVzKCdwZXJwbGV4aXR5LmFpJykpXG4gICAgICAgICAgICByZXR1cm4gJ3BlcnBsZXhpdHknO1xuICAgICAgICBpZiAoaG9zdG5hbWUuaW5jbHVkZXMoJ2NoYXQubWlzdHJhbC5haScpKVxuICAgICAgICAgICAgcmV0dXJuICdtaXN0cmFsJztcbiAgICAgICAgcmV0dXJuICd1bmtub3duJztcbiAgICB9XG4gICAgc2V0dXBSZXNwb25zZVdhdGNoZXIoKSB7XG4gICAgICAgIC8vIFdhdGNoIGZvciBuZXcgQUkgcmVzcG9uc2VzXG4gICAgICAgIGNvbnN0IG9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoKG11dGF0aW9ucykgPT4ge1xuICAgICAgICAgICAgbXV0YXRpb25zLmZvckVhY2goKG11dGF0aW9uKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKG11dGF0aW9uLnR5cGUgPT09ICdjaGlsZExpc3QnICYmIG11dGF0aW9uLmFkZGVkTm9kZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBEZWJvdW5jZSBleHRyYWN0aW9uIHRvIGF2b2lkIG11bHRpcGxlIHRyaWdnZXJzXG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLmV4dHJhY3Rpb25UaW1lcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuZXh0cmFjdGlvblRpbWVyKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB0aGlzLmV4dHJhY3Rpb25UaW1lciA9IHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZXh0cmFjdExhdGVzdFJlc3BvbnNlKCk7XG4gICAgICAgICAgICAgICAgICAgIH0sIDEwMDApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgICAgLy8gU3RhcnQgb2JzZXJ2aW5nXG4gICAgICAgIG9ic2VydmVyLm9ic2VydmUoZG9jdW1lbnQuYm9keSwge1xuICAgICAgICAgICAgY2hpbGRMaXN0OiB0cnVlLFxuICAgICAgICAgICAgc3VidHJlZTogdHJ1ZSxcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnNvbGUubG9nKGBSZXNwb25zZSBleHRyYWN0b3IgaW5pdGlhbGl6ZWQgZm9yICR7dGhpcy5wcm92aWRlcn1gKTtcbiAgICB9XG4gICAgYXN5bmMgZXh0cmFjdExhdGVzdFJlc3BvbnNlKCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzcG9uc2VUZXh0ID0gdGhpcy5nZXRMYXRlc3RSZXNwb25zZVRleHQoKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdSZXNwb25zZSB0ZXh0IGxlbmd0aDonLCByZXNwb25zZVRleHQubGVuZ3RoKTtcbiAgICAgICAgICAgIGlmIChyZXNwb25zZVRleHQgJiYgcmVzcG9uc2VUZXh0ICE9PSB0aGlzLmxhc3RQcm9jZXNzZWRSZXNwb25zZSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdOZXcgcmVzcG9uc2UgZGV0ZWN0ZWQsIGV4dHJhY3RpbmcgY29kZS4uLicpO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdSZXNwb25zZSBwcmV2aWV3OicsIHJlc3BvbnNlVGV4dC5zdWJzdHJpbmcoMCwgMjAwKSk7XG4gICAgICAgICAgICAgICAgY29uc3QgZXh0cmFjdGVkQ29kZSA9IHRoaXMuZXh0cmFjdENvZGVGcm9tUmVzcG9uc2UocmVzcG9uc2VUZXh0KTtcbiAgICAgICAgICAgICAgICBpZiAoZXh0cmFjdGVkQ29kZS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBFeHRyYWN0ZWQgJHtleHRyYWN0ZWRDb2RlLmxlbmd0aH0gY29kZSBibG9ja3NgKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ0V4dHJhY3RlZCBjb2RlIGRldGFpbHM6JywgZXh0cmFjdGVkQ29kZSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2hvd0V4dHJhY3Rpb25Ob3RpZmljYXRpb24oZXh0cmFjdGVkQ29kZS5sZW5ndGgpO1xuICAgICAgICAgICAgICAgICAgICAvLyBTZW5kIHRvIGJhY2tncm91bmQgc2NyaXB0IGZvciBwcm9jZXNzaW5nXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2VuZENvZGVUb0JhY2tncm91bmQoZXh0cmFjdGVkQ29kZSwgcmVzcG9uc2VUZXh0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdObyBjb2RlIGJsb2NrcyBmb3VuZCBpbiByZXNwb25zZScpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aGlzLmxhc3RQcm9jZXNzZWRSZXNwb25zZSA9IHJlc3BvbnNlVGV4dDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBleHRyYWN0IHJlc3BvbnNlOicsIGVycm9yKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBnZXRMYXRlc3RSZXNwb25zZVRleHQoKSB7XG4gICAgICAgIGxldCByZXNwb25zZUVsZW1lbnQgPSBudWxsO1xuICAgICAgICBzd2l0Y2ggKHRoaXMucHJvdmlkZXIpIHtcbiAgICAgICAgICAgIGNhc2UgJ2NsYXVkZSc6XG4gICAgICAgICAgICAgICAgLy8gQ2xhdWRlJ3MgcmVzcG9uc2UgY29udGFpbmVyc1xuICAgICAgICAgICAgICAgIGNvbnN0IGNsYXVkZU1lc3NhZ2VzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtbWVzc2FnZS1yb2xlPVwiYXNzaXN0YW50XCJdJyk7XG4gICAgICAgICAgICAgICAgcmVzcG9uc2VFbGVtZW50ID0gY2xhdWRlTWVzc2FnZXNbY2xhdWRlTWVzc2FnZXMubGVuZ3RoIC0gMV07XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlICdjaGF0Z3B0JzpcbiAgICAgICAgICAgICAgICAvLyBDaGF0R1BUJ3MgcmVzcG9uc2UgY29udGFpbmVyc1xuICAgICAgICAgICAgICAgIGNvbnN0IGdwdE1lc3NhZ2VzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtbWVzc2FnZS1hdXRob3Itcm9sZT1cImFzc2lzdGFudFwiXScpO1xuICAgICAgICAgICAgICAgIHJlc3BvbnNlRWxlbWVudCA9IGdwdE1lc3NhZ2VzW2dwdE1lc3NhZ2VzLmxlbmd0aCAtIDFdO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAnZ2VtaW5pJzpcbiAgICAgICAgICAgICAgICAvLyBHZW1pbmkncyByZXNwb25zZSBjb250YWluZXJzXG4gICAgICAgICAgICAgICAgY29uc3QgZ2VtaW5pTWVzc2FnZXMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcubW9kZWwtcmVzcG9uc2UnKTtcbiAgICAgICAgICAgICAgICByZXNwb25zZUVsZW1lbnQgPSBnZW1pbmlNZXNzYWdlc1tnZW1pbmlNZXNzYWdlcy5sZW5ndGggLSAxXTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgLy8gR2VuZXJpYyBmYWxsYmFjayAtIGxvb2sgZm9yIGNvbW1vbiByZXNwb25zZSBwYXR0ZXJuc1xuICAgICAgICAgICAgICAgIGNvbnN0IGdlbmVyaWNNZXNzYWdlcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5tZXNzYWdlLCAucmVzcG9uc2UsIC5jaGF0LW1lc3NhZ2UnKTtcbiAgICAgICAgICAgICAgICByZXNwb25zZUVsZW1lbnQgPSBnZW5lcmljTWVzc2FnZXNbZ2VuZXJpY01lc3NhZ2VzLmxlbmd0aCAtIDFdO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXNwb25zZUVsZW1lbnQgPyByZXNwb25zZUVsZW1lbnQudGV4dENvbnRlbnQgfHwgcmVzcG9uc2VFbGVtZW50LmlubmVySFRNTCA6ICcnO1xuICAgIH1cbiAgICBleHRyYWN0Q29kZUZyb21SZXNwb25zZShyZXNwb25zZVRleHQpIHtcbiAgICAgICAgY29uc3QgZXh0cmFjdGVkQ29kZSA9IFtdO1xuICAgICAgICAvLyBGaXJzdCB0cnkgdG8gZXh0cmFjdCBmcm9tIGFydGlmYWN0cy9zcGVjaWFsIGNvbnRhaW5lcnNcbiAgICAgICAgY29uc3QgYXJ0aWZhY3RDb2RlID0gdGhpcy5leHRyYWN0RnJvbUFydGlmYWN0cygpO1xuICAgICAgICBleHRyYWN0ZWRDb2RlLnB1c2goLi4uYXJ0aWZhY3RDb2RlKTtcbiAgICAgICAgLy8gVGhlbiBleHRyYWN0IGZyb20gbWFya2Rvd24gY29kZSBibG9ja3MgaW4gdGhlIHRleHRcbiAgICAgICAgY29uc3QgbWFya2Rvd25Db2RlID0gdGhpcy5leHRyYWN0RnJvbU1hcmtkb3duKHJlc3BvbnNlVGV4dCk7XG4gICAgICAgIGV4dHJhY3RlZENvZGUucHVzaCguLi5tYXJrZG93bkNvZGUpO1xuICAgICAgICAvLyBSZW1vdmUgZHVwbGljYXRlc1xuICAgICAgICByZXR1cm4gdGhpcy5kZWR1cGxpY2F0ZUNvZGUoZXh0cmFjdGVkQ29kZSk7XG4gICAgfVxuICAgIGV4dHJhY3RGcm9tQXJ0aWZhY3RzKCkge1xuICAgICAgICBjb25zdCBhcnRpZmFjdHMgPSBbXTtcbiAgICAgICAgaWYgKHRoaXMucHJvdmlkZXIgPT09ICdjbGF1ZGUnKSB7XG4gICAgICAgICAgICAvLyBDbGF1ZGUgYXJ0aWZhY3RzXG4gICAgICAgICAgICBjb25zdCBhcnRpZmFjdENvbnRhaW5lcnMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1hcnRpZmFjdC1pZF0nKTtcbiAgICAgICAgICAgIGFydGlmYWN0Q29udGFpbmVycy5mb3JFYWNoKChjb250YWluZXIpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb2RlRWxlbWVudCA9IGNvbnRhaW5lci5xdWVyeVNlbGVjdG9yKCdwcmUgY29kZSwgLmFydGlmYWN0LWNvbnRlbnQnKTtcbiAgICAgICAgICAgICAgICBpZiAoY29kZUVsZW1lbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY29udGVudCA9IGNvZGVFbGVtZW50LnRleHRDb250ZW50IHx8ICcnO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBsYW5ndWFnZSA9IHRoaXMuZGV0ZWN0TGFuZ3VhZ2VGcm9tQXJ0aWZhY3QoY29udGFpbmVyKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZmlsZW5hbWUgPSB0aGlzLmV4dHJhY3RGaWxlbmFtZUZyb21BcnRpZmFjdChjb250YWluZXIpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoY29udGVudC50cmltKCkubGVuZ3RoID4gMTApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFydGlmYWN0cy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250ZW50OiBjb250ZW50LnRyaW0oKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYW5ndWFnZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWxlbmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm92aWRlcjogdGhpcy5wcm92aWRlcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aW1lc3RhbXA6IERhdGUubm93KClcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAodGhpcy5wcm92aWRlciA9PT0gJ2NoYXRncHQnKSB7XG4gICAgICAgICAgICAvLyBDaGF0R1BUIGNvZGUgYmxvY2tzXG4gICAgICAgICAgICBjb25zdCBjb2RlQmxvY2tzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgncHJlIGNvZGUnKTtcbiAgICAgICAgICAgIGNvZGVCbG9ja3MuZm9yRWFjaCgoY29kZUVsZW1lbnQpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb250ZW50ID0gY29kZUVsZW1lbnQudGV4dENvbnRlbnQgfHwgJyc7XG4gICAgICAgICAgICAgICAgY29uc3QgbGFuZ3VhZ2UgPSB0aGlzLmRldGVjdExhbmd1YWdlRnJvbUNsYXNzKGNvZGVFbGVtZW50KTtcbiAgICAgICAgICAgICAgICBpZiAoY29udGVudC50cmltKCkubGVuZ3RoID4gMTApIHtcbiAgICAgICAgICAgICAgICAgICAgYXJ0aWZhY3RzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGVudDogY29udGVudC50cmltKCksXG4gICAgICAgICAgICAgICAgICAgICAgICBsYW5ndWFnZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3ZpZGVyOiB0aGlzLnByb3ZpZGVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGltZXN0YW1wOiBEYXRlLm5vdygpXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBhcnRpZmFjdHM7XG4gICAgfVxuICAgIGV4dHJhY3RGcm9tTWFya2Rvd24odGV4dCkge1xuICAgICAgICBjb25zdCBjb2RlQmxvY2tzID0gW107XG4gICAgICAgIC8vIEVuaGFuY2VkIHJlZ2V4IGZvciBtYXJrZG93biBjb2RlIGJsb2NrcyB3aXRoIGZpbGVuYW1lIGRldGVjdGlvblxuICAgICAgICBjb25zdCBjb2RlQmxvY2tSZWdleCA9IC9gYGAoXFx3Kyk/XFxzKig/OlxcL1xcL1xccyooLis/KSk/XFxuKFtcXHNcXFNdKj8pYGBgL2c7XG4gICAgICAgIC8vIEFsc28gbG9vayBmb3IgZmlsZSBoZWFkZXJzIGxpa2UgXCJDcmVhdGUgZmlsZS5qczpcIiBvciBcIlVwZGF0ZSBwYWNrYWdlLmpzb246XCJcbiAgICAgICAgY29uc3QgZmlsZUhlYWRlclJlZ2V4ID0gLyhjcmVhdGV8dXBkYXRlfG1vZGlmeXxhZGQpXFxzKyhbXlxcczpdK1xcLlthLXpBLVpdKyk6P1xccypcXG5gYGAoXFx3Kyk/XFxuKFtcXHNcXFNdKj8pYGBgL2dpO1xuICAgICAgICBsZXQgbWF0Y2g7XG4gICAgICAgIC8vIEZpcnN0IHBhc3M6IEV4dHJhY3QgYmxvY2tzIHdpdGggZmlsZSBoZWFkZXJzXG4gICAgICAgIHdoaWxlICgobWF0Y2ggPSBmaWxlSGVhZGVyUmVnZXguZXhlYyh0ZXh0KSkgIT09IG51bGwpIHtcbiAgICAgICAgICAgIGNvbnN0IFssIGFjdGlvbiwgZmlsZW5hbWUsIGxhbmd1YWdlLCBjb250ZW50XSA9IG1hdGNoO1xuICAgICAgICAgICAgaWYgKGNvbnRlbnQgJiYgY29udGVudC50cmltKCkubGVuZ3RoID4gMTApIHtcbiAgICAgICAgICAgICAgICBjb2RlQmxvY2tzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICBjb250ZW50OiBjb250ZW50LnRyaW0oKSxcbiAgICAgICAgICAgICAgICAgICAgbGFuZ3VhZ2U6IGxhbmd1YWdlPy50b0xvd2VyQ2FzZSgpIHx8IHRoaXMuZGV0ZWN0TGFuZ3VhZ2VGcm9tRmlsZW5hbWUoZmlsZW5hbWUpLFxuICAgICAgICAgICAgICAgICAgICBmaWxlbmFtZTogZmlsZW5hbWUsXG4gICAgICAgICAgICAgICAgICAgIHByb3ZpZGVyOiB0aGlzLnByb3ZpZGVyLFxuICAgICAgICAgICAgICAgICAgICB0aW1lc3RhbXA6IERhdGUubm93KCksXG4gICAgICAgICAgICAgICAgICAgIGFjdGlvbkhpbnQ6IGFjdGlvbi50b0xvd2VyQ2FzZSgpIC8vIEFkZCBhY3Rpb24gaGludCBmb3IgYmV0dGVyIGFuYWx5c2lzXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gU2Vjb25kIHBhc3M6IFJlZ3VsYXIgY29kZSBibG9ja3NcbiAgICAgICAgd2hpbGUgKChtYXRjaCA9IGNvZGVCbG9ja1JlZ2V4LmV4ZWModGV4dCkpICE9PSBudWxsKSB7XG4gICAgICAgICAgICBjb25zdCBbLCBsYW5ndWFnZSwgY29tbWVudCwgY29udGVudF0gPSBtYXRjaDtcbiAgICAgICAgICAgIGlmIChjb250ZW50ICYmIGNvbnRlbnQudHJpbSgpLmxlbmd0aCA+IDEwKSB7XG4gICAgICAgICAgICAgICAgLy8gU2tpcCBpZiBhbHJlYWR5IGNhcHR1cmVkIGJ5IGZpbGUgaGVhZGVyIHJlZ2V4XG4gICAgICAgICAgICAgICAgY29uc3QgaXNEdXBsaWNhdGUgPSBjb2RlQmxvY2tzLnNvbWUoYmxvY2sgPT4gYmxvY2suY29udGVudCA9PT0gY29udGVudC50cmltKCkpO1xuICAgICAgICAgICAgICAgIGlmICghaXNEdXBsaWNhdGUpIHtcbiAgICAgICAgICAgICAgICAgICAgY29kZUJsb2Nrcy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRlbnQ6IGNvbnRlbnQudHJpbSgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgbGFuZ3VhZ2U6IGxhbmd1YWdlPy50b0xvd2VyQ2FzZSgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgZmlsZW5hbWU6IGNvbW1lbnQgPyB0aGlzLmV4dHJhY3RGaWxlbmFtZUZyb21Db21tZW50KGNvbW1lbnQpIDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvdmlkZXI6IHRoaXMucHJvdmlkZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aW1lc3RhbXA6IERhdGUubm93KClcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjb2RlQmxvY2tzO1xuICAgIH1cbiAgICBkZXRlY3RMYW5ndWFnZUZyb21GaWxlbmFtZShmaWxlbmFtZSkge1xuICAgICAgICBjb25zdCBleHQgPSBmaWxlbmFtZS5zcGxpdCgnLicpLnBvcCgpPy50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBjb25zdCBsYW5nTWFwID0ge1xuICAgICAgICAgICAgJ2pzJzogJ2phdmFzY3JpcHQnLFxuICAgICAgICAgICAgJ3RzJzogJ3R5cGVzY3JpcHQnLFxuICAgICAgICAgICAgJ3B5JzogJ3B5dGhvbicsXG4gICAgICAgICAgICAnamF2YSc6ICdqYXZhJyxcbiAgICAgICAgICAgICdjcHAnOiAnY3BwJyxcbiAgICAgICAgICAgICdjJzogJ2MnLFxuICAgICAgICAgICAgJ2dvJzogJ2dvJyxcbiAgICAgICAgICAgICdycyc6ICdydXN0JyxcbiAgICAgICAgICAgICdwaHAnOiAncGhwJyxcbiAgICAgICAgICAgICdyYic6ICdydWJ5JyxcbiAgICAgICAgICAgICdzd2lmdCc6ICdzd2lmdCcsXG4gICAgICAgICAgICAna3QnOiAna290bGluJyxcbiAgICAgICAgICAgICdqc29uJzogJ2pzb24nLFxuICAgICAgICAgICAgJ3lhbWwnOiAneWFtbCcsXG4gICAgICAgICAgICAneW1sJzogJ3lhbWwnXG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBleHQgPyBsYW5nTWFwW2V4dF0gOiB1bmRlZmluZWQ7XG4gICAgfVxuICAgIGRldGVjdExhbmd1YWdlRnJvbUFydGlmYWN0KGNvbnRhaW5lcikge1xuICAgICAgICAvLyBMb29rIGZvciBsYW5ndWFnZSBpbmRpY2F0b3JzIGluIGFydGlmYWN0IGRhdGEgYXR0cmlidXRlc1xuICAgICAgICBjb25zdCBsYW5nQXR0ciA9IGNvbnRhaW5lci5nZXRBdHRyaWJ1dGUoJ2RhdGEtbGFuZ3VhZ2UnKTtcbiAgICAgICAgaWYgKGxhbmdBdHRyKVxuICAgICAgICAgICAgcmV0dXJuIGxhbmdBdHRyO1xuICAgICAgICAvLyBMb29rIGZvciBsYW5ndWFnZSBpbiB0aXRsZSBvciBvdGhlciBhdHRyaWJ1dGVzXG4gICAgICAgIGNvbnN0IHRpdGxlID0gY29udGFpbmVyLmdldEF0dHJpYnV0ZSgnZGF0YS10aXRsZScpIHx8IGNvbnRhaW5lci5nZXRBdHRyaWJ1dGUoJ3RpdGxlJyk7XG4gICAgICAgIGlmICh0aXRsZSkge1xuICAgICAgICAgICAgY29uc3QgbGFuZ01hdGNoID0gdGl0bGUubWF0Y2goL1xcLih0c3xqc3xweXxqYXZhfGNwcHxnb3xyc3xwaHB8cmJ8c3dpZnR8a3QpJC9pKTtcbiAgICAgICAgICAgIGlmIChsYW5nTWF0Y2gpXG4gICAgICAgICAgICAgICAgcmV0dXJuIGxhbmdNYXRjaFsxXS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuICAgIGRldGVjdExhbmd1YWdlRnJvbUNsYXNzKGVsZW1lbnQpIHtcbiAgICAgICAgY29uc3QgY2xhc3NOYW1lID0gZWxlbWVudC5jbGFzc05hbWU7XG4gICAgICAgIGNvbnN0IGxhbmdNYXRjaCA9IGNsYXNzTmFtZS5tYXRjaCgvbGFuZ3VhZ2UtKFxcdyspLyk7XG4gICAgICAgIHJldHVybiBsYW5nTWF0Y2ggPyBsYW5nTWF0Y2hbMV0gOiB1bmRlZmluZWQ7XG4gICAgfVxuICAgIGV4dHJhY3RGaWxlbmFtZUZyb21BcnRpZmFjdChjb250YWluZXIpIHtcbiAgICAgICAgY29uc3QgdGl0bGUgPSBjb250YWluZXIuZ2V0QXR0cmlidXRlKCdkYXRhLXRpdGxlJykgfHwgY29udGFpbmVyLmdldEF0dHJpYnV0ZSgndGl0bGUnKTtcbiAgICAgICAgaWYgKHRpdGxlKSB7XG4gICAgICAgICAgICBjb25zdCBmaWxlbmFtZU1hdGNoID0gdGl0bGUubWF0Y2goLyhbXlxcL1xcc10rXFwuW2EtekEtWl0rKS8pO1xuICAgICAgICAgICAgaWYgKGZpbGVuYW1lTWF0Y2gpXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZpbGVuYW1lTWF0Y2hbMV07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG4gICAgZXh0cmFjdEZpbGVuYW1lRnJvbUNvbW1lbnQoY29tbWVudCkge1xuICAgICAgICBjb25zdCBmaWxlbmFtZU1hdGNoID0gY29tbWVudC5tYXRjaCgvKFteXFwvXFxzXStcXC5bYS16QS1aXSspLyk7XG4gICAgICAgIHJldHVybiBmaWxlbmFtZU1hdGNoID8gZmlsZW5hbWVNYXRjaFsxXSA6IHVuZGVmaW5lZDtcbiAgICB9XG4gICAgZGVkdXBsaWNhdGVDb2RlKGNvZGVCbG9ja3MpIHtcbiAgICAgICAgY29uc3Qgc2VlbiA9IG5ldyBTZXQoKTtcbiAgICAgICAgcmV0dXJuIGNvZGVCbG9ja3MuZmlsdGVyKGJsb2NrID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGtleSA9IGAke2Jsb2NrLmNvbnRlbnQuc3Vic3RyaW5nKDAsIDEwMCl9XyR7YmxvY2subGFuZ3VhZ2V9XyR7YmxvY2suZmlsZW5hbWV9YDtcbiAgICAgICAgICAgIGlmIChzZWVuLmhhcyhrZXkpKVxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIHNlZW4uYWRkKGtleSk7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGFzeW5jIHNlbmRDb2RlVG9CYWNrZ3JvdW5kKGV4dHJhY3RlZENvZGUsIGZ1bGxSZXNwb25zZSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ1NlbmRpbmcgY29kZSB0byBiYWNrZ3JvdW5kIHNjcmlwdC4uLicpO1xuICAgICAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBjaHJvbWUucnVudGltZS5zZW5kTWVzc2FnZSh7XG4gICAgICAgICAgICAgICAgdHlwZTogJ0NPREVfRVhUUkFDVEVEJyxcbiAgICAgICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgIGV4dHJhY3RlZENvZGUsXG4gICAgICAgICAgICAgICAgICAgIGZ1bGxSZXNwb25zZSxcbiAgICAgICAgICAgICAgICAgICAgcHJvdmlkZXI6IHRoaXMucHJvdmlkZXIsXG4gICAgICAgICAgICAgICAgICAgIHVybDogd2luZG93LmxvY2F0aW9uLmhyZWYsXG4gICAgICAgICAgICAgICAgICAgIHRpbWVzdGFtcDogRGF0ZS5ub3coKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ0JhY2tncm91bmQgc2NyaXB0IHJlc3BvbnNlOicsIHJlc3BvbnNlKTtcbiAgICAgICAgICAgIGlmIChyZXNwb25zZSAmJiByZXNwb25zZS5zdWNjZXNzKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ0NvZGUgc2VudCB0byBiYWNrZ3JvdW5kIHNjcmlwdCBzdWNjZXNzZnVsbHknKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0JhY2tncm91bmQgc2NyaXB0IHJldHVybmVkIGVycm9yOicsIHJlc3BvbnNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBzZW5kIGNvZGUgdG8gYmFja2dyb3VuZDonLCBlcnJvcik7XG4gICAgICAgIH1cbiAgICB9XG4gICAgc2hvd0V4dHJhY3Rpb25Ob3RpZmljYXRpb24oY29kZUJsb2NrQ291bnQpIHtcbiAgICAgICAgY29uc3Qgbm90aWZpY2F0aW9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgIG5vdGlmaWNhdGlvbi5pbm5lckhUTUwgPSBg8J+UjSBFeHRyYWN0ZWQgJHtjb2RlQmxvY2tDb3VudH0gY29kZSBibG9jayR7Y29kZUJsb2NrQ291bnQgPiAxID8gJ3MnIDogJyd9YDtcbiAgICAgICAgbm90aWZpY2F0aW9uLnN0eWxlLmNzc1RleHQgPSBgXG4gICAgICBwb3NpdGlvbjogZml4ZWQ7XG4gICAgICB0b3A6IDgwcHg7XG4gICAgICByaWdodDogMjBweDtcbiAgICAgIGJhY2tncm91bmQ6IGxpbmVhci1ncmFkaWVudCgxMzVkZWcsICMxMGI5ODEgMCUsICMwNTk2NjkgMTAwJSk7XG4gICAgICBjb2xvcjogd2hpdGU7XG4gICAgICBwYWRkaW5nOiAxMnB4IDE2cHg7XG4gICAgICBib3JkZXItcmFkaXVzOiA4cHg7XG4gICAgICBmb250LXNpemU6IDE0cHg7XG4gICAgICB6LWluZGV4OiAxMDAwMTtcbiAgICAgIGZvbnQtZmFtaWx5OiBzeXN0ZW0tdWk7XG4gICAgICBib3gtc2hhZG93OiAwIDRweCA2cHggcmdiYSgwLCAwLCAwLCAwLjEpO1xuICAgICAgYW5pbWF0aW9uOiBzbGlkZUluUmlnaHQgMC4zcyBlYXNlLW91dDtcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICBgO1xuICAgICAgICAvLyBBZGQgY2xpY2sgaGFuZGxlciB0byBzaG93IGV4dHJhY3RlZCBjb2RlXG4gICAgICAgIG5vdGlmaWNhdGlvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuc2hvd0V4dHJhY3RlZENvZGVQcmV2aWV3KCk7XG4gICAgICAgICAgICBub3RpZmljYXRpb24ucmVtb3ZlKCk7XG4gICAgICAgIH0pO1xuICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKG5vdGlmaWNhdGlvbik7XG4gICAgICAgIC8vIEF1dG8tcmVtb3ZlIGFmdGVyIDQgc2Vjb25kc1xuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIG5vdGlmaWNhdGlvbi5zdHlsZS5hbmltYXRpb24gPSAnc2xpZGVJblJpZ2h0IDAuM3MgZWFzZS1vdXQgcmV2ZXJzZSc7XG4gICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IG5vdGlmaWNhdGlvbi5yZW1vdmUoKSwgMzAwKTtcbiAgICAgICAgfSwgNDAwMCk7XG4gICAgfVxuICAgIHNob3dFeHRyYWN0ZWRDb2RlUHJldmlldygpIHtcbiAgICAgICAgLy8gVGhpcyB3aWxsIGJlIGltcGxlbWVudGVkIHRvIHNob3cgYSBwcmV2aWV3IG9mIGV4dHJhY3RlZCBjb2RlXG4gICAgICAgIGNvbnNvbGUubG9nKCdDb2RlIHByZXZpZXcgd2lsbCBiZSBzaG93biBoZXJlJyk7XG4gICAgfVxuICAgIC8vIFB1YmxpYyBtZXRob2QgdG8gbWFudWFsbHkgdHJpZ2dlciBleHRyYWN0aW9uXG4gICAgbWFudWFsRXh0cmFjdCgpIHtcbiAgICAgICAgdGhpcy5leHRyYWN0TGF0ZXN0UmVzcG9uc2UoKTtcbiAgICB9XG4gICAgLy8gUHVibGljIG1ldGhvZCB0byBnZXQgY3VycmVudCBwcm92aWRlclxuICAgIGdldFByb3ZpZGVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5wcm92aWRlcjtcbiAgICB9XG59XG4vLyBJbml0aWFsaXplIHRoZSByZXNwb25zZSBleHRyYWN0b3JcbmNvbnN0IHJlc3BvbnNlRXh0cmFjdG9yID0gbmV3IFJlc3BvbnNlRXh0cmFjdG9yKCk7XG4vLyBBZGQgdG8gZ2xvYmFsIHNjb3BlIGZvciBtYW51YWwgdHJpZ2dlcmluZ1xud2luZG93LnJlc3BvbnNlRXh0cmFjdG9yID0gcmVzcG9uc2VFeHRyYWN0b3I7XG4iLCIvLyBUaGUgbW9kdWxlIGNhY2hlXG52YXIgX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fID0ge307XG5cbi8vIFRoZSByZXF1aXJlIGZ1bmN0aW9uXG5mdW5jdGlvbiBfX3dlYnBhY2tfcmVxdWlyZV9fKG1vZHVsZUlkKSB7XG5cdC8vIENoZWNrIGlmIG1vZHVsZSBpcyBpbiBjYWNoZVxuXHR2YXIgY2FjaGVkTW9kdWxlID0gX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fW21vZHVsZUlkXTtcblx0aWYgKGNhY2hlZE1vZHVsZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0cmV0dXJuIGNhY2hlZE1vZHVsZS5leHBvcnRzO1xuXHR9XG5cdC8vIENyZWF0ZSBhIG5ldyBtb2R1bGUgKGFuZCBwdXQgaXQgaW50byB0aGUgY2FjaGUpXG5cdHZhciBtb2R1bGUgPSBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX19bbW9kdWxlSWRdID0ge1xuXHRcdC8vIG5vIG1vZHVsZS5pZCBuZWVkZWRcblx0XHQvLyBubyBtb2R1bGUubG9hZGVkIG5lZWRlZFxuXHRcdGV4cG9ydHM6IHt9XG5cdH07XG5cblx0Ly8gRXhlY3V0ZSB0aGUgbW9kdWxlIGZ1bmN0aW9uXG5cdF9fd2VicGFja19tb2R1bGVzX19bbW9kdWxlSWRdKG1vZHVsZSwgbW9kdWxlLmV4cG9ydHMsIF9fd2VicGFja19yZXF1aXJlX18pO1xuXG5cdC8vIFJldHVybiB0aGUgZXhwb3J0cyBvZiB0aGUgbW9kdWxlXG5cdHJldHVybiBtb2R1bGUuZXhwb3J0cztcbn1cblxuIiwiLy8gZ2V0RGVmYXVsdEV4cG9ydCBmdW5jdGlvbiBmb3IgY29tcGF0aWJpbGl0eSB3aXRoIG5vbi1oYXJtb255IG1vZHVsZXNcbl9fd2VicGFja19yZXF1aXJlX18ubiA9IChtb2R1bGUpID0+IHtcblx0dmFyIGdldHRlciA9IG1vZHVsZSAmJiBtb2R1bGUuX19lc01vZHVsZSA/XG5cdFx0KCkgPT4gKG1vZHVsZVsnZGVmYXVsdCddKSA6XG5cdFx0KCkgPT4gKG1vZHVsZSk7XG5cdF9fd2VicGFja19yZXF1aXJlX18uZChnZXR0ZXIsIHsgYTogZ2V0dGVyIH0pO1xuXHRyZXR1cm4gZ2V0dGVyO1xufTsiLCIvLyBkZWZpbmUgZ2V0dGVyIGZ1bmN0aW9ucyBmb3IgaGFybW9ueSBleHBvcnRzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLmQgPSAoZXhwb3J0cywgZGVmaW5pdGlvbikgPT4ge1xuXHRmb3IodmFyIGtleSBpbiBkZWZpbml0aW9uKSB7XG5cdFx0aWYoX193ZWJwYWNrX3JlcXVpcmVfXy5vKGRlZmluaXRpb24sIGtleSkgJiYgIV9fd2VicGFja19yZXF1aXJlX18ubyhleHBvcnRzLCBrZXkpKSB7XG5cdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywga2V5LCB7IGVudW1lcmFibGU6IHRydWUsIGdldDogZGVmaW5pdGlvbltrZXldIH0pO1xuXHRcdH1cblx0fVxufTsiLCJfX3dlYnBhY2tfcmVxdWlyZV9fLm8gPSAob2JqLCBwcm9wKSA9PiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwgcHJvcCkpIiwiLy8gZGVmaW5lIF9fZXNNb2R1bGUgb24gZXhwb3J0c1xuX193ZWJwYWNrX3JlcXVpcmVfXy5yID0gKGV4cG9ydHMpID0+IHtcblx0aWYodHlwZW9mIFN5bWJvbCAhPT0gJ3VuZGVmaW5lZCcgJiYgU3ltYm9sLnRvU3RyaW5nVGFnKSB7XG5cdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFN5bWJvbC50b1N0cmluZ1RhZywgeyB2YWx1ZTogJ01vZHVsZScgfSk7XG5cdH1cblx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsICdfX2VzTW9kdWxlJywgeyB2YWx1ZTogdHJ1ZSB9KTtcbn07IiwiLy8gQ29udGVudCBzY3JpcHQgZm9yIExMTSBwcm92aWRlciB3ZWJzaXRlc1xuY29uc29sZS5sb2coJ0FJIENvZGluZyBBc3Npc3RhbnQgY29udGVudCBzY3JpcHQgbG9hZGVkIG9uOicsIHdpbmRvdy5sb2NhdGlvbi5ob3N0bmFtZSk7XG4vLyBJbXBvcnQgcmVzcG9uc2UgZXh0cmFjdG9yXG5pbXBvcnQgJy4vcmVzcG9uc2VFeHRyYWN0b3InO1xuLy8gRGV0ZWN0IHdoaWNoIExMTSBwcm92aWRlciB3ZSdyZSBvblxuY29uc3QgZGV0ZWN0UHJvdmlkZXIgPSAoKSA9PiB7XG4gICAgY29uc3QgaG9zdG5hbWUgPSB3aW5kb3cubG9jYXRpb24uaG9zdG5hbWU7XG4gICAgaWYgKGhvc3RuYW1lLmluY2x1ZGVzKCdjaGF0Z3B0LmNvbScpKVxuICAgICAgICByZXR1cm4gJ2NoYXRncHQnO1xuICAgIGlmIChob3N0bmFtZS5pbmNsdWRlcygnY2xhdWRlLmFpJykpXG4gICAgICAgIHJldHVybiAnY2xhdWRlJztcbiAgICBpZiAoaG9zdG5hbWUuaW5jbHVkZXMoJ2dlbWluaS5nb29nbGUuY29tJykpXG4gICAgICAgIHJldHVybiAnZ2VtaW5pJztcbiAgICBpZiAoaG9zdG5hbWUuaW5jbHVkZXMoJ3BlcnBsZXhpdHkuYWknKSlcbiAgICAgICAgcmV0dXJuICdwZXJwbGV4aXR5JztcbiAgICBpZiAoaG9zdG5hbWUuaW5jbHVkZXMoJ2NoYXQubWlzdHJhbC5haScpKVxuICAgICAgICByZXR1cm4gJ21pc3RyYWwnO1xuICAgIGlmIChob3N0bmFtZS5pbmNsdWRlcygnaHVnZ2luZ2ZhY2UuY28nKSlcbiAgICAgICAgcmV0dXJuICdodWdnaW5nZmFjZSc7XG4gICAgcmV0dXJuICd1bmtub3duJztcbn07XG5jb25zdCBwcm92aWRlciA9IGRldGVjdFByb3ZpZGVyKCk7XG5jb25zb2xlLmxvZygnRGV0ZWN0ZWQgcHJvdmlkZXI6JywgcHJvdmlkZXIpO1xuLy8gRW5oYW5jZWQgcHJvdmlkZXItc3BlY2lmaWMgc2VsZWN0b3JzIGFuZCBsb2dpY1xuY29uc3QgcHJvdmlkZXJDb25maWcgPSB7XG4gICAgY2hhdGdwdDoge1xuICAgICAgICBpbnB1dFNlbGVjdG9yOiBbXG4gICAgICAgICAgICAnI3Byb21wdC10ZXh0YXJlYScsXG4gICAgICAgICAgICAndGV4dGFyZWFbZGF0YS1pZD1cInJvb3RcIl0nLFxuICAgICAgICAgICAgJ3RleHRhcmVhW3BsYWNlaG9sZGVyKj1cIm1lc3NhZ2VcIl0nLFxuICAgICAgICAgICAgJy5Qcm9zZU1pcnJvcidcbiAgICAgICAgXSxcbiAgICAgICAgc2VuZEJ1dHRvblNlbGVjdG9yOiBbXG4gICAgICAgICAgICAnYnV0dG9uW2RhdGEtdGVzdGlkPVwic2VuZC1idXR0b25cIl0nLFxuICAgICAgICAgICAgJ2J1dHRvblthcmlhLWxhYmVsPVwiU2VuZCBtZXNzYWdlXCJdJyxcbiAgICAgICAgICAgICdidXR0b246aGFzKHN2Z1tkYXRhLXRlc3RpZD1cInNlbmQtaWNvblwiXSknXG4gICAgICAgIF0sXG4gICAgICAgIG1lc3NhZ2VTZWxlY3RvcjogJ1tkYXRhLW1lc3NhZ2UtYXV0aG9yLXJvbGU9XCJhc3Npc3RhbnRcIl0nLFxuICAgICAgICB3YWl0Rm9yRWxlbWVudDogdHJ1ZSxcbiAgICB9LFxuICAgIGNsYXVkZToge1xuICAgICAgICBpbnB1dFNlbGVjdG9yOiBbXG4gICAgICAgICAgICAnZGl2W2NvbnRlbnRlZGl0YWJsZT1cInRydWVcIl0nLFxuICAgICAgICAgICAgJy5Qcm9zZU1pcnJvcicsXG4gICAgICAgICAgICAndGV4dGFyZWEnXG4gICAgICAgIF0sXG4gICAgICAgIHNlbmRCdXR0b25TZWxlY3RvcjogW1xuICAgICAgICAgICAgJ2J1dHRvblthcmlhLWxhYmVsPVwiU2VuZCBNZXNzYWdlXCJdJyxcbiAgICAgICAgICAgICdidXR0b246aGFzKHN2Z1t2aWV3Qm94PVwiMCAwIDI0IDI0XCJdKScsXG4gICAgICAgICAgICAnYnV0dG9uW3R5cGU9XCJzdWJtaXRcIl0nXG4gICAgICAgIF0sXG4gICAgICAgIG1lc3NhZ2VTZWxlY3RvcjogJy5tZXNzYWdlLWNvbnRlbnQnLFxuICAgICAgICB3YWl0Rm9yRWxlbWVudDogdHJ1ZSxcbiAgICB9LFxuICAgIGdlbWluaToge1xuICAgICAgICBpbnB1dFNlbGVjdG9yOiBbXG4gICAgICAgICAgICAncmljaC10ZXh0YXJlYScsXG4gICAgICAgICAgICAndGV4dGFyZWEnLFxuICAgICAgICAgICAgJy5xbC1lZGl0b3InXG4gICAgICAgIF0sXG4gICAgICAgIHNlbmRCdXR0b25TZWxlY3RvcjogW1xuICAgICAgICAgICAgJ2J1dHRvblthcmlhLWxhYmVsPVwiU2VuZCBtZXNzYWdlXCJdJyxcbiAgICAgICAgICAgICdidXR0b246aGFzKHN2ZyknLFxuICAgICAgICAgICAgJ2J1dHRvblt0eXBlPVwic3VibWl0XCJdJ1xuICAgICAgICBdLFxuICAgICAgICBtZXNzYWdlU2VsZWN0b3I6ICcubW9kZWwtcmVzcG9uc2UtdGV4dCcsXG4gICAgICAgIHdhaXRGb3JFbGVtZW50OiB0cnVlLFxuICAgIH0sXG4gICAgbWlzdHJhbDoge1xuICAgICAgICBpbnB1dFNlbGVjdG9yOiBbXG4gICAgICAgICAgICAndGV4dGFyZWEnLFxuICAgICAgICAgICAgJy5Qcm9zZU1pcnJvcicsXG4gICAgICAgICAgICAnZGl2W2NvbnRlbnRlZGl0YWJsZT1cInRydWVcIl0nXG4gICAgICAgIF0sXG4gICAgICAgIHNlbmRCdXR0b25TZWxlY3RvcjogW1xuICAgICAgICAgICAgJ2J1dHRvblt0eXBlPVwic3VibWl0XCJdJyxcbiAgICAgICAgICAgICdidXR0b246aGFzKHN2ZyknLFxuICAgICAgICAgICAgJ2J1dHRvblthcmlhLWxhYmVsKj1cInNlbmRcIl0nXG4gICAgICAgIF0sXG4gICAgICAgIG1lc3NhZ2VTZWxlY3RvcjogJy5tZXNzYWdlJyxcbiAgICAgICAgd2FpdEZvckVsZW1lbnQ6IHRydWUsXG4gICAgfSxcbiAgICBodWdnaW5nZmFjZToge1xuICAgICAgICBpbnB1dFNlbGVjdG9yOiBbXG4gICAgICAgICAgICAndGV4dGFyZWEnLFxuICAgICAgICAgICAgJ2lucHV0W3R5cGU9XCJ0ZXh0XCJdJyxcbiAgICAgICAgICAgICcuUHJvc2VNaXJyb3InXG4gICAgICAgIF0sXG4gICAgICAgIHNlbmRCdXR0b25TZWxlY3RvcjogW1xuICAgICAgICAgICAgJ2J1dHRvblt0eXBlPVwic3VibWl0XCJdJyxcbiAgICAgICAgICAgICdidXR0b246aGFzKHN2ZyknLFxuICAgICAgICAgICAgJ2J1dHRvblthcmlhLWxhYmVsKj1cInNlbmRcIl0nXG4gICAgICAgIF0sXG4gICAgICAgIG1lc3NhZ2VTZWxlY3RvcjogJy5tZXNzYWdlJyxcbiAgICAgICAgd2FpdEZvckVsZW1lbnQ6IHRydWUsXG4gICAgfSxcbiAgICBwZXJwbGV4aXR5OiB7XG4gICAgICAgIGlucHV0U2VsZWN0b3I6IFtcbiAgICAgICAgICAgICd0ZXh0YXJlYVtwbGFjZWhvbGRlcio9XCJBc2tcIl0nLFxuICAgICAgICAgICAgJ3RleHRhcmVhJyxcbiAgICAgICAgICAgICcuUHJvc2VNaXJyb3InXG4gICAgICAgIF0sXG4gICAgICAgIHNlbmRCdXR0b25TZWxlY3RvcjogW1xuICAgICAgICAgICAgJ2J1dHRvblthcmlhLWxhYmVsKj1cIlN1Ym1pdFwiXScsXG4gICAgICAgICAgICAnYnV0dG9uOmhhcyhzdmcpJyxcbiAgICAgICAgICAgICdidXR0b25bdHlwZT1cInN1Ym1pdFwiXSdcbiAgICAgICAgXSxcbiAgICAgICAgbWVzc2FnZVNlbGVjdG9yOiAnLm1lc3NhZ2UtY29udGVudCcsXG4gICAgICAgIHdhaXRGb3JFbGVtZW50OiB0cnVlLFxuICAgIH0sXG59O1xuLy8gSW5pdGlhbGl6ZSBwcm92aWRlci1zcGVjaWZpYyBmdW5jdGlvbmFsaXR5XG5pZiAocHJvdmlkZXIgIT09ICd1bmtub3duJykge1xuICAgIGluaXRpYWxpemVQcm92aWRlcihwcm92aWRlcik7XG59XG5mdW5jdGlvbiBpbml0aWFsaXplUHJvdmlkZXIocHJvdmlkZXJUeXBlKSB7XG4gICAgY29uc29sZS5sb2coYEluaXRpYWxpemluZyAke3Byb3ZpZGVyVHlwZX0gaW50ZWdyYXRpb25gKTtcbiAgICAvLyBBZGQgdmlzdWFsIGluZGljYXRvcnNcbiAgICBhZGRFeHRlbnNpb25JbmRpY2F0b3IoKTtcbiAgICAvLyBTZXQgdXAgRE9NIG9ic2VydmVyc1xuICAgIHNldHVwRE9NT2JzZXJ2ZXJzKCk7XG4gICAgLy8gQWRkIGtleWJvYXJkIHNob3J0Y3V0c1xuICAgIHNldHVwS2V5Ym9hcmRTaG9ydGN1dHMoKTtcbiAgICAvLyBTZXQgdXAgbWVzc2FnZSBsaXN0ZW5lciBmb3IgcHJvbXB0IGluamVjdGlvblxuICAgIHNldHVwTWVzc2FnZUxpc3RlbmVyKCk7XG59XG5mdW5jdGlvbiBhZGRFeHRlbnNpb25JbmRpY2F0b3IoKSB7XG4gICAgY29uc3QgaW5kaWNhdG9yID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgaW5kaWNhdG9yLmlkID0gJ2FpLWFzc2lzdGFudC1pbmRpY2F0b3InO1xuICAgIGluZGljYXRvci5pbm5lckhUTUwgPSAn8J+kliBBSSBBc3Npc3RhbnQgRW5oYW5jZWQnO1xuICAgIGluZGljYXRvci5zdHlsZS5jc3NUZXh0ID0gYFxuICAgIHBvc2l0aW9uOiBmaXhlZDtcbiAgICB0b3A6IDEwcHg7XG4gICAgcmlnaHQ6IDEwcHg7XG4gICAgYmFja2dyb3VuZDogbGluZWFyLWdyYWRpZW50KDEzNWRlZywgIzY2N2VlYSAwJSwgIzc2NGJhMiAxMDAlKTtcbiAgICBjb2xvcjogd2hpdGU7XG4gICAgcGFkZGluZzogOHB4IDEycHg7XG4gICAgYm9yZGVyLXJhZGl1czogOHB4O1xuICAgIGZvbnQtc2l6ZTogMTJweDtcbiAgICB6LWluZGV4OiAxMDAwMDtcbiAgICBmb250LWZhbWlseTogc3lzdGVtLXVpO1xuICAgIGJveC1zaGFkb3c6IDAgNHB4IDZweCByZ2JhKDAsIDAsIDAsIDAuMSk7XG4gICAgdHJhbnNpdGlvbjogb3BhY2l0eSAwLjNzIGVhc2U7XG4gIGA7XG4gICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChpbmRpY2F0b3IpO1xuICAgIC8vIEF1dG8tZmFkZSBhZnRlciAzIHNlY29uZHNcbiAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgaW5kaWNhdG9yLnN0eWxlLm9wYWNpdHkgPSAnMC43JztcbiAgICB9LCAzMDAwKTtcbiAgICAvLyBSZW1vdmUgYWZ0ZXIgMTAgc2Vjb25kc1xuICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICBpbmRpY2F0b3IucmVtb3ZlKCk7XG4gICAgfSwgMTAwMDApO1xufVxuZnVuY3Rpb24gc2V0dXBET01PYnNlcnZlcnMoKSB7XG4gICAgLy8gV2F0Y2ggZm9yIG5ldyBtZXNzYWdlcyBhbmQgVUkgY2hhbmdlc1xuICAgIGNvbnN0IG9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoKG11dGF0aW9ucykgPT4ge1xuICAgICAgICBtdXRhdGlvbnMuZm9yRWFjaCgobXV0YXRpb24pID0+IHtcbiAgICAgICAgICAgIGlmIChtdXRhdGlvbi50eXBlID09PSAnY2hpbGRMaXN0Jykge1xuICAgICAgICAgICAgICAgIC8vIEhhbmRsZSBuZXcgbWVzc2FnZXMgb3IgVUkgY2hhbmdlc1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdET00gY2hhbmdlZCwgY2hlY2tpbmcgZm9yIG5ldyBjb250ZW50Jyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH0pO1xuICAgIG9ic2VydmVyLm9ic2VydmUoZG9jdW1lbnQuYm9keSwge1xuICAgICAgICBjaGlsZExpc3Q6IHRydWUsXG4gICAgICAgIHN1YnRyZWU6IHRydWUsXG4gICAgfSk7XG59XG5mdW5jdGlvbiBzZXR1cEtleWJvYXJkU2hvcnRjdXRzKCkge1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCAoZSkgPT4ge1xuICAgICAgICAvLyBDdHJsK1NoaWZ0K0sgZm9yIGluc2VydGluZyBjb250ZXh0IChub3cgaGFuZGxlZCBieSBiYWNrZ3JvdW5kIHNjcmlwdClcbiAgICAgICAgaWYgKGUuY3RybEtleSAmJiBlLnNoaWZ0S2V5ICYmIGUua2V5ID09PSAnSycpIHtcbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdDdHJsK1NoaWZ0K0sgcHJlc3NlZCAtIGJhY2tncm91bmQgc2NyaXB0IHdpbGwgaGFuZGxlIGNvbnRleHQgaW5zZXJ0aW9uJyk7XG4gICAgICAgIH1cbiAgICB9KTtcbn1cbmZ1bmN0aW9uIHNldHVwTWVzc2FnZUxpc3RlbmVyKCkge1xuICAgIC8vIExpc3RlbiBmb3IgbWVzc2FnZXMgZnJvbSBiYWNrZ3JvdW5kIHNjcmlwdFxuICAgIGNocm9tZS5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcigobWVzc2FnZSwgc2VuZGVyLCBzZW5kUmVzcG9uc2UpID0+IHtcbiAgICAgICAgY29uc29sZS5sb2coJ0NvbnRlbnQgc2NyaXB0IHJlY2VpdmVkIG1lc3NhZ2U6JywgbWVzc2FnZSk7XG4gICAgICAgIHN3aXRjaCAobWVzc2FnZS50eXBlKSB7XG4gICAgICAgICAgICBjYXNlICdJTkpFQ1RfRk9STUFUVEVEX1BST01QVCc6XG4gICAgICAgICAgICAgICAgaGFuZGxlSW5qZWN0Rm9ybWF0dGVkUHJvbXB0KG1lc3NhZ2UsIHNlbmRSZXNwb25zZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7IC8vIEtlZXAgY2hhbm5lbCBvcGVuIGZvciBhc3luYyByZXNwb25zZVxuICAgICAgICAgICAgY2FzZSAnR0VUX1NFTEVDVEVEX1RFWFQnOlxuICAgICAgICAgICAgICAgIGNvbnN0IHNlbGVjdGVkVGV4dCA9IHdpbmRvdy5nZXRTZWxlY3Rpb24oKT8udG9TdHJpbmcoKSB8fCAnJztcbiAgICAgICAgICAgICAgICBzZW5kUmVzcG9uc2UoeyBzZWxlY3RlZFRleHQgfSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlICdHRVRfQ1VSUkVOVF9JTlBVVCc6XG4gICAgICAgICAgICAgICAgY29uc3QgY3VycmVudFRleHQgPSBnZXRDdXJyZW50SW5wdXRUZXh0KCk7XG4gICAgICAgICAgICAgICAgc2VuZFJlc3BvbnNlKHsgdGV4dDogY3VycmVudFRleHQgfSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIHNlbmRSZXNwb25zZSh7IGVycm9yOiAnVW5rbm93biBtZXNzYWdlIHR5cGUnIH0pO1xuICAgICAgICB9XG4gICAgfSk7XG59XG5hc3luYyBmdW5jdGlvbiBoYW5kbGVJbmplY3RGb3JtYXR0ZWRQcm9tcHQobWVzc2FnZSwgc2VuZFJlc3BvbnNlKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgeyBwcm9tcHQsIHByb3ZpZGVyOiBsbG1Qcm92aWRlciwgY29udGV4dEl0ZW1zIH0gPSBtZXNzYWdlO1xuICAgICAgICBpZiAoIXByb21wdCkge1xuICAgICAgICAgICAgc2VuZFJlc3BvbnNlKHsgZXJyb3I6ICdObyBwcm9tcHQgcHJvdmlkZWQnIH0pO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIC8vIFNob3cgYSB0ZW1wb3Jhcnkgbm90aWZpY2F0aW9uXG4gICAgICAgIHNob3dUZW1wb3JhcnlOb3RpZmljYXRpb24oYEluc2VydGluZyAke2NvbnRleHRJdGVtcz8ubGVuZ3RoIHx8IDB9IGNvbnRleHQgaXRlbXMuLi5gKTtcbiAgICAgICAgLy8gRmluZCB0aGUgaW5wdXQgZWxlbWVudFxuICAgICAgICBjb25zdCBpbnB1dEVsZW1lbnQgPSBhd2FpdCBmaW5kSW5wdXRFbGVtZW50KCk7XG4gICAgICAgIGlmICghaW5wdXRFbGVtZW50KSB7XG4gICAgICAgICAgICBzZW5kUmVzcG9uc2UoeyBlcnJvcjogJ0NvdWxkIG5vdCBmaW5kIGlucHV0IGVsZW1lbnQnIH0pO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIC8vIEluc2VydCB0aGUgZm9ybWF0dGVkIHByb21wdFxuICAgICAgICBhd2FpdCBpbnNlcnRGb3JtYXR0ZWRQcm9tcHQoaW5wdXRFbGVtZW50LCBwcm9tcHQpO1xuICAgICAgICAvLyBTaG93IHN1Y2Nlc3Mgbm90aWZpY2F0aW9uXG4gICAgICAgIHNob3dUZW1wb3JhcnlOb3RpZmljYXRpb24oJ+KchSBDb250ZXh0IGluc2VydGVkIHN1Y2Nlc3NmdWxseSEnLCAnc3VjY2VzcycpO1xuICAgICAgICBzZW5kUmVzcG9uc2UoeyBzdWNjZXNzOiB0cnVlLCBpbnNlcnRlZDogdHJ1ZSB9KTtcbiAgICB9XG4gICAgY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBpbmplY3QgZm9ybWF0dGVkIHByb21wdDonLCBlcnJvcik7XG4gICAgICAgIHNlbmRSZXNwb25zZSh7IGVycm9yOiAnRmFpbGVkIHRvIGluamVjdCBwcm9tcHQnIH0pO1xuICAgIH1cbn1cbmFzeW5jIGZ1bmN0aW9uIGZpbmRJbnB1dEVsZW1lbnQoKSB7XG4gICAgY29uc3QgY29uZmlnID0gcHJvdmlkZXJDb25maWdbcHJvdmlkZXJdO1xuICAgIGlmICghY29uZmlnKVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAvLyBUcnkgbXVsdGlwbGUgc2VsZWN0b3JzXG4gICAgZm9yIChjb25zdCBzZWxlY3RvciBvZiBjb25maWcuaW5wdXRTZWxlY3Rvcikge1xuICAgICAgICBjb25zdCBlbGVtZW50ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihzZWxlY3Rvcik7XG4gICAgICAgIGlmIChlbGVtZW50ICYmIGlzRWxlbWVudFZpc2libGUoZWxlbWVudCkpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdGb3VuZCBpbnB1dCBlbGVtZW50IHdpdGggc2VsZWN0b3I6Jywgc2VsZWN0b3IpO1xuICAgICAgICAgICAgcmV0dXJuIGVsZW1lbnQ7XG4gICAgICAgIH1cbiAgICB9XG4gICAgLy8gSWYgd2FpdGluZyBpcyBlbmFibGVkLCB0cnkgd2FpdGluZyBmb3IgZWxlbWVudCB0byBhcHBlYXJcbiAgICBpZiAoY29uZmlnLndhaXRGb3JFbGVtZW50KSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdXYWl0aW5nIGZvciBpbnB1dCBlbGVtZW50IHRvIGFwcGVhci4uLicpO1xuICAgICAgICByZXR1cm4gd2FpdEZvckVsZW1lbnQoY29uZmlnLmlucHV0U2VsZWN0b3IsIDUwMDApO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbn1cbmZ1bmN0aW9uIHdhaXRGb3JFbGVtZW50KHNlbGVjdG9ycywgdGltZW91dCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICBjb25zdCBzdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuICAgICAgICBjb25zdCBjaGVja0ZvckVsZW1lbnQgPSAoKSA9PiB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHNlbGVjdG9yIG9mIHNlbGVjdG9ycykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGVsZW1lbnQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHNlbGVjdG9yKTtcbiAgICAgICAgICAgICAgICBpZiAoZWxlbWVudCAmJiBpc0VsZW1lbnRWaXNpYmxlKGVsZW1lbnQpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoZWxlbWVudCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoRGF0ZS5ub3coKSAtIHN0YXJ0VGltZSA+IHRpbWVvdXQpIHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKG51bGwpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHNldFRpbWVvdXQoY2hlY2tGb3JFbGVtZW50LCAxMDApO1xuICAgICAgICB9O1xuICAgICAgICBjaGVja0ZvckVsZW1lbnQoKTtcbiAgICB9KTtcbn1cbmZ1bmN0aW9uIGlzRWxlbWVudFZpc2libGUoZWxlbWVudCkge1xuICAgIGNvbnN0IHN0eWxlID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUoZWxlbWVudCk7XG4gICAgcmV0dXJuIHN0eWxlLmRpc3BsYXkgIT09ICdub25lJyAmJlxuICAgICAgICBzdHlsZS52aXNpYmlsaXR5ICE9PSAnaGlkZGVuJyAmJlxuICAgICAgICBlbGVtZW50Lm9mZnNldFdpZHRoID4gMCAmJlxuICAgICAgICBlbGVtZW50Lm9mZnNldEhlaWdodCA+IDA7XG59XG5hc3luYyBmdW5jdGlvbiBpbnNlcnRGb3JtYXR0ZWRQcm9tcHQoaW5wdXRFbGVtZW50LCBwcm9tcHQpIHtcbiAgICAvLyBDbGVhciBleGlzdGluZyBjb250ZW50IGZpcnN0XG4gICAgY2xlYXJJbnB1dEVsZW1lbnQoaW5wdXRFbGVtZW50KTtcbiAgICAvLyBXYWl0IGEgYml0IGZvciBVSSB0byB1cGRhdGVcbiAgICBhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgMTAwKSk7XG4gICAgLy8gSW5zZXJ0IHRoZSBuZXcgcHJvbXB0XG4gICAgaWYgKGlucHV0RWxlbWVudC50YWdOYW1lID09PSAnVEVYVEFSRUEnKSB7XG4gICAgICAgIGNvbnN0IHRleHRhcmVhID0gaW5wdXRFbGVtZW50O1xuICAgICAgICB0ZXh0YXJlYS52YWx1ZSA9IHByb21wdDtcbiAgICAgICAgdGV4dGFyZWEuZGlzcGF0Y2hFdmVudChuZXcgRXZlbnQoJ2lucHV0JywgeyBidWJibGVzOiB0cnVlIH0pKTtcbiAgICAgICAgdGV4dGFyZWEuZGlzcGF0Y2hFdmVudChuZXcgRXZlbnQoJ2NoYW5nZScsIHsgYnViYmxlczogdHJ1ZSB9KSk7XG4gICAgfVxuICAgIGVsc2UgaWYgKGlucHV0RWxlbWVudC5jb250ZW50RWRpdGFibGUgPT09ICd0cnVlJykge1xuICAgICAgICBpbnB1dEVsZW1lbnQudGV4dENvbnRlbnQgPSBwcm9tcHQ7XG4gICAgICAgIGlucHV0RWxlbWVudC5kaXNwYXRjaEV2ZW50KG5ldyBFdmVudCgnaW5wdXQnLCB7IGJ1YmJsZXM6IHRydWUgfSkpO1xuICAgIH1cbiAgICBlbHNlIGlmIChpbnB1dEVsZW1lbnQuY2xhc3NMaXN0LmNvbnRhaW5zKCdQcm9zZU1pcnJvcicpKSB7XG4gICAgICAgIC8vIEhhbmRsZSBQcm9zZU1pcnJvciBlZGl0b3JcbiAgICAgICAgaW5wdXRFbGVtZW50LnRleHRDb250ZW50ID0gcHJvbXB0O1xuICAgICAgICBpbnB1dEVsZW1lbnQuZGlzcGF0Y2hFdmVudChuZXcgRXZlbnQoJ2lucHV0JywgeyBidWJibGVzOiB0cnVlIH0pKTtcbiAgICB9XG4gICAgLy8gRm9jdXMgdGhlIGVsZW1lbnRcbiAgICBpbnB1dEVsZW1lbnQuZm9jdXMoKTtcbiAgICAvLyBUcmlnZ2VyIGFueSBhZGRpdGlvbmFsIGV2ZW50cyB0aGF0IG1pZ2h0IGJlIG5lZWRlZFxuICAgIGlucHV0RWxlbWVudC5kaXNwYXRjaEV2ZW50KG5ldyBLZXlib2FyZEV2ZW50KCdrZXlkb3duJywgeyBrZXk6ICdFbnRlcicsIGJ1YmJsZXM6IHRydWUgfSkpO1xufVxuZnVuY3Rpb24gY2xlYXJJbnB1dEVsZW1lbnQoaW5wdXRFbGVtZW50KSB7XG4gICAgaWYgKGlucHV0RWxlbWVudC50YWdOYW1lID09PSAnVEVYVEFSRUEnKSB7XG4gICAgICAgIGlucHV0RWxlbWVudC52YWx1ZSA9ICcnO1xuICAgIH1cbiAgICBlbHNlIGlmIChpbnB1dEVsZW1lbnQuY29udGVudEVkaXRhYmxlID09PSAndHJ1ZScpIHtcbiAgICAgICAgaW5wdXRFbGVtZW50LnRleHRDb250ZW50ID0gJyc7XG4gICAgfVxufVxuZnVuY3Rpb24gZ2V0Q3VycmVudElucHV0VGV4dCgpIHtcbiAgICBjb25zdCBjb25maWcgPSBwcm92aWRlckNvbmZpZ1twcm92aWRlcl07XG4gICAgaWYgKCFjb25maWcpXG4gICAgICAgIHJldHVybiAnJztcbiAgICAvLyBUcnkgdG8gZmluZCB0aGUgaW5wdXQgZWxlbWVudCBhbmQgZ2V0IGl0cyBjdXJyZW50IHRleHRcbiAgICBmb3IgKGNvbnN0IHNlbGVjdG9yIG9mIGNvbmZpZy5pbnB1dFNlbGVjdG9yKSB7XG4gICAgICAgIGNvbnN0IGVsZW1lbnQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHNlbGVjdG9yKTtcbiAgICAgICAgaWYgKGVsZW1lbnQgJiYgaXNFbGVtZW50VmlzaWJsZShlbGVtZW50KSkge1xuICAgICAgICAgICAgaWYgKGVsZW1lbnQudGFnTmFtZSA9PT0gJ1RFWFRBUkVBJykge1xuICAgICAgICAgICAgICAgIHJldHVybiBlbGVtZW50LnZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoZWxlbWVudC5jb250ZW50RWRpdGFibGUgPT09ICd0cnVlJykge1xuICAgICAgICAgICAgICAgIHJldHVybiBlbGVtZW50LnRleHRDb250ZW50IHx8ICcnO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiAnJztcbn1cbmZ1bmN0aW9uIHNob3dUZW1wb3JhcnlOb3RpZmljYXRpb24obWVzc2FnZSwgdHlwZSA9ICdpbmZvJykge1xuICAgIGNvbnN0IG5vdGlmaWNhdGlvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIG5vdGlmaWNhdGlvbi50ZXh0Q29udGVudCA9IG1lc3NhZ2U7XG4gICAgbm90aWZpY2F0aW9uLnN0eWxlLmNzc1RleHQgPSBgXG4gICAgcG9zaXRpb246IGZpeGVkO1xuICAgIHRvcDogNTBweDtcbiAgICByaWdodDogMjBweDtcbiAgICBiYWNrZ3JvdW5kOiAke3R5cGUgPT09ICdzdWNjZXNzJyA/ICcjMTBiOTgxJyA6IHR5cGUgPT09ICdlcnJvcicgPyAnI2VmNDQ0NCcgOiAnIzNiODJmNid9O1xuICAgIGNvbG9yOiB3aGl0ZTtcbiAgICBwYWRkaW5nOiAxMnB4IDE2cHg7XG4gICAgYm9yZGVyLXJhZGl1czogOHB4O1xuICAgIGZvbnQtc2l6ZTogMTRweDtcbiAgICB6LWluZGV4OiAxMDAwMTtcbiAgICBmb250LWZhbWlseTogc3lzdGVtLXVpO1xuICAgIGJveC1zaGFkb3c6IDAgNHB4IDZweCByZ2JhKDAsIDAsIDAsIDAuMSk7XG4gICAgYW5pbWF0aW9uOiBzbGlkZUluUmlnaHQgMC4zcyBlYXNlLW91dDtcbiAgYDtcbiAgICAvLyBBZGQgYW5pbWF0aW9uIGtleWZyYW1lc1xuICAgIGlmICghZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2FpLWFzc2lzdGFudC1hbmltYXRpb25zJykpIHtcbiAgICAgICAgY29uc3Qgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpO1xuICAgICAgICBzdHlsZS5pZCA9ICdhaS1hc3Npc3RhbnQtYW5pbWF0aW9ucyc7XG4gICAgICAgIHN0eWxlLnRleHRDb250ZW50ID0gYFxuICAgICAgQGtleWZyYW1lcyBzbGlkZUluUmlnaHQge1xuICAgICAgICBmcm9tIHsgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKDEwMCUpOyBvcGFjaXR5OiAwOyB9XG4gICAgICAgIHRvIHsgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKDApOyBvcGFjaXR5OiAxOyB9XG4gICAgICB9XG4gICAgYDtcbiAgICAgICAgZG9jdW1lbnQuaGVhZC5hcHBlbmRDaGlsZChzdHlsZSk7XG4gICAgfVxuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQobm90aWZpY2F0aW9uKTtcbiAgICAvLyBBdXRvLXJlbW92ZSBhZnRlciAzIHNlY29uZHNcbiAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgbm90aWZpY2F0aW9uLnN0eWxlLmFuaW1hdGlvbiA9ICdzbGlkZUluUmlnaHQgMC4zcyBlYXNlLW91dCByZXZlcnNlJztcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiBub3RpZmljYXRpb24ucmVtb3ZlKCksIDMwMCk7XG4gICAgfSwgMzAwMCk7XG59XG4iXSwibmFtZXMiOltdLCJzb3VyY2VSb290IjoiIn0=