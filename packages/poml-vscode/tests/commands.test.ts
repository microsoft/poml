import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Commands', () => {
  test('expected commands are registered', async () => {
    const ext = vscode.extensions.getExtension('poml-team.poml');
    await ext?.activate();
    const cmds = await vscode.commands.getCommands(true);
    const expected = [
      'poml.test',
      'poml.testNonChat',
      'poml.testRerun',
      'poml.testAbort',
      'poml.showPreview',
      'poml.showPreviewToSide',
      'poml.showLockedPreviewToSide',
      'poml.showSource',
      'poml.telemetry.completion',
    ];
    for (const id of expected) {
      assert.ok(cmds.includes(id), `Missing command ${id}`);
    }
  });
});
