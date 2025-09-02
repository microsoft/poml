import $ from 'jquery';
import { MessagePoster } from './util';
import { WebviewState, WebviewMessage, WebviewUserOptions } from '../poml-vscode/panel/types';

export function getData(key: string): any {
  // Preview data must be stored in the DOM (webview-state) by the extension side.
  const element = getElementOrThrowException('webview-state');
  if (element) {
    const data = element.getAttribute(key);
    if (data) {
      return JSON.parse(data);
    }
  }

  throw new Error(`Could not load data for ${key}`);
}

let cachedState: WebviewState | undefined = undefined;

export function getState(): WebviewState {
  if (cachedState) {
    return cachedState;
  }

  cachedState = getData('data-state');
  if (cachedState) {
    return cachedState;
  }

  throw new Error('Could not load state');
}

export function setCachedState(state: WebviewState): void {
  cachedState = state;
}

function getElementOrThrowException(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Could not find element with id ${id}`);
  }
  return element;
}
