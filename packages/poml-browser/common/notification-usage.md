# Notification System Usage Guide

The new notification system provides a unified way to display notifications across all parts of the browser extension (UI, content scripts, and background service workers).

## Features

- **Universal Usage**: Works from any context (React components, content scripts, background workers)
- **Object Serialization**: Automatically serializes complex objects for display
- **Smart Fallbacks**: Falls back to console logging when UI is unavailable
- **Context Detection**: Automatically detects where the code is running
- **Direct UI Handler**: When called from UI context, notifications are delivered directly without message passing
- **Message Queuing**: Buffers messages when UI is not ready

## Basic Usage

```typescript
import { notify, notifySuccess, notifyError, notifyWarning, notifyInfo, notifyDebug } from '../functions/notification';

// Simple notifications
notifySuccess('Operation completed successfully');
notifyError('Failed to load data');
notifyWarning('This action cannot be undone');
notifyInfo('Processing your request...');
notifyDebug('Debug info for developers');

// With additional data
const userData = { id: 123, name: 'John', email: 'john@example.com' };
notifySuccess('User created', userData);

// With error objects
try {
  await someAsyncOperation();
} catch (error) {
  notifyError('Operation failed', error);
}

// With options
notifyError('Critical error', errorDetails, {
  title: 'System Error',
  duration: 0, // Persistent notification
  position: 'top',
  autoHide: false,
});
```

## Usage in Different Contexts

### In React Components (UI)

```typescript
import { notifySuccess, notifyError } from '../../functions/notification';

const MyComponent = () => {
  const handleClick = async () => {
    try {
      const result = await fetchData();
      notifySuccess('Data loaded', result);
    } catch (error) {
      notifyError('Failed to load data', error);
    }
  };

  return <button onClick={handleClick}>Load Data</button>;
};
```

### In Content Scripts

```typescript
import { notify, notifyInfo } from '../functions/notification';

// Extract page content
const content = document.body.innerText;
notifyInfo('Page content extracted', {
  length: content.length,
  title: document.title,
});

// Report errors
if (!content) {
  notify('error', 'No content found on this page');
}
```

### In Background Service Worker

```typescript
import { notifySuccess, notifyError } from '../functions/notification';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'processData') {
    try {
      const result = processData(request.data);
      notifySuccess('Data processed', result);
      sendResponse({ success: true, result });
    } catch (error) {
      notifyError('Processing failed', error);
      sendResponse({ success: false, error: error.message });
    }
  }
});
```

## Error Handling Helpers

```typescript
import { withErrorHandling, withSyncErrorHandling } from '../functions/notification';

// Async operations with automatic error handling
const result = await withErrorHandling(
  async () => {
    const response = await fetch('/api/data');
    return response.json();
  },
  'Failed to fetch data', // Error message
  'Data loaded successfully', // Success message (optional)
);

// Sync operations with automatic error handling
const parsed = withSyncErrorHandling(() => JSON.parse(jsonString), 'Invalid JSON format');
```

## Notification Types and Defaults

| Type    | Console Method | Default Position | Auto-hide | Default Duration |
| ------- | -------------- | ---------------- | --------- | ---------------- |
| success | console.log    | top              | yes       | 4000ms           |
| error   | console.error  | top              | no        | persistent       |
| warning | console.warn   | top              | yes       | 4000ms           |
| info    | console.info   | top              | yes       | 4000ms           |
| debug   | console.debug  | bottom           | yes       | 4000ms           |

## Advanced Features

### Complex Object Handling

The system automatically handles:

- Circular references
- Functions
- Regular expressions
- Dates
- Error objects with stack traces
- Large objects (automatically truncated)

```typescript
const complexData = {
  user: { id: 1, name: 'John' },
  timestamp: new Date(),
  pattern: /test/gi,
  callback: () => console.log('test'),
  error: new Error('Sample error'),
};

notifyDebug('Complex data', complexData);
// Objects are automatically serialized with proper formatting
```

### Source Tracking

Notifications from background or content scripts automatically include source information in the title, making it easy to track where notifications originate from.

## Architecture Details

### Direct UI Handler

When notifications are triggered from within the UI context (e.g., from `pomlHelper` called by React components), the system uses a direct handler for immediate delivery:

1. The `NotificationService` registers itself as a direct UI handler when initialized
2. Notifications from the same context bypass Chrome messaging and call the handler directly
3. This ensures notifications from UI code (like `pomlHelper`) are displayed immediately

### Message Flow

```
UI Context (e.g., pomlHelper) → Direct UI Handler → NotificationContext → Display
Content Script → Chrome Message → Background → UI Message Listener → Display
Background Script → Chrome Message → UI Message Listener → Display
```

### Why Direct Handler?

The direct handler solves a key issue: Chrome extensions may not reliably deliver messages from a context to itself. By registering a direct handler, we ensure that:

- Notifications from `pomlHelper` and other UI-context functions work immediately
- No message passing overhead for same-context notifications
- Better performance and reliability

## Best Practices

1. **Use appropriate notification types**: Choose the right type (success, error, warning, info, debug) for better visual distinction
2. **Include context in errors**: Pass the error object as the second parameter for better debugging
3. **Use debug for development**: Debug notifications appear at the bottom and are perfect for development logging
4. **Set duration for important messages**: Use `duration: 0` for critical errors that need user attention
5. **Leverage error handlers**: Use `withErrorHandling` for cleaner async error management
6. **No callbacks needed**: Functions like `pomlHelper` no longer need onWarning/onError callbacks - they use the notification system directly
