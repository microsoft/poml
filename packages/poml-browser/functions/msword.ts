class MsWordManager {
  async checkMsWordTab(): Promise<boolean> {
    try {
      if (!chrome.tabs) { return false; }
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url) { return false; }

      const wordPatterns = [
        /sharepoint\.com.*\/_layouts\/15\/Doc.aspx/,
        /office\.com.*\/edit/,
        /onedrive\.live\.com.*\/edit/,
        /sharepoint\.com.*\/edit/,
        /officeapps\.live\.com\/we\/wordeditorframe\.aspx/,
        /word-edit\.officeapps\.live\.com/
      ];
      
      return wordPatterns.some(pattern => pattern.test(tab.url!));
    } catch (error) {
      console.error('Error checking MS Word tab:', error);
      return false;
    }
  }

  async fetchMsWordContent(): Promise<string> {
    try {
      if (!chrome.tabs || !chrome.runtime) {
        throw new Error('Chrome extension APIs not available');
      }

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab || !tab.url) {
        throw new Error('No active tab found');
      }

      const isMsWordTab = await this.checkMsWordTab();
      if (!isMsWordTab) {
        throw new Error('No MS Word document tab found');
      }

      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        throw new Error('Cannot extract content from chrome:// or extension pages');
      }

      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'extractMsWordContent',
          tabId: tab.id
        }, {}, (response?: any) => {
          if ((chrome.runtime as any).lastError) {
            reject(new Error(`Background script error: ${(chrome.runtime as any).lastError.message}`));
            return;
          }
          
          if (response && response.success) {
            resolve(response.content);
          } else {
            reject(new Error(response?.error || 'Unknown error extracting MS Word content'));
          }
        });
      });
    } catch (error) {
      console.error('Error fetching MS Word content:', error);
      throw error;
    }
  }
}

export const msWordManager = new MsWordManager();