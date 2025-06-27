/** @jest-environment jsdom */

import { describe, test, expect, jest } from '@jest/globals';
import { spawnSync } from 'child_process';
import path from 'path';

function computeIr(raw: string): string {
  const script = `const { read } = require('${path
    .resolve(__dirname, '../../../out/poml/index.js')
    .replace(/\\/g, '\\\\')}');\nread(${JSON.stringify(raw)}).then(r=>process.stdout.write(r));`;
  const result = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr);
  }
  return result.stdout;
}
(global as any).MessageChannel = require('worker_threads').MessageChannel;
(global as any).TextEncoder = require('util').TextEncoder;
(global as any).TextDecoder = require('util').TextDecoder;

function setupWebview(html: string, vscode: any) {
  document.documentElement.innerHTML = html;
  (global as any).acquireVsCodeApi = () => vscode;
  jest.resetModules();
  require('../index');
}

describe('jump to source', () => {
  test('double click posts didClick message', () => {
    const raw = '<p><p speaker="ai">hello</p><p speaker="human">world</p></p>';
    const ir = computeIr(raw);
    const content = [
      { speaker: 'ai', content: 'hello' },
      { speaker: 'human', content: 'world' }
    ];
    const state = {
      source: 'file.poml',
      line: 0,
      lineCount: raw.split(/\r?\n/).length,
      locked: false,
      scrollPreviewWithEditor: false,
      scrollEditorWithPreview: false,
      doubleClickToSwitchToEditor: true,
      speakerMode: true,
      displayFormat: 'rendered',
      rawText: raw,
      ir,
      content
    };
    const html = `<meta id="webview-state" data-state='${JSON.stringify(state)}'>
    <div class="chat-message" data-offset="3">
      <div class="chat-message-toolbar">
        <a class="codicon codicon-code" role="button"></a>
      </div>
    </div>`;
    const vscode = { postMessage: jest.fn(), setState: jest.fn() } as any;
    setupWebview(html, vscode);

    const msg = document.querySelector('.chat-message') as HTMLElement;
    msg.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

    expect(vscode.postMessage).toHaveBeenCalledWith({
      type: 'didClick',
      source: 'file.poml',
      body: { line: 0 }
    });
  });

  test('message button posts didClick message', () => {
    const raw = '<p><p speaker="ai">hello</p><p speaker="human">world</p></p>';
    const ir = computeIr(raw);
    const content = [
      { speaker: 'ai', content: 'hello' },
      { speaker: 'human', content: 'world' }
    ];
    const state = {
      source: 'file.poml',
      line: 0,
      lineCount: raw.split(/\r?\n/).length,
      locked: false,
      scrollPreviewWithEditor: false,
      scrollEditorWithPreview: false,
      doubleClickToSwitchToEditor: true,
      speakerMode: true,
      displayFormat: 'rendered',
      rawText: raw,
      ir,
      content
    };
    const html = `<meta id="webview-state" data-state='${JSON.stringify(state)}'>
    <div class="chat-message" data-offset="3">
      <div class="chat-message-toolbar">
        <a class="codicon codicon-code" role="button"></a>
      </div>
    </div>`;
    const vscode = { postMessage: jest.fn(), setState: jest.fn() } as any;
    setupWebview(html, vscode);
    const poster = require('../util').createPosterForVsCode(vscode);
    const { setupToolbar } = require('../toolbar');
    setupToolbar(vscode, poster);

    (document.querySelector('.codicon-code') as HTMLElement).dispatchEvent(
      new MouseEvent('click', { bubbles: true })
    );

    expect(vscode.postMessage).toHaveBeenCalledWith({
      type: 'didClick',
      source: 'file.poml',
      body: { line: 0 }
    });
  });

  test('double click plain text span posts didClick', () => {
    const raw = '<p>hello <b>world</b></p>';
    const ir = computeIr(raw);
    const state = {
      source: 'file.poml',
      line: 0,
      lineCount: raw.split(/\r?\n/).length,
      locked: false,
      scrollPreviewWithEditor: false,
      scrollEditorWithPreview: false,
      doubleClickToSwitchToEditor: true,
      speakerMode: false,
      displayFormat: 'plain',
      rawText: raw,
      ir,
      content: 'hello **world**'
    };
    const html = `<meta id="webview-state" data-state='${JSON.stringify(state)}'>
    <pre><code><span data-offset="0">hello </span><span data-offset="6">**world**</span></code></pre>`;
    const vscode = { postMessage: jest.fn(), setState: jest.fn() } as any;
    setupWebview(html, vscode);
    const span = document.querySelector('span[data-offset="6"]') as HTMLElement;
    span.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(vscode.postMessage).toHaveBeenCalledWith({
      type: 'didClick',
      source: 'file.poml',
      body: { line: 0 }
    });
  });
});
