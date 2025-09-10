import { everywhere } from '@common/rpc';
import { CardModel, TabInfo } from '@common/types';
import { cardFromHtml } from '@common/imports/html';
import { cardFromGdoc } from '@common/imports/gdoc';
import { cardFromMsword } from '@common/imports/msword';
import { notifyError, notifyInfo, notifyDebug, notifyDebugVerbose } from '@common/notification';
import { cardFromPdf } from '@common/imports/pdf';

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
    const tabInfo = await getTabInfo();
    const url = tabInfo.url;

    notifyDebugVerbose('Tab info:', tabInfo);

    let card: CardModel;

    // Route to appropriate extractor based on document type
    if (isPdfDocument(tabInfo)) {
      notifyInfo('Detected PDF document');
      card = await cardFromPdf(url, { source: 'webpage' });
    } else if (isGoogleDocsDocument(tabInfo)) {
      notifyInfo('Detected Google Docs document');
      card = await cardFromGdoc(url, { source: 'webpage' });
    } else if (isWordDocument(tabInfo)) {
      notifyInfo('Detected MS Word document');
      card = await cardFromMsword({ source: 'webpage' });
    } else {
      // Default to HTML content extractor
      notifyDebug('Using HTML content extractor for webpage');
      card = await cardFromHtml(document, {
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

/**
 * Get comprehensive tab information including document type detection
 */
async function _getTabInfo(): Promise<TabInfo> {
  const url = document.location.href;
  const title = document.title;
  const contentType = document.contentType || 'text/html';

  // Check document readiness
  const isReady = document.readyState === 'complete' || document.readyState === 'interactive';

  return {
    url,
    title,
    contentType,
    isReady,
  };
}

export const getTabInfo = everywhere('getTabInfo', _getTabInfo, ['content']);

/**
 * Check if the current document is a PDF document
 */
function isPdfDocument(tabInfo: TabInfo): boolean {
  return tabInfo.contentType === 'application/pdf' || tabInfo.url.toLowerCase().endsWith('.pdf');
}

/**
 * Check if the current document is a Word Online document
 */
function isWordDocument(tabInfo: TabInfo): boolean {
  // Check for Word Online specific indicators
  try {
    const wordPatterns = [
      /sharepoint\.com.*\/_layouts\/15\/Doc.aspx/,
      /office\.com.*\/edit/,
      /onedrive\.live\.com.*\/edit/,
      /sharepoint\.com.*\/edit/,
      /officeapps\.live\.com\/we\/wordeditorframe\.aspx/,
      /word-edit\.officeapps\.live\.com/,
    ];

    return wordPatterns.some((pattern) => pattern.test(tabInfo.url));
  } catch (error) {
    notifyError('Error checking for Word document.', error);
    return false;
  }
}

/**
 * Check if the current document is a Google Docs document
 */
function isGoogleDocsDocument(tabInfo: TabInfo): boolean {
  return tabInfo.url.includes('docs.google.com/document');
}
