import {
  notifyError,
  notifyDebug,
  notifyWarning,
  notifyDebugVerbose,
  notifyDebugMoreVerbose,
} from '@common/notification';
import {
  CardModel,
  CardContent,
  TextCardContent,
  ImageCardContent,
  NestedCardContent,
  ListCardContent,
  HeaderCardContent,
  CardContentWithHeader,
  CardFromHtmlOptions,
} from '@common/types';
import { Readability } from '@mozilla/readability';
import { toPngBase64 } from './image';
import { createCard, eliminateHeaderCards } from '@common/utils/card';
import { everywhere } from '@common/rpc';

/**
 * Main function to convert HTML to CardModel
 */
async function _cardFromHtml(html: string | Document | null, options?: CardFromHtmlOptions): Promise<CardModel> {
  const { parser = 'complex', minimumImageSize = 64, source = 'webpage' } = options || {};
  const optWithDefault = { parser, minimumImageSize, source };

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

  notifyDebugVerbose('Original document for HTML processing:', clonedDoc);

  // Use Readability to get rid of chore elements
  const reader = new Readability(clonedDoc);

  const article = reader.parse();
  notifyDebugVerbose('Readability.js output:', article);

  let contents: CardContent[];
  let title: string | undefined;
  let excerpt: string | undefined;

  if (article) {
    notifyDebug('Document suitable for Readability.js. Extraction is successful.');
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
        throw new Error('Readability.js returned no content from the document');
      }
      const cleanDoc = htmlStringToDocument(article.content);
      notifyDebugVerbose('Cleaned document for custom HTML processing:', cleanDoc);
      const processor = new DOMToCardsProcessor(optWithDefault);
      contents = await processor.process(cleanDoc.body.childNodes);
    }
  } else {
    notifyDebug('Document not suitable for Readability.js. Falling back to custom parser.');
    const cleanDoc = htmlStringToDocument(doc.documentElement.outerHTML);
    notifyDebugVerbose('Cleaned document for custom HTML processing:', cleanDoc);
    const processor = new DOMToCardsProcessor(optWithDefault);
    contents = await processor.process(cleanDoc.body.childNodes);
  }

  if (contents.length === 0) {
    throw new Error('No content could be extracted from the document');
  }

  let finalContent: CardContent;

  // Determine the final card structure
  if (contents.length === 0) {
    notifyWarning('Contents array is empty after processing HTML');
    throw new Error('No content extracted from HTML');
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
  return createCard(finalContent, {
    source: source,
    mimeType: 'text/html',
    url,
    excerpt,
  });
}

export const cardFromHtml = everywhere('cardFromHtml', _cardFromHtml, ['content']);

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

interface ProcessingNode {
  node: ChildNode;
  inline: boolean;
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
    // Code blocks or inline
    // 'code',
    // Quotes
    'blockquote',
    // Paragraphs (keep for structure)
    'p',
    // Line breaks
    'br',
    // Horizontal rules
    'hr',
  ];

  // Elements to always skip entirely
  private skipElements = new Set<string>(['script', 'style', 'template', 'noscript']);

  // Elements that we want to flatten first, which are always block elements
  private blockElements = new Set<string>([
    'div',
    'section',
    'article',
    'aside',
    'main',
    'header',
    'footer',
    'nav',
    'figure',
    'figcaption',
    // keep img as meaningful; figure wrapper is often decorative
  ]);

  // If true, the node is a block element
  private cards: CardContentWithHeader[] = [];
  private pendingText: string[] = [];
  private options: Required<CardFromHtmlOptions>;

  constructor(options: Required<CardFromHtmlOptions>) {
    this.options = options;
  }

  async process(nodes: ArrayLikeNodes): Promise<CardContent[]> {
    this.cards = [];
    this.pendingText = [];
    await this.processRange(nodes);
    this.flushPending();
    notifyDebugMoreVerbose('Extracted cards before header elimination:', this.cards);
    return eliminateHeaderCards(this.cards);
  }

  /** Flatten the node tree to minimize nested levels */
  private flattenNodes(nodes: ArrayLikeNodes): ProcessingNode[] {
    const result: ProcessingNode[] = [];
    const processNode = (node: ChildNode, inline: boolean) => {
      if (isTextNode(node)) {
        result.push({ node, inline });
      } else if (isElementNode(node)) {
        const el = node as Element;
        const tag = el.tagName.toLowerCase();

        if (this.meaningfulElements.includes(tag)) {
          // Keep these meaningful structural elements intact
          // They are always block elements
          result.push({ node, inline: false });
        } else if (this.skipElements.has(tag)) {
          // Skip script and style elements entirely
          // Do nothing
        } else if (this.blockElements.has(tag)) {
          // For all other container elements (div, span, section, article, main, aside,
          // nav, header, footer, etc.), flatten their children.
          // The default semantics for root elements is to have each child as one block.
          for (const child of el.childNodes) {
            processNode(child, inline);
          }
        } else {
          // inline elements like a, span, code, etc.
          for (const child of el.childNodes) {
            processNode(child, true);
          }
        }
      } else {
        notifyDebugVerbose('Discarding non-element, non-text node:', node);
      }
      // Discard other node types (comments, etc.)
    };

    for (let i = 0; i < nodes.length; i++) {
      processNode(nodes[i] as ChildNode, false);
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

  private pushText(t: string | null | undefined, inline: boolean) {
    if (t) {
      if (inline && this.pendingText.length > 0) {
        this.pendingText[this.pendingText.length - 1] += t;
      } else {
        this.pendingText.push(t);
      }
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
    notifyDebugVerbose('Processed list element to list card:', { tag, items });
    return { type: 'list', items, ordered: tag === 'ol' };
  }

  private async imageElementToCard(img: HTMLImageElement): Promise<ImageCardContent | null> {
    try {
      const image = await toPngBase64(img);
      if (image.width < this.options.minimumImageSize && image.height < this.options.minimumImageSize) {
        notifyDebug(
          `Ignoring small image (${image.width}x${image.height}) below minimum size ${this.options.minimumImageSize}px:`,
          img.src,
        );
        return null;
      }
      const card: ImageCardContent = {
        type: 'image',
        base64: image.base64,
        alt: img.alt || undefined,
        caption: img.title || undefined,
      };
      notifyDebugVerbose('Processed image element to image card:', card);
      return card;
    } catch (err) {
      notifyWarning('Failed to process image:', err);
      return null;
    }
  }

  private async processRange(nodes: ArrayLikeNodes): Promise<void> {
    const flattened = this.flattenNodes(nodes);
    if (flattened.length < 10) {
      const names = (f: ProcessingNode) =>
        f.node.nodeType === Node.ELEMENT_NODE ? (f.node as Element).tagName : f.node.nodeType;
      notifyDebugMoreVerbose(`Flattened nodes for processing (${flattened.map(names).join(', ')}):`, flattened);
    } else {
      notifyDebugMoreVerbose('Flattened nodes for processing:', flattened);
    }
    let lastInline = false;
    for (const processing of flattened) {
      const node = processing.node;
      if (isTextNode(node)) {
        // TEXT
        // Inline the element if this element is inline or the last element was inline
        this.pushText(node.textContent, processing.inline || lastInline);
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
          // Extract list items, text only
          const listCard = this.listToCard(el);
          if (listCard) {
            this.cards.push(listCard);
          } else {
            notifyWarning('Failed to process list element:', el);
          }
        } else if (tag === 'img') {
          // IMAGES
          this.flushPending();
          const imgCard = await this.imageElementToCard(el as HTMLImageElement);
          if (imgCard) {
            this.cards.push(imgCard);
          }
        } else if (['table', 'thead', 'tbody', 'tr', 'th', 'td'].includes(tag)) {
          // TABLES - flatten to text contents only
          // TODO: Future work - table cards
          this.pushText(extractTextContent(el, true), false);
        } else if (tag === 'pre' || tag === 'blockquote') {
          // CODE - flatten to text contents only
          this.flushPending();
          this.cards.push({ type: 'text', text: extractTextContent(el, false), container: 'Code' });
        } else if (tag === 'p') {
          // Independent paragraph - flush pending text first
          this.flushPending();
          this.processRange(el.childNodes);
          this.flushPending();
        } else if (tag === 'br') {
          // LINE BREAK - treat as newline in pending text
          this.pushText('', false);
        } else if (tag === 'hr') {
          // TODO: waiting for POML to support horizontal rules
          this.pushText('\n' + '----------------', false);
          this.flushPending();
        } else {
          notifyDebug('Discarding unsupported element:', tag);
        }
      }
      lastInline = processing.inline;
    }
  }
}
