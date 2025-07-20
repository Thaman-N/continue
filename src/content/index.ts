// Content script for LLM provider websites
console.log('AI Coding Assistant content script loaded on:', window.location.hostname);

// Import response extractor
import './responseExtractor';

interface ContextItem {
  name: string;
  description: string;
  content: string;
  uri?: {
    type: string;
    value: string;
  };
}

// Detect which LLM provider we're on
const detectProvider = (): string => {
  const hostname = window.location.hostname;
  if (hostname.includes('chatgpt.com')) return 'chatgpt';
  if (hostname.includes('claude.ai')) return 'claude';
  if (hostname.includes('gemini.google.com')) return 'gemini';
  if (hostname.includes('perplexity.ai')) return 'perplexity';
  if (hostname.includes('chat.mistral.ai')) return 'mistral';
  if (hostname.includes('huggingface.co')) return 'huggingface';
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

function initializeProvider(providerType: string) {
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

async function handleInjectFormattedPrompt(message: any, sendResponse: (response: any) => void) {
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
  } catch (error) {
    console.error('Failed to inject formatted prompt:', error);
    sendResponse({ error: 'Failed to inject prompt' });
  }
}

async function findInputElement(): Promise<HTMLElement | null> {
  const config = providerConfig[provider as keyof typeof providerConfig];
  if (!config) return null;

  // Try multiple selectors
  for (const selector of config.inputSelector) {
    const element = document.querySelector(selector) as HTMLElement;
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

function waitForElement(selectors: string[], timeout: number): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    const checkForElement = () => {
      for (const selector of selectors) {
        const element = document.querySelector(selector) as HTMLElement;
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

function isElementVisible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && 
         style.visibility !== 'hidden' && 
         element.offsetWidth > 0 && 
         element.offsetHeight > 0;
}

async function insertFormattedPrompt(inputElement: HTMLElement, prompt: string) {
  // Clear existing content first
  clearInputElement(inputElement);
  
  // Wait a bit for UI to update
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Insert the new prompt
  if (inputElement.tagName === 'TEXTAREA') {
    const textarea = inputElement as HTMLTextAreaElement;
    textarea.value = prompt;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
  } else if (inputElement.contentEditable === 'true') {
    inputElement.textContent = prompt;
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
  } else if (inputElement.classList.contains('ProseMirror')) {
    // Handle ProseMirror editor
    inputElement.textContent = prompt;
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
  }
  
  // Focus the element
  inputElement.focus();
  
  // Trigger any additional events that might be needed
  inputElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
}

function clearInputElement(inputElement: HTMLElement) {
  if (inputElement.tagName === 'TEXTAREA') {
    (inputElement as HTMLTextAreaElement).value = '';
  } else if (inputElement.contentEditable === 'true') {
    inputElement.textContent = '';
  }
}

function getCurrentInputText(): string {
  const config = providerConfig[provider as keyof typeof providerConfig];
  if (!config) return '';

  // Try to find the input element and get its current text
  for (const selector of config.inputSelector) {
    const element = document.querySelector(selector) as HTMLElement;
    if (element && isElementVisible(element)) {
      if (element.tagName === 'TEXTAREA') {
        return (element as HTMLTextAreaElement).value;
      } else if (element.contentEditable === 'true') {
        return element.textContent || '';
      }
    }
  }

  return '';
}

function showTemporaryNotification(message: string, type: 'info' | 'success' | 'error' = 'info') {
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
