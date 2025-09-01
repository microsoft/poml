import { notifyError } from '@common/notification';
import {
  CardModel,
  CardContent,
  TextCardContent,
  ImageCardContent,
  NestedCardContent,
  ListCardContent,
} from '@common/types';
import { Readability } from '@mozilla/readability';

/**
 * Options for the htmlToCards function
 */
export interface HtmlToCardsOptions {
  /**
   * Parser mode:
   * - 'simple': Use Readability output as a single text card
   * - 'complex': Use custom parser with headers, images, lists, etc.
   * @default 'complex'
   */
  parser?: 'simple' | 'complex';
}

/**
 * Converts an image element to base64 PNG format
 */
async function imageToBase64PNG(img: HTMLImageElement): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    // Clear canvas with transparent background
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw image
    ctx.drawImage(img, 0, 0);

    // Convert to PNG base64
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to create blob'));
          return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            // Remove data URL prefix to get pure base64
            const base64 = reader.result.replace(/^data:.*?;base64,/, '');
            resolve(base64);
          } else {
            reject(new Error('Failed to read blob as base64'));
          }
        };
        reader.onerror = () => reject(new Error('Failed to read blob'));
        reader.readAsDataURL(blob);
      },
      'image/png',
      1.0,
    );
  });
}

/**
 * Fetches and converts an image URL to base64 PNG
 */
async function fetchImageAsBase64PNG(src: string): Promise<string> {
  // Check if it's already a data URL
  if (src.startsWith('data:')) {
    const match = src.match(/^data:image\/(.*?);base64,(.*)$/);
    if (match) {
      const mimeType = match[1];
      const base64Data = match[2];

      // If it's already PNG, return it directly
      if (mimeType === 'png') {
        return base64Data;
      }

      // For other formats, convert to PNG
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = async () => {
          try {
            const pngBase64 = await imageToBase64PNG(img);
            resolve(pngBase64);
          } catch (error) {
            reject(error);
          }
        };
        img.onerror = () => reject(new Error('Failed to load data URL'));
        img.src = src;
      });
    }
  }

  // External URL - fetch and convert
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Enable CORS if possible

    img.onload = async () => {
      try {
        const base64 = await imageToBase64PNG(img);
        resolve(base64);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error(`Failed to load image: ${src}`));
    };

    img.src = src;
  });
}

/**
 * Gets the header level (1-6) from a tag name, or 0 if not a header
 */
function getHeaderLevel(tagName: string): number {
  const match = tagName.match(/^h([1-6])$/i);
  return match ? parseInt(match[1]) : 0;
}

/**
 * Processes a list element (ul/ol) and extracts list items
 */
function processListElement(element: Element): string[] {
  const items: string[] = [];
  const listItems = element.querySelectorAll('li');

  listItems.forEach((li) => {
    // Get text content, but handle nested lists by excluding them
    const clone = li.cloneNode(true) as Element;
    // Remove nested lists from the clone
    clone.querySelectorAll('ul, ol').forEach((nestedList) => nestedList.remove());
    const text = clone.textContent?.trim();
    if (text) {
      items.push(text);
    }
  });

  return items;
}

/**
 * Processes DOM nodes and converts them to card content using complex parser
 */
async function processNodesComplex(nodes: NodeListOf<ChildNode>): Promise<CardContent[]> {
  const cards: CardContent[] = [];
  const pendingTextLines: string[] = [];

  // Helper to flush pending text as a card
  const flushText = () => {
    if (pendingTextLines.length > 0) {
      const text = pendingTextLines.join('\n').trim();
      if (text) {
        cards.push({
          type: 'text',
          text,
        } as TextCardContent);
      }
      pendingTextLines.length = 0;
    }
  };

  let i = 0;
  while (i < nodes.length) {
    const node = nodes[i];

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) {
        pendingTextLines.push(text);
      }
      i++;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      const tagName = element.tagName.toLowerCase();

      // Check if it's a header
      const headerLevel = getHeaderLevel(tagName);
      if (headerLevel > 0) {
        // Flush any pending text before the header
        flushText();

        const headerText = element.textContent?.trim() || '';

        // Look ahead to collect all content until the next header of same or higher level
        const childCards: CardContent[] = [];
        let j = i + 1;

        // Collect nodes for this section
        const sectionNodes: Node[] = [];
        while (j < nodes.length) {
          const nextNode = nodes[j];
          if (nextNode.nodeType === Node.ELEMENT_NODE) {
            const nextElement = nextNode as Element;
            const nextTagName = nextElement.tagName.toLowerCase();
            const nextHeaderLevel = getHeaderLevel(nextTagName);

            // Stop if we hit a header of same or higher level (lower number = higher priority)
            if (nextHeaderLevel > 0 && nextHeaderLevel <= headerLevel) {
              break;
            }
          }
          sectionNodes.push(nextNode);
          j++;
        }

        // Process the section nodes
        if (sectionNodes.length > 0) {
          const sectionContent = await processNodesComplex(sectionNodes as NodeListOf<ChildNode>);

          // If section has complex content (multiple cards), create nested structure
          if (sectionContent.length > 1) {
            cards.push({
              type: 'nested',
              cards: sectionContent,
              caption: headerText,
            } as NestedCardContent);
          } else if (sectionContent.length === 1) {
            // Single content, add header as caption if not already present
            const content = sectionContent[0];
            if (!content.caption) {
              content.caption = headerText;
            }
            cards.push(content);
          } else {
            // Just the header with no content
            cards.push({
              type: 'text',
              text: headerText,
            } as TextCardContent);
          }
        } else {
          // Header with no following content
          cards.push({
            type: 'text',
            text: headerText,
          } as TextCardContent);
        }

        // Skip the processed nodes
        i = j;
      } else if (tagName === 'ul' || tagName === 'ol') {
        // Handle lists
        flushText();

        const items = processListElement(element);
        if (items.length > 0) {
          const listCard: ListCardContent = {
            type: 'list',
            items,
            ordered: tagName === 'ol',
          };
          cards.push(listCard);
        }
        i++;
      } else if (tagName === 'img') {
        // Handle images
        flushText();

        const img = element as HTMLImageElement;
        try {
          const base64 = await fetchImageAsBase64PNG(img.src);
          const imageCard: ImageCardContent = {
            type: 'image',
            base64,
            alt: img.alt || undefined,
            caption: img.title || undefined,
          };
          cards.push(imageCard);
        } catch (error) {
          console.warn('Failed to process image:', error);
        }
        i++;
      } else if (['p', 'div', 'blockquote', 'pre'].includes(tagName)) {
        // Handle paragraphs and other block elements
        // Check if it contains images
        const images = element.querySelectorAll('img');

        if (images.length > 0) {
          // Process text before first image
          const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
            acceptNode(node) {
              if (node.nodeType === Node.TEXT_NODE) {
                return NodeFilter.FILTER_ACCEPT;
              }
              if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === 'IMG') {
                return NodeFilter.FILTER_ACCEPT;
              }
              return NodeFilter.FILTER_SKIP;
            },
          });

          let currentText: string[] = [];
          while (walker.nextNode()) {
            const currentNode = walker.currentNode;

            if (currentNode.nodeType === Node.TEXT_NODE) {
              const text = currentNode.textContent?.trim();
              if (text) {
                currentText.push(text);
              }
            } else if ((currentNode as Element).tagName === 'IMG') {
              // Flush text before image
              if (currentText.length > 0) {
                const text = currentText.join(' ').trim();
                if (text) {
                  pendingTextLines.push(text);
                }
                currentText = [];
              }
              flushText();

              // Add image
              const img = currentNode as HTMLImageElement;
              try {
                const base64 = await fetchImageAsBase64PNG(img.src);
                const imageCard: ImageCardContent = {
                  type: 'image',
                  base64,
                  alt: img.alt || undefined,
                  caption: img.title || undefined,
                };
                cards.push(imageCard);
              } catch (error) {
                console.warn('Failed to process embedded image:', error);
              }
            }
          }

          // Add any remaining text
          if (currentText.length > 0) {
            const text = currentText.join(' ').trim();
            if (text) {
              pendingTextLines.push(text);
            }
          }
        } else {
          // No images, just extract text
          const text = element.textContent?.trim();
          if (text) {
            pendingTextLines.push(text);
          }
        }
        i++;
      } else if (tagName === 'br') {
        // Handle line breaks
        pendingTextLines.push(''); // Add empty line for line break
        i++;
      } else if (tagName === 'script' || tagName === 'style') {
        // Skip script and style elements
        i++;
      } else if (tagName === 'li') {
        // Handle list items that might be outside of ul/ol (shouldn't happen but handle gracefully)
        const text = element.textContent?.trim();
        if (text) {
          pendingTextLines.push(`• ${text}`);
        }
        i++;
      } else {
        // For other elements, extract text content
        const text = element.textContent?.trim();
        if (text) {
          pendingTextLines.push(text);
        }
        i++;
      }
    } else {
      i++;
    }
  }

  // Flush any remaining text
  flushText();

  return cards;
}

/**
 * Simple parser that uses Readability output as a single text card
 */
function processSimple(article: any, title?: string): CardContent {
  // Get the text content from the article
  const textContent = article.textContent || '';

  return {
    type: 'text',
    text: textContent.trim(),
    caption: title,
  } as TextCardContent;
}

/**
 * Converts HTML content to a Document object
 */
function htmlToDocument(html: string): Document {
  const parser = new DOMParser();
  return parser.parseFromString(html, 'text/html');
}

/**
 * Main function to convert HTML to CardModel
 */
export async function htmlToCards(
  html: string | Document,
  options: HtmlToCardsOptions = {},
): Promise<CardModel | undefined> {
  const { parser = 'complex' } = options;

  let doc: Document;
  let url: string | undefined;
  let source: 'clipboard' | 'webpage';

  // Convert string to Document if needed
  if (typeof html === 'string') {
    doc = htmlToDocument(html);
    source = 'clipboard';
  } else {
    doc = html;
    url = doc.location?.href;
    source = 'webpage';
  }

  // Clone document for Readability processing
  const clonedDoc = doc.cloneNode(true) as Document;

  // Use Readability to extract main content
  const reader = new Readability(clonedDoc, {
    keepClasses: false,
    disableJSONLD: false,
  });

  const article = reader.parse();

  let content: CardContent;
  let title: string | undefined;
  let excerpt: string | undefined;

  if (!article) {
    notifyError('Readability.js failed to parse the document');
    return undefined;
  }
  title = article.title || undefined;
  excerpt = article.excerpt || undefined;

  if (parser === 'simple') {
    // Simple parser: use Readability output as single text card
    content = processSimple(article, title);
  } else {
    // Complex parser: custom processing with headers, images, lists, etc.
    if (!article.content) {
      notifyError('Readability.js returned no content from the document');
      return undefined;
    }
    const cleanDoc = htmlToDocument(article.content);
    const cardContents = await processNodesComplex(cleanDoc.body.childNodes);

    // Determine the final card structure
    if (cardContents.length === 0) {
      // No content found, create empty text card
      content = {
        type: 'text',
        text: '',
        caption: title,
      } as TextCardContent;
    } else if (cardContents.length === 1) {
      // Single card, use it directly
      content = cardContents[0];
      // Add title as caption if not already present
      if (!content.caption && title) {
        content.caption = title;
      }
    } else {
      // Multiple cards, create nested structure
      content = {
        type: 'nested',
        cards: cardContents,
        caption: title,
      } as NestedCardContent;
    }
  }

  // Create the CardModel
  const cardModel: CardModel = {
    content,
    source: source as 'manual' | 'clipboard' | 'webpage',
    url,
    excerpt,
    timestamp: new Date(),
  };

  return cardModel;
}
