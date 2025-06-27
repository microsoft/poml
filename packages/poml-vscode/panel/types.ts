import { Message, RichContent } from 'poml';
import * as vscode from 'vscode';

/**
 * Messages sent from the webview to the extension.
 */
export enum WebviewMessage {
  Command = 'command',
  RevealLine = 'revealLine',
  DidClick = 'didClick',
  Form = 'form',
  UpdateContent = 'updateContent',
}

/**
 * The general settings for a panel, set from the outside when creating it.
 * This is only visible to preview manager.
 */
export interface PanelSettings {
  readonly resourceColumn: vscode.ViewColumn;
  readonly previewColumn: vscode.ViewColumn;
  readonly locked: boolean;
}

/**
 * Config for one webview panel.
 * Data will be sent to the HTML.
 * Synced with webview/config.ts
 */
export interface WebviewConfig {
  source: string;
  line: number | undefined;
  lineCount: number;
  locked: boolean;
  scrollPreviewWithEditor?: boolean;
  scrollEditorWithPreview: boolean;
  doubleClickToSwitchToEditor: boolean;
}

/**
 * The inputs from webview panel.
 */
export interface WebviewUserOptions {
  speakerMode: boolean;
  displayFormat: 'rendered' | 'plain' | 'ir';
}

export const PreviewMethodName = 'poml/preview';

export interface PreviewParams extends WebviewUserOptions {
  uri: string;
  text?: string;
  returnAllErrors?: boolean;
}

export interface PreviewResponse {
  rawText: string;
  ir: string;
  content: RichContent | Message[];
  /**
   * For chat messages, the original start index of each message in the source file.
   */
  messageOffsets?: number[];
  /**
   * For plain text preview, mapping of spans to their source offsets.
   */
  plainSpans?: { text: string; offset: number }[];
  error?: string | any[];
}

/**
 * The state that is used for serialization.
 * Useful when reviving a webview panel.
 * Synced with webview/state.ts
 */
export type WebviewState = WebviewConfig & WebviewUserOptions;
