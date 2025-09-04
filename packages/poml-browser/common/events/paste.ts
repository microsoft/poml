import { notifyError, notifyInfo, notifyDebug, notifyDebugVerbose } from '@common/notification';
import { CardModel } from '@common/types';
import { cardFromFile } from '@common/imports/file';
import { cardFromText } from '@common/imports/text';
import { cardFromHtml } from '@common/imports/html';
import { parseUriList } from '@common/imports/uri';

/**
 * Processes a clipboard paste event and converts pasted content to CardModel array.
 *
 * @param event - The ClipboardEvent from a paste operation
 * @returns Promise resolving to an array of CardModel objects created from pasted content
 *
 * @remarks
 * This is the main entry point for handling paste events. It processes various content types
 * in priority order:
 * 1. Files (from clipboardData.files or items)
 * 2. HTML content (text/html)
 * 3. URLs (text/uri-list or URL)
 * 4. Plain text (text/plain)
 *
 * Errors during processing are logged via the notification system but don't prevent
 * other content from being processed.
 *
 * @example
 * ```typescript
 * document.addEventListener('paste', async (event) => {
 *   const cards = await processPasteEvent(event);
 *   // Use the cards...
 * });
 * ```
 *
 * @public
 */
export async function processPasteEvent(event: ClipboardEvent): Promise<CardModel[]> {
  const result = await processPasteEventAndThrow(event);
  // Ignore errors here; they were already notified.
  return result.cards;
}

/**
 * Processes a clipboard paste event with detailed error tracking.
 *
 * @param event - The ClipboardEvent from a paste operation
 * @returns Promise resolving to an object containing created cards and any errors encountered
 *
 * @internal
 */
export async function processPasteEventAndThrow(
  event: ClipboardEvent,
): Promise<{ cards: CardModel[]; errors: string[] }> {
  const cards: CardModel[] = [];
  const errors: string[] = [];

  notifyDebugVerbose('Processing paste event:', event);

  const postError = (msg: string, object?: any) => {
    errors.push(msg);
    if (object !== undefined) {
      notifyError(msg, object);
    } else {
      notifyError(msg);
    }
  };

  const cd = event.clipboardData;
  if (!cd) {
    postError('Fatal error when processing paste event: no clipboardData found', event);
    return { cards, errors };
  }

  const types = Array.from(cd.types ?? []);
  notifyDebugVerbose('Clipboard types:', types);

  // Use simple sets to prevent duplicate work across types
  const seenUrls = new Set<string>();

  // --- 1) Files (most specific) ---
  // Files may appear in two places:
  //   a) clipboardData.files (FileList)
  //   b) clipboardData.items with kind === 'file'
  const fileCandidates: File[] = [];

  // a) FileList
  if (cd.files && cd.files.length > 0) {
    notifyDebug(`Processing ${cd.files.length} pasted file(s) from clipboardData.files`);
    for (const file of Array.from(cd.files)) {
      fileCandidates.push(file);
    }
  }

  // b) DataTransferItemList
  if (cd.items && cd.items.length > 0) {
    for (const item of Array.from(cd.items)) {
      if (item.kind === 'file') {
        const f = item.getAsFile();
        if (f) {
          fileCandidates.push(f);
        }
      }
    }
  }

  if (fileCandidates.length > 0) {
    notifyDebug(`Processing ${fileCandidates.length} pasted file(s)`);
    for (const file of fileCandidates) {
      notifyDebugVerbose(`Pasted file: ${file.name || '(unnamed)'} (${file.type || 'unknown'}, ${file.size} bytes)`);
      try {
        const card = await cardFromFile(file, { source: 'clipboard' });
        cards.push(card);
      } catch (error) {
        postError(`Failed to process file ${file.name || '(unnamed)'} from clipboard, caused by ${String(error)}`);
      }
    }
  }

  // --- 2) text/html ---
  // Many editors put rich HTML on the clipboard for paste.
  if (types.includes('text/html')) {
    const htmlData = cd.getData('text/html');
    if (htmlData) {
      notifyDebugVerbose('Processing pasted HTML content', htmlData);
      try {
        const htmlCard = await cardFromHtml(htmlData, { source: 'clipboard' });
        cards.push(htmlCard);
      } catch (error) {
        postError(`Failed to process HTML content from clipboard: ${String(error)}`);
      }
    }
  }

  // --- 3) URLs: prefer text/uri-list (multiple) then URL (rare on clipboard) ---
  const urlsToProcess: string[] = [];

  if (types.includes('text/uri-list')) {
    const raw = cd.getData('text/uri-list');
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

  // Some environments/browsers may still expose a single "URL" entry on paste.
  if (types.includes('URL')) {
    const firstUrl = cd.getData('URL');
    if (firstUrl && !seenUrls.has(firstUrl)) {
      urlsToProcess.push(firstUrl);
      seenUrls.add(firstUrl);
    }
  }

  // Process URL contents (remote or local—your readFile handles both)
  for (const url of urlsToProcess) {
    try {
      const card = await cardFromFile(url, { source: 'clipboard' });
      notifyDebug(`Processed pasted URL: ${url}`, card);
      cards.push(card);
    } catch (error) {
      postError(`Failed to process URL ${url} from clipboard, caused by ${String(error)}`);
    }
  }

  // --- 4) text/plain (least specific fallback) ---
  // On paste, plain text is very common, and may contain a single URL or arbitrary text.
  if (types.includes('text/plain')) {
    const textData = cd.getData('text/plain');
    if (textData) {
      const trimmed = textData.trim();

      // If it's a single URL and we already processed it via uri-list/URL, skip
      const looksLikeSingleUrl = /^https?:\/\/\S+$/.test(trimmed);
      if (looksLikeSingleUrl && seenUrls.has(trimmed)) {
        notifyDebugVerbose('Skipping text/plain because it duplicates an already-processed URL');
      } else if (looksLikeSingleUrl && !seenUrls.has(trimmed)) {
        // Treat single URL in plain text as a file source (common on macOS/iOS paste)
        notifyDebugVerbose('Processing single URL found in text/plain');
        try {
          const card = await cardFromFile(trimmed, { source: 'clipboard' });
          cards.push(card);
          seenUrls.add(trimmed);
        } catch (error) {
          postError(`Failed to process URL ${trimmed} from plain text clipboard, caused by ${String(error)}`);
        }
      } else {
        // General text content
        notifyDebugVerbose('Processing pasted text content', textData);
        try {
          const textCard = cardFromText(textData, { source: 'clipboard' });
          cards.push(textCard);
        } catch (error) {
          postError(`Failed to process text content from clipboard, caused by ${String(error)}`);
        }
      }
    }
  }

  notifyInfo(`Paste processing completed: ${cards.length} card(s) created; ${errors.length} error(s)`);
  return { cards, errors };
}
