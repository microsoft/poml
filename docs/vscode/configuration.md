# Configuration

Configure POML in VS Code settings (`Ctrl+,` or `Cmd+,`).

## Example Complete Configuration

```json
{
  "poml.languageModel.provider": "openai",
  "poml.languageModel.model": "gpt-4o",
  "poml.languageModel.apiKey": "sk-your-api-key-here",
  "poml.languageModel.apiUrl": "https://api.openai.com/v1/",
  "poml.languageModel.temperature": 0.7,
  "poml.languageModel.maxTokens": 1500,
  "poml.scrollPreviewWithEditor": true,
  "poml.markEditorSelection": true,
  "poml.trace": "off"
}
```

## Language Model Configuration

The following settings mainly control the language model used for POML testing feature within VSCode.

### Language Model Provider

```json
{
  "poml.languageModel.provider": "openai"
}
```

**Options:** `openai`, `microsoft`, `anthropic`, `google`  
**Default:** `openai`

### Model Name

```json
{
  "poml.languageModel.model": "gpt-4o"
}
```
**Default:** `gpt-4o`  
For Azure OpenAI, use the deployment name. For other providers, use the model code name.

### Temperature

```json
{
  "poml.languageModel.temperature": 0.5
}
```
**Default:** `0.5`  
**Range:** `0.0` to `2.0`  
Controls randomness in responses. Lower values are more deterministic.

### Max Tokens

```json
{
  "poml.languageModel.maxTokens": 2000
}
```
**Default:** `0` (unlimited)  
Maximum number of completion tokens to generate.

### API Key

```json
{
  "poml.languageModel.apiKey": "your-api-key-here"
}
```
**Required** for most providers. Keep this secure and never commit to version control.

**Note:** If you have GitHub Copilot enabled in VS Code, POML can automatically use VS Code's Language Model API when no API key is configured, providing seamless integration without additional setup.

### API URL

```json
{
  "poml.languageModel.apiUrl": "https://api.openai.com/v1/"
}
```
**Examples:**
- OpenAI: `https://api.openai.com/v1/`
- Azure OpenAI: `https://westeurope.api.cognitive.microsoft.com/`
- Custom OpenAI-compatible: `https://api.example.com/v2/`

### API Version

```json
{
  "poml.languageModel.apiVersion": "2024-02-15-preview"
}
```
**Optional** - Mainly used for OpenAI and Azure OpenAI services.

### Provider-Specific Examples

#### Azure OpenAI
```json
{
  "poml.languageModel.provider": "microsoft",
  "poml.languageModel.model": "my-gpt4-deployment",
  "poml.languageModel.apiKey": "your-azure-api-key",
  "poml.languageModel.apiUrl": "https://your-resource.openai.azure.com/",
  "poml.languageModel.apiVersion": "2024-02-15-preview"
}
```

#### Anthropic Claude
```json
{
  "poml.languageModel.provider": "anthropic",
  "poml.languageModel.model": "claude-3-5-sonnet-20241022",
  "poml.languageModel.apiKey": "your-anthropic-api-key"
}
```

#### Google Gemini
```json
{
  "poml.languageModel.provider": "google",
  "poml.languageModel.model": "gemini-1.5-pro",
  "poml.languageModel.apiKey": "your-google-api-key"
}
```

## Preview & Editor Settings

> These features need further testing. Please report bugs if you need this feature but it does not work as expected.

### Scroll Synchronization

```json
{
  "poml.scrollPreviewWithEditor": true,
  "poml.scrollEditorWithPreview": true
}
```
**Default:** `true`  
Synchronize scrolling between editor and preview panes.

### Editor Selection

```json
{
  "poml.markEditorSelection": true,
  "poml.doubleClickToSwitchToEditor": true
}
```
**Default:** `true`  
Highlight current editor selection in preview and enable double-click navigation.

## Development Settings

### Debugging
```json
{
  "poml.trace": "verbose"
}
```
**Options:** `off`, `verbose`  
**Default:** `off`

Enable detailed tracing for troubleshooting.

### Telemetry

```json
{
  "poml.telemetry.connection": ""
}
```
**Default:** `""` (empty)  
Development setting for telemetry connection string.
