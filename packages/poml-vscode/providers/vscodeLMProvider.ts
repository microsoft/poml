import * as vscode from 'vscode';
import { Message } from 'poml';
import { LanguageModelSetting } from '../settings';

/**
 * Provider for VS Code's built-in Language Model API
 * This allows POML to use VS Code's LM API (GitHub Copilot, etc.)
 * without requiring users to configure API keys
 */
export class VSCodeLMProvider {
  private static instance: VSCodeLMProvider;
  private availableModels: vscode.LanguageModelChatSelector[] = [];
  
  private constructor() {
    this.detectAvailableModels();
  }

  public static getInstance(): VSCodeLMProvider {
    if (!VSCodeLMProvider.instance) {
      VSCodeLMProvider.instance = new VSCodeLMProvider();
    }
    return VSCodeLMProvider.instance;
  }

  /**
   * Check if VS Code LM API is available
   */
  public static isAvailable(): boolean {
    return 'lm' in vscode && typeof vscode.lm?.selectChatModels === 'function';
  }

  /**
   * Detect available language models in VS Code
   */
  private async detectAvailableModels(): Promise<void> {
    if (!VSCodeLMProvider.isAvailable()) {
      return;
    }

    // Try to detect available models from known vendors
    const vendors = ['copilot', 'claude', 'openai'];
    const families = ['gpt-4o', 'gpt-4o-mini', 'claude-3.5-sonnet', 'o1', 'o1-mini'];
    
    for (const vendor of vendors) {
      for (const family of families) {
        try {
          const models = await vscode.lm.selectChatModels({
            vendor,
            family
          });
          
          if (models && models.length > 0) {
            this.availableModels.push({ vendor, family });
          }
        } catch (e) {
          // Model not available, continue checking others
        }
      }
    }
  }

  /**
   * Get the list of available models
   */
  public async getAvailableModels(): Promise<string[]> {
    await this.detectAvailableModels();
    return this.availableModels.map(m => `${m.vendor}/${m.family}`);
  }

  /**
   * Convert POML messages to VS Code LM messages
   */
  private convertMessages(messages: Message[]): vscode.LanguageModelChatMessage[] {
    return messages.map(msg => {
      const role = this.mapSpeakerToRole(msg.speaker);
      const content = this.processMessageContent(msg.content);
      
      if (role === 'user') {
        return vscode.LanguageModelChatMessage.User(content);
      } else if (role === 'assistant') {
        return vscode.LanguageModelChatMessage.Assistant(content);
      } else {
        // System messages - VS Code LM API might handle these differently
        return vscode.LanguageModelChatMessage.User(`[System] ${content}`);
      }
    });
  }

  /**
   * Map POML speaker to VS Code LM role
   */
  private mapSpeakerToRole(speaker: string): 'user' | 'assistant' | 'system' {
    const mapping: Record<string, 'user' | 'assistant' | 'system'> = {
      'human': 'user',
      'ai': 'assistant',
      'system': 'system'
    };
    return mapping[speaker] || 'user';
  }

  /**
   * Process message content (handle text and images)
   */
  private processMessageContent(content: string | any[]): string {
    if (typeof content === 'string') {
      return content;
    }
    
    // Handle array content (text + images)
    return content.map(part => {
      if (typeof part === 'string') {
        return part;
      } else if (part.type?.startsWith('image/')) {
        // VS Code LM API might not support images directly
        // Return a placeholder or description
        return '[Image]';
      }
      return JSON.stringify(part);
    }).join('\n');
  }

  /**
   * Stream text from VS Code LM API
   */
  public async *streamText(
    messages: Message[],
    settings?: Partial<LanguageModelSetting>,
    cancellationToken?: vscode.CancellationToken
  ): AsyncGenerator<string> {
    if (!VSCodeLMProvider.isAvailable()) {
      throw new Error('VS Code Language Model API is not available');
    }

    // Select model based on settings or use default
    const modelSelector = this.getModelSelector(settings);
    const models = await vscode.lm.selectChatModels(modelSelector);
    
    if (!models || models.length === 0) {
      throw new Error(
        `No language models available for ${JSON.stringify(modelSelector)}. ` +
        'Please ensure you have signed in to GitHub Copilot or another language model provider.'
      );
    }

    const model = models[0]; // Use the first available model
    const vsCodeMessages = this.convertMessages(messages);
    
    // Prepare options
    const options: any = {};
    if (settings?.temperature !== undefined) {
      options.temperature = settings.temperature;
    }
    if (settings?.maxTokens !== undefined) {
      options.maxOutputTokens = settings.maxTokens;
    }

    try {
      // Send request to the model
      const chatResponse = await model.sendRequest(
        vsCodeMessages,
        options,
        cancellationToken || new vscode.CancellationTokenSource().token
      );

      // Stream the response
      for await (const fragment of chatResponse.text) {
        yield fragment;
      }
    } catch (error) {
      if (error instanceof vscode.LanguageModelError) {
        // Handle specific LM API errors
        if (error.code === 'UserConsentRequired') {
          throw new Error(
            'User consent is required to use the Language Model API. ' +
            'Please run this command from a user-initiated action and approve the consent dialog.'
          );
        } else if (error.code === 'NoPermissions') {
          throw new Error(
            'You do not have permissions to use the Language Model API. ' +
            'Please check your GitHub Copilot subscription or language model provider settings.'
          );
        } else if (error.code === 'Blocked') {
          throw new Error(
            'The language model blocked the request. ' +
            'This might be due to content policy violations.'
          );
        } else if (error.code === 'RateLimited') {
          throw new Error(
            'Rate limit exceeded. Please wait a moment before trying again.'
          );
        }
      }
      throw error;
    }
  }

  /**
   * Get model selector based on settings
   */
  private getModelSelector(settings?: Partial<LanguageModelSetting>): vscode.LanguageModelChatSelector {
    // If settings specify a model, try to parse it
    if (settings?.model) {
      const parts = settings.model.split('/');
      if (parts.length === 2) {
        return {
          vendor: parts[0],
          family: parts[1]
        };
      }
    }

    // Default to GPT-4o as recommended
    return {
      vendor: 'copilot',
      family: 'gpt-4o'
    };
  }

  /**
   * Check if a specific model is available
   */
  public async isModelAvailable(vendor: string, family: string): Promise<boolean> {
    if (!VSCodeLMProvider.isAvailable()) {
      return false;
    }

    try {
      const models = await vscode.lm.selectChatModels({ vendor, family });
      return models && models.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get user consent for using the Language Model API
   */
  public async requestUserConsent(): Promise<boolean> {
    if (!VSCodeLMProvider.isAvailable()) {
      return false;
    }

    try {
      // Attempt to select a model, which will trigger consent dialog if needed
      const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
      return models && models.length > 0;
    } catch (error) {
      if (error instanceof vscode.LanguageModelError && error.code === 'UserConsentRequired') {
        // User declined consent
        return false;
      }
      throw error;
    }
  }
}

/**
 * Integration helper for VS Code LM API with POML
 */
export class VSCodeLMIntegration {
  /**
   * Check if VS Code LM should be used based on settings
   */
  public static shouldUseVSCodeLM(settings: LanguageModelSetting): boolean {
    // Use VS Code LM if:
    // 1. Provider is set to 'vscode' explicitly
    // 2. No API key is configured and VS Code LM is available
    return (
      settings.provider === 'vscode' as any ||
      (!settings.apiKey && VSCodeLMProvider.isAvailable())
    );
  }

  /**
   * Create a stream generator using VS Code LM API
   */
  public static async *createStream(
    messages: Message[],
    settings: LanguageModelSetting,
    cancellationToken?: vscode.CancellationToken
  ): AsyncGenerator<string> {
    const provider = VSCodeLMProvider.getInstance();
    
    // Stream from VS Code LM API
    yield* provider.streamText(messages, settings, cancellationToken);
  }

  /**
   * Get available models from VS Code LM API
   */
  public static async getAvailableModels(): Promise<string[]> {
    const provider = VSCodeLMProvider.getInstance();
    return provider.getAvailableModels();
  }

  /**
   * Validate that VS Code LM is properly configured
   */
  public static async validate(): Promise<{ valid: boolean; message?: string }> {
    if (!VSCodeLMProvider.isAvailable()) {
      return {
        valid: false,
        message: 'VS Code Language Model API is not available in this version of VS Code.'
      };
    }

    const provider = VSCodeLMProvider.getInstance();
    const models = await provider.getAvailableModels();
    
    if (models.length === 0) {
      return {
        valid: false,
        message: 'No language models found. Please sign in to GitHub Copilot or configure a language model provider.'
      };
    }

    return { valid: true };
  }
}