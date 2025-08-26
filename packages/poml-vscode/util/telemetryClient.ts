// This is put into a separate file because it contains imports from vscode.
import TelemetryReporter from '@vscode/extension-telemetry';
import { TelemetryBase, TelemetryServerMessage } from './telemetryServer';

let telemetryClient: TelemetryClient | undefined = undefined;

export class TelemetryClient extends TelemetryBase {
  private reporter: TelemetryReporter;

  constructor(connectionString: string) {
    super();
    this.reporter = new TelemetryReporter(connectionString);
  }

  public reportTelemetry(event: string, properties: { [key: string]: any }): Promise<void> {
    this.reporter.sendDangerousTelemetryEvent(event, {
      ...this.formatProperties(properties),
    });
    return Promise.resolve();
  }

  public reportTelemetryError(event: string, error: any): Promise<void> {
    this.reporter.sendDangerousTelemetryErrorEvent(event, {
      ...this.formatError(error),
    });
    return Promise.resolve();
  }

  public handleDataFromServer(data: TelemetryServerMessage) {
    if (data.type === 'telemetry') {
      this.reportTelemetry(data.event, data.properties);
    } else if (data.type === 'error') {
      this.reportTelemetryError(data.event, data.properties);
    } else {
      throw new Error(`Unknown telemetry message type: ${data.type}`);
    }
  }
}

export function initializeReporter(connectionString: string) {
  telemetryClient = new TelemetryClient(connectionString);
  return telemetryClient;
}

export function getTelemetryReporter(): TelemetryClient | undefined {
  return telemetryClient;
}
