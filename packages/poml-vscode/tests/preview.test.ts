import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

suite('Preview Feature', () => {
  test('showPreview executes without error', async function() {
    this.timeout(10000);
    const sample = path.resolve(__dirname, '../../../packages/poml-vscode/test-fixtures/test.poml');
    const uri = vscode.Uri.file(sample);
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc);
    await vscode.commands.executeCommand('poml.showPreview', uri);
    // give VS Code some time to process
    await new Promise(resolve => setTimeout(resolve, 1000));
    assert.ok(true);
  });
});
