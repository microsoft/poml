import * as vscode from 'vscode';
import { Command } from '../util/commandManager';
import { VSCodeLMProvider, VSCodeLMIntegration } from '../providers/vscodeLMProvider';

/**
 * Command to detect and list available VS Code Language Models
 */
export class DetectModelsCommand implements Command {
  public readonly id = 'poml.detectVSCodeModels';

  public async execute(): Promise<void> {
    // Show progress while detecting models
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Detecting VS Code Language Models',
      cancellable: false
    }, async (progress) => {
      progress.report({ increment: 0, message: 'Checking VS Code LM API availability...' });
      
      // Check if VS Code LM API is available
      if (!VSCodeLMProvider.isAvailable()) {
        vscode.window.showWarningMessage(
          'VS Code Language Model API is not available in this version of VS Code. ' +
          'Please update to the latest version (1.95.0 or later).'
        );
        return;
      }

      progress.report({ increment: 30, message: 'Searching for available models...' });
      
      // Get available models
      const provider = VSCodeLMProvider.getInstance();
      const models = await provider.getAvailableModels();
      
      progress.report({ increment: 70, message: 'Preparing results...' });
      
      if (models.length === 0) {
        const action = await vscode.window.showInformationMessage(
          'No language models found. Please sign in to GitHub Copilot or another language model provider.',
          'Sign in to GitHub',
          'Learn More'
        );
        
        if (action === 'Sign in to GitHub') {
          vscode.commands.executeCommand('github.copilot.signIn');
        } else if (action === 'Learn More') {
          vscode.env.openExternal(vscode.Uri.parse('https://docs.github.com/en/copilot/using-github-copilot/getting-started-with-github-copilot'));
        }
        return;
      }

      // Show available models
      const modelList = models.map(m => `• ${m}`).join('\n');
      const selectedAction = await vscode.window.showInformationMessage(
        `Found ${models.length} available language model(s):\n\n${modelList}`,
        'Use VS Code LM',
        'Configure Settings'
      );
      
      if (selectedAction === 'Use VS Code LM') {
        // Update settings to use VS Code LM
        await this.configureVSCodeLM();
      } else if (selectedAction === 'Configure Settings') {
        // Open settings
        vscode.commands.executeCommand('workbench.action.openSettings', 'poml.languageModel');
      }
    });
  }

  /**
   * Configure POML to use VS Code Language Model API
   */
  private async configureVSCodeLM(): Promise<void> {
    const config = vscode.workspace.getConfiguration('poml');
    
    // Set provider to 'vscode'
    await config.update('languageModel.provider', 'vscode', vscode.ConfigurationTarget.Global);
    
    // Set default model (copilot/gpt-4o)
    await config.update('languageModel.model', 'copilot/gpt-4o', vscode.ConfigurationTarget.Global);
    
    // Clear API key since it's not needed for VS Code LM
    await config.update('languageModel.apiKey', '', vscode.ConfigurationTarget.Global);
    await config.update('languageModel.apiUrl', '', vscode.ConfigurationTarget.Global);
    
    vscode.window.showInformationMessage(
      'POML has been configured to use VS Code Language Model API. ' +
      'You can now test your prompts without configuring API keys.'
    );
  }
}

/**
 * Command to automatically configure VS Code LM if available
 */
export class AutoConfigureCommand implements Command {
  public readonly id = 'poml.autoConfigureLM';

  public async execute(): Promise<void> {
    // Check current configuration
    const config = vscode.workspace.getConfiguration('poml');
    const currentProvider = config.get<string>('languageModel.provider');
    const hasApiKey = config.get<string>('languageModel.apiKey');
    
    // If already configured with API key, don't auto-configure
    if (hasApiKey && currentProvider !== 'vscode') {
      vscode.window.showInformationMessage(
        'Language model is already configured. Use "Detect VS Code Models" command to switch to VS Code LM.'
      );
      return;
    }

    // Check if VS Code LM is available
    if (!VSCodeLMProvider.isAvailable()) {
      vscode.window.showWarningMessage(
        'VS Code Language Model API is not available. Please configure your language model settings manually.'
      );
      vscode.commands.executeCommand('workbench.action.openSettings', 'poml.languageModel');
      return;
    }

    // Validate VS Code LM
    const validation = await VSCodeLMIntegration.validate();
    if (!validation.valid) {
      const action = await vscode.window.showWarningMessage(
        validation.message || 'VS Code Language Model is not available',
        'Configure Manually',
        'Sign in to GitHub'
      );
      
      if (action === 'Configure Manually') {
        vscode.commands.executeCommand('workbench.action.openSettings', 'poml.languageModel');
      } else if (action === 'Sign in to GitHub') {
        vscode.commands.executeCommand('github.copilot.signIn');
      }
      return;
    }

    // Auto-configure to use VS Code LM
    await config.update('languageModel.provider', 'vscode', vscode.ConfigurationTarget.Global);
    await config.update('languageModel.model', 'copilot/gpt-4o', vscode.ConfigurationTarget.Global);
    await config.update('languageModel.apiKey', '', vscode.ConfigurationTarget.Global);
    await config.update('languageModel.apiUrl', '', vscode.ConfigurationTarget.Global);
    
    vscode.window.showInformationMessage(
      'POML has been automatically configured to use VS Code Language Model API (GitHub Copilot).'
    );
  }
}