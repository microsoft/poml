import * as vscode from 'vscode';

export interface PromptEntry {
  category: 'default' | 'user';
  name: string;
  file: string;
}

interface PromptCategory {
  type: 'category';
  label: string;
}

type TreeNode = PromptEntry | PromptCategory;

function isCategory(node: TreeNode): node is PromptCategory {
  return node && (node as PromptCategory).type === 'category';
}

const STORAGE_KEY = 'poml.promptGallery';

const DEFAULT_PROMPTS_LABEL = 'Default Prompts';
const MY_PROMPTS_LABEL = 'My Prompts';

export class PromptGalleryProvider implements vscode.TreeDataProvider<TreeNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(
    private context: vscode.ExtensionContext,
    private defaultEntries: PromptEntry[],
  ) {}

  private get userEntries(): PromptEntry[] {
    return this.context.globalState.get<PromptEntry[]>(STORAGE_KEY, []);
  }

  private update(entries: PromptEntry[]) {
    void this.context.globalState.update(STORAGE_KEY, entries);
    this._onDidChangeTreeData.fire();
  }

  getChildren(element?: TreeNode): TreeNode[] {
    if (!element) {
      return [
        { type: 'category', label: DEFAULT_PROMPTS_LABEL },
        { type: 'category', label: MY_PROMPTS_LABEL },
      ];
    }
    if (isCategory(element)) {
      return element.label === DEFAULT_PROMPTS_LABEL ? this.defaultEntries : this.userEntries;
    }
    return [];
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    if (isCategory(element)) {
      const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Expanded);
      item.contextValue = 'pomlPrompt.category';
      return item;
    } else {
      const item = new vscode.TreeItem(element.name, vscode.TreeItemCollapsibleState.None);
      item.resourceUri = vscode.Uri.file(element.file);
      item.command = {
        command: 'vscode.open',
        title: 'Open Prompt',
        arguments: [vscode.Uri.file(element.file)],
      };
      item.contextValue = element.category === 'default' ? 'pomlPrompt.default' : 'pomlPrompt.user';
      return item;
    }
  }

  addPrompt(entry: PromptEntry) {
    const list = [...this.userEntries, entry];
    this.update(list);
  }

  removePrompt(entry: PromptEntry) {
    this.update(this.userEntries.filter((e) => e !== entry));
  }

  updatePrompt(entry: PromptEntry, newEntry: PromptEntry) {
    const list = this.userEntries.map((e) => (e === entry ? newEntry : e));
    this.update(list);
  }

  hasPrompt(name: string): boolean {
    return this.userEntries.some((e) => e.name === name) || this.defaultEntries.some((e) => e.name === name);
  }

  get prompts(): PromptEntry[] {
    return [...this.defaultEntries, ...this.userEntries];
  }
}

export function registerPromptGallery(context: vscode.ExtensionContext): PromptGalleryProvider {
  const galleryDir = vscode.Uri.joinPath(context.extensionUri, 'gallery');
  const defaultEntries: PromptEntry[] = [
    { name: 'ask', file: vscode.Uri.joinPath(galleryDir, 'ask.poml').fsPath, category: 'default' },
    { name: 'edit', file: vscode.Uri.joinPath(galleryDir, 'edit.poml').fsPath, category: 'default' },
    { name: 'latex-edit', file: vscode.Uri.joinPath(galleryDir, 'latex_edit.poml').fsPath, category: 'default' },
    { name: 'latex-write', file: vscode.Uri.joinPath(galleryDir, 'latex_write.poml').fsPath, category: 'default' },
    {
      name: 'pdf-understanding',
      file: vscode.Uri.joinPath(galleryDir, 'pdf_understanding.poml').fsPath,
      category: 'default',
    },
    {
      name: 'word-understanding',
      file: vscode.Uri.joinPath(galleryDir, 'word_understanding.poml').fsPath,
      category: 'default',
    },
    {
      name: 'table-understanding',
      file: vscode.Uri.joinPath(galleryDir, 'table_understanding.poml').fsPath,
      category: 'default',
    },
  ];
  const provider = new PromptGalleryProvider(context, defaultEntries);
  const view = vscode.window.createTreeView('pomlPromptGallery', { treeDataProvider: provider });
  context.subscriptions.push(view);
  return provider;
}
