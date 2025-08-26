/** @jest-environment jsdom */

import $ from 'jquery';
import { describe, test, expect, jest } from '@jest/globals';
import { setupToolbar } from '../toolbar';

jest.mock('../state', () => ({
  getState: () => ({}),
}));

describe('toolbar copy button', () => {
  test('click copies content to clipboard', () => {
    document.body.innerHTML = `
      <div class="toolbar">
        <div class="button oneclick" id="copy"></div>
      </div>
      <div id="copy-content" data-value="hello"></div>
    `;

    (navigator as any).clipboard = { writeText: jest.fn() };

    const vscode = { setState: jest.fn() } as any;
    const messaging = { postMessage: jest.fn() } as any;

    setupToolbar(vscode, messaging);
    $('#copy').trigger('click');

    expect((navigator as any).clipboard.writeText).toHaveBeenCalledWith('hello');
  });
});
