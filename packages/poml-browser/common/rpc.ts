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
          const { targetRole } = message;

          // Only return true (keep channel open) if we're going to handle this message
          const shouldHandle =
            !targetRole || // No specific target, everyone handles
            targetRole === this.currentRole || // We are the target
            (this.currentRole === 'background' && targetRole === 'content'); // Special case: background forwards to content

          if (shouldHandle) {
            this.handleIncomingRequest(message, sendResponse);
            return true; // Keep channel open for async response
          }

          // Not for us, don't handle
          return false;
        } else if (message.type === 'everywhere-response') {
          // This should generally not happen because we handle responses in dispatch
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

    // The messages are broadcast to all roles.
    // Check if this role should handle the request.
    if (targetRole && targetRole !== this.currentRole) {
      // If we're background and target is content, send message to content script
      if (this.currentRole === 'background' && targetRole === 'content') {
        await this.forwardToContentScript(message, sendResponse);
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
    try {
      const result = await this.executeLocally(functionName, args);
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
  }

  private async forwardToContentScript(message: Message, sendResponse: (response: any) => void): Promise<void> {
    // Only service worker (background) can do this
    if (this.currentRole !== 'background') {
      sendResponse({
        type: 'everywhere-response',
        id: message.id,
        error: 'Only background can forward messages to content script',
        functionName: message.functionName,
        sourceRole: this.currentRole,
      });
      return;
    }

    const { id, functionName, args } = message;
    try {
      // Use the shared logic to send to content script
      const result = await this.executeInContentScript(functionName, args);
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
  }

  private async executeInContentScript<K extends keyof GlobalFunctions>(
    functionName: K | string,
    args: Input<K>,
  ): Promise<AwaitedOutput<K>> {
    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) {
      throw new Error('No active tab found');
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
        throw new Error(
          `Failed to inject content script: ${injectError instanceof Error ? injectError.message : injectError}`,
        );
      }
    }

    // Create a message for the content script
    const id = this.generateId();
    const message: Message = {
      type: 'everywhere-request',
      id,
      functionName: functionName as string,
      args,
      targetRole: 'content',
      sourceRole: this.currentRole,
    };

    // Send the message and wait for response
    const response = await chrome.tabs.sendMessage(tab.id, message);

    // Check for Chrome runtime errors
    if ((chrome.runtime as any).lastError) {
      throw new Error((chrome.runtime as any).lastError.message);
    }

    if (!response) {
      throw new Error('No response from content script');
    }

    // Handle the response
    if (response.error) {
      throw new Error(response.error);
    }

    return response.result;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  public register<K extends keyof GlobalFunctions>(functionName: K, handler: GlobalFunctions[K], role: Role): void {
    // Register handler only if current role matches the specified role
    if (role === this.currentRole) {
      this.handlers.set(functionName as string, handler);
    }
  }

  public async dispatch<K extends keyof GlobalFunctions>(
    functionName: K,
    args: Input<K>,
    targetRole: Role,
  ): Promise<AwaitedOutput<K>> {
    // Ensure initialization
    const isInitialized = await this.initialized;
    if (!isInitialized) {
      throw new Error('EverywhereManager not initialized properly');
    }

    // Special case: If we're background and target is content, send directly to content script
    if (this.currentRole === 'background' && targetRole === 'content') {
      return this.executeInContentScript(functionName, args);
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

  private async executeLocally<K extends keyof GlobalFunctions>(
    functionName: K,
    args: Input<K>,
  ): Promise<AwaitedOutput<K>> {
    const handler = this.handlers.get(functionName as string);
    if (handler) {
      return await handler(...args);
    } else {
      const availableHandlers = Array.from(this.handlers.keys()).join(', ');
      throw new Error(
        `No handler registered for ${functionName} in ${this.currentRole}. Available handlers: ${availableHandlers}`,
      );
    }
  }

  public createFunction<K extends keyof GlobalFunctions>(functionName: K, targetRole: Role): EverywhereFn<K> {
    return async (...args: Input<K>): Promise<AwaitedOutput<K>> => {
      // If target role matches current role, execute locally
      if (targetRole === this.currentRole) {
        return this.executeLocally(functionName, args);
      } else {
        // Otherwise, send request to the target role
        return this.dispatch<K>(functionName, args, targetRole);
      }
    };
  }
}

// Create singleton instance
const everywhereManager = new EverywhereManager();

// Type-safe everywhere function with overloads
export function everywhere<K extends keyof GlobalFunctions>(functionName: K, role: Role): EverywhereFn<K>;
export function everywhere<K extends keyof GlobalFunctions>(
  functionName: K,
  handler: GlobalFunctions[K],
  role: Role,
): EverywhereFn<K>;
export function everywhere<K extends keyof GlobalFunctions>(
  functionName: K,
  handlerOrRole: GlobalFunctions[K] | Role,
  role?: Role,
): EverywhereFn<K> {
  if (typeof handlerOrRole === 'string') {
    // First overload: everywhere(functionName, role)
    return everywhereManager.createFunction(functionName, handlerOrRole as Role);
  } else {
    // Second overload: everywhere(functionName, handler, role)
    if (!role) {
      throw new Error('Role is required when registering a handler');
    }
    everywhereManager.register(functionName, handlerOrRole as GlobalFunctions[K], role);
    return everywhereManager.createFunction(functionName, role);
  }
}

// Helper function to register multiple handlers at once
export function registerHandlers<K extends keyof GlobalFunctions>(handlers: {
  [P in K]: {
    handler: GlobalFunctions[P];
    role: Role;
  };
}): void {
  for (const [functionName, config] of Object.entries(handlers) as Array<
    [K, { handler: GlobalFunctions[K]; role: Role }]
  >) {
    everywhereManager.register(functionName, config.handler, config.role);
  }
}

// Helper to explicitly call a function in a specific role
export function callInRole<K extends keyof GlobalFunctions>(
  role: Role,
  functionName: K,
  ...args: Input<K>
): Promise<AwaitedOutput<K>> {
  return (everywhereManager as any).dispatch(functionName as string, args, role);
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
    'content',
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
    'background',
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
    'sidebar',
  ),
};

// Export types for use in implementation files
export type { Role, Message, GlobalFunctions };
