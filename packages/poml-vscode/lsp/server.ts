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
  UnchangedDocumentDiagnosticReport,
  CodeLens,
  CodeLensParams,
  Command,
  ExecuteCommandParams,
  Range,
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import * as crypto from 'crypto';
import {
  Message,
  _readWithFile,
  writeWithSourceMap,
  SourceMapMessage,
  SourceMapRichContent,
  richContentFromSourceMap,
} from 'poml';
import {
  ErrorCollection,
  BufferCollection,
  findComponentByAlias,
  listComponents,
  Parameter,
  ReadError,
  RichContent,
  SystemError,
  WriteError,
  ContentMultiMediaBinary,
} from 'poml/base';
import { PomlFile, PomlToken } from 'poml/file';
import { encodingForModel, Tiktoken } from 'js-tiktoken';
import { readFile } from 'fs/promises';
import * as fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { PreviewParams, PreviewMethodName, PreviewResponse, WebviewUserOptions } from '../panel/types';
import { formatComponentDocumentation, formatParameterDocumentation } from './documentFormatter';
import { DelayedTelemetryReporter, TelemetryEvent, TelemetryServer } from 'poml-vscode/util/telemetryServer';
import { parseJsonWithBuffers } from 'poml/util/trace';
import { EvaluationMessage, EvaluationNotification } from '../panel/types';
import { getImageWidthHeight } from 'poml/util/image';
import { estimateImageTokens } from 'poml/util/tokenCounterImage';

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
  private encodingCache: Map<string, Tiktoken>;
  private associatedOptions: Map<string, WebviewUserOptions>;
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
    // this is a hack to store the options in the preview into the server.
    this.associatedOptions = new Map();

    this.encodingCache = new Map();

    this.statistics = {};

    this.telemetryReporter = new TelemetryServer(this.sendTelemetry.bind(this));
    this.statisticsReporter = new DelayedTelemetryReporter(this.telemetryReporter);
    this.edittingReporter = new DelayedTelemetryReporter(this.telemetryReporter);
    this.diagnosticsReporter = new DelayedTelemetryReporter(this.telemetryReporter);
  }

  private getAssociatedOptions(uri: string): WebviewUserOptions {
    let options = this.associatedOptions.get(uri);
    if (!options) {
      const filePath = fileURLToPath(uri);
      const base = filePath.replace(/(\.source)?\.poml$/i, '');
      const contexts: string[] = [];
      const stylesheets: string[] = [];
      if (fs.existsSync(`${base}.context.json`)) {
        contexts.push(`${base}.context.json`);
      }
      if (fs.existsSync(`${base}.stylesheet.json`)) {
        stylesheets.push(`${base}.stylesheet.json`);
      }
      options = {
        speakerMode: true,
        displayFormat: 'plain',
        contexts,
        stylesheets,
      };
      if (contexts.length > 0 || stylesheets.length > 0) {
        this.associatedOptions.set(uri, options);
      }
    }
    return options;
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
            resolveProvider: true,
          },
          diagnosticProvider: {
            interFileDependencies: false,
            workspaceDiagnostics: false,
          },
          hoverProvider: true,
          codeLensProvider: { resolveProvider: false },
          executeCommandProvider: { commands: ['poml.evaluateExpression'] },
        },
      };
    });

    this.connection.onHover(this.onHover.bind(this));
    this.connection.onCompletion(this.onCompletion.bind(this));
    this.connection.onCompletionResolve(this.onCompletionResolve.bind(this));
    this.connection.languages.diagnostics.on(this.onDiagnostic.bind(this));

    this.connection.onRequest(PreviewMethodName, this.onPreview.bind(this));
    this.connection.onCodeLens(this.onCodeLens.bind(this));
    this.connection.onExecuteCommand(this.onExecuteCommand.bind(this));

    // Provide a way to force the diagnostics to be reset.
    this.documents.onDidSave((change) => {
      // Invalidate the diagnostic cache
      const uri = change.document.uri.toString();
      this.diagnosticCache.delete(uri);
      BufferCollection.clear();
      // Ask the client to pull fresh diagnostics
      this.connection.languages.diagnostics.refresh();
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
      this.statistics,
    );
    if (reported) {
      this.statistics = {};
    }
  }

  private onCodeLens(params: CodeLensParams): CodeLens[] {
    const document = this.documents.get(params.textDocument.uri);
    if (!document) {
      return [];
    }
    const text = document.getText();
    const pomlFile = new PomlFile(text);
    let tokens: PomlToken[];
    try {
      tokens = pomlFile.getExpressionTokens();
    } catch (e) {
      console.error(`Failed to parse document for code lenses: ${e}`);
      return [];
    }
    const lenses: CodeLens[] = [];
    try {
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (token.expression === undefined) {
          continue;
        }
        const expr = token.expression;
        let titleExpr = expr;
        if (titleExpr.length > 20) {
          titleExpr = `${titleExpr.slice(0, 10)}...${titleExpr.slice(-10)}`;
        }
        const command: Command = {
          title: `▶️ Evaluate ${titleExpr}`,
          command: 'poml.evaluateExpression',
          arguments: [params.textDocument.uri, text, token.range.start, token.range.end],
        };
        const vscodeRange: Range = {
          start: document.positionAt(token.range.start),
          end: document.positionAt(token.range.end + 1),
        };
        lenses.push({ range: vscodeRange, command });
      }
    } catch (e) {
      console.error(`Failed to compute code lenses: ${e}`);
      return lenses;
    }
    return lenses;
  }

  private async onExecuteCommand(params: ExecuteCommandParams): Promise<any> {
    if (params.command !== 'poml.evaluateExpression') {
      return;
    }
    const uri = params.arguments?.[0] as string | undefined;
    const text = params.arguments?.[1] as string | undefined;
    const rangeStart = params.arguments?.[2] as number | undefined;
    const rangeEnd = params.arguments?.[3] as number | undefined;
    if (!uri || !text || rangeStart === undefined || rangeEnd === undefined) {
      const message: EvaluationMessage = {
        type: 'error',
        message: `${new Date().toLocaleString()} Invalid arguments for poml.evaluateExpression command`,
      };
      this.connection.sendNotification(EvaluationNotification, message);
      return;
    }
    const expression = text.slice(rangeStart, rangeEnd + 1);
    ErrorCollection.clear();
    const file = new PomlFile(text, undefined, fileURLToPath(uri));

    const options = this.getAssociatedOptions(uri);
    let context: any = {};
    if (options) {
      for (const c of options.contexts ?? []) {
        try {
          context = { ...context, ...parseJsonWithBuffers(await readFile(c, 'utf-8')) };
        } catch (e) {
          console.error(`Failed to parse context file ${c}: ${e}`);
        }
      }
    }

    file.react(context);

    if (!ErrorCollection.empty()) {
      const err = ErrorCollection.first()?.toString() ?? 'Unknown error';
      const message: EvaluationMessage = {
        type: 'error',
        message: `${new Date().toLocaleString()} Error during evaluation: ${expression} => ${err}`,
      };
      this.connection.sendNotification(EvaluationNotification, message);
    }

    const evaluations = file.getExpressionEvaluations({ start: rangeStart, end: rangeEnd });
    if (evaluations.length === 0) {
      const message: EvaluationMessage = {
        type: 'warning',
        message: `${new Date().toLocaleString()} No evaluations found for expression: ${expression} (${rangeStart}-${rangeEnd})`,
      };
      this.connection.sendNotification(EvaluationNotification, message);
      return;
    }
    for (let i = 0; i < evaluations.length; i++) {
      let result = evaluations[i];
      if (typeof result === 'object') {
        result = JSON.stringify(result, null, 2);
      }
      if (result.length > 1024) {
        result = `${result.slice(0, 1024)} ...[truncated]`;
      }
      const message: EvaluationMessage = {
        type: 'info',
        message: `${new Date().toLocaleString()} [Eval ${i + 1}] ${expression} => ${result}`,
      };
      this.connection.sendNotification(EvaluationNotification, message);
    }
  }

  private getModelEncoding(model: string): Tiktoken {
    if (this.encodingCache.has(model)) {
      return this.encodingCache.get(model)!;
    }
    try {
      const enc = encodingForModel(model as any);
      this.encodingCache.set(model, enc);
      return enc;
    } catch (e) {
      console.warn(`Unknown model "${model}"; using gpt-4o as default: ${e}`);
      const enc = encodingForModel('gpt-4o');
      this.encodingCache.set(model, enc);
      return enc;
    }
  }

  private async computeTokens(content: RichContent, model: string): Promise<number> {
    const enc = this.getModelEncoding(model);
    if (typeof content === 'string') {
      return enc.encode(content).length;
    } else {
      let total = 0;
      for (const part of content) {
        if (typeof part === 'string') {
          total += enc.encode(part).length;
        } else if ((part as any).base64) {
          const binaryPart = part as ContentMultiMediaBinary;
          const { width, height } = await getImageWidthHeight(binaryPart.base64);
          // For images, we can use a heuristic based on width and height
          total += estimateImageTokens(width, height, { model: model as any });
        } else {
          // estimate the token cost by json serializing the content
          const jsonContent = JSON.stringify(part);
          total += enc.encode(jsonContent).length;
        }
      }
      return total;
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
          documentContent = await readFile(filePath, 'utf-8');
        } catch (e) {
          // Unable to read the file
          return {
            rawText: '',
            ir: '',
            content: [],
            error: `Unable to read file: ${e}`,
          };
        }
      }
    }

    ErrorCollection.clear();
    let ir: string;
    let pomlFile: PomlFile | undefined;
    try {
      let context: { [key: string]: any } = params.inlineContext ?? {};
      for (const c of params.contexts ?? []) {
        try {
          context = { ...context, ...parseJsonWithBuffers(await readFile(c, 'utf-8')) };
        } catch (e) {
          console.error(`Failed to parse context file ${c}: ${e}`);
        }
      }
      let stylesheet: { [key: string]: any } = {};
      for (const s of params.stylesheets ?? []) {
        try {
          stylesheet = { ...stylesheet, ...parseJsonWithBuffers(await readFile(s, 'utf-8')) };
        } catch (e) {
          console.error(`Failed to parse stylesheet file ${s}: ${e}`);
        }
      }

      [ir, pomlFile] = await _readWithFile(documentContent, undefined, context, stylesheet, filePath);
    } catch (e) {
      this.telemetryReporter.reportTelemetryError(TelemetryEvent.ReadUncaughtException, e);
      console.error(e);
      return {
        rawText: documentContent,
        ir: '',
        content: [],
        error: `Unable to perform "read" step when rendering file: ${e}`,
      };
    }
    let result: Message[] | RichContent;
    let sourceMap: SourceMapMessage[] | SourceMapRichContent[] | undefined;
    let tokens: { perMessage?: number[]; total: number } | undefined = undefined;
    try {
      if (speakerMode) {
        const map = writeWithSourceMap(ir, { speaker: true }) as SourceMapMessage[];
        sourceMap = map;
        result = map.map((m) => ({
          speaker: m.speaker,
          content: richContentFromSourceMap(m.content),
        }));
        if (params.returnTokenCounts) {
          const model = params.returnTokenCounts.model;
          const perMessageTokens = await Promise.all(
            result.map(async (m) => await this.computeTokens(m.content, model)),
          );
          tokens = {
            perMessage: perMessageTokens,
            total: perMessageTokens.reduce((a, b) => a + b, 0),
          };
        }
      } else {
        const map = writeWithSourceMap(ir) as SourceMapRichContent[];
        sourceMap = map;
        result = richContentFromSourceMap(map);
        if (params.returnTokenCounts) {
          const model = params.returnTokenCounts.model;
          tokens = {
            total: await this.computeTokens(result, model),
          };
        }
      }
    } catch (e) {
      this.telemetryReporter.reportTelemetryError(TelemetryEvent.WriteUncaughtException, e);
      console.error(e);
      return {
        rawText: documentContent,
        ir,
        content: [],
        error: `Unable to perform "write" step when rendering file: ${e}`,
      };
    }

    return {
      rawText: documentContent,
      ir,
      content: result,
      tokens,
      sourceMap,
      responseSchema: pomlFile?.getResponseSchema()?.toOpenAPI(),
      tools: pomlFile?.getToolsSchema()?.toOpenAI(), // FIXME: handle errors gracefully here
      runtime: pomlFile?.getRuntimeParameters(),
      error: params.returnAllErrors
        ? ErrorCollection.list()
        : ErrorCollection.empty()
          ? undefined
          : ErrorCollection.first().toString(),
    };
  }

  private async onPreview(params: PreviewParams): Promise<PreviewResponse> {
    const key = JSON.stringify(params);
    const requestedTime = Date.now();
    await new Promise((resolve) => setTimeout(resolve, this.throttleTime));

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

    // NOTE: The lsp server uses the configuration from preview as the associated options.
    // This is a hack to set the options in the server.
    this.associatedOptions.set(params.uri.toString(), {
      speakerMode: params.speakerMode,
      displayFormat: params.displayFormat,
      contexts: [...params.contexts],
      stylesheets: [...params.stylesheets],
    });

    // Send telemetry
    this.incrementStatistics('preview');
    this.edittingReporter.reportTelemetry(TelemetryEvent.EdittingCurrently, {
      rawText: response.rawText,
      uri: params.uri,
      request: JSON.stringify(params),
      compileTime: elapsed,
      throttleTime: this.throttleTime,
    });

    // Dynamically adjust the throttle time
    const throttleTime = this.throttleTime * 0.9 + allocatedTime * 0.1;
    this.throttleTime = Math.min(Math.max(throttleTime, 10), 1000);

    this.cache.set(key, {
      key,
      latestComputedTime: computedTime, // Use the computed time as the time when source is retrieved
      latestResult: response,
    });

    return response;
  }

  private async onDiagnostic(
    params: DocumentDiagnosticParams,
  ): Promise<UnchangedDocumentDiagnosticReport | FullDocumentDiagnosticReport> {
    const key = params.textDocument.uri.toString();
    const document = this.documents.get(params.textDocument.uri);
    const cache = this.diagnosticCache.get(key) ?? { key, fileContent: undefined, diagnostics: [] };
    if (cache.fileContent === document?.getText()) {
      // Compute hash of the file content
      const hash = crypto
        .createHash('sha256')
        .update(cache.fileContent ?? '')
        .digest('hex');
      return {
        kind: DocumentDiagnosticReportKind.Unchanged,
        resultId: hash,
      };
    } else {
      const result = document !== undefined ? await this.validateTextDocument(document) : [];
      this.incrementStatistics('diagnostic');
      if (result.length > 0) {
        this.diagnosticsReporter.reportTelemetry(TelemetryEvent.Diagnostics, {
          rawText: document?.getText(),
          uri: params.textDocument.uri.toString(),
          diagnostics: JSON.stringify(result),
        });
      }
      this.diagnosticCache.set(key, { key, fileContent: document!.getText(), diagnostics: result });
      const hash = crypto.createHash('sha256').update(document!.getText()).digest('hex');
      return {
        kind: DocumentDiagnosticReportKind.Full,
        items: result,
        resultId: hash,
      };
    }
  }

  private async validateTextDocument(textDocument: TextDocument): Promise<Diagnostic[]> {
    const text = textDocument.getText();
    const diagnostics: Diagnostic[] = [];
    const otherDiagnostics: Record<string, { text: string; diags: Diagnostic[] }> = {};

    const options = this.getAssociatedOptions(textDocument.uri.toString());

    const response = await this.onPreview({
      uri: textDocument.uri,
      text: text,
      speakerMode: options.speakerMode,
      displayFormat: options.displayFormat,
      returnAllErrors: true,
      contexts: options.contexts,
      stylesheets: options.stylesheets,
      returnTokenCounts: undefined,
    });
    const errors = Array.isArray(response.error) ? response.error : response.error ? [response.error] : [];

    const normalizeStartEnd = (
      start: number | undefined,
      end: number | undefined,
      length: number,
    ): [number, number] => {
      start = start ?? 0;
      if (isNaN(start)) {
        start = 0;
      }
      end = Math.max(start + 1, end !== undefined ? end + 1 : length);
      if (isNaN(end)) {
        end = length;
      }
      return [start, end];
    };

    for (const e of errors) {
      const src = (e as any).sourcePath ? pathToFileURL((e as any).sourcePath).toString() : textDocument.uri.toString();
      let targetText = text;
      let doc = textDocument;
      if (src !== textDocument.uri.toString()) {
        const cached = this.documents.get(src as any);
        if (cached) {
          targetText = cached.getText();
          doc = cached;
        } else {
          try {
            targetText = await readFile((e as any).sourcePath, 'utf-8');
          } catch {
            targetText = '';
          }
          // FIXME: I don't think we should create a new TextDocument here.
          // Confirm this setting.
          doc = TextDocument.create(src, 'poml', 0, targetText);
        }
      }
      if (typeof e === 'string') {
        const diag = {
          severity: DiagnosticSeverity.Error,
          range: {
            start: doc.positionAt(0),
            end: doc.positionAt(targetText.length),
          },
          message: e,
          source: 'POML Unknown Error (please report)',
        } as Diagnostic;
        if (src === textDocument.uri.toString()) {
          diagnostics.push(diag);
        } else {
          (otherDiagnostics[src] ??= { text: targetText, diags: [] }).diags.push(diag);
        }
      } else if (e instanceof ReadError) {
        const [start, end] = normalizeStartEnd(e.startIndex, e.endIndex, targetText.length);
        const diag: Diagnostic = {
          severity: DiagnosticSeverity.Warning,
          range: {
            start: doc.positionAt(start),
            end: doc.positionAt(end),
          },
          message: e.message,
          source: 'POML Reader',
        };
        if (src === textDocument.uri.toString()) {
          diagnostics.push(diag);
        } else {
          (otherDiagnostics[src] ??= { text: targetText, diags: [] }).diags.push(diag);
        }
      } else if (e instanceof WriteError) {
        const [start, end] = normalizeStartEnd(e.startIndex, e.endIndex, targetText.length);
        const diagnostic: Diagnostic = {
          severity: DiagnosticSeverity.Warning,
          range: {
            start: doc.positionAt(start),
            end: doc.positionAt(end),
          },
          message: e.message,
          source: 'POML Writer',
        };
        if (this.hasDiagnosticRelatedInformationCapability) {
          diagnostic.relatedInformation = [
            {
              location: {
                uri: textDocument.uri,
                range: diagnostic.range,
              },
              message:
                e.relatedIr?.slice(e.startIndex ?? 0, e.endIndex !== undefined ? e.endIndex + 1 : text.length) ?? '',
            },
          ];
        }
        if (src === textDocument.uri.toString()) {
          diagnostics.push(diagnostic);
        } else {
          (otherDiagnostics[src] ??= { text: targetText, diags: [] }).diags.push(diagnostic);
        }
      } else if (e instanceof SystemError) {
        const diag = {
          severity: DiagnosticSeverity.Error,
          range: {
            start: doc.positionAt(0),
            end: doc.positionAt(targetText.length),
          },
          message: e.message,
          source: 'POML System (please report)',
        } as Diagnostic;
        if (src === textDocument.uri.toString()) {
          diagnostics.push(diag);
        } else {
          (otherDiagnostics[src] ??= { text: targetText, diags: [] }).diags.push(diag);
        }
      } else {
        const diag = {
          severity: DiagnosticSeverity.Error,
          range: {
            start: doc.positionAt(0),
            end: doc.positionAt(targetText.length),
          },
          message: e.message,
          source: 'POML Unknown Error (please report)',
        } as Diagnostic;
        if (src === textDocument.uri.toString()) {
          diagnostics.push(diag);
        } else {
          (otherDiagnostics[src] ??= { text: targetText, diags: [] }).diags.push(diag);
        }
      }
    }

    for (const [uri, { text: targetText, diags }] of Object.entries(otherDiagnostics)) {
      this.diagnosticCache.set(uri, { key: uri, fileContent: targetText, diagnostics: diags });
      this.connection.sendDiagnostics({ uri, diagnostics: diags });
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
        token: JSON.stringify(token),
      });
      this.incrementStatistics('hover');
      const markdown = {
        kind: MarkupKind.Markdown,
        value:
          token.type !== 'element' && token.attribute
            ? this.queryDocumentationForParameter(token.element!, token.attribute)
            : this.queryDocumentationForComponent(token.element!),
      };
      return {
        contents: markdown,
        range: {
          start: textDocument.positionAt(token.range.start),
          end: textDocument.positionAt(token.range.end + 1),
        },
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
      const param = doc.params.find((param) => param.name === parameter);
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
          end: textDocument.positionAt(suggestion.range.end + 1),
        },
        newText: content,
      };
    };

    const command = { command: 'poml.telemetry.completion', title: '' };

    const vscodeSuggestions = suggestions.map((suggestion): CompletionItem | undefined => {
      if (suggestion.type === 'element') {
        return {
          label: suggestion.element!,
          kind: CompletionItemKind.Class,
          textEdit: toTextEdit(suggestion, suggestion.element!),
          data: suggestion,
          command,
        };
      } else if (suggestion.type === 'attribute' && suggestion.attribute !== undefined) {
        return {
          label: suggestion.attribute,
          kind: CompletionItemKind.Property,
          textEdit: toTextEdit(suggestion, suggestion.attribute),
          data: suggestion,
          command,
        };
      } else if (suggestion.type === 'attributeValue' && suggestion.value !== undefined) {
        return {
          label: suggestion.value,
          kind: CompletionItemKind.Value,
          textEdit: toTextEdit(suggestion, suggestion.value),
          data: suggestion,
          command,
        };
      } else {
        return undefined;
      }
    });
    const result = vscodeSuggestions.filter((suggestion) => suggestion !== undefined);
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
      item.detail = suggestion.element! + ' (Component)';
      item.documentation = {
        kind: MarkupKind.Markdown,
        value: this.queryDocumentationForComponent(suggestion.element!),
      };
    } else if (
      (suggestion.type === 'attribute' || suggestion.type === 'attributeValue') &&
      suggestion.attribute !== undefined
    ) {
      item.detail = suggestion.attribute + ' (Parameter of ' + suggestion.element! + ')';
      item.documentation = {
        kind: MarkupKind.Markdown,
        value: this.queryDocumentationForParameter(suggestion.element!, suggestion.attribute),
      };
    }
    this.incrementStatistics('completionResolve');
    return item;
  }
}

const lspServer = new PomlLspServer();
lspServer.listen();
