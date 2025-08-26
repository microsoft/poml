import * as vscode from 'vscode';
import { Command } from '../util/commandManager';
import { POMLWebviewPanelManager } from '../panel/manager';
import { PanelSettings } from 'poml-vscode/panel/types';
import { PreviewMethodName, PreviewParams, PreviewResponse } from '../panel/types';
import { getClient } from '../extension';
import { Message } from 'poml';

import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAzure } from '@ai-sdk/azure';
import { ModelMessage, streamText, tool, jsonSchema, Tool, streamObject, TextStreamPart } from 'ai';

import ModelClient from '@azure-rest/ai-inference';
import { AzureKeyCredential } from '@azure/core-auth';
import { createSseStream } from '@azure/core-sse';
import { fileURLToPath } from 'url';
import { LanguageModelSetting } from 'poml-vscode/settings';
import { IncomingMessage } from 'node:http';
import { getTelemetryReporter } from 'poml-vscode/util/telemetryClient';
import { TelemetryEvent } from 'poml-vscode/util/telemetryServer';

let _globalGenerationController: GenerationController | undefined = undefined;

class GenerationController {
  private readonly abortControllers: AbortController[];

  private constructor() {
    this.abortControllers = [];
  }

  public static getNewAbortController() {
    if (!_globalGenerationController) {
      _globalGenerationController = new GenerationController();
    }
    const controller = new AbortController();
    _globalGenerationController.abortControllers.push(controller);
    return controller;
  }

  public static abortAll() {
    if (_globalGenerationController) {
      for (const controller of _globalGenerationController.abortControllers) {
        controller.abort();
      }
      _globalGenerationController.abortControllers.length = 0;
    }
  }
}

let outputChannel: vscode.OutputChannel | undefined = undefined;
let lastCommand: string | undefined = undefined;

function getOutputChannel() {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel('POML', 'log');
  }
  return outputChannel;
}

export class TestCommand implements Command {
  public id = 'poml.test';
  private readonly outputChannel: vscode.OutputChannel;

  public constructor(private readonly previewManager: POMLWebviewPanelManager) {
    this.outputChannel = getOutputChannel();
  }

  public execute(uri?: vscode.Uri, panelSettings?: PanelSettings) {
    lastCommand = this.id;
    if (!(uri instanceof vscode.Uri)) {
      if (vscode.window.activeTextEditor) {
        // we are relaxed and don't check for poml files
        uri = vscode.window.activeTextEditor.document.uri;
      }
    }

    if (uri) {
      this.testPrompt(uri);
    }
  }

  public async testPrompt(uri: vscode.Uri) {
    getTelemetryReporter()?.reportTelemetry(TelemetryEvent.CommandInvoked, {
      command: this.id
    });
    const fileUrl = fileURLToPath(uri.toString());
    this.outputChannel.show(true);
    const reporter = getTelemetryReporter();
    const reportParams: { [key: string]: string } = {};
    if (reporter) {
      const document = await vscode.workspace.openTextDocument(uri);
      reportParams.uri = uri.toString();
      reportParams.rawText = document.getText();
    }

    // Check if language model settings are configured
    const setting = this.getLanguageModelSettings(uri);
    if (!setting) {
      vscode.window.showErrorMessage('Language model settings are not configured. Please configure your language model settings first.');
      this.log('error', 'Prompt test aborted: Language model settings not found.');
      return;
    }
    
    if (!setting.provider) {
      vscode.window.showErrorMessage('Language model provider is not configured. Please set your provider in the extension settings.');
      this.log('error', 'Prompt test aborted: setting.provider is not configured.');
      return;
    }
    
    if (!setting.model) {
      vscode.window.showErrorMessage('Language model is not configured. Please set your model in the extension settings.');
      this.log('error', 'Prompt test aborted: setting.model is not configured.');
      return;
    }
    
    if (!setting.apiKey) {
      vscode.window.showErrorMessage('API key is not configured. Please set your API key in the extension settings.');
      this.log('error', 'Prompt test aborted: setting.apiKey not configured.');
      return;
    }

    if (!setting.apiUrl) {
      this.log('info', 'No API URL configured, using default for the provider.');
    }

    this.log(
      'info',
      `Testing prompt with ${this.isChatting ? 'chat model' : 'text completion model'}: ${fileUrl}`
    );
    const startTime = Date.now();
    let nextInterval: number = 1;
    const showProgress = () => {
      const timeElapsed = (Date.now() - startTime) / 1000;
      this.log('info', `Test in progress. ${Math.round(timeElapsed)} seconds elapsed.`);
      nextInterval *= 2;
      timer = setTimeout(showProgress, nextInterval * 1000);
    };

    let timer = setTimeout(showProgress, nextInterval * 1000);
    let result: string[] = [];
    try {
      const prompt = await this.renderPrompt(uri);
      const setting = this.getLanguageModelSettings(uri);
      reporter?.reportTelemetry(TelemetryEvent.PromptTestingStart, {
        ...reportParams,
        languageModel: JSON.stringify(setting),
        rendered: JSON.stringify(prompt)
      });

      const stream = this.routeStream(prompt, setting);
      let hasChunk = false;
      for await (const chunk of stream) {
        clearTimeout(timer);
        hasChunk = true;
        result.push(chunk);
        this.outputChannel.append(chunk);
      }
      if (!hasChunk) {
        this.log('error', 'No response received from the language model.');
      } else {
        this.outputChannel.appendLine('');
      }
      const timeElapsed = Date.now() - startTime;
      this.log('info', `Test completed in ${Math.round(timeElapsed / 1000)} seconds. Language models can make mistakes. Check important info.`);

      if (reporter) {
        reporter.reportTelemetry(TelemetryEvent.PromptTestingEnd, {
          ...reportParams,
          result: result.join(''),
          timeElapsed: timeElapsed
        });
      }
    } catch (e) {
      clearTimeout(timer);
      vscode.window.showErrorMessage(String(e));
      if (reporter) {
        reporter.reportTelemetry(TelemetryEvent.PromptTestingError, {
          ...reportParams,
          error: e ? e.toString() : '',
          partialResult: result.join('')
        });
      }

      if (e && (e as any).stack) {
        this.log('error', (e as any).stack);
      } else {
        this.log('error', String(e));
      }
    }
  }

  protected get isChatting() {
    return true;
  }

  private async renderPrompt(uri: vscode.Uri) {
    const options = this.previewManager.previewConfigurations.getResourceOptions(uri);
    const requestParams: PreviewParams = {
      uri: uri.toString(),
      speakerMode: this.isChatting,
      displayFormat: 'rendered',
      contexts: options.contexts,
      stylesheets: options.stylesheets,
    };

    const response: PreviewResponse = await getClient().sendRequest<PreviewResponse>(
      PreviewMethodName,
      requestParams
    );
    if (response.error) {
      throw new Error(`Error rendering prompt: ${uri}\n${response.error}`);
    }
    return response;
  }

  private async *routeStream(
    prompt: PreviewResponse,
    settings: LanguageModelSetting,
  ): AsyncGenerator<string> {
    if (settings.provider === 'microsoft' && settings.apiUrl?.includes('.models.ai.azure.com')) {
      yield* this.azureAiStream(prompt.content as Message[], settings);
    } else if (prompt.responseSchema) {
      yield* this.handleResponseSchemaStream(prompt, settings);
    } else {
      yield* this.handleRegularTextStream(prompt, settings);
    }
  }

  private async *handleResponseSchemaStream(
    prompt: PreviewResponse,
    settings: LanguageModelSetting,
  ): AsyncGenerator<string> {
    const model = this.getActiveVercelModel(settings);
    const vercelPrompt = this.isChatting ? this.pomlMessagesToVercelMessage(prompt.content as Message[])
      : prompt.content as string;
    
    if (prompt.tools) {
      throw new Error('Tools are not supported when response schema is provided.');
    }

    if (!prompt.responseSchema) {
      throw new Error('Response schema is required but not provided.');
    }

    const stream = streamObject({
      model: model,
      prompt: vercelPrompt,
      onError: ({ error }) => {
        // Immediately throw the error
        throw error;
      },
      schema: this.toVercelResponseSchema(prompt.responseSchema),
      maxRetries: 0,
      temperature: settings.temperature,
      maxOutputTokens: settings.maxTokens,
      ...prompt.runtime,
    });

    for await (const text of stream.textStream) {
      yield text;
    }
  }

  private async *handleRegularTextStream(
    prompt: PreviewResponse,
    settings: LanguageModelSetting,
  ): AsyncGenerator<string> {
    const model = this.getActiveVercelModel(settings);
    const vercelPrompt = this.isChatting ? this.pomlMessagesToVercelMessage(prompt.content as Message[])
      : prompt.content as string;

    const stream = streamText({
      model: model,
      prompt: vercelPrompt,
      onError: ({ error }) => {
        // Immediately throw the error
        throw error;
      },
      tools: prompt.tools ? this.toVercelTools(prompt.tools) : undefined,
      maxRetries: 0,
      temperature: settings.temperature,
      maxOutputTokens: settings.maxTokens,
      ...prompt.runtime,
    });

    let lastChunkEndline: boolean = false;
    for await (const chunk of stream.fullStream) {
      const result = this.processStreamChunk(chunk, lastChunkEndline);
      if (result !== null) {
        yield result;
        lastChunkEndline = result.endsWith('\n');
      }
    }
  }

  private processStreamChunk(chunk: TextStreamPart<any>, lastChunkEndline: boolean): string | null {
    const newline = lastChunkEndline ? '' : '\n';
    if (chunk.type === 'text-delta' || chunk.type === 'reasoning-delta') {
      return chunk.text;
    } else if (chunk.type === 'finish') {
      return this.formatUsageInfo(chunk, lastChunkEndline);
    } else if (chunk.type === 'tool-call') {
      return `${newline}Tool call (${chunk.toolCallId}) ${chunk.toolName}  Input: ${JSON.stringify(chunk.input)}`;
    } else if (chunk.type.startsWith('tool-input')) {
      return null;
    } else if (chunk.type === 'reasoning-start') {
      return `${newline}[Reasoning]`;
    } else if (chunk.type === 'reasoning-end') {
      return '\n[/Reasoning]';
    } else if (['start', 'finish', 'start-step', 'finish-step', 'message-metadata'].includes(chunk.type)) {
      return null;
    } else if (chunk.type === 'abort') {
      return `${newline}[Aborted]`;
    } else if (chunk.type === 'error') {
      // errors will be thrown, so we don't need to handle them here
      return null;
    } else {
      return `${newline}[${chunk.type} chunk: ${JSON.stringify(chunk)}]`;
    }
  }

  private formatUsageInfo(chunk: any, lastChunkEndline: boolean): string {
    const newline = lastChunkEndline ? '' : '\n';
    let usageInfo = `${newline}[Usage: input=${chunk.totalUsage.inputTokens}, output=${chunk.totalUsage.outputTokens}, ` +
      `total=${chunk.totalUsage.totalTokens}`;
    
    if (chunk.totalUsage.cachedInputTokens) {
      usageInfo += `, cached=${chunk.totalUsage.cachedInputTokens}`;
    }
    if (chunk.totalUsage.reasoningTokens) {
      usageInfo += `, reasoning=${chunk.totalUsage.reasoningTokens}`;
    }
    usageInfo += ']';
    
    return usageInfo;
  }

  private async *azureAiStream(
    prompt: Message[],
    settings: LanguageModelSetting
  ): AsyncGenerator<string> {
    if (!settings.apiUrl || !settings.apiKey) {
      throw new Error('Azure AI API URL or API key is not configured.');
    }
    if (!this.isChatting) {
      throw new Error('Azure AI is only supported for chat models.');
    }
    const client = ModelClient(settings.apiUrl, new AzureKeyCredential(settings.apiKey));

    const args: any = {};
    if (settings.maxTokens) {
      args.max_tokens = settings.maxTokens;
    }
    if (settings.temperature) {
      args.temperature = settings.temperature;
    }
    if (settings.model) {
      args.model = settings.model;
    }

    const response = await client
      .path('/chat/completions')
      .post({
        body: {
          messages: this.toMessageObjects(prompt, 'openai'),
          stream: true,
          ...args
        }
      })
      .asNodeStream();

    const stream = response.body;
    if (!stream) {
      throw new Error('The response stream is undefined');
    }

    if (response.status !== '200') {
      throw new Error(
        `Failed to get chat completions (status code ${response.status}): ${await streamToString(stream)}`
      );
    }

    const sses = createSseStream(stream as IncomingMessage);

    for await (const event of sses) {
      if (event.data === '[DONE]') {
        return;
      }
      for (const choice of JSON.parse(event.data).choices) {
        yield choice.delta?.content ?? '';
      }
    }

    async function streamToString(stream: NodeJS.ReadableStream): Promise<string> {
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      return Buffer.concat(chunks).toString('utf-8');
    }
  }

  private getActiveVercelModelProvider(settings: LanguageModelSetting) {
    switch (settings.provider) {
      case 'anthropic':
        return createAnthropic({
          baseURL: settings.apiUrl,
          apiKey: settings.apiKey,
        });
      case 'microsoft':
        return createAzure({
          baseURL: settings.apiUrl,
          apiKey: settings.apiKey
        });
      case 'openai':
        return createOpenAI({
          baseURL: settings.apiUrl,
          apiKey: settings.apiKey
        });
      case 'google':
        return createGoogleGenerativeAI({
          baseURL: settings.apiUrl,
          apiKey: settings.apiKey
        });
    }
  }

  private getActiveVercelModel(settings: LanguageModelSetting) {
    const provider = this.getActiveVercelModelProvider(settings);
    return provider(settings.model);
  }

  private pomlMessagesToVercelMessage(messages: Message[]): ModelMessage[] {
    const speakerToRole = {
      ai: 'assistant',
      human: 'user',
      system: 'system'
    }
    const result: ModelMessage[] = [];
    for (const msg of messages) {
      if (!msg.speaker) {
        throw new Error(`Message must have a speaker, found: ${JSON.stringify(msg)}`);
      }
      const role = speakerToRole[msg.speaker];
      const contents = typeof msg.content === 'string' ? msg.content : msg.content.map(part => {
        if (typeof part === 'string') {
          return { type: 'text', text: part };
        } else if (part.type.startsWith('image/')) {
          if (!part.base64) {
            throw new Error(`Image content must have base64 data, found: ${JSON.stringify(part)}`);
          }
          return { type: 'image', image: part.base64 };
        } else {
          throw new Error(`Unsupported content type: ${part.type}`);
        }
      });
      result.push({
        role: role as any,
        content: contents as any
      });
    }
    return result;
  }

  private toVercelTools(tools: { [key: string]: any }[]) {
    const result: { [key: string]: Tool } = {};
    for (const t of tools) {
      if (!t.name || !t.description || !t.parameters) {
        throw new Error(`Tool must have name, description, and parameters: ${JSON.stringify(t)}`);
      }
      if (t.type !== 'function') {
        throw new Error(`Unsupported tool type: ${t.type}. Only 'function' type is supported.`);
      }
      const schema = jsonSchema(t.parameters);
      result[t.name] = tool({
        description: t.description,
        inputSchema: schema
      });
    };
    this.log('info', 'Registered tools: ' + Object.keys(result).join(', '));
    return result;
  }

  private toVercelResponseSchema(responseSchema: { [key: string]: any }) {
    return jsonSchema(responseSchema);
  }

  private toMessageObjects(messages: Message[], style: 'openai' | 'google') {
    const speakerMapping = {
      ai: 'assistant',
      human: 'user',
      system: 'system'
    };
    return messages.map(msg => {
      return {
        role: speakerMapping[msg.speaker] ?? msg.speaker,
        content: msg.content
      };
    });
  }

  private getLanguageModelSettings(uri: vscode.Uri) {
    const settings = this.previewManager.previewConfigurations;
    return settings.loadAndCacheSettings(uri).languageModel;
  }

  private log(level: 'error' | 'info', message: string) {
    const tzOffset = new Date().getTimezoneOffset() * 60000;
    const time = new Date(Date.now() - tzOffset).toISOString().replace('T', ' ').replace('Z', '');
    this.outputChannel.appendLine(`${time} [${level}] ${message}`);
  }
}

export class TestNonChatCommand extends TestCommand {
  public id = 'poml.testNonChat';

  protected get isChatting() {
    return false;
  }
}

export class TestRerunCommand implements Command {
  public id = 'poml.testRerun';
  private readonly outputChannel: vscode.OutputChannel;

  constructor(previewManager: POMLWebviewPanelManager) {
    this.outputChannel = getOutputChannel();
  }

  public execute(...args: any[]): void {
    getTelemetryReporter()?.reportTelemetry(TelemetryEvent.CommandInvoked, {
      command: this.id
    });
    if (lastCommand) {
      this.outputChannel.clear();
      vscode.commands.executeCommand(lastCommand, ...args);
    } else {
      vscode.window.showErrorMessage('No test command to rerun');
    }
  }
}

export class TestAbortCommand implements Command {
  public readonly id = 'poml.testAbort';

  public constructor(private readonly previewManager: POMLWebviewPanelManager) { }

  public execute() {
    getTelemetryReporter()?.reportTelemetry(TelemetryEvent.PromptTestingAbort, {});
    GenerationController.abortAll();
  }
}
