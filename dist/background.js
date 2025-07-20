/******/ (() => { // webpackBootstrap
/*!*********************************!*\
  !*** ./src/background/index.ts ***!
  \*********************************/
// Background service worker
console.log('AI Coding Assistant background script loaded');
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
const sendToServer = async (endpoint, data = {}, method = 'POST') => {
    try {
        const response = await fetch(`${SERVER_URL}${endpoint}`, {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: method === 'POST' ? JSON.stringify(data) : undefined,
        });
        return await response.json();
    }
    catch (error) {
        console.error('Failed to communicate with server:', error);
        return { error: 'Server communication failed' };
    }
};
const handleGetProjectContext = async (message, sendResponse) => {
    try {
        const response = await sendToServer('/api/context/enhanced', {
            provider: 'codebase',
            query: message.query || '',
            includeRepoMap: message.includeRepoMap || false,
            maxFiles: message.maxFiles || 10
        });
        sendResponse({ context: response });
    }
    catch (error) {
        console.error('Failed to get project context:', error);
        sendResponse({ error: 'Failed to get project context' });
    }
};
const handleGetIntelligentContext = async (message, sendResponse) => {
    try {
        const response = await sendToServer('/api/context/intelligent', {
            query: message.query || '',
            maxItems: message.maxItems || 5
        });
        sendResponse({ items: response.items || [] });
    }
    catch (error) {
        console.error('Failed to get intelligent context:', error);
        sendResponse({ error: 'Failed to get intelligent context' });
    }
};
const handleInsertContext = async (message, sender, sendResponse) => {
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
    }
    catch (error) {
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
            }
            catch (error) {
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
        }
        catch (error) {
            console.error('Keyboard shortcut handler failed:', error);
        }
    }
});
const handleCodeExtracted = async (message, sendResponse) => {
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
    }
    catch (error) {
        console.error('Failed to process extracted code:', error);
        sendResponse({ error: 'Failed to process extracted code' });
    }
};
const detectLLMProvider = (url) => {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes('chatgpt.com'))
        return 'openai';
    if (hostname.includes('claude.ai'))
        return 'anthropic';
    if (hostname.includes('gemini.google.com'))
        return 'openai';
    if (hostname.includes('perplexity.ai'))
        return 'openai';
    if (hostname.includes('chat.mistral.ai'))
        return 'openai';
    if (hostname.includes('huggingface.co'))
        return 'openai';
    return 'unknown';
};

/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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L2luZGV4LnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIEJhY2tncm91bmQgc2VydmljZSB3b3JrZXJcbmNvbnNvbGUubG9nKCdBSSBDb2RpbmcgQXNzaXN0YW50IGJhY2tncm91bmQgc2NyaXB0IGxvYWRlZCcpO1xuLy8gSGFuZGxlIGV4dGVuc2lvbiBpbnN0YWxsYXRpb25cbmNocm9tZS5ydW50aW1lLm9uSW5zdGFsbGVkLmFkZExpc3RlbmVyKCgpID0+IHtcbiAgICBjb25zb2xlLmxvZygnQUkgQ29kaW5nIEFzc2lzdGFudCBpbnN0YWxsZWQnKTtcbn0pO1xuLy8gSGFuZGxlIG1lc3NhZ2VzIGZyb20gY29udGVudCBzY3JpcHRzIGFuZCBwb3B1cFxuY2hyb21lLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKChtZXNzYWdlLCBzZW5kZXIsIHNlbmRSZXNwb25zZSkgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdCYWNrZ3JvdW5kIHJlY2VpdmVkIG1lc3NhZ2U6JywgbWVzc2FnZSk7XG4gICAgc3dpdGNoIChtZXNzYWdlLnR5cGUpIHtcbiAgICAgICAgY2FzZSAnSEVBTFRIX0NIRUNLJzpcbiAgICAgICAgICAgIHNlbmRSZXNwb25zZSh7IHN0YXR1czogJ29rJyB9KTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdHRVRfUFJPSkVDVF9DT05URVhUJzpcbiAgICAgICAgICAgIGhhbmRsZUdldFByb2plY3RDb250ZXh0KG1lc3NhZ2UsIHNlbmRSZXNwb25zZSk7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTsgLy8gS2VlcCBjaGFubmVsIG9wZW4gZm9yIGFzeW5jIHJlc3BvbnNlXG4gICAgICAgIGNhc2UgJ0lOU0VSVF9DT05URVhUJzpcbiAgICAgICAgICAgIGhhbmRsZUluc2VydENvbnRleHQobWVzc2FnZSwgc2VuZGVyLCBzZW5kUmVzcG9uc2UpO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7IC8vIEtlZXAgY2hhbm5lbCBvcGVuIGZvciBhc3luYyByZXNwb25zZVxuICAgICAgICBjYXNlICdHRVRfSU5URUxMSUdFTlRfQ09OVEVYVCc6XG4gICAgICAgICAgICBoYW5kbGVHZXRJbnRlbGxpZ2VudENvbnRleHQobWVzc2FnZSwgc2VuZFJlc3BvbnNlKTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlOyAvLyBLZWVwIGNoYW5uZWwgb3BlbiBmb3IgYXN5bmMgcmVzcG9uc2VcbiAgICAgICAgY2FzZSAnQ09ERV9FWFRSQUNURUQnOlxuICAgICAgICAgICAgaGFuZGxlQ29kZUV4dHJhY3RlZChtZXNzYWdlLCBzZW5kUmVzcG9uc2UpO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7IC8vIEtlZXAgY2hhbm5lbCBvcGVuIGZvciBhc3luYyByZXNwb25zZVxuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgc2VuZFJlc3BvbnNlKHsgZXJyb3I6ICdVbmtub3duIG1lc3NhZ2UgdHlwZScgfSk7XG4gICAgfVxufSk7XG4vLyBDb21tdW5pY2F0aW9uIHdpdGggbG9jYWwgc2VydmVyXG5jb25zdCBTRVJWRVJfVVJMID0gJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMSc7XG5jb25zdCBzZW5kVG9TZXJ2ZXIgPSBhc3luYyAoZW5kcG9pbnQsIGRhdGEgPSB7fSwgbWV0aG9kID0gJ1BPU1QnKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChgJHtTRVJWRVJfVVJMfSR7ZW5kcG9pbnR9YCwge1xuICAgICAgICAgICAgbWV0aG9kLFxuICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgYm9keTogbWV0aG9kID09PSAnUE9TVCcgPyBKU09OLnN0cmluZ2lmeShkYXRhKSA6IHVuZGVmaW5lZCxcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBhd2FpdCByZXNwb25zZS5qc29uKCk7XG4gICAgfVxuICAgIGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdGYWlsZWQgdG8gY29tbXVuaWNhdGUgd2l0aCBzZXJ2ZXI6JywgZXJyb3IpO1xuICAgICAgICByZXR1cm4geyBlcnJvcjogJ1NlcnZlciBjb21tdW5pY2F0aW9uIGZhaWxlZCcgfTtcbiAgICB9XG59O1xuY29uc3QgaGFuZGxlR2V0UHJvamVjdENvbnRleHQgPSBhc3luYyAobWVzc2FnZSwgc2VuZFJlc3BvbnNlKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBzZW5kVG9TZXJ2ZXIoJy9hcGkvY29udGV4dC9lbmhhbmNlZCcsIHtcbiAgICAgICAgICAgIHByb3ZpZGVyOiAnY29kZWJhc2UnLFxuICAgICAgICAgICAgcXVlcnk6IG1lc3NhZ2UucXVlcnkgfHwgJycsXG4gICAgICAgICAgICBpbmNsdWRlUmVwb01hcDogbWVzc2FnZS5pbmNsdWRlUmVwb01hcCB8fCBmYWxzZSxcbiAgICAgICAgICAgIG1heEZpbGVzOiBtZXNzYWdlLm1heEZpbGVzIHx8IDEwXG4gICAgICAgIH0pO1xuICAgICAgICBzZW5kUmVzcG9uc2UoeyBjb250ZXh0OiByZXNwb25zZSB9KTtcbiAgICB9XG4gICAgY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBnZXQgcHJvamVjdCBjb250ZXh0OicsIGVycm9yKTtcbiAgICAgICAgc2VuZFJlc3BvbnNlKHsgZXJyb3I6ICdGYWlsZWQgdG8gZ2V0IHByb2plY3QgY29udGV4dCcgfSk7XG4gICAgfVxufTtcbmNvbnN0IGhhbmRsZUdldEludGVsbGlnZW50Q29udGV4dCA9IGFzeW5jIChtZXNzYWdlLCBzZW5kUmVzcG9uc2UpID0+IHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHNlbmRUb1NlcnZlcignL2FwaS9jb250ZXh0L2ludGVsbGlnZW50Jywge1xuICAgICAgICAgICAgcXVlcnk6IG1lc3NhZ2UucXVlcnkgfHwgJycsXG4gICAgICAgICAgICBtYXhJdGVtczogbWVzc2FnZS5tYXhJdGVtcyB8fCA1XG4gICAgICAgIH0pO1xuICAgICAgICBzZW5kUmVzcG9uc2UoeyBpdGVtczogcmVzcG9uc2UuaXRlbXMgfHwgW10gfSk7XG4gICAgfVxuICAgIGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdGYWlsZWQgdG8gZ2V0IGludGVsbGlnZW50IGNvbnRleHQ6JywgZXJyb3IpO1xuICAgICAgICBzZW5kUmVzcG9uc2UoeyBlcnJvcjogJ0ZhaWxlZCB0byBnZXQgaW50ZWxsaWdlbnQgY29udGV4dCcgfSk7XG4gICAgfVxufTtcbmNvbnN0IGhhbmRsZUluc2VydENvbnRleHQgPSBhc3luYyAobWVzc2FnZSwgc2VuZGVyLCBzZW5kUmVzcG9uc2UpID0+IHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCB7IGNvbnRleHQsIHByb3ZpZGVyIH0gPSBtZXNzYWdlO1xuICAgICAgICBpZiAoIWNvbnRleHQgfHwgIUFycmF5LmlzQXJyYXkoY29udGV4dCkgfHwgY29udGV4dC5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIHNlbmRSZXNwb25zZSh7IGVycm9yOiAnTm8gY29udGV4dCBwcm92aWRlZCcgfSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgLy8gRm9ybWF0IHRoZSBwcm9tcHQgdXNpbmcgdGhlIHNlcnZlclxuICAgICAgICBjb25zdCBmb3JtYXR0ZWRSZXNwb25zZSA9IGF3YWl0IHNlbmRUb1NlcnZlcignL2FwaS9wcm9tcHQvZm9ybWF0Jywge1xuICAgICAgICAgICAgbWVzc2FnZTogJ1BsZWFzZSBoZWxwIG1lIHVuZGVyc3RhbmQgYW5kIHdvcmsgd2l0aCB0aGlzIGNvZGU6JyxcbiAgICAgICAgICAgIGNvbnRleHRJdGVtczogY29udGV4dCxcbiAgICAgICAgICAgIG9wdGlvbnM6IHsgcHJvdmlkZXI6IHByb3ZpZGVyIHx8ICdvcGVuYWknIH0sXG4gICAgICAgICAgICBzeXN0ZW1Qcm9tcHQ6ICdZb3UgYXJlIGEgaGVscGZ1bCBjb2RpbmcgYXNzaXN0YW50LiBVc2UgdGhlIHByb3ZpZGVkIGNvZGUgY29udGV4dCB0byBnaXZlIGFjY3VyYXRlIGFuZCBoZWxwZnVsIHJlc3BvbnNlcy4nXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoZm9ybWF0dGVkUmVzcG9uc2UuZXJyb3IpIHtcbiAgICAgICAgICAgIHNlbmRSZXNwb25zZSh7IGVycm9yOiAnRmFpbGVkIHRvIGZvcm1hdCBwcm9tcHQnIH0pO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIC8vIEdldCB0aGUgYWN0aXZlIHRhYlxuICAgICAgICBjb25zdCBbYWN0aXZlVGFiXSA9IGF3YWl0IGNocm9tZS50YWJzLnF1ZXJ5KHsgYWN0aXZlOiB0cnVlLCBjdXJyZW50V2luZG93OiB0cnVlIH0pO1xuICAgICAgICBpZiAoIWFjdGl2ZVRhYj8uaWQpIHtcbiAgICAgICAgICAgIHNlbmRSZXNwb25zZSh7IGVycm9yOiAnTm8gYWN0aXZlIHRhYiBmb3VuZCcgfSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgLy8gSW5qZWN0IHRoZSBmb3JtYXR0ZWQgcHJvbXB0IGludG8gdGhlIGFjdGl2ZSB0YWJcbiAgICAgICAgY29uc3QgaW5qZWN0aW9uUmVzdWx0ID0gYXdhaXQgY2hyb21lLnRhYnMuc2VuZE1lc3NhZ2UoYWN0aXZlVGFiLmlkLCB7XG4gICAgICAgICAgICB0eXBlOiAnSU5KRUNUX0ZPUk1BVFRFRF9QUk9NUFQnLFxuICAgICAgICAgICAgcHJvbXB0OiBmb3JtYXR0ZWRSZXNwb25zZS5mb3JtYXR0ZWRQcm9tcHQsXG4gICAgICAgICAgICBwcm92aWRlcjogcHJvdmlkZXIsXG4gICAgICAgICAgICBjb250ZXh0SXRlbXM6IGNvbnRleHRcbiAgICAgICAgfSk7XG4gICAgICAgIHNlbmRSZXNwb25zZSh7IHN1Y2Nlc3M6IHRydWUsIGluamVjdGVkOiBpbmplY3Rpb25SZXN1bHQgfSk7XG4gICAgfVxuICAgIGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdGYWlsZWQgdG8gaW5zZXJ0IGNvbnRleHQ6JywgZXJyb3IpO1xuICAgICAgICBzZW5kUmVzcG9uc2UoeyBlcnJvcjogJ0ZhaWxlZCB0byBpbnNlcnQgY29udGV4dCcgfSk7XG4gICAgfVxufTtcbi8vIEFkZCBrZXlib2FyZCBzaG9ydGN1dCBoYW5kbGVyXG5jb25zb2xlLmxvZygnU2V0dGluZyB1cCBrZXlib2FyZCBzaG9ydGN1dCBoYW5kbGVyLi4uJyk7XG5jaHJvbWUuY29tbWFuZHMub25Db21tYW5kLmFkZExpc3RlbmVyKGFzeW5jIChjb21tYW5kKSA9PiB7XG4gICAgY29uc29sZS5sb2coJ0NvbW1hbmQgcmVjZWl2ZWQ6JywgY29tbWFuZCk7XG4gICAgaWYgKGNvbW1hbmQgPT09ICdpbnNlcnQtY29udGV4dCcpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ0tleWJvYXJkIHNob3J0Y3V0IGFjdGl2YXRlZDogQ3RybCtTaGlmdCtLJyk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBHZXQgY3VycmVudCB0YWIgVVJMIHRvIGRldGVjdCBMTE0gcHJvdmlkZXJcbiAgICAgICAgICAgIGNvbnN0IFthY3RpdmVUYWJdID0gYXdhaXQgY2hyb21lLnRhYnMucXVlcnkoeyBhY3RpdmU6IHRydWUsIGN1cnJlbnRXaW5kb3c6IHRydWUgfSk7XG4gICAgICAgICAgICBpZiAoIWFjdGl2ZVRhYj8udXJsKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignTm8gYWN0aXZlIHRhYiBVUkwnKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBwcm92aWRlciA9IGRldGVjdExMTVByb3ZpZGVyKGFjdGl2ZVRhYi51cmwpO1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ0RldGVjdGVkIHByb3ZpZGVyOicsIHByb3ZpZGVyLCAnZm9yIFVSTDonLCBhY3RpdmVUYWIudXJsKTtcbiAgICAgICAgICAgIGlmIChwcm92aWRlciA9PT0gJ3Vua25vd24nKSB7XG4gICAgICAgICAgICAgICAgLy8gU2hvdyBub3RpZmljYXRpb24gdGhhdCB0aGlzIGlzbid0IGFuIExMTSBzaXRlXG4gICAgICAgICAgICAgICAgY2hyb21lLm5vdGlmaWNhdGlvbnMuY3JlYXRlKHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2Jhc2ljJyxcbiAgICAgICAgICAgICAgICAgICAgaWNvblVybDogJ2ljb25zL2ljb24tNDgucG5nJyxcbiAgICAgICAgICAgICAgICAgICAgdGl0bGU6ICdBSSBDb2RpbmcgQXNzaXN0YW50JyxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogJ1BsZWFzZSBuYXZpZ2F0ZSB0byBhIHN1cHBvcnRlZCBMTE0gc2l0ZSAoQ2hhdEdQVCwgQ2xhdWRlLCBHZW1pbmkpIHRvIHVzZSB0aGlzIGZlYXR1cmUuJ1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIEdldCBjdXJyZW50IHRleHQgZnJvbSB0aGUgaW5wdXQgZmllbGRcbiAgICAgICAgICAgIGxldCBjdXJyZW50SW5wdXRUZXh0ID0gJyc7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGlucHV0UmVzcG9uc2UgPSBhd2FpdCBjaHJvbWUudGFicy5zZW5kTWVzc2FnZShhY3RpdmVUYWIuaWQsIHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ0dFVF9DVVJSRU5UX0lOUFVUJ1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGN1cnJlbnRJbnB1dFRleHQgPSBpbnB1dFJlc3BvbnNlPy50ZXh0IHx8ICcnO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ0NvdWxkIG5vdCBnZXQgY3VycmVudCBpbnB1dCB0ZXh0Jyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBHZXQgaW50ZWxsaWdlbnQgY29udGV4dCBzZWxlY3Rpb24gYXV0b21hdGljYWxseVxuICAgICAgICAgICAgY29uc3QgY29udGV4dFF1ZXJ5ID0gY3VycmVudElucHV0VGV4dCB8fCAnY3VycmVudCBwcm9qZWN0IGNvZGUgYW5hbHlzaXMnO1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ0dldHRpbmcgY29udGV4dCB3aXRoIHF1ZXJ5OicsIGNvbnRleHRRdWVyeSk7XG4gICAgICAgICAgICBjb25zdCBjb250ZXh0UmVzcG9uc2UgPSBhd2FpdCBzZW5kVG9TZXJ2ZXIoJy9hcGkvY29udGV4dC9pbnRlbGxpZ2VudCcsIHtcbiAgICAgICAgICAgICAgICBxdWVyeTogY29udGV4dFF1ZXJ5LFxuICAgICAgICAgICAgICAgIG1heEl0ZW1zOiA1XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdDb250ZXh0IHJlc3BvbnNlOicsIGNvbnRleHRSZXNwb25zZSk7XG4gICAgICAgICAgICBpZiAoY29udGV4dFJlc3BvbnNlLml0ZW1zICYmIGNvbnRleHRSZXNwb25zZS5pdGVtcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgLy8gVXNlIHRoZSBhY3R1YWwgdXNlciBpbnB1dCBhcyB0aGUgbWVzc2FnZSwgb3IgcHJvdmlkZSBhIGRlZmF1bHRcbiAgICAgICAgICAgICAgICBjb25zdCB1c2VyTWVzc2FnZSA9IGN1cnJlbnRJbnB1dFRleHQgfHwgJ1BsZWFzZSBoZWxwIG1lIHVuZGVyc3RhbmQgYW5kIHdvcmsgd2l0aCB0aGlzIGNvZGU6JztcbiAgICAgICAgICAgICAgICAvLyBGb3JtYXQgYW5kIGluamVjdCBhdXRvbWF0aWNhbGx5XG4gICAgICAgICAgICAgICAgY29uc3QgZm9ybWF0dGVkUmVzcG9uc2UgPSBhd2FpdCBzZW5kVG9TZXJ2ZXIoJy9hcGkvcHJvbXB0L2Zvcm1hdCcsIHtcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogdXNlck1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgICAgIGNvbnRleHRJdGVtczogY29udGV4dFJlc3BvbnNlLml0ZW1zLFxuICAgICAgICAgICAgICAgICAgICBvcHRpb25zOiB7IHByb3ZpZGVyIH0sXG4gICAgICAgICAgICAgICAgICAgIHN5c3RlbVByb21wdDogJ1lvdSBhcmUgYSBoZWxwZnVsIGNvZGluZyBhc3Npc3RhbnQuIFVzZSB0aGUgcHJvdmlkZWQgY29kZSBjb250ZXh0IHRvIGdpdmUgYWNjdXJhdGUgYW5kIGhlbHBmdWwgcmVzcG9uc2VzIGFib3V0IHRoZSBjb2RlYmFzZS4nXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgaWYgKGFjdGl2ZVRhYi5pZCAmJiAhZm9ybWF0dGVkUmVzcG9uc2UuZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgY2hyb21lLnRhYnMuc2VuZE1lc3NhZ2UoYWN0aXZlVGFiLmlkLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnSU5KRUNUX0ZPUk1BVFRFRF9QUk9NUFQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvbXB0OiBmb3JtYXR0ZWRSZXNwb25zZS5mb3JtYXR0ZWRQcm9tcHQsXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm92aWRlcixcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRleHRJdGVtczogY29udGV4dFJlc3BvbnNlLml0ZW1zXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0tleWJvYXJkIHNob3J0Y3V0IGhhbmRsZXIgZmFpbGVkOicsIGVycm9yKTtcbiAgICAgICAgfVxuICAgIH1cbn0pO1xuY29uc3QgaGFuZGxlQ29kZUV4dHJhY3RlZCA9IGFzeW5jIChtZXNzYWdlLCBzZW5kUmVzcG9uc2UpID0+IHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCB7IGV4dHJhY3RlZENvZGUsIGZ1bGxSZXNwb25zZSwgcHJvdmlkZXIgfSA9IG1lc3NhZ2UuZGF0YTtcbiAgICAgICAgY29uc29sZS5sb2coYFByb2Nlc3NpbmcgJHtleHRyYWN0ZWRDb2RlLmxlbmd0aH0gZXh0cmFjdGVkIGNvZGUgYmxvY2tzIGZyb20gJHtwcm92aWRlcn1gKTtcbiAgICAgICAgY29uc29sZS5sb2coJ0V4dHJhY3RlZCBjb2RlIHByZXZpZXc6JywgZXh0cmFjdGVkQ29kZS5zbGljZSgwLCAyKSk7XG4gICAgICAgIC8vIFNlbmQgZXh0cmFjdGVkIGNvbnRlbnQgdG8gc2VydmVyIGZvciBwcm9jZXNzaW5nXG4gICAgICAgIGNvbnNvbGUubG9nKCdTZW5kaW5nIHRvIHNlcnZlciAvYXBpL3Jlc3BvbnNlL3Byb2Nlc3MuLi4nKTtcbiAgICAgICAgY29uc3QgcHJvY2Vzc1Jlc3BvbnNlID0gYXdhaXQgc2VuZFRvU2VydmVyKCcvYXBpL3Jlc3BvbnNlL3Byb2Nlc3MnLCB7XG4gICAgICAgICAgICBleHRyYWN0ZWRDb2RlLFxuICAgICAgICAgICAgZnVsbFJlc3BvbnNlLFxuICAgICAgICAgICAgcHJvdmlkZXIsXG4gICAgICAgICAgICB0aW1lc3RhbXA6IERhdGUubm93KClcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnNvbGUubG9nKCdTZXJ2ZXIgcHJvY2VzcyByZXNwb25zZTonLCBwcm9jZXNzUmVzcG9uc2UpO1xuICAgICAgICBpZiAocHJvY2Vzc1Jlc3BvbnNlLmZpbGVDaGFuZ2VzICYmIHByb2Nlc3NSZXNwb25zZS5maWxlQ2hhbmdlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgRm91bmQgJHtwcm9jZXNzUmVzcG9uc2UuZmlsZUNoYW5nZXMubGVuZ3RofSBwb3RlbnRpYWwgZmlsZSBjaGFuZ2VzYCk7XG4gICAgICAgICAgICAvLyBTaG93IG5vdGlmaWNhdGlvbiBhYm91dCBleHRyYWN0ZWQgY2hhbmdlc1xuICAgICAgICAgICAgY2hyb21lLm5vdGlmaWNhdGlvbnMuY3JlYXRlKHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnYmFzaWMnLFxuICAgICAgICAgICAgICAgIGljb25Vcmw6ICdpY29ucy9pY29uLTQ4LnBuZycsXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdBSSBDb2RlIENoYW5nZXMgRGV0ZWN0ZWQnLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBGb3VuZCAke3Byb2Nlc3NSZXNwb25zZS5maWxlQ2hhbmdlcy5sZW5ndGh9IGZpbGUgY2hhbmdlcy4gQ2xpY2sgZXh0ZW5zaW9uIHRvIHJldmlldyBhbmQgYXBwbHkuYFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAvLyBTdG9yZSB0aGUgZXh0cmFjdGVkIGNoYW5nZXMgZm9yIHBvcHVwIGFjY2Vzc1xuICAgICAgICAgICAgY2hyb21lLnN0b3JhZ2UubG9jYWwuc2V0KHtcbiAgICAgICAgICAgICAgICBsYXN0RXh0cmFjdGVkQ2hhbmdlczoge1xuICAgICAgICAgICAgICAgICAgICBjaGFuZ2VzOiBwcm9jZXNzUmVzcG9uc2UuZmlsZUNoYW5nZXMsXG4gICAgICAgICAgICAgICAgICAgIHRpbWVzdGFtcDogRGF0ZS5ub3coKSxcbiAgICAgICAgICAgICAgICAgICAgcHJvdmlkZXJcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBzZW5kUmVzcG9uc2UoeyBzdWNjZXNzOiB0cnVlLCBwcm9jZXNzZWQ6IHByb2Nlc3NSZXNwb25zZSB9KTtcbiAgICB9XG4gICAgY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBwcm9jZXNzIGV4dHJhY3RlZCBjb2RlOicsIGVycm9yKTtcbiAgICAgICAgc2VuZFJlc3BvbnNlKHsgZXJyb3I6ICdGYWlsZWQgdG8gcHJvY2VzcyBleHRyYWN0ZWQgY29kZScgfSk7XG4gICAgfVxufTtcbmNvbnN0IGRldGVjdExMTVByb3ZpZGVyID0gKHVybCkgPT4ge1xuICAgIGNvbnN0IGhvc3RuYW1lID0gbmV3IFVSTCh1cmwpLmhvc3RuYW1lLnRvTG93ZXJDYXNlKCk7XG4gICAgaWYgKGhvc3RuYW1lLmluY2x1ZGVzKCdjaGF0Z3B0LmNvbScpKVxuICAgICAgICByZXR1cm4gJ29wZW5haSc7XG4gICAgaWYgKGhvc3RuYW1lLmluY2x1ZGVzKCdjbGF1ZGUuYWknKSlcbiAgICAgICAgcmV0dXJuICdhbnRocm9waWMnO1xuICAgIGlmIChob3N0bmFtZS5pbmNsdWRlcygnZ2VtaW5pLmdvb2dsZS5jb20nKSlcbiAgICAgICAgcmV0dXJuICdvcGVuYWknO1xuICAgIGlmIChob3N0bmFtZS5pbmNsdWRlcygncGVycGxleGl0eS5haScpKVxuICAgICAgICByZXR1cm4gJ29wZW5haSc7XG4gICAgaWYgKGhvc3RuYW1lLmluY2x1ZGVzKCdjaGF0Lm1pc3RyYWwuYWknKSlcbiAgICAgICAgcmV0dXJuICdvcGVuYWknO1xuICAgIGlmIChob3N0bmFtZS5pbmNsdWRlcygnaHVnZ2luZ2ZhY2UuY28nKSlcbiAgICAgICAgcmV0dXJuICdvcGVuYWknO1xuICAgIHJldHVybiAndW5rbm93bic7XG59O1xuIl0sIm5hbWVzIjpbXSwic291cmNlUm9vdCI6IiJ9