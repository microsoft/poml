import * as vscode from 'vscode';
import { Command } from '../util/commandManager';
import { POMLWebviewPanelManager } from '../panel/manager';
import { PanelSettings } from 'poml-vscode/panel/types';
import { PreviewMethodName, PreviewParams, PreviewResponse } from '../panel/types';
import { getClient } from '../extension';
import { Message, RichContent } from 'poml';
const { BaseChatModel } = require('@langchain/core/language_models/chat_models');  // eslint-disable-line @typescript-eslint/no-var-requires
const {
  HumanMessage,
  AIMessage,
  SystemMessage,
  BaseMessage,
  MessageContent,
  MessageContentComplex
} = require('@langchain/core/messages');  // eslint-disable-line @typescript-eslint/no-var-requires
// import { ChatAnthropic } from "@langchain/anthropic";
const { AzureChatOpenAI, ChatOpenAI, AzureOpenAI, OpenAI } = require('@langchain/openai');  // eslint-disable-line @typescript-eslint/no-var-requires
const { ChatGoogleGenerativeAI, GoogleGenerativeAI } = require('@langchain/google-genai');  // eslint-disable-line @typescript-eslint/no-var-requires
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
    if (!setting || !setting.provider || !setting.model || !setting.apiKey || !setting.apiUrl) {
      vscode.window.showErrorMessage(
        'Language model settings are not fully configured. Please set your provider, model, API key, and endpoint in the extension settings before testing prompts.'
      );
      this.log('error', 'Prompt test aborted: LLM settings not configured.');
      return;
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
      for await (const chunk of stream) {
        clearTimeout(timer);
        result.push(chunk);
        this.outputChannel.append(chunk);
      }
      this.outputChannel.appendLine('');
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
    const requestParams: PreviewParams = {
      uri: uri.toString(),
      speakerMode: this.isChatting,
      displayFormat: 'rendered'
    };

    const response: PreviewResponse = await getClient().sendRequest<PreviewResponse>(
      PreviewMethodName,
      requestParams
    );
    if (response.error) {
      throw new Error(`Error rendering prompt: ${uri}\n${response.error}`);
    }
    return response.content;
  }

  private async *routeStream(
    prompt: Message[] | RichContent,
    settings: LanguageModelSetting
  ): AsyncGenerator<string> {
    if (settings.provider === 'microsoft' && settings.apiUrl?.includes('.models.ai.azure.com')) {
      yield* this.azureAiStream(prompt as Message[], settings);
    } else {
      yield* this.langchainStream(prompt, settings);
    }
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

  private async *langchainStream(
    prompt: Message[] | RichContent,
    settings: LanguageModelSetting
  ): AsyncGenerator<string> {
    const lm = this.getActiveLangchainModel(settings);
    const lcPrompt = this.isChatting
      ? this.toLangchainMessages(
          prompt as Message[],
          settings.provider === 'google' ? 'google' : 'openai'
        )
      : this.toLangchainString(prompt as RichContent);
    GenerationController.abortAll();
    const stream = await lm.stream(lcPrompt, {
      signal: GenerationController.getNewAbortController().signal
    });
    for await (const chunk of stream) {
      if (typeof chunk === 'string') {
        yield chunk;
      } else if (typeof chunk.content === 'string') {
        yield chunk.content;
      } else {
        for (const complex of chunk.content) {
          yield `[not displayable ${complex.type}]`;
        }
      }
    }
  }

  private getActiveLangchainModel(settings: LanguageModelSetting) {
    switch (settings.provider) {
      case 'anthropic':
        // return new ChatAnthropic({
        //   model: settings.model,
        //   anthropicApiKey: settings.apiKey,
        //   anthropicApiUrl: settings.apiUrl,
        //   maxTokens: settings.maxTokens,
        //   temperature: settings.temperature
        // });
        throw new Error('Anthropic is currently not supported');
      case 'microsoft':
        return new (this.isChatting ? AzureChatOpenAI : AzureOpenAI)({
          azureOpenAIApiDeploymentName: settings.model,
          azureOpenAIApiKey: settings.apiKey,
          azureOpenAIEndpoint: settings.apiUrl,
          azureOpenAIApiVersion: settings.apiVersion,
          maxTokens: settings.maxTokens,
          temperature: settings.temperature
        });
      case 'openai':
        return new (this.isChatting ? ChatOpenAI : OpenAI)({
          model: settings.model,
          maxTokens: settings.maxTokens,
          temperature: settings.temperature,
          apiKey: settings.apiKey,
          configuration: {
            apiKey: settings.apiKey,
            baseURL: settings.apiUrl
          }
        });
      case 'google':
        return new (this.isChatting ? ChatGoogleGenerativeAI : GoogleGenerativeAI)({
          model: settings.model,
          maxOutputTokens: settings.maxTokens,
          temperature: settings.temperature,
          apiKey: settings.apiKey,
          apiVersion: settings.apiVersion,
          baseUrl: settings.apiUrl
        });
      default:
        throw new Error(`Unsupported language model provider: ${settings.provider}`);
    }
  }

  private toLangchainMessages(messages: Message[], style: 'openai' | 'google') {
    return messages.map(msg => {
      const content = this.messageToContentObject(msg, style);
      switch (msg.speaker) {
        case 'ai':
          return new AIMessage({ content });
        case 'human':
          return new HumanMessage({ content });
        case 'system':
          return new SystemMessage({ content });
        default:
          throw new Error(`Invalid speaker: ${msg.speaker}`);
      }
    });
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

  private toLangchainString(content: RichContent): string {
    if (typeof content === 'string') {
      return content;
    }
    return content
      .map(part => {
        if (typeof part === 'string') {
          return part;
        } else {
          return `[not displayable ${part.type}]`;
        }
      })
      .join('');
  }

  private messageToContentObject(msg: Message, style: 'openai' | 'google') {
    if (typeof msg.content === 'string') {
      return [
        {
          type: 'text',
          text: msg.content
        }
      ];
    } else {
      return msg.content.map(part => {
        if (typeof part === 'string') {
          return {
            type: 'text',
            text: part
          };
        } else if (part.type.startsWith('image/')) {
          if (style === 'google') {
            return {
              type: 'image_url',
              image_url: `data:${part.type};base64,${part.base64}`
            };
          } else {
            return {
              type: 'image_url',
              image_url: {
                url: `data:${part.type};base64,${part.base64}`
              }
            };
          }
        } else {
          throw new Error(`Unsupported content type: ${part.type}`);
        }
      });
    }
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

  public constructor(private readonly previewManager: POMLWebviewPanelManager) {}

  public execute() {
    getTelemetryReporter()?.reportTelemetry(TelemetryEvent.PromptTestingAbort, {});
    GenerationController.abortAll();
  }
}
