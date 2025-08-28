/**
 * RPC (Remote Procedure Call) System for Chrome Extension
 *
 * This module provides cross-context communication between different parts of a Chrome extension:
 * - Content scripts (injected into web pages)
 * - Background service worker (extension's persistent background context)
 * - Sidebar/popup/options pages (extension UI contexts)
 *
 * ## Data Serialization and Transmission
 *
 * Data passed through the RPC system undergoes serialization for transmission across
 * Chrome extension message channels. This process affects certain JavaScript values:
 *
 * ### Values that are preserved:
 * - Primitives: `string`, `number`, `boolean`, `null`
 * - Arrays and plain objects
 * - Typed arrays: `Uint8Array`, `Int16Array`, `Float32Array`, etc.
 * - `ArrayBuffer` objects (via custom binary serialization)
 * - Nested structures containing the above types
 *
 * ### Values that become `null` after transmission:
 * - `undefined` (both as values and object properties are omitted)
 * - `Infinity` and `-Infinity`
 * - `NaN`
 * - Sparse array holes (empty slots in arrays)
 * - Functions (stripped during serialization)
 * - Symbols
 * - Complex objects like `Date`, `RegExp`, `Map`, `Set` (become plain objects)
 *
 * ### Special cases:
 * - `-0` (negative zero) becomes `+0` (positive zero)
 * - Empty `ArrayBuffer` objects may not reconstruct properly across Playwright boundaries
 * - Circular references will cause serialization to fail
 *
 * ## Example transformations:
 * ```typescript
 * // Before transmission:
 * const data = {
 *   value: undefined,           // → property omitted
 *   array: [1, , 3],           // → [1, null, 3] (sparse hole becomes null)
 *   infinity: Infinity,        // → null
 *   negZero: -0,               // → 0 (positive zero)
 *   binary: new Uint8Array([1, 2, 3])  // → preserved as Uint8Array
 * };
 * ```
 *
 * @module rpc
 */

import { GlobalFunctions, FunctionRegistry } from './types';
import { serializeBinaryData, deserializeBinaryData } from './utils/base64';
import { waitForChromeRuntime } from './utils/chrome';

type Role = 'content' | 'background' | 'sidebar';

interface Message {
  type: 'everywhere-request' | 'everywhere-response';
  id: string;
  functionName: string;
  args?: any[];
  targetRole?: Role;
  sourceRole?: Role;
  error?: string;
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
    const { functionName, id, targetRole } = message;
    // Deserialize args that may contain binary data
    const args = message.args ? deserializeBinaryData(message.args) : undefined;

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
      if (args === undefined) {
        throw new Error('No arguments provided in the message');
      }
      const result = await this.executeLocally(functionName, args);
      // Serialize result before sending through message channel
      const serializedResult = serializeBinaryData(result);
      sendResponse({
        type: 'everywhere-response',
        id,
        result: serializedResult,
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

    const { id, functionName } = message;
    try {
      // Use the shared logic to send to content script
      const result = await this.launchContentScript(message);
      sendResponse(result);
    } catch (error) {
      // This error occurs in background service worker
      // So we sign it as coming from background
      sendResponse({
        type: 'everywhere-response',
        id,
        error: error instanceof Error ? error.message : error,
        functionName,
        sourceRole: this.currentRole,
      });
    }
  }

  private async launchContentScript(message: Message): Promise<Message> {
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
      console.warn('Content script not ready, injecting. This should not happen in normal operation.');
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

    // Send the message and wait for response
    const response = (await chrome.tabs.sendMessage(tab.id, message)) as Message | undefined;

    // Check for Chrome runtime errors
    let error: string | null = null;
    if ((chrome.runtime as any).lastError) {
      error = (chrome.runtime as any).lastError.message;
    } else if (!response) {
      error = 'No response from content script';
    } else if (response.id !== message.id) {
      error = `Mismatched response ID from content script: expected ${message.id}, got ${response.id}`;
    }

    if (error) {
      // This error occurs in background service worker
      // So we sign it as coming from background
      return {
        type: 'everywhere-response',
        id: message.id,
        error,
        functionName: message.functionName,
        sourceRole: this.currentRole,
      };
    }

    return response as Message;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  public register<K extends keyof GlobalFunctions>(
    functionName: K,
    handler: GlobalFunctions[K],
    role: Role | Role[],
  ): void {
    // Register handler only if current role matches any of the specified roles
    const roles = Array.isArray(role) ? role : [role];
    if (roles.includes(this.currentRole)) {
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

    let response: Message;

    const id = this.generateId();
    // Serialize args before sending through message channel
    const serializedArgs = serializeBinaryData(args);
    const message: Message = {
      type: 'everywhere-request',
      id,
      functionName: functionName as string,
      args: serializedArgs,
      targetRole,
      sourceRole: this.currentRole,
    };

    if (this.currentRole === 'background' && targetRole === 'content') {
      // Special case: If we're background and target is content, send directly to content script
      response = await this.launchContentScript(message);
    } else {
      // General case: send message via chrome.runtime.sendMessage

      let responseCandidate = (await chrome.runtime.sendMessage(message)) as Message | undefined;

      if ((chrome.runtime as any).lastError) {
        throw new (chrome.runtime as any).lastError();
      } else if (!responseCandidate) {
        throw new Error('No response received');
      } else if (responseCandidate.id !== id) {
        throw new Error(`Mismatched response ID: expected ${id}, got ${responseCandidate.id}`);
      }
      response = responseCandidate;
    }

    // Process and unpack the response
    const { error } = response;
    // Deserialize result that may contain binary data
    const result = response.result !== undefined ? deserializeBinaryData(response.result) : undefined;

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

  public createFunction<K extends keyof GlobalFunctions>(functionName: K, targetRole: Role | Role[]): EverywhereFn<K> {
    return async (...args: Input<K>): Promise<AwaitedOutput<K>> => {
      const targetRoles = Array.isArray(targetRole) ? targetRole : [targetRole];

      // If current role is in the target roles list, execute locally
      if (targetRoles.includes(this.currentRole)) {
        return this.executeLocally(functionName, args);
      } else {
        // Otherwise, dispatch to the first available target role
        return this.dispatch<K>(functionName, args, targetRoles[0]);
      }
    };
  }
}

// Create singleton instance
const everywhereManager = new EverywhereManager();

/**
 * Creates or calls a cross-context RPC function.
 *
 * This function has two modes:
 * 1. **Registration mode**: Register a function handler in a specific role
 * 2. **Call mode**: Create a function that can call handlers in other roles
 *
 * @example
 * ```typescript
 * // Register a function in the background role
 * const myFunc = everywhere('myFunction', (arg: string) => {
 *   return `Background processed: ${arg}`;
 * }, 'background');
 *
 * // Call the function from another role (e.g., sidebar)
 * const callBackground = everywhere('myFunction', 'background');
 * const result = await callBackground('hello'); // "Background processed: hello"
 * ```
 *
 * **Important**: Data passed through RPC calls undergoes serialization. See module
 * documentation for details on how different JavaScript values are transformed.
 *
 * @param functionName - The name of the function (must be defined in GlobalFunctions interface)
 * @param handlerOrRole - Either a function handler (registration mode) or target role (call mode)
 * @param role - The role where the handler should be registered (registration mode only)
 * @returns A function that can be called to invoke the RPC
 */
// Type-safe everywhere function with overloads
export function everywhere<K extends keyof GlobalFunctions>(functionName: K, role: Role | Role[]): EverywhereFn<K>;
export function everywhere<K extends keyof GlobalFunctions>(
  functionName: K,
  handler: GlobalFunctions[K],
  role: Role | Role[],
): EverywhereFn<K>;
export function everywhere<K extends keyof GlobalFunctions>(
  functionName: K,
  handlerOrRole: GlobalFunctions[K] | Role | Role[],
  role?: Role | Role[],
): EverywhereFn<K> {
  if (typeof handlerOrRole === 'string' || Array.isArray(handlerOrRole)) {
    // First overload: everywhere(functionName, role)
    return everywhereManager.createFunction(functionName, handlerOrRole as Role | Role[]);
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
    role: Role | Role[];
  };
}): void {
  for (const [functionName, config] of Object.entries(handlers) as Array<
    [K, { handler: GlobalFunctions[K]; role: Role | Role[] }]
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

export const pingPong: Record<string, (message: any, delay: number) => Promise<any>> = {
  content: everywhere(
    'pingPongContent',
    (message: any, delay: number) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          if (typeof message === 'string') {
            resolve(`Content received: ${message}`);
          } else {
            resolve({ content: message });
          }
        }, delay);
      });
    },
    'content',
  ),
  background: everywhere(
    'pingPongBackground',
    (message: any, delay: number) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          if (typeof message === 'string') {
            resolve(`Background received: ${message}`);
          } else {
            resolve({ content: message });
          }
        }, delay);
      });
    },
    'background',
  ),
  sidebar: everywhere(
    'pingPongSidebar',
    (message: any, delay: number) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          if (typeof message === 'string') {
            resolve(`Sidebar received: ${message}`);
          } else {
            resolve({ content: message });
          }
        }, delay);
      });
    },
    'sidebar',
  ),
  contentSidebar: everywhere(
    'pingPongContentSidebar',
    (message: any, delay: number) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          if (typeof message === 'string') {
            resolve(`${detectCurrentRole()} received: ${message}`);
          } else {
            resolve({ content: message });
          }
        }, delay);
      });
    },
    ['content', 'sidebar'],
  ),
};

// Export types for use in implementation files
export type { Role, Message, GlobalFunctions };
