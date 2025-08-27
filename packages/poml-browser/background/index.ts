/// <reference types="chrome-types" />

import './registry';
import { binaryToBase64 } from '../functions/utils';

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
}

interface MessageResponse {
  success: boolean;
  content?: string;
  base64Data?: string;
  error?: string;
}

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => console.error(error));
  }
});

// Handle messages from content script/sidepanel
chrome.runtime.onMessage.addListener(
  (
    request: MessageRequest,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void,
  ): boolean => {
    // Handle file operations
    if (request.action === 'readFile') {
      if (!request.filePath) {
        sendResponse({ success: false, error: 'No file path provided' });
        return true;
      }

      readFileContent(request.filePath, request.binary)
        .then((result) => {
          if (request.binary) {
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
      request.action === 'extractContent' ||
      request.action === 'extractPageContent' ||
      request.action === 'extractWordContent' ||
      request.action === 'extractMsWordContent' ||
      request.action === 'extractPdfContent' ||
      request.action === 'extractHtmlContent'
    ) {
      if (!request.tabId) {
        sendResponse({ success: false, error: 'No tab ID provided' });
        return true;
      }

      extractContentProxy(request.tabId)
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

async function extractContentProxy(tabId: number): Promise<any> {
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
