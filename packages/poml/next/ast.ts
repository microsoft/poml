import { Tokenizer, Token } from './tokenizer';
import componentDocs from '../assets/componentDocs.json';

// Source position and attribute interfaces
export interface SourceRange {
  start: number;
  end: number;
}

export interface AttributeInfo {
  key: string;
  value: (ASTNode & { kind: 'TEXT' | 'TEMPLATE' })[]; // Mixed content: array of text/template nodes
  keyRange: SourceRange; // Position of attribute name
  valueRange: SourceRange; // Position of attribute value (excluding quotes)
  fullRange: SourceRange; // Full attribute including key="value"
}

// Main AST node interface
export interface ASTNode {
  id: string; // Unique ID for caching and React keys
  kind: 'META' | 'TEXT' | 'POML' | 'TEMPLATE';
  start: number; // Source position start of entire node
  end: number; // Source position end of entire node
  content: string; // The raw string content
  parent?: ASTNode; // Reference to the parent node
  children: ASTNode[]; // Child nodes

  // For POML and META nodes
  tagName?: string; // Tag name (e.g., 'task', 'meta')
  attributes?: AttributeInfo[]; // Detailed attribute information

  // Detailed source positions
  openingTag?: {
    start: number; // Position of '<'
    end: number; // Position after '>'
    nameRange: SourceRange; // Position of tag name
  };

  closingTag?: {
    start: number; // Position of '</'
    end: number; // Position after '>'
    nameRange: SourceRange; // Position of tag name in closing tag
  };

  contentRange?: SourceRange; // Position of content between tags (excluding nested tags)

  // For TEXT nodes
  textSegments?: SourceRange[]; // Multiple ranges for text content (excluding nested POML)

  // For TEMPLATE nodes
  expression?: string; // The full expression content between {{}}
}

// AST Parser class
class ASTParser {
  private tokens: Token[];
  private position: number;
  private nextId: number;
  private validPomlTags: Set<string>;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
    this.position = 0;
    this.nextId = 0;
    this.validPomlTags = this.buildValidTagsSet();
  }

  private buildValidTagsSet(): Set<string> {
    const validTags = new Set<string>();

    for (const doc of componentDocs) {
      if (doc.name) {
        validTags.add(doc.name.toLowerCase());
        // Convert camelCase to kebab-case
        validTags.add(
          doc.name
            .toLowerCase()
            .replace(/([A-Z])/g, '-$1')
            .toLowerCase(),
        );
      }
    }

    // Add special tags
    validTags.add('poml');
    validTags.add('text');
    validTags.add('meta');

    return validTags;
  }

  private generateId(): string {
    return `ast_${this.nextId++}`;
  }

  private peek(): Token | undefined {
    return this.tokens[this.position];
  }

  private advance(): Token | undefined {
    return this.tokens[this.position++];
  }

  private extractTagName(tagContent: string): string {
    // Remove < and > and any attributes
    const content = tagContent.slice(1, -1);
    const match = content.match(/^\/?\s*([a-zA-Z][\w-]*)/);
    return match ? match[1] : '';
  }

  private parseAttributeValue(value: string): (ASTNode & { kind: 'TEXT' | 'TEMPLATE' })[] {
    // Parse attribute value for mixed text and template variables
    const result: (ASTNode & { kind: 'TEXT' | 'TEMPLATE' })[] = [];
    let currentPos = 0;

    while (currentPos < value.length) {
      const templateStart = value.indexOf('{{', currentPos);

      if (templateStart === -1) {
        // No more template variables, add remaining text
        if (currentPos < value.length) {
          result.push({
            id: this.generateId(),
            kind: 'TEXT',
            start: currentPos,
            end: value.length,
            content: value.substring(currentPos),
            children: [],
          });
        }
        break;
      }

      // Add text before template variable
      if (templateStart > currentPos) {
        result.push({
          id: this.generateId(),
          kind: 'TEXT',
          start: currentPos,
          end: templateStart,
          content: value.substring(currentPos, templateStart),
          children: [],
        });
      }

      // Find end of template variable
      const templateEnd = value.indexOf('}}', templateStart + 2);
      if (templateEnd === -1) {
        // Malformed template, treat as text
        result.push({
          id: this.generateId(),
          kind: 'TEXT',
          start: templateStart,
          end: value.length,
          content: value.substring(templateStart),
          children: [],
        });
        break;
      }

      // Add template variable
      const templateContent = value.substring(templateStart + 2, templateEnd);
      result.push({
        id: this.generateId(),
        kind: 'TEMPLATE',
        start: templateStart,
        end: templateEnd + 2,
        content: value.substring(templateStart, templateEnd + 2),
        expression: templateContent.trim(),
        children: [],
      });

      currentPos = templateEnd + 2;
    }

    return result;
  }

  private parseAttributes(tagContent: string): AttributeInfo[] {
    const attributes: AttributeInfo[] = [];

    // Simple attribute parsing - can be enhanced later
    const attrRegex = /(\w+)=["']([^"']*?)["']/g;
    let match;

    while ((match = attrRegex.exec(tagContent)) !== null) {
      const key = match[1];
      const value = match[2];
      const fullMatch = match[0];
      const matchStart = match.index;

      attributes.push({
        key,
        value: this.parseAttributeValue(value),
        keyRange: { start: matchStart, end: matchStart + key.length },
        valueRange: { start: matchStart + key.length + 2, end: matchStart + key.length + 2 + value.length },
        fullRange: { start: matchStart, end: matchStart + fullMatch.length },
      });
    }

    return attributes;
  }

  parse(): ASTNode {
    const children = this.parseNodes();

    if (children.length === 1 && children[0].kind === 'POML') {
      return children[0];
    }

    // Create root text node
    const rootNode: ASTNode = {
      id: this.generateId(),
      kind: 'TEXT',
      start: 0,
      end: this.tokens.length > 0 ? this.tokens[this.tokens.length - 1].end : 0,
      content: this.tokens.map((t) => t.value).join(''),
      children,
      textSegments: [],
    };

    // Set parent references
    children.forEach((child) => {
      child.parent = rootNode;
    });

    return rootNode;
  }

  private parseNodes(): ASTNode[] {
    const nodes: ASTNode[] = [];

    while (this.position < this.tokens.length) {
      const token = this.peek();
      if (!token) break;

      if (token.type === 'TEMPLATE_VAR') {
        nodes.push(this.parseTemplateVariable());
      } else if (token.type === 'TAG_OPEN') {
        const tagName = this.extractTagName(token.value);

        if (this.validPomlTags.has(tagName.toLowerCase())) {
          const node = this.parsePomlNode();
          if (node) {
            nodes.push(node);
          }
        } else {
          // Invalid tag, treat as text
          nodes.push(this.parseTextFromToken());
        }
      } else if (token.type === 'TEXT') {
        nodes.push(this.parseTextFromToken());
      } else {
        // Skip other token types for now
        this.advance();
      }
    }

    return nodes;
  }

  private parseTemplateVariable(): ASTNode {
    const token = this.advance()!;
    const expression = token.value.slice(2, -2).trim(); // Remove {{ and }}

    return {
      id: this.generateId(),
      kind: 'TEMPLATE',
      start: token.start,
      end: token.end,
      content: token.value,
      expression,
      children: [],
    };
  }

  private parseTextFromToken(): ASTNode {
    const token = this.advance()!;

    return {
      id: this.generateId(),
      kind: 'TEXT',
      start: token.start,
      end: token.end,
      content: token.value,
      children: [],
      textSegments: [{ start: token.start, end: token.end }],
    };
  }

  private parsePomlNode(): ASTNode | null {
    const openToken = this.advance()!;
    const tagName = this.extractTagName(openToken.value);

    // Parse attributes
    const attributes = this.parseAttributes(openToken.value);

    // Determine node kind
    const kind = tagName.toLowerCase() === 'meta' ? 'META' : 'POML';

    const node: ASTNode = {
      id: this.generateId(),
      kind,
      start: openToken.start,
      end: openToken.end, // Will be updated when we find closing tag
      content: openToken.value, // Will be updated
      tagName: tagName.toLowerCase(),
      attributes,
      children: [],
      openingTag: {
        start: openToken.start,
        end: openToken.end,
        nameRange: {
          start: openToken.start + 1,
          end: openToken.start + 1 + tagName.length,
        },
      },
    };

    // Parse children until we find the closing tag
    const children: ASTNode[] = [];
    let depth = 1;

    while (this.position < this.tokens.length && depth > 0) {
      const token = this.peek();
      if (!token) break;

      if (token.type === 'TAG_OPEN') {
        const childTagName = this.extractTagName(token.value);
        if (childTagName.toLowerCase() === tagName.toLowerCase()) {
          depth++;
        }

        // Special handling for text tags - don't process template variables
        if (tagName.toLowerCase() === 'text') {
          children.push(this.parseTextFromToken());
        } else if (this.validPomlTags.has(childTagName.toLowerCase())) {
          const childNode = this.parsePomlNode();
          if (childNode) {
            childNode.parent = node;
            children.push(childNode);
          }
        } else {
          children.push(this.parseTextFromToken());
        }
      } else if (token.type === 'TAG_CLOSE') {
        const closeTagName = this.extractTagName(token.value);
        if (closeTagName.toLowerCase() === tagName.toLowerCase()) {
          depth--;
          if (depth === 0) {
            // Found our closing tag
            const closeToken = this.advance()!;
            node.end = closeToken.end;
            node.closingTag = {
              start: closeToken.start,
              end: closeToken.end,
              nameRange: {
                start: closeToken.start + 2,
                end: closeToken.start + 2 + tagName.length,
              },
            };
            break;
          }
        }
        this.advance();
      } else if (token.type === 'TEMPLATE_VAR' && tagName.toLowerCase() !== 'text') {
        // Only parse template variables outside of text tags
        const templateNode = this.parseTemplateVariable();
        templateNode.parent = node;
        children.push(templateNode);
      } else {
        const textNode = this.parseTextFromToken();
        textNode.parent = node;
        children.push(textNode);
      }
    }

    node.children = children;

    // Update content to include full tag
    if (node.closingTag) {
      node.content = this.tokens
        .slice(
          this.tokens.findIndex((t) => t.start === node.start),
          this.tokens.findIndex((t) => t.end === node.end) + 1,
        )
        .map((t) => t.value)
        .join('');
    }

    return node;
  }
}

// Main parsing function
export function parseAST(content: string): ASTNode {
  const tokenizer = new Tokenizer(content);
  const tokens = tokenizer.tokenize();
  const parser = new ASTParser(tokens);
  return parser.parse();
}

export class PomlAstParser {
  static parse(content: string): ASTNode {
    return parseAST(content);
  }
}
