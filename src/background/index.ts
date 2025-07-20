// Background service worker
console.log('AI Coding Assistant background script loaded');

interface ContextItem {
  name: string;
  description: string;
  content: string;
  uri?: {
    type: string;
    value: string;
  };
}

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('AI Coding Assistant installed');
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);
  
  switch (message.type) {
    case 'HEALTH_CHECK':
      sendResponse({ status: 'ok' });
      break;
      
    case 'GET_PROJECT_CONTEXT':
      handleGetProjectContext(message, sendResponse);
      return true; // Keep channel open for async response
      
    case 'INSERT_CONTEXT':
      handleInsertContext(message, sender, sendResponse);
      return true; // Keep channel open for async response
      
    case 'GET_INTELLIGENT_CONTEXT':
      handleGetIntelligentContext(message, sendResponse);
      return true; // Keep channel open for async response
      
    case 'CODE_EXTRACTED':
      handleCodeExtracted(message, sendResponse);
      return true; // Keep channel open for async response
      
    default:
      sendResponse({ error: 'Unknown message type' });
  }
});

// Communication with local server
const SERVER_URL = 'http://localhost:3001';

const sendToServer = async (endpoint: string, data: any = {}, method: string = 'POST') => {
  try {
    const response = await fetch(`${SERVER_URL}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: method === 'POST' ? JSON.stringify(data) : undefined,
    });
    return await response.json();
  } catch (error) {
    console.error('Failed to communicate with server:', error);
    return { error: 'Server communication failed' };
  }
};

const handleGetProjectContext = async (message: any, sendResponse: (response: any) => void) => {
  try {
    const response = await sendToServer('/api/context/enhanced', {
      provider: 'codebase',
      query: message.query || '',
      includeRepoMap: message.includeRepoMap || false,
      maxFiles: message.maxFiles || 10
    });
    
    sendResponse({ context: response });
  } catch (error) {
    console.error('Failed to get project context:', error);
    sendResponse({ error: 'Failed to get project context' });
  }
};

const handleGetIntelligentContext = async (message: any, sendResponse: (response: any) => void) => {
  try {
    const response = await sendToServer('/api/context/intelligent', {
      query: message.query || '',
      maxItems: message.maxItems || 5
    });
    
    sendResponse({ items: response.items || [] });
  } catch (error) {
    console.error('Failed to get intelligent context:', error);
    sendResponse({ error: 'Failed to get intelligent context' });
  }
};

const handleInsertContext = async (message: any, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) => {
  try {
    const { context, provider } = message;
    
    if (!context || !Array.isArray(context) || context.length === 0) {
      sendResponse({ error: 'No context provided' });
      return;
    }

    // Format the prompt using the server
    const formattedResponse = await sendToServer('/api/prompt/format', {
      message: 'Please help me understand and work with this code:',
      contextItems: context,
      options: { provider: provider || 'openai' },
      systemPrompt: 'You are a helpful coding assistant. Use the provided code context to give accurate and helpful responses.'
    });

    if (formattedResponse.error) {
      sendResponse({ error: 'Failed to format prompt' });
      return;
    }

    // Get the active tab
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!activeTab?.id) {
      sendResponse({ error: 'No active tab found' });
      return;
    }

    // Inject the formatted prompt into the active tab
    const injectionResult = await chrome.tabs.sendMessage(activeTab.id, {
      type: 'INJECT_FORMATTED_PROMPT',
      prompt: formattedResponse.formattedPrompt,
      provider: provider,
      contextItems: context
    });

    sendResponse({ success: true, injected: injectionResult });
  } catch (error) {
    console.error('Failed to insert context:', error);
    sendResponse({ error: 'Failed to insert context' });
  }
};

// Add keyboard shortcut handler
console.log('Setting up keyboard shortcut handler...');
chrome.commands.onCommand.addListener(async (command) => {
  console.log('Command received:', command);
  if (command === 'insert-context') {
    console.log('Keyboard shortcut activated: Ctrl+Shift+K');
    
    try {
      // Get current tab URL to detect LLM provider
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!activeTab?.url) {
        console.error('No active tab URL');
        return;
      }

      const provider = detectLLMProvider(activeTab.url);
      console.log('Detected provider:', provider, 'for URL:', activeTab.url);
      
      if (provider === 'unknown') {
        // Show notification that this isn't an LLM site
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon-48.png',
          title: 'AI Coding Assistant',
          message: 'Please navigate to a supported LLM site (ChatGPT, Claude, Gemini) to use this feature.'
        });
        return;
      }

      // Get current text from the input field
      let currentInputText = '';
      try {
        const inputResponse = await chrome.tabs.sendMessage(activeTab.id, {
          type: 'GET_CURRENT_INPUT'
        });
        currentInputText = inputResponse?.text || '';
      } catch (error) {
        console.log('Could not get current input text');
      }

      // Get intelligent context selection automatically
      const contextQuery = currentInputText || 'current project code analysis';
      console.log('Getting context with query:', contextQuery);
      const contextResponse = await sendToServer('/api/context/intelligent', {
        query: contextQuery,
        maxItems: 5
      });
      console.log('Context response:', contextResponse);

      if (contextResponse.items && contextResponse.items.length > 0) {
        // Use the actual user input as the message, or provide a default
        const userMessage = currentInputText || 'Please help me understand and work with this code:';
        
        // Format and inject automatically
        const formattedResponse = await sendToServer('/api/prompt/format', {
          message: userMessage,
          contextItems: contextResponse.items,
          options: { provider },
          systemPrompt: 'You are a helpful coding assistant. Use the provided code context to give accurate and helpful responses about the codebase.'
        });

        if (activeTab.id && !formattedResponse.error) {
          await chrome.tabs.sendMessage(activeTab.id, {
            type: 'INJECT_FORMATTED_PROMPT',
            prompt: formattedResponse.formattedPrompt,
            provider,
            contextItems: contextResponse.items
          });
        }
      }
    } catch (error) {
      console.error('Keyboard shortcut handler failed:', error);
    }
  }
});

const handleCodeExtracted = async (message: any, sendResponse: (response: any) => void) => {
  try {
    const { extractedCode, fullResponse, provider } = message.data;
    
    console.log(`Processing ${extractedCode.length} extracted code blocks from ${provider}`);
    console.log('Extracted code preview:', extractedCode.slice(0, 2));
    
    // Send extracted content to server for processing
    console.log('Sending to server /api/response/process...');
    const processResponse = await sendToServer('/api/response/process', {
      extractedCode,
      fullResponse,
      provider,
      timestamp: Date.now()
    });
    
    console.log('Server process response:', processResponse);
    
    if (processResponse.fileChanges && processResponse.fileChanges.length > 0) {
      console.log(`Found ${processResponse.fileChanges.length} potential file changes`);
      
      // Show notification about extracted changes
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon-48.png',
        title: 'AI Code Changes Detected',
        message: `Found ${processResponse.fileChanges.length} file changes. Click extension to review and apply.`
      });
      
      // Store the extracted changes for popup access
      chrome.storage.local.set({
        lastExtractedChanges: {
          changes: processResponse.fileChanges,
          timestamp: Date.now(),
          provider
        }
      });
    }
    
    sendResponse({ success: true, processed: processResponse });
  } catch (error) {
    console.error('Failed to process extracted code:', error);
    sendResponse({ error: 'Failed to process extracted code' });
  }
};

const detectLLMProvider = (url: string): string => {
  const hostname = new URL(url).hostname.toLowerCase();
  
  if (hostname.includes('chatgpt.com')) return 'openai';
  if (hostname.includes('claude.ai')) return 'anthropic';
  if (hostname.includes('gemini.google.com')) return 'openai';
  if (hostname.includes('perplexity.ai')) return 'openai';
  if (hostname.includes('chat.mistral.ai')) return 'openai';
  if (hostname.includes('huggingface.co')) return 'openai';
  
  return 'unknown';
};
