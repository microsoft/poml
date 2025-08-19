import { Message, RichContent, SourceMapMessage, SourceMapRichContent } from 'poml';
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
  UpdateUserOptions = 'updateUserOptions',
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
  contexts: string[];
  stylesheets: string[];
}

export const PreviewMethodName = 'poml/preview';

export interface PreviewParams extends WebviewUserOptions {
  uri: string;
  text?: string;
  inlineContext?: { [key: string]: any };
  returnAllErrors?: boolean;
  returnTokenCounts?: { model: string };
}

export interface PreviewResponse {
  rawText: string;
  ir: string;
  content: RichContent | Message[];
  error?: string | any[];
  sourceMap?: SourceMapRichContent[] | SourceMapMessage[];
  tokens?: {
    perMessage?: number[];
    total: number;
  };
  responseSchema?: { [key: string]: any };
  tools?: { [key: string]: any }[];
  runtime?: { [key: string]: any };
}

/**
 * The state that is used for serialization.
 * Useful when reviving a webview panel.
 * Synced with webview/state.ts
 */
export type WebviewState = WebviewConfig & WebviewUserOptions;
