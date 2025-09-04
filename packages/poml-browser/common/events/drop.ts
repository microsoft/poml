import { notifyError, notifyInfo, notifyDebug, notifyDebugVerbose } from '@common/notification';
import { CardModel } from '@common/types';
import { cardFromFile } from '@common/imports/file';
import { cardFromText } from '@common/imports/text';
import { cardFromHtml } from '@common/imports/html';
import { parseUriList } from '@common/imports/uri';

/**
 * Main function to process drop events and convert to CardModels.
 *
 * It reads options from settings on its own, and notify errors by itself.
 */
export async function processDropEvent(event: DragEvent): Promise<CardModel[]> {
  const result = await processDropEventAndThrow(event);
  // Ignore errors here; they were already notified.
  return result.cards;
}

/**
 * This one is for debugging and testing, as it returns both cards and errors.
 */
export async function processDropEventAndThrow(event: DragEvent): Promise<{ cards: CardModel[]; errors: string[] }> {
  const cards: CardModel[] = [];
  const errors: string[] = [];

  notifyDebugVerbose('Processing drop event:', event);

  const postError = (msg: string, object?: any) => {
    errors.push(msg);
    if (object !== undefined) {
      notifyError(msg, object);
    } else {
      notifyError(msg);
    }
  };

  const dt = event.dataTransfer;
  if (!dt) {
    postError('Fatal error when processing drop event: no dataTransfer found', event);
    return { cards, errors };
  }

  const types = Array.from(dt.types ?? []);

  // Use simple sets to prevent duplicate work across types
  const seenUrls = new Set<string>();

  // --- 1) Files (most specific) ---
  if (dt.files && dt.files.length > 0) {
    notifyDebug(`Processing ${dt.files.length} dropped file(s)`);
    for (const file of dt.files) {
      notifyDebugVerbose(`Dropped file: ${file.name} (${file.type || 'unknown'}, ${file.size} bytes)`);
      try {
        const card = await cardFromFile(file, { source: 'drop' });
        cards.push(card);
      } catch (error) {
        postError(`Failed to process file ${file.name} from drop, caused by ${String(error)}`);
      }
    }
  }

  // --- 2) text/html ---
  if (types.includes('text/html')) {
    const htmlData = dt.getData('text/html');
    if (htmlData) {
      notifyDebugVerbose('Processing dropped HTML content');
      try {
        const htmlCard = await cardFromHtml(htmlData, { source: 'drop' });
        cards.push(htmlCard);
      } catch (error) {
        postError(`Failed to process HTML content from drop: ${String(error)}`);
      }
    }
  }

  // --- 3) URLs: prefer "URL" (first valid) then text/uri-list ---
  const urlsToProcess: string[] = [];

  if (types.includes('URL')) {
    const firstUrl = dt.getData('URL');
    if (firstUrl && !seenUrls.has(firstUrl)) {
      urlsToProcess.push(firstUrl);
      seenUrls.add(firstUrl);
    }
  }

  if (types.includes('text/uri-list')) {
    const raw = dt.getData('text/uri-list');
    if (raw) {
      const parsed = parseUriList(raw);
      for (const u of parsed) {
        if (!seenUrls.has(u)) {
          urlsToProcess.push(u);
          seenUrls.add(u);
        }
      }
    }
  }

  // Process URL contents (remote or local—your readFile handles both)
  for (const url of urlsToProcess) {
    try {
      const card = await cardFromFile(url, { source: 'drop' });
      notifyDebug(`Processed dropped URL: ${url}`, card);
      cards.push(card);
    } catch (error) {
      postError(`Failed to process URL ${url} from drop, caused by ${String(error)}`);
    }
  }

  // --- 4) text/plain (least specific fallback) ---
  if (types.includes('text/plain')) {
    const textData = dt.getData('text/plain');
    if (textData) {
      // Avoid duplicating a single-URL payload we already handled via URL/uri-list
      const trimmed = textData.trim();
      const looksLikeSingleUrl = /^https?:\/\/\S+$/.test(trimmed);
      if (looksLikeSingleUrl && seenUrls.has(trimmed)) {
        notifyDebugVerbose('Skipping text/plain because it duplicates an already-processed URL');
      } else {
        notifyDebugVerbose('Processing dropped text content', textData);
        try {
          const textCard = cardFromText(textData, { source: 'drop' });
          cards.push(textCard);
        } catch (error) {
          postError(`Failed to process text content from drop, caused by ${String(error)}`);
        }
      }
    }
  }

  notifyInfo(`Drop processing completed: ${cards.length} card(s) created; ${errors.length} error(s)`);
  return {
    cards: cards,
    errors: errors,
  };
}
