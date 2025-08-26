# Contributing to POML

Thank you for your interest in contributing to POML! This guide will help you set up your development environment.

## Prerequisites

- Node.js 22.x
- Python 3.11+ (for Python components)
- Git

## Quick Start

```bash
git clone https://github.com/microsoft/poml
cd poml
npm ci
npm run build-webview
npm run build-cli
```

## Development Install

For Python development, install the package in editable mode:

```bash
python -m pip install -e .[dev]
```

This installs the Python package with development dependencies including pytest, black, and isort for code formatting.

## Building Packages

The project has multiple build targets:

### VSCode Extension

```bash
npm run build-extension-dev    # Development build
npm run watch-extension        # Watch mode for development
npm run package                # Create .vsix package
```

!!! note

    It's recommended to use the VSCode Extension Development Host for testing the extension. In most cases, you don't need to worry about building or watching the extension manually.

### NPM Package

```bash
cd packages/poml-build
npm run build    # Builds both CommonJS and ESM versions
npm pack         # Creates distributable .tgz file
```

### CLI and Webview

```bash
npm run build-cli      # Build CLI executable (used in Python SDK)
npm run build-webview  # Build webview components
```

## Git Hooks with Husky

Husky automatically sets up pre-commit hooks that run `lint-staged`, which formats code with Prettier and runs ESLint. The hooks are configured during `npm install` via the `prepare` script and enforce consistent code style across TypeScript, JavaScript, Python, JSON, Markdown, and YAML files.

## Testing

Run the full test suite:

```bash
npm run test                                 # Node.js/TypeScript tests
npx jest /path/to/specific/testfile.test.ts  # Run specific test file
npm run test-vscode                          # VSCode extension tests
pytest -v python/tests                       # Python tests
```

For linting and formatting:

```bash
npm run format             # Format all files (with prettier)
npm run format:check       # Check formatting without fixing
npm run lint               # ESLint check
```
