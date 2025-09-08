/// <reference types="chrome-types" />

import './registry';

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => console.error(error));
  }
});

// Handle messages from content script/sidepanel
chrome.runtime.onMessage.addListener(
  (request: any, sender: chrome.runtime.MessageSender, sendResponse: (response: unknown) => void): boolean => {
    // Handle sidebar open request for testing
    if (request && request.action === 'devSidePanel') {
      (async () => {
        if (sender.tab) {
          await (chrome as any).sidePanel.open({ windowId: sender.tab.windowId });
          await chrome.sidePanel.setOptions({
            path: 'ui/index.html',
            enabled: true,
          });
        }
      })();
    }

    return false; // not handled here
  },
);

(self as any).__pomlBackgroundReady = true; // Indicate that the background script has loaded
