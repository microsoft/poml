import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

suite('LSP Server', () => {
  const extId = 'poml-team.poml';

  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension(extId);
    assert.ok(ext, 'Extension not found');
    await ext!.activate();
  });

  teardown(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    // give LSP server time to clear diagnostics
    await new Promise(resolve => setTimeout(resolve, 500));
  });

  test('diagnostics are produced for bad files', async function() {
    this.timeout(20000);
    const bad = path.resolve(
      __dirname,
      '../../../packages/poml-vscode/test-fixtures/badSyntaxLsp.poml'
    );
    const uri = vscode.Uri.file(bad);
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc);
    await new Promise(resolve => setTimeout(resolve, 1500));
    const diags = vscode.languages.getDiagnostics(uri);
    assert.ok(diags.length > 0, 'Expected diagnostics for bad file');
  });

  test('no diagnostics for valid files', async function() {
    this.timeout(20000);
    const good = path.resolve(
      __dirname,
      '../../../packages/poml-vscode/test-fixtures/test.poml'
    );
    const uri = vscode.Uri.file(good);
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc);
    await new Promise(resolve => setTimeout(resolve, 1500));
    const diags = vscode.languages.getDiagnostics(uri);
    assert.strictEqual(diags.length, 0, 'Expected no diagnostics for clean file');
  });

  test('hover provides documentation', async function() {
    this.timeout(20000);
    const sample = path.resolve(__dirname, '../../../packages/poml-vscode/test-fixtures/test.poml');
    const uri = vscode.Uri.file(sample);
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc);
    await new Promise(resolve => setTimeout(resolve, 1500));
    const pos = new vscode.Position(0, 1); // inside <p>
    const hovers = (await vscode.commands.executeCommand('vscode.executeHoverProvider', uri, pos)) as vscode.Hover[];
    assert.ok(hovers && hovers.length > 0, 'No hover result');
    const text = (hovers[0].contents[0] as any).value ?? '';
    assert.ok(/Paragraph/.test(text), 'Hover text does not mention Paragraph');
  });

  test('completion suggests attributes', async function() {
    this.timeout(20000);
    const doc = await vscode.workspace.openTextDocument({ language: 'poml', content: '<question sp' });
    await vscode.window.showTextDocument(doc);
    await new Promise(resolve => setTimeout(resolve, 1500));
    const pos = new vscode.Position(0, doc.getText().length);
    const list = (await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', doc.uri, pos)) as vscode.CompletionList;
    const labels = list.items.map(item => (typeof item.label === 'string' ? item.label : item.label.label));
    assert.ok(labels.includes('speaker'), 'Expected "speaker" completion');
  });
});

