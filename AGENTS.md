# Contributor Guide

This repository contains a TypeScript/JavaScript project together with a small Python package.
Follow these instructions when using Codex or contributing changes.

## Environment Setup
- **Node.js**: version 22.x
- **Python**: version 3.11

Run `bash setup.sh` from the repository root to install all dependencies.

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

Optional VS Code extension tests can be run with:

```bash
npm run compile && npm run test-vscode
```

## PR Instructions
Use the title format `[POML] <Your summary>` when opening pull requests.
