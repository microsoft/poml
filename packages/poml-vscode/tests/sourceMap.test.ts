import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import { getClient } from '../extension';
import { PreviewMethodName, PreviewResponse } from '../panel/types';

suite('Source map from server', () => {
  test('server returns mappings', async function() {
    this.timeout(10000);
    const sample = path.resolve(__dirname, '../../../packages/poml-vscode/test-fixtures/test.poml');
    const uri = vscode.Uri.file(sample);
    const client = getClient();
    const resp = await client.sendRequest<PreviewResponse>(PreviewMethodName, {
      uri: uri.toString(),
      speakerMode: true,
      displayFormat: 'plain'
    });
    assert.ok(resp.sourceMap, 'missing sourceMap');
    assert.ok(Array.isArray(resp.sourceMap));
  });
});
