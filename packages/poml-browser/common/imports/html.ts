import { notifyError, notifyDebug, notifyWarning, notifyDebugVerbose } from '@common/notification';
import {
  CardModel,
  CardContent,
  TextCardContent,
  ImageCardContent,
  NestedCardContent,
  ListCardContent,
  HeaderCardContent,
  CardContentWithHeader,
} from '@common/types';
import { Readability } from '@mozilla/readability';
import { srcToPngBase64 } from './image';
import { eliminateHeaderCards } from '@common/utils/card';
import { everywhere } from '@common/rpc';

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
 * Main function to convert HTML to CardModel
 */
async function _htmlToCards(
  html: string | Document | null,
  options?: HtmlToCardsOptions,
): Promise<CardModel | undefined> {
  const { parser = 'complex' } = options || {};

  let doc: Document;
  let url: string | undefined;

  // Convert string to Document if needed
  if (typeof html === 'string') {
    doc = htmlStringToDocument(html);
  } else if (html === null) {
    doc = document;
    url = document.location?.href;
  } else {
    doc = html;
    url = doc.location?.href;
  }

  // Clone document for Readability processing
  const clonedDoc = doc.cloneNode(true) as Document;

  // Use Readability to get rid of chore elements
  const reader = new Readability(clonedDoc, {
    keepClasses: false,
    disableJSONLD: false,
    charThreshold: 16,
  });

  const article = reader.parse();
  notifyDebugVerbose('Readability.js output:', article);

  let contents: CardContent[];
  let title: string | undefined;
  let excerpt: string | undefined;

  if (article) {
    notifyDebug('Document suitable for Readability.js. Extraction is successful.', article);
    title = article.title || undefined;
    excerpt = article.excerpt || undefined;

    if (parser === 'simple') {
      // Simple parser: use Readability output as single text card
      contents = [
        {
          type: 'text',
          text: article.textContent?.trim() || '',
          caption: title,
        },
      ];
    } else {
      // Complex parser: custom processing with headers, images, lists, etc.
      if (!article.content) {
        notifyError('Readability.js returned no content from the document');
        return undefined;
      }
      const cleanDoc = htmlStringToDocument(article.content);
      const processor = new DOMToCardsProcessor();
      contents = await processor.process(cleanDoc.body.childNodes);
    }
  } else {
    notifyDebug('Document not suitable for Readability.js. Falling back to custom parser.');
    const cleanDoc = htmlStringToDocument(doc.documentElement.outerHTML);
    const processor = new DOMToCardsProcessor();
    contents = await processor.process(cleanDoc.body.childNodes);
  }

  if (contents.length === 0) {
    notifyError('No content could be extracted from the document');
    return undefined;
  }

  let finalContent: CardContent;

  // Determine the final card structure
  if (contents.length === 0) {
    notifyWarning('No content extracted from HTML');
    return undefined;
  } else if (contents.length === 1) {
    // Single card, use it directly
    finalContent = contents[0];
    // Add title as caption if not already present
    if (!finalContent.caption && title) {
      finalContent.caption = title;
    }
  } else {
    // Multiple cards, create nested structure
    finalContent = {
      type: 'nested',
      cards: contents,
      caption: title,
    } as NestedCardContent;
  }

  // Create the CardModel
  return {
    content: finalContent,
    source: 'webpage',
    url,
    excerpt,
    timestamp: new Date(),
  };
}

export const htmlToCards = everywhere('htmlToCards', _htmlToCards, ['content']);

type ArrayLikeNodes = ArrayLike<ChildNode> | ReadonlyArray<ChildNode>;

const isTextNode = (n: ChildNode): n is Text => n.nodeType === Node.TEXT_NODE;
const isElementNode = (n: ChildNode): n is Element => n.nodeType === Node.ELEMENT_NODE;

/**
 * Converts HTML string to a Document object
 */
function htmlStringToDocument(html: string): Document {
  const parser = new DOMParser();
  return parser.parseFromString(html, 'text/html');
}

function getHeaderLevel(tagName: string): number {
  const m = /^h([1-6])$/i.exec(tagName);
  return m ? Number(m[1]) : 0;
}

function normalizeText(s: string | null | undefined): string {
  return (s ?? '').replace(/\s+\n\s+/g, '\n').trim();
}

function extractTextContent(el: Element, normalize: boolean): string {
  return normalize ? normalizeText(el.textContent) : (el.textContent ?? '');
}

function* iterateTextAndImages(el: Element): Generator<Text | HTMLImageElement> {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        return NodeFilter.FILTER_ACCEPT;
      }
      if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName.toUpperCase() === 'IMG') {
        return NodeFilter.FILTER_ACCEPT;
      }
      return NodeFilter.FILTER_SKIP;
    },
  });
  while (walker.nextNode()) {
    const n = walker.currentNode;
    if (n.nodeType === Node.TEXT_NODE) {
      yield n as Text;
    } else if ((n as Element).tagName.toUpperCase() === 'IMG') {
      yield n as HTMLImageElement;
    }
  }
}

class DOMToCardsProcessor {
  // The list of elements we want to keep intact for structure
  // The others are flattened at the beginning of processing
  private meaningfulElements = [
    // Headers
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    // Lists
    'ul',
    'ol',
    'li',
    // Images
    'img',
    // Tables
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    // Preformatted text
    'pre',
    // Code blocks
    'code',
    // Quotes
    'blockquote',
    // Paragraphs (keep for structure)
    'p',
    // Line breaks
    'br',
  ];
  private cards: CardContentWithHeader[] = [];
  private pendingText: string[] = [];

  constructor() {}

  async process(nodes: ArrayLikeNodes): Promise<CardContent[]> {
    this.cards = [];
    this.pendingText = [];
    await this.processRange(nodes);
    this.flushPending();
    return eliminateHeaderCards(this.cards);
  }

  /** Flatten the node tree to minimize nested levels */
  private flattenNodes(nodes: ArrayLikeNodes): ChildNode[] {
    const result: ChildNode[] = [];
    const processNode = (node: ChildNode, normalize: boolean) => {
      if (isTextNode(node)) {
        // Always preserve text nodes
        result.push(node);
      } else if (isElementNode(node)) {
        const el = node as Element;
        const tag = el.tagName.toLowerCase();

        // Keep these meaningful structural elements intact
        if (this.meaningfulElements.includes(tag) || getHeaderLevel(tag) > 0) {
          result.push(node);
          return;
        }

        // Skip script and style elements entirely
        if (tag === 'script' || tag === 'style') {
          return;
        }

        // For all other container elements (div, span, section, article, main, aside,
        // nav, header, footer, etc.), flatten their children
        for (const child of el.childNodes) {
          processNode(child, tag === 'pre' || tag === 'code' ? false : normalize);
        }
      }
      // Discard other node types (comments, etc.)
    };

    for (let i = 0; i < nodes.length; i++) {
      processNode(nodes[i] as ChildNode, true);
    }
    return result;
  }

  private flushPending() {
    if (this.pendingText.length === 0) {
      return;
    }
    const text = this.pendingText.join('\n').trim();
    this.pendingText.length = 0;
    if (!text) {
      return;
    }
    const card: TextCardContent = { type: 'text', text };
    this.cards.push(card);
  }

  private pushText(t: string | null | undefined) {
    if (t) {
      this.pendingText.push(t);
    }
  }

  private listToCard(el: Element): ListCardContent | null {
    const tag = el.tagName.toLowerCase();
    const items: string[] = [];
    if (tag === 'li') {
      const single = extractTextContent(el, true);
      items.push(single);
    }
    el.querySelectorAll(':scope > li').forEach((li) => {
      const t = extractTextContent(li, true);
      if (t) {
        items.push(t);
      }
    });
    if (items.length === 0) {
      return null;
    }
    return { type: 'list', items, ordered: tag === 'ol' };
  }

  private async imageElementToCard(img: HTMLImageElement): Promise<ImageCardContent | null> {
    try {
      const base64 = await srcToPngBase64(img.src);
      const card: ImageCardContent = {
        type: 'image',
        base64,
        alt: img.alt || undefined,
        caption: img.title || undefined,
      };
      return card;
    } catch (err) {
      notifyWarning('Failed to process image:', err);
      return null;
    }
  }

  private async processRange(nodes: ArrayLikeNodes): Promise<void> {
    const flattened = this.flattenNodes(nodes);
    for (const node of flattened) {
      if (isTextNode(node)) {
        // TEXT
        this.pushText(node.textContent);
      } else if (isElementNode(node)) {
        const el = node as Element;
        const tag = el.tagName.toLowerCase();

        // HEADERS
        const headerLevel = getHeaderLevel(tag);
        if (headerLevel > 0) {
          this.flushPending();

          const headerText = extractTextContent(el, true);
          const textCard: HeaderCardContent = { type: 'header', text: headerText, level: headerLevel };
          this.cards.push(textCard);
        } else if (tag === 'ul' || tag === 'ol') {
          // LISTS
          this.flushPending();
          const listCard = this.listToCard(el);
          if (listCard) {
            this.cards.push(listCard);
          }
        } else if (tag === 'img') {
          // IMAGES
          this.flushPending();
          const imgCard = await this.imageElementToCard(el as HTMLImageElement);
          if (imgCard) {
            this.cards.push(imgCard);
          }
        } else if (['table', 'thead', 'tbody', 'tr', 'th', 'td'].includes(tag)) {
          // TABLES - flatten to text
          // TODO: Future work - table cards
          this.pushText(extractTextContent(el, true));
        } else if (tag === 'code' || tag === 'pre' || tag === 'blockquote') {
          // CODE - flatten to text
          this.flushPending();
          this.cards.push({ type: 'text', text: extractTextContent(el, false), container: 'Code' });
        } else if (tag === 'p') {
          // Independent paragraph - flush pending text first
          this.flushPending();
          this.pushText(extractTextContent(el, true));
          this.flushPending();
        } else if (tag === 'br') {
          // LINE BREAK - treat as newline in pending text
          this.pushText('');
        } else {
          notifyDebug('Discarding unsupported element:', tag);
        }
      }
    }
  }
}
