# Agent Contributor Guide

This repository contains a TypeScript/JavaScript project together with a lite Python SDK.
These instructions are for agents like Codex to contribute changes.

## Repository Structure
- **packages/poml** – Core TypeScript package of POML parsing and rendering.
- **packages/poml-vscode** – VS Code Extension package of POML.
- **packages/poml-vscode-webview** – The VS Code Webview frontend JS/TS code.
- **python/** – Python SDK and CLI implementation.
- **examples/** – Sample POML files.
- **docs/** – Project documentation.

## Environment Setup
- **Node.js**: version 22.x (20.x should also work)
- **Python**: version 3.11 (3.10 or 3.12 should also work)

```bash
npm ci
npm run build-webview
npm run build-cli
python -m pip install -e .[dev]
```

## Testing Instructions
After your changes you must verify that everything still builds and tests pass.
Execute the following commands from the repository root:

```bash
npm run build-webview
npm run build-cli
npm run lint
npm test
python -m pytest python/tests
```

If you have updated the VS Code extension, please run the extension tests with:

```bash
xvfb-run -a npm run compile && xvfb-run -a npm run test-vscode
```

Update the component specifications if you have updated the type annotations and documentations of the components.

```bash
npm run generate-component-spec
```

## PR Instructions
Use clear titles and summaries. Include relevant references to documentation when modifying or adding features.
