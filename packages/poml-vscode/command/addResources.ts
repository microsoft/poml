import * as vscode from 'vscode';
import { Command } from '../util/commandManager';
import { POMLWebviewPanelManager } from '../panel/manager';

export class AddContextFileCommand implements Command {
  public readonly id = 'poml.addContextFile';
  public constructor(private readonly manager: POMLWebviewPanelManager) {}

  public async execute() {
    const panel = this.manager.activePreview;
    if (!panel) {
      return;
    }
    const uris = await vscode.window.showOpenDialog({
      canSelectMany: true,
      openLabel: 'Add Context',
      title: 'Select Context JSON Files to Associate with POML',
      filters: { 'JSON Files': ['json'], 'All Files': ['*'] },
    });
    if (!uris) {
      return;
    }
    for (const uri of uris) {
      panel.addContext(uri.fsPath);
    }
  }
}

export class AddStylesheetFileCommand implements Command {
  public readonly id = 'poml.addStylesheetFile';
  public constructor(private readonly manager: POMLWebviewPanelManager) {}

  public async execute() {
    const panel = this.manager.activePreview;
    if (!panel) {
      return;
    }
    const uris = await vscode.window.showOpenDialog({
      canSelectMany: true,
      openLabel: 'Add Stylesheet',
      title: 'Select Stylesheet JSON Files to Associate with POML',
      filters: { 'JSON Files': ['json'], 'All Files': ['*'] },
    });
    if (!uris) {
      return;
    }
    for (const uri of uris) {
      panel.addStylesheet(uri.fsPath);
    }
  }
}

export class RemoveContextFileCommand implements Command {
  public readonly id = 'poml.removeContextFile';
  public constructor(private readonly manager: POMLWebviewPanelManager) {}

  public execute(file: string) {
    const panel = this.manager.activePreview;
    panel?.removeContext(file);
  }
}

export class RemoveStylesheetFileCommand implements Command {
  public readonly id = 'poml.removeStylesheetFile';
  public constructor(private readonly manager: POMLWebviewPanelManager) {}

  public execute(file: string) {
    const panel = this.manager.activePreview;
    panel?.removeStylesheet(file);
  }
}
