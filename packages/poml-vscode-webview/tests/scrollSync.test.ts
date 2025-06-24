/** @jest-environment jsdom */

import { jest, describe, test, expect, beforeEach } from '@jest/globals';

const state = { lineCount: 3, scrollPreviewWithEditor: true };

jest.mock('../state', () => ({
  getState: () => state
}));

function setupDom() {
  document.body.innerHTML = `
    <div class="code-line" data-line="0"></div>
    <div class="code-line" data-line="1"></div>
    <div class="code-line" data-line="2"></div>
  `;
  const lines = Array.from(document.getElementsByClassName('code-line')) as HTMLElement[];
  lines.forEach((el, idx) => {
    (el as any).getBoundingClientRect = () => ({
      top: idx * 20,
      bottom: idx * 20 + 20,
      left: 0,
      right: 0,
      height: 20,
      width: 100,
      x: 0,
      y: idx * 20,
      toJSON() { }
    } as DOMRect);
  });
}

beforeEach(() => {
  jest.resetModules();
  setupDom();
  Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
});

describe('scrollSync', () => {
  test('getEditorLineNumberForPageOffset maps offsets to lines', () => {
    const { getEditorLineNumberForPageOffset } = require('../scrollSync');
    expect(getEditorLineNumberForPageOffset(10)).toBeCloseTo(0.5);
    expect(getEditorLineNumberForPageOffset(30)).toBeCloseTo(1.5);
    expect(getEditorLineNumberForPageOffset(70)).toBe(2);
    Object.defineProperty(window, 'scrollY', { value: 10, writable: true });
    expect(getEditorLineNumberForPageOffset(40)).toBeCloseTo(1.5);
  });

  test('offsetToLine converts offsets', () => {
    const { offsetToLine } = require('../scrollSync');
    const text = 'a\nb\nc';
    expect(offsetToLine(0, text)).toBe(0);
    expect(offsetToLine(2, text)).toBe(1);
    expect(offsetToLine(4, text)).toBe(2);
  });

  test('scrollToRevealSourceLine scrolls to element', () => {
    const { scrollToRevealSourceLine } = require('../scrollSync');
    const spy = jest.spyOn(window, 'scroll').mockImplementation(() => {});
    scrollToRevealSourceLine(1);
    expect(spy).toHaveBeenCalledWith(0, 20);
    spy.mockRestore();
  });
});
