class GoogleDocsManager {
  private accessToken: string | null = null;

  async checkGoogleDocsTab(): Promise<boolean> {
    try {
      if (!chrome.tabs) { return false; }
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return (tab && tab.url && tab.url.includes('docs.google.com/document')) || false;
    } catch (error) {
      console.error('Error checking tab:', error);
      return false;
    }
  }

  private async authenticateGoogle(): Promise<string> {
    try {
      if (!chrome.identity) {
        throw new Error('Chrome identity API not available');
      }

      const authResponse = await chrome.identity.getAuthToken({ 
        interactive: true,
        scopes: ['https://www.googleapis.com/auth/documents.readonly']
      });

      if (!authResponse || typeof authResponse !== 'object' || !authResponse.token) {
        console.error('Failed to get access token:', authResponse);
        throw new Error('Failed to get access token');
      }

      this.accessToken = authResponse.token;
      return authResponse.token;
    } catch (error) {
      console.error('Authentication failed:', error);
      throw error;
    }
  }

  private extractDocumentId(url: string): string | null {
    const match = url.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  }

  async fetchGoogleDocsContent(isRetry: boolean = false): Promise<string> {
    try {
      if (!chrome.tabs) {
        throw new Error('Chrome extension APIs not available');
      }

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab || !tab.url || !tab.url.includes('docs.google.com/document')) {
        throw new Error('No Google Docs document tab found');
      }

      const documentId = this.extractDocumentId(tab.url);
      if (!documentId) {
        throw new Error('Could not extract document ID from URL');
      }

      if (!this.accessToken) {
        await this.authenticateGoogle();
      }

      const apiUrl = `https://docs.googleapis.com/v1/documents/${documentId}`;
      
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401 && !isRetry) {
          this.accessToken = null;
          await this.authenticateGoogle();
          return this.fetchGoogleDocsContent(true);
        }
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const document = await response.json();
      
      const extractTextFromContent = (content: any): string => {
        if (!content || !content.content) return '';
        
        let text = '';
        for (const element of content.content) {
          if (element.paragraph) {
            for (const paragraphElement of element.paragraph.elements || []) {
              if (paragraphElement.textRun) {
                text += paragraphElement.textRun.content || '';
              }
            }
          } else if (element.table) {
            for (const row of element.table.tableRows || []) {
              for (const cell of row.tableCells || []) {
                text += extractTextFromContent(cell);
              }
            }
          }
        }
        return text;
      };

      const textContent = extractTextFromContent(document.body);
      
      if (!textContent.trim()) {
        throw new Error('No text content found in document');
      }

      return textContent;
    } catch (error) {
      console.error('Error fetching Google Docs content:', error);
      throw error;
    }
  }
}

export const googleDocsManager = new GoogleDocsManager();