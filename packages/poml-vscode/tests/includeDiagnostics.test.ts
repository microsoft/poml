import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

suite('Include diagnostics', () => {
  test('errors in included files are reported', async function () {
    this.timeout(20000);
    const main = path.resolve(__dirname, '../../../packages/poml-vscode/test-fixtures/includeMain.poml');
    const bad = path.resolve(__dirname, '../../../packages/poml-vscode/test-fixtures/badInclude.poml');

    const mainUri = vscode.Uri.file(main);
    const doc = await vscode.workspace.openTextDocument(mainUri);
    await vscode.window.showTextDocument(doc);

    // wait for diagnostics to be processed
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const badUri = vscode.Uri.file(bad);
    const diags = vscode.languages.getDiagnostics(badUri);
    assert.strictEqual(diags.length, 1, 'Expected one diagnostic for included file');
    assert.ok(/Expecting token/.test(diags[0].message), 'Unexpected diagnostic message');
  });
});
