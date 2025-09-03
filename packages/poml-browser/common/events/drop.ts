import { notifyError, notifyInfo, notifyDebug, notifyDebugVerbose } from '@common/notification';
import { CardModel } from '@common/types';
import { cardFromFile, readFile } from '@common/imports/file';
import { cardFromText } from '@common/imports/text';
import { cardFromHtml } from '@contentScript/registry';

/**
 * Main function to process drop events and convert to CardModels.
 *
 * It reads options from settings on its own, and notify errors by itself.
 */
export async function processDropEvent(event: DragEvent): Promise<CardModel[] | undefined> {
  const cards: CardModel[] = [];
  const errors: string[] = [];

  notifyDebugVerbose('Processing drop event:', event);

  if (!event.dataTransfer) {
    notifyError('Fatal error when processing drop event: no dataTransfer found', event);
    return undefined;
  }

  // Process dropped files first
  if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
    notifyDebug(`Processing ${event.dataTransfer.files.length} dropped files`);

    for (const file of event.dataTransfer.files) {
      notifyDebugVerbose(`Dropped file: ${file.name} (${file.type}, ${file.size} bytes)`);
      try {
        // TODO: read options from settings
        const card = await cardFromFile(file, { source: 'drop' });
        cards.push(card);
      } catch (error) {
        const errorMsg = `Failed to process file ${file.name} from drop: ${error}`;
        errors.push(errorMsg);
        notifyError(errorMsg);
      }
    }
  }

  // Process text/HTML data if no files were dropped or if there's additional text content
  const htmlData = event.dataTransfer.getData('text/html');
  const textData = event.dataTransfer.getData('text/plain');
  const urlData = event.dataTransfer.getData('text/uri-list');

  if (htmlData) {
    notifyDebugVerbose('Processing dropped HTML content:', htmlData);
    try {
      // Create a blob from HTML data and process it as an HTML file
      const htmlCard = await cardFromHtml(htmlData, { source: 'drop' });
      cards.push(htmlCard);
    } catch (error) {
      const errorMsg = `Failed to process HTML content from drop: ${error}`;
      errors.push(errorMsg);
      notifyError(errorMsg);
    }
  } else if (textData) {
    notifyDebugVerbose('Processing dropped text content', textData);
    const textCard = cardFromText(textData, { source: 'drop' });
    cards.push(textCard);
  }

  // Process URLs separately if available
  if (urlData && urlData !== textData) {
    const urls = urlData
      .split('\n')
      .map((url) => url.trim())
      .filter(Boolean);
    notifyDebugVerbose('Processing dropped URL data', urls);
    for (const url of urls) {
      try {
        const content = await readFile(url, { encoding: 'utf-8' });
        const urlCard = await cardFromHtml(content.content, { source: 'drop' });
        cards.push(urlCard);
      } catch (error) {
        const errorMsg = `Failed to process URL ${url} from drop: ${error}`;
        errors.push(errorMsg);
        notifyError(errorMsg);
      }
    }
  }

  notifyInfo(`Drop processing completed: ${cards.length} cards created, ${errors.length} errors`);
  return cards;
}
