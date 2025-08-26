/**
 * Notification Service
 * Singleton service for reporting notifications from anywhere in the application
 * Works both inside and outside React components
 */

import { NotificationType, NotificationPosition } from '../contexts/NotificationContext';
import {
  registerDirectUIHandler,
  unregisterDirectUIHandler,
  NotificationMessage,
  NotificationOptions,
} from '../../functions/notification';

type NotificationHandler = (type: NotificationType, message: string, options?: NotificationOptions) => string;

class NotificationService {
  private static instance: NotificationService;
  private handler: NotificationHandler | null = null;
  private messageListener:
    | ((message: any, sender: chrome.runtime.MessageSender, sendResponse: () => void) => boolean)
    | null = null;

  private constructor() {
    this.setupMessageListener();
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Set up listener for messages from background and content scripts
   */
  private setupMessageListener(): void {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      this.messageListener = (message: any, _sender: chrome.runtime.MessageSender, _sendResponse: () => void) => {
        // Check if this is a notification message
        if (message && message.type === 'notification') {
          const notificationMsg = message as NotificationMessage;

          // Combine message with details if available
          const fullMessage = notificationMsg.details
            ? `${notificationMsg.message}\n\nDetails:\n${notificationMsg.details}`
            : notificationMsg.message;

          // Map debug to info type since NotificationContext doesn't have debug
          const notificationType: NotificationType =
            notificationMsg.notificationType === 'debug'
              ? 'info'
              : (notificationMsg.notificationType as NotificationType);

          // Add source info to the title if from background or content script and title exists
          const options = { ...notificationMsg.options };
          if (notificationMsg.source !== 'ui' && options.title) {
            options.title = `${options.title}`;
          }

          // Use debug messages at bottom by default
          if (notificationMsg.notificationType === 'debug' && !options.position) {
            options.position = 'bottom';
          }

          // Notify using the handler
          this.notify(notificationType, fullMessage, options);
        }

        // Return false to indicate we're not sending a response
        return false;
      };

      chrome.runtime.onMessage.addListener(this.messageListener as any);
    }
  }

  /**
   * Register the notification handler (called by the React provider)
   */
  public setHandler(handler: NotificationHandler): void {
    this.handler = handler;

    // Register as direct UI handler for notifications from the same context
    registerDirectUIHandler((type, message, options) => {
      // Map debug to info since NotificationContext doesn't have debug type
      const notificationType: NotificationType = type === 'debug' ? 'info' : (type as NotificationType);
      this.notify(notificationType, message, options);
    });
  }

  /**
   * Remove the notification handler and clean up message listener
   */
  public removeHandler(): void {
    this.handler = null;

    // Unregister direct UI handler
    unregisterDirectUIHandler();

    // Clean up message listener
    if (this.messageListener && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.removeListener(this.messageListener as any);
      this.messageListener = null;
    }
  }

  /**
   * Show a success notification
   */
  public success(message: string, options?: NotificationOptions): string {
    return this.notify('success', message, { position: 'top', ...options });
  }

  /**
   * Show an error notification
   */
  public error(message: string, options?: NotificationOptions): string {
    return this.notify('error', message, {
      autoHide: false,
      duration: 0,
      position: 'top',
      ...options,
    });
  }

  /**
   * Show a warning notification
   */
  public warning(message: string, options?: NotificationOptions): string {
    return this.notify('warning', message, { position: 'top', ...options });
  }

  /**
   * Show an info notification
   */
  public info(message: string, options?: NotificationOptions): string {
    return this.notify('info', message, { position: 'bottom', ...options });
  }

  /**
   * Show success notification at the bottom
   */
  public bottomSuccess(message: string, options?: Omit<NotificationOptions, 'position'>): string {
    return this.notify('success', message, { position: 'bottom', ...options });
  }

  /**
   * Show error notification at the bottom
   */
  public bottomError(message: string, options?: Omit<NotificationOptions, 'position'>): string {
    return this.notify('error', message, {
      autoHide: false,
      duration: 0,
      position: 'bottom',
      ...options,
    });
  }

  /**
   * Show warning notification at the bottom
   */
  public bottomWarning(message: string, options?: Omit<NotificationOptions, 'position'>): string {
    return this.notify('warning', message, { position: 'bottom', ...options });
  }

  /**
   * Show info notification at the top (override default)
   */
  public topInfo(message: string, options?: Omit<NotificationOptions, 'position'>): string {
    return this.notify('info', message, { position: 'top', ...options });
  }

  /**
   * Generic notification method
   */
  private notify(type: NotificationType, message: string, options?: NotificationOptions): string {
    if (!this.handler) {
      // Fallback to console if no handler is registered
      const logMethod = type === 'error' ? 'error' : type === 'warning' ? 'warn' : type === 'success' ? 'log' : 'info';
      console[logMethod](`[${type.toUpperCase()}]${options?.title ? ` ${options.title}:` : ''} ${message}`);
      return `console-${Date.now()}`;
    }

    return this.handler(type, message, options);
  }

  /**
   * Convenience method for handling async operations
   */
  public async withErrorHandling<T>(
    operation: () => Promise<T>,
    errorMessage?: string,
    successMessage?: string,
  ): Promise<T | null> {
    try {
      const result = await operation();
      if (successMessage) {
        this.success(successMessage);
      }
      return result;
    } catch (error) {
      const message = errorMessage || (error instanceof Error ? error.message : 'An error occurred');
      this.error(message);
      return null;
    }
  }

  /**
   * Convenience method for handling sync operations
   */
  public withSyncErrorHandling<T>(operation: () => T, errorMessage?: string, successMessage?: string): T | null {
    try {
      const result = operation();
      if (successMessage) {
        this.success(successMessage);
      }
      return result;
    } catch (error) {
      const message = errorMessage || (error instanceof Error ? error.message : 'An error occurred');
      this.error(message);
      return null;
    }
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance();

// Export convenience functions for direct usage
export const notify = {
  // Top notifications (default for success, error, warning)
  success: (message: string, options?: NotificationOptions) => notificationService.success(message, options),
  error: (message: string, options?: NotificationOptions) => notificationService.error(message, options),
  warning: (message: string, options?: NotificationOptions) => notificationService.warning(message, options),
  info: (message: string, options?: NotificationOptions) => notificationService.info(message, options),

  // Bottom notifications
  bottomSuccess: (message: string, options?: Omit<NotificationOptions, 'position'>) =>
    notificationService.bottomSuccess(message, options),
  bottomError: (message: string, options?: Omit<NotificationOptions, 'position'>) =>
    notificationService.bottomError(message, options),
  bottomWarning: (message: string, options?: Omit<NotificationOptions, 'position'>) =>
    notificationService.bottomWarning(message, options),
  topInfo: (message: string, options?: Omit<NotificationOptions, 'position'>) =>
    notificationService.topInfo(message, options),
};

export default notificationService;
