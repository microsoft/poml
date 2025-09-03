import { extractPdfContentVisualized, PageVisualization, isPdfDocument } from '../functions/pdf';
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
      title: document.title,
    });

    // Check if this is a PDF document
    if (isPdfDocument()) {
      notifyInfo('PDF detected, attempting PDF text extraction with visualization');
      const result = await extractPdfContentVisualized(document.location.href, true);
      // Store visualizations globally for later access
      (window as any).pdfVisualizations = result.visualizations;
      return result.cards;
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
    return [
      {
        id: `error-${Date.now()}`,
        title: 'Extraction Error',
        content: {
          type: 'text',
          value: error instanceof Error ? error.message : String(error),
        },
        componentType: 'Paragraph',
        metadata: {
          source: 'web',
          url: document.location.href,
          tags: ['error'],
        },
      },
    ];
  }
}

// Make the function globally available when loaded as a script
declare global {
  interface Window {
    extractContent: () => Promise<CardModel[]>;
    extractPdfContentVisualized: () => Promise<{ cards: CardModel[]; visualizations: PageVisualization[] }>;
  }
}

(window as any).extractContent = extractContent;

// For debugging purposes
(window as any).extractPdfContentVisualized = async () => {
  return await extractPdfContentVisualized(document.location.href, true);
};
