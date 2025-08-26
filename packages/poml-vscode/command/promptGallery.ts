import * as vscode from 'vscode';
import { Command } from '../util/commandManager';
import { PromptGalleryProvider, PromptEntry } from '../chat/gallery';
import * as path from 'path';

function isValidPromptName(name: string): boolean {
  // Check if the name contains only alphanumeric characters, underscores, and hyphens
  const regex = /^[a-zA-Z0-9_-]+$/;
  return regex.test(name);
}

export class AddPromptCommand implements Command {
  public readonly id = 'poml.gallery.addPrompt';
  public constructor(private readonly provider: PromptGalleryProvider) {}

  public async execute() {
    const uri = await vscode.window.showOpenDialog({
      openLabel: 'Select POML',
      filters: { 'POML': ['poml'], 'All Files': ['*'] },
    });
    if (!uri || !uri[0]) {
      return;
    }
    while (true) {
      const name = await vscode.window.showInputBox({
        prompt: 'Name for the prompt (use /<name> in chat panel)',
        value: path.basename(uri[0].fsPath, '.poml'),
      });
      if (!name) {
        break;
      }
      if (!isValidPromptName(name)) {
        vscode.window.showErrorMessage(
          'Invalid prompt name. Only alphanumeric characters, underscores, and hyphens are allowed.',
        );
        continue;
      }
      if (this.provider.hasPrompt(name)) {
        vscode.window.showErrorMessage(`A prompt with the name "${name}" already exists.`);
        continue;
      }
      this.provider.addPrompt({ name, file: uri[0].fsPath, category: 'user' });
      break;
    }
  }
}

export class DeletePromptCommand implements Command {
  public readonly id = 'poml.gallery.deletePrompt';
  public constructor(private readonly provider: PromptGalleryProvider) {}

  public execute(item: PromptEntry) {
    if (item) {
      this.provider.removePrompt(item);
    }
  }
}

export class EditPromptCommand implements Command {
  public readonly id = 'poml.gallery.editPrompt';
  public constructor(private readonly provider: PromptGalleryProvider) {}

  public async execute(item: PromptEntry) {
    if (!item) {
      return;
    }
    let name: string | undefined;
    while (true) {
      name = await vscode.window.showInputBox({
        prompt: 'Name for the prompt (use /<name> in chat panel)',
        value: item.name,
      });
      if (!name) {
        return;
      }
      if (!isValidPromptName(name)) {
        vscode.window.showErrorMessage(
          'Invalid prompt name. Only alphanumeric characters, underscores, and hyphens are allowed.',
        );
        continue;
      }
      if (name !== item.name && this.provider.hasPrompt(name)) {
        vscode.window.showErrorMessage(`A prompt with the name "${name}" already exists.`);
        continue;
      }
      break;
    }
    const uri = await vscode.window.showOpenDialog({
      openLabel: 'Select POML',
      defaultUri: vscode.Uri.file(item.file),
      filters: { 'POML': ['poml'], 'All Files': ['*'] },
    });
    if (!uri || !uri[0]) {
      return;
    }
    this.provider.updatePrompt(item, { name, file: uri[0].fsPath, category: 'user' });
  }
}
