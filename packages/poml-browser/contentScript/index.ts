import { extractPdfContent, isPdfDocument } from '../functions/pdf';
import { extractHtmlContent } from '../functions/html';
import { extractWordContent, isWordDocument } from '../functions/msword';
import { notifyInfo, notifyError } from '../functions/notification';
import { CardModel } from '../functions/cardModel';

/**
 * Main content extraction function that determines the appropriate extraction method
 * Returns an array of CardModel objects
 */
async function extractContent(): Promise<CardModel[]> {
  try {
    notifyInfo('Content extractor script loaded', {
      url: document.location.href,
      title: document.title
    });
    
    // Check if this is a PDF document
    if (isPdfDocument()) {
      notifyInfo('PDF detected, attempting PDF text extraction');
      return await extractPdfContent(document.location.href);
    }
    
    // Check if this is a Word document
    if (isWordDocument()) {
      notifyInfo('Word document detected, extracting content');
      return extractWordContent();
    }
    
    // Otherwise, extract as regular HTML
    notifyInfo('Extracting HTML content');
    return await extractHtmlContent();
    
  } catch (error) {
    notifyError('Error in content extractor', error);
    
    // Return error card
    return [{
      id: `error-${Date.now()}`,
      title: 'Extraction Error',
      content: { 
        type: 'text', 
        value: error instanceof Error ? error.message : String(error)
      },
      componentType: 'Paragraph',
      metadata: {
        source: 'web',
        url: document.location.href,
        tags: ['error']
      }
    }];
  }
}

// Make the function globally available when loaded as a script
declare global {
  interface Window {
    extractContent: () => Promise<CardModel[]>;
    convertDomToMarkup: () => CardModel[];
  }
}

(window as any).extractContent = extractContent;

// Keep the convertDomToMarkup for backward compatibility
(window as any).convertDomToMarkup = () => {
  notifyInfo('convertDomToMarkup called - delegating to Word extraction');
  return extractWordContent();
};