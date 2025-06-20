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
import path from 'path';

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
  type: 'element' | 'attribute' | 'attributeValue';
  range: Range;
  element: string;
  attribute?: string; // specified only if it's an attribute
  value?: string; // specified only if it's an attribute value
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

  constructor(text: string, options?: PomlReaderOptions, sourcePath?: string) {
    this.config = {
      trim: options?.trim ?? true,
      autoAddPoml: options?.autoAddPoml ?? true,
      crlfToLf: options?.crlfToLf ?? true
    };
    this.text = this.config.crlfToLf ? text.replace(/\r\n/g, '\n') : text;
    this.sourcePath = sourcePath;

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
          React.isValidElement(child)
            ? React.cloneElement(child, { key: `child-${idx}` })
            : child
        );
      }
    });

    if (resultNodes.length === 1) {
      return <>{resultNodes[0]}</>;
    }
    return <>{resultNodes}</>;
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
      .replace(/#rbrace;/g, '}')
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
      return evalWithVariables(expression, context || {});
    } catch (e) {
      this.reportError(
        e !== undefined && (e as Error).message
          ? (e as Error).message
          : `Error evaluating expression: ${expression}`,
        range,
        e
      );
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

    if (tagName.toLowerCase() === 'include') {
      const forLoops = this.handleForLoop(element, globalContext);
      const forLoopedContext = forLoops.length > 0 ? forLoops : [{}];
      const resultElements: React.ReactElement[] = [];
      for (let i = 0; i < forLoopedContext.length; i++) {
        const currentLocal = { ...localContext, ...forLoopedContext[i] };
        const context = { ...globalContext, ...currentLocal };
        if (!this.handleIfCondition(element, context)) {
          continue;
        }
        const included = this.handleInclude(element, context);
        if (included) {
          if (forLoopedContext.length > 1) {
            resultElements.push(
              <React.Fragment key={`key-${i}`}>{included}</React.Fragment>
            );
          } else {
            resultElements.push(included);
          }
        }
      }
      return resultElements.length === 1 ? resultElements[0] : <>{resultElements}</>;
    }

    const component = findComponentByAlias(tagName);
    if (typeof component === 'string') {
      // Add a read error
      this.reportError(component, this.xmlOpenNameRange(element));
      return <></>;
    }

    // For loop
    const forLoops = this.handleForLoop(element, globalContext);
    const forLoopedContext = forLoops.length > 0 ? forLoops : [{}];
    const resultElements: React.ReactElement[] = [];

    for (let i = 0; i < forLoopedContext.length; i++) {
      const currentLocal = { ...localContext, ...forLoopedContext[i] };
      const context = { ...globalContext, ...currentLocal };

      // If condition
      if (!this.handleIfCondition(element, context)) {
        continue;
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
      attrib.sourcePath = this.sourcePath;

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

      resultElements.push(
        React.createElement(component.render.bind(component), attrib, ...processedContents)
      );
    }

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
        const component = findComponentByAliasOrUndefined(element.name);
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
      const component = findComponentByAliasOrUndefined(element.name);
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
      const component = findComponentByAliasOrUndefined(element.name);
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
