/**
 * Handles the files (with .poml extension).
 */

import { IToken, CstNode } from 'chevrotain';
import { DocumentCstNode, parse as parseXML } from '@xml-tools/parser';
import { buildAst, XMLAttribute, XMLDocument, XMLElement, XMLTextContent } from '@xml-tools/ast';
import * as React from 'react';
import {
  ComponentSpec,
  PomlComponent,
  ReadError,
  SourceProvider,
  findComponentByAlias,
  findComponentByAliasOrUndefined,
  listComponents
} from './base';
import { AnyValue, deepMerge, parseText, readSource } from './util';
import { StyleSheetProvider, ErrorCollection } from './base';
import { getSuggestions } from './util/xmlContentAssist';
import { existsSync, readFileSync } from './util/fs';
import path from 'path';
import { POML_VERSION } from './version';
import { Schema, ToolsSchema } from './util/schema';
import { z } from 'zod';

export interface PomlReaderOptions {
  trim?: boolean;
  autoAddPoml?: boolean;
  crlfToLf?: boolean;
}

interface PomlReaderConfig {
  trim: boolean;
  autoAddPoml: boolean;
  crlfToLf: boolean;
}

export interface PomlToken {
  type: 'element' | 'attribute' | 'attributeValue' | 'expression';
  range: Range;
  element?: string;
  attribute?: string; // specified only if it's an attribute
  value?: string; // specified only if it's an attribute value
  expression?: string; // specified only if it's an expression
}

/**
 * Temporarily used for document range and positional range.
 */
interface Range {
  start: number;
  end: number;
}

export class PomlFile {
  private text: string;
  private sourcePath: string | undefined;
  private config: PomlReaderConfig;
  private ast: XMLDocument | undefined;
  private cst: CstNode;
  private tokenVector: IToken[];
  private documentRange: Range;
  private disabledComponents: Set<string> = new Set();
  private expressionTokens: PomlToken[] = [];
  private expressionEvaluations: Map<string, any[]> = new Map();
  private responseSchema: Schema | undefined;
  private toolsSchema: ToolsSchema | undefined;
  private runtimeParameters: { [key: string]: any } | undefined;

  constructor(text: string, options?: PomlReaderOptions, sourcePath?: string) {
    this.config = {
      trim: options?.trim ?? true,
      autoAddPoml: options?.autoAddPoml ?? true,
      crlfToLf: options?.crlfToLf ?? true
    };
    this.text = this.config.crlfToLf ? text.replace(/\r\n/g, '\n') : text;
    this.sourcePath = sourcePath;
    if (this.sourcePath) {
      const envFile = this.sourcePath.replace(/(source\.)?\.poml$/i, '.env');
      if (existsSync(envFile)) {
        try {
          const envText = readFileSync(envFile, 'utf8');
          const match = envText.match(/^SOURCE_PATH=(.*)$/m);
          if (match) {
            // The real source path is specified in the .env file.
            this.sourcePath = match[1];
          }
        } catch {
          /* ignore */
        }
      }
    }

    this.documentRange = { start: 0, end: text.length - 1 };
    let { ast, cst, tokenVector, errors } = this.readXml(text);

    let addPoml: string | undefined = undefined;
    if (this.config.autoAddPoml && text.slice(5).toLowerCase() !== '<poml') {
      if (!ast || !ast.rootElement) {
        // Invalid XML. Treating it as a free text.
        addPoml = '<poml syntax="text" whiteSpace="pre">';
      } else if (
        // Valid XML, but contains e.g., multiple root elements.
        (ast.rootElement.position.startOffset > 0 &&
          !this.testAllCommentsAndSpace(
            0,
            ast.rootElement.position.startOffset - 1,
            tokenVector
          )) ||
        (ast.rootElement.position.endOffset + 1 < text.length &&
          !this.testAllCommentsAndSpace(
            ast.rootElement.position.endOffset + 1,
            text.length - 1,
            tokenVector
          ))
      ) {
        addPoml = '<poml syntax="markdown">';
      }
    }

    if (addPoml) {
      this.documentRange = { start: addPoml.length, end: text.length - 1 + addPoml.length };
      this.config.trim = options?.trim ?? false; // TODO: this is an ad-hoc fix.
      let { ast, cst, tokenVector, errors } = this.readXml(addPoml + text + '</poml>');
      this.ast = ast;
      this.cst = cst;
      this.tokenVector = tokenVector;
      // Report errors
      for (const error of errors) {
        ErrorCollection.add(error);
      }
    } else {
      this.ast = ast;
      this.cst = cst;
      this.tokenVector = tokenVector;
      for (const error of errors) {
        ErrorCollection.add(error);
      }
    }
  }

  private readXml(text: string) {
    const { cst, tokenVector, lexErrors, parseErrors } = parseXML(text);
    const errors: ReadError[] = [];

    for (const lexError of lexErrors) {
      errors.push(
        this.formatError(
          lexError.message,
          {
            start: this.ensureRange(lexError.offset),
            end: this.ensureRange(lexError.offset)
          },
          lexErrors
        )
      );
    }

    for (const parseError of parseErrors) {
      let startOffset = parseError.token.startOffset;
      let endOffset = parseError.token.endOffset;
      if (
        isNaN(startOffset) &&
        (endOffset === undefined || isNaN(endOffset)) &&
        (parseError as any).previousToken
      ) {
        startOffset = (parseError as any).previousToken.endOffset;
        endOffset = (parseError as any).previousToken.endOffset;
      }
      errors.push(
        this.formatError(
          parseError.message,
          {
            start: this.ensureRange(startOffset),
            end: endOffset ? this.ensureRange(endOffset) : this.ensureRange(startOffset)
          },
          parseError
        )
      );
    }

    let ast: XMLDocument | undefined = undefined;
    try {
      ast = buildAst(cst as any, tokenVector);
    } catch (e) {
      errors.push(
        this.formatError(
          'Error building AST',
          {
            start: this.ensureRange(0),
            end: this.ensureRange(text.length)
          },
          e
        )
      );
    }

    return { ast, cst, tokenVector, errors };
  }

  private testAllCommentsAndSpace(
    startOffset: number,
    endOffset: number,
    tokens: IToken[]
  ): boolean {
    // start to end, inclusive. It must not be in the middle of a token.
    const tokensFiltered = tokens.filter(
      (token: IToken) =>
        token.startOffset >= startOffset && (token.endOffset ?? token.startOffset) <= endOffset
    );
    return tokensFiltered.every((token: IToken) => {
      if (token.tokenType.name === 'SEA_WS' || token.tokenType.name === 'Comment') {
        return true;
      } else if (/^\s*$/.test(token.image)) {
        return true;
      }
      return false;
    });
  }

  private readJsonElement(parent: XMLElement, tagName: string): any | undefined {
    const element = xmlElementContents(parent).filter(
      i => i.type === 'XMLElement' && i.name?.toLowerCase() === tagName.toLowerCase()
    ) as XMLElement[];
    if (element.length === 0) {
      return undefined;
    }

    if (element.length > 1) {
      this.reportError(`Multiple ${tagName} element found.`, {
        start: this.ensureRange(element[0].position.startOffset),
        end: this.ensureRange(element[element.length - 1].position.endOffset)
      });
      return undefined;
    }

    const text = xmlElementText(element[0]);
    try {
      return JSON.parse(text);
    } catch (e) {
      this.reportError(
        e !== undefined && (e as Error).message
          ? (e as Error).message
          : `Error parsing JSON: ${text}`,
        this.xmlElementRange(element[0]),
        e
      );
      return undefined;
    }
  }

  public getResponseSchema(): Schema | undefined {
    return this.responseSchema;
  }

  public getToolsSchema(): ToolsSchema | undefined {
    return this.toolsSchema;
  }

  public getRuntimeParameters(): { [key: string]: any } | undefined {
    return this.runtimeParameters;
  }

  public xmlRootElement(): XMLElement | undefined {
    if (!this.ast || !this.ast.rootElement) {
      this.reportError('Root element is invalid.', {
        start: this.ensureRange(this.documentRange.start),
        end: this.ensureRange(this.documentRange.end)
      });
      return undefined;
    } else {
      return this.ast.rootElement;
    }
  }

  public react(context?: { [key: string]: any }): React.ReactElement {
    this.expressionTokens = [];
    this.expressionEvaluations.clear();
    const rootElement = this.xmlRootElement();

    if (rootElement) {
      // See whether stylesheet and context is available
      const stylesheet = this.readJsonElement(rootElement, 'stylesheet');
      context = deepMerge(context || {}, this.readJsonElement(rootElement, 'context') || {});

      let parsedElement = this.parseXmlElement(rootElement, context || {}, {});
      if (stylesheet) {
        parsedElement = React.createElement(StyleSheetProvider, { stylesheet }, parsedElement);
      }
      if (this.sourcePath) {
        parsedElement = React.createElement(
          SourceProvider,
          { source: this.sourcePath },
          parsedElement
        );
      }
      return parsedElement;
    } else {
      return <></>;
    }
  }

  public getHoverToken(offset: number): PomlToken | undefined {
    const realOffset = this.recoverPosition(offset);
    if (!this.ast || !this.ast.rootElement) {
      return undefined;
    }
    return this.findTokenInElement(this.ast.rootElement, realOffset);
  }

  public getCompletions(offset: number): PomlToken[] {
    const realOffset = this.recoverPosition(offset);
    if (!this.ast || !this.ast.rootElement) {
      return [];
    }

    return getSuggestions({
      ast: this.ast,
      cst: this.cst as DocumentCstNode,
      tokenVector: this.tokenVector,
      offset: realOffset,
      providers: {
        // 1. There are more types(scenarios) of suggestions providers (see api.d.ts)
        // 2. Multiple providers may be supplied for a single scenario.
        elementName: [this.handleElementNameCompletion(realOffset)],
        elementNameClose: [this.handleElementNameCloseCompletion(realOffset)],
        attributeName: [this.handleAttributeNameCompletion(realOffset)],
        attributeValue: [this.handleAttributeValueCompletion(realOffset)]
      }
    });
  }

  public getExpressionTokens(): PomlToken[] {
    if (this.expressionTokens.length > 0) {
      return this.expressionTokens;
    }
    if (!this.ast || !this.ast.rootElement) {
      return [];
    }
    const tokens: PomlToken[] = [];
    const regex = /{{\s*(.+?)\s*}}(?!})/gm;

    const visit = (element: XMLElement) => {
      // Special handling for meta elements with lang="expr"
      if (element.name?.toLowerCase() === 'meta') {
        const langAttr = xmlAttribute(element, 'lang');
        const typeAttr = xmlAttribute(element, 'type');
        const isSchemaType = typeAttr?.value === 'responseSchema' || typeAttr?.value === 'tool';
        const text = xmlElementText(element).trim();

        // Check if it's an expression (either explicit lang="expr" or auto-detected)
        if (isSchemaType && (langAttr?.value === 'expr' || (!langAttr && !text.trim().startsWith('{')))) {
          const position = this.xmlElementRange(element.textContents[0]);
          tokens.push({
            type: 'expression',
            range: position,
            expression: text.trim(),
          });
          return;
        }
      }

      // attributes
      for (const attr of element.attributes) {
        if (!attr.value) {
          continue;
        }
        if (attr.key?.toLowerCase() === 'if' || attr.key?.toLowerCase() === 'for') {
          tokens.push({
            type: 'expression',
            range: this.xmlAttributeValueRange(attr),
            expression: attr.value
          });
          continue;
        }
        if (element.name?.toLowerCase() === 'let' && attr.key?.toLowerCase() === 'value') {
          tokens.push({
            type: 'expression',
            range: this.xmlAttributeValueRange(attr),
            expression: attr.value
          });
          continue;
        }
        const range = this.xmlAttributeValueRange(attr);
        regex.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(attr.value))) {
          tokens.push({
            type: 'expression',
            range: {
              start: range.start + match.index,
              end: range.start + match.index + match[0].length - 1,
            },
            expression: match[1],
          });
        }
      }

      // text contents
      for (const tc of element.textContents) {
        const text = tc.text || '';
        const pos = this.xmlElementRange(tc);

        // Regular template expression handling for other elements and JSON
        regex.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(text))) {
          tokens.push({
            type: 'expression',
            range: {
              start: pos.start + match.index,
              end: pos.start + match.index + match[0].length - 1,
            },
            expression: match[1],
          });
        }
      }

      for (const child of element.subElements) {
        visit(child);
      }
    };

    visit(this.ast.rootElement);
    return tokens;
  }

  public getExpressionEvaluations(range: Range): any[] {
    const key = `${range.start}:${range.end}`;
    return this.expressionEvaluations.get(key) ?? [];
  }

  private recordEvaluation(range: Range, output: any) {
    const key = `${range.start}:${range.end}`;
    const evaluationList = this.expressionEvaluations.get(key) ?? [];
    evaluationList.push(output);
    this.expressionEvaluations.set(key, evaluationList);
  }

  private formatError(msg: string, range?: Range, cause?: any): ReadError {
    return ReadError.fromProps(
      msg,
      {
        originalStartIndex: range?.start,
        originalEndIndex: range?.end,
        sourcePath: this.sourcePath
      },
      { cause: cause }
    );
  }

  private reportError(msg: string, range?: Range, cause?: any): void {
    ErrorCollection.add(this.formatError(msg, range, cause));
  }

  /**
   * Template related functions only usable in standalone poml files.
   * It's not available for POML expressed with JSX or Python SDK.
   */

  private handleForLoop(
    element: XMLElement,
    context: { [key: string]: any }
  ): { [key: string]: any }[] {
    const forLoop = element.attributes.find(attr => attr.key?.toLowerCase() === 'for');
    if (!forLoop) {
      // No for loop found.
      return [];
    }
    const forLoopValue = forLoop.value;
    if (!forLoopValue) {
      this.reportError('for attribute value is expected.', this.xmlElementRange(element));
      return [];
    }
    const [itemName, listName] = forLoopValue.match(/(.+)\s+in\s+(.+)/)?.slice(1) || [null, null];
    if (!itemName || !listName) {
      this.reportError(
        'item in list syntax is expected in for attribute.',
        this.xmlAttributeValueRange(forLoop)
      );
      return [];
    }

    const list = this.evaluateExpression(listName, context, this.xmlAttributeValueRange(forLoop));
    if (!Array.isArray(list)) {
      this.reportError('List is expected in for attribute.', this.xmlAttributeValueRange(forLoop));
      return [];
    }
    return list.map((item: any, index: number) => {
      const loop = {
        index: index,
        length: list.length,
        first: index === 0,
        last: index === list.length - 1
      };
      return { loop: loop, [itemName]: item };
    });
  }

  private handleIfCondition = (element: XMLElement, context: { [key: string]: any }): boolean => {
    const ifCondition = element.attributes.find(attr => attr.key?.toLowerCase() === 'if');
    if (!ifCondition) {
      // No if condition found.
      return true;
    }
    const ifConditionValue = ifCondition.value;
    if (!ifConditionValue) {
      this.reportError('if attribute value is expected.', this.xmlAttributeValueRange(ifCondition));
      return false;
    }
    const condition = this.evaluateExpression(
      ifConditionValue,
      context,
      this.xmlAttributeValueRange(ifCondition),
      true
    );
    if (condition) {
      return true;
    } else {
      return false;
    }
  };

  private handleLet = (element: XMLElement, context: { [key: string]: any }): boolean => {
    if (element.name?.toLowerCase() !== 'let') {
      return false;
    }
    const source = xmlAttribute(element, 'src')?.value;
    const type = xmlAttribute(element, 'type')?.value;
    const name = xmlAttribute(element, 'name')?.value;
    const value = xmlAttribute(element, 'value')?.value;

    // Case 1: <let name="var1" src="/path/to/file" />, case insensitive
    // or <let src="/path/to/file" />, case insensitive
    if (source) {
      let content: any;
      try {
        content = readSource(
          source,
          this.sourcePath ? path.dirname(this.sourcePath) : undefined,
          type as AnyValue | undefined
        );
      } catch (e) {
        this.reportError(
          e !== undefined && (e as Error).message
            ? (e as Error).message
            : `Error reading source: ${source}`,
          this.xmlAttributeValueRange(xmlAttribute(element, 'src')!),
          e
        );
        return true;
      }
      if (!name) {
        if (content && typeof content === 'object') {
          Object.assign(context, content);
        } else {
          this.reportError(
            'name attribute is expected when the source is not an object.',
            this.xmlElementRange(element)
          );
        }
      } else {
        context[name] = content;
      }
      return true;
    }

    // Case 2: <let name="var1" value="{{ expression }}" />, case insensitive
    if (value) {
      if (!name) {
        this.reportError(
          'name attribute is expected when <let> contains two attributes.',
          this.xmlElementRange(element)
        );
        return true;
      }
      const evaluated = this.evaluateExpression(
        value,
        context,
        this.xmlAttributeValueRange(xmlAttribute(element, 'value')!),
        true
      );
      context[name] = evaluated;
      return true;
    }

    // Case 3: <let>{ JSON }</let>
    // or <let name="var1" type="number">{ JSON }</let>
    if (element.textContents.length > 0) {
      const text = xmlElementText(element);
      let content: any;
      try {
        content = parseText(text, type as AnyValue | undefined);
      } catch (e) {
        this.reportError(
          e !== undefined && (e as Error).message
            ? (e as Error).message
            : `Error parsing text as type ${type}: ${text}`,
          this.xmlElementRange(element),
          e
        );
        return true;
      }
      if (!name) {
        if (content && typeof content === 'object') {
          Object.assign(context, content);
        } else {
          this.reportError(
            'name attribute is expected when the source is not an object.',
            this.xmlElementRange(element)
          );
        }
      } else {
        context[name] = content;
      }

      return true;
    }

    this.reportError('Invalid <let> element.', this.xmlElementRange(element));
    return true;
  };

  private handleAttribute = (
    attribute: XMLAttribute,
    context: { [key: string]: any }
  ): [string, any] | undefined => {
    if (!attribute.key || !attribute.value) {
      return;
    }
    if (attribute.key.toLowerCase() === 'for' || attribute.key.toLowerCase() === 'if') {
      return;
    }
    const key = hyphenToCamelCase(attribute.key);
    const value = this.handleText(attribute.value, context, this.xmlAttributeValueRange(attribute));
    if (value.length === 1) {
      return [key, value[0]];
    } else {
      return [key, value];
    }
  };

  private handleInclude = (
    element: XMLElement,
    context: { [key: string]: any }
  ): React.ReactElement | undefined => {
    if (element.name?.toLowerCase() !== 'include') {
      return undefined;
    }

    const src = xmlAttribute(element, 'src');
    if (!src || !src.value) {
      this.reportError('src attribute is expected.', this.xmlElementRange(element));
      return <></>;
    }

    const source = src.value;

    let text: string;
    try {
      text = readSource(
        source,
        this.sourcePath ? path.dirname(this.sourcePath) : undefined,
        'string'
      );
    } catch (e) {
      this.reportError(
        e !== undefined && (e as Error).message
          ? (e as Error).message
          : `Error reading source: ${source}`,
        this.xmlAttributeValueRange(src),
        e
      );
      return <></>;
    }

    const includePath =
      this.sourcePath && !path.isAbsolute(source)
        ? path.join(path.dirname(this.sourcePath), source)
        : source;

    const included = new PomlFile(text, this.config, includePath);
    const root = included.xmlRootElement();
    if (!root) {
      return <></>;
    }

    let contents: (XMLElement | XMLTextContent)[] = [];
    if (root.name?.toLowerCase() === 'poml') {
      contents = xmlElementContents(root);
    } else {
      contents = [root];
    }
    const resultNodes: any[] = [];

    contents.forEach((el, idx) => {
      if (el.type === 'XMLTextContent') {
        resultNodes.push(
          ...included
            .handleText(el.text ?? '', context, included.xmlElementRange(el))
            .map(v =>
              typeof v === 'object' && v !== null && !React.isValidElement(v)
                ? JSON.stringify(v)
                : v
            )
        );
      } else if (el.type === 'XMLElement') {
        const child = included.parseXmlElement(el as XMLElement, context, {});
        resultNodes.push(
          React.isValidElement(child) ? React.cloneElement(child, { key: `child-${idx}` }) : child
        );
      }
    });

    if (resultNodes.length === 1) {
      return <>{resultNodes[0]}</>;
    }
    return <>{resultNodes}</>;
  };

  private handleSchema = (element: XMLElement, context?: { [key: string]: any }): Schema | undefined => {
    let lang: 'json' | 'expr' | undefined = xmlAttribute(element, 'lang')?.value as any;
    const text = xmlElementText(element).trim();
    
    // Get the range for the text content (if available)
    const textRange = element.textContents.length > 0 
      ? this.xmlElementRange(element.textContents[0])
      : this.xmlElementRange(element);
    
    // Auto-detect language if not specified
    if (!lang) {
      if (text.startsWith('{')) {
        lang = 'json';
      } else {
        lang = 'expr';
      }
    } else if (lang !== 'json' && lang !== 'expr') {
      this.reportError(
        `Invalid lang attribute: ${lang}. Expected "json" or "expr"`,
        this.xmlAttributeValueRange(xmlAttribute(element, 'lang')!)
      );
      return undefined;
    }
    
    try {
      if (lang === 'json') {
        // Process template expressions in JSON text
        const processedText = this.handleText(text, context || {}, textRange);
        // handleText returns an array, join if all strings
        const jsonText = processedText.length === 1 && typeof processedText[0] === 'string'
          ? processedText[0]
          : processedText.map(p => typeof p === 'string' ? p : JSON.stringify(p)).join('');
        const jsonSchema = JSON.parse(jsonText);
        return Schema.fromOpenAPI(jsonSchema);
      } else if (lang === 'expr') {
        // Evaluate expression directly with z in context
        const contextWithZ = { z, ...context };
        const result = this.evaluateExpression(text, contextWithZ, textRange);
        
        // If evaluation failed, result will be empty string
        if (!result) {
          return undefined;
        }
        
        // Determine if result is a Zod schema or JSON schema
        if (result && typeof result === 'object' && result._def) {
          // It's a Zod schema
          return Schema.fromZod(result);
        } else {
          // Treat as JSON schema
          return Schema.fromOpenAPI(result);
        }
      }
    } catch (e) {
      this.reportError(
        e instanceof Error ? e.message : 'Error parsing schema',
        this.xmlElementRange(element),
        e
      );
    }
    return undefined;
  }

  private handleMeta = (element: XMLElement, context?: { [key: string]: any }): boolean => {
    if (element.name?.toLowerCase() !== 'meta') {
      return false;
    }
    const metaType = xmlAttribute(element, 'type')?.value;
    if (metaType === 'responseSchema') {
      if (this.responseSchema) {
        this.reportError(
          'Multiple responseSchema meta elements found. Only one is allowed.',
          this.xmlElementRange(element)
        );
        return true;
      }
      const schema = this.handleSchema(element, context);
      if (schema) {
        this.responseSchema = schema;
      }
      return true;
    }

    if (metaType === 'tool') {
      const name = xmlAttribute(element, 'name')?.value;
      if (!name) {
        this.reportError(
          'name attribute is required for tool meta type',
          this.xmlElementRange(element)
        );
        return true;
      }
      const description = xmlAttribute(element, 'description')?.value;
      const inputSchema = this.handleSchema(element, context);
      if (inputSchema) {
        if (!this.toolsSchema) {
          this.toolsSchema = new ToolsSchema();
        }
        try {
          this.toolsSchema.addTool(name, description || undefined, inputSchema);
        } catch (e) {
          this.reportError(
            e instanceof Error ? e.message : 'Error adding tool to tools schema',
            this.xmlElementRange(element),
            e
          );
        }
      }
      return true;
    }

    if (metaType === 'runtime') {
      // Extra runtime parameters sending to LLM.
      const runtimeParams: any = {};
      for (const attribute of element.attributes) {
        if (attribute.key && attribute.value && attribute.key?.toLowerCase() !== 'type') {
          runtimeParams[attribute.key] = attribute.value;
        }
      }
      this.runtimeParameters = runtimeParams;
      return true;
    }

    const minVersion = xmlAttribute(element, 'minVersion')?.value;
    if (minVersion && compareVersions(POML_VERSION, minVersion) < 0) {
      this.reportError(
        `POML version ${minVersion} or higher is required`,
        this.xmlAttributeValueRange(xmlAttribute(element, 'minVersion')!)
      );
    }
    const maxVersion = xmlAttribute(element, 'maxVersion')?.value;
    if (maxVersion && compareVersions(POML_VERSION, maxVersion) > 0) {
      this.reportError(
        `POML version ${maxVersion} or lower is required`,
        this.xmlAttributeValueRange(xmlAttribute(element, 'maxVersion')!)
      );
    }

    const comps = xmlAttribute(element, 'components')?.value;
    if (comps) {
      comps.split(/[,\s]+/).forEach(token => {
        token = token.trim();
        if (!token) {
          return;
        }
        const op = token[0];
        const name = token.slice(1).toLowerCase().trim();
        if (!name) {
          return;
        }
        if (op === '+') {
          this.disabledComponents.delete(name);
        } else if (op === '-') {
          this.disabledComponents.add(name);
        } else {
          this.reportError(
            `Invalid component operation: ${op}. Use + to enable or - to disable.`,
            this.xmlAttributeValueRange(xmlAttribute(element, 'components')!)
          );
        }
      });
    }
    return true;
  };

  private unescapeText = (text: string): string => {
    return text
      .replace(/#lt;/g, '<')
      .replace(/#gt;/g, '>')
      .replace(/#amp;/g, '&')
      .replace(/#quot;/g, '"')
      .replace(/#apos;/g, "'")
      .replace(/#hash;/g, '#')
      .replace(/#lbrace;/g, '{')
      .replace(/#rbrace;/g, '}');
  };

  private handleText = (text: string, context: { [key: string]: any }, position?: Range): any[] => {
    let curlyMatch;
    let replacedPrefixLength: number = 0;
    let results: any[] = [];
    const regex = /{{\s*(.+?)\s*}}(?!})/gm;

    while ((curlyMatch = regex.exec(text))) {
      const curlyExpression = curlyMatch[1];
      const value = this.evaluateExpression(
        curlyExpression,
        context,
        position
          ? {
            start: position.start + curlyMatch.index,
            end: position.start + curlyMatch.index + curlyMatch[0].length - 1
          }
          : undefined
      );
      if (this.config.trim && curlyMatch[0] === text.trim()) {
        return [value];
      }

      if (curlyMatch.index > replacedPrefixLength) {
        results.push(this.unescapeText(text.slice(replacedPrefixLength, curlyMatch.index)));
      }
      results.push(value);
      replacedPrefixLength = curlyMatch.index + curlyMatch[0].length;
    }

    if (text.length > replacedPrefixLength) {
      results.push(this.unescapeText(text.slice(replacedPrefixLength)));
    }

    if (results.length > 0 && results.every(r => typeof r === 'string' || typeof r === 'number')) {
      return [results.map(r => r.toString()).join('')];
    }

    return results;
  };

  private evaluateExpression(
    expression: string,
    context: { [key: string]: any },
    range?: Range,
    stripCurlyBrackets: boolean = false
  ) {
    try {
      if (stripCurlyBrackets) {
        const curlyMatch = expression.match(/^\s*{{\s*(.+?)\s*}}\s*$/m);
        if (curlyMatch) {
          expression = curlyMatch[1];
        }
      }
      const result = evalWithVariables(expression, context || {});
      if (range) {
        this.recordEvaluation(range, result);
      }
      return result;
    } catch (e) {
      const errMessage = e !== undefined && (e as Error).message
        ? (e as Error).message
        : `Error evaluating expression: ${expression}`;
      if (range) {
        this.recordEvaluation(range, errMessage);
      }
      this.reportError(errMessage, range, e);
      return '';
    }
  }

  /**
   * Parse the XML element and return the corresponding React element.
   *
   * @param element The element to be converted.
   * @param globalContext The context can be carried over when the function returns.
   * @param localContext The context that is only available in the current element and its children.
   */
  private parseXmlElement(
    element: XMLElement,
    globalContext: { [key: string]: any },
    localContext: { [key: string]: any }
  ): React.ReactElement {
    // Let. Always set the global.
    if (this.handleLet(element, globalContext)) {
      return <></>;
    }

    const tagName = element.name;
    if (!tagName) {
      // Probably already had an invalid syntax error.
      return <></>;
    }
    const isMeta = tagName.toLowerCase() === 'meta';
    const isInclude = tagName.toLowerCase() === 'include';

    // Common logic for handling for-loops
    const forLoops = this.handleForLoop(element, globalContext);
    const forLoopedContext = forLoops.length > 0 ? forLoops : [{}];
    const resultElements: React.ReactElement[] = [];

    for (let i = 0; i < forLoopedContext.length; i++) {
      const currentLocal = { ...localContext, ...forLoopedContext[i] };
      const context = { ...globalContext, ...currentLocal };

      // Common logic for handling if-conditions
      if (!this.handleIfCondition(element, context)) {
        continue;
      }
      // Common logic for handling meta elements
      if (isMeta && this.handleMeta(element, context)) {
        // If it's a meta element, we don't render anything.
        continue;
      }

      let elementToAdd: React.ReactElement | null = null;

      if (isInclude) {
        // Logic for <include> tags
        const included = this.handleInclude(element, context);
        if (included) {
          // Add a key if we are in a loop with multiple items
          if (forLoopedContext.length > 1) {
            elementToAdd = <React.Fragment key={`include-${i}`}>{included}</React.Fragment>;
          } else {
            elementToAdd = included;
          }
        }
      } else {
        // Logic for all other components
        const component = findComponentByAlias(tagName, this.disabledComponents);
        if (typeof component === 'string') {
          // Add a read error
          this.reportError(component, this.xmlOpenNameRange(element));
          // Return empty fragment to prevent rendering this element
          // You might want to 'continue' the loop as well.
          return <></>;
        }

        const attrib: any = element.attributes.reduce(
          (acc, attribute) => {
            const [key, value] = this.handleAttribute(attribute, context) || [null, null];
            if (key && value !== null) {
              acc[key] = value;
            }
            return acc;
          },
          {} as { [key: string]: any }
        );

        // Retain the position of current element for future diagnostics
        const range = this.xmlElementRange(element);
        attrib.originalStartIndex = range.start;
        attrib.originalEndIndex = range.end;

        // Add key attribute for react
        if (!attrib.key && forLoopedContext.length > 1) {
          attrib.key = `key-${i}`;
        }

        const contents = xmlElementContents(element).filter(el => {
          // Filter out stylesheet and context element in the root poml element
          if (
            tagName === 'poml' &&
            el.type === 'XMLElement' &&
            ['context', 'stylesheet'].includes((el as XMLElement).name?.toLowerCase() ?? '')
          ) {
            return false;
          } else {
            return true;
          }
        });

        const avoidObject = (el: any) => {
          if (typeof el === 'object' && el !== null && !React.isValidElement(el)) {
            return JSON.stringify(el);
          }
          return el;
        };

        const processedContents = contents.reduce((acc, el, i) => {
          if (el.type === 'XMLTextContent') {
            // const isFirst = i === 0,
            //   isLast = i === contents.length - 1;
            // const text = this.config.trim ? trimText(el.text || '', isFirst, isLast) : el.text || '';
            acc.push(
              ...this.handleText(
                el.text ?? '',
                { ...globalContext, ...currentLocal },
                this.xmlElementRange(el)
              ).map(avoidObject)
            );
          } else if (el.type === 'XMLElement') {
            acc.push(this.parseXmlElement(el, globalContext, currentLocal));
          }
          return acc;
        }, [] as any[]);

        elementToAdd = React.createElement(
          component.render.bind(component),
          attrib,
          ...processedContents
        );
      }
      if (elementToAdd) {
        // If we have an element to add, push it to the result elements.
        resultElements.push(elementToAdd);
      }
    }

    // Common logic for returning the final result
    if (resultElements.length === 1) {
      return resultElements[0];
    } else {
      // Cases where there are multiple elements or zero elements.
      return <>{resultElements}</>;
    }
  }

  private recoverPosition(position: number): number {
    return position + this.documentRange.start;
  }

  private ensureRange(position: number): number {
    return Math.max(Math.min(position, this.documentRange.end) - this.documentRange.start, 0);
  }

  private xmlElementRange(element: XMLElement | XMLTextContent | XMLAttribute): Range {
    return {
      start: this.ensureRange(element.position.startOffset),
      end: this.ensureRange(element.position.endOffset)
    };
  }

  private xmlOpenNameRange(element: XMLElement): Range {
    if (element.syntax.openName) {
      return {
        start: this.ensureRange(element.syntax.openName.startOffset),
        end: this.ensureRange(element.syntax.openName.endOffset)
      };
    } else {
      return this.xmlElementRange(element);
    }
  }

  private xmlCloseNameRange(element: XMLElement): Range {
    if (element.syntax.closeName) {
      return {
        start: this.ensureRange(element.syntax.closeName.startOffset),
        end: this.ensureRange(element.syntax.closeName.endOffset)
      };
    } else {
      return this.xmlElementRange(element);
    }
  }

  private xmlAttributeKeyRange(element: XMLAttribute): Range {
    if (element.syntax.key) {
      return {
        start: this.ensureRange(element.syntax.key.startOffset),
        end: this.ensureRange(element.syntax.key.endOffset)
      };
    } else {
      return this.xmlElementRange(element);
    }
  }

  private xmlAttributeValueRange(element: XMLAttribute): Range {
    if (element.syntax.value) {
      return {
        start: this.ensureRange(element.syntax.value.startOffset),
        end: this.ensureRange(element.syntax.value.endOffset)
      };
    } else {
      return this.xmlElementRange(element);
    }
  }

  private findTokenInElement(element: XMLElement, offset: number): PomlToken | undefined {
    if (element.name) {
      if (
        element.syntax.openName &&
        element.syntax.openName.startOffset <= offset &&
        offset <= element.syntax.openName.endOffset
      ) {
        return {
          type: 'element',
          range: this.xmlOpenNameRange(element),
          element: element.name
        };
      }
      if (
        element.syntax.closeName &&
        element.syntax.closeName.startOffset <= offset &&
        offset <= element.syntax.closeName.endOffset
      ) {
        return {
          type: 'element',
          range: this.xmlCloseNameRange(element),
          element: element.name
        };
      }
      for (const attrib of element.attributes) {
        if (
          attrib.key &&
          attrib.syntax.key &&
          attrib.syntax.key.startOffset <= offset &&
          offset <= attrib.syntax.key.endOffset
        ) {
          return {
            type: 'attribute',
            range: this.xmlAttributeKeyRange(attrib),
            element: element.name,
            attribute: attrib.key
          };
        }
      }
    }

    for (const child of element.subElements) {
      const result = this.findTokenInElement(child, offset);
      if (result) {
        return result;
      }
    }
  }

  private handleElementNameCompletion(offset: number) {
    return ({ element, prefix }: { element: XMLElement; prefix?: string }): PomlToken[] => {
      const candidates = this.findComponentWithPrefix(prefix, true);
      return candidates.map(candidate => {
        return {
          type: 'element',
          range: {
            start: this.ensureRange(offset - (prefix ? prefix.length : 0)),
            end: this.ensureRange(offset - 1)
          },
          element: candidate
        };
      });
    };
  }

  private handleElementNameCloseCompletion(offset: number) {
    return ({ element, prefix }: { element: XMLElement; prefix?: string }): PomlToken[] => {
      const candidates: string[] = [];
      const excludedComponents: string[] = [];
      if (element.name) {
        candidates.push(element.name);
        const component = findComponentByAliasOrUndefined(
          element.name,
          this.disabledComponents
        );
        if (component !== undefined) {
          excludedComponents.push(component.name);
        }
      }
      if (prefix) {
        candidates.push(...this.findComponentWithPrefix(prefix, true, excludedComponents));
      }
      return candidates.map(candidate => {
        return {
          type: 'element',
          range: {
            start: this.ensureRange(offset - (prefix ? prefix.length : 0)),
            end: this.ensureRange(offset - 1)
          },
          element: candidate
        };
      });
    };
  }

  private handleAttributeNameCompletion(offset: number) {
    return ({
      element,
      prefix
    }: {
      element: XMLElement;
      attribute?: XMLAttribute;
      prefix?: string;
    }): PomlToken[] => {
      if (!element.name) {
        return [];
      }
      const component = findComponentByAliasOrUndefined(
        element.name,
        this.disabledComponents
      );
      const parameters = component?.parameters();
      if (!component || !parameters) {
        return [];
      }
      const candidates: PomlToken[] = [];
      for (const parameter of parameters) {
        if (parameter.name.toLowerCase().startsWith(prefix?.toLowerCase() ?? '')) {
          candidates.push({
            type: 'attribute',
            range: {
              start: this.ensureRange(offset - (prefix ? prefix.length : 0)),
              end: this.ensureRange(offset - 1)
            },
            element: component.name,
            attribute: parameter.name
          });
        }
      }
      return candidates;
    };
  }

  private handleAttributeValueCompletion(offset: number) {
    return ({
      element,
      attribute,
      prefix
    }: {
      element: XMLElement;
      attribute: XMLAttribute;
      prefix?: string;
    }): PomlToken[] => {
      if (!element.name) {
        return [];
      }
      const component = findComponentByAliasOrUndefined(
        element.name,
        this.disabledComponents
      );
      const parameters = component?.parameters();
      if (!component || !parameters) {
        return [];
      }
      const candidates: PomlToken[] = [];
      for (const parameter of parameters) {
        if (parameter.name.toLowerCase() === attribute.key?.toLowerCase()) {
          for (const choice of parameter.choices) {
            if (choice.toLowerCase().startsWith(prefix?.toLowerCase() ?? '')) {
              candidates.push({
                type: 'attributeValue',
                range: {
                  start: this.ensureRange(offset - (prefix ? prefix.length : 0)),
                  end: this.ensureRange(offset - 1)
                },
                element: component.name,
                attribute: parameter.name,
                value: choice
              });
            }
          }
        }
      }
      return candidates;
    };
  }

  private findComponentWithPrefix(
    prefix: string | undefined,
    publicOnly: boolean,
    excludedComponents?: string[]
  ): string[] {
    const candidates: string[] = [];
    for (const component of listComponents()) {
      if (publicOnly && !component.isPublic()) {
        continue;
      }
      if (excludedComponents && excludedComponents.includes(component.name)) {
        continue;
      }
      let nameMatch: string | undefined = undefined;
      if (!prefix || component.name.toLowerCase().startsWith(prefix.toLowerCase())) {
        nameMatch = component.name;
      } else {
        const candidates: string[] = [];
        for (const alias of component.getAliases()) {
          if (alias.toLowerCase().startsWith(prefix.toLowerCase())) {
            candidates.push(alias);
            // One component can have at most one alias match.
            break;
          }
        }
        // Match hyphen case.
        for (const alias of component.getAliases(false)) {
          const aliasHyphen = camelToHyphenCase(alias);
          if (aliasHyphen.startsWith(prefix.toLowerCase())) {
            candidates.push(aliasHyphen);
            break;
          }
        }

        // Try to see if there is a match in the exact case.
        for (const candidate of candidates) {
          if (candidate.startsWith(prefix)) {
            nameMatch = candidate;
            break;
          }
        }
        if (!nameMatch && candidates) {
          nameMatch = candidates[0];
        }
      }
      if (nameMatch) {
        candidates.push(nameMatch);
      }
    }
    return candidates;
  }
}

/**
 * XML utility functions.
 */
const evalWithVariables = (text: string, context: { [key: string]: any }): any => {
  const variableNames = Object.keys(context);
  const variableValues = Object.values(context);
  const fn = new Function(...variableNames, `return ${text}`);
  return fn(...variableValues);
};

const hyphenToCamelCase = (text: string): string => {
  return text.replace(/-([a-z])/g, g => g[1].toUpperCase());
};

const camelToHyphenCase = (text: string): string => {
  return text.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
};

/**
 * Compares two version strings supporting semantic versioning with nightly/dev suffixes.
 * Supports formats: "x.y.z", "x.y.z-nightly.timestamp", "x.y.z.devtimestamp"
 * 
 * @param a - The first version string.
 * @param b - The second version string.
 * @returns -1 if `a` is less than `b`, 1 if `a` is greater than `b`, and 0 if they are equal.
 */
const compareVersions = (a: string, b: string): number => {
  const parseVersion = (version: string) => {
    // Handle nightly versions: "1.2.3-nightly.202508120345"
    const nightlyMatch = version.match(/^(\d+\.\d+\.\d+)-nightly\.(\d+)$/);
    if (nightlyMatch) {
      const [, baseVersion, timestamp] = nightlyMatch;
      const parts = baseVersion.split('.').map(n => parseInt(n, 10));
      return { parts, isPrerelease: true, timestamp: parseInt(timestamp, 10) };
    }

    // Handle regular semantic versions: "1.2.3"
    const parts = version.split('.').map(n => parseInt(n, 10));
    return { parts, isPrerelease: false, timestamp: 0 };
  };

  const versionA = parseVersion(a);
  const versionB = parseVersion(b);

  // Compare base version parts first
  for (let i = 0; i < Math.max(versionA.parts.length, versionB.parts.length); i++) {
    const na = versionA.parts[i] || 0;
    const nb = versionB.parts[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }

  // If base versions are equal, handle prerelease comparison
  if (versionA.isPrerelease && !versionB.isPrerelease) {
    return -1; // Prerelease is less than release
  }
  if (!versionA.isPrerelease && versionB.isPrerelease) {
    return 1; // Release is greater than prerelease
  }
  if (versionA.isPrerelease && versionB.isPrerelease) {
    // Both are prereleases, compare timestamps
    if (versionA.timestamp > versionB.timestamp) return 1;
    if (versionA.timestamp < versionB.timestamp) return -1;
  }

  return 0;
};

const xmlAttribute = (element: XMLElement, key: string): XMLAttribute | undefined => {
  return element.attributes.find(attr => attr.key?.toLowerCase() === key.toLowerCase());
};

const xmlElementContents = (element: XMLElement): (XMLElement | XMLTextContent)[] => {
  return [...element.subElements, ...element.textContents].sort(
    (i, j) => i.position.startOffset - j.position.startOffset
  );
};

const xmlElementText = (element: XMLElement): string => {
  return element.textContents.map(content => content.text || '').join(' ');
};
