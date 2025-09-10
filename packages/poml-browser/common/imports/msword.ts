import { notifyDebug, notifyInfo, notifyDebugVerbose } from '@common/notification';
import {
  CardModel,
  TextCardContent,
  CardFromMswordOptions,
  HeaderCardContent,
  CardContentWithHeader,
  CardContent,
} from '@common/types';
import { everywhere } from '@common/rpc';
import { createCard, eliminateHeaderCards } from '@common/utils/card';

/**
 * Main function to convert MS Word document to CardModel
 */
async function _cardFromMsword(options?: CardFromMswordOptions): Promise<CardModel> {
  const { source = 'webpage', maxElements = 1000, includeImages = false } = options || {};

  notifyDebugVerbose('Processing MS Word document');

  return await extractWordContent({ maxElements, includeImages, source });
}

/**
 * Convert MS Word document to CardModel
 * Available in content script context only
 */
export const cardFromMsword = everywhere('cardFromMsword', _cardFromMsword, ['content']);

/**
 * Cleans and normalizes text by replacing non-breaking spaces,
 * collapsing multiple whitespace characters, and trimming the result.
 */
export function cleanText(text: string | null): string {
  if (!text) {
    return '';
  }
  // Replace non-breaking spaces with regular spaces and collapse whitespace
  return text
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract content from Microsoft Word Online documents
 */
async function extractWordContent(options: Required<CardFromMswordOptions>): Promise<CardModel> {
  const { maxElements, includeImages, source } = options;
  let elementCount = 0;
  let skippedImages = 0;

  const allCards: CardContentWithHeader[] = [];

  notifyDebug('Starting Word document extraction', {
    url: document.location.href,
    title: document.title,
  });

  // Extract document title
  const docTitle = document.title?.replace(' - Word', '').trim();
  const documentTitle = docTitle && docTitle !== 'Word' ? docTitle : 'Word Document';

  // Select all primary content containers, which seem to be '.OutlineElement'
  const elements = document.querySelectorAll('.OutlineElement');

  notifyDebug(`Found ${elements.length} OutlineElement elements`);

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
      '[data-automation-id="documentCanvas"] *',
    ];

    for (const selector of alternativeSelectors) {
      const altElements = document.querySelectorAll(selector);

      if (altElements.length > 0) {
        notifyDebug(`Found elements with selector: ${selector}`, {
          count: altElements.length,
        });

        // Process these elements directly as paragraphs
        for (const element of Array.from(altElements)) {
          if (elementCount >= maxElements) {
            break;
          }

          const content = cleanText(element.textContent);
          if (content) {
            // Check if it's a heading
            if (element.getAttribute('role') === 'heading' || element.tagName.match(/^H[1-6]$/)) {
              const level = element.tagName.match(/^H([1-6])$/)
                ? parseInt(element.tagName.charAt(1))
                : parseInt(element.getAttribute('aria-level') || '1', 10);

              const headerCard: HeaderCardContent = {
                type: 'header',
                text: content,
                level: level,
              };
              allCards.push(headerCard);
            } else {
              const textCard: TextCardContent = {
                type: 'text',
                text: content,
              };
              allCards.push(textCard);
            }
            elementCount++;
          }
        }
        break; // Stop after finding the first working selector
      }
    }
  } else {
    // Process OutlineElements as originally intended
    for (const element of Array.from(elements)) {
      if (elementCount >= maxElements) {
        break;
      }

      // Check for Images
      const imageEl = element.querySelector('image');
      if (imageEl && imageEl.getAttribute('href')) {
        if (includeImages) {
          // Image processing would go here, but we're skipping for now
          // as it requires more complex handling
          skippedImages++;
        } else {
          skippedImages++;
        }
        continue;
      }

      // Check for Paragraphs and Headers
      const p = element.querySelector('p.Paragraph');
      if (p) {
        const content = cleanText(p.textContent);

        // Skip empty or whitespace-only paragraphs
        if (!content) {
          continue;
        }

        // Check if the paragraph is a header
        if (p.getAttribute('role') === 'heading') {
          const level = parseInt(p.getAttribute('aria-level') || '1', 10);
          const headerCard: HeaderCardContent = {
            type: 'header',
            text: content,
            level: level,
          };
          allCards.push(headerCard);
        } else {
          // Otherwise, it's a standard paragraph (or list item)
          const textCard: TextCardContent = {
            type: 'text',
            text: content,
          };
          allCards.push(textCard);
        }
        elementCount++;
      }
    }
  }

  // Notify about skipped elements
  if (skippedImages > 0) {
    notifyInfo(`Skipped ${skippedImages} image(s) - image processing is not currently supported`);
  }

  // Create the main card content
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
    }
  }
  if (!mainContent) {
    throw new Error('No valid content extracted from Word document');
  }

  const headerCount = allCards.filter((card) => card.type === 'header').length;
  const textCount = allCards.filter((card) => card.type === 'text').length;

  notifyInfo(
    `Word document extraction completed. Found ${headerCount} header(s), ${textCount} text paragraph(s)` +
      ` and ${elementCount} total elements.`,
  );

  return createCard(mainContent, {
    url: document.location.href,
    source: source,
  });
}
