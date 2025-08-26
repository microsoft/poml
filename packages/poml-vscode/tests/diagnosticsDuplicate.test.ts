import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

suite('Diagnostics duplicates', () => {
  test('diagnostics are not duplicated on save', async function () {
    this.timeout(20000);
    const bad = path.resolve(__dirname, '../../../packages/poml-vscode/test-fixtures/badSyntax.poml');
    const uri = vscode.Uri.file(bad);
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc);

    await new Promise((resolve) => setTimeout(resolve, 1500));

    let diags = vscode.languages.getDiagnostics(uri);
    assert.strictEqual(diags.length, 1, 'Expected one diagnostic before save');

    await doc.save();
    await new Promise((resolve) => setTimeout(resolve, 1500));

    diags = vscode.languages.getDiagnostics(uri);
    assert.strictEqual(diags.length, 1, 'Expected diagnostics not to duplicate after save');
  });
});
