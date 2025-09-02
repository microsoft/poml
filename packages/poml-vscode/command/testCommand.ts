import * as vscode from 'vscode';
import { Command } from '../util/commandManager';
import { POMLWebviewPanelManager } from '../panel/manager';
import { PanelSettings } from 'poml-vscode/panel/types';
import { PreviewMethodName, PreviewParams, PreviewResponse } from '../panel/types';
import { getClient } from '../extension';
import { Message, RichContent } from 'poml';
import { ContentMultiMediaToolRequest, ContentMultiMediaToolResponse } from 'poml/base';

import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAzure } from '@ai-sdk/azure';
import {
  ModelMessage,
  streamText,
  streamObject,
  tool,
  Output,
  jsonSchema,
  Tool,
  TextStreamPart,
  TextPart,
  ImagePart,
  ToolCallPart,
  ToolResultPart,
} from 'ai';

import ModelClient from '@azure-rest/ai-inference';
import { AzureKeyCredential } from '@azure/core-auth';
import { createSseStream } from '@azure/core-sse';
import { fileURLToPath } from 'url';
import { LanguageModelSetting, ApiConfigValue } from 'poml-vscode/settings';
import { IncomingMessage } from 'node:http';
import { getTelemetryReporter } from 'poml-vscode/util/telemetryClient';
import { TelemetryEvent } from 'poml-vscode/util/telemetryServer';
import { ContentMultiMediaBinary } from 'poml/base';

let _globalGenerationController: GenerationController | undefined = undefined;

class GenerationController {
  private readonly abortControllers: AbortController[];
  private readonly cancellationTokens: vscode.CancellationTokenSource[];

  private constructor() {
    this.abortControllers = [];
    this.cancellationTokens = [];
  }

  public static getNewAbortController() {
    if (!_globalGenerationController) {
      _globalGenerationController = new GenerationController();
    }
    const controller = new AbortController();
    _globalGenerationController.abortControllers.push(controller);
    return controller;
  }

  public static getNewCancellationToken() {
    if (!_globalGenerationController) {
      _globalGenerationController = new GenerationController();
    }
    const tokenSource = new vscode.CancellationTokenSource();
    _globalGenerationController.cancellationTokens.push(tokenSource);
    return tokenSource;
  }

  public static abortAll() {
    if (_globalGenerationController) {
      for (const controller of _globalGenerationController.abortControllers) {
        controller.abort();
      }
      for (const tokenSource of _globalGenerationController.cancellationTokens) {
        tokenSource.cancel();
      }
      _globalGenerationController.abortControllers.length = 0;
      _globalGenerationController.cancellationTokens.length = 0;
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
      command: this.id,
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
      vscode.window.showErrorMessage(
        'Language model settings are not configured. Please configure your language model settings first.',
      );
      this.log('error', 'Prompt test aborted: Language model settings not found.');
      return;
    }

    if (!setting.provider) {
      vscode.window.showErrorMessage(
        'Language model provider is not configured. Please set your provider in the extension settings.',
      );
      this.log('error', 'Prompt test aborted: setting.provider is not configured.');
      return;
    }

    if (!setting.model) {
      vscode.window.showErrorMessage(
        'Language model is not configured. Please set your model in the extension settings.',
      );
      this.log('error', 'Prompt test aborted: setting.model is not configured.');
      return;
    }

    if (setting.provider !== 'vscode') {
      const apiKey = this.getProviderApiKey(setting);
      if (!apiKey) {
        vscode.window.showWarningMessage(
          'API key is not configured. Please set your API key in the extension settings.',
        );
        this.log('warn', 'API key is not configured for the provider.');
      }

      const apiUrl = this.getProviderApiUrl(setting);
      if (!apiUrl) {
        this.log('info', 'No API URL configured, using default for the provider.');
      }
    } else {
      this.log('info', 'Using VS Code language model API (GitHub Copilot). API URL and keys are ignored.');
    }

    this.log('info', `Testing prompt with ${this.isChatting ? 'chat model' : 'text completion model'}: ${fileUrl}`);
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
        rendered: JSON.stringify(prompt),
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
      this.log(
        'info',
        `Test completed in ${Math.round(timeElapsed / 1000)} seconds. Language models can make mistakes. Check important info.`,
      );

      if (reporter) {
        reporter.reportTelemetry(TelemetryEvent.PromptTestingEnd, {
          ...reportParams,
          result: result.join(''),
          timeElapsed: timeElapsed,
        });
      }
    } catch (e) {
      clearTimeout(timer);
      vscode.window.showErrorMessage(String(e));
      if (reporter) {
        reporter.reportTelemetry(TelemetryEvent.PromptTestingError, {
          ...reportParams,
          error: e ? e.toString() : '',
          partialResult: result.join(''),
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

    const response: PreviewResponse = await getClient().sendRequest<PreviewResponse>(PreviewMethodName, requestParams);
    if (response.error) {
      throw new Error(`Error rendering prompt: ${uri}\n${response.error}`);
    }
    return response;
  }

  private async *routeStream(prompt: PreviewResponse, settings: LanguageModelSetting): AsyncGenerator<string> {
    const runtime = prompt.runtime;
    const provider = runtime?.provider || settings.provider;
    const apiUrl = this.getProviderApiUrl(settings, runtime);

    if (provider === 'vscode') {
      yield* this.vscodeModelStream(prompt, settings);
    } else if (provider === 'microsoft' && apiUrl?.includes('.models.ai.azure.com')) {
      yield* this.azureAiStream(prompt.content as Message[], settings, runtime);
    } else if (prompt.responseSchema && (!prompt.tools || prompt.tools.length === 0)) {
      yield* this.handleResponseSchemaStream(prompt, settings);
    } else {
      yield* this.handleRegularTextStream(prompt, settings);
    }
  }

  private vercelRequestParameters(settings: LanguageModelSetting, runtime?: { [key: string]: any }) {
    const { model, provider, ...runtimeWithoutModelProvider } = runtime || {};
    const parameters = {
      model: this.getActiveVercelModel(settings, runtime),
      maxRetries: 0,
      temperature: settings.temperature,
      maxOutputTokens: settings.maxTokens,
      ...runtimeWithoutModelProvider, // This can override temperature, max output tokens, etc.
    };
    this.log('info', '[Request parameters] ' + JSON.stringify(parameters));
    return parameters;
  }

  private async *handleResponseSchemaStream(
    prompt: PreviewResponse,
    settings: LanguageModelSetting,
  ): AsyncGenerator<string> {
    const vercelPrompt = this.isChatting
      ? this.pomlMessagesToVercelMessage(prompt.content as Message[])
      : (prompt.content as string);

    if (prompt.tools) {
      throw new Error('Tools are not supported when response schema is provided.');
    }

    if (!prompt.responseSchema) {
      throw new Error('Response schema is required but not provided.');
    }

    if (!this.isChatting) {
      this.log('warn', 'Using a chat model for non-chat prompt. This may lead to suboptimal results.');
    }

    const abortController = GenerationController.getNewAbortController();

    const stream = streamObject({
      prompt: vercelPrompt,
      onError: ({ error }) => {
        // Immediately throw the error
        throw error;
      },
      abortSignal: abortController.signal,
      schema: this.toVercelResponseSchema(prompt.responseSchema),
      ...this.vercelRequestParameters(settings, prompt.runtime),
    });

    for await (const text of stream.textStream) {
      yield text;
    }
  }

  private async *handleRegularTextStream(
    prompt: PreviewResponse,
    settings: LanguageModelSetting,
  ): AsyncGenerator<string> {
    const vercelPrompt = this.isChatting
      ? this.pomlMessagesToVercelMessage(prompt.content as Message[])
      : (prompt.content as string);

    if (!this.isChatting) {
      this.log('warn', 'Using a chat model for non-chat prompt. This may lead to suboptimal results.');
    }

    if (prompt.responseSchema) {
      this.log(
        'warn',
        'Output schema and tools are both provided. This is experimental and is only supported for some models.',
      );
    }
    const abortController = GenerationController.getNewAbortController();

    const stream = streamText({
      prompt: vercelPrompt,
      onError: ({ error }) => {
        // Immediately throw the error
        throw error;
      },
      abortSignal: abortController.signal,
      tools: prompt.tools ? this.toVercelTools(prompt.tools) : undefined,
      experimental_output:
        prompt.responseSchema &&
        Output.object({
          schema: this.toVercelResponseSchema(prompt.responseSchema),
        }),
      ...this.vercelRequestParameters(settings, prompt.runtime),
    });

    let lastChunkEndline: boolean = true;
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
    } else if (
      ['start', 'finish', 'text-start', 'text-end', 'start-step', 'finish-step', 'message-metadata'].includes(
        chunk.type,
      )
    ) {
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
    let usageInfo =
      `${newline}[Usage: input=${chunk.totalUsage.inputTokens}, output=${chunk.totalUsage.outputTokens}, ` +
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

  private async *vscodeModelStream(prompt: PreviewResponse, settings: LanguageModelSetting): AsyncGenerator<string> {
    if (!('lm' in vscode) || typeof vscode.lm?.selectChatModels !== 'function') {
      throw new Error('VS Code language model API is not available.');
    }
    const modelSelector = {
      vendor: 'copilot',
      family: prompt.runtime?.model || settings.model,
    };
    this.log('info', `Selecting VS Code language model with ${JSON.stringify(modelSelector)}`);
    const models = await vscode.lm.selectChatModels(modelSelector);
    if (!models.length) {
      throw new Error(`No VS Code language models available with selector: ${JSON.stringify(modelSelector)}`);
    } else if (models.length > 1) {
      this.log('info', `Multiple VS Code language models found. The first one will be used: ${JSON.stringify(models)}`);
    }

    const model = models[0];
    const signal = GenerationController.getNewCancellationToken();

    const vscodePrompt = this.isChatting
      ? this.pomlMessagesToVsCodeMessage(prompt.content as Message[])
      : [vscode.LanguageModelChatMessage.User(prompt.content as string)];

    const options = {
      justification: 'Initiated by POML extension for VS Code',
      tools: prompt.tools ? this.toVsCodeTools(prompt.tools) : [],
    };

    const response = await model.sendRequest(vscodePrompt, options, signal.token);

    for await (const chunk of response.stream) {
      if ((chunk as any).value) {
        yield (chunk as any).value;
      } else {
        yield JSON.stringify(chunk);
      }
    }
  }

  private async *azureAiStream(
    prompt: Message[],
    settings: LanguageModelSetting,
    runtime?: { [key: string]: any },
  ): AsyncGenerator<string> {
    const apiUrl = this.getProviderApiUrl(settings, runtime);
    const apiKey = this.getProviderApiKey(settings, runtime);
    if (!apiUrl || !apiKey) {
      throw new Error('Azure AI API URL or API key is not configured.');
    }
    if (!this.isChatting) {
      throw new Error('Azure AI is only supported for chat models.');
    }
    const client = ModelClient(apiUrl, new AzureKeyCredential(apiKey));

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
          ...args,
        },
      })
      .asNodeStream();

    const stream = response.body;
    if (!stream) {
      throw new Error('The response stream is undefined');
    }

    if (response.status !== '200') {
      throw new Error(
        `Failed to get chat completions (status code ${response.status}): ${await streamToString(stream)}`,
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

  private getActiveVercelModelProvider(settings: LanguageModelSetting, runtime?: { [key: string]: any }) {
    const provider = runtime?.provider || settings.provider;
    const apiKey = this.getProviderApiKey(settings, runtime);
    const apiUrl = this.getProviderApiUrl(settings, runtime);

    if (runtime?.provider && runtime.provider !== settings.provider) {
      this.log('info', `Provider overridden from '${settings.provider}' to '${runtime.provider}' by runtime`);
      this.log('info', `Using ${apiUrl} as the API endpoint.`);

      // Warn if apiKey or apiUrl are plain strings when provider is overridden
      if (typeof settings.apiKey === 'string' && settings.apiKey) {
        this.log(
          'warn',
          `API key is configured as a plain string but provider was overridden from '${settings.provider}' to '${runtime.provider}'. Consider using provider-specific configuration: {"${settings.provider}": "...", "${runtime.provider}": "..."}`,
        );
      }
      if (typeof settings.apiUrl === 'string' && settings.apiUrl) {
        this.log(
          'warn',
          `API URL is configured as a plain string but provider was overridden from '${settings.provider}' to '${runtime.provider}'. Consider using provider-specific configuration: {"${settings.provider}": "...", "${runtime.provider}": "..."}`,
        );
      }
    }

    switch (provider) {
      case 'anthropic':
        return createAnthropic({
          baseURL: apiUrl,
          apiKey: apiKey,
        });
      case 'microsoft':
        return createAzure({
          baseURL: apiUrl,
          apiKey: apiKey,
        });
      case 'openai':
        return createOpenAI({
          baseURL: apiUrl,
          apiKey: apiKey,
        }).chat;
      case 'openaiResponse':
        return createOpenAI({
          baseURL: apiUrl,
          apiKey: apiKey,
        }).responses;
      case 'google':
        return createGoogleGenerativeAI({
          baseURL: apiUrl,
          apiKey: apiKey,
        });
    }
    throw new Error(
      `Unsupported provider: ${provider}. Supported providers are: openai, anthropic, microsoft, google.`,
    );
  }

  private getActiveVercelModel(settings: LanguageModelSetting, runtime?: { [key: string]: any }) {
    const provider = this.getActiveVercelModelProvider(settings, runtime);
    const model = runtime?.model || settings.model;

    if (runtime?.model && runtime.model !== settings.model) {
      this.log('info', `Model overridden from '${settings.model}' to '${runtime.model}' by runtime`);
    }

    return provider(model);
  }

  private richContentToVercelToolResult(content: RichContent) {
    if (typeof content === 'string') {
      return { type: 'text' as const, value: content };
    }

    // If it's an array, we need to handle mixed content
    const convertedContent = content.map((part) => {
      if (typeof part === 'string') {
        return { type: 'text' as const, text: part };
      } else if (part.type.startsWith('image/')) {
        const imagePart = part as ContentMultiMediaBinary;
        if (!imagePart.base64) {
          throw new Error(`Image content must have base64 data, found: ${JSON.stringify(part)}`);
        }
        return { type: 'media' as const, data: imagePart.base64, mediaType: imagePart.type };
      } else {
        throw new Error(`Unsupported content type: ${part.type}`);
      }
    });

    // If there's only one text item, return it as text type
    if (convertedContent.length === 1 && convertedContent[0].type === 'text') {
      return { type: 'text' as const, value: convertedContent[0].text };
    }

    // Otherwise, return the structured content array
    return { type: 'content' as const, value: convertedContent };
  }

  private pomlMessagesToVercelMessage(messages: Message[]): ModelMessage[] {
    const speakerToRole = {
      ai: 'assistant',
      human: 'user',
      system: 'system',
      tool: 'tool',
    };
    const result: ModelMessage[] = [];
    for (const msg of messages) {
      if (!msg.speaker) {
        throw new Error(`Message must have a speaker, found: ${JSON.stringify(msg)}`);
      }
      const role = speakerToRole[msg.speaker];
      const contents =
        typeof msg.content === 'string'
          ? msg.content
          : msg.content.map((part) => {
              if (typeof part === 'string') {
                return { type: 'text', text: part } satisfies TextPart;
              } else if (part.type.startsWith('image/')) {
                const binaryPart = part as ContentMultiMediaBinary;
                if (!binaryPart.base64) {
                  throw new Error(`Image content must have base64 data, found: ${JSON.stringify(part)}`);
                }
                return { type: 'image', image: binaryPart.base64 } satisfies ImagePart;
              } else if (part.type === 'application/vnd.poml.toolrequest') {
                const toolRequest = part as ContentMultiMediaToolRequest;
                return {
                  type: 'tool-call',
                  toolCallId: toolRequest.id,
                  toolName: toolRequest.name,
                  input: toolRequest.content,
                } satisfies ToolCallPart;
              } else if (part.type === 'application/vnd.poml.toolresponse') {
                const toolResponse = part as ContentMultiMediaToolResponse;
                return {
                  type: 'tool-result',
                  toolCallId: toolResponse.id,
                  toolName: toolResponse.name,
                  output: this.richContentToVercelToolResult(toolResponse.content),
                } satisfies ToolResultPart;
              } else {
                throw new Error(`Unsupported content type: ${part.type}`);
              }
            });
      result.push({
        role: role as any,
        content: contents as any,
      });
    }
    return result;
  }

  private toVercelTools(tools: { [key: string]: any }[]) {
    const result: { [key: string]: Tool } = {};
    for (const t of tools) {
      if (!t.name || !t.parameters) {
        throw new Error(`Tool must have name and parameters: ${JSON.stringify(t)}`);
      }
      if (t.type !== 'function') {
        throw new Error(`Unsupported tool type: ${t.type}. Only 'function' type is supported.`);
      }
      const schema = jsonSchema(t.parameters);
      result[t.name] = tool({
        description: t.description,
        inputSchema: schema,
      });
    }
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
      system: 'system',
      tool: 'tool',
    };
    return messages.map((msg) => {
      return {
        role: speakerMapping[msg.speaker] ?? msg.speaker,
        content: msg.content,
      };
    });
  }

  /**
   * Convert POML messages to VS Code LanguageModelChatMessage format
   * Handles role mapping, content conversion, and message merging for the VS Code API
   */
  private pomlMessagesToVsCodeMessage(messages: Message[]): vscode.LanguageModelChatMessage[] {
    // Convert each POML message to VS Code format
    const vscodeMessage = messages.map((msg) => {
      // Map POML speaker types to VS Code roles
      let role: vscode.LanguageModelChatMessageRole;

      switch (msg.speaker) {
        case 'human':
          // Human messages map directly to User role
          role = vscode.LanguageModelChatMessageRole.User;
          break;
        case 'ai':
          // AI messages map to Assistant role
          role = vscode.LanguageModelChatMessageRole.Assistant;
          break;
        case 'tool': // Tool responses are typically treated as user response messages in VS Code
        case 'system':
          // VS Code doesn't have a direct system role, treat as user
          // This ensures tool responses and system messages are properly handled
          role = vscode.LanguageModelChatMessageRole.User;
          break;
        default:
          // Default to user for unknown speakers
          role = vscode.LanguageModelChatMessageRole.User;
      }

      // Convert POML RichContent to VS Code message content parts
      // This handles text, images, tool calls, and tool results
      const content = this.richContentToVsCodeMessageContent(msg.content);

      if (content.length === 1 && 'value' in content[0]) {
        return new vscode.LanguageModelChatMessage(role, content[0].value);
      } else {
        return new vscode.LanguageModelChatMessage(role, content);
      }
    });

    // TODO: Merge consecutive messages from the same role
    return vscodeMessage;
  }

  /**
   * Convert POML RichContent to VS Code message content parts
   * Handles various content types including text, images, tool calls, and tool results
   */
  private richContentToVsCodeMessageContent(
    content: RichContent,
  ): (vscode.LanguageModelTextPart | vscode.LanguageModelToolResultPart | vscode.LanguageModelToolCallPart)[] {
    // Handle simple string content
    if (typeof content === 'string') {
      return [{ value: content }];
    }

    // Helper function to flatten nested content structures into a string
    // Used for tool results which need to be stringified
    const flattenMessageContent = (content: any): string => {
      if (typeof content === 'string') {
        return content;
      } else if (Array.isArray(content)) {
        // Recursively flatten array elements and join with newlines
        return content.map(flattenMessageContent).join('\n');
      } else if (typeof content === 'object' && 'value' in content) {
        // Extract and flatten the value property
        return flattenMessageContent(content.value);
      } else {
        // Fallback: stringify any other content type
        return JSON.stringify(content);
      }
    };

    // Process each part of the rich content array
    return content.map((part) => {
      if (typeof part === 'string') {
        // Handle plain text parts
        return { value: part } satisfies vscode.LanguageModelTextPart;
      } else if (part.type.startsWith('image/')) {
        // Handle image content (with limitations)
        const binaryPart = part as ContentMultiMediaBinary;
        // VS Code API doesn't fully support images, use placeholder text
        this.log('warn', 'Images in messages are not fully supported in VS Code chat API. Using placeholder text.');
        return { value: `[Image: ${binaryPart.alt || 'unsupported in text'}]` } satisfies vscode.LanguageModelTextPart;
      } else if (part.type === 'application/vnd.poml.toolrequest') {
        // Handle tool call requests
        const toolRequest = part as ContentMultiMediaToolRequest;
        return {
          callId: toolRequest.id,
          name: toolRequest.name,
          input: toolRequest.content,
        } satisfies vscode.LanguageModelToolCallPart;
      } else if (part.type === 'application/vnd.poml.toolresponse') {
        // Handle tool call responses
        const toolResponse = part as ContentMultiMediaToolResponse;
        // Tool results need to be flattened to string format
        return {
          callId: toolResponse.id,
          content: [flattenMessageContent(this.richContentToVercelToolResult(toolResponse.content))],
        } satisfies vscode.LanguageModelToolResultPart;
      } else {
        // Throw error for unsupported content types
        throw new Error(`Unsupported content type: ${part.type}`);
      }
    });
  }

  private toVsCodeTools(tools: { [key: string]: any }[]) {
    const result: vscode.LanguageModelChatTool[] = [];
    for (const t of tools) {
      if (!t.name || !t.parameters) {
        throw new Error(`Tool must have name and parameters: ${JSON.stringify(t)}`);
      }
      if (t.type !== 'function') {
        throw new Error(`Unsupported tool type: ${t.type}. Only 'function' type is supported.`);
      }
      result.push({
        name: t.name,
        description: t.description,
        inputSchema: t.parameters,
      });
    }
    return result;
  }

  private getLanguageModelSettings(uri: vscode.Uri) {
    const settings = this.previewManager.previewConfigurations;
    return settings.loadAndCacheSettings(uri).languageModel;
  }

  private extractProviderValue(value: ApiConfigValue | undefined, provider: string): string | undefined {
    if (!value) {
      return undefined;
    }

    if (typeof value === 'string') {
      return value || undefined;
    }

    // It's an object, so extract the provider-specific value
    const extracted = value[provider];
    return extracted || undefined;
  }

  private getProviderApiKey(settings: LanguageModelSetting, runtime?: { [key: string]: any }): string | undefined {
    // Runtime can override the provider
    const provider = runtime?.provider || settings.provider;
    return this.extractProviderValue(settings.apiKey, provider);
  }

  private getProviderApiUrl(settings: LanguageModelSetting, runtime?: { [key: string]: any }): string | undefined {
    // Runtime can override the provider
    const provider = runtime?.provider || settings.provider;
    return this.extractProviderValue(settings.apiUrl, provider);
  }

  private log(level: 'error' | 'warn' | 'info', message: string) {
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
      command: this.id,
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

  public constructor(private readonly previewManager: POMLWebviewPanelManager) {}

  public execute() {
    getTelemetryReporter()?.reportTelemetry(TelemetryEvent.PromptTestingAbort, {});
    GenerationController.abortAll();
  }
}
