# Using VS Code Language Model API with POML

POML now supports VS Code's built-in Language Model API, allowing you to use GitHub Copilot and other language models without configuring API keys.

## Overview

The VS Code Language Model API integration enables POML to:
- Use GitHub Copilot's language models directly
- Automatically detect available models
- Work without API key configuration
- Seamlessly fall back to VS Code LM when no other provider is configured

## Requirements

- VS Code version 1.95.0 or later
- Active GitHub Copilot subscription (or other language model provider)
- POML extension installed

## Quick Start

### Automatic Configuration

1. Open any `.poml` file in VS Code
2. Run the command: `POML: Auto-Configure Language Model`
3. If GitHub Copilot is available, POML will automatically configure itself to use it

### Manual Configuration

1. Open VS Code Settings (`Cmd/Ctrl + ,`)
2. Search for "POML Language Model"
3. Set the following:
   - **Provider**: `VS Code LM (GitHub Copilot)`
   - **Model**: `copilot/gpt-4o` (or leave blank for auto-detection)
   - **API Key**: Leave blank (not needed for VS Code LM)

### Detecting Available Models

To see which language models are available in your VS Code instance:

1. Run command: `POML: Detect VS Code Language Models`
2. The extension will show you all available models
3. Choose "Use VS Code LM" to automatically configure POML

## Supported Models

When using VS Code LM API, the following models are typically available:

- `copilot/gpt-4o` - GPT-4 Optimized (recommended)
- `copilot/gpt-4o-mini` - Smaller, faster variant
- `copilot/claude-3.5-sonnet` - Claude 3.5 Sonnet
- `copilot/o1` - OpenAI o1 model
- `copilot/o1-mini` - OpenAI o1 mini model

## Configuration Options

### settings.json

```json
{
  "poml.languageModel.provider": "vscode",
  "poml.languageModel.model": "copilot/gpt-4o",
  "poml.languageModel.temperature": 0.7,
  "poml.languageModel.maxTokens": 2000
}
```

### Provider Selection Priority

POML uses the following priority order for selecting a language model provider:

1. **Explicit VS Code LM**: If provider is set to "vscode"
2. **Automatic VS Code LM**: If no API key is configured and VS Code LM is available
3. **Configured Provider**: If API key and provider are configured

## Features

### Automatic Fallback

If you haven't configured any language model settings, POML will automatically try to use VS Code's Language Model API if available.

### User Consent

The first time you use VS Code LM API, you may be prompted to grant consent. This is a one-time authorization that allows extensions to use your language model subscription.

### Rate Limiting

VS Code LM API respects rate limits set by your language model provider. POML will handle rate limiting errors gracefully and provide appropriate feedback.

## Advantages

1. **No API Key Management**: Use your existing GitHub Copilot subscription
2. **Automatic Updates**: Models are updated automatically through VS Code
3. **Unified Billing**: Costs are included in your GitHub Copilot subscription
4. **Better Security**: No need to store API keys in settings
5. **Seamless Integration**: Works with VS Code's built-in authentication

## Troubleshooting

### "No language models found"

**Solution**: 
- Ensure you're signed in to GitHub Copilot
- Run: `GitHub Copilot: Sign In` from the command palette
- Update VS Code to version 1.95.0 or later

### "User consent required"

**Solution**:
- This is normal for first-time use
- Click "Allow" when prompted
- The consent is remembered for future sessions

### "Rate limit exceeded"

**Solution**:
- Wait a few moments before trying again
- Check your GitHub Copilot usage limits
- Consider using a model with higher rate limits

### Models not appearing

**Solution**:
1. Check VS Code version: `Help > About`
2. Verify GitHub Copilot extension is installed and active
3. Run `POML: Detect VS Code Language Models` to refresh

## Migration Guide

### From OpenAI API

```json
// Before
{
  "poml.languageModel.provider": "openai",
  "poml.languageModel.model": "gpt-4",
  "poml.languageModel.apiKey": "sk-..."
}

// After
{
  "poml.languageModel.provider": "vscode",
  "poml.languageModel.model": "copilot/gpt-4o"
  // No API key needed!
}
```

### From Azure OpenAI

```json
// Before
{
  "poml.languageModel.provider": "microsoft",
  "poml.languageModel.model": "gpt-4-deployment",
  "poml.languageModel.apiKey": "...",
  "poml.languageModel.apiUrl": "https://....openai.azure.com"
}

// After
{
  "poml.languageModel.provider": "vscode",
  "poml.languageModel.model": "copilot/gpt-4o"
}
```

## Best Practices

1. **Model Selection**: Use `copilot/gpt-4o` for best performance and quality
2. **Temperature**: Adjust temperature based on your use case (0.0-1.0)
3. **Token Limits**: Be aware of model token limits (GPT-4o supports up to 64K tokens)
4. **Error Handling**: Implement fallback logic for when models are unavailable

## Example Usage

### Basic Prompt Testing

1. Create a `.poml` file:
```xml
<poml>
  <role>You are a helpful assistant.</role>
  <task>Explain quantum computing in simple terms.</task>
</poml>
```

2. Click the "Test" button or run `POML: Test current prompt on Chat Models`
3. POML will automatically use VS Code LM if configured

### Programmatic Usage

```typescript
import { VSCodeLMIntegration } from 'poml-vscode/providers/vscodeLMProvider';

// Check if VS Code LM should be used
if (VSCodeLMIntegration.shouldUseVSCodeLM(settings)) {
  // Stream responses from VS Code LM
  const stream = VSCodeLMIntegration.createStream(messages, settings);
  
  for await (const chunk of stream) {
    console.log(chunk);
  }
}
```

## API Reference

### Commands

- `poml.detectVSCodeModels` - Detect available VS Code Language Models
- `poml.autoConfigureLM` - Automatically configure language model settings

### Settings

- `poml.languageModel.provider` - Set to "vscode" to use VS Code LM API
- `poml.languageModel.model` - Model identifier (e.g., "copilot/gpt-4o")
- `poml.languageModel.temperature` - Response randomness (0.0-1.0)
- `poml.languageModel.maxTokens` - Maximum response length

## Support

For issues or questions about VS Code LM integration:
1. Check the [POML GitHub Issues](https://github.com/microsoft/poml/issues)
2. Review [VS Code Language Model API docs](https://code.visualstudio.com/api/extension-guides/language-model)
3. Verify your GitHub Copilot subscription is active