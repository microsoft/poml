import { notifyError, notifyDebug, notifyDebugVerbose, notifyDebugMoreVerbose } from '@common/notification';
import { CardModel, TextCardContent } from '@common/types';
import { fileToCard } from '@common/imports/file';
import { everywhere } from '@common/rpc';

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
      // Create a blob from HTML data and process it as an HTML file
      const htmlBlob = new Blob([htmlData], { type: 'text/html' });
      const htmlCard = await fileToCard(htmlBlob, { source: 'drop' });
      cards.push(htmlCard);
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

      // Use fileToCard to process the file
      const card = await fileToCard(file, {
        minimumImageSize: options.minimumImageSize,
        maxFileSize: options.maxFileSize,
        source: 'drop',
      });

      cards.push(card);
    } catch (error) {
      const errorMsg = `Failed to process file ${file.name}: ${error}`;
      notifyError(errorMsg);
      errors.push(errorMsg);
    }
  }

  return { cards, errors };
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
