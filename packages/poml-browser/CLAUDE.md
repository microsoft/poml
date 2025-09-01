# CLAUDE.md - POML Browser Extension

This file provides guidance to Claude Code when working with the POML browser extension package.

## Project Overview

The POML Browser Extension (`packages/poml-browser/`) provides POML support in web browsers through a Chrome extension. It enables users to extract content from web pages, manage it as cards, and convert it to POML format.

## Architecture

### Core Components

- **Background Script** (`background/`): Extension lifecycle management and privileged operations
- **Content Script** (`contentScript/`): Webpage interaction and content extraction
- **UI Components** (`ui/`): React-based extension popup with Mantine components
- **Common** (`common/`): Common utilities for clipboard, document handling, and POML processing (see below)

### Key Files

- `manifest.json`: Chrome extension manifest
- `rollup.config.mjs`: Build configuration with browser-specific aliases and stubs
- `tsconfig.json`: TypeScript configuration for browser environment
- `package.json`: Dependencies and build scripts

### Key Implementations

- **Centralized Types** (`common/types.ts`): Shared TypeScript interfaces and types. This is the source of truth for data structures. You may see some duplication in other packages temporarily. We are migrating to this centralized system.
- **RPC System** (`common/rpc.ts`): Cross-context communication between background, content script, and UI using a unified RPC mechanism.
- **Notification System** (`common/notification.ts`): User notifications with different verbosity levels.
- **Data Handling** (`common/imports/`): Utilities for parsing and converting various data formats (text, HTML, images, tables) to POML.
- **Event Handling** (`common/events/`): Utilities for processing events from various sources (local, remote, clipboard, drag-and-drop).

## Build System

### Commands

```bash
# Development builds
npm run build:dev          # Build for development
npm run watch              # Watch mode for development

# Production builds
npm run build:prod         # Build for production
npm run zip                # Alias for package

# Testing
npm run build:test         # Build for testing
npm run test:vitest        # Run unit tests with Vitest
npm run test:playwright    # Run browser extension tests with Playwright
```

**Important notes on building and testing for Claude:** As developers usually run a long-running watch process, please do not emit build commands by yourself. Do not run tests on your own. Instead, ask the developer to run them and provide feedback.

### Build Configuration

The extension uses Rollup with special configuration for browser environment:

#### Aliases and Stubs

Browser-incompatible Node.js modules are stubbed. Including but not limited to:

- `fs` → `stubs/fs.ts`: File system operations (throws errors)
- `sharp` → `stubs/sharp.ts`: Image processing (minimal stub)
- `pdfjs-dist` → `stubs/pdfjs-dist.ts`: PDF processing (not available in extension)

#### Bundle Targets

- **UI Bundle** (`dist/ui/`): Extension side panel interface
- **Background Script** (`dist/background.js`): Service worker
- **Content Script** (`dist/contentScript.js`): Page injection script

## Development Guidelines

### Module Import Aliases

Use TypeScript path aliases for clean imports:

```typescript
// Module aliases defined in tsconfig.json
import { something } from '@common/*'; // Common utilities
import { component } from '@ui/*'; // UI components
import { service } from '@background/*'; // Background services
import { helper } from '@contentScript/*'; // Content script helpers
```

### Styling with Mantine

Use Mantine's theme system and built-in spacing instead of implementing ad-hoc styles.

#### Theme Object Usage

Remember that the system is redesigned to work with both light and dark modes. Pay special attention to color contrasts and visibility in both modes. Use `primary` and `secondary` colors from the theme if applicable.

```tsx
const theme = useMantineTheme();

// ✅ Good: Using theme values
<div style={{
  backgroundColor: `${theme.colors.purple[5]}15`,
  border: `3px dashed ${theme.colors.purple[6]}`,
  borderRadius: theme.radius.md,
  fontSize: theme.fontSizes.lg,
  color: theme.colors.purple[8]
}}>

// ❌ Bad: Hard-coded values
<div style={{
  backgroundColor: 'rgba(128, 0, 255, 0.15)',
  borderRadius: '8px',
  fontSize: '18px'
}}>
```

#### Spacing System

Use Mantine spacing values from [theme documentation](https://mantine.dev/theming/theme-object/):

- `xs`: 10px
- `sm`: 12px
- `md`: 16px
- `lg`: 20px
- `xl`: 32px

```tsx
// ✅ Good: Mantine spacing props
<Stack p="md" gap="xs">
<Group justify="space-between" mb="md">
<Button fullWidth fz="md">

// ❌ Bad: Ad-hoc styles
<div style={{ padding: '16px', marginBottom: '12px' }}>
```

#### Important Style Notes

- Avoid over-implementing custom styles when Mantine components provide the functionality
- Use Mantine's color system with proper opacity (e.g., `${theme.colors.purple[5]}15` for 15 opacity, in hex)
- Prefer component props over inline styles
- Use `useMantineTheme()` hook to access theme values in components

### Chrome API Usage and Cross-Context Communication

Different Chrome APIs are available in different contexts. Always verify API availability before use.

#### API Availability by Context

##### Background Service Worker Only

```typescript
// ✅ Available in background
chrome.tabs.query({ active: true });
chrome.windows.create({ url });
chrome.contextMenus.create({ title });
chrome.notifications.create({ message });
chrome.downloads.download({ url });
chrome.scripting.executeScript({ target });
chrome.storage.local.get(['key']);
chrome.storage.sync.set({ key: value });
```

##### Content Script Only

```typescript
// ✅ Available in content script
document.querySelector('#element');
window.location.href;
document.body.appendChild(element);

// Limited Chrome APIs
chrome.runtime.sendMessage({ data });
chrome.runtime.id;
```

##### Side Panel (Extension Pages)

```typescript
// ✅ Available in side panel
chrome.runtime.sendMessage({ data })
chrome.runtime.getURL(path)

// ❌ Not directly available - use RPC
chrome.tabs.* // Must call via background
chrome.storage.* // Must call via background
```

#### Cross-Context Communication with RPC

Use the `everywhere` function from `common/rpc.ts` for cross-context calls:

```typescript
import { everywhere } from '@common/rpc';
import { pingPong } from '@common/rpc';

// Define a function available in specific role
const myFunction = everywhere(
  'functionName',
  (arg1: string, arg2: number) => {
    // Implementation
    return result;
  },
  'background', // Role where this executes
);

// Register it in GlobalFunctions in common/types.ts
export interface GlobalFunctions extends FunctionRegistry {
  // Please put the signatures of global functions here
  functionName: (arg1: string, arg2: number) => ReturnType;
}

// Call function from any context
const result = await everywhere('functionName')(arg1, arg2);
```

### Notification System

Use the notify API instead of console.log for controllable and visible logging.

#### Notification Levels (from most to least verbose)

```typescript
import {
  notifyDebugMoreVerbose, // debug++ - Very detailed debugging (used very frequently especially for complex flows)
  notifyDebugVerbose, // debug+  - Verbose debugging (log the input and output of complex functions)
  notifyDebug, // debug   - Standard debugging (log error-prone key steps in processes)
  notifyInfo, // info    - Informational messages (important state changes)
  notifyWarning, // warning - Warning messages (should be looked at)
  notifyError, // error   - Error messages (don't auto-hide)
  notifySuccess, // success - Success messages (briefly show successful big operations)
} from '@common/notification';

// ❌ Bad: Direct console logging
console.log('Operation completed');
console.error('Failed:', error);

// ✅ Good: Using notify API
notifySuccess('Operation completed');
notifyError('Failed to fetch data', error, {
  title: 'Fetch Error',
  duration: 0, // Don't auto-hide errors
});

// Debug with objects
notifyDebug('Processing item', { id: itemId, status: 'pending' });
```
