import { notifyDebug, notifyInfo, notifyDebugVerbose, notifyWarning, notifyError } from '@common/notification';
import {
  CardModel,
  TextCardContent,
  CardFromGdocOptions,
  HeaderCardContent,
  CardContentWithHeader,
  NestedCardContent,
  CardContent,
} from '@common/types';
import { everywhere } from '@common/rpc';
import { eliminateHeaderCards } from '@common/utils/card';

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
    let skippedTables = 0;
    let skippedOtherElements = 0;

    const allCards: CardContentWithHeader[] = [];

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
            if (isHeading) {
              // Create header card
              const headerCard: HeaderCardContent = {
                type: 'header',
                text: paragraphText.trim(),
                level: headingLevel,
              };
              allCards.push(headerCard);
            } else {
              // Create text card
              const textCard: TextCardContent = {
                type: 'text',
                text: paragraphText.trim(),
              };
              allCards.push(textCard);
            }
            elementCount++;
          }
        } else if (element.table) {
          // Count but skip table processing - not supported
          skippedTables++;
        } else {
          // Count other unprocessed elements
          skippedOtherElements++;
        }
      }
    };

    processContent(document.body);

    // Notify about unprocessed elements
    if (skippedTables > 0) {
      notifyInfo(`Skipped ${skippedTables} table(s) - table processing is not currently supported`);
    }
    if (skippedOtherElements > 0) {
      notifyInfo(`Skipped ${skippedOtherElements} other element(s) (images, drawings, etc.)`);
    }

    // Create the main card content
    const documentTitle = document.title && document.title.trim() ? document.title : 'Google Docs Document';
    let mainContent: CardContent | undefined = undefined;

    if (allCards.length > 0) {
      // Use eliminateHeaderCards to merge headers with content
      const processedCards = eliminateHeaderCards(allCards);

      if (processedCards.length === 1) {
        // Single card - add document title as caption if not already set
        mainContent = processedCards[0];
        if (!mainContent.caption) {
          mainContent.caption = documentTitle;
        }
      } else if (processedCards.length > 1) {
        // Multiple cards - create nested structure
        mainContent = {
          type: 'nested',
          cards: processedCards,
          caption: documentTitle,
        };
      } else {
        // No processed cards (shouldn't happen but handle gracefully)
        notifyError('No content could be extracted after processing the Google Docs document.');
      }
    }

    if (!mainContent) {
      // No processed cards (shouldn't happen but handle gracefully)
      throw new Error('No content could be extracted after processing the Google Docs document.');
    }

    const parentCard: CardModel = {
      content: mainContent,
      source: 'webpage',
      url: tab.url,
      tags: ['google-docs', 'document'],
      timestamp: new Date(),
    };

    const headerCount = allCards.filter((card) => card.type === 'header').length;
    const textCount = allCards.filter((card) => card.type === 'text').length;

    notifyInfo(
      `Google Docs content extracted successfully. Found ${headerCount} header(s), ${textCount} text paragraph(s)` +
        ` and ${elementCount} total elements.`,
    );

    return parentCard;
  }
}

export const googleDocsManager = new GoogleDocsManager();
