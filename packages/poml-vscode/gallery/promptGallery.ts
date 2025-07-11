import * as vscode from 'vscode';
import * as path from 'path';

export interface PromptEntry {
  name: string;
  file: string;
}

const STORAGE_KEY = 'poml.promptGallery';

export class PromptGalleryProvider implements vscode.TreeDataProvider<PromptEntry> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private context: vscode.ExtensionContext) {}

  private get entries(): PromptEntry[] {
    return this.context.globalState.get<PromptEntry[]>(STORAGE_KEY, []);
  }

  private update(entries: PromptEntry[]) {
    void this.context.globalState.update(STORAGE_KEY, entries);
    this._onDidChangeTreeData.fire();
  }

  getChildren(): PromptEntry[] {
    return this.entries;
  }

  getTreeItem(element: PromptEntry): vscode.TreeItem {
    const item = new vscode.TreeItem(element.name, vscode.TreeItemCollapsibleState.None);
    item.resourceUri = vscode.Uri.file(element.file);
    item.command = { command: 'vscode.open', title: 'Open Prompt', arguments: [vscode.Uri.file(element.file)] };
    item.contextValue = 'pomlPrompt';
    return item;
  }

  addPrompt(entry: PromptEntry) {
    const list = [...this.entries, entry];
    this.update(list);
  }

  removePrompt(entry: PromptEntry) {
    this.update(this.entries.filter(e => e !== entry));
  }

  updatePrompt(entry: PromptEntry, newEntry: PromptEntry) {
    const list = this.entries.map(e => (e === entry ? newEntry : e));
    this.update(list);
  }

  get prompts(): PromptEntry[] {
    return this.entries;
  }
}

export function registerPromptGallery(context: vscode.ExtensionContext): PromptGalleryProvider {
  const provider = new PromptGalleryProvider(context);
  const view = vscode.window.createTreeView('pomlPromptGallery', { treeDataProvider: provider });
  context.subscriptions.push(view);

  context.subscriptions.push(
    vscode.commands.registerCommand('poml.gallery.addPrompt', async () => {
      const uri = await vscode.window.showOpenDialog({
        openLabel: 'Select POML',
        filters: { POML: ['poml'], 'All Files': ['*'] }
      });
      if (!uri || !uri[0]) {
        return;
      }
      const name = await vscode.window.showInputBox({
        prompt: 'Name for the prompt',
        value: path.basename(uri[0].fsPath, '.poml')
      });
      if (!name) {
        return;
      }
      provider.addPrompt({ name, file: uri[0].fsPath });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('poml.gallery.deletePrompt', (item: PromptEntry) => {
      if (item) {
        provider.removePrompt(item);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('poml.gallery.editPrompt', async (item: PromptEntry) => {
      if (!item) {
        return;
      }
      const name = await vscode.window.showInputBox({ prompt: 'Prompt name', value: item.name });
      if (!name) {
        return;
      }
      const uri = await vscode.window.showOpenDialog({
        openLabel: 'Select POML',
        defaultUri: vscode.Uri.file(item.file),
        filters: { POML: ['poml'], 'All Files': ['*'] }
      });
      if (!uri || !uri[0]) {
        return;
      }
      provider.updatePrompt(item, { name, file: uri[0].fsPath });
    })
  );

  return provider;
}
