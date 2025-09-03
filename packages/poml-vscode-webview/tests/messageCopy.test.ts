/** @jest-environment jsdom */

import $ from 'jquery';
import { describe, test, expect, jest } from '@jest/globals';
import { setupToolbar } from '../toolbar';

jest.mock('../state', () => ({
  getState: () => ({}),
}));

describe('message copy button', () => {
  test('click copies message text', () => {
    document.body.innerHTML = `
      <div class="chat-message">
        <div class="chat-message-toolbar">
          <div class="toolbar-item">
            <a class="codicon codicon-copy" role="button" data-value="msg"></a>
          </div>
        </div>
      </div>
    `;

    (navigator as any).clipboard = { writeText: jest.fn() };

    const vscode = { setState: jest.fn() } as any;
    const messaging = { postMessage: jest.fn() } as any;

    setupToolbar(vscode, messaging);
    $('.codicon-copy').trigger('click');

    expect((navigator as any).clipboard.writeText).toHaveBeenCalledWith('msg');
  });
});
