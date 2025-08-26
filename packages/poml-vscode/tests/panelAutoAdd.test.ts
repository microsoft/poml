import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

import { POMLWebviewPanel } from '../panel/panel';
import { SettingsManager } from '../settings';
import { Logger } from '../util/logger';

class DummyTopmostLineMonitor {
  public readonly onDidChangeTopmostLine = (_: any) => {};
  dispose() {}
}

function canonical(p: string): string {
  return vscode.Uri.file(p).fsPath;
}

function createPanel(uri: vscode.Uri, context: vscode.ExtensionContext): POMLWebviewPanel {
  const webviewPanel = {
    viewColumn: vscode.ViewColumn.One,
    title: '',
    iconPath: undefined,
    webview: {
      html: '',
      options: {},
      postMessage: (_msg: any) => {},
      onDidReceiveMessage: () => new vscode.Disposable(() => {}),
      asWebviewUri: (u: vscode.Uri) => u,
    },
    onDidDispose: () => new vscode.Disposable(() => {}),
    onDidChangeViewState: () => new vscode.Disposable(() => {}),
    reveal: () => {},
    dispose: () => {},
  } as unknown as vscode.WebviewPanel;

  const PanelClass: any = POMLWebviewPanel;
  const panel = new PanelClass(
    webviewPanel,
    uri,
    false,
    { speakerMode: true, displayFormat: 'plain', contexts: [], stylesheets: [] },
    context,
    new SettingsManager(),
    new Logger(),
    new DummyTopmostLineMonitor() as any,
  );
  (panel as any).doUpdate = async () => {};
  (panel as any).onDidUserOptionsChange = async () => {};
  return panel;
}

suite('autoAddAssociatedFiles', () => {
  test('associated files are auto added', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'poml-'));
    const pomlPath = path.join(dir, 'sample.poml');
    const ctxPath = canonical(path.join(dir, 'sample.context.json'));
    const stylePath = canonical(path.join(dir, 'sample.stylesheet.json'));
    fs.writeFileSync(pomlPath, '<poml></poml>');
    fs.writeFileSync(ctxPath, '{}');
    fs.writeFileSync(stylePath, '{}');

    const ext = vscode.extensions.getExtension('poml-team.poml')!;
    const context = {
      extensionUri: ext.extensionUri,
      extensionPath: ext.extensionPath,
      subscriptions: [],
    } as unknown as vscode.ExtensionContext;

    const panel = createPanel(vscode.Uri.file(pomlPath), context);
    panel.update(vscode.Uri.file(pomlPath));

    const options = (panel as any)._userOptions;
    assert.ok(options.contexts.includes(ctxPath), 'context auto add');
    assert.ok(options.stylesheets.includes(stylePath), 'stylesheet auto add');

    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('manual changes prevent re-adding associated files', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'poml-'));
    const pomlPath = path.join(dir, 'sample.poml');
    const ctxPath = canonical(path.join(dir, 'sample.context.json'));
    const stylePath = canonical(path.join(dir, 'sample.stylesheet.json'));
    const customCtx = canonical(path.join(dir, 'custom.context.json'));
    fs.writeFileSync(pomlPath, '<poml></poml>');
    fs.writeFileSync(ctxPath, '{}');
    fs.writeFileSync(stylePath, '{}');
    fs.writeFileSync(customCtx, '{}');

    const ext = vscode.extensions.getExtension('poml-team.poml')!;
    const context = {
      extensionUri: ext.extensionUri,
      extensionPath: ext.extensionPath,
      subscriptions: [],
    } as unknown as vscode.ExtensionContext;

    const panel = createPanel(vscode.Uri.file(pomlPath), context);
    panel.update(vscode.Uri.file(pomlPath));

    panel.addContext(customCtx);
    panel.removeContext(ctxPath);
    panel.removeStylesheet(stylePath);
    panel.update(vscode.Uri.file(pomlPath));

    const options = (panel as any)._userOptions;
    assert.deepStrictEqual(options.contexts, [customCtx], 'contexts should match manual changes');
    assert.deepStrictEqual(options.stylesheets, [], 'stylesheets should match manual changes');

    fs.rmSync(dir, { recursive: true, force: true });
  });
});
