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
        chrome.runtime.sendMessage({
          action: 'extractContent',
          tabId: tab.id
        }, {}, (response?: any) => {
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
        });
      });
    } catch (error) {
      notifyError('Error fetching content', error);
      throw error;
    }
  }
};

// Export for backward compatibility - will be removed
export const extractPageContent = contentManager.fetchContent;

/**
 * Extract content from a regular HTML page using Readability
 * Returns an array of CardModel objects
 */
export async function extractHtmlContent(): Promise<CardModel[]> {
  const cards: CardModel[] = [];
  
  try {
    notifyDebug('Starting HTML content extraction', {
      url: document.location.href,
      title: document.title
    });
    
    // Get fallback content first
    const fallbackTitle = document.title || 'Untitled';
    const fallbackContent = document.body ? 
      (document.body.innerText || document.body.textContent || '') : '';
    
    notifyDebug('Fallback content prepared', { 
      contentLength: fallbackContent.length 
    });
    
    // If we have no fallback content, return early
    if (!fallbackContent.trim()) {
      notifyWarning('No text content found on this page');
      return [createCard({
        content: { type: 'text', value: 'No text content found on this page' } as TextContent,
        componentType: 'Paragraph',
        metadata: {
          source: 'web',
          url: document.location.href,
          tags: ['empty', 'fallback']
        }
      })];
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
      classesToPreserve: []
    });
    
    const article = reader.parse();
    
    if (article && article.textContent && article.textContent.trim()) {
      notifyInfo('Readability extraction successful', {
        titleLength: article.title?.length || 0,
        contentLength: article.textContent.length,
        hasExcerpt: !!article.excerpt
      });
      
      // Add title card if available
      if (article.title && article.title !== fallbackTitle) {
        cards.push(createCard({
          content: { type: 'text', value: article.title } as TextContent,
          componentType: 'Header',
          title: article.title,
          metadata: {
            source: 'web',
            url: document.location.href,
            tags: ['article-title', 'readability']
          }
        }));
      }
      
      // Add main content as paragraphs (split by double newlines for better structure)
      const paragraphs = article.textContent.split(/\n\n+/).filter(p => p.trim());
      paragraphs.forEach((paragraph, index) => {
        cards.push(createCard({
          content: { type: 'text', value: paragraph.trim() } as TextContent,
          componentType: 'Paragraph',
          metadata: {
            source: 'web',
            url: document.location.href,
            excerpt: index === 0 && article.excerpt ? article.excerpt : undefined,
            tags: ['readability', `paragraph-${index + 1}`]
          }
        }));
      });
      
    } else {
      notifyWarning('Readability failed, using fallback text extraction');
      
      // Add title card
      if (fallbackTitle && fallbackTitle !== 'Untitled') {
        cards.push(createCard({
          content: { type: 'text', value: fallbackTitle } as TextContent,
          componentType: 'Header',
          title: fallbackTitle,
          metadata: {
            source: 'web',
            url: document.location.href,
            tags: ['page-title', 'fallback']
          }
        }));
      }
      
      // Add content as a single card (or split if very long)
      const maxLength = 5000; // Split long content into chunks
      if (fallbackContent.length > maxLength) {
        const chunks = [];
        for (let i = 0; i < fallbackContent.length; i += maxLength) {
          chunks.push(fallbackContent.substring(i, i + maxLength));
        }
        chunks.forEach((chunk, index) => {
          cards.push(createCard({
            content: { type: 'text', value: chunk } as TextContent,
            componentType: 'Paragraph',
            metadata: {
              source: 'web',
              url: document.location.href,
              tags: ['fallback', `chunk-${index + 1}`]
            }
          }));
        });
      } else {
        cards.push(createCard({
          content: { type: 'text', value: fallbackContent } as TextContent,
          componentType: 'Paragraph',
          metadata: {
            source: 'web',
            url: document.location.href,
            excerpt: fallbackContent.substring(0, 200) + (fallbackContent.length > 200 ? '...' : ''),
            tags: ['fallback']
          }
        }));
      }
    }
    
  } catch (error) {
    notifyError('Error in HTML content extraction', error);
    
    // Return error card
    return [createCard({
      content: { 
        type: 'text', 
        value: `Failed to extract HTML content: ${error instanceof Error ? error.message : String(error)}`
      } as TextContent,
      componentType: 'Paragraph',
      metadata: {
        source: 'web',
        url: document.location.href,
        tags: ['error', 'html']
      }
    })];
  }
  
  notifyInfo('HTML extraction completed', { 
    cardsCount: cards.length 
  });
  
  return cards;
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