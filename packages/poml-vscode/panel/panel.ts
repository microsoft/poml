import * as vscode from 'vscode';
import * as path from 'path';

import {
  WebviewConfig,
  WebviewState,
  WebviewUserOptions,
  WebviewMessage,
  PreviewMethodName,
  PreviewParams,
  PreviewResponse,
} from './types';
import { headlessPomlVscodePanelContent, pomlVscodePanelContent } from './content';
import { SettingsManager } from '../settings';
import { isPomlFile } from '../util/file';
import { getVisibleLine, HTMLFileTopmostLineMonitor } from '../util/topmostLineMonitor';
import { Logger } from '../util/logger';
import { disposeAll } from '../util/dispose';
import { getClient } from 'poml-vscode/extension';
import { getTelemetryReporter } from 'poml-vscode/util/telemetryClient';
import { TelemetryEvent } from 'poml-vscode/util/telemetryServer';

/**
 * A wrapper for a webview panel, exposing "preview"-specific functionalities.
 * It's responsible for creating, reviving the panel and handling editor events.
 * One instance is responsible for one single preview panel.
 * The wrapper can be created by either a revive method or a create method.
 */
export class POMLWebviewPanel {
  public static viewType = 'poml.preview';

  private _pomlUri: vscode.Uri;
  private _locked: boolean;

  private readonly editor: vscode.WebviewPanel;
  private throttleTimer: any;
  private line: number | undefined = undefined;
  private readonly disposables: vscode.Disposable[] = [];
  private firstUpdate = true;
  private currentVersion?: { resource: vscode.Uri; version: number };
  private forceUpdate = false;
  private isScrolling = false;
  private _disposed: boolean = false;
  private _userOptions: WebviewUserOptions;

  public static async revive(
    webview: vscode.WebviewPanel,
    state: WebviewState,
    context: vscode.ExtensionContext,
    previewConfigurations: SettingsManager,
    logger: Logger,
    topmostLineMonitor: HTMLFileTopmostLineMonitor,
  ): Promise<POMLWebviewPanel> {
    // Unpack the state.
    const config = state;
    const resource = vscode.Uri.parse(config.source);
    const locked = config.locked;
    const line = config.line;

    const preview = new POMLWebviewPanel(
      webview,
      resource,
      locked,
      {
        speakerMode: state.speakerMode,
        displayFormat: state.displayFormat,
        contexts: state.contexts ?? [],
        stylesheets: state.stylesheets ?? [],
      },
      context,
      previewConfigurations,
      logger,
      topmostLineMonitor,
    );

    preview.editor.webview.options = POMLWebviewPanel.getWebviewOptions(resource, context);

    if (line !== undefined && !isNaN(line)) {
      preview.line = line;
    }
    await preview.doUpdate();
    return preview;
  }

  public static create(
    resource: vscode.Uri,
    previewColumn: vscode.ViewColumn,
    locked: boolean,
    context: vscode.ExtensionContext,
    previewConfigurations: SettingsManager,
    logger: Logger,
    topmostLineMonitor: HTMLFileTopmostLineMonitor,
  ): POMLWebviewPanel {
    const webview = vscode.window.createWebviewPanel(
      POMLWebviewPanel.viewType,
      POMLWebviewPanel.getPreviewTitle(resource, locked),
      previewColumn,
      {
        enableFindWidget: true,
        ...POMLWebviewPanel.getWebviewOptions(resource, context),
      },
    );

    const userOptions: WebviewUserOptions = {
      speakerMode: true,
      displayFormat: 'plain',
      contexts: [],
      stylesheets: [],
    };

    return new POMLWebviewPanel(
      webview,
      resource,
      locked,
      userOptions,
      context,
      previewConfigurations,
      logger,
      topmostLineMonitor,
    );
  }

  private constructor(
    webview: vscode.WebviewPanel,
    resource: vscode.Uri,
    locked: boolean,
    userOptions: WebviewUserOptions,
    private readonly _context: vscode.ExtensionContext,
    private readonly _previewConfigurations: SettingsManager,
    private readonly _logger: Logger,
    topmostLineMonitor: HTMLFileTopmostLineMonitor,
  ) {
    this._pomlUri = resource;
    this._locked = locked;
    this._userOptions = userOptions;
    this.editor = webview;

    this.editor.onDidDispose(
      () => {
        this.dispose();
      },
      null,
      this.disposables,
    );

    this.editor.onDidChangeViewState(
      (e) => {
        this._onDidChangeViewStateEmitter.fire(e);
      },
      null,
      this.disposables,
    );

    this.editor.webview.onDidReceiveMessage(
      (e) => {
        if (e.source !== this._pomlUri.toString()) {
          return;
        }

        switch (e.type) {
          case WebviewMessage.Command:
            vscode.commands.executeCommand(e.body.command, ...e.body.args);
            break;

          case WebviewMessage.RevealLine:
            this.onDidScrollPreview(e.body.line);
            break;

          case WebviewMessage.DidClick:
            this.onDidClickPreview(e.body.line);
            break;

          case WebviewMessage.Form:
            this._userOptions = { ...this._userOptions, ...e.body };
            this.onDidUserOptionsChange();
            break;
        }
      },
      null,
      this.disposables,
    );

    vscode.workspace.onDidChangeTextDocument(
      (event) => {
        if (this.isPreviewOf(event.document.uri)) {
          this.refresh();
        }
      },
      null,
      this.disposables,
    );

    topmostLineMonitor.onDidChangeTopmostLine(
      (event) => {
        if (this.isPreviewOf(event.resource)) {
          this.updateForView(event.resource, event.line);
        }
      },
      null,
      this.disposables,
    );

    vscode.window.onDidChangeTextEditorSelection(
      (event) => {
        if (this.isPreviewOf(event.textEditor.document.uri)) {
          this.postMessage({
            type: 'onDidChangeTextEditorSelection',
            line: event.selections[0].active.line,
            source: this._pomlUri.toString(),
          });
        }
      },
      null,
      this.disposables,
    );

    vscode.window.onDidChangeActiveTextEditor(
      (editor) => {
        if (editor && isPomlFile(editor.document) && !this._locked) {
          this.update(editor.document.uri);
        }
      },
      null,
      this.disposables,
    );
  }

  private readonly _onDisposeEmitter = new vscode.EventEmitter<void>();
  public readonly onDispose = this._onDisposeEmitter.event;

  private readonly _onDidChangeViewStateEmitter =
    new vscode.EventEmitter<vscode.WebviewPanelOnDidChangeViewStateEvent>();
  public readonly onDidChangeViewState = this._onDidChangeViewStateEmitter.event;

  public get pomlUri(): vscode.Uri {
    return this._pomlUri;
  }

  public dispose() {
    if (this._disposed) {
      return;
    }

    this._disposed = true;
    this._onDisposeEmitter.fire();

    this._onDisposeEmitter.dispose();
    this._onDidChangeViewStateEmitter.dispose();
    this.editor.dispose();

    disposeAll(this.disposables);
  }

  public update(resource: vscode.Uri) {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.uri.fsPath === resource.fsPath) {
      this.line = getVisibleLine(editor);
    }

    // If we have changed resources, cancel any pending updates
    const isResourceChange = resource.fsPath !== this._pomlUri.fsPath;
    if (isResourceChange) {
      clearTimeout(this.throttleTimer);
      this.throttleTimer = undefined;
    }

    if (isResourceChange || this.firstUpdate) {
      const saved = this._previewConfigurations.getResourceOptions(resource);
      this._userOptions.contexts = [...saved.contexts];
      this._userOptions.stylesheets = [...saved.stylesheets];
    }

    this._pomlUri = resource;

    // Schedule update if none is pending
    if (!this.throttleTimer) {
      if (isResourceChange || this.firstUpdate) {
        this.doUpdate();
      } else {
        this.throttleTimer = setTimeout(() => this.doUpdate(), 300);
      }
    }

    this.firstUpdate = false;
  }

  public refresh() {
    this.forceUpdate = true;
    this.update(this._pomlUri);
  }

  public updateConfiguration() {
    if (this._previewConfigurations.hasSettingsChanged(this._pomlUri)) {
      this.refresh();
    }
  }

  public get position(): vscode.ViewColumn | undefined {
    return this.editor.viewColumn;
  }

  public matchesResource(
    otherResource: vscode.Uri,
    otherPosition: vscode.ViewColumn | undefined,
    otherLocked: boolean,
  ): boolean {
    if (this.position !== otherPosition) {
      return false;
    }

    if (this._locked) {
      return otherLocked && this.isPreviewOf(otherResource);
    } else {
      return !otherLocked;
    }
  }

  public matches(otherPreview: POMLWebviewPanel): boolean {
    return this.matchesResource(otherPreview._pomlUri, otherPreview.position, otherPreview._locked);
  }

  public reveal(viewColumn: vscode.ViewColumn) {
    this.editor.reveal(viewColumn);
  }

  public toggleLock() {
    this._locked = !this._locked;
    this.editor.title = POMLWebviewPanel.getPreviewTitle(this._pomlUri, this._locked);
  }

  public addContext(file: string) {
    if (!this._userOptions.contexts) {
      this._userOptions.contexts = [];
    }
    if (!this._userOptions.contexts.includes(file)) {
      this._userOptions.contexts.push(file);
      this._previewConfigurations.setResourceOptions(this._pomlUri, {
        contexts: [...this._userOptions.contexts],
        stylesheets: [...(this._userOptions.stylesheets ?? [])],
      });
      this.onDidUserOptionsChange();
    }
  }

  public addStylesheet(file: string) {
    if (!this._userOptions.stylesheets) {
      this._userOptions.stylesheets = [];
    }
    if (!this._userOptions.stylesheets.includes(file)) {
      this._userOptions.stylesheets.push(file);
      this._previewConfigurations.setResourceOptions(this._pomlUri, {
        contexts: [...(this._userOptions.contexts ?? [])],
        stylesheets: [...this._userOptions.stylesheets],
      });
      this.onDidUserOptionsChange();
    }
  }

  public removeContext(file: string) {
    if (this._userOptions.contexts) {
      this._userOptions.contexts = this._userOptions.contexts.filter((f) => f !== file);
      this._previewConfigurations.setResourceOptions(this._pomlUri, {
        contexts: [...this._userOptions.contexts],
        stylesheets: [...(this._userOptions.stylesheets ?? [])],
      });
      this.onDidUserOptionsChange();
    }
  }

  public removeStylesheet(file: string) {
    if (this._userOptions.stylesheets) {
      this._userOptions.stylesheets = this._userOptions.stylesheets.filter((f) => f !== file);
      this._previewConfigurations.setResourceOptions(this._pomlUri, {
        contexts: [...(this._userOptions.contexts ?? [])],
        stylesheets: [...this._userOptions.stylesheets],
      });
      this.onDidUserOptionsChange();
    }
  }

  private get iconPath() {
    const root = path.join(this._context.extensionPath, 'media');
    return {
      light: vscode.Uri.file(path.join(root, 'icon', 'preview.svg')),
      dark: vscode.Uri.file(path.join(root, 'icon', 'preview-inverse.svg')),
    };
  }

  private isPreviewOf(resource: vscode.Uri): boolean {
    return this._pomlUri.fsPath === resource.fsPath;
  }

  private static getPreviewTitle(resource: vscode.Uri, locked: boolean): string {
    return locked ? `[Preview] ${path.basename(resource.fsPath)}` : `Preview ${path.basename(resource.fsPath)}`;
  }

  private updateForView(resource: vscode.Uri, topLine: number | undefined) {
    if (!this.isPreviewOf(resource)) {
      return;
    }

    if (this.isScrolling) {
      this.isScrolling = false;
      return;
    }

    if (typeof topLine === 'number') {
      this._logger.log('updateForView', { htmlFile: resource });
      this.line = topLine;
      this.postMessage({
        type: 'updateView',
        line: topLine,
        source: resource.toString(),
      });
    }
  }

  private postMessage(msg: any) {
    if (!this._disposed) {
      this.editor.webview.postMessage(msg);
    }
  }

  private getWebviewConfig(document: vscode.TextDocument): WebviewConfig {
    const settings = this._previewConfigurations.loadAndCacheSettings(this._pomlUri);
    return {
      source: this._pomlUri.toString(),
      line: this.line,
      lineCount: document.lineCount,
      locked: this._locked,
      scrollPreviewWithEditor: settings.scrollPreviewWithEditor,
      scrollEditorWithPreview: settings.scrollEditorWithPreview,
      doubleClickToSwitchToEditor: settings.doubleClickToSwitchToEditor,
    };
  }

  private getLanguageModelSettings(uri: vscode.Uri) {
    const settings = this._previewConfigurations.loadAndCacheSettings(uri);
    return settings.languageModel;
  }

  private extensionResourcePath(mediaFile: string): string {
    return this.editor.webview
      .asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, 'media', mediaFile))
      .toString();
  }

  private localResourcePath(resourceFile: string): string {
    return this.editor.webview.asWebviewUri(vscode.Uri.parse(resourceFile)).toString();
  }

  private async doUpdate(): Promise<void> {
    const resource = this._pomlUri;

    clearTimeout(this.throttleTimer);
    this.throttleTimer = undefined;

    const document = await vscode.workspace.openTextDocument(resource);
    if (
      !this.forceUpdate &&
      this.currentVersion &&
      this.currentVersion.resource.fsPath === resource.fsPath &&
      this.currentVersion.version === document.version
    ) {
      if (this.line) {
        this.updateForView(resource, this.line);
      }
      return;
    }
    this.forceUpdate = false;

    this.currentVersion = { resource, version: document.version };
    const webviewConfig = this.getWebviewConfig(document);

    const languageModelSettings = this.getLanguageModelSettings(resource);
    const requestParams: PreviewParams = {
      uri: resource.toString(),
      returnTokenCounts: { model: languageModelSettings.model },
      ...this._userOptions,
    };

    const response = await getClient().sendRequest<PreviewResponse>(PreviewMethodName, requestParams);

    const content = pomlVscodePanelContent({
      ...webviewConfig,
      ...this._userOptions,
      ...response,
      extensionResourcePath: this.extensionResourcePath.bind(this),
      localResourcePath: this.localResourcePath.bind(this),
    });

    if (this._pomlUri === resource) {
      this.editor.title = POMLWebviewPanel.getPreviewTitle(this._pomlUri, this._locked);
      this.editor.iconPath = this.iconPath;
      this.editor.webview.options = POMLWebviewPanel.getWebviewOptions(resource, this._context);
      this.editor.webview.html = content;
    }
  }

  private static getWebviewOptions(resource: vscode.Uri, context: vscode.ExtensionContext): vscode.WebviewOptions {
    return {
      enableScripts: true,
      enableCommandUris: true,
      localResourceRoots: POMLWebviewPanel.getLocalResourceRoots(resource, context),
    };
  }

  private static getLocalResourceRoots(resource: vscode.Uri, context: vscode.ExtensionContext): vscode.Uri[] {
    const baseRoots: vscode.Uri[] = [vscode.Uri.joinPath(context.extensionUri, 'media')];

    const folder = vscode.workspace.getWorkspaceFolder(resource);
    if (folder) {
      return baseRoots.concat(folder.uri);
    }

    if (!resource.scheme || resource.scheme === 'file') {
      return baseRoots.concat(vscode.Uri.file(path.dirname(resource.fsPath)));
    }

    return baseRoots;
  }

  private onDidScrollPreview(line: number) {
    this.line = line;
    for (const editor of vscode.window.visibleTextEditors) {
      if (!this.isPreviewOf(editor.document.uri)) {
        continue;
      }

      this.isScrolling = true;
      const sourceLine = Math.floor(line);
      const fraction = line - sourceLine;
      const text = editor.document.lineAt(sourceLine).text;
      const start = Math.floor(fraction * text.length);
      editor.revealRange(new vscode.Range(sourceLine, start, sourceLine + 1, 0), vscode.TextEditorRevealType.AtTop);
    }
  }

  private async onDidClickPreview(line: number): Promise<void> {
    for (const visibleEditor of vscode.window.visibleTextEditors) {
      if (this.isPreviewOf(visibleEditor.document.uri)) {
        const editor = await vscode.window.showTextDocument(visibleEditor.document, visibleEditor.viewColumn);
        const position = new vscode.Position(line, 0);
        editor.selection = new vscode.Selection(position, position);
        return;
      }
    }

    vscode.workspace.openTextDocument(this._pomlUri).then(vscode.window.showTextDocument);
  }

  private async onDidUserOptionsChange(): Promise<void> {
    const resource = this._pomlUri;
    const languageModelSettings = this.getLanguageModelSettings(resource);
    const requestParams: PreviewParams = {
      uri: resource.toString(),
      returnTokenCounts: { model: languageModelSettings.model },
      ...this._userOptions,
    };

    getTelemetryReporter()?.reportTelemetry(TelemetryEvent.PreviewUserOptionsChange, this._userOptions);

    const response = await getClient().sendRequest<PreviewResponse>(PreviewMethodName, requestParams);

    const content = headlessPomlVscodePanelContent({
      ...this._userOptions,
      ...response,
    });
    this.editor.webview.postMessage({
      type: WebviewMessage.UpdateContent,
      content: content,
      source: resource.toString(),
    });
    this.editor.webview.postMessage({
      type: WebviewMessage.UpdateUserOptions,
      options: this._userOptions,
      source: resource.toString(),
    });
  }
}
