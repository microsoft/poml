/**
 * Range in source file (byte positions)
 */
export interface Range {
  start: number;
  end: number;
}

/**
 * Error severity levels
 */
export enum Severity {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
}

/**
 * Diagnostic interface
 */
export interface Diagnostic {
  severity: Severity;
  message: string;
  sourceFile?: string;
  range?: Range;
  code?: string;
  hint?: string;
  originalError?: Error;
}

/**
 * Position with line and column
 */
export interface Position {
  line: number;
  column: number;
  index: number;
}

/**
 * Source file cache entry
 */
export interface SourceFileCache {
  filePath?: string;
  content: string;
  lines: string[];
  lineStarts: number[];
}
