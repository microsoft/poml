import { notifyDebug, notifyInfo, notifyError } from './notification';
import { CardModel, TextContent, createCard } from './cardModel';

// MS Word manager functions moved to unified contentManager in html.ts

/**
 * Cleans and normalizes text by replacing non-breaking spaces,
 * collapsing multiple whitespace characters, and trimming the result.
 */
export function cleanText(text: string | null): string {
  if (!text) {
    return '';
  }
  // Replace non-breaking spaces with regular spaces and collapse whitespace
  return text.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Extract content from Microsoft Word Online documents
 * Returns an array of CardModel objects
 */
export function extractWordContent(): CardModel[] {
  const cards: CardModel[] = [];
  
  notifyDebug('Starting Word document extraction', {
    url: document.location.href,
    title: document.title
  });
  
  // Add document title as first card if available
  const docTitle = document.title?.replace(' - Word', '').trim();
  if (docTitle && docTitle !== 'Word') {
    cards.push(createCard({
      content: { type: 'text', value: docTitle } as TextContent,
      componentType: 'Header',
      title: docTitle,
      metadata: {
        source: 'web',
        url: document.location.href,
        tags: ['document-title', 'heading-level-1']
      }
    }));
  }
  
  // Select all primary content containers, which seem to be '.OutlineElement'
  const elements = document.querySelectorAll('.OutlineElement');
  
  notifyDebug('Found OutlineElement elements', { count: elements.length });
  
  // If no OutlineElements found, try alternative selectors for Word content
  if (elements.length === 0) {
    notifyDebug('No OutlineElement found, trying alternative selectors');
    
    // Try other common Word Online selectors
    const alternativeSelectors = [
      '.Paragraph',
      '[role="document"] p',
      '.DocumentFragment p',
      '.Page p',
      'p',
      'div[contenteditable="true"] *',
      '[data-automation-id="documentCanvas"] *'
    ];
    
    for (const selector of alternativeSelectors) {
      const altElements = document.querySelectorAll(selector);
      
      if (altElements.length > 0) {
        notifyDebug(`Found elements with selector: ${selector}`, { 
          count: altElements.length 
        });
        
        // Process these elements directly as paragraphs
        altElements.forEach(element => {
          const content = cleanText(element.textContent);
          if (content) {
            // Check if it's a heading
            if (element.getAttribute('role') === 'heading' || 
                element.tagName.match(/^H[1-6]$/)) {
              const level = element.tagName.match(/^H([1-6])$/) ? 
                parseInt(element.tagName.charAt(1)) : 
                parseInt(element.getAttribute('aria-level') || '1', 10);
              
              cards.push(createCard({
                content: { type: 'text', value: content } as TextContent,
                componentType: 'Header',
                metadata: {
                  source: 'web',
                  url: document.location.href,
                  tags: [`heading-level-${level}`]
                }
              }));
            } else {
              cards.push(createCard({
                content: { type: 'text', value: content } as TextContent,
                componentType: 'Paragraph',
                metadata: {
                  source: 'web',
                  url: document.location.href
                }
              }));
            }
          }
        });
        break; // Stop after finding the first working selector
      }
    }
  } else {
    // Process OutlineElements as originally intended
    elements.forEach(element => {
      // Check for Images
      const imageEl = element.querySelector('image');
      if (imageEl && imageEl.getAttribute('href')) {
        cards.push(createCard({
          content: {
            type: 'file',
            url: imageEl.getAttribute('href')!,
            name: 'Document image',
            mimeType: 'image/png'
          },
          componentType: 'Image',
          metadata: {
            source: 'web',
            url: document.location.href
          }
        }));
        return;
      }

      // Check for Paragraphs and Headers
      const p = element.querySelector('p.Paragraph');
      if (p) {
        const content = cleanText(p.textContent);

        // Skip empty or whitespace-only paragraphs
        if (!content) {
          return;
        }
        
        // Check if the paragraph is a header
        if (p.getAttribute('role') === 'heading') {
          const level = parseInt(p.getAttribute('aria-level') || '1', 10);
          cards.push(createCard({
            content: { type: 'text', value: content } as TextContent,
            componentType: 'Header',
            metadata: {
              source: 'web',
              url: document.location.href,
              tags: [`heading-level-${level}`]
            }
          }));
        } else {
          // Otherwise, it's a standard paragraph (or list item)
          cards.push(createCard({
            content: { type: 'text', value: content } as TextContent,
            componentType: 'Paragraph',
            metadata: {
              source: 'web',
              url: document.location.href
            }
          }));
        }
      }
    });
  }

  notifyInfo('Word document extraction completed', { 
    cardsCount: cards.length 
  });
  
  return cards;
}

/**
 * Check if the current page is a Word Online document
 */
export function isWordDocument(): boolean {
  // Check for Word Online specific indicators
  try {
    const wordPatterns = [
      /sharepoint\.com.*\/_layouts\/15\/Doc.aspx/,
      /office\.com.*\/edit/,
      /onedrive\.live\.com.*\/edit/,
      /sharepoint\.com.*\/edit/,
      /officeapps\.live\.com\/we\/wordeditorframe\.aspx/,
      /word-edit\.officeapps\.live\.com/
    ];

    return wordPatterns.some(pattern => pattern.test(document.location.pathname));
  } catch (error) {
    notifyError('Error checking for Word document.', error);
    return false;
  }
}

/**
 * Main extraction function for Word documents
 * Returns CardModel array
 */
export function extractWordDocumentContent(): CardModel[] {
  try {
    return extractWordContent();
  } catch (error) {
    notifyError('Failed to extract Word document content', error);
    throw error;
  }
}