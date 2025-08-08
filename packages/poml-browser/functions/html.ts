export const extractPageContent = async (): Promise<string> => {
  try {
    if (!chrome.tabs || !chrome.runtime) {
      throw new Error('Chrome extension APIs not available');
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.url) {
      throw new Error('No active tab found');
    }

    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      throw new Error('Cannot extract content from chrome:// or extension pages');
    }

    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'extractPageContent',
        tabId: tab.id
      }, {}, (response?: any) => {
        if ((chrome.runtime as any).lastError) {
          reject(new Error(`Background script error: ${(chrome.runtime as any).lastError.message}`));
          return;
        }
        
        if (response && response.success) {
          resolve(response.content);
        } else {
          reject(new Error(response?.error || 'Unknown error extracting content'));
        }
      });
    });
  } catch (error) {
    console.error('Error extracting page content:', error);
    throw error;
  }
};