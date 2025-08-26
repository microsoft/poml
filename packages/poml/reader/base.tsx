import * as React from 'react';

import { Segment } from './segment';
import { PomlToken } from 'poml/file';

export interface ReaderOptions {
  trim?: boolean;
  autoAddPoml?: boolean;
  crlfToLf?: boolean;
}

export interface PomlContext {
  variables: { [key: string]: any }; // For {{ substitutions }} and <let> (Read/Write)
  texts: { [key: string]: React.ReactElement }; // Maps TEXT_ID to content for <text> replacement (Read/Write)
  stylesheet: { [key: string]: string }; // Merged styles from all <meta> tags (Read-Only during render)
  minimalPomlVersion?: string; // From <meta> (Read-Only)
  sourcePath: string; // File path for resolving includes (Read-Only)
}

export class Reader {
  private segment: Segment;
  private options: ReaderOptions;

  constructor(segment: Segment, options?: ReaderOptions) {
    this.segment = segment;
    this.options = options || {};
  }

  public react(context?: PomlContext): React.ReactElement {
    throw new Error('Method react() not implemented');
  }

  public getHoverToken(offset: number): PomlToken | undefined {
    throw new Error('Method getHoverToken() not implemented');
  }

  public getCompletions(offset: number): PomlToken[] {
    throw new Error('Method getCompletions() not implemented');
  }
}
