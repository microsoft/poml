import { Readability } from '@mozilla/readability';
import { notifyDebug, notifyError, notifyInfo, notifyWarning } from './notification';
import { CardModel, TextContent, createCard } from './cardModel';

/**
 * Unified content manager for all document types (HTML, PDF, Word)
 * Used by UI/popup to extract content from any supported document type
 */
export const contentManager = {
  /**
   * Request content extraction from the current tab via background service worker
   * The content script will automatically detect the document type (HTML, PDF, Word)
   * Returns an array of CardModel objects
   */
  async fetchContent(): Promise<CardModel[]> {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.id) {
        throw new Error('No active tab found');
      }

      if (!tab.url) {
        throw new Error('No URL found for current tab');
      }

      // Check for restricted URLs
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        throw new Error('Cannot extract content from chrome:// or extension pages');
      }

      notifyInfo('Requesting content extraction');

      // Send message to background script to extract content
      // The background script will inject content script which auto-detects document type
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            action: 'extractContent',
            tabId: tab.id,
          },
          {},
          (response?: any) => {
            if ((chrome.runtime as any).lastError) {
              reject(new Error(`Background script error: ${(chrome.runtime as any).lastError.message}`));
              return;
            }

            if (response && response.success) {
              notifyInfo('Content extracted successfully');
              resolve(response.content);
            } else {
              reject(new Error(response?.error || 'Unknown error extracting content'));
            }
          },
        );
      });
    } catch (error) {
      notifyError('Error fetching content', error);
      throw error;
    }
  },
};

// Export for backward compatibility - will be removed
export const extractPageContent = contentManager.fetchContent;

/**
 * Extract content from a regular HTML page using Readability
 * Returns an array of CardModel objects (single parent with nested children)
 */
export async function extractHtmlContent(): Promise<CardModel[]> {
  const childCards: CardModel[] = [];

  try {
    notifyDebug('Starting HTML content extraction', {
      url: document.location.href,
      title: document.title,
    });

    // Get fallback content first
    const fallbackTitle = document.title || 'Untitled';
    const fallbackContent = document.body ? document.body.innerText || document.body.textContent || '' : '';

    notifyDebug('Fallback content prepared', {
      contentLength: fallbackContent.length,
    });

    // If we have no fallback content, prepare to return empty document
    if (!fallbackContent.trim()) {
      notifyWarning('No text content found on this page');
      const emptyCard = createCard({
        content: { type: 'text', value: 'No text content found on this page' } as TextContent,
        componentType: 'CaptionedParagraph',
        title: fallbackTitle,
        metadata: {
          source: 'web',
          url: document.location.href,
          tags: ['empty', 'fallback', 'document'],
        },
      });
      return [emptyCard];
    }

    // Try to use Readability for better extraction
    notifyDebug('Attempting Readability extraction');

    // Create a clone of the document to avoid modifying the original
    const documentClone = document.cloneNode(true) as Document;

    // Use Readability to extract main content
    const reader = new Readability(documentClone, {
      debug: false,
      nbTopCandidates: 5,
      charThreshold: 500,
      classesToPreserve: [],
    });

    const article = reader.parse();

    if (article && article.textContent && article.textContent.trim()) {
      notifyInfo('Readability extraction successful', {
        titleLength: article.title?.length || 0,
        contentLength: article.textContent.length,
        hasExcerpt: !!article.excerpt,
      });

      // Add main content as paragraphs (split by double newlines for better structure)
      const paragraphs = article.textContent.split(/\n\n+/).filter((p) => p.trim());
      paragraphs.forEach((paragraph, index) => {
        childCards.push(
          createCard({
            content: { type: 'text', value: paragraph.trim() } as TextContent,
            componentType: 'Paragraph',
            metadata: {
              source: 'web',
              url: document.location.href,
              excerpt: index === 0 && article.excerpt ? article.excerpt : undefined,
              tags: ['readability', `paragraph-${index + 1}`],
            },
          }),
        );
      });

      // Use article title if available
      const documentTitle = article.title || fallbackTitle;

      // Create parent card with Readability content
      const parentCard = createCard({
        content: { type: 'nested', children: childCards },
        componentType: 'CaptionedParagraph',
        title: documentTitle,
        metadata: {
          source: 'web',
          url: document.location.href,
          tags: ['html', 'readability', 'document'],
        },
      });

      notifyInfo('HTML extraction completed', {
        childCardsCount: childCards.length,
      });

      return [parentCard];
    } else {
      notifyWarning('Readability failed, using fallback text extraction');

      // Add content as paragraphs (or split if very long)
      const maxLength = 5000; // Split long content into chunks
      if (fallbackContent.length > maxLength) {
        const chunks = [];
        for (let i = 0; i < fallbackContent.length; i += maxLength) {
          chunks.push(fallbackContent.substring(i, i + maxLength));
        }
        chunks.forEach((chunk, index) => {
          childCards.push(
            createCard({
              content: { type: 'text', value: chunk } as TextContent,
              componentType: 'Paragraph',
              metadata: {
                source: 'web',
                url: document.location.href,
                tags: ['fallback', `chunk-${index + 1}`],
              },
            }),
          );
        });
      } else {
        childCards.push(
          createCard({
            content: { type: 'text', value: fallbackContent } as TextContent,
            componentType: 'Paragraph',
            metadata: {
              source: 'web',
              url: document.location.href,
              excerpt: fallbackContent.substring(0, 200) + (fallbackContent.length > 200 ? '...' : ''),
              tags: ['fallback'],
            },
          }),
        );
      }
    }

    // Create parent card with fallback content
    const parentCard = createCard({
      content:
        childCards.length > 0
          ? { type: 'nested', children: childCards }
          : ({ type: 'text', value: 'No content extracted' } as TextContent),
      componentType: 'CaptionedParagraph',
      title: fallbackTitle,
      metadata: {
        source: 'web',
        url: document.location.href,
        tags: ['html', 'fallback', 'document'],
      },
    });

    notifyInfo('HTML extraction completed', {
      childCardsCount: childCards.length,
    });

    return [parentCard];
  } catch (error) {
    notifyError('Error in HTML content extraction', error);

    // Return error card
    return [
      createCard({
        content: {
          type: 'text',
          value: `Failed to extract HTML content: ${error instanceof Error ? error.message : String(error)}`,
        } as TextContent,
        componentType: 'CaptionedParagraph',
        title: 'Error',
        metadata: {
          source: 'web',
          url: document.location.href,
          tags: ['error', 'html', 'document'],
        },
      }),
    ];
  }
}

/**
 * Main extraction function for HTML documents
 */
export async function extractHtmlDocumentContent(): Promise<CardModel[]> {
  try {
    return await extractHtmlContent();
  } catch (error) {
    notifyError('Failed to extract HTML document content', error);
    throw error;
  }
}
