export interface TelemetryServerMessage {
  type: 'telemetry' | 'error';
  event: string;
  properties: { [key: string]: string | undefined };
}

export enum TelemetryEvent {
  ReadUncaughtException = 'ReadUncaughtException',
  WriteUncaughtException = 'WriteUncaughtException',
  Activate = 'Activate',
  LanguageServerStatistics = 'LanguageServerStatistics',
  CompletionAcceptanceStatistics = 'CompletionAcceptanceStatistics',
  Diagnostics = 'Diagnostics',
  Hover = 'Hover',
  EdittingCurrently = 'EdittingCurrently',
  CommandInvoked = 'CommandInvoked',
  PromptTestingStart = 'PromptTestingStart',
  PromptTestingEnd = 'PromptTestingEnd',
  PromptTestingAbort = 'PromptTestingAbort',
  PromptTestingError = 'PromptTestingError',
  PreviewUserOptionsChange = 'PreviewUserOptionsChange',
}

export class TelemetryBase {
  protected formatProperties(properties: { [key: string]: any }) {
    const normalizedProperties: { [key: string]: string | undefined } = Object.entries(properties).reduce(
      (acc: { [key: string]: string | undefined }, [key, value]) => {
        if (typeof value === 'object') {
          value = JSON.stringify(value);
        } else if (typeof value !== 'string') {
          value = value?.toString();
        }
        acc[key] = value;
        return acc;
      },
      {} as { [key: string]: string | undefined },
    );
    return normalizedProperties;
  }

  protected formatError(error: any): { [key: string]: string | undefined } {
    let errorInfo: { [key: string]: string | undefined } = {
      message: error ? error.toString() : 'unknown',
    };
    try {
      errorInfo = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        cause: error.cause ? error.cause.toString() : undefined,
      };
    } catch (e) {
      // ignore
    }
    return errorInfo;
  }

  public reportTelemetry(event: string, properties: { [key: string]: any }): Promise<void> {
    throw new Error('reportTelemetry not implemented');
  }

  public reportTelemetryError(event: string, error: any): Promise<void> {
    throw new Error('reportTelemetryError not implemented');
  }
}

export class TelemetryServer extends TelemetryBase {
  private sender: (msg: TelemetryServerMessage) => Promise<void>;

  constructor(sender: (msg: TelemetryServerMessage) => Promise<void>) {
    super();
    this.sender = sender;
  }

  public async reportTelemetry(event: string, properties: { [key: string]: any }) {
    return await this.sender({
      type: 'telemetry',
      event,
      properties: this.formatProperties(properties),
    });
  }

  public async reportTelemetryError(event: string, error: any) {
    return await this.sender({
      type: 'error',
      event,
      properties: this.formatError(error),
    });
  }
}

export class DelayedTelemetryReporter {
  private reporter: TelemetryBase;
  private delayMilliseconds: number;
  private counter: number = 0;
  private lastReportedTime = 0;

  constructor(reporter: TelemetryBase, delayMilliseconds?: number) {
    this.reporter = reporter;
    this.delayMilliseconds = delayMilliseconds ?? 10000;
    this.counter = 0;
  }

  /** Do not wait for this. It can take quite long. */
  public async reportTelemetry(event: string, properties: { [key: string]: any }): Promise<boolean> {
    // It waits for the specified delay before sending the telemetry event.
    // If another event is sent during this delay, the previous report is canceled.
    ++this.counter;
    const currentCounter = this.counter;
    if (Date.now() - this.lastReportedTime < this.delayMilliseconds) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMilliseconds));
    }
    if (currentCounter === this.counter) {
      await this.reporter.reportTelemetry(event, properties);
      return true;
    }
    return false;
  }
}
