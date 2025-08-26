import * as fs from 'fs';
import { SourceFileCache, Position } from './types';

export class SourceManager {
  private sourceCache = new Map<string, SourceFileCache>();
  private currentSourceFile?: string;
  private currentSourceContent?: string;

  /**
   * Set the current source file context for subsequent errors
   */
  public setCurrentFile(sourceFile: string, content?: string): void {
    this.currentSourceFile = sourceFile;
    this.currentSourceContent = content;

    if (content && sourceFile) {
      this.cacheSource(sourceFile, content);
    }
  }

  /**
   * Clear current file context
   */
  public clearCurrentFile(): void {
    this.currentSourceFile = undefined;
    this.currentSourceContent = undefined;
  }

  public getCurrentFile(): string | undefined {
    return this.currentSourceFile;
  }

  public getCurrentFileContent(): string | undefined {
    return this.currentSourceContent;
  }

  /**
   * Clear all
   */
  public clear(): void {
    this.sourceCache.clear();
    this.clearCurrentFile();
  }

  /**
   * Cache source file content
   */
  private cacheSource(file: string, content: string): void {
    const lines = content.split('\n');
    const lineStarts: number[] = [0];

    let pos = 0;
    for (const line of lines) {
      pos += line.length + 1; // +1 for newline
      lineStarts.push(pos);
    }

    this.sourceCache.set(file, {
      content,
      lines,
      lineStarts,
    });
  }

  /**
   * Load source file if not cached
   */
  public loadSource(file: string): SourceFileCache | null {
    if (this.sourceCache.has(file)) {
      return this.sourceCache.get(file)!;
    }

    try {
      const content = fs.readFileSync(file, 'utf8');
      this.cacheSource(file, content);
      return this.sourceCache.get(file)!;
    } catch (error) {
      return null;
    }
  }

  /**
   * Convert byte position to line/column
   */
  public indexToPosition(source: SourceFileCache, index: number): Position {
    const { lineStarts } = source;

    // Binary search for the line
    let line = 0;
    let left = 0;
    let right = lineStarts.length - 1;

    while (left < right) {
      const mid = Math.floor((left + right + 1) / 2);
      if (lineStarts[mid] <= index) {
        left = mid;
      } else {
        right = mid - 1;
      }
    }

    line = left;
    const column = index - lineStarts[line];

    return {
      line: line + 1, // 1-based
      column: column + 1, // 1-based
      index,
    };
  }
}

// Create singleton instance
const sourceManager = new SourceManager();
export default sourceManager;
