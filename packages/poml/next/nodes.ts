import { Range } from './types';
import { IToken } from 'chevrotain';

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
export interface ExpressionNode {
  kind: 'EXPRESSION';
  range: Range;
  value: string;
}

export interface ExpressionCstNode {}

/**
 * Represents a template interpolation with double curly braces,
 * or sometimes without braces in specific attributes.
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
 * - Template usage in if attributes: `condition` in `if="condition"`
 *
 * Cases that do not apply:
 * - Full attribute expressions: `if="x > 0"` (use ExpressionNode)
 * - Plain text: `Hello World` (use StringNode)
 * - Single braces: `{ not a template }` (treated as plain text)
 * - Template elements: <template>{{ this is a jinja template }}</template> (use LiteralNode)
 * - With quotes: `"{{ var }}"` (use ValueNode)
 */
export interface TemplateNode {
  kind: 'TEMPLATE';
  range: Range;
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
export interface StringNode {
  kind: 'STRING';
  range: Range;
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
 * - Multi-part content: `"Price: ${{amount}} USD"`
 *
 * Cases that do not apply:
 * - Attribute keys: `class=...` (the `class` part uses StringNode)
 * - Pure expressions without quotes: `if=condition` (use ExpressionNode)
 * - Tag names: `div` (use StringNode)
 * - Standalone template variables not in a value context
 *
 * Note: The range includes quotes if present, but children exclude them.
 */
export interface ValueNode {
  kind: 'VALUE';
  range: Range;
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
export interface ForIteratorNode {
  kind: 'FORITERATOR';
  range: Range;
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
 * - Template values: `title="{{ pageTitle }}"` or `title={{ pageTitle }}`
 * - Mixed values: `placeholder="Enter {{ fieldName }}..."`
 *
 * Cases that do not apply:
 * - Boolean/presence attributes: `disabled`, `checked` (not yet supported)
 * - For-loop attributes: `for="item in items"` (use ForLoopAttributeNode)
 * - Spread attributes (not yet supported): `{...props}`
 * - Dynamic attribute names (not supported): `[attrName]="value"`
 */
export interface AttributeNode {
  kind: 'ATTRIBUTE';
  range: Range;
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
export interface ForLoopAttributeNode {
  kind: 'FORATTRIBUTE';
  range: Range;
  key: StringNode;
  value: ForIteratorNode;
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
export interface OpenTagNode {
  kind: 'OPEN';
  range: Range;
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
 */
export interface CloseTagNode {
  kind: 'CLOSE';
  range: Range;
  value: StringNode;
}

/**
 * Represents a self-closing tag in POML markup.
 *
 * Self-closing elements represent complete elements that have no children or
 * content. They combine opening and closing in a single tag and may have
 * attributes.
 *
 * Cases that apply:
 * - Image elements: `<image src="photo.jpg" />`
 * - Runtime configurations: `<runtime model="gpt-5" temperature="0.7" />`
 *
 * Cases that do not apply:
 * - Meta elements: `<meta name="author" content="John" />`
 * - Elements with content: `<div>content</div>` (use ElementNode)
 * - Separate open/close tags: `<div></div>` (use ElementNode)
 * - Tags without the self-closing slash: `<img>` (use OpenTagNode)
 */
export interface SelfCloseElementNode {
  kind: 'SELFCLOSE';
  range: Range;
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
 * - Any elements: `<document parser="txt">...content...</document>`
 * - Output schemas with templates: `<output-schema>{{ schemaDefinition }}</output-schema>`
 * - Nested elements: `<section><paragraph>Text</paragraph></section>`
 *
 * Cases that do not apply:
 * - Self-closing elements: `<image />` (use SelfCloseTagNode)
 * - Literal text content: plain text (use LiteralNode)
 * - Template variables: `{{ var }}` (use TemplateNode)
 * - Meta elements: `<meta>` tags (use MetaNode)
 */
export interface ElementNode {
  kind: 'ELEMENT';
  range: Range;
  open: OpenTagNode;
  close: CloseTagNode;
  children: (ElementNode | LiteralNode | CommentNode | PragmaNode | ValueNode)[];
}

/**
 * Represents an HTML-like line/block comment in POML.
 *
 * Comment nodes preserve authoring notes or disabled content that should not
 * affect rendering. The `value` holds the comment text without the `<!--`/`-->`
 * delimiters.
 *
 * Examples:
 * - `<!-- this is a comment -->`
 */
export interface CommentNode {
  kind: 'COMMENT';
  range: Range;
  value: StringNode;
}

/**
 * Represents a pragma directive carried inside a comment.
 *
 * Pragmas are special instructions for parser/compiler. They usually appear
 * inside comments and start with `@pragma`. For now we keep this node simple
 * with a single `value` that contains the full directive text after
 * `@pragma` (e.g. `components +reference -table`).
 *
 * Examples:
 * - Specify version: `<!-- @pragma version >=1.0.0 <2.3.0 -->`
 * - Turn tags on/off: `<!-- @pragma components +reference -table -->`
 * - Turn speaker roles on/off: `<!-- @pragma speaker multi -->` or `single`
 */
export interface PragmaNode {
  kind: 'PRAGMA';
  range: Range;
  value: StringNode;
}

/**
 * Represents an element that preserves literal content.
 *
 * Literal nodes are special POML elements that treat their content as literal
 * text, preventing template variable interpolation. They ensure content is
 * preserved exactly as written, useful for code samples or pre-formatted text.
 * When `<text>` is used, the parser eats everything including tags and comments,
 * including new `<text>` tags, until a matching `</text>` is found.
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
 * Note: The tagName (value) can only be "text" in this version.
 * Literal node is different from elements which do not support children.
 * Literal node is handled on the CST parsing stage.
 */
export interface LiteralNode {
  kind: 'TEXT';
  range: Range;
  open: OpenTagNode;
  close: CloseTagNode;
  attributes: AttributeNode[];
  children: StringNode;
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
export interface RootNode {
  kind: 'ROOT';
  range: Range;
  children: (ElementNode | LiteralNode | CommentNode | PragmaNode | ValueNode)[];
}

// Keep these keys required; everything else becomes recursively optional
type DeepPartialExcept<T, K extends keyof T> =
  // arrays
  T extends (infer U)[]
    ? DeepPartialExcept<U, never>[]
    : // functions (leave as-is)
      T extends (...args: any) => any
      ? T
      : // objects
        T extends object
        ? { [P in keyof T as P extends K ? P : never]-?: T[P] } & {
            [P in keyof T as P extends K ? never : P]?: DeepPartialExcept<T[P], never> | undefined;
          }
        : T;

// Keep only "kind" required; everything else is optional, recursively.
type Draft<T extends { kind: string }> = DeepPartialExcept<T, 'kind'>;

// Union of your strict nodes
export type StrictNode =
  | ExpressionNode
  | TemplateNode
  | StringNode
  | ValueNode
  | ForIteratorNode
  | AttributeNode
  | ForLoopAttributeNode
  | OpenTagNode
  | CloseTagNode
  | SelfCloseElementNode
  | ElementNode
  | LiteralNode
  | CommentNode
  | PragmaNode
  | RootNode;

// The "loose" counterpart you can safely produce during parsing.
export type DraftNode = Draft<StrictNode>;
