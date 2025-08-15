# Add VS Code Language Model API Integration

## Summary

This PR implements comprehensive support for VS Code's Language Model API, allowing POML users to leverage GitHub Copilot and other language models without configuring API keys. This addresses issue #80 and significantly improves the user experience by removing configuration friction.

## Motivation

Currently, users must manually configure API keys and endpoints for language models, which creates several pain points:
- New users face a steep configuration barrier
- API key management poses security concerns
- Multiple configuration steps reduce adoption
- No seamless integration with existing VS Code language models

This PR solves these issues by integrating directly with VS Code's Language Model API, which is already used by GitHub Copilot and other extensions.

## Changes

### Core Implementation

1. **New VS Code LM Provider** (`packages/poml-vscode/providers/vscodeLMProvider.ts`)
   - `VSCodeLMProvider` class for interacting with VS Code LM API
   - `VSCodeLMIntegration` helper for seamless integration
   - Support for all major VS Code LM features (streaming, cancellation, error handling)

2. **Enhanced Test Command** (`packages/poml-vscode/command/testCommandEnhanced.ts`)
   - Automatic detection of VS Code LM availability
   - Intelligent fallback to VS Code LM when no API key configured
   - Seamless switching between providers

3. **Auto-Configuration Commands** (`packages/poml-vscode/command/detectModelsCommand.ts`)
   - `poml.detectVSCodeModels` - Detect available language models
   - `poml.autoConfigureLM` - Auto-configure POML to use VS Code LM

### Configuration Updates

- Added "vscode" as a language model provider option
- Updated package.json with new commands and settings
- Enhanced settings.ts to support the new provider type

### Documentation

- Comprehensive guide for VS Code LM API usage (`docs/vscode/vscode-lm-api.md`)
- Migration guides from other providers
- Troubleshooting section
- Best practices and examples

### Testing

- Complete test suite for VS Code LM provider (`packages/poml-vscode/tests/vscodeLMProvider.test.ts`)
- Tests for error handling, model detection, and streaming
- Mock implementations for VS Code API components

## Features

### 🚀 Zero Configuration
- Automatically detects and uses GitHub Copilot if available
- No API keys required
- One-click auto-configuration

### 🔄 Intelligent Fallback
- Automatically uses VS Code LM when no other provider configured
- Seamless switching between providers
- Graceful error handling

### 🔍 Model Discovery
- Detect all available language models
- Support for multiple model families (GPT-4o, Claude, o1)
- Real-time availability checking

### 🔒 Enhanced Security
- No API keys stored in settings
- Leverages VS Code's built-in authentication
- Respects user consent requirements

### 📊 Better User Experience
- Unified billing through GitHub Copilot subscription
- Automatic model updates
- Consistent with VS Code ecosystem

## Usage

### Quick Start
1. Install the updated POML extension
2. Run command: `POML: Auto-Configure Language Model`
3. Start using POML with GitHub Copilot!

### Manual Configuration
```json
{
  "poml.languageModel.provider": "vscode",
  "poml.languageModel.model": "copilot/gpt-4o"
}
```

## Testing

The implementation has been thoroughly tested with:
- ✅ Unit tests for all new components
- ✅ Integration tests with mock VS Code APIs
- ✅ Error handling scenarios
- ✅ Model detection and validation
- ✅ Streaming and cancellation

## Compatibility

- Requires VS Code 1.95.0 or later
- Backward compatible with existing POML configurations
- Works alongside traditional API key configurations

## Migration Path

Users can migrate seamlessly:
1. Existing configurations continue to work
2. New users get VS Code LM by default if available
3. One-command migration for existing users

## Future Enhancements

This PR lays the groundwork for:
- Support for VS Code's upcoming language model features
- Integration with VS Code's model selection UI
- Enhanced model-specific optimizations
- Tool/function calling support when available

## Checklist

- [x] Code implementation complete
- [x] Tests written and passing
- [x] Documentation updated
- [x] Package.json updated with new commands
- [x] Settings schema updated
- [x] Backward compatibility maintained
- [x] Error handling implemented
- [x] TypeScript types properly defined

## Screenshots/Demo

### Auto-Configuration Flow
1. User runs "Auto-Configure Language Model"
2. POML detects GitHub Copilot
3. Settings automatically updated
4. Ready to use without API keys!

### Model Detection
- Shows all available models
- One-click configuration
- Helpful error messages

## Related Issues

- Fixes #80: "make the extension use VS Code LM API"
- Addresses configuration issues mentioned in #84 and #98
- Improves onboarding experience

## Breaking Changes

None. This PR is fully backward compatible.

## Review Notes

Key files to review:
1. `packages/poml-vscode/providers/vscodeLMProvider.ts` - Core implementation
2. `packages/poml-vscode/command/testCommandEnhanced.ts` - Integration logic
3. `packages/poml-vscode/tests/vscodeLMProvider.test.ts` - Test coverage
4. `docs/vscode/vscode-lm-api.md` - User documentation

## Acknowledgments

Thanks to the VS Code team for the excellent Language Model API documentation and to the community for highlighting this need in issue #80.