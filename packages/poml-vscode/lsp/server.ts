import {
  createConnection,
  TextDocuments,
  Diagnostic,
  DiagnosticSeverity,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams,
  TextDocumentSyncKind,
  InitializeResult,
  DocumentDiagnosticReportKind,
  type DocumentDiagnosticReport,
  DocumentDiagnosticParams,
  HoverParams,
  MarkupKind,
  RelatedFullDocumentDiagnosticReport,
  TelemetryEventNotification,
  FullDocumentDiagnosticReport,
  UnchangedDocumentDiagnosticReport
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import * as crypto from 'crypto';
import { Message, poml, read, write } from 'poml';
import {
  ErrorCollection,
  findComponentByAlias,
  listComponents,
  Parameter,
  ReadError,
  RichContent,
  SystemError,
  WriteError
} from 'poml/base';
import { PomlFile, PomlToken } from 'poml/file';
import { readdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { PreviewParams, PreviewMethodName, PreviewResponse } from '../panel/types';
import { formatComponentDocumentation, formatParameterDocumentation } from './documentFormatter';
import {
  DelayedTelemetryReporter,
  TelemetryEvent,
  TelemetryServer
} from 'poml-vscode/util/telemetryServer';

interface ComputationCache {
  key: string; // Can be file uri, file content, ...
  latestComputedTime: number;
  latestResult: PreviewResponse;
}

interface DiagnosticCache {
  key: string;
  fileContent: string;
  diagnostics: Diagnostic[];
}

class PomlLspServer {
  // Create a connection for the server, using Node's IPC as a transport.
  // Also include all preview / proposed LSP features.
  private readonly connection;
  private readonly documents;
  private throttleTime: number;
  private cache: Map<string, ComputationCache>;
  private diagnosticCache: Map<string, DiagnosticCache>;
  private telemetryReporter: TelemetryServer;
  private statisticsReporter: DelayedTelemetryReporter;
  private edittingReporter: DelayedTelemetryReporter;
  private diagnosticsReporter: DelayedTelemetryReporter;
  private statistics: { [key: string]: number };

  private hasDiagnosticRelatedInformationCapability: boolean;

  constructor() {
    this.connection = createConnection(ProposedFeatures.all);

    // Create a simple text document manager.
    this.documents = new TextDocuments(TextDocument);

    this.hasDiagnosticRelatedInformationCapability = false;

    this.throttleTime = 10; // 10 ms
    this.cache = new Map();
    this.diagnosticCache = new Map();

    this.statistics = {};

    this.telemetryReporter = new TelemetryServer(this.sendTelemetry.bind(this));
    this.statisticsReporter = new DelayedTelemetryReporter(this.telemetryReporter);
    this.edittingReporter = new DelayedTelemetryReporter(this.telemetryReporter);
    this.diagnosticsReporter = new DelayedTelemetryReporter(this.telemetryReporter);
  }

  public listen() {
    this.connection.onInitialize((params: InitializeParams): InitializeResult => {
      const capabilities = params.capabilities;

      // We only need the related info capability currently
      this.hasDiagnosticRelatedInformationCapability = !!(
        capabilities.textDocument &&
        capabilities.textDocument.publishDiagnostics &&
        capabilities.textDocument.publishDiagnostics.relatedInformation
      );

      return {
        capabilities: {
          textDocumentSync: TextDocumentSyncKind.Incremental,
          completionProvider: {
            resolveProvider: true
          },
          diagnosticProvider: {
            interFileDependencies: false,
            workspaceDiagnostics: false
          },
          hoverProvider: true
        }
      };
    });

    this.connection.onHover(this.onHover.bind(this));
    this.connection.onCompletion(this.onCompletion.bind(this));
    this.connection.onCompletionResolve(this.onCompletionResolve.bind(this));
    this.connection.languages.diagnostics.on(this.onDiagnostic.bind(this));

    this.connection.onRequest(PreviewMethodName, this.onPreview.bind(this));

    // Provide a way to force the diagnostics to be reset.
    this.documents.onDidSave(async change => {
      // Invalidate the diagnostic cache
      const uri = change.document.uri.toString();
      this.diagnosticCache.delete(uri);
      const diagnosticReport = await this.onDiagnostic({ textDocument: change.document });
      this.connection.sendDiagnostics({
        uri: change.document.uri,
        diagnostics: diagnosticReport.kind === DocumentDiagnosticReportKind.Full ? diagnosticReport.items : []
      });
    });

    // Make the text document manager listen on the connection
    // for open, change and close text document events
    this.documents.listen(this.connection);

    // Listen on the connection
    return this.connection.listen();
  }

  private async sendTelemetry(data: any) {
    return await this.connection.sendNotification(TelemetryEventNotification.method, data);
  }

  private async incrementStatistics(key: string, n?: number) {
    // Do not await this.
    this.statistics[key] = (this.statistics[key] ?? 0) + (n ?? 1);
    const reported = await this.statisticsReporter.reportTelemetry(
      TelemetryEvent.LanguageServerStatistics,
      this.statistics
    );
    if (reported) {
      this.statistics = {};
    }
  }

  private async computePreviewResponse(params: PreviewParams): Promise<PreviewResponse> {
    const { speakerMode, uri } = params;

    const filePath = fileURLToPath(uri);
    let documentContent: string = '';
    if (params.text !== undefined) {
      documentContent = params.text;
    } else {
      const textDocument = this.documents.get(uri);

      if (textDocument) {
        documentContent = textDocument.getText();
      } else {
        // Sometimes the request happens before the document is opened
        // so we need to read the file from disk
        try {
          documentContent = readFileSync(filePath, 'utf-8');
        } catch (e) {
          // Unable to read the file
          return {
            rawText: '',
            ir: '',
            content: [],
            error: `Unable to read file: ${e}`
          };
        }
      }
    }

    ErrorCollection.clear();
    let ir: string;
    try {
      ir = await read(documentContent, undefined, undefined, undefined, filePath);
    } catch (e) {
      this.telemetryReporter.reportTelemetryError(TelemetryEvent.ReadUncaughtException, e);
      console.error(e);
      return {
        rawText: documentContent,
        ir: '',
        content: [],
        error: `Unable to perform "read" step when rendering file: ${e}`
      };
    }
    let result: Message[] | RichContent;
    try {
      if (speakerMode) {
        result = write(ir, { speaker: true });
      } else {
        result = write(ir);
      }
    } catch (e) {
      this.telemetryReporter.reportTelemetryError(TelemetryEvent.WriteUncaughtException, e);
      console.error(e);
      return {
        rawText: documentContent,
        ir,
        content: [],
        error: `Unable to perform "write" step when rendering file: ${e}`
      };
    }
    return {
      rawText: documentContent,
      ir,
      content: result,
      error: params.returnAllErrors
        ? ErrorCollection.list()
        : ErrorCollection.empty()
          ? undefined
          : ErrorCollection.first().toString()
    };
  }

  private async onPreview(params: PreviewParams): Promise<PreviewResponse> {
    const key = JSON.stringify(params);
    const requestedTime = Date.now();
    await new Promise(resolve => setTimeout(resolve, this.throttleTime));

    // After waiting for, e.g., 10ms, there is a result computed later than the request time.
    if (requestedTime < (this.cache.get(key)?.latestComputedTime ?? 0)) {
      return this.cache.get(key)!.latestResult;
    }

    // Otherwise compute a new one.
    const computedTime = Date.now();
    // FIXME: this is not locked. potentially race
    const response = await this.computePreviewResponse(params);
    const completeTime = Date.now();
    const elapsed = completeTime - computedTime;
    const allocatedTime = elapsed * 2; // Double the time for the next request

    // Send telemetry
    this.incrementStatistics('preview');
    this.edittingReporter.reportTelemetry(TelemetryEvent.EdittingCurrently, {
      rawText: response.rawText,
      uri: params.uri,
      request: JSON.stringify(params),
      compileTime: elapsed,
      throttleTime: this.throttleTime
    });

    // Dynamically adjust the throttle time
    const throttleTime = this.throttleTime * 0.9 + allocatedTime * 0.1;
    this.throttleTime = Math.min(Math.max(throttleTime, 10), 1000);

    this.cache.set(key, {
      key,
      latestComputedTime: computedTime, // Use the computed time as the time when source is retrieved
      latestResult: response
    });

    return response;
  }

  private async onDiagnostic(
    params: DocumentDiagnosticParams
  ): Promise<UnchangedDocumentDiagnosticReport | FullDocumentDiagnosticReport> {
    const key = params.textDocument.uri.toString();
    const document = this.documents.get(params.textDocument.uri);
    const cache = this.diagnosticCache.get(key) ?? { key, fileContent: undefined, diagnostics: [] };
    if (cache.fileContent === document?.getText()) {
      // Compute hash of the file content
      const hash = crypto.createHash('sha256').update(cache.fileContent ?? '').digest('hex');
      return {
        kind: DocumentDiagnosticReportKind.Unchanged,
        resultId: hash
      };
    } else {
      const result = document !== undefined ? await this.validateTextDocument(document) : [];
      this.incrementStatistics('diagnostic');
      if (result.length > 0) {
        this.diagnosticsReporter.reportTelemetry(TelemetryEvent.Diagnostics, {
          rawText: document?.getText(),
          uri: params.textDocument.uri.toString(),
          diagnostics: JSON.stringify(result)
        });
      }
      this.diagnosticCache.set(key, { key, fileContent: document!.getText(), diagnostics: result });
      const hash = crypto.createHash('sha256').update(document!.getText()).digest('hex');
      return {
        kind: DocumentDiagnosticReportKind.Full,
        items: result,
        resultId: hash
      };
    }
  }

  private async validateTextDocument(textDocument: TextDocument): Promise<Diagnostic[]> {
    const text = textDocument.getText();
    const diagnostics: Diagnostic[] = [];

    const response = await this.onPreview({
      uri: textDocument.uri,
      text: text,
      speakerMode: true,
      displayFormat: 'rendered',
      returnAllErrors: true
    });
    const errors = Array.isArray(response.error) ? response.error : response.error ? [response.error] : [];

    const normalizeStartEnd = (
      start: number | undefined,
      end: number | undefined
    ): [number, number] => {
      start = start ?? 0;
      if (isNaN(start)) {
        start = 0;
      }
      end = Math.max(start + 1, end !== undefined ? end + 1 : text.length);
      if (isNaN(end)) {
        end = text.length;
      }
      return [start, end];
    };

    for (const e of errors) {
      if (typeof e === 'string') {
        diagnostics.push({
          severity: DiagnosticSeverity.Error,
          range: {
            start: textDocument.positionAt(0),
            end: textDocument.positionAt(text.length)
          },
          message: e,
          source: 'POML Unknown Error (please report)'
        });
      } else if (e instanceof ReadError) {
        const [start, end] = normalizeStartEnd(e.startIndex, e.endIndex);
        diagnostics.push({
          severity: DiagnosticSeverity.Warning,
          range: {
            start: textDocument.positionAt(start),
            end: textDocument.positionAt(end)
          },
          message: e.message,
          source: 'POML Reader'
        });
      } else if (e instanceof WriteError) {
        const [start, end] = normalizeStartEnd(e.startIndex, e.endIndex);
        const diagnostic: Diagnostic = {
          severity: DiagnosticSeverity.Warning,
          range: {
            start: textDocument.positionAt(start),
            end: textDocument.positionAt(end)
          },
          message: e.message,
          source: 'POML Writer'
        };
        if (this.hasDiagnosticRelatedInformationCapability) {
          diagnostic.relatedInformation = [
            {
              location: {
                uri: textDocument.uri,
                range: diagnostic.range
              },
              message:
                e.relatedIr?.slice(
                  e.startIndex ?? 0,
                  e.endIndex !== undefined ? e.endIndex + 1 : text.length
                ) ?? ''
            }
          ];
        }
        diagnostics.push(diagnostic);
      } else if (e instanceof SystemError) {
        diagnostics.push({
          severity: DiagnosticSeverity.Error,
          range: {
            start: textDocument.positionAt(0),
            end: textDocument.positionAt(text.length)
          },
          message: e.message,
          source: 'POML System (please report)'
        });
      } else {
        diagnostics.push({
          severity: DiagnosticSeverity.Error,
          range: {
            start: textDocument.positionAt(0),
            end: textDocument.positionAt(text.length)
          },
          message: e.message,
          source: 'POML Unknown Error (please report)'
        });
      }
    }

    return diagnostics;
  }

  private async onHover(params: HoverParams) {
    const textDocument = this.documents.get(params.textDocument.uri);
    if (textDocument === undefined) {
      return;
    }

    const offset = textDocument.offsetAt(params.position);
    const pomlFile = new PomlFile(textDocument.getText());
    const token = pomlFile.getHoverToken(offset);
    if (token) {
      this.telemetryReporter.reportTelemetry(TelemetryEvent.Hover, {
        rawText: textDocument.getText(),
        uri: textDocument.uri.toString(),
        token: JSON.stringify(token)
      });
      this.incrementStatistics('hover');
      const markdown = {
        kind: MarkupKind.Markdown,
        value:
          token.type !== 'element' && token.attribute
            ? this.queryDocumentationForParameter(token.element, token.attribute)
            : this.queryDocumentationForComponent(token.element)
      };
      return {
        contents: markdown,
        range: {
          start: textDocument.positionAt(token.range.start),
          end: textDocument.positionAt(token.range.end + 1)
        }
      };
    }
  }

  private queryDocumentationForComponent(componentName: string): string {
    const component = findComponentByAlias(componentName);
    if (typeof component === 'string') {
      return component;
    }
    const doc = component.spec();
    if (doc === undefined) {
      return `Documentation unavailable for ${component.name}.`;
    } else {
      return formatComponentDocumentation(doc);
    }
  }

  private queryDocumentationForParameter(componentName: string, parameter: string): string {
    const component = findComponentByAlias(componentName);
    if (typeof component === 'string') {
      return component;
    }
    const doc = component.spec();
    if (doc === undefined) {
      return `Documentation unavailable for ${component.name}.`;
    } else {
      const param = doc.params.find(param => param.name === parameter);
      if (param === undefined) {
        return `Documentation unavailable for ${parameter} in component ${component.name}.`;
      } else {
        return formatParameterDocumentation(param);
      }
    }
  }

  private onCompletion(textDocumentPosition: TextDocumentPositionParams): CompletionItem[] {
    const textDocument = this.documents.get(textDocumentPosition.textDocument.uri);
    if (textDocument === undefined) {
      return [];
    }
    const offset = textDocument.offsetAt(textDocumentPosition.position);
    const pomlFile = new PomlFile(textDocument.getText());
    const suggestions = pomlFile.getCompletions(offset);

    const toTextEdit = (suggestion: PomlToken, content: string) => {
      return {
        range: {
          start: textDocument.positionAt(suggestion.range.start),
          end: textDocument.positionAt(suggestion.range.end + 1)
        },
        newText: content
      };
    };

    const command = { command: 'poml.telemetry.completion', title: '' };

    const vscodeSuggestions = suggestions.map((suggestion): CompletionItem | undefined => {
      if (suggestion.type === 'element') {
        return {
          label: suggestion.element,
          kind: CompletionItemKind.Class,
          textEdit: toTextEdit(suggestion, suggestion.element),
          data: suggestion,
          command
        };
      } else if (suggestion.type === 'attribute' && suggestion.attribute !== undefined) {
        return {
          label: suggestion.attribute,
          kind: CompletionItemKind.Property,
          textEdit: toTextEdit(suggestion, suggestion.attribute),
          data: suggestion,
          command
        };
      } else if (suggestion.type === 'attributeValue' && suggestion.value !== undefined) {
        return {
          label: suggestion.value,
          kind: CompletionItemKind.Value,
          textEdit: toTextEdit(suggestion, suggestion.value),
          data: suggestion,
          command
        };
      } else {
        return undefined;
      }
    });
    const result = vscodeSuggestions.filter(suggestion => suggestion !== undefined);
    this.incrementStatistics('completion');
    this.incrementStatistics('completionItems', result.length);
    return result;
  }

  private onCompletionResolve(item: CompletionItem): CompletionItem {
    if (item.data === undefined) {
      return item;
    }
    const suggestion = item.data as PomlToken;
    if (suggestion.type === 'element') {
      item.detail = suggestion.element + ' (Component)';
      item.documentation = {
        kind: MarkupKind.Markdown,
        value: this.queryDocumentationForComponent(suggestion.element)
      };
    } else if (
      (suggestion.type === 'attribute' || suggestion.type === 'attributeValue') &&
      suggestion.attribute !== undefined
    ) {
      item.detail = suggestion.attribute + ' (Parameter of ' + suggestion.element + ')';
      item.documentation = {
        kind: MarkupKind.Markdown,
        value: this.queryDocumentationForParameter(suggestion.element, suggestion.attribute)
      };
    }
    this.incrementStatistics('completionResolve');
    return item;
  }
}

const lspServer = new PomlLspServer();
lspServer.listen();
