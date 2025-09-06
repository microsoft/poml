import { notifyDebug, notifyError, notifyInfo, notifyDebugVerbose, notifyWarning } from '@common/notification';
import { CardModel, TextCardContent, CardFromGdocOptions } from '@common/types';
import { everywhere } from '@common/rpc';

/**
 * Main function to convert Google Docs to CardModel
 */
async function _cardFromGdoc(url: string, options?: CardFromGdocOptions): Promise<CardModel> {
  const { source = 'webpage', maxElements = 1000 } = options || {};

  notifyDebugVerbose('Processing Google Docs URL:', url);

  return await googleDocsManager.fetchGoogleDocsContent(false, { maxElements, source });
}

/**
 * Convert Google Docs document to CardModel
 * Available in background context only due to Chrome Identity API requirements
 */
export const cardFromGdoc = everywhere('cardFromGdoc', _cardFromGdoc, ['background']);

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
    if (!chrome.identity) {
      throw new Error('Chrome identity API not available');
    }

    notifyDebug('Authenticating with Google');

    const authResponse = await chrome.identity.getAuthToken({
      interactive: true,
      scopes: ['https://www.googleapis.com/auth/documents.readonly'],
    });

    if (!authResponse || typeof authResponse !== 'object' || !authResponse.token) {
      notifyInfo('Failed to get access token', authResponse);
      throw new Error('Failed to get access token from Google Identity API');
    }

    this.accessToken = authResponse.token;
    notifyDebug('Google authentication successful', { token: this.accessToken });
    return authResponse.token;
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
   */
  async fetchGoogleDocsContent(isRetry: boolean = false, options: Required<CardFromGdocOptions>): Promise<CardModel> {
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

    notifyDebug('Fetching Google Docs content', { documentId });

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
        notifyWarning('Token expired, re-authenticating');
        this.accessToken = null;
        await this.authenticateGoogle();
        return this.fetchGoogleDocsContent(true, options);
      }
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const document = await response.json();
    notifyDebugVerbose('Google Docs API response', document);
    const { maxElements } = options;
    let elementCount = 0;

    const textContent: string[] = [];

    // Process document body and extract structured content
    const processContent = (content: any): void => {
      if (!content || !content.content || elementCount >= maxElements) {
        return;
      }

      for (const element of content.content) {
        if (elementCount >= maxElements) {
          break;
        }

        if (element.paragraph) {
          let paragraphText = '';

          // Extract text from paragraph elements
          for (const paragraphElement of element.paragraph.elements || []) {
            if (paragraphElement.textRun) {
              paragraphText += paragraphElement.textRun.content || '';
            }
          }

          // Only add non-empty paragraphs
          if (paragraphText.trim()) {
            textContent.push(paragraphText.trim());
            elementCount++;
          }
        }
        // Skip table processing - not supported
      }
    };

    processContent(document.body);

    // Create the main card content
    const documentTitle = document.title && document.title.trim() ? document.title : 'Google Docs Document';
    let mainContent: TextCardContent;

    if (textContent.length > 0) {
      // Text content
      mainContent = {
        type: 'text',
        text: textContent.join('\n\n'),
        caption: documentTitle,
      };
    } else {
      // No content found
      mainContent = {
        type: 'text',
        text: 'No content could be extracted from this Google Docs document.',
        caption: documentTitle,
      };
    }

    const parentCard: CardModel = {
      content: mainContent,
      source: 'webpage',
      url: tab.url,
      tags: ['google-docs', 'document'],
      timestamp: new Date(),
    };

    notifyInfo(
      `Google Docs content extracted successfully. Found ${textContent.length} text paragraphs` +
        ` and ${elementCount} total elements.`,
    );

    return parentCard;
  }
}

export const googleDocsManager = new GoogleDocsManager();
