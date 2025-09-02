import * as vscode from 'vscode';
import * as fs from 'fs';

export type LanguageModelProvider = 'vscode' | 'openai' | 'openaiResponse' | 'microsoft' | 'anthropic' | 'google';

export type ApiConfigValue = string | { [provider: string]: string };

export interface LanguageModelSetting {
  provider: LanguageModelProvider;
  model: string;
  temperature?: number;
  apiKey?: ApiConfigValue;
  apiUrl?: ApiConfigValue;
  apiVersion?: string;
  maxTokens?: number;
}

export interface ResourceOptions {
  contexts: string[];
  stylesheets: string[];
}

/**
 * Settings for the extension.
 */
export class Settings {
  public static getForResource(resource: vscode.Uri) {
    return new Settings(resource);
  }

  public readonly scrollBeyondLastLine: boolean;
  public readonly wordWrap: boolean;
  public readonly previewFrontMatter: string;
  public readonly lineBreaks: boolean;
  public readonly doubleClickToSwitchToEditor: boolean;
  public readonly scrollEditorWithPreview: boolean;
  public readonly scrollPreviewWithEditor: boolean;
  public readonly markEditorSelection: boolean;
  public readonly languageModel: LanguageModelSetting;

  public readonly styles: string[];

  private constructor(resource: vscode.Uri) {
    const editorSettings = vscode.workspace.getConfiguration('editor', resource);
    const pomlSettings = vscode.workspace.getConfiguration('poml', resource);
    const pomlEditorSettings = vscode.workspace.getConfiguration('[poml]', resource);

    this.scrollBeyondLastLine = editorSettings.get<boolean>('scrollBeyondLastLine', false);

    this.wordWrap = editorSettings.get<string>('wordWrap', 'off') !== 'off';
    if (pomlEditorSettings && pomlEditorSettings['editor.wordWrap']) {
      this.wordWrap = pomlEditorSettings['editor.wordWrap'] !== 'off';
    }

    this.previewFrontMatter = pomlSettings.get<string>('previewFrontMatter', 'hide');
    this.scrollPreviewWithEditor = !!pomlSettings.get<boolean>('preview.scrollPreviewWithEditor', true);
    this.scrollEditorWithPreview = !!pomlSettings.get<boolean>('preview.scrollEditorWithPreview', true);
    this.lineBreaks = !!pomlSettings.get<boolean>('preview.breaks', false);
    this.doubleClickToSwitchToEditor = !!pomlSettings.get<boolean>('preview.doubleClickToSwitchToEditor', true);
    this.markEditorSelection = !!pomlSettings.get<boolean>('preview.markEditorSelection', true);

    this.languageModel = {
      provider: pomlSettings.get<LanguageModelProvider>('languageModel.provider', 'openai'),
      model: pomlSettings.get<string>('languageModel.model', ''),
      temperature: pomlSettings.get<number>('languageModel.temperature', 0.5),
      apiKey: pomlSettings.get<ApiConfigValue>('languageModel.apiKey', '') || undefined,
      apiUrl: pomlSettings.get<ApiConfigValue>('languageModel.apiUrl', '') || undefined,
      apiVersion: pomlSettings.get<string>('languageModel.apiVersion', '') || undefined,
      maxTokens: pomlSettings.get<number>('languageModel.maxTokens', 0) || undefined,
    };

    this.styles = pomlSettings.get<string[]>('styles', []);
  }

  public isEqualTo(otherSettings: Settings) {
    for (let key in this) {
      if (this.hasOwnProperty(key) && key !== 'styles' && key !== 'languageModel') {
        if (this[key] !== otherSettings[key]) {
          return false;
        }
      }
    }

    // Check styles
    if (this.styles.length !== otherSettings.styles.length) {
      return false;
    }
    for (let i = 0; i < this.styles.length; ++i) {
      if (this.styles[i] !== otherSettings.styles[i]) {
        return false;
      }
    }

    // Check language model properties
    if (!otherSettings.languageModel) {
      return false;
    }
    for (const prop in this.languageModel) {
      if ((this.languageModel as any)[prop] !== (otherSettings.languageModel as any)[prop]) {
        return false;
      }
    }

    return true;
  }

  [key: string]: any;
}

export class SettingsManager {
  private readonly previewSettingsForWorkspaces = new Map<string, Settings>();
  private readonly resourceOptions = new Map<string, ResourceOptions>();

  public loadAndCacheSettings(resource: vscode.Uri): Settings {
    const config = Settings.getForResource(resource);
    this.previewSettingsForWorkspaces.set(this.getKey(resource), config);
    return config;
  }

  public hasSettingsChanged(resource: vscode.Uri): boolean {
    const key = this.getKey(resource);
    const currentSettings = this.previewSettingsForWorkspaces.get(key);
    const newSettings = Settings.getForResource(resource);
    return !currentSettings || !currentSettings.isEqualTo(newSettings);
  }

  public getResourceOptions(resource: vscode.Uri): ResourceOptions {
    let saved = this.resourceOptions.get(resource.fsPath);
    if (!saved) {
      saved = this.tryLoadAssociatedFiles(resource);
    }
    if (saved) {
      return { contexts: [...saved.contexts], stylesheets: [...saved.stylesheets] };
    }
    return { contexts: [], stylesheets: [] };
  }

  public setResourceOptions(resource: vscode.Uri, options: ResourceOptions) {
    this.resourceOptions.set(resource.fsPath, {
      contexts: [...options.contexts],
      stylesheets: [...options.stylesheets],
    });
  }

  public hasResourceOptions(resource: vscode.Uri): boolean {
    return this.resourceOptions.has(resource.fsPath);
  }

  private tryLoadAssociatedFiles(resource: vscode.Uri): ResourceOptions | undefined {
    const resourcePath = resource.fsPath;
    if (!resourcePath.endsWith('.poml')) {
      return undefined;
    }

    const base = resourcePath.replace(/(\.source)?\.poml$/i, '');
    const contexts: string[] = [];
    const stylesheets: string[] = [];
    const addIfExists = (arr: string[], file: string) => {
      if (fs.existsSync(file)) {
        arr.push(file);
        return true;
      }
      return false;
    };

    let changed = false;
    changed = addIfExists(contexts, `${base}.context.json`) || changed;
    changed = addIfExists(stylesheets, `${base}.stylesheet.json`) || changed;

    if (changed) {
      const opts = { contexts, stylesheets };
      this.resourceOptions.set(resource.fsPath, opts);
      return opts;
    }
    return undefined;
  }

  private getKey(resource: vscode.Uri): string {
    const folder = vscode.workspace.getWorkspaceFolder(resource);
    return folder ? folder.uri.toString() : '';
  }
}
