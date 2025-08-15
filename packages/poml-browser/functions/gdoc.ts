import { notifyDebug, notifyError, notifyInfo } from './notification';
import { CardModel, TextContent, createCard } from './cardModel';

class GoogleDocsManager {
  private accessToken: string | null = null;

  /**
   * Check if the current tab is a Google Docs document
   */
  async checkGoogleDocsTab(): Promise<boolean> {
    try {
      if (!chrome.tabs) { return false; }
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return (tab && tab.url && tab.url.includes('docs.google.com/document')) || false;
    } catch (error) {
      notifyDebug('Error checking Google Docs tab', error);
      return false;
    }
  }

  /**
   * Authenticate with Google and get access token
   */
  private async authenticateGoogle(): Promise<string> {
    try {
      if (!chrome.identity) {
        throw new Error('Chrome identity API not available');
      }

      notifyInfo('Authenticating with Google');

      const authResponse = await chrome.identity.getAuthToken({ 
        interactive: true,
        scopes: ['https://www.googleapis.com/auth/documents.readonly']
      });

      if (!authResponse || typeof authResponse !== 'object' || !authResponse.token) {
        notifyError('Failed to get access token', authResponse);
        throw new Error('Failed to get access token');
      }

      this.accessToken = authResponse.token;
      notifyInfo('Google authentication successful');
      return authResponse.token;
    } catch (error) {
      notifyError('Authentication failed', error);
      throw error;
    }
  }

  /**
   * Extract document ID from Google Docs URL
   */
  private extractDocumentId(url: string): string | null {
    const match = url.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  }

  /**
   * Fetch content from Google Docs using API
   * Note: This runs in the extension context, not as a content script
   * Returns an array of CardModel objects
   */
  async fetchGoogleDocsContent(isRetry: boolean = false): Promise<CardModel[]> {
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

      notifyInfo('Fetching Google Docs content', { documentId });

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
          notifyInfo('Token expired, re-authenticating');
          this.accessToken = null;
          await this.authenticateGoogle();
          return this.fetchGoogleDocsContent(true);
        }
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const document = await response.json();
      const cards: CardModel[] = [];
      
      // Add document title as header if available
      if (document.title && document.title.trim()) {
        cards.push(createCard({
          content: { type: 'text', value: document.title } as TextContent,
          componentType: 'Header',
          title: document.title,
          metadata: {
            source: 'web',
            url: tab.url,
            tags: ['document-title', 'google-docs']
          }
        }));
      }
      
      // Process document body and extract structured content
      const processContent = (content: any, parentId?: string | null): void => {
        if (!content || !content.content) return;
        
        for (const element of content.content) {
          if (element.paragraph) {
            let paragraphText = '';
            let isHeading = false;
            let headingLevel = 0;
            
            // Check for heading style
            if (element.paragraph.paragraphStyle?.namedStyleType) {
              const styleType = element.paragraph.paragraphStyle.namedStyleType;
              if (styleType.startsWith('HEADING_')) {
                isHeading = true;
                headingLevel = parseInt(styleType.replace('HEADING_', ''), 10);
              }
            }
            
            // Extract text from paragraph elements
            for (const paragraphElement of element.paragraph.elements || []) {
              if (paragraphElement.textRun) {
                paragraphText += paragraphElement.textRun.content || '';
              }
            }
            
            // Only add non-empty paragraphs
            if (paragraphText.trim()) {
              cards.push(createCard({
                content: { type: 'text', value: paragraphText.trim() } as TextContent,
                componentType: isHeading ? 'Header' : 'Paragraph',
                parentId,
                metadata: {
                  source: 'web',
                  url: tab.url,
                  tags: isHeading ? [`heading-level-${headingLevel}`, 'google-docs'] : ['paragraph', 'google-docs']
                }
              }));
            }
          } else if (element.table) {
            // Create a table card with nested content
            const tableCard = createCard({
              content: { type: 'nested', children: [] },
              componentType: 'Table',
              parentId,
              metadata: {
                source: 'web',
                url: tab.url,
                tags: ['table', 'google-docs']
              }
            });
            
            // Process table rows
            for (const row of element.table.tableRows || []) {
              for (const cell of row.tableCells || []) {
                processContent(cell, tableCard.id);
              }
            }
            
            // Only add table if it has content
            if ((tableCard.content as any).children?.length > 0) {
              cards.push(tableCard);
            }
          }
        }
      };

      processContent(document.body);
      
      if (cards.length === 0) {
        // If no structured content found, return a single card with error message
        cards.push(createCard({
          content: { type: 'text', value: 'No text content found in document' } as TextContent,
          componentType: 'Paragraph',
          metadata: {
            source: 'web',
            url: tab.url,
            tags: ['empty', 'google-docs']
          }
        }));
      }

      notifyInfo('Google Docs content extracted successfully', { 
        cardsCount: cards.length 
      });

      return cards;
    } catch (error) {
      notifyError('Error fetching Google Docs content', error);
      throw error;
    }
  }
}

// Export the manager instance for UI/popup use
export const googleDocsManager = new GoogleDocsManager();

/**
 * Content script functions (used when injected by service worker).
 * Extract content from Google Docs by parsing the DOM.
 * This function is used when injected as a content script.
 * Note: This is a fallback method when API access is not available.
 * Returns an array of CardModel objects
 */
export function extractGoogleDocsContentFromDOM(): CardModel[] {
  try {
    notifyDebug('Starting Google Docs DOM extraction');
    const cards: CardModel[] = [];
    
    // Add document title as header if available
    const title = document.title.replace(' - Google Docs', '').trim();
    if (title && title !== 'Untitled document') {
      cards.push(createCard({
        content: { type: 'text', value: title } as TextContent,
        componentType: 'Header',
        title: title,
        metadata: {
          source: 'web',
          url: document.location.href,
          tags: ['document-title', 'google-docs']
        }
      }));
    }
    
    // Try to find the main content container
    const contentSelectors = [
      '.kix-page-content-wrapper',
      '.kix-document-top-shadow-inner',
      '.kix-page',
      '[role="textbox"]',
      '.docs-texteventtarget-iframe'
    ];
    
    let contentExtracted = false;
    
    for (const selector of contentSelectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        notifyDebug(`Found Google Docs content with selector: ${selector}`, { 
          count: elements.length 
        });
        
        elements.forEach(element => {
          const text = element.textContent?.trim();
          if (text) {
            // Split content into paragraphs for better structure
            const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
            paragraphs.forEach((paragraph, index) => {
              cards.push(createCard({
                content: { type: 'text', value: paragraph.trim() } as TextContent,
                componentType: 'Paragraph',
                metadata: {
                  source: 'web',
                  url: document.location.href,
                  tags: ['google-docs', `paragraph-${index + 1}`]
                }
              }));
            });
            contentExtracted = true;
          }
        });
        
        if (contentExtracted) {
          break;
        }
      }
    }
    
    // If no content found with specific selectors, try fallback
    if (!contentExtracted) {
      notifyDebug('Using fallback extraction for Google Docs');
      const fallbackContent = document.body?.innerText || document.body?.textContent || '';
      
      if (fallbackContent.trim()) {
        // Split fallback content into paragraphs
        const paragraphs = fallbackContent.split(/\n\n+/).filter(p => p.trim());
        paragraphs.forEach((paragraph, index) => {
          cards.push(createCard({
            content: { type: 'text', value: paragraph.trim() } as TextContent,
            componentType: 'Paragraph',
            metadata: {
              source: 'web',
              url: document.location.href,
              tags: ['google-docs', 'fallback', `paragraph-${index + 1}`]
            }
          }));
        });
      }
    }
    
    // If still no cards, add an empty message
    if (cards.length === 0) {
      cards.push(createCard({
        content: { type: 'text', value: 'No content found in Google Docs document' } as TextContent,
        componentType: 'Paragraph',
        metadata: {
          source: 'web',
          url: document.location.href,
          tags: ['empty', 'google-docs']
        }
      }));
    }
    
    notifyInfo('Google Docs DOM extraction completed', { 
      cardsCount: cards.length 
    });
    
    return cards;
  } catch (error) {
    notifyError('Failed to extract Google Docs content from DOM', error);
    throw error;
  }
}

/**
 * Check if the current page is a Google Docs document
 */
export function isGoogleDocsDocument(): boolean {
  return document.location.hostname === 'docs.google.com' && 
         document.location.pathname.includes('/document/');
}

/**
 * Main extraction function for Google Docs when injected as content script
 * This tries DOM extraction as a fallback when API is not available
 * Returns CardModel array
 */
export function extractGoogleDocsDocumentContent(): CardModel[] {
  try {
    if (!isGoogleDocsDocument()) {
      throw new Error('Not a Google Docs document');
    }
    
    return extractGoogleDocsContentFromDOM();
  } catch (error) {
    notifyError('Failed to extract Google Docs document content', error);
    throw error;
  }
}