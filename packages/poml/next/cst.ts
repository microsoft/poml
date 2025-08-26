import { IToken } from 'chevrotain';
import {
  extendedPomlLexer,
  TemplateOpen,
  TemplateClose,
  TagClosingOpen,
  TagSelfClose,
  TagOpen,
  TagClose,
  Equals,
  DoubleQuote,
  SingleQuote,
  Identifier,
  Whitespace,
  TextContent,
} from './lexer';

import { listComponentAliases } from '../base';
import * as Nodes from './nodes';

// Context for parsing configuration
export interface PomlContext {
  variables: { [key: string]: any };
  stylesheet: { [key: string]: string };
  minPomlVersion?: string;
  maxPomlVersion?: string;
  sourcePath: string;
  enabledComponents: Set<string>;
  unknownComponentBehavior: 'error' | 'warning' | 'ignore';
}

// CST Parser class
export class CSTParser {
  private tokens: IToken[];
  private position: number;
  private text: string;
  private context: PomlContext;
  private nodeIdCounter: number;

  // These are the tags that are always valid in POML.
  // You can not disable them.
  private alwaysValidTags = new Set<string>(['text', 'meta']);

  // These semantics are handled right here.
  private nonComponentTags = new Set<string>([
    'let',
    'include',
    'template',
    'context',
    'stylesheet',
    'output-schema',
    'outputschema',
    'tool',
    'tool-def',
    'tool-definition',
    'tooldef',
    'tooldefinition',
  ]);

  constructor(context: PomlContext) {
    this.tokens = [];
    this.position = 0;
    this.text = '';
    this.context = context;
    this.nodeIdCounter = 0;

    // Initialize default enabled components (can be extended/disabled via meta tags)
    this.context.enabledComponents = new Set(listComponentAliases());
    this.context.unknownComponentBehavior = 'warning';
  }

  private generateId(): string {
    return `node_${++this.nodeIdCounter}`;
  }

  private currentToken(): IToken | undefined {
    return this.tokens[this.position];
  }

  private peekToken(offset: number = 1): IToken | undefined {
    return this.tokens[this.position + offset];
  }

  private consumeToken(): IToken | undefined {
    if (this.position < this.tokens.length) {
      return this.tokens[this.position++];
    }
    return undefined;
  }

  private skipWhitespace(): void {
    while (this.currentToken()?.tokenType === Whitespace) {
      this.position++;
    }
  }

  public parse(text: string): ASTNode {
    this.text = text;
    const lexResult = extendedPomlLexer.tokenize(text);
    this.tokens = lexResult.tokens;
    this.position = 0;

    const rootNode: ASTNode = {
      id: this.generateId(),
      kind: 'TEXT',
      start: 0,
      end: text.length,
      content: text,
      children: [],
      textSegments: [],
    };

    this.parseDocument(rootNode);
    return rootNode;
  }

  private parseDocument(rootNode: ASTNode): void {
    while (this.position < this.tokens.length) {
      const token = this.currentToken();
      if (!token) {
        break;
      }

      if (token.tokenType === TagOpen) {
        const nextToken = this.peekToken();
        if (nextToken?.tokenType === Identifier) {
          const tagName = nextToken.image;

          if (tagName === 'meta') {
            const metaNode = this.parseMetaTag();
            if (metaNode) {
              rootNode.children.push(metaNode);
              metaNode.parent = rootNode;
              this.processMeta(metaNode);
            }
          } else if (this.context.enabledComponents.has(tagName)) {
            const pomlNode = this.parsePomlElement();
            if (pomlNode) {
              rootNode.children.push(pomlNode);
              pomlNode.parent = rootNode;
            }
          } else {
            // Unknown tag - treat as text
            this.handleUnknownTag(tagName);
            const textNode = this.parseTextContent();
            if (textNode) {
              rootNode.children.push(textNode);
              textNode.parent = rootNode;
            }
          }
        } else {
          // Malformed tag - treat as text
          const textNode = this.parseTextContent();
          if (textNode) {
            rootNode.children.push(textNode);
            textNode.parent = rootNode;
          }
        }
      } else {
        const textNode = this.parseTextContent();
        if (textNode) {
          rootNode.children.push(textNode);
          textNode.parent = rootNode;
        }
      }
    }
  }

  private parseMetaTag(): ASTNode | null {
    const startPos = this.position;
    const openTagStart = this.currentToken()?.startOffset || 0;

    this.consumeToken(); // consume '<'
    this.skipWhitespace();

    const nameToken = this.consumeToken(); // consume 'meta'
    if (!nameToken || nameToken.image !== 'meta') {
      return null;
    }

    const nameRange: SourceRange = {
      start: nameToken.startOffset || 0,
      end: (nameToken.endOffset || 0) + 1,
    };

    this.skipWhitespace();

    const attributes = this.parseAttributes();

    this.skipWhitespace();

    // Check for self-closing or regular closing
    const closeToken = this.currentToken();
    let openTagEnd = 0;
    let hasContent = false;

    if (closeToken?.tokenType === TagSelfClose) {
      this.consumeToken(); // consume '/>'
      openTagEnd = (closeToken.endOffset || 0) + 1;
    } else if (closeToken?.tokenType === TagClose) {
      this.consumeToken(); // consume '>'
      openTagEnd = (closeToken.endOffset || 0) + 1;
      hasContent = true;
    }

    const metaNode: ASTNode = {
      id: this.generateId(),
      kind: 'META',
      start: openTagStart,
      end: openTagEnd, // Will be updated if there's content
      content: '',
      children: [],
      tagName: 'meta',
      attributes,
      openingTag: {
        start: openTagStart,
        end: openTagEnd,
        nameRange,
      },
    };

    if (hasContent) {
      // Parse content until closing tag
      while (this.position < this.tokens.length) {
        const token = this.currentToken();
        if (token?.tokenType === TagClosingOpen) {
          const nextToken = this.peekToken();
          if (nextToken?.tokenType === Identifier && nextToken.image === 'meta') {
            break;
          }
        }
        this.position++;
      }

      // Parse closing tag
      if (this.currentToken()?.tokenType === TagClosingOpen) {
        const closingTagStart = this.currentToken()?.startOffset || 0;
        this.consumeToken(); // consume '</'
        const closingNameToken = this.consumeToken(); // consume 'meta'
        this.skipWhitespace();
        const finalClose = this.consumeToken(); // consume '>'

        if (closingNameToken && finalClose) {
          metaNode.closingTag = {
            start: closingTagStart,
            end: (finalClose.endOffset || 0) + 1,
            nameRange: {
              start: closingNameToken.startOffset || 0,
              end: (closingNameToken.endOffset || 0) + 1,
            },
          };
          metaNode.end = (finalClose.endOffset || 0) + 1;
        }
      }
    }

    metaNode.content = this.text.slice(metaNode.start, metaNode.end);
    return metaNode;
  }

  private parsePomlElement(): ASTNode | null {
    const openTagStart = this.currentToken()?.startOffset || 0;

    this.consumeToken(); // consume '<'
    this.skipWhitespace();

    const nameToken = this.consumeToken();
    if (!nameToken) {
      return null;
    }

    const tagName = nameToken.image;
    const nameRange: SourceRange = {
      start: nameToken.startOffset || 0,
      end: (nameToken.endOffset || 0) + 1,
    };

    this.skipWhitespace();

    const attributes = this.parseAttributes();

    this.skipWhitespace();

    // Check for self-closing or regular closing
    const closeToken = this.currentToken();
    let openTagEnd = 0;
    let hasContent = false;

    if (closeToken?.tokenType === TagSelfClose) {
      this.consumeToken(); // consume '/>'
      openTagEnd = (closeToken.endOffset || 0) + 1;
    } else if (closeToken?.tokenType === TagClose) {
      this.consumeToken(); // consume '>'
      openTagEnd = (closeToken.endOffset || 0) + 1;
      hasContent = true;
    }

    const pomlNode: ASTNode = {
      id: this.generateId(),
      kind: 'POML',
      start: openTagStart,
      end: openTagEnd, // Will be updated if there's content
      content: '',
      children: [],
      tagName,
      attributes,
      openingTag: {
        start: openTagStart,
        end: openTagEnd,
        nameRange,
      },
    };

    if (hasContent) {
      if (tagName === 'text') {
        // Special handling for <text> tags - parse content as pure text
        this.parseTextContentForTextTag(pomlNode);
      } else {
        // Parse mixed content (POML and text)
        this.parseMixedContent(pomlNode);
      }

      // Parse closing tag
      if (this.currentToken()?.tokenType === TagClosingOpen) {
        const closingTagStart = this.currentToken()?.startOffset || 0;
        this.consumeToken(); // consume '</'
        const closingNameToken = this.consumeToken();
        this.skipWhitespace();
        const finalClose = this.consumeToken(); // consume '>'

        if (closingNameToken && finalClose) {
          pomlNode.closingTag = {
            start: closingTagStart,
            end: (finalClose.endOffset || 0) + 1,
            nameRange: {
              start: closingNameToken.startOffset || 0,
              end: (closingNameToken.endOffset || 0) + 1,
            },
          };
          pomlNode.end = (finalClose.endOffset || 0) + 1;
        }
      }
    }

    pomlNode.content = this.text.slice(pomlNode.start, pomlNode.end);
    return pomlNode;
  }

  private parseTextContentForTextTag(parentNode: ASTNode): void {
    // In <text> tags, we parse content as pure text but still need to handle nested POML
    while (this.position < this.tokens.length) {
      const token = this.currentToken();
      if (!token) {
        break;
      }

      if (token.tokenType === TagClosingOpen) {
        const nextToken = this.peekToken();
        if (nextToken?.tokenType === Identifier && nextToken.image === parentNode.tagName) {
          break; // Found closing tag
        }
      }

      if (token.tokenType === TagOpen) {
        const nextToken = this.peekToken();
        if (nextToken?.tokenType === Identifier && this.context.enabledComponents.has(nextToken.image)) {
          // Found nested POML element
          const nestedNode = this.parsePomlElement();
          if (nestedNode) {
            parentNode.children.push(nestedNode);
            nestedNode.parent = parentNode;
          }
        } else {
          // Treat as text
          const textNode = this.parseTextContent();
          if (textNode) {
            parentNode.children.push(textNode);
            textNode.parent = parentNode;
          }
        }
      } else {
        const textNode = this.parseTextContent();
        if (textNode) {
          parentNode.children.push(textNode);
          textNode.parent = parentNode;
        }
      }
    }
  }

  private parseMixedContent(parentNode: ASTNode): void {
    while (this.position < this.tokens.length) {
      const token = this.currentToken();
      if (!token) {
        break;
      }

      if (token.tokenType === TagClosingOpen) {
        const nextToken = this.peekToken();
        if (nextToken?.tokenType === Identifier && nextToken.image === parentNode.tagName) {
          break; // Found closing tag
        }
      }

      if (token.tokenType === TagOpen) {
        const nextToken = this.peekToken();
        if (nextToken?.tokenType === Identifier && this.context.enabledComponents.has(nextToken.image)) {
          // Found nested POML element
          const nestedNode = this.parsePomlElement();
          if (nestedNode) {
            parentNode.children.push(nestedNode);
            nestedNode.parent = parentNode;
          }
        } else {
          // Unknown tag or malformed - treat as text
          const textNode = this.parseTextContent();
          if (textNode) {
            parentNode.children.push(textNode);
            textNode.parent = parentNode;
          }
        }
      } else if (token.tokenType === TemplateOpen) {
        // Parse template expression
        const templateNode = this.parseTemplate();
        if (templateNode) {
          parentNode.children.push(templateNode);
          templateNode.parent = parentNode;
        }
      } else {
        const textNode = this.parseTextContent();
        if (textNode) {
          parentNode.children.push(textNode);
          textNode.parent = parentNode;
        }
      }
    }
  }

  private parseTextContent(): ASTNode | null {
    const startOffset = this.currentToken()?.startOffset || 0;
    let endOffset = startOffset;

    // Collect consecutive text tokens
    while (this.position < this.tokens.length) {
      const token = this.currentToken();
      if (!token) {
        break;
      }

      if (token.tokenType === TextContent || token.tokenType === Whitespace) {
        endOffset = (token.endOffset || 0) + 1;
        this.position++;
      } else if (
        token.tokenType === TagOpen ||
        token.tokenType === TemplateOpen ||
        token.tokenType === TagClosingOpen
      ) {
        break;
      } else {
        // Other tokens treated as text in this context
        endOffset = (token.endOffset || 0) + 1;
        this.position++;
      }
    }

    if (endOffset === startOffset) {
      return null;
    }

    const textNode: ASTNode = {
      id: this.generateId(),
      kind: 'TEXT',
      start: startOffset,
      end: endOffset,
      content: this.text.slice(startOffset, endOffset),
      children: [],
      textSegments: [{ start: startOffset, end: endOffset }],
    };

    return textNode;
  }

  private parseTemplate(): ASTNode | null {
    const startToken = this.currentToken();
    if (!startToken || startToken.tokenType !== TemplateOpen) {
      return null;
    }

    const startOffset = startToken.startOffset || 0;
    this.consumeToken(); // consume '{{'

    let expression = '';
    let endOffset = startOffset + 2;

    // Collect content until TemplateClose
    while (this.position < this.tokens.length) {
      const token = this.currentToken();
      if (!token) {
        break;
      }

      if (token.tokenType === TemplateClose) {
        endOffset = (token.endOffset || 0) + 1;
        this.consumeToken();
        break;
      } else {
        expression += token.image;
        endOffset = (token.endOffset || 0) + 1;
        this.consumeToken();
      }
    }

    const templateNode: ASTNode = {
      id: this.generateId(),
      kind: 'TEMPLATE',
      start: startOffset,
      end: endOffset,
      content: this.text.slice(startOffset, endOffset),
      children: [],
      expression: expression.trim(),
    };

    return templateNode;
  }

  private parseAttributes(): AttributeInfo[] {
    const attributes: AttributeInfo[] = [];

    while (this.position < this.tokens.length) {
      this.skipWhitespace();

      const token = this.currentToken();
      if (!token || token.tokenType !== Identifier) {
        break;
      }

      const keyToken = this.consumeToken()!;
      const keyRange: SourceRange = {
        start: keyToken.startOffset || 0,
        end: (keyToken.endOffset || 0) + 1,
      };

      this.skipWhitespace();

      if (this.currentToken()?.tokenType !== Equals) {
        // Boolean attribute
        attributes.push({
          key: keyToken.image,
          value: [
            {
              id: this.generateId(),
              kind: 'TEXT',
              start: keyRange.start,
              end: keyRange.end,
              content: 'true',
              children: [],
            },
          ],
          keyRange,
          valueRange: keyRange,
          fullRange: keyRange,
        });
        continue;
      }

      this.consumeToken(); // consume '='
      this.skipWhitespace();

      const quoteToken = this.currentToken();
      if (!quoteToken || (quoteToken.tokenType !== DoubleQuote && quoteToken.tokenType !== SingleQuote)) {
        break; // Invalid attribute
      }

      const isDoubleQuote = quoteToken.tokenType === DoubleQuote;
      const valueStart = (quoteToken.endOffset || 0) + 1;
      this.consumeToken(); // consume opening quote

      const valueNodes: (ASTNode & { kind: 'TEXT' | 'TEMPLATE' })[] = [];
      let valueEnd = valueStart;

      // Parse attribute value content
      while (this.position < this.tokens.length) {
        const token = this.currentToken();
        if (!token) {
          break;
        }

        if ((isDoubleQuote && token.tokenType === DoubleQuote) || (!isDoubleQuote && token.tokenType === SingleQuote)) {
          valueEnd = token.startOffset || valueEnd;
          this.consumeToken(); // consume closing quote
          break;
        } else if (token.tokenType === TemplateOpen) {
          const templateNode = this.parseTemplate();
          if (templateNode && (templateNode.kind === 'TEXT' || templateNode.kind === 'TEMPLATE')) {
            valueNodes.push(templateNode as ASTNode & { kind: 'TEXT' | 'TEMPLATE' });
          }
        } else {
          // Collect text content
          const textStart = token.startOffset || 0;
          let textEnd = (token.endOffset || 0) + 1;
          let textContent = token.image;

          this.consumeToken();

          // Collect more text tokens
          while (this.position < this.tokens.length) {
            const nextToken = this.currentToken();
            if (!nextToken) {
              break;
            }

            if (
              (isDoubleQuote && nextToken.tokenType === DoubleQuote) ||
              (!isDoubleQuote && nextToken.tokenType === SingleQuote) ||
              nextToken.tokenType === TemplateOpen
            ) {
              break;
            }

            textContent += nextToken.image;
            textEnd = (nextToken.endOffset || 0) + 1;
            this.consumeToken();
          }

          valueNodes.push({
            id: this.generateId(),
            kind: 'TEXT',
            start: textStart,
            end: textEnd,
            content: textContent,
            children: [],
          });
        }
      }

      const valueRange: SourceRange = { start: valueStart, end: valueEnd };
      const fullRange: SourceRange = {
        start: keyRange.start,
        end: (this.tokens[this.position - 1]?.endOffset || 0) + 1,
      };

      attributes.push({
        key: keyToken.image,
        value: valueNodes,
        keyRange,
        valueRange,
        fullRange,
      });
    }

    return attributes;
  }

  private processMeta(metaNode: ASTNode): void {
    if (!metaNode.attributes) {
      return;
    }

    for (const attr of metaNode.attributes) {
      switch (attr.key) {
        case 'components':
          this.processComponentsAttribute(attr.value);
          break;
        case 'unknownComponents':
          const behavior = attr.value[0]?.content; // eslint-disable-line
          if (behavior === 'error' || behavior === 'warning' || behavior === 'ignore') {
            this.context.unknownComponentBehavior = behavior;
          }
          break;
        case 'minimalPomlVersion':
          this.context.minimalPomlVersion = attr.value[0]?.content;
          break;
        // Add other meta attributes as needed
      }
    }
  }

  private processComponentsAttribute(value: (ASTNode & { kind: 'TEXT' | 'TEMPLATE' })[]): void {
    const components = value[0]?.content || '';
    const parts = components.split(',').map((s) => s.trim());

    for (const part of parts) {
      if (part.startsWith('+')) {
        this.context.enabledComponents.add(part.slice(1));
      } else if (part.startsWith('-')) {
        this.context.enabledComponents.delete(part.slice(1));
      }
    }
  }

  private handleUnknownTag(tagName: string): void {
    switch (this.context.unknownComponentBehavior) {
      case 'error':
        throw new Error(`Unknown POML component: ${tagName}`);
      case 'warning':
        console.warn(`Unknown POML component: ${tagName}`);
        break;
      case 'ignore':
        // Do nothing
        break;
    }
  }
}

// Export function to create and use the parser
export function parseExtendedPoml(text: string, context: Partial<PomlContext> = {}): ASTNode {
  const fullContext: PomlContext = {
    variables: {},
    stylesheet: {},
    sourcePath: '',
    enabledComponents: new Set(),
    unknownComponentBehavior: 'warning',
    ...context,
  };

  const parser = new CSTParser(fullContext);
  return parser.parse(text);
}
