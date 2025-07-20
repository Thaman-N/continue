// Extend Chrome API types if needed
declare namespace chrome {
  namespace runtime {
    const onInstalled: chrome.events.Event<() => void>;
    const onMessage: chrome.events.Event<(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => void>;
    function sendMessage(message: any): Promise<any>;
  }
}
