import { everywhere } from '@common/rpc';
import { CardModel } from '@common/types';
import { cardFromHtml } from '@common/imports/html';
import { notifyError, notifyInfo, notifyDebug, notifyDebugVerbose } from '@common/notification';
import { cardFromPdf } from '@contentScript/registry';

/**
 * When user hit the button to extract the current tab content
 *
 * One page, must only return one card. Or zero, if error.
 */
export async function processTabEvent(): Promise<CardModel[]> {
  const result = await processTabEventAndThrow();
  // Ignore errors here; they were already notified.
  return result.card;
}

export async function processTabEventAndThrow(): Promise<{ card: CardModel[]; errors: string[] }> {
  const cards: CardModel[] = [];
  const errors: string[] = [];

  notifyDebugVerbose('Processing tab content extraction event');

  const postError = (msg: string, object?: any) => {
    errors.push(msg);
    if (object !== undefined) {
      notifyError(msg, object);
    } else {
      notifyError(msg);
    }
  };

  try {
    const tabCards = await extractTabContent();
    cards.push(...tabCards);
    if (cards.length === 0) {
      postError('No content could be extracted from the current tab');
    } else {
      notifyInfo(`Tab processing completed: ${cards.length} card(s) created`);
    }
  } catch (error) {
    postError(`Failed to extract tab content: ${String(error)}`, error);
  }

  return { card: cards, errors };
}

async function _extractTabContent(): Promise<CardModel[]> {
  notifyDebug('Extracting content from current tab');

  try {
    // Get the current document
    const currentDoc = document;
    if (!currentDoc) {
      throw new Error('No document available to extract from');
    }

    const url = currentDoc.location?.href;
    notifyDebugVerbose('Current document:', {
      url: url,
      title: currentDoc.title,
    });

    let card: CardModel;
    if (isPdfDocument(url)) {
      notifyInfo('Detected PDF document');
      card = await cardFromPdf(url, { source: 'webpage' });
    } else {
      // Use cardFromHtml to extract content from the current page
      notifyDebug('Using HTML content extractor for webpage');
      card = await cardFromHtml(currentDoc, {
        source: 'webpage',
        parser: 'complex',
      });
    }

    return [card];
  } catch (error) {
    notifyError('Failed to extract tab content', error);
    throw error;
  }
}

export const extractTabContent = everywhere('extractTabContent', _extractTabContent, ['content']);

export function isPdfDocument(url?: string): boolean {
  const targetUrl = url || document.location.href;
  return targetUrl.toLowerCase().includes('.pdf') || document.contentType === 'application/pdf';
}
