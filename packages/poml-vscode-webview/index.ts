import $ from 'jquery';
import { createPosterForVsCode } from './util';
import { getState } from './state';
import { setupToolbar } from './toolbar';

import throttle from 'lodash.throttle';

declare let acquireVsCodeApi: any;

// var scrollDisabled = true;
// const marker = new ActiveLineMarker();
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
      // FIXME
      // marker.onDidChangeTextEditorSelection(event.data.line);
      break;

    case 'updateView':
      onUpdateView(event.data.line, state);
      break;
  }
}, false);

document.addEventListener('click', event => {
  if (!event) {
    return;
  }

  // FIXME: click links for opening documents in editor
  // let node: any = event.target;
  // while (node) {
  //     if (node.tagName && node.tagName === 'A' && node.href) {
  //         if (node.getAttribute('href').startsWith('#')) {
  //             break;
  //         }
  //         if (node.href.startsWith('file://') || node.href.startsWith('vscode-resource:')) {
  //             const [path, fragment] = node.href.replace(/^(file:\/\/|vscode-resource:)/i, '').split('#');
  //             messaging.postCommand('_html.openDocumentLink', [{ path, fragment }]);
  //             event.preventDefault();
  //             event.stopPropagation();
  //             break;
  //         }
  //         break;
  //     }
  //     node = node.parentNode;
  // }
}, true);

// FIXME: scroll sync
// if (state.scrollEditorWithPreview) {
//     window.addEventListener('scroll', throttle(() => {
//         if (scrollDisabled) {
//             scrollDisabled = false;
//         } else {
//             const line = getEditorLineNumberForPageOffset(window.scrollY);
//             if (typeof line === 'number' && !isNaN(line)) {
//                 messaging.postMessage('revealLine', { line });
//             }
//         }
//     }, 50));
// }