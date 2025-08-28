import { notifyDebug, notifyError, notifyInfo } from './notification';
import { CardModel, TextContent, createCard } from './cardModel';

class GoogleDocsManager {
  private accessToken: string | null = null;

  /**
   * Check if the current tab is a Google Docs document
   */
  async checkGoogleDocsTab(): Promise<boolean> {
    try {
      if (!chrome.tabs) {
        return false;
      }
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
        scopes: ['https://www.googleapis.com/auth/documents.readonly'],
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
   * Returns an array of CardModel objects (single parent with nested children)
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
          'Content-Type': 'application/json',
        },
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
      const childCards: CardModel[] = [];

      // Process document body and extract structured content
      const processContent = (content: any): void => {
        if (!content || !content.content) {
          return;
        }

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
              childCards.push(
                createCard({
                  content: { type: 'text', value: paragraphText.trim() } as TextContent,
                  componentType: isHeading ? 'Header' : 'Paragraph',
                  metadata: {
                    source: 'web',
                    url: tab.url,
                    tags: isHeading ? [`heading-level-${headingLevel}`, 'google-docs'] : ['paragraph', 'google-docs'],
                  },
                }),
              );
            }
          } else if (element.table) {
            // Create a table card with nested content
            const tableCells: CardModel[] = [];

            // Process table rows
            const processTableContent = (tableContent: any): void => {
              if (!tableContent || !tableContent.content) {
                return;
              }
              for (const elem of tableContent.content) {
                if (elem.paragraph) {
                  let cellText = '';
                  for (const paragraphElement of elem.paragraph.elements || []) {
                    if (paragraphElement.textRun) {
                      cellText += paragraphElement.textRun.content || '';
                    }
                  }
                  if (cellText.trim()) {
                    tableCells.push(
                      createCard({
                        content: { type: 'text', value: cellText.trim() } as TextContent,
                        componentType: 'Paragraph',
                        metadata: {
                          source: 'web',
                          url: tab.url,
                          tags: ['table-cell', 'google-docs'],
                        },
                      }),
                    );
                  }
                }
              }
            };

            for (const row of element.table.tableRows || []) {
              for (const cell of row.tableCells || []) {
                processTableContent(cell);
              }
            }

            // Only add table if it has content
            if (tableCells.length > 0) {
              childCards.push(
                createCard({
                  content: { type: 'nested', children: tableCells },
                  componentType: 'Table',
                  metadata: {
                    source: 'web',
                    url: tab.url,
                    tags: ['table', 'google-docs'],
                  },
                }),
              );
            }
          }
        }
      };

      processContent(document.body);

      // Create a single parent card with all content as nested children
      const documentTitle = document.title && document.title.trim() ? document.title : 'Google Docs Document';
      const parentCard = createCard({
        content:
          childCards.length > 0
            ? { type: 'nested', children: childCards }
            : ({ type: 'text', value: 'No text content found in document' } as TextContent),
        componentType: 'CaptionedParagraph',
        title: documentTitle,
        metadata: {
          source: 'web',
          url: tab.url,
          tags: ['google-docs', 'document'],
        },
      });

      notifyInfo('Google Docs content extracted successfully', {
        childCardsCount: childCards.length,
      });

      return [parentCard];
    } catch (error) {
      notifyError('Error fetching Google Docs content', error);
      throw error;
    }
  }
}

// Export the manager instance for UI/popup use
export const googleDocsManager = new GoogleDocsManager();
