import * as assert from 'assert';
import { pomlVscodePanelContent } from '../panel/content';

suite('Panel content helper', () => {
  test('basic rendering works', () => {
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
      contexts: [],
      stylesheets: [],
      rawText: '<p>test</p>',
      ir: '',
      content: [],
      extensionResourcePath: (p: string) => p,
      localResourcePath: (p: string) => p,
    });
    assert.ok(html.includes('test'));
  });
});
