import * as vscode from 'vscode';
import { Logger } from '../util/logger';
import { disposeAll } from '../util/dispose';
import { HTMLFileTopmostLineMonitor } from '../util/topmostLineMonitor';
import { PanelSettings } from './types';
import { POMLWebviewPanel } from './panel';
import { SettingsManager } from '../settings';

export class POMLWebviewPanelManager implements vscode.WebviewPanelSerializer {
  private static readonly pomlPreviewActiveContextKey = 'pomlPreviewFocus';

  private readonly _topmostLineMonitor = new HTMLFileTopmostLineMonitor();
  private readonly _previewConfigurations = new SettingsManager();
  private readonly _previews: POMLWebviewPanel[] = [];
  private _activePreview: POMLWebviewPanel | undefined = undefined;
  private readonly _disposables: vscode.Disposable[] = [];

  public constructor(
    private readonly _extensionContext: vscode.ExtensionContext,
    private readonly _logger: Logger,
  ) {
    this._disposables.push(vscode.window.registerWebviewPanelSerializer(POMLWebviewPanel.viewType, this));
  }

  public dispose(): void {
    disposeAll(this._disposables);
    disposeAll(this._previews);
  }

  public refresh() {
    for (const preview of this._previews) {
      preview.refresh();
    }
  }

  public updateConfiguration() {
    for (const preview of this._previews) {
      preview.updateConfiguration();
    }
  }

  public preview(resource: vscode.Uri, previewSettings: PanelSettings): void {
    let preview = this.getExistingPreview(resource, previewSettings);
    if (preview) {
      preview.reveal(previewSettings.previewColumn);
    } else {
      preview = this.createNewPreview(resource, previewSettings);
    }

    preview.update(resource);
  }

  public get previewConfigurations() {
    return this._previewConfigurations;
  }

  public get activePreviewResource() {
    return this._activePreview && this._activePreview.pomlUri;
  }

  public get activePreview() {
    return this._activePreview;
  }

  public toggleLock() {
    const preview = this._activePreview;
    if (preview) {
      preview.toggleLock();

      // Close any previews that are now redundant, such as having two dynamic previews in the same editor group
      for (const otherPreview of this._previews) {
        if (otherPreview !== preview && preview.matches(otherPreview)) {
          otherPreview.dispose();
        }
      }
    }
  }

  public async deserializeWebviewPanel(webview: vscode.WebviewPanel, state: any): Promise<void> {
    const preview = await POMLWebviewPanel.revive(
      webview,
      state,
      this._extensionContext,
      this._previewConfigurations,
      this._logger,
      this._topmostLineMonitor,
    );

    this.registerPreview(preview);
  }

  private getExistingPreview(resource: vscode.Uri, previewSettings: PanelSettings): POMLWebviewPanel | undefined {
    return this._previews.find((preview) =>
      preview.matchesResource(resource, previewSettings.previewColumn, previewSettings.locked),
    );
  }

  private createNewPreview(resource: vscode.Uri, previewSettings: PanelSettings): POMLWebviewPanel {
    const preview = POMLWebviewPanel.create(
      resource,
      previewSettings.previewColumn,
      previewSettings.locked,
      this._extensionContext,
      this._previewConfigurations,
      this._logger,
      this._topmostLineMonitor,
    );

    this.setPreviewActiveContext(true);
    this._activePreview = preview;
    return this.registerPreview(preview);
  }

  private registerPreview(preview: POMLWebviewPanel): POMLWebviewPanel {
    this._previews.push(preview);

    preview.onDispose(() => {
      const existing = this._previews.indexOf(preview);
      if (existing === -1) {
        return;
      }

      this._previews.splice(existing, 1);
      if (this._activePreview === preview) {
        this.setPreviewActiveContext(false);
        this._activePreview = undefined;
      }
    });

    preview.onDidChangeViewState(({ webviewPanel }) => {
      disposeAll(this._previews.filter((otherPreview) => preview !== otherPreview && preview!.matches(otherPreview)));
      this.setPreviewActiveContext(webviewPanel.active);
      this._activePreview = webviewPanel.active ? preview : undefined;
    });

    return preview;
  }

  private setPreviewActiveContext(value: boolean) {
    vscode.commands.executeCommand('setContext', POMLWebviewPanelManager.pomlPreviewActiveContextKey, value);
  }
}
