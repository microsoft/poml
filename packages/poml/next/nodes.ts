import { Range } from './types';
import { CstNode, IToken } from 'chevrotain';

export interface AstNode {
  range: Range; // start and end offsets in the source text
}

/**
 * Plain token sequences helpers from the lexer.
 */
export interface CstTokens extends CstNode {
  children: {
    Content?: IToken[];
  };
}

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
 * - Full attribute expressions: `if="x > 0"` (use AttributeNode)
 * - Plain text: `Hello World` (use LiteralNode)
 * - Single braces: `{ not a template }` (treated as plain text)
 * - Template elements: <template>{{ this is a jinja template }}</template> (use LiteralNode)
 * - With quotes: `"{{ var }}"` (use ValueNode)
 */
export interface TemplateNode extends AstNode {
  kind: 'TEMPLATE';
  value: LiteralNode;
}

/**
 * Related CST node interfaces for parsing stage.
 */

export interface CstTemplateNode extends CstNode {
  children: {
    TemplateOpen?: IToken[];
    WsAfterOpen?: IToken[];
    // Content inside {{ and }} is treated as a single expression token.
    // Eats everything until the next }} (or the whitespace before it).
    // Handles \{{ and \}} escapes. We won't escape other chars here.
    Content?: CstTokens[];
    // If it's close to the ending }}, try to eat whitespace before it.
    WsAfterContent?: IToken[];
    TemplateClose?: IToken[];
  };
}

/**
 * Represents plain text content without any special syntax.
 *
 * Literal nodes are the most basic content nodes, containing literal text
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
 * - Expressions: `x > 0` (use ExpressionNode)
 *
 * Cases that do not apply:
 * - Text containing templates: `Hello {{ name }}` (use ValueNode with children)
 * - Quoted strings in attributes: `"value"` (use ValueNode)
 * - Template variables: `{{ var }}` (use TemplateNode)
 */
export interface LiteralNode extends AstNode {
  kind: 'STRING';
  value: string;
}

/**
 * The value of an attribute, which may contain text and/or templates.
 * Used specifically for the "quotes" in attribute values.
 *
 * Value nodes are containers for mixed content, handling both pure text
 * and interpolated templates. They preserve quote information when used
 * as attribute values and support complex content composition.
 *
 * Cases that apply:
 * - Quoted attribute values: `"some text"`, `'single quoted'`
 * - Mixed content with templates: `"Hello, {{ userName }}!"`
 * - Unquoted template values in certain attribute contexts (e.g., if="condition_expr")
 * - Multi-part content: `"Price: ${{amount}} USD"`
 *
 * Cases that do not apply:
 * - Attribute keys: `class=...` (the `class` part uses LiteralNode)
 * - Pure expressions without quotes: `if=condition` (illegal)
 * - Mixture of template and non-templates in element contents (use LiteralNode and TemplateNode directly)
 *
 * Note: The range includes quotes if present, but children exclude them.
 */
export interface ValueNode extends AstNode {
  kind: 'VALUE';
  children: (LiteralNode | TemplateNode)[];
}

/**
 * Related CST node interfaces for parsing stage.
 * The following two interfaces are for quoted strings and will be transformed into ValueNode.
 */
export interface CstQuotedNode extends CstNode {
  children: {
    OpenQuote?: IToken[];
    // This is a normal quoted string without templates inside.
    Content?: CstTokens[];
    CloseQuote?: IToken[];
  };
}

export interface CstQuotedTemplateNode extends CstNode {
  children: {
    OpenQuote?: IToken[];
    // Allows "Hello {{ friend["abc"] }}!" - mix of text and templates (with quotes).
    Content?: (CstTokens | CstTemplateNode)[];
    CloseQuote?: IToken[];
  };
}

/**
 * Represents a for-loop iteration construct in POML.
 *
 * For loops enable iterative rendering of elements, following the pattern
 * "iterator in collection". This node captures both the loop variable
 * and the collection expression for runtime evaluation.
 *
 * Cases that apply:
 * - Simple iteration: `"item in items"`
 * - Property access: `"user in data.users"`
 * - Array literals: `"num in [1, 2, 3]"`
 * - Method calls in single quotes: `'result in getResults()'`
 * - Nested property iteration: `'task in project.tasks.active'`
 *
 * Cases that do not apply (not yet supported):
 * - Without quotes: `item in items` (must be in quotes for now)
 * - Advanced loop syntax (not yet supported): `(item, index) in items`
 * - Destructuring patterns (not yet supported): `{name, age} in users`
 * - Conditional loops: `if` attributes (use separate condition handling)
 * - Template interpolation: `{{ items }}` (use TemplateNode)
 */
export interface ForIteratorNode extends AstNode {
  kind: 'FORITERATOR';
  iterator: LiteralNode;
  collection: LiteralNode;
}

/**
 * Related CST node interfaces for parsing stage.
 */
export interface CstForIteratorNode extends CstNode {
  children: {
    OpenQuote?: IToken[];
    WsAfterOpen?: IToken[];
    Iterator?: IToken[];
    WsAfterIterator?: IToken[];
    InKeyword?: IToken[];
    WsAfterIn?: IToken[];
    // Follows the same parsing rules as template expression.
    // But as we are in a quoted string, we need to handle
    // backslash escapes like \" and \'.
    // Greedily match until the next unescaped quote or ws before it.
    Collection?: CstTokens[];
    WsAfterCollection?: IToken[];
    CloseQuote?: IToken[];
  };
}

/**
 * Represents a standard attribute on a POML element.
 *
 * Attributes provide metadata and configuration for elements. They consist
 * of a key-value pair where the key is always a simple string and the value
 * can be a complex composition of text and templates.
 *
 * It also supports for-loop attributes via ForIterator, which contains
 * loop iteration syntax rather than a simple value. It enables
 * elements to be rendered multiple times based on a collection.
 *
 * Cases that apply:
 * - Simple attributes: `class="container"`, `id='main'`
 * - Template values: `title="{{ pageTitle }}"` or `title={{ pageTitle }}`
 * - Mixed values: `placeholder="Enter {{ fieldName }}..."`
 * - For attributes: `for="item in items"` (key is "for", value is ForIteratorNode)
 * - Computed collections: `for='i in [...Array(5).keys()]'`
 *
 * Cases that do not apply:
 * - Boolean/presence attributes: `disabled`, `checked` (not yet supported)
 * - Spread attributes (not yet supported): `{...props}`
 * - Dynamic attribute names (not supported): `[attrName]="value"`
 */
export interface AttributeNode extends AstNode {
  kind: 'ATTRIBUTE';
  key: LiteralNode;
  value: ValueNode | ForIteratorNode;
}

/**
 * Related CST node interfaces for parsing stage.
 */
export interface CstAttributeNode extends CstNode {
  children: {
    AttributeKey?: IToken[];
    WsAfterKey?: IToken[];
    Equals?: IToken[];
    WsAfterEquals?: IToken[];
    // Choose between one: john="doe", john='doe', john={{ template }}, for="i in items"
    quotedValue?: CstQuotedTemplateNode[];
    templatedValue?: CstTemplateNode[];
    forIteratorValue?: CstForIteratorNode[];
  };
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
export interface OpenTagNode extends AstNode {
  kind: 'OPEN';
  value: LiteralNode; // tag name
  attributes: AttributeNode[];
}

/**
 * Related CST node interfaces for parsing stage.
 *
 * Opening tag without the ending close bracket.
 * Allow prefix sharing with SelfCloseElementNode.
 */
export interface CstOpenTagPartialNode extends CstNode {
  children: {
    OpenBracket?: IToken[];
    WsAfterOpen?: IToken[];
    TagName?: IToken[];
    WsBeforeEachAttribute?: IToken[];
    Attribute?: CstAttributeNode[];
    WsAfterAll?: IToken[];
  };
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
export interface CloseTagNode extends AstNode {
  kind: 'CLOSE';
  value: LiteralNode; // tag name
}

/**
 * Related CST node interfaces for parsing stage.
 */
export interface CstCloseTagNode extends CstNode {
  children: {
    ClosingOpenBracket?: IToken[];
    WsAfterOpen?: IToken[];
    TagName?: IToken[];
    WsBeforeClose?: IToken[];
    CloseBracket?: IToken[];
  };
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
export interface SelfCloseElementNode extends AstNode {
  kind: 'SELFCLOSE';
  value: LiteralNode; // tag name
  attributes: AttributeNode[];
}

/**
 * Represents a complete POML element with its content.
 *
 * Element nodes are high-level constructs that represent semantic POML
 * components. They contain a tag name, which contains optional attributes,
 * and may have child contents including other elements, text, or values.
 *
 * It should also support literal elements, which are special POML elements
 * that treat their content as literal text without any template variable interpolation.
 * Content is preserved exactly as written, useful for code samples or pre-formatted text.
 *
 *
 * Cases that apply:
 * - Any elements: `<document parser="txt">...content...</document>`
 * - Output schemas with templates: `<output-schema>{{ schemaDefinition }}</output-schema>`
 * - Nested elements: `<section><paragraph>Text</paragraph></section>`
 * - Literal text elements: `<text>Literal {{ not_interpolated }}</text>` (literal elements)
 *
 * Cases that do not apply:
 * - Self-closing elements: `<image />` (use SelfCloseTagNode)
 * - Literal text content: plain text (use LiteralNode)
 * - Template variables: `{{ var }}` (use TemplateNode)
 * - Meta elements: `<meta>` tags (use MetaNode)
 *
 * Note:
 * - Literal element node is different from elements which do not support nested tags
 *   (e.g., <let>). Literal element node is handled on the CST parsing stage.
 */
export interface ElementNode extends AstNode {
  kind: 'ELEMENT';
  open: OpenTagNode;
  close: CloseTagNode;
  children: ElementContentNode[];
  // isLiteral?: boolean; // True for <text> and <template> tags
}

export type ElementContentNode = ElementNode | CommentNode | PragmaNode | LiteralNode | TemplateNode;

/**
 * Related CST node interfaces for parsing stage.
 */
export interface CstElementNode extends CstNode {
  children: {
    OpenTagPartial?: CstOpenTagPartialNode[];
    OpenTagCloseBracket?: IToken[];
    Content?: CstElementContentNode[];
    // For literal elements like <text>
    // When `<text>` is used, the parser eats everything including tags and comments,
    // including nested `<text>` itself, until a matching `</text>` is found
    // The tagName can only be "text" and "template" for literal elements
    // If you need `<text>` in your POML content, use `&lt;text&gt;` outside of literal elements
    TextContent?: CstTokens[]; // For literal elements like <text>
    CloseTag?: CstCloseTagNode[];
    // Alternative, it can also be a self-closing tag.
    SelfCloseBracket?: IToken[];
  };
}

export interface CstElementContentNode extends CstNode {
  children: {
    Element?: CstElementNode[];
    Comment?: CstCommentNode[];
    Pragma?: CstPragmaNode[];
    Template?: CstTemplateNode[];
    TextContent?: CstTokens[];
  };
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
export interface CommentNode extends AstNode {
  kind: 'COMMENT';
  value: LiteralNode;
}

/**
 * Related CST node interfaces for parsing stage.
 */
export interface CstCommentNode extends CstNode {
  children: {
    CommentOpen?: IToken[];
    Content?: CstTokens[];
    CommentClose?: IToken[];
  };
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
 * - White space policy: `<!-- @pragma whitespace pre -->` or `trim`, `collapse`
 *
 * Notes on white space policy:
 * - `pre`: preserve all whitespace as-is
 * - `trim`: trim leading/trailing whitespace in each element
 * - `collapse`: trim + collapse consecutive whitespace into a single space
 *   If there are two inline="false" elements next to each other, space between them will be deleted.
 *
 * Each element type will have its own default whitespace policy.
 * For example, `<text>` defaults to `pre`, while `<paragraph>` defaults to `collapse`.
 * However, when a pragma is set, it overrides the default for subsequent elements.
 * It will affect the AST constructing stages, and also affecting the props sent to components.
 */
export interface PragmaNode extends AstNode {
  kind: 'PRAGMA';
  identifier: LiteralNode;
  options: LiteralNode[];
}

/**
 * Related CST node interfaces for parsing stage.
 */
export interface CstPragmaNode extends CstNode {
  children: {
    CommentOpen?: IToken[];
    WsAfterOpen?: IToken[];
    PragmaKeyword?: IToken[];
    WsAfterPragma?: IToken[];
    PragmaIdentifier?: IToken[];
    WsBeforeEachOption?: IToken[];
    PragmaOption?: (IToken | CstQuotedNode)[];
    WsAfterAll?: IToken[];
    CommentClose?: IToken[];
  };
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
export interface RootNode extends AstNode {
  kind: 'ROOT';
  children: ElementContentNode[];
}

/**
 * Related CST node interfaces for parsing stage.
 */
export interface CstRootNode extends CstNode {
  children: {
    Content?: CstElementContentNode[];
  };
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
  | LiteralNode
  | ValueNode
  | ForIteratorNode
  | AttributeNode
  | OpenTagNode
  | CloseTagNode
  | SelfCloseElementNode
  | ElementNode
  | CommentNode
  | PragmaNode
  | RootNode;

// The "loose" counterpart you can safely produce during parsing.
export type DraftNode = Draft<StrictNode>;
