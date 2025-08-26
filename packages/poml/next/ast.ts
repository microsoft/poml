import { Tokenizer, Token } from './tokenizer';
import componentDocs from '../assets/componentDocs.json';
import { Range } from './types';

/**
 * Base interface for all AST nodes in the POML syntax tree.
 *
 * Every node in the AST must have a kind discriminator and a range indicating
 * its position in the source text. The kind field enables TypeScript discriminated
 * unions for type-safe node handling.
 *
 * Cases that apply:
 * - All syntactic constructs in POML markup (elements, attributes, text, templates)
 * - Meta-level constructs (root nodes, expression nodes)
 *
 * Cases that do not apply:
 * - Lexical tokens (these are handled by the tokenizer)
 * - Semantic information (component types, validation results)
 * - Runtime values (evaluated expressions, resolved variables)
 */
export interface Node {
  kind:
    | 'META'
    | 'EXPRESSION'
    | 'VALUE'
    | 'STRING'
    | 'VALUE'
    | 'FORLOOP'
    | 'OPEN'
    | 'CLOSE'
    | 'SELFCLOSE'
    | 'ELEMENT'
    | 'TEXT'
    | 'POML'
    | 'ATTRIBUTE'
    | 'TEMPLATE'
    | 'ROOT';
  range: Range;
}

/**
 * Represents a JavaScript expression as a string.
 *
 * This node stores raw expression text that will be evaluated at runtime.
 * It serves as a wrapper for expressions used in various contexts like
 * conditions, loops, and template interpolations.
 *
 * Cases that apply:
 * - Conditional expressions: `i > 0`, `user.name === "admin"`
 * - Collection accessors: `items.everything`, `data[0].value`
 * - Function calls: `formatDate(now)`, `items.filter(x => x.active)`
 * - Property paths: `user.profile.settings.theme`
 *
 * Cases that do not apply:
 * - Template syntax including braces: `{{ expression }}` (use TemplateNode)
 * - String literals with quotes: `"hello"` (use StringNode or ValueNode)
 * - POML markup: `<tag>` (use element nodes)
 */
export interface ExpressionNode extends Node {
  kind: 'EXPRESSION';
  value: string;
}

/**
 * Represents a template interpolation with double curly braces.
 *
 * Template nodes handle variable interpolation in POML, containing an
 * expression that will be evaluated and substituted at runtime. The node
 * preserves the template syntax for proper rendering and error reporting.
 *
 * Cases that apply:
 * - Standalone template variables: `{{ userName }}`, `{{ count + 1 }}`
 * - Template expressions in text: part of "Hello {{ name }}!"
 * - Complex expressions: `{{ users.map(u => u.name).join(", ") }}`
 * - Conditional rendering: `{{ isVisible ? "Show" : "Hide" }}`
 *
 * Cases that do not apply:
 * - Attribute expressions without braces: `if="x > 0"` (use ExpressionNode)
 * - Plain text: `Hello World` (use StringNode)
 * - POML elements: `<div>` (use element nodes)
 * - Single braces: `{ not a template }` (treated as plain text)
 */
export interface TemplateNode extends Node {
  kind: 'TEMPLATE';
  value: ExpressionNode;
}

/**
 * Represents plain text content without any special syntax.
 *
 * String nodes are the most basic content nodes, containing literal text
 * that requires no processing. They are used both for content and as
 * components of other nodes (like attribute keys and tag names).
 *
 * Cases that apply:
 * - Plain text content: `Hello World`, `This is a paragraph`
 * - Long text blocks in `<text>` elements: `some long text <ignored-tag> continued`
 * - Attribute keys: the `class` in `class="container"`
 * - Tag names: the `div` in `<div>`
 * - Identifiers: variable names like `item` in for loops
 * - Whitespace and formatting text between elements
 *
 * Cases that do not apply:
 * - Text containing templates: `Hello {{ name }}` (use ValueNode with children)
 * - Quoted strings in attributes: `"value"` (use ValueNode)
 * - Expressions: `x > 0` (use ExpressionNode)
 * - Template variables: `{{ var }}` (use TemplateNode)
 */
export interface StringNode extends Node {
  kind: 'STRING';
  value: string;
}

/**
 * Represents a composite value that may contain text and/or templates.
 *
 * Value nodes are containers for mixed content, handling both pure text
 * and interpolated templates. They preserve quote information when used
 * as attribute values and support complex content composition.
 *
 * Cases that apply:
 * - Quoted attribute values: `"some text"`, `'single quoted'`
 * - Mixed content with templates: `"Hello, {{ userName }}!"`
 * - Text content between tags: `>  some text  <` (including whitespace)
 * - Unquoted template values in certain contexts
 * - Multi-part content: `"Price: ${{ amount }} USD"`
 *
 * Cases that do not apply:
 * - Attribute keys: `class=...` (the `class` part uses StringNode)
 * - Pure expressions without quotes: `if=condition` (use ExpressionNode)
 * - Tag names: `div` (use StringNode)
 * - Standalone template variables not in a value context
 *
 * Note: The range includes quotes if present, but children exclude them.
 */
export interface ValueNode extends Node {
  kind: 'VALUE';
  children: (StringNode | TemplateNode)[];
}

/**
 * Represents a for-loop iteration construct in POML.
 *
 * For loops enable iterative rendering of elements, following the pattern
 * "iterator in collection". This node captures both the loop variable
 * and the collection expression for runtime evaluation.
 *
 * Cases that apply:
 * - Simple iteration: `item in items`
 * - Property access: `user in data.users`
 * - Array literals: `num in [1, 2, 3]`
 * - Method calls: `result in getResults()`
 * - Nested property iteration: `task in project.tasks.active`
 *
 * Cases that do not apply (not yet supported):
 * - Advanced loop syntax (not yet supported): `(item, index) in items`
 * - Destructuring patterns (not yet supported): `{name, age} in users`
 * - Conditional loops: `if` attributes (use separate condition handling)
 * - Template interpolation: `{{ items }}` (use TemplateNode)
 */
export interface ForLoopNode extends Node {
  kind: 'FORLOOP';
  iterator: StringNode;
  collection: ExpressionNode;
}

/**
 * Represents a standard attribute on a POML element.
 *
 * Attributes provide metadata and configuration for elements. They consist
 * of a key-value pair where the key is always a simple string and the value
 * can be a complex composition of text and templates.
 *
 * Cases that apply:
 * - Simple attributes: `class="container"`, `id='main'`
 * - Boolean/presence attributes: `disabled`, `checked`
 * - Template values: `title="{{ pageTitle }}"` or `title={{ pageTitle }}`
 * - Mixed values: `placeholder="Enter {{ fieldName }}..."`
 *
 * Cases that do not apply:
 * - For-loop attributes: `for="item in items"` (use ForLoopAttributeNode)
 * - Spread attributes (not yet supported): `{...props}`
 * - Dynamic attribute names (not supported): `[attrName]="value"`
 */
export interface AttributeNode extends Node {
  kind: 'ATTRIBUTE';
  key: StringNode;
  value: ValueNode;
}

/**
 * Represents a special for-loop attribute on POML elements.
 *
 * This specialized attribute node handles the `for` attribute specifically,
 * which contains loop iteration syntax rather than a simple value. It enables
 * elements to be rendered multiple times based on a collection.
 *
 * Cases that apply:
 * - For attributes only: `for="item in items"`
 * - Nested iterations: `for="subitem in item.children"`
 * - Computed collections: `for="i in [...Array(5).keys()]"`
 *
 * Cases that do not apply:
 * - Any attribute with a key other than "for"
 * - Standard attributes: `class="..."` (use AttributeNode)
 * - Conditional attributes: `if="..."` (use AttributeNode)
 */
export interface ForLoopAttributeNode extends Node {
  kind: 'ATTRIBUTE';
  key: StringNode;
  value: ForLoopNode;
}

/**
 * Represents an opening tag in POML markup.
 *
 * Open tags mark the beginning of an element that expects a corresponding
 * closing tag. They may contain attributes that configure the element's
 * behavior and appearance.
 *
 * Cases that apply:
 * - Standard opening tags: `<document>`, `<message role="user">`
 * - Tags with attributes: `<div class="container" id="main">`
 * - Tags with for-loops: `<task for="item in items">`
 * - Nested structure beginnings: `<section>` before content
 *
 * Cases that do not apply:
 * - Self-closing tags: `<image src="..." />` (use SelfCloseTagNode)
 * - Closing tags: `</document>` (use CloseTagNode)
 * - Complete elements: opening + content + closing (use ElementNode)
 * - Invalid or malformed tags (treated as text)
 */
export interface OpenTagNode extends Node {
  kind: 'OPEN';
  value: StringNode;
  attributes: (AttributeNode | ForLoopAttributeNode)[];
}

/**
 * Represents a closing tag in POML markup.
 *
 * Close tags mark the end of an element, matching a previously opened tag.
 * They contain only the tag name and no attributes.
 *
 * Cases that apply:
 * - Standard closing tags: `</document>`, `</message>`
 * - Nested structure endings: `</section>`, `</div>`
 * - Any valid POML element closure
 *
 * Cases that do not apply:
 * - Opening tags: `<document>` (use OpenTagNode)
 * - Self-closing tags: `<br/>` (use SelfCloseTagNode)
 * - Tags with attributes (closing tags never have attributes)
 * - Mismatched closing tags (parser error)
 */
export interface CloseTagNode extends Node {
  kind: 'CLOSE';
  value: StringNode;
}

/**
 * Represents a self-closing tag in POML markup.
 *
 * Self-closing tags represent complete elements that have no children or
 * content. They combine opening and closing in a single tag and may have
 * attributes.
 *
 * Cases that apply:
 * - Image elements: `<image src="photo.jpg" />`
 * - Meta elements: `<meta name="author" content="John" />`
 * - Data elements without content: `<data path="file.csv" />`
 * - Any element explicitly self-closed: `<element attr="value" />`
 *
 * Cases that do not apply:
 * - Elements with content: `<div>content</div>` (use ElementNode)
 * - Separate open/close tags: `<div></div>` (use ElementNode)
 * - Tags without the self-closing slash: `<img>` (use OpenTagNode)
 * - Text content elements (these require open/close pairs)
 */
export interface SelfCloseTagNode extends Node {
  kind: 'SELFCLOSE';
  value: StringNode;
  attributes: (AttributeNode | ForLoopAttributeNode)[];
}

/**
 * Represents a complete POML element with its content.
 *
 * Element nodes are high-level constructs that represent semantic POML
 * components. They contain a tag name, optional attributes (inherited from
 * open tag), and may have child content including other elements, text,
 * or values.
 *
 * Cases that apply:
 * - Document structures: `<document>...content...</document>`
 * - Messages: `<message role="user">Hello</message>`
 * - Nested elements: `<section><paragraph>Text</paragraph></section>`
 * - Data components: `<table>...rows...</table>`
 *
 * Cases that do not apply:
 * - Self-closing elements: `<image />` (use SelfCloseTagNode)
 * - Raw text content: plain text outside elements (use TextNode)
 * - Template variables: `{{ var }}` (use TemplateNode)
 * - Meta elements: `<meta>` tags (use MetaNode)
 */
export interface ElementNode extends Node {
  kind: 'ELEMENT';
  tagName: StringNode;
  children: (ElementNode | TextNode | MetaNode | ValueNode)[];
}

/**
 * Represents a text element that preserves literal content.
 *
 * Text nodes are special POML elements that treat their content as literal
 * text, preventing template variable interpolation. They ensure content is
 * preserved exactly as written, useful for code samples or pre-formatted text.
 *
 * Cases that apply:
 * - Explicit text elements: `<text>Literal {{ not_interpolated }}</text>`
 *
 * Cases that do not apply:
 * - Regular text content with interpolation (use ValueNode)
 * - Plain text outside elements (use ValueNode)
 * - Elements allowing template processing (use ElementNode)
 * - Text with attributes enabling processing (future feature)
 *
 * Note: The tagName is always "text" for these nodes, and attributes must be empty.
 */
export interface TextNode extends Node {
  kind: 'TEXT';
  tagName: StringNode;
  attributes: AttributeNode[];
  value: StringNode;
}

/**
 * Represents metadata elements in POML.
 *
 * Meta nodes provide document-level metadata and configuration that doesn't
 * render as visible content. They typically appear at the document start and
 * configure processing behavior, document properties, or provide auxiliary
 * information.
 *
 * Cases that apply:
 * - Document metadata: `<meta minVersion="1.0">`
 * - Configuration: `<meta enableComponents="+reference">`
 *
 * Cases that do not apply:
 * - Any element that is not `<meta>` (use ElementNode)
 */
export interface MetaNode extends Node {
  kind: 'META';
  tagName: StringNode;
  attributes: AttributeNode[];
}

/**
 * Represents the root node of a POML document tree.
 *
 * Root nodes serve as the top-level container for all document content when
 * there isn't an explicit `<poml>` wrapper. They provide a consistent entry
 * point for document traversal and processing.
 *
 * Cases that apply:
 * - Documents without `<poml>` wrapper
 * - Documents with multiple top-level elements
 * - Documents with `<poml>` but surrounded by white spaces or comments
 *
 * Cases that do not apply:
 * - All nested elements
 */
export interface RootNode extends Node {
  kind: 'ROOT';
  children: (ElementNode | TextNode | MetaNode | ValueNode)[];
}

class ASTParser {
  private tokens: Token[];
  private position: number;
  private nextId: number;

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

  private validPomlTags: Set<string>;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
    this.position = 0;
    this.nextId = 0;
    this.validPomlTags = this.buildValidTagsSet();
  }

  private buildValidTagsSet(): Set<string> {
    const validTags = new Set<string>(this.alwaysValidTags);

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
