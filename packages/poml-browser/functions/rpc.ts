import { GlobalFunctions, FunctionRegistry } from './types';
import { waitForChromeRuntime } from './utils';

type Role = 'content' | 'background' | 'sidebar';

interface Message {
  type: 'everywhere-request' | 'everywhere-response';
  id: string;
  functionName: string;
  args: any[];
  targetRole?: Role;
  sourceRole: Role;
  error?: any;
  result?: any;
}

type Input<K extends keyof GlobalFunctions> = Parameters<GlobalFunctions[K]>;
type AwaitedOutput<K extends keyof GlobalFunctions> = Awaited<ReturnType<GlobalFunctions[K]>>;
type EverywhereFn<K extends keyof GlobalFunctions> = (...args: Input<K>) => Promise<AwaitedOutput<K>>;

export function detectCurrentRole(): Role {
  // Are we inside an extension at all?
  const isExtension = typeof chrome !== 'undefined' && !!chrome.runtime?.id;

  // Background (MV3 service worker): worker global, no DOM, has clients/registration
  // - Service workers have no document/window, but expose `clients` and `registration`.
  // - This avoids referencing ServiceWorkerGlobalScope in types.
  const isServiceWorker =
    typeof self !== 'undefined' &&
    !('document' in (self as any)) &&
    typeof (self as any).clients === 'object' &&
    typeof (self as any).registration === 'object';

  if (isServiceWorker) {
    return 'background';
  }

  // Anything with a DOM isn't a service worker.
  const hasDOM = typeof document !== 'undefined';

  // Content script: DOM present, but page is NOT chrome-extension://
  if (hasDOM && typeof location !== 'undefined' && location.protocol !== 'chrome-extension:') {
    return 'content';
  }

  // Extension pages (popup/options/side panel/offscreen doc): DOM + chrome-extension://
  if (hasDOM && typeof location !== 'undefined' && location.protocol === 'chrome-extension:') {
    return 'sidebar';
  }

  // Fallbacks
  if (isExtension) {
    return 'background';
  }
  return 'content';
}

class EverywhereManager {
  private initialized: Promise<boolean>;
  private currentRole: Role;
  private handlers: Map<string, (...args: any[]) => any> = new Map();
  private pendingRequests: Map<string, { resolve: (value: any) => void; reject: (reason?: any) => void }> = new Map();

  constructor() {
    this.currentRole = detectCurrentRole();
    this.initialized = this.setupMessageListener();
  }

  private async setupMessageListener(): Promise<boolean> {
    try {
      await waitForChromeRuntime();
    } catch (error) {
      console.error('Error setting up message listener:', error);
      return false;
    }
    chrome.runtime.onMessage.addListener(
      (message: Message, _sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
        if (message.type === 'everywhere-request') {
          this.handleIncomingRequest(message, sendResponse);
          return true; // Keep channel open for async response
        } else if (message.type === 'everywhere-response') {
          // This should generally not happen because we handle responses in sendRequest
          console.warn('Received unexpected everywhere-response message:', message);
        }
        return false;
      },
    );
    return true;
  }

  /* Implement for message listener (incoming request end) */
  private async handleIncomingRequest(message: Message, sendResponse: (response: any) => void): Promise<void> {
    const { functionName, args, id, targetRole } = message;

    // Check if this role should handle the request
    if (targetRole && targetRole !== this.currentRole) {
      // If we're background and target is content, send message to content script
      if (this.currentRole === 'background' && targetRole === 'content') {
        await this.sendToContentScript(message, sendResponse);
        // The response is already sent, we don't need to handle it again here
      }
      // Otherwise, we do NOT forward to other roles:
      // 1. Content -> Background/Sidebar: When content script calls sendMessage, both background and sidebar receive it.
      //    The handler that has the function registered will respond.
      // 2. Background <-> Sidebar: They can already communicate directly via sendMessage.
      // 3. Background -> Content: This uses chrome.tabs.sendMessage now.
      // 4. Sidebar -> Content: Not supported directly. Background will intercept and use tabs.sendMessage if needed.
      return;
    }

    // Execute if I am the target or no specific target
    const handler = this.handlers.get(functionName);
    if (handler) {
      try {
        const result = await handler(...args);
        sendResponse({
          type: 'everywhere-response',
          id,
          result,
          functionName,
          sourceRole: this.currentRole,
        });
      } catch (error) {
        sendResponse({
          type: 'everywhere-response',
          id,
          error: error instanceof Error ? error.message : error,
          functionName,
          sourceRole: this.currentRole,
        });
      }
    } else {
      const availableHandlers = Array.from(this.handlers.keys()).join(', ');
      sendResponse({
        type: 'everywhere-response',
        id,
        error: `No handler registered for ${functionName} in ${this.currentRole}. Available handlers: ${availableHandlers}`,
        functionName,
        sourceRole: this.currentRole,
      });
    }
  }

  private async sendToContentScript(message: Message, sendResponse: (response: any) => void): Promise<void> {
    // Only service worker (background) can do this
    if (this.currentRole !== 'background') {
      sendResponse({
        type: 'everywhere-response',
        id: message.id,
        error: 'Only background can forward messages to content script',
        functionName: message.functionName,
        sourceRole: this.currentRole,
      });
    }

    const { id, functionName } = message;
    try {
      // Get active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab?.id) {
        sendResponse({
          type: 'everywhere-response',
          id,
          error: 'No active tab found',
          functionName,
          sourceRole: this.currentRole,
        });
        return;
      }

      // Check if content script is ready by checking the global flag
      let isContentScriptReady = false;
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            return (window as any).__pomlContentScriptReady === true;
          },
        });
        isContentScriptReady = results[0]?.result === true;
      } catch (error) {
        isContentScriptReady = false;
      }

      // Inject content script if not ready
      if (!isContentScriptReady) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['contentScript.js'],
          });

          // Wait a moment for the script to initialize
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (injectError) {
          sendResponse({
            type: 'everywhere-response',
            id,
            error: `Failed to inject content script: ${injectError instanceof Error ? injectError.message : injectError}`,
            functionName,
            sourceRole: this.currentRole,
          });
          return;
        }
      }

      // Now send the actual message and collect the response
      const response = await chrome.tabs.sendMessage(tab.id, message);
      // If has error, create an error response
      if ((chrome.runtime as any).lastError) {
        sendResponse({
          type: 'everywhere-response',
          id,
          error: (chrome.runtime as any).lastError.message,
          functionName,
          sourceRole: this.currentRole,
        });
      } else if (response) {
        // Forward the response from content script
        sendResponse(response);
      } else {
        sendResponse({
          type: 'everywhere-response',
          id,
          error: 'No response from content script',
          functionName,
          sourceRole: this.currentRole,
        });
      }
    } catch (error) {
      sendResponse({
        type: 'everywhere-response',
        id,
        error: error instanceof Error ? error.message : error,
        functionName,
        sourceRole: this.currentRole,
      });
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  public register<K extends keyof GlobalFunctions>(functionName: K, handler: GlobalFunctions[K], roles?: Role[]): void {
    // Register handler if current role is in the specified roles (or if no roles specified)
    if (!roles || roles.includes(this.currentRole)) {
      this.handlers.set(functionName as string, handler);
    }
  }

  private async sendRequest<K extends keyof GlobalFunctions>(
    functionName: K,
    args: Input<K>,
    targetRole?: Role,
  ): Promise<AwaitedOutput<K>> {
    // Ensure initialization
    const isInitialized = await this.initialized;
    if (!isInitialized) {
      throw new Error('EverywhereManager not initialized properly');
    }

    const id = this.generateId();
    const message: Message = {
      type: 'everywhere-request',
      id,
      functionName: functionName as string,
      args,
      targetRole,
      sourceRole: this.currentRole,
    };

    // Wrap sendMessage in a Promise
    const response = await new Promise<Message>((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      chrome.runtime.sendMessage(message, undefined, (resp: any) => {
        const lastError = (chrome.runtime as any).lastError;
        if (lastError) {
          this.pendingRequests.delete(id);
          reject(new Error(lastError.message));
        } else if (resp) {
          resolve(resp);
        } else {
          this.pendingRequests.delete(id);
          reject(new Error('Unknown error'));
        }
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timeout for ${functionName}`));
        }
      }, 30000);
    });

    // Process response
    if (response.id !== id) {
      throw new Error(`Mismatched response ID: expected ${id}, got ${response.id}`);
    }
    const { result, error } = response;
    const pending = this.pendingRequests.get(id);

    if (pending) {
      if (error) {
        pending.reject(new Error(error));
      } else {
        pending.resolve(result);
      }
      this.pendingRequests.delete(id);
    }

    if (error) {
      if (typeof error === 'string') {
        throw new Error(error);
      } else {
        throw error;
      }
    }

    return result;
  }

  public createFunction<K extends keyof GlobalFunctions>(functionName: K, targetRoles?: Role[]): EverywhereFn<K> {
    return async (...args: Input<K>): Promise<AwaitedOutput<K>> => {
      // If target roles specified, try to run in first available role
      if (!targetRoles || targetRoles.length === 0 || targetRoles.includes(this.currentRole)) {
        // Execute locally if current role is in targetRoles or no specific target
        const handler = this.handlers.get(functionName as string);
        if (handler) {
          return await handler(...args);
        } else {
          const availableHandlers = Array.from(this.handlers.keys()).join(', ');
          throw new Error(
            `No handler registered for ${functionName} in ${this.currentRole}. Available handlers: ${availableHandlers}`,
          );
        }
      } else {
        return this.sendRequest<K>(functionName, args, targetRoles[0]);
      }
    };
  }
}

// Create singleton instance
const everywhereManager = new EverywhereManager();

// Type-safe everywhere function with overloads
export function everywhere<K extends keyof GlobalFunctions>(functionName: K): EverywhereFn<K>;
export function everywhere<K extends keyof GlobalFunctions>(
  functionName: K,
  handler: GlobalFunctions[K],
  roles?: Role[],
): EverywhereFn<K>;
export function everywhere<K extends keyof GlobalFunctions>(
  functionName: K,
  handler?: GlobalFunctions[K],
  roles?: Role[],
): EverywhereFn<K> {
  if (handler) {
    // Register the handler
    everywhereManager.register(functionName, handler, roles);
  }

  // Return a callable function
  return everywhereManager.createFunction(functionName, roles);
}

// Helper function to register multiple handlers at once
export function registerHandlers<K extends keyof GlobalFunctions>(handlers: {
  [P in K]: {
    handler: GlobalFunctions[P];
    roles?: Role[];
  };
}): void {
  for (const [functionName, config] of Object.entries(handlers) as Array<
    [K, { handler: GlobalFunctions[K]; roles?: Role[] }]
  >) {
    everywhereManager.register(functionName, config.handler, config.roles);
  }
}

// Helper to explicitly call a function in a specific role
export function callInRole<K extends keyof GlobalFunctions>(
  role: Role,
  functionName: K,
  ...args: Input<K>
): Promise<AwaitedOutput<K>> {
  return (everywhereManager as any).sendRequest(functionName as string, args, role);
}

export const pingPong: Record<Role, (message: string, delay: number) => Promise<string>> = {
  content: everywhere(
    'pingPongContent',
    (message: string, delay: number) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(`Content received: ${message}`);
        }, delay);
      });
    },
    ['content'],
  ),
  background: everywhere(
    'pingPongBackground',
    (message: string, delay: number) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(`Background received: ${message}`);
        }, delay);
      });
    },
    ['background'],
  ),
  sidebar: everywhere(
    'pingPongSidebar',
    (message: string, delay: number) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(`Sidebar received: ${message}`);
        }, delay);
      });
    },
    ['sidebar'],
  ),
};

// Export types for use in implementation files
export type { Role, Message, GlobalFunctions };
