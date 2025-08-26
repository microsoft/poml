import * as vscode from 'vscode';

enum Trace {
  Off,
  Verbose,
}

namespace Trace {
  export function fromString(value: string): Trace {
    value = value.toLowerCase();
    switch (value) {
      case 'off':
        return Trace.Off;
      case 'verbose':
        return Trace.Verbose;
      default:
        return Trace.Off;
    }
  }
}

export interface Lazy<T> {
  readonly value: T;
  readonly hasValue: boolean;
  map<R>(f: (x: T) => R): Lazy<R>;
}

class LazyValue<T> implements Lazy<T> {
  private _hasValue: boolean = false;
  private _value?: T;

  constructor(private readonly _getValue: () => T) {}

  get value(): T {
    if (!this._hasValue) {
      this._hasValue = true;
      this._value = this._getValue();
    }
    return this._value!;
  }

  get hasValue(): boolean {
    return this._hasValue;
  }

  public map<R>(f: (x: T) => R): Lazy<R> {
    return new LazyValue(() => f(this.value));
  }
}

export function lazy<T>(getValue: () => T): Lazy<T> {
  return new LazyValue<T>(getValue);
}

function isString(value: any): value is string {
  return Object.prototype.toString.call(value) === '[object String]';
}

export class Logger {
  private trace?: Trace;

  private readonly outputChannel = lazy(() => vscode.window.createOutputChannel('HTML'));

  constructor() {
    this.updateConfiguration();
  }

  public log(message: string, data?: any): void {
    if (this.trace === Trace.Verbose) {
      this.appendLine(`[Log - ${new Date().toLocaleTimeString()}] ${message}`);
      if (data) {
        this.appendLine(Logger.data2String(data));
      }
    }
  }

  public updateConfiguration() {
    this.trace = Trace.fromString('off');
  }

  private appendLine(value: string) {
    return this.outputChannel.value.appendLine(value);
  }

  private readTrace(): Trace {
    return Trace.fromString(vscode.workspace.getConfiguration().get<string>('html.trace', 'off'));
  }

  private static data2String(data: any): string {
    if (data instanceof Error) {
      if (isString(data.stack)) {
        return data.stack;
      }
      return (data as Error).message;
    }
    if (isString(data)) {
      return data;
    }
    return JSON.stringify(data, undefined, 2);
  }
}
