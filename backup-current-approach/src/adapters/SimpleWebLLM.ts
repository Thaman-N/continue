// Simplified Web Interface LLM adapter for initial integration
import {
  ChatMessage,
  LLMFullCompletionOptions,
  CompletionOptions
} from '../core-types';

interface WebInterfaceResponse {
  success: boolean;
  content?: string;
  error?: string;
}

export class SimpleWebLLM {
  constructor(
    public model: string = 'claude-3-5-sonnet',
    public title: string = 'Web Interface LLM'
  ) {}

  // Simple chat method
  async chat(
    messages: ChatMessage[],
    options?: LLMFullCompletionOptions
  ): Promise<ChatMessage> {
    try {
      // Convert messages to a formatted prompt
      const formattedPrompt = this.formatMessagesForWebInterface(messages);
      
      // Send to content script via extension messaging
      const response = await this.sendToWebInterface({
        type: 'chat',
        prompt: formattedPrompt,
        model: this.model,
        options: options
      });

      if (!response.success || !response.content) {
        throw new Error(response.error || 'Failed to get response from web interface');
      }

      return {
        role: 'assistant',
        content: response.content
      };
    } catch (error) {
      console.error('Error in SimpleWebLLM.chat:', error);
      throw error;
    }
  }

  // Utility methods
  private formatMessagesForWebInterface(messages: ChatMessage[]): string {
    return messages.map(msg => {
      const role = msg.role === 'user' ? 'Human' : 'Assistant';
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      return `${role}: ${content}`;
    }).join('\n\n');
  }

  private async sendToWebInterface(request: any): Promise<WebInterfaceResponse> {
    return new Promise((resolve, reject) => {
      try {
        // Send message to content script
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (!tabs[0]?.id) {
            reject(new Error('No active tab found'));
            return;
          }

          chrome.tabs.sendMessage(
            tabs[0].id,
            {
              type: 'LLM_REQUEST',
              data: request
            },
            (response) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
              }

              if (!response) {
                reject(new Error('No response from content script'));
                return;
              }

              resolve(response);
            }
          );
        });
      } catch (error) {
        reject(error);
      }
    });
  }
}

// Factory functions
export function createClaudeWebLLM(): SimpleWebLLM {
  return new SimpleWebLLM('claude-3-5-sonnet', 'Claude 3.5 Sonnet (Web)');
}

export function createChatGPTWebLLM(): SimpleWebLLM {
  return new SimpleWebLLM('gpt-4', 'GPT-4 (Web)');
}