import $ from 'jquery';
import { createPosterForVsCode } from './util';
import { getState } from './state';
import { setupToolbar } from './toolbar';
import {
  getEditorLineNumberForPageOffset,
  offsetToLine,
  ActiveLineMarker
} from './scrollSync';

import throttle from 'lodash.throttle';

declare let acquireVsCodeApi: any;

const marker = new ActiveLineMarker();
const state = getState();
const vscode = acquireVsCodeApi();
vscode.setState(state);

const messaging = createPosterForVsCode(vscode);

$(() => {
  setupToolbar(vscode, messaging);
  // if (state.scrollPreviewWithEditor) {
  //     setTimeout(() => {
  //         const initialLine = +state.line;
  //         if (!isNaN(initialLine)) {
  //             scrollDisabled = true;
  //         }
  //     }, 0);
  // }
});

const onUpdateView = (() => {
  const doScroll = throttle((line: number) => {
    // scrollDisabled = true;
  }, 50);

  return (line: number, state: any) => {
    if (!isNaN(line)) {
      state.line = line;
      doScroll(line);
    }
  };
})();

window.addEventListener('resize', () => {
  // scrollDisabled = true;
}, true);

window.addEventListener('message', event => {
  if (event.data.source !== state.source) {
    return;
  }

  switch (event.data.type) {
    case 'onDidChangeTextEditorSelection':
      marker.onDidChangeTextEditorSelection(event.data.line);
      break;

    case 'updateView':
      onUpdateView(event.data.line, state);
      break;
  }
}, false);

document.addEventListener('dblclick', event => {
  if (!state.doubleClickToSwitchToEditor) {
    return;
  }

  for (let node = event.target as HTMLElement | null; node; node = node.parentElement) {
    if (node.tagName === 'A') {
      return;
    }

    const dataOffset = node.getAttribute('data-offset');
    if (dataOffset) {
      const offset = parseInt(dataOffset, 10);
      if (!isNaN(offset)) {
        const line = offsetToLine(offset, (state as any).rawText);
        messaging.postMessage('didClick', { line });
        return;
      }
    }
  }

  const offset = event.pageY;
  const line = getEditorLineNumberForPageOffset(offset);
  if (typeof line === 'number' && !isNaN(line)) {
    messaging.postMessage('didClick', { line: Math.floor(line) });
  }
});

document.addEventListener(
  'click',
  event => {
    if (!event) {
      return;
    }

    let node: HTMLElement | null = event.target as HTMLElement;
    while (node) {
      if (node.tagName === 'A' && (node as HTMLAnchorElement).href) {
        const href = (node as HTMLAnchorElement).getAttribute('href') || '';
        if (href.startsWith('#')) {
          break;
        }
        if (href.startsWith('file://') || href.startsWith('vscode-resource:')) {
          const [path, fragment] = href
            .replace(/^(file:\/\/|vscode-resource:)/i, '')
            .split('#');
          messaging.postCommand('_html.openDocumentLink', [{ path, fragment }]);
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        break;
      }
      node = node.parentElement;
    }
  },
  true
);

// Scroll sync is currently disabled pending further implementation.
