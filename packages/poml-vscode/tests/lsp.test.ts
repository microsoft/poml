import * as assert from 'assert';
import { PomlLspServer } from '../lsp/server';
import { PreviewParams } from '../panel/types';

suite('Language Server', () => {
  test('computePreviewResponse includes mappings', async () => {
    const server = new PomlLspServer();
    const raw = '<p><p speaker="ai">hello</p><p speaker="human">world</p></p>';
    const params: PreviewParams = {
      uri: 'file:///test.poml',
      text: raw,
      speakerMode: true,
      displayFormat: 'rendered'
    } as any;
    const res = await server.computePreviewResponse(params);
    assert.deepStrictEqual(res.messageOffsets, [3, 35]);
    assert.ok(Array.isArray(res.plainSpans) && res.plainSpans.length > 0);
  });
});
