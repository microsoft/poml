import { notifyError, notifyDebug } from '@common/notification';
import {
  CardModel,
  CardContent,
  TextCardContent,
  ImageCardContent,
  NestedCardContent,
  ListCardContent,
} from '@common/types';
import { Readability } from '@mozilla/readability';
import { srcToPngBase64 } from './image';

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
    doc = htmlStringToDocument(html);
    source = 'clipboard';
  } else {
    doc = html;
    url = doc.location?.href;
    source = 'webpage';
  }

  // Clone document for Readability processing
  const clonedDoc = doc.cloneNode(true) as Document;

  // Use Readability to get rid of chore elements
  const reader = new Readability(clonedDoc, {
    keepClasses: false,
    disableJSONLD: false,
  });

  const article = reader.parse();

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
      contents = await processNodesComplex(cleanDoc.body.childNodes);
    }
  } else {
    notifyDebug('Document not suitable for Readability.js. Falling back to custom parser.');
    const cleanDoc = htmlStringToDocument(doc.documentElement.outerHTML);
    contents = await processNodesComplex(cleanDoc.body.childNodes);
  }

  if (contents.length === 0) {
    notifyError('No content could be extracted from the document');
    return undefined;
  }

  let finalContent: CardContent;

  // Determine the final card structure
  if (contents.length === 0) {
    // No content found, create empty text card
    finalContent = {
      type: 'text',
      text: '',
      caption: title,
    } as TextCardContent;
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
    source: source as 'manual' | 'clipboard' | 'webpage',
    url,
    excerpt,
    timestamp: new Date(),
  };
}

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

function extractTextContent(el: Element): string {
  return normalizeText(el.textContent);
}

function processListElement(el: Element): string[] {
  const tag = el.tagName.toLowerCase();
  if (tag === 'li') {
    const single = extractTextContent(el);
    return single ? [single] : [];
  }
  const items: string[] = [];
  el.querySelectorAll(':scope > li').forEach((li) => {
    const t = extractTextContent(li);
    if (t) {
items.push(t);
}
  });
  return items;
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

export class DOMToCardsProcessor {
  private cards: CardContent[] = [];
  private pendingText: string[] = [];

  /** Public entry */
  static async process(nodes: ArrayLikeNodes): Promise<CardContent[]> {
    const p = new DOMToCardsProcessor();
    await p.processRange(nodes);
    p.flushPending();
    return p.cards;
  }

  /** Keep state local to an instance */
  private constructor() {}

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
    const text = normalizeText(t);
    if (text) {
this.pendingText.push(text);
}
  }

  private collectSectionNodes(
    nodes: ArrayLikeNodes,
    start: number,
    headerLevel: number,
  ): { section: ChildNode[]; nextIndex: number } {
    const section: ChildNode[] = [];
    let j = start + 1;
    while (j < nodes.length) {
      const next = nodes[j] as ChildNode;
      if (isElementNode(next)) {
        const lvl = getHeaderLevel(next.tagName.toLowerCase());
        if (lvl > 0 && lvl <= headerLevel) {
break;
}
      }
      section.push(next);
      j++;
    }
    return { section, nextIndex: j };
  }

  private listToCard(el: Element): ListCardContent | null {
    const tag = el.tagName.toLowerCase();
    const items = processListElement(el);
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
      console.warn('Failed to process image:', err);
      return null;
    }
  }

  private async handleBlockElement(el: Element): Promise<void> {
    const hasImages = el.querySelector('img') !== null;
    if (!hasImages) {
      this.pushText(el.textContent);
      return;
    }

    let buffer: string[] = [];
    for (const n of iterateTextAndImages(el)) {
      if (isTextNode(n)) {
        const t = normalizeText(n.textContent);
        if (t) {
buffer.push(t);
}
      } else {
        if (buffer.length > 0) {
          this.pushText(buffer.join(' ').trim());
          buffer = [];
          this.flushPending();
        }
        const imgCard = await this.imageElementToCard(n as HTMLImageElement);
        if (imgCard) {
this.cards.push(imgCard);
}
      }
    }
    if (buffer.length > 0) {
this.pushText(buffer.join(' ').trim());
}
  }

  private async processRange(nodes: ArrayLikeNodes): Promise<void> {
    let i = 0;
    while (i < nodes.length) {
      const node = nodes[i] as ChildNode;

      // TEXT
      if (isTextNode(node)) {
        this.pushText(node.textContent);
        i++;
        continue;
      }

      // ELEMENTS
      if (isElementNode(node)) {
        const el = node as Element;
        const tag = el.tagName.toLowerCase();

        // HEADERS
        const headerLevel = getHeaderLevel(tag);
        if (headerLevel > 0) {
          this.flushPending();

          const headerText = extractTextContent(el);
          const { section, nextIndex } = this.collectSectionNodes(nodes, i, headerLevel);

          if (section.length > 0) {
            const sectionCards = await DOMToCardsProcessor.process(section);
            if (sectionCards.length > 1) {
              const nested: NestedCardContent = { type: 'nested', cards: sectionCards, caption: headerText };
              this.cards.push(nested);
            } else if (sectionCards.length === 1) {
              const only = sectionCards[0] as any;
              if (only.caption == null) {
only.caption = headerText;
}
              this.cards.push(only);
            } else {
              const textCard: TextCardContent = { type: 'text', text: headerText };
              this.cards.push(textCard);
            }
          } else {
            const textCard: TextCardContent = { type: 'text', text: headerText };
            this.cards.push(textCard);
          }

          i = nextIndex;
          continue;
        }

        // LISTS
        if (tag === 'ul' || tag === 'ol') {
          this.flushPending();
          const listCard = this.listToCard(el);
          if (listCard) {
this.cards.push(listCard);
}
          i++;
          continue;
        }

        // IMAGES
        if (tag === 'img') {
          this.flushPending();
          const imgCard = await this.imageElementToCard(el as HTMLImageElement);
          if (imgCard) {
this.cards.push(imgCard);
}
          i++;
          continue;
        }

        // BLOCKS
        if (['p', 'div', 'blockquote', 'pre'].includes(tag)) {
          await this.handleBlockElement(el);
          i++;
          continue;
        }

        // LINE BREAKS
        if (tag === 'br') {
          this.pendingText.push(''); // newline separator, preserved on join/trim rules
          i++;
          continue;
        }

        // IGNORED
        if (tag === 'script' || tag === 'style') {
          i++;
          continue;
        }

        // STRAY LI (graceful)
        if (tag === 'li') {
          this.pushText(extractTextContent(el));
          i++;
          continue;
        }

        // DEFAULT
        this.pushText(extractTextContent(el));
        i++;
        continue;
      }

      // OTHER NODE TYPES
      i++;
    }
  }
}
