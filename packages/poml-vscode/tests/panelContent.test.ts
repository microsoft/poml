import * as assert from 'assert';
import * as cheerio from 'cheerio';
import { read } from 'poml';
import { computeMessageOffsets, computePlainSpans } from '../util/sourceMap';
import { pomlVscodePanelContent } from '../panel/content';

suite('Panel content helper', () => {
  test('basic rendering works', async () => {
    const raw = '<p>test</p>';
    const ir = await read(raw);
    const html = pomlVscodePanelContent({
      source: 'source',
      line: 0,
      lineCount: 1,
      locked: false,
      scrollPreviewWithEditor: false,
      scrollEditorWithPreview: false,
      doubleClickToSwitchToEditor: false,
      speakerMode: true,
      displayFormat: 'rendered',
      rawText: raw,
      ir,
      content: [],
      extensionResourcePath: (p: string) => p,
      localResourcePath: (p: string) => p,
    });
    assert.ok(html.includes('test'));
  });

  test('webview state contains source mappings', async () => {
    const raw = '<p>test</p>';
    const ir = await read(raw);
    const content: any[] = [];
    const html = pomlVscodePanelContent({
      source: 'file.poml',
      line: 0,
      lineCount: 1,
      locked: false,
      scrollPreviewWithEditor: false,
      scrollEditorWithPreview: false,
      doubleClickToSwitchToEditor: false,
      speakerMode: true,
      displayFormat: 'rendered',
      rawText: raw,
      ir,
      content: content as any,
      extensionResourcePath: (p: string) => p,
      localResourcePath: (p: string) => p,
    });
    const $ = cheerio.load(html);
    const state = JSON.parse($('#webview-state').attr('data-state')!);
    assert.ok(state.ir.includes('original-start-index'));
  });

  test('chat messages have data-offset attributes', async () => {
    const raw = '<p><p speaker="ai">hello</p><p speaker="human">world</p></p>';
    const ir = await read(raw);
    const content = [
      { speaker: 'ai', content: 'hello' },
      { speaker: 'human', content: 'world' }
    ];
    const offsets = computeMessageOffsets(ir);
    const html = pomlVscodePanelContent({
      source: 'file.poml',
      line: 0,
      lineCount: raw.split(/\r?\n/).length,
      locked: false,
      scrollPreviewWithEditor: false,
      scrollEditorWithPreview: false,
      doubleClickToSwitchToEditor: false,
      speakerMode: true,
      displayFormat: 'rendered',
      rawText: raw,
      ir,
      content: content as any,
      messageOffsets: offsets,
      extensionResourcePath: (p: string) => p,
      localResourcePath: (p: string) => p,
    });
    const $ = cheerio.load(html);
    const domOffsets = $('.chat-message').map((_: any, el: any) => $(el).attr('data-offset')).get();
    assert.deepStrictEqual(domOffsets.map(Number), offsets);
  });

  test('plain text spans have data-offset attributes', async () => {
    const raw = '<p>hello <b>world</b></p>';
    const ir = await read(raw);
    const spansData = computePlainSpans(ir);
    const html = pomlVscodePanelContent({
      source: 'file.poml',
      line: 0,
      lineCount: raw.split(/\r?\n/).length,
      locked: false,
      scrollPreviewWithEditor: false,
      scrollEditorWithPreview: false,
      doubleClickToSwitchToEditor: false,
      speakerMode: false,
      displayFormat: 'plain',
      rawText: raw,
      ir,
      content: 'hello **world**',
      plainSpans: spansData,
      extensionResourcePath: (p: string) => p,
      localResourcePath: (p: string) => p,
    });
    const $ = cheerio.load(html);
    const spans = $('pre code span');
    const offsets = spans.map((_: any, el: any) => $(el).attr('data-offset')).get();
    const expected = spansData.map(s => s.offset);
    assert.deepStrictEqual(offsets.map(Number), expected);
  });
});
