import { describe, test, expect, jest } from '@jest/globals';
import { createPosterForVsCode } from '../util';

jest.mock('../state', () => ({
  getState: () => ({ source: 'test-source' }),
}));

describe('createPosterForVsCode', () => {
  test('postMessage sends payload to vscode', () => {
    const vscode = { postMessage: jest.fn() };
    const poster = createPosterForVsCode(vscode);
    poster.postMessage('type', { foo: 'bar' });
    expect(vscode.postMessage).toHaveBeenCalledWith({
      type: 'type',
      source: 'test-source',
      body: { foo: 'bar' },
    });
  });

  test('postCommand wraps command type', () => {
    const vscode = { postMessage: jest.fn() };
    const poster = createPosterForVsCode(vscode);
    poster.postCommand('cmd', [1, 2]);
    expect(vscode.postMessage).toHaveBeenCalledWith({
      type: 'command',
      source: 'test-source',
      body: { command: 'cmd', args: [1, 2] },
    });
  });
});
