import { NotificationLevel, NotificationPosition, NotificationType } from './types';
import { getSettings } from './settings';

export interface NotificationOptions {
  title?: string; // Optional title for the notification
  duration?: number; // Duration in milliseconds, 0 means persistent
  position?: NotificationPosition; // Position on the screen
  autoHide?: boolean; // Whether to auto-hide the notification
}

export interface NotificationMessage {
  type: 'notification';
  notificationType: NotificationType;
  message: string;
  details?: string; // Serialized objects/additional data
  options?: NotificationOptions;
  source: 'background' | 'content' | 'ui';
  timestamp: number;
}

// Global handler for direct UI notifications
let directUIHandler: ((type: NotificationType, message: string, options?: NotificationOptions) => void) | null = null;

// Register a direct UI handler (called by NotificationService when it initializes)
export function registerDirectUIHandler(
  handler: (type: NotificationType, message: string, options?: NotificationOptions) => void,
): void {
  directUIHandler = handler;
}

// Unregister the direct UI handler
export function unregisterDirectUIHandler(): void {
  directUIHandler = null;
}

// Define notification level hierarchy (lower index = higher priority)
const NOTIFICATION_LEVELS: NotificationLevel[] = ['important', 'warning', 'info', 'debug', 'debug+', 'debug++'];

// Check if notification should be shown based on level
function shouldShowNotification(notificationType: NotificationType, threshold: NotificationLevel): boolean {
  // Map notification types to levels
  const typeToLevel: Record<NotificationType, NotificationLevel> = {
    'error': 'important',
    'success': 'important',
    'warning': 'warning',
    'info': 'info',
    'debug': 'debug',
    'debug+': 'debug+',
    'debug++': 'debug++',
  };

  const notificationLevel = typeToLevel[notificationType];
  const notificationIndex = NOTIFICATION_LEVELS.indexOf(notificationLevel);
  const thresholdIndex = NOTIFICATION_LEVELS.indexOf(threshold);

  // Show if notification level index is less than or equal to threshold index
  return notificationIndex <= thresholdIndex;
}

// Determine the current execution context
function getExecutionContext(): 'background' | 'content' | 'ui' {
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    // Check if we're in a service worker (background)
    // In service workers, 'window' is undefined and 'self' is a ServiceWorkerGlobalScope
    if (typeof window === 'undefined' && typeof self !== 'undefined' && 'ServiceWorkerGlobalScope' in self) {
      return 'background';
    }

    // Check if we're in the extension popup/sidebar UI
    if (
      typeof window !== 'undefined' &&
      window.location.protocol === 'chrome-extension:' &&
      (window.location.pathname.includes('ui/') || window.location.pathname.includes('index.html'))
    ) {
      return 'ui';
    }

    // Otherwise, we're in a content script
    return 'content';
  }

  // Fallback to content if chrome is not available
  return 'content';
}

// Serialize objects with intelligent truncation
function serializeObject(obj: any, maxLength: number = 2000): string {
  if (obj === null || obj === undefined) {
    return String(obj);
  }

  if (typeof obj === 'string') {
    return obj.length > maxLength ? obj.substring(0, maxLength) + '...' : obj;
  }

  if (obj instanceof Error) {
    const errorInfo = {
      message: obj.message,
      name: obj.name,
      stack: obj.stack?.split('\n').slice(0, 5).join('\n'), // First 5 stack frames
    };
    return JSON.stringify(errorInfo, null, 2);
  }

  try {
    // Handle circular references and functions
    const seen = new WeakSet();
    const serialized = JSON.stringify(
      obj,
      (_key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) {
            return '[Circular Reference]';
          }
          seen.add(value);
        }
        if (typeof value === 'function') {
          return `[Function: ${value.name || 'anonymous'}]`;
        }
        if (value instanceof RegExp) {
          return value.toString();
        }
        if (value instanceof Date) {
          return value.toISOString();
        }
        return value;
      },
      2,
    );

    return serialized.length > maxLength ? serialized.substring(0, maxLength) + '...[truncated]' : serialized;
  } catch (error) {
    // Fallback for objects that can't be serialized
    try {
      const str = String(obj);
      return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
    } catch {
      return '[Unserializable Object]';
    }
  }
}

// Log to console based on notification type (respects console notification level)
async function logToConsole(
  type: NotificationType,
  message: string,
  objects?: any,
  options?: NotificationOptions,
): Promise<void> {
  const settings = await getSettings();

  // Check if we should log based on console notification level
  if (!shouldShowNotification(type, settings.consoleNotificationLevel)) {
    return;
  }

  const prefix = options?.title ? `[${type.toUpperCase()}] ${options.title}: ` : `[${type.toUpperCase()}] `;
  const fullMessage = prefix + message;

  switch (type) {
    case 'error':
      if (objects !== undefined) {
        console.error(fullMessage, objects);
      } else {
        console.error(fullMessage);
      }
      break;
    case 'warning':
      if (objects !== undefined) {
        console.warn(fullMessage, objects);
      } else {
        console.warn(fullMessage);
      }
      break;
    case 'debug':
    case 'debug+':
    case 'debug++':
      if (objects !== undefined) {
        console.debug(fullMessage, objects);
      } else {
        console.debug(fullMessage);
      }
      break;
    case 'info':
      if (objects !== undefined) {
        console.info(fullMessage, objects);
      } else {
        console.info(fullMessage);
      }
      break;
    case 'success':
    default:
      if (objects !== undefined) {
        console.log(fullMessage, objects);
      } else {
        console.log(fullMessage);
      }
      break;
  }
}

// Send notification via Chrome runtime messaging
// This should work for both background -> UI and content -> background -> UI
async function sendNotificationMessage(message: NotificationMessage): Promise<void> {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      // Try to send the message
      await chrome.runtime.sendMessage(message);
    }
  } catch (error) {
    // If sending fails (e.g., popup not open), just log it
    console.debug('[Notification] Failed to send to UI:', error);
  }
}

// Main notification function
export async function notify(
  type: NotificationType,
  message: string,
  objects?: any,
  options?: NotificationOptions,
): Promise<void> {
  // 1. Get settings to check notification levels
  const settings = await getSettings();

  // 2. Always log to console first (respects console notification level)
  await logToConsole(type, message, objects, options);

  // 3. Check if we should show UI notification based on UI notification level
  if (!shouldShowNotification(type, settings.uiNotificationLevel)) {
    return;
  }

  // 4. Serialize objects if provided
  let details: string | undefined;
  if (objects !== undefined) {
    details = serializeObject(objects);
  }

  // 5. Combine message with details
  const fullMessage = details ? `${message}\n\nDetails:\n${details}` : message;

  // 6. Check if we have a direct UI handler available (when called from UI context)
  if (directUIHandler) {
    // Use the direct handler for immediate UI updates
    directUIHandler(type, fullMessage, options);
    return;
  }

  // 7. Otherwise, send via messaging
  const context = getExecutionContext();
  const notificationMessage: NotificationMessage = {
    type: 'notification',
    notificationType: type,
    message,
    details,
    options,
    source: context,
    timestamp: Date.now(),
  };

  await sendNotificationMessage(notificationMessage);
}

// Convenience functions for each notification type
export const notifySuccess = (message: string, objects?: any, options?: NotificationOptions) =>
  notify('success', message, objects, options);

export const notifyError = (message: string, objects?: any, options?: NotificationOptions) =>
  notify('error', message, objects, { duration: 0, autoHide: false, ...options });

export const notifyWarning = (message: string, objects?: any, options?: NotificationOptions) =>
  notify('warning', message, objects, options);

export const notifyInfo = (message: string, objects?: any, options?: NotificationOptions) =>
  notify('info', message, objects, options);

export const notifyDebug = (message: string, objects?: any, options?: NotificationOptions) =>
  notify('debug', message, objects, { position: 'bottom', ...options });

export const notifyDebugVerbose = (message: string, objects?: any, options?: NotificationOptions) =>
  notify('debug+', message, objects, { position: 'bottom', ...options });

export const notifyDebugDetail = (message: string, objects?: any, options?: NotificationOptions) =>
  notify('debug++', message, objects, { position: 'bottom', ...options });

// Error handler wrapper for async functions
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  errorMessage?: string,
  successMessage?: string,
): Promise<T | null> {
  try {
    const result = await operation();
    if (successMessage) {
      notifySuccess(successMessage);
    }
    return result;
  } catch (error) {
    const message = errorMessage || (error instanceof Error ? error.message : 'An error occurred');
    notifyError(message, error);
    return null;
  }
}

// Error handler wrapper for sync functions
export function withSyncErrorHandling<T>(operation: () => T, errorMessage?: string, successMessage?: string): T | null {
  try {
    const result = operation();
    if (successMessage) {
      notifySuccess(successMessage);
    }
    return result;
  } catch (error) {
    const message = errorMessage || (error instanceof Error ? error.message : 'An error occurred');
    notifyError(message, error);
    return null;
  }
}

// Export default notify function
export default notify;
