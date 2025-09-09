import * as path from 'path';
import chalk from 'chalk';
import { Diagnostic, Range, Severity } from './types';
import sourceManager from './source';

interface FormatOptions {
  showWarnings?: boolean;
  showInfo?: boolean;
  groupByFile?: boolean;
}

/**
 * Global Error Collector.
 *
 * Goals:
 *
 * 1. Centralized singleton that collects errors from anywhere in the codebase
 * 2. Support for error types (error/warning), source locations (file, line, column, index ranges), and contextual data
 * 3. Handle errors from embedded languages (JSON, JS expressions) with source mapping back to original positions
 * 4. Track errors across multiple source files without conflicts
 * 5. Collect multiple errors without stopping execution
 * 6. Clear errors between compilation runs or test cases
 * 7. Generate human-readable, formatted error messages with source context
 */
export class ErrorCollector {
  private diagnostics: Diagnostic[] = [];
  private suppressedCodes = new Set<string>();
  private maxErrors = 100;

  /**
   * Clear all collected errors
   */
  public clear(): void {
    this.diagnostics = [];
  }

  /**
   * Post an error
   */
  public error(message: string, range?: Range, options: Partial<Diagnostic> = {}): void {
    this.add({
      ...options,
      severity: Severity.ERROR,
      message,
      range,
      sourceFile: options.sourceFile || sourceManager.getCurrentFile(),
    });
  }

  /**
   * Post a warning
   */
  public warning(message: string, range?: Range, options: Partial<Diagnostic> = {}): void {
    this.add({
      ...options,
      severity: Severity.WARNING,
      message,
      range,
      sourceFile: options.sourceFile || sourceManager.getCurrentFile(),
    });
  }

  /**
   * Post an info message
   */
  public info(message: string, range?: Range, options: Partial<Diagnostic> = {}): void {
    this.add({
      ...options,
      severity: Severity.INFO,
      message,
      range,
      sourceFile: options.sourceFile || sourceManager.getCurrentFile(),
    });
  }

  /**
   * Add a diagnostic
   */
  public add(diagnostic: Diagnostic): void {
    // Check error limit
    if (this.diagnostics.length >= this.maxErrors) {
      if (this.diagnostics.length === this.maxErrors) {
        this.diagnostics.push({
          severity: Severity.ERROR,
          message: `Error limit reached (${this.maxErrors}). Further errors suppressed.`,
        });
      }
      return;
    }

    // Skip suppressed error codes
    if (diagnostic.code && this.suppressedCodes.has(diagnostic.code)) {
      return;
    }

    // Add current file if not specified
    if (!diagnostic.sourceFile && sourceManager.getCurrentFile()) {
      diagnostic.sourceFile = sourceManager.getCurrentFile();
    }

    this.diagnostics.push(diagnostic);
  }

  /**
   * Post a JSON parsing error with automatic position mapping
   */
  public jsonError(originalError: Error, jsonRange: Range): void {
    // Extract position from JSON parse error if available
    const posMatch = originalError.message.match(/position (\d+)/);
    let range = jsonRange;

    if (posMatch) {
      const errorPos = parseInt(posMatch[1]);
      // Map the JSON error position to the original source
      range = {
        start: jsonRange.start + errorPos,
        end: jsonRange.start + errorPos + 1,
      };
    }

    this.error(`JSON parsing error: ${originalError.message}`, range, {
      code: 'JSON_PARSE_ERROR',
      originalError,
      hint: 'Check for trailing commas, unquoted keys, or undefined values',
    });
  }

  /**
   * Post a JavaScript expression evaluation error
   */
  public expressionError(originalError: Error, expressionRange: Range, evalHeaderLength: number = 0): void {
    // Adjust range if there's a header (like "return " or "const result = ")
    const adjustedRange =
      evalHeaderLength > 0
        ? {
            start: expressionRange.start + evalHeaderLength,
            end: expressionRange.end,
          }
        : expressionRange;

    // Try to extract line/column from error stack
    const stackMatch = originalError.stack?.match(/<anonymous>:(\d+):(\d+)/);
    let range = adjustedRange;

    if (stackMatch) {
      const errorLine = parseInt(stackMatch[1]);
      const errorCol = parseInt(stackMatch[2]);

      // If we have line/column info, try to be more precise
      const currentFileContent = sourceManager.getCurrentFileContent();
      if (currentFileContent) {
        const exprContent = currentFileContent.substring(expressionRange.start, expressionRange.end);
        const lines = exprContent.split('\n');

        if (errorLine <= lines.length) {
          let offset = expressionRange.start;
          for (let i = 0; i < errorLine - 1; i++) {
            offset += lines[i].length + 1; // +1 for newline
          }
          offset += Math.min(errorCol - 1, lines[errorLine - 1].length);

          range = {
            start: offset,
            end: offset + 1,
          };
        }
      }
    }

    this.error(`Expression evaluation failed: ${originalError.message}`, range, {
      code: 'EXPRESSION_ERROR',
      originalError,
      hint: 'Check variable names and syntax in the expression',
    });
  }

  /**
   * Suppress errors with specific codes
   */
  public suppressCode(code: string): void {
    this.suppressedCodes.add(code);
  }

  /**
   * Format a single diagnostic for CLI output
   */
  private formatDiagnostic(diagnostic: Diagnostic): string {
    const parts: string[] = [];

    // Severity and code
    const severityColor = {
      [Severity.ERROR]: chalk.red,
      [Severity.WARNING]: chalk.yellow,
      [Severity.INFO]: chalk.blue,
    }[diagnostic.severity];

    let header = severityColor(diagnostic.severity.toUpperCase());

    if (diagnostic.code) {
      header += chalk.gray(` [${diagnostic.code}]`);
    }

    // File location
    if (diagnostic.sourceFile) {
      const source = sourceManager.loadSource(diagnostic.sourceFile);

      if (source && diagnostic.range) {
        const startPos = sourceManager.indexToPosition(source, diagnostic.range.start);
        const location = `${diagnostic.sourceFile}:${startPos.line}:${startPos.column}`;
        header += ` ${chalk.cyan(location)}`;
      } else {
        header += ` ${chalk.cyan(diagnostic.sourceFile)}`;
      }
    }

    parts.push(header);

    // Message
    parts.push(`  ${diagnostic.message}`);

    // Source context
    if (diagnostic.sourceFile && diagnostic.range) {
      const source = sourceManager.loadSource(diagnostic.sourceFile);

      if (source) {
        const startPos = sourceManager.indexToPosition(source, diagnostic.range.start);
        const endPos = sourceManager.indexToPosition(source, diagnostic.range.end);

        // Show context lines
        const contextLines = 2;
        const startLine = Math.max(0, startPos.line - contextLines - 1);
        const endLine = Math.min(source.lines.length - 1, startPos.line + contextLines - 1);

        parts.push('');

        for (let i = startLine; i <= endLine; i++) {
          const lineNum = String(i + 1).padStart(4, ' ');
          const isErrorLine = i === startPos.line - 1;
          const pipe = isErrorLine ? '>' : '|';
          const lineColor = isErrorLine ? chalk.white : chalk.gray;

          parts.push(chalk.gray(`  ${lineNum} ${pipe}`) + ' ' + lineColor(source.lines[i]));

          // Add error underline
          if (isErrorLine) {
            const spacing = ' '.repeat(startPos.column - 1 + 7);
            let markerLength = 1;

            if (startPos.line === endPos.line) {
              markerLength = Math.max(1, endPos.column - startPos.column);
            } else {
              markerLength = source.lines[i].length - startPos.column + 1;
            }

            const marker = '^'.repeat(Math.min(markerLength, 80));
            parts.push(severityColor(spacing + marker));
          }
        }
      }
    }

    // Hint
    if (diagnostic.hint) {
      parts.push('');
      parts.push(chalk.green(`  💡 ${diagnostic.hint}`));
    }

    return parts.join('\n');
  }

  /**
   * Get all errors
   */
  public getErrors(): Diagnostic[] {
    return this.diagnostics.filter((d) => d.severity === Severity.ERROR);
  }

  /**
   * Get all warnings
   */
  public getWarnings(): Diagnostic[] {
    return this.diagnostics.filter((d) => d.severity === Severity.WARNING);
  }

  /**
   * Check if there are any errors
   */
  public hasErrors(): boolean {
    return this.getErrors().length > 0;
  }

  /**
   * Get count by severity
   */
  public getCounts(): { errors: number; warnings: number; info: number } {
    const counts = { errors: 0, warnings: 0, info: 0 };

    for (const d of this.diagnostics) {
      switch (d.severity) {
        case Severity.ERROR:
          counts.errors++;
          break;
        case Severity.WARNING:
          counts.warnings++;
          break;
        case Severity.INFO:
          counts.info++;
          break;
      }
    }

    return counts;
  }

  /**
   * Format all diagnostics for CLI output
   */
  public format(options?: FormatOptions): string {
    const { showWarnings = true, showInfo = false, groupByFile = true } = options ?? {};

    const filtered = this.diagnostics.filter((d) => {
      if (d.severity === Severity.ERROR) {
        return true;
      }
      if (d.severity === Severity.WARNING) {
        return showWarnings;
      }
      if (d.severity === Severity.INFO) {
        return showInfo;
      }
      return false;
    });

    if (filtered.length === 0) {
      return chalk.green('✓ No issues found');
    }

    const output: string[] = [];

    if (groupByFile) {
      // Group by file
      const byFile = new Map<string, Diagnostic[]>();
      const noFile: Diagnostic[] = [];

      for (const d of filtered) {
        if (d.sourceFile) {
          if (!byFile.has(d.sourceFile)) {
            byFile.set(d.sourceFile, []);
          }
          byFile.get(d.sourceFile)!.push(d);
        } else {
          noFile.push(d);
        }
      }

      // Sort files
      const sortedFiles = Array.from(byFile.keys()).sort();

      for (const file of sortedFiles) {
        output.push(chalk.underline.bold(path.relative(process.cwd(), file)));
        output.push('');

        const diagnostics = byFile.get(file)!.sort((a, b) => {
          if (!a.range || !b.range) {
            return 0;
          }
          return a.range.start - b.range.start;
        });

        for (const d of diagnostics) {
          output.push(this.formatDiagnostic(d));
          output.push('');
        }
      }

      // Add diagnostics without file
      if (noFile.length > 0) {
        output.push(chalk.underline.bold('General'));
        output.push('');
        for (const d of noFile) {
          output.push(this.formatDiagnostic(d));
          output.push('');
        }
      }
    } else {
      // Simple list
      for (const d of filtered) {
        output.push(this.formatDiagnostic(d));
        output.push('');
      }
    }

    // Summary
    const counts = this.getCounts();
    const summary: string[] = [];

    if (counts.errors > 0) {
      summary.push(chalk.red(`${counts.errors} error${counts.errors !== 1 ? 's' : ''}`));
    }
    if (counts.warnings > 0 && showWarnings) {
      summary.push(chalk.yellow(`${counts.warnings} warning${counts.warnings !== 1 ? 's' : ''}`));
    }
    if (counts.info > 0 && showInfo) {
      summary.push(chalk.blue(`${counts.info} info`));
    }

    output.push(chalk.bold(`Found ${summary.join(', ')}`));

    return output.join('\n');
  }

  /**
   * Print formatted errors to console
   */
  public print(options?: FormatOptions): void {
    console.log(this.format(options));
  }

  /**
   * Get all diagnostics
   */
  public getDiagnostics(): ReadonlyArray<Diagnostic> {
    return this.diagnostics;
  }
}

// Create singleton instance
let errorCollector: ErrorCollector | undefined = undefined;

export function getErrorCollector(): ErrorCollector {
  if (!errorCollector) {
    errorCollector = new ErrorCollector();
  }
  return errorCollector;
}

// Convenience export

export const clear = () => getErrorCollector().clear();
export const error = (message: string, range?: Range, options: Partial<Diagnostic> = {}) =>
  getErrorCollector().error(message, range, options);
export const warning = (message: string, range?: Range, options: Partial<Diagnostic> = {}) =>
  getErrorCollector().warning(message, range, options);
export const info = (message: string, range?: Range, options: Partial<Diagnostic> = {}) =>
  getErrorCollector().info(message, range, options);
export const jsonError = (originalError: Error, jsonRange: Range) =>
  getErrorCollector().jsonError(originalError, jsonRange);
export const expressionError = (originalError: Error, expressionRange: Range, evalHeaderLength: number = 0) =>
  getErrorCollector().expressionError(originalError, expressionRange, evalHeaderLength);
export const suppressCode = (code: string) => getErrorCollector().suppressCode(code);
export const hasErrors = () => getErrorCollector().hasErrors();
export const getErrors = () => getErrorCollector().getErrors();
export const getWarnings = () => getErrorCollector().getWarnings();
export const getCounts = () => getErrorCollector().getCounts();
export const format = (options?: FormatOptions) => getErrorCollector().format(options);
export const print = (options?: FormatOptions) => getErrorCollector().print(options);
export const getDiagnostics = () => getErrorCollector().getDiagnostics();
