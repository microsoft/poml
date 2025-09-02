import * as vscode from 'vscode';
import { Command } from '../util/commandManager';
import { POMLWebviewPanelManager } from '../panel/manager';
import { getTelemetryReporter } from 'poml-vscode/util/telemetryClient';
import { TelemetryEvent } from 'poml-vscode/util/telemetryServer';

export class ShowSourceCommand implements Command {
  public readonly id = 'poml.showSource';

  public constructor(private readonly previewManager: POMLWebviewPanelManager) {}

  public execute() {
    getTelemetryReporter()?.reportTelemetry(TelemetryEvent.CommandInvoked, {
      command: this.id,
    });
    if (this.previewManager.activePreviewResource) {
      return vscode.workspace
        .openTextDocument(this.previewManager.activePreviewResource)
        .then((document) => vscode.window.showTextDocument(document));
    }
    return undefined;
  }
}
