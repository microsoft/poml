import { notifyError, notifyDebug, notifyDebugVerbose, notifyDebugMoreVerbose } from '@common/notification';
import { CardModel, TextCardContent, ImageCardContent, TextFile } from '@common/types';
import { readFile } from '@common/imports/file';
import { toPngBase64 } from '@common/imports/image';
import { htmlToCard } from '@common/imports/html';
import { everywhere } from '@common/rpc';
import * as mimeTypes from '@common/utils/mime-types';

/**
 * Options for drop event processing
 */
export interface DropOptions {
  /**
   * Minimum image size in pixels (width or height) to include.
   * Images smaller than this will be ignored.
   * @default 64
   */
  minimumImageSize: number;

  /**
   * Maximum file size in bytes to process.
   * Files larger than this will be ignored.
   * @default 20MB
   */
  maxFileSize: number;

  /**
   * Whether to process HTML content from dropped text/html data
   * @default true
   */
  processHtml: boolean;
}

/**
 * Result of processing dropped content
 */
export interface DropResult {
  cards: CardModel[];
  errors: string[];
}

/**
 * Main function to process drop events and convert to CardModels
 */
async function _processDropEvent(event: DragEvent, options?: Partial<DropOptions>): Promise<DropResult> {
  const {
    minimumImageSize = 64,
    maxFileSize = 20 * 1024 * 1024, // 20MB
    processHtml = true,
  } = options || {};

  const cards: CardModel[] = [];
  const errors: string[] = [];

  notifyDebugVerbose('Processing drop event:', event);

  if (!event.dataTransfer) {
    notifyError('Drop event has no dataTransfer');
    return { cards, errors: ['No data transfer available'] };
  }

  // Process dropped files first
  if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
    notifyDebug(`Processing ${event.dataTransfer.files.length} dropped files`);

    const fileCards = await processDroppedFiles(Array.from(event.dataTransfer.files), {
      minimumImageSize,
      maxFileSize,
    });

    cards.push(...fileCards.cards);
    errors.push(...fileCards.errors);
  }

  // Process text/HTML data if no files were dropped or if there's additional text content
  const htmlData = event.dataTransfer.getData('text/html');
  const textData = event.dataTransfer.getData('text/plain');
  const urlData = event.dataTransfer.getData('text/uri-list');

  if (htmlData && processHtml) {
    notifyDebug('Processing dropped HTML content');
    try {
      const htmlCard = await htmlToCard(htmlData, { parser: 'complex' });
      if (htmlCard) {
        htmlCard.source = 'drop';
        htmlCard.timestamp = new Date();
        cards.push(htmlCard);
      }
    } catch (error) {
      const errorMsg = `Failed to process HTML content: ${error}`;
      notifyError(errorMsg);
      errors.push(errorMsg);
    }
  } else if (textData) {
    notifyDebug('Processing dropped text content');
    const textCard = createTextCard(textData, 'drop');
    cards.push(textCard);
  }

  // Process URLs separately if available
  if (urlData && urlData !== textData) {
    notifyDebug('Processing dropped URL data');
    const urls = urlData.split('\n').filter((url) => url.trim());
    for (const url of urls) {
      const urlCard = createTextCard(url.trim(), 'drop');
      urlCard.content.caption = 'Dropped URL';
      cards.push(urlCard);
    }
  }

  notifyDebug(`Drop processing completed: ${cards.length} cards created, ${errors.length} errors`);
  return { cards, errors };
}

export const processDropEvent = everywhere('processDropEvent', _processDropEvent, ['content', 'sidebar']);

/**
 * Process dropped files and convert them to CardModels
 */
async function processDroppedFiles(
  files: File[],
  options: { minimumImageSize: number; maxFileSize: number },
): Promise<DropResult> {
  const cards: CardModel[] = [];
  const errors: string[] = [];

  notifyDebugVerbose(`Processing ${files.length} dropped files`);

  for (const file of files) {
    try {
      notifyDebugMoreVerbose(`Processing file: ${file.name} (${file.type}, ${file.size} bytes)`);

      // Check file size
      if (file.size > options.maxFileSize) {
        const errorMsg = `File ${file.name} too large (${file.size} bytes > ${options.maxFileSize} bytes)`;
        notifyError(errorMsg);
        errors.push(errorMsg);
        continue;
      }

      // Determine file type using mime-types inference
      let card: CardModel | null = null;
      const inferredMimeType = mimeTypes.lookup(file.name) || file.type;
      const actualMimeType = file.type || inferredMimeType;

      notifyDebugVerbose(
        `File ${file.name}: browser type=${file.type}, inferred type=${inferredMimeType}, using=${actualMimeType}`,
      );

      if (actualMimeType?.startsWith('image/')) {
        card = await processImageFile(file, options.minimumImageSize);
      } else if (actualMimeType?.startsWith('text/')) {
        if (actualMimeType === 'text/html') {
          card = await processHtmlFile(file);
        } else {
          card = await processTextFile(file);
        }
      } else {
        // For non-text, non-image files, try to determine if it's actually text
        card = await processBinaryOrUnknownFile(file);
      }

      if (card) {
        card.source = 'drop';
        card.timestamp = new Date();
        cards.push(card);
      }
    } catch (error) {
      const errorMsg = `Failed to process file ${file.name}: ${error}`;
      notifyError(errorMsg);
      errors.push(errorMsg);
    }
  }

  return { cards, errors };
}

/**
 * Process an image file
 */
async function processImageFile(file: File, minimumImageSize: number): Promise<CardModel | null> {
  try {
    notifyDebugVerbose(`Processing image file: ${file.name}`);

    const image = await toPngBase64({ src: URL.createObjectURL(file) });

    if (image.width < minimumImageSize && image.height < minimumImageSize) {
      notifyDebug(
        `Ignoring small image (${image.width}x${image.height}) below minimum size ${minimumImageSize}px: ${file.name}`,
      );
      return null;
    }

    const content: ImageCardContent = {
      type: 'image',
      base64: image.base64,
      alt: file.name,
      caption: file.name,
    };

    return {
      content,
      source: 'drop',
      mimeType: file.type,
      timestamp: new Date(),
    };
  } catch (error) {
    notifyError(`Failed to process image file ${file.name}:`, error);
    return null;
  }
}

/**
 * Process a text file
 */
async function processTextFile(file: File): Promise<CardModel | null> {
  try {
    notifyDebugVerbose(`Processing text file: ${file.name}`);

    const fileData = (await readFile(file, { encoding: 'utf-8' })) as TextFile;

    if (!fileData.content.trim()) {
      notifyDebug(`Skipping empty text file: ${file.name}`);
      return null;
    }

    const content: TextCardContent = {
      type: 'text',
      text: fileData.content,
      caption: file.name,
    };

    // Determine container type based on file extension
    const extension = file.name.toLowerCase().split('.').pop();
    if (
      ['js', 'ts', 'py', 'java', 'cpp', 'c', 'h', 'css', 'html', 'xml', 'json', 'yaml', 'yml'].includes(extension || '')
    ) {
      content.container = 'Code';
    }

    return {
      content,
      source: 'drop',
      mimeType: fileData.mimeType,
      timestamp: new Date(),
    };
  } catch (error) {
    notifyError(`Failed to process text file ${file.name}:`, error);
    return null;
  }
}

/**
 * Process an HTML file
 */
async function processHtmlFile(file: File): Promise<CardModel | null> {
  try {
    notifyDebugVerbose(`Processing HTML file: ${file.name}`);

    const fileData = (await readFile(file, { encoding: 'utf-8' })) as TextFile;

    if (!fileData.content.trim()) {
      notifyDebug(`Skipping empty HTML file: ${file.name}`);
      return null;
    }

    // Try to process as HTML first
    try {
      const htmlCard = await htmlToCard(fileData.content, {
        parser: 'complex',
      });
      if (htmlCard) {
        htmlCard.source = 'drop';
        htmlCard.mimeType = fileData.mimeType;
        if (!htmlCard.content.caption) {
          htmlCard.content.caption = file.name;
        }
        return htmlCard;
      }
    } catch (htmlError) {
      notifyDebug(`Failed to process as HTML, falling back to text: ${htmlError}`);
    }

    // Fallback to text processing
    const content: TextCardContent = {
      type: 'text',
      text: fileData.content,
      caption: file.name,
      container: 'Code',
    };

    return {
      content,
      source: 'drop',
      mimeType: fileData.mimeType,
      timestamp: new Date(),
    };
  } catch (error) {
    notifyError(`Failed to process HTML file ${file.name}:`, error);
    return null;
  }
}

/**
 * Process a file that appears to be binary or of unknown type
 */
async function processBinaryOrUnknownFile(file: File): Promise<CardModel | null> {
  try {
    notifyDebugVerbose(`Processing binary/unknown file type: ${file.name} (${file.type})`);

    // Try to read as text first to see if it's actually readable text
    try {
      const textData = (await readFile(file, {
        encoding: 'utf-8',
      })) as TextFile;

      // Check if content looks like text (contains printable characters)
      if (isProbablyText(textData.content)) {
        notifyDebug(`File ${file.name} appears to be text despite binary MIME type, treating as text`);

        const content: TextCardContent = {
          type: 'text',
          text: textData.content,
          caption: file.name,
        };

        return {
          content,
          source: 'drop',
          mimeType: textData.mimeType,
          timestamp: new Date(),
        };
      }
    } catch (textError) {
      notifyDebugVerbose(`Failed to read as text: ${textError}`);
    }

    // File is truly binary - notify error as requested
    const errorMsg = `Cannot process binary file: ${file.name} (${file.type || 'unknown type'}). Only text and image files are supported.`;
    notifyError(errorMsg);
    return null;
  } catch (error) {
    notifyError(`Failed to process file ${file.name}:`, error);
    return null;
  }
}

/**
 * Create a text card from string content
 */
function createTextCard(text: string, source: 'drop'): CardModel {
  const content: TextCardContent = {
    type: 'text',
    text: text.trim(),
  };

  return {
    content,
    source,
    mimeType: 'text/plain',
    timestamp: new Date(),
  };
}

/**
 * Check if content is probably text (contains mostly printable characters)
 */
function isProbablyText(content: string): boolean {
  if (!content) {
    return false;
  }

  // Check for null bytes (strong indicator of binary content)
  if (content.includes('\0')) {
    return false;
  }

  // Count printable characters
  let printableCount = 0;
  for (let i = 0; i < Math.min(content.length, 1000); i++) {
    const char = content.charCodeAt(i);
    if ((char >= 32 && char <= 126) || char === 9 || char === 10 || char === 13) {
      printableCount++;
    }
  }

  const ratio = printableCount / Math.min(content.length, 1000);
  return ratio > 0.8; // If more than 80% of characters are printable, consider it text
}

/**
 * Simple drop handler that returns the first card or undefined
 */
export async function dropHandler(event: DragEvent, options?: Partial<DropOptions>): Promise<CardModel | undefined> {
  const result = await processDropEvent(event, options);

  if (result.errors.length > 0) {
    for (const error of result.errors) {
      notifyError(error);
    }
  }

  return result.cards.length > 0 ? result.cards[0] : undefined;
}

/**
 * Drop handler that returns all processed cards
 */
export async function dropHandlerMultiple(event: DragEvent, options?: Partial<DropOptions>): Promise<CardModel[]> {
  const result = await processDropEvent(event, options);

  if (result.errors.length > 0) {
    for (const error of result.errors) {
      notifyError(error);
    }
  }

  return result.cards;
}
