# CLAUDE.md - POML Browser Extension

This file provides guidance to Claude Code when working with the POML browser extension package.

## Project Overview

The POML Browser Extension (`packages/poml-browser/`) provides POML support in web browsers through a Chrome extension. It enables users to extract content from web pages, manage it as cards, and convert it to POML format.

## Architecture

### Core Components

- **Background Script** (`background/`): Extension lifecycle management and privileged operations
- **Content Script** (`contentScript/`): Webpage interaction and content extraction
- **UI Components** (`ui/`): React-based extension popup with Mantine components
- **Functions** (`functions/`): Common utilities for clipboard, document handling, and POML processing

### Key Files

- `manifest.json`: Chrome extension manifest
- `rollup.config.mjs`: Build configuration with browser-specific aliases and stubs
- `tsconfig.json`: TypeScript configuration for browser environment
- `package.json`: Dependencies and build scripts

## Build System

### Commands

```bash
# Development builds
npm run build              # Build for development
npm run watch              # Watch mode for development

# Production builds
npm run zip                # Alias for package

# Testing and linting
npm test                   # Run tests (if any)
```

### Build Configuration

The extension uses Rollup with special configuration for browser environment:

#### Aliases and Stubs

Browser-incompatible Node.js modules are stubbed:

- `fs` → `stubs/fs.ts`: File system operations (throws errors)
- `sharp` → `stubs/sharp.ts`: Image processing (minimal stub)
- `pdfjs-dist` → `stubs/pdfjs-dist.ts`: PDF processing (not available in extension)

#### Bundle Targets

- **UI Bundle** (`dist/ui/`): Extension popup interface
- **Background Script** (`dist/background.js`): Service worker
- **Content Script** (`dist/contentScript.js`): Page injection script
