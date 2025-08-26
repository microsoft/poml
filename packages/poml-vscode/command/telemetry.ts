import { Command } from '../util/commandManager';
import { POMLWebviewPanelManager } from '../panel/manager';
import { getTelemetryReporter } from 'poml-vscode/util/telemetryClient';
import { DelayedTelemetryReporter, TelemetryEvent } from 'poml-vscode/util/telemetryServer';

export class TelemetryCompletionAcceptanceCommand implements Command {
  public readonly id = 'poml.telemetry.completion';
  private acceptCount: number = 0;
  private reporter: DelayedTelemetryReporter | undefined;

  public constructor(private readonly previewManager: POMLWebviewPanelManager) {
    const reporter = getTelemetryReporter();
    this.reporter = reporter ? new DelayedTelemetryReporter(reporter) : undefined;
  }

  public execute() {
    if (this.reporter) {
      this.acceptCount++;
      this.reporter
        .reportTelemetry(TelemetryEvent.CompletionAcceptanceStatistics, {
          acceptCount: this.acceptCount,
        })
        .then((reported) => {
          if (reported) {
            this.acceptCount = 0;
          }
        });
    }
  }
}
