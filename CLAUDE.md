# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

POML (Prompt Orchestration Markup Language) is a structured markup language for advanced prompt engineering with LLMs. It provides an HTML-like syntax with semantic components, comprehensive data handling, and a CSS-like styling system. The project consists of:

- **VS Code Extension**: Development environment with syntax highlighting, auto-completion, and live preview
- **Node.js SDK**: JavaScript/TypeScript library for POML processing
- **Python SDK**: Python wrapper around the Node.js implementation
- **Browser Extension**: Chrome extension for POML support in browsers

## Development Commands

### Build Commands

```bash
# Build all packages
npm run compile           # Compile TypeScript to JavaScript
npm run build-extension    # Build VS Code extension for production
npm run build-webview      # Build webview components
npm run build-cli          # Build CLI tool

# Build documentation and specs
npm run generate-component-spec   # Generate componentDocs.json and components.md
npm run generate-vscodeignore     # Generate .vscodeignore file to ignore node_modules except a few packages

# Build individual packages
cd packages/poml-build && npm run build    # Build Node.js SDK
cd packages/poml-browser && npm run build  # Build browser extension (with rollup)

# Development builds
npm run build-extension-dev  # Build extension in dev mode
npm run watch-extension      # Watch mode for extension
npm run watch                # Watch mode for TypeScript compilation
```

### Testing Commands

```bash
npm test                   # Run all Jest tests
npm run test-vscode        # Run VS Code extension tests
npm run lint               # Run ESLint on packages directory

# Run specific test files
npx jest packages/poml/tests/components.test.ts
```

### Package Management

```bash
npm run package            # Create VSIX package for VS Code extension
npm run package:win        # Create Windows-specific VSIX package
cd packages/poml-build && npm pack       # Create Node.js SDK package, first compile TypeScript, then rollup
cd packages/poml-browser && npm run zip  # Create browser extension ZIP
```

### Python Development

```bash
pip install -e .           # Install Python package in development mode
pytest python/tests        # Run Python tests
```

## Architecture

### Core Components (`packages/poml/`)

The core POML processor is built with TypeScript and React:

- **File Handler** (`file.ts`): Handles POML file operations and context resolution
- **Reader System (current)** (`base.tsx`, `presentation.tsx`, `util/reactRender.ts`): Render the parsed POML elements to React server-side rendering components
- **Reader System (next)** (`reader/`): Lexer, tokenizer, CST/AST parsers for POML syntax (currently under development)
- **Components** (`components/`): React components for POML low-level elements (document, message, table, tree, webpage)
- **Writer** (`writer.ts`): Converts reader-produced intermediate representation to final output format
- **Utilities** (`util/`): Image processing, PDF handling, token counting, XML content assist

### VS Code Extension (`packages/poml-vscode/`)

- **Extension Entry** (`extension.ts`): Main activation and command registration
- **Panel System** (`panel/`): WebView panel management for preview functionality
- **LSP Server** (`lsp/server.ts`): Language Server Protocol implementation
- **Commands** (`command/`): Command handlers for preview, testing, gallery
- **Chat Integration** (`chat/`): VS Code chat participant for POML runner
- **Tests** (`tests/`, `test-fixtures/`): Tests based on VS Code extension testing framework (based on mocha)

### Browser Extension (`packages/poml-browser/`)

- **Background Script** (`background/`): Extension lifecycle management. Some privileged operations must be here.
- **Content Script** (`contentScript`): Webpage interaction scripts. Must be injected into the current opening tab to execute.
- **UI Components** (`ui`): React-based UI with Mantine components for sidebar panel.
- **Functions** (`functions`): Common utilities and functions. Clipboard, Google Docs, HTML, MS Word document handling.

## Key File Patterns

- **POML Files**: `*.poml` - Example or test files with POML markup
- **Test Files**: `*.test.ts`, `*.test.js` - Jest test files
- **Configuration**: `tsconfig.json`, `webpack.config.*.js`, `rollup.config.*`
- **Examples**: `examples/*.poml` - Sample POML files with various use cases
- **Gallery**: `gallery/*.poml` - Pre-built prompt templates available in the VS Code extension

## Important Implementation Details

### POML Processing Flow

1. **Parse**: Tokenize and build AST from POML markup, and convert AST to React elements with component resolution
2. **Transform**: Process React tree with data loading and template evaluation, transforming components into intermediate representation
3. **Render**: Render the intermediate representation to final output format (HTML, JSON, etc.)

### Data Component Loading

- Images: Supports base64 encoding, sharp processing for resizing
- Documents: Handles PDF, Word, Excel, CSV with specialized parsers
- Tables: CSV/Excel processing with D3-dsv
- Webpages: URL fetching with content extraction

### Styling System

- CSS-like selectors for component styling
- Inline style attributes on POML elements
- Stylesheet definitions with cascading rules
- Presentation modes (text, JSON, XML formats)

### Template Engine

- Variable interpolation with `{{ variable }}`
- Control flow: `<for>`, `<if>` conditional rendering
- Variable definitions with `<let>` components
- Context passing through component hierarchy

## Environment Configuration

### VS Code Settings

Configure in VS Code settings or `.vscode/settings.json`, if you have installed the extension:

- `poml.languageModel.provider`: LLM provider (openai, openaiResponse, microsoft, anthropic, google)
- `poml.languageModel.model`: Model name or deployment
- `poml.languageModel.apiKey`: API authentication key
- `poml.languageModel.apiUrl`: Custom API endpoint
- `poml.languageModel.temperature`: Sampling temperature (0-2)

## Testing Strategy

- **Unit Tests**: Component-level testing with Jest
- **Integration Tests**: Full POML file processing validation
- **Example Validation**: Automated testing of example files
- **VS Code Tests**: Extension-specific test suite
- **Python Tests**: pytest for Python SDK wrapper

## Common Development Tasks

### Adding a New POML Component

1. Create component in `packages/poml/components/`
2. Add TypeScript types
3. Write unit tests
4. Update component documentation by running `npm run generate-component-spec`

### Debugging the VS Code Extension

1. Open project in VS Code
2. Launch Extension Development Host
3. Set breakpoints in TypeScript files
4. Use Debug Console for inspection

### Updating Language Grammar

1. Modify `poml.tmLanguage.json`
2. Test in VS Code with sample files
3. Update syntax test cases
