/// <reference types="chrome-types" />

import { binaryToBase64 } from '../functions/utils';
import { NotificationMessage } from '../functions/notification';

interface FileData {
  name: string;
  content: string;
  type: string;
}

interface MessageRequest {
  action: string;
  filePath?: string;
  tabId?: number;
  prompt?: string;
  files?: FileData[];
  binary?: boolean;
  theme?: string;
}

interface MessageResponse {
  success: boolean;
  content?: string;
  base64Data?: string;
  error?: string;
  theme?: string;
}

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => console.error(error));
  }
});

// Handle messages from content script/sidepanel
chrome.runtime.onMessage.addListener(
  (
    request: MessageRequest | NotificationMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void,
  ): boolean => {
    // Handle notification messages
    if ('type' in request && request.type === 'notification') {
      const notificationMsg = request as NotificationMessage;

      // Forward notification to all UI contexts (popup, sidebar, etc.)
      chrome.runtime.sendMessage(notificationMsg).catch(() => {
        // If no UI is open, the message will fail, which is fine
        console.debug('[Background] No UI available to receive notification');
      });

      // Also try to send to any open extension tabs
      chrome.tabs.query({ url: chrome.runtime.getURL('*') }, (tabs) => {
        tabs.forEach((tab) => {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, notificationMsg).catch(() => {
              // Tab might not have a listener, which is fine
            });
          }
        });
      });

      sendResponse({ success: true });
      return true;
    }

    // Cast to MessageRequest for action-based messages
    const messageRequest = request as MessageRequest;

    // Handle theme storage operations
    if (messageRequest.action === 'getTheme') {
      chrome.storage.local.get(['theme'], (result) => {
        sendResponse({ success: true, theme: result.theme || 'auto' });
      });
      return true;
    } else if (messageRequest.action === 'setTheme') {
      if (!messageRequest.theme) {
        sendResponse({ success: false, error: 'No theme provided' });
        return true;
      }

      chrome.storage.local.set({ theme: messageRequest.theme }, () => {
        // FIXME: Handle potential errors
        // const error = chrome.runtime.lastError;
        const error = { message: 'unknown error' }; // Mock error for demonstration
        if (error) {
          sendResponse({ success: false, error: error.message });
        } else {
          sendResponse({ success: true });
        }
      });
      return true;
    } else if (messageRequest.action === 'readFile') {
      if (!messageRequest.filePath) {
        sendResponse({ success: false, error: 'No file path provided' });
        return true;
      }

      readFileContent(messageRequest.filePath, messageRequest.binary)
        .then((result) => {
          if (messageRequest.binary) {
            // Convert ArrayBuffer to base64 for message passing
            const arrayBuffer = result as ArrayBuffer;
            const base64 = binaryToBase64(arrayBuffer);
            sendResponse({ success: true, base64Data: base64 });
          } else {
            sendResponse({ success: true, content: result as string });
          }
        })
        .catch((error) => {
          console.error('Error reading file:', error);
          sendResponse({ success: false, error: error.message });
        });

      // Return true to indicate we will send a response asynchronously
      return true;
    } else if (
      messageRequest.action === 'extractContent' ||
      messageRequest.action === 'extractPageContent' ||
      messageRequest.action === 'extractWordContent' ||
      messageRequest.action === 'extractMsWordContent' ||
      messageRequest.action === 'extractPdfContent' ||
      messageRequest.action === 'extractHtmlContent'
    ) {
      if (!messageRequest.tabId) {
        sendResponse({ success: false, error: 'No tab ID provided' });
        return true;
      }

      extractContent(messageRequest.tabId)
        .then((content) => {
          sendResponse({ success: true, content: content });
        })
        .catch((error) => {
          console.error('Error extracting content:', error);
          sendResponse({ success: false, error: error.message });
        });

      // Return true to indicate we will send a response asynchronously
      return true;
    }

    return false;
  },
);

async function readFileContent(filePath: string, binary: boolean = false): Promise<string | ArrayBuffer> {
  try {
    // Normalize the file path
    let normalizedPath = filePath.trim();

    // Handle different path formats
    if (normalizedPath.startsWith('~/')) {
      // Cannot resolve ~ in browser extension context
      throw new Error('Cannot resolve ~ path in extension context');
    }

    // Ensure path starts with file:// protocol
    if (!normalizedPath.startsWith('file://')) {
      if (normalizedPath.startsWith('/')) {
        normalizedPath = 'file://' + normalizedPath;
      } else {
        throw new Error('Invalid file path format');
      }
    }

    // Attempt to fetch the file
    const response = await fetch(normalizedPath);

    if (!response.ok) {
      throw new Error(`File not found or access denied: ${response.status}`);
    }

    if (binary) {
      const arrayBuffer = await response.arrayBuffer();
      return arrayBuffer;
    } else {
      const content = await response.text();
      return content;
    }
  } catch (error) {
    // If fetch fails, try alternative approaches or provide helpful error
    if (error instanceof Error && error.message.includes('Not allowed to load local resource')) {
      throw new Error(
        'Browser security policy prevents reading local files. Try using a local server or file input instead.',
      );
    }
    throw error;
  }
}

async function extractContent(tabId: number): Promise<any> {
  try {
    if (!chrome.scripting) {
      throw new Error('Chrome scripting API not available');
    }

    console.log(`[DEBUG] Starting unified content extraction for tab ${tabId}`);

    // Inject the content extractor script that includes all extraction capabilities
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['contentScript.js'],
    });

    console.log(`[DEBUG] Content extractor script injected`);

    // Now execute the extraction function - the content script will auto-detect document type
    const extractionResults = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: async () => {
        // The contentScript.js should have made extractContent available globally
        if (typeof (window as any).extractContent === 'function') {
          const result = await (window as any).extractContent();
          return result;
        } else {
          console.error('[DEBUG] extractContent function not found');
          // Return fallback CardModel array
          return [
            {
              id: `fallback-${Date.now()}`,
              title: document.title || 'Untitled',
              content: {
                type: 'text',
                value: document.body ? document.body.innerText || document.body.textContent || '' : '',
              },
              componentType: 'Paragraph',
              metadata: {
                source: 'web',
                url: document.location.href,
                tags: ['fallback'],
              },
            },
          ];
        }
      },
    });

    console.log('[DEBUG] Script execution completed');
    console.log('[DEBUG] Extraction results:', extractionResults);

    if (extractionResults && extractionResults[0] && extractionResults[0].result) {
      const cards = extractionResults[0].result;
      console.log('[DEBUG] Extracted cards count:', Array.isArray(cards) ? cards.length : 'not an array');

      // Return the CardModel array directly
      return cards;
    } else {
      console.log('[DEBUG] No results returned from script execution');
      throw new Error('Could not extract content from page - no results returned');
    }
  } catch (error) {
    console.error('[DEBUG] Error in background extractContent:', error);
    throw error;
  }
}
