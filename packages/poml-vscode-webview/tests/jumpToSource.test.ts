/** @jest-environment jsdom */

import $ from 'jquery';
import { describe, test, expect, jest } from '@jest/globals';
import { setupToolbar } from '../toolbar';

jest.mock('../state', () => ({
  getState: () => ({ doubleClickToSwitchToEditor: true }),
}));

describe('jump to source', () => {
  test('button click posts message', () => {
    document.body.innerHTML = `
      <div class="chat-message">
        <div class="chat-message-toolbar">
          <div class="toolbar-item">
            <a class="codicon codicon-code" role="button" data-line="3"></a>
          </div>
        </div>
      </div>`;
    const vscode = { setState: jest.fn() } as any;
    const messaging = { postMessage: jest.fn() } as any;
    setupToolbar(vscode, messaging);
    $('.codicon-code').trigger('click');
    expect(messaging.postMessage).toHaveBeenCalledWith('didClick', { line: 3 });
  });

  test('double click posts message', () => {
    document.body.innerHTML = `<div data-line="2">text</div>`;
    const vscode = { setState: jest.fn() } as any;
    const messaging = { postMessage: jest.fn() } as any;
    setupToolbar(vscode, messaging);
    $('[data-line="2"]').trigger('dblclick');
    expect(messaging.postMessage).toHaveBeenCalledWith('didClick', { line: 2 });
  });
});
