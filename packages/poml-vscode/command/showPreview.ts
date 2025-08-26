import * as vscode from 'vscode';

import { Command } from '../util/commandManager';
import { POMLWebviewPanelManager } from '../panel/manager';
import { PanelSettings } from '../panel/types';
import { getClient } from 'poml-vscode/extension';
import { getTelemetryReporter } from 'poml-vscode/util/telemetryClient';
import { TelemetryEvent } from 'poml-vscode/util/telemetryServer';

interface ShowPreviewSettings {
  readonly sideBySide?: boolean;
  readonly locked?: boolean;
}

async function showPreview(
  webviewManager: POMLWebviewPanelManager,
  uri: vscode.Uri | undefined,
  previewSettings: ShowPreviewSettings,
): Promise<any> {
  let resource = uri;
  if (!(resource instanceof vscode.Uri)) {
    if (vscode.window.activeTextEditor) {
      // we are relaxed and don't check for poml files
      resource = vscode.window.activeTextEditor.document.uri;
    }
  }

  if (!(resource instanceof vscode.Uri)) {
    if (!vscode.window.activeTextEditor) {
      // this is most likely toggling the preview
      return vscode.commands.executeCommand('poml.showSource');
    }
    // nothing found that could be shown or toggled
    return;
  }

  const resourceColumn =
    (vscode.window.activeTextEditor && vscode.window.activeTextEditor.viewColumn) || vscode.ViewColumn.One;
  webviewManager.preview(resource, {
    resourceColumn: resourceColumn,
    previewColumn: previewSettings.sideBySide ? resourceColumn + 1 : resourceColumn,
    locked: !!previewSettings.locked,
  });
}

export class ShowPreviewCommand implements Command {
  public readonly id = 'poml.showPreview';

  public constructor(private readonly webviewManager: POMLWebviewPanelManager) {}

  public execute(mainUri?: vscode.Uri, allUris?: vscode.Uri[], panelSettings?: PanelSettings) {
    for (const uri of Array.isArray(allUris) ? allUris : [mainUri]) {
      showPreview(this.webviewManager, uri, {
        sideBySide: false,
        locked: panelSettings && panelSettings.locked,
      });
    }
  }
}

export class ShowPreviewToSideCommand implements Command {
  public readonly id = 'poml.showPreviewToSide';

  public constructor(private readonly webviewManager: POMLWebviewPanelManager) {}

  public execute(uri?: vscode.Uri, panelSettings?: PanelSettings) {
    getTelemetryReporter()?.reportTelemetry(TelemetryEvent.CommandInvoked, {
      command: this.id,
    });
    showPreview(this.webviewManager, uri, {
      sideBySide: true,
      locked: panelSettings && panelSettings.locked,
    });
  }
}

export class ShowLockedPreviewToSideCommand implements Command {
  public readonly id = 'poml.showLockedPreviewToSide';

  public constructor(private readonly webviewManager: POMLWebviewPanelManager) {}

  public execute(uri?: vscode.Uri) {
    getTelemetryReporter()?.reportTelemetry(TelemetryEvent.CommandInvoked, {
      command: this.id,
    });
    showPreview(this.webviewManager, uri, {
      sideBySide: true,
      locked: true,
    });
  }
}
