import * as assert from 'assert';
import { pomlVscodePanelContent } from '../panel/content';
import { Message } from 'poml';

test('panel embeds line numbers', () => {
  const msg: Message = { speaker: 'ai', content: 'hello' };
  const html = pomlVscodePanelContent({
    source: 'source',
    line: 0,
    lineCount: 1,
    locked: false,
    scrollPreviewWithEditor: false,
    scrollEditorWithPreview: false,
    doubleClickToSwitchToEditor: false,
    speakerMode: true,
    displayFormat: 'plain',
    rawText: '<p speaker="ai">hello</p>',
    ir: '',
    content: [msg],
    sourceMap: [{ startIndex: 0, endIndex: 20, speaker: 'ai', content: [{ startIndex: 0, endIndex: 20, content: 'hello' }] }],
    extensionResourcePath: p => p,
    localResourcePath: p => p,
  });
  assert.ok(html.includes('data-line="0"'));
});
