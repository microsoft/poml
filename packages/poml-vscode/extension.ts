import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';

import { CommandManager } from './util/commandManager';
import * as command from './command';
import { Logger } from './util/logger';
import { POMLWebviewPanelManager } from './panel/manager';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node';
import { initializeReporter, getTelemetryReporter, TelemetryClient } from './util/telemetryClient';
import { TelemetryEvent } from './util/telemetryServer';
import { registerPomlChatParticipant } from './chat/participant';
import { registerPromptGallery, PromptGalleryProvider } from './chat/gallery';
import { EvaluationMessage, EvaluationNotification } from './panel/types';

let extensionPath = '';

export function getExtensionPath(): string {
  return extensionPath;
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  extensionPath = context.extensionPath;

  const logger = new Logger();

  const webviewManager = new POMLWebviewPanelManager(context, logger);
  const galleryProvider = registerPromptGallery(context);

  const commandManager = new CommandManager();
  context.subscriptions.push(commandManager);
  commandManager.register(new command.TestCommand(webviewManager));
  commandManager.register(new command.TestNonChatCommand(webviewManager));
  commandManager.register(new command.TestRerunCommand(webviewManager));
  commandManager.register(new command.TestAbortCommand(webviewManager));
  commandManager.register(new command.ShowPreviewCommand(webviewManager));
  commandManager.register(new command.ShowPreviewToSideCommand(webviewManager));
  commandManager.register(new command.ShowLockedPreviewToSideCommand(webviewManager));
  commandManager.register(new command.ShowSourceCommand(webviewManager));
  commandManager.register(new command.AddContextFileCommand(webviewManager));
  commandManager.register(new command.AddStylesheetFileCommand(webviewManager));
  commandManager.register(new command.RemoveContextFileCommand(webviewManager));
  commandManager.register(new command.RemoveStylesheetFileCommand(webviewManager));
  commandManager.register(new command.AddPromptCommand(galleryProvider));
  commandManager.register(new command.DeletePromptCommand(galleryProvider));
  commandManager.register(new command.EditPromptCommand(galleryProvider));

  registerPomlChatParticipant(context, galleryProvider);

  const connectionString = getConnectionString();
  if (connectionString) {
    const reporter = initializeReporter(connectionString);
    reporter.reportTelemetry(TelemetryEvent.Activate, environmentData());
  }

  // This must be after telemetry is initialized
  commandManager.register(new command.TelemetryCompletionAcceptanceCommand(webviewManager));

  activateClient(context, getTelemetryReporter());
  return { getClient };
}

// This method is called when your extension is deactivated
export function deactivate() {
  deactivateClient();
}

let client: LanguageClient;
let evaluationOutputChannel: vscode.OutputChannel | undefined;

export function activateClient(context: vscode.ExtensionContext, reporter?: TelemetryClient) {
  // The server is implemented in node
  const serverModule = context.asAbsolutePath(path.join('dist', 'server.js'));

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
    },
  };

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    // Register the server for plain text documents
    documentSelector: [{ scheme: 'file', language: 'poml' }],
  };

  // Create the language client and start the client.
  client = new LanguageClient('poml-vscode', 'POML Language Server', serverOptions, clientOptions);

  if (reporter) {
    client.onTelemetry(reporter.handleDataFromServer, reporter);
  }

  // Create output channel for evaluation results
  if (!evaluationOutputChannel) {
    evaluationOutputChannel = vscode.window.createOutputChannel('POML Debug', 'log');
  }

  // Register handler for evaluation notifications
  client.onNotification(EvaluationNotification, (message: EvaluationMessage) => {
    if (evaluationOutputChannel) {
      evaluationOutputChannel.appendLine(message.message);
      evaluationOutputChannel.show(true);
    }
  });

  // Start the client. This will also launch the server
  client.start();
}

export function getClient(): LanguageClient {
  return client;
}

export function deactivateClient(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  if (evaluationOutputChannel) {
    evaluationOutputChannel.dispose();
    evaluationOutputChannel = undefined;
  }
  return client.stop();
}

function environmentData(): { [key: string]: string | undefined } {
  return {
    version: vscode.extensions.getExtension('poml-team.poml')?.packageJSON.version,
    os: os.platform(),
    osRelease: os.release(),
    architecture: os.arch(),
    vscodeVersion: vscode.version,
  };
}

function getConnectionString(): string | undefined {
  return vscode.workspace.getConfiguration('poml').get<string>('telemetry.connection');
}
