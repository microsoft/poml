import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Activation', () => {
  test('extension activates', async () => {
    const ext = vscode.extensions.getExtension('poml-team.poml');
    assert.ok(ext, 'Extension not found');
    await ext?.activate();
    assert.ok(ext?.isActive, 'Extension did not activate');
  });
});
