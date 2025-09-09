/**
 * Converting CST nodes to AST nodes.
 *
 * It's time for:
 *
 * - Check open/close tag matching
 * - Deal with HTML entities escape and backslash escape
 * - Concatenate wrongly split text into LiteralNode
 * - Unify the types (e.g., AttributeNode must have ValueNode children)
 *
 * It's not time yet for:
 *
 * - Evaluating expressions in templates
 * - Resolving includes
 * - Validating semantics (e.g., whether an attribute is allowed on a certain element)
 */

import { CstNode, IToken } from 'chevrotain';
import * as he from 'he';
import {
  CstRootNode,
  CstElementContentNode,
  CstElementNode,
  CstTemplateNode,
  CstQuotedNode,
  CstQuotedTemplateNode,
  CstForIteratorNode,
  CstAttributeNode,
  CstCommentNode,
  CstPragmaNode,
  CstTokens,
  AstNode,
} from './nodes';
import {
  ElementNode,
  ElementContentNode,
  ValueNode,
  TemplateNode,
  LiteralNode,
  AttributeNode,
  ForIteratorNode,
  CommentNode,
  PragmaNode,
  RootNode,
} from './nodes';
import { Range } from './types';
import { extendedPomlParser } from './cst';
import { BackslashEscape, CharacterEntity } from './lexer';
import * as diagnostics from './diagnostics';

/** Decode a single backslash escape sequence (for quoted strings). */
function decodeEscape(seq: string): string {
  // seq includes the leading backslash (e.g. " , \n)
  const body = seq.slice(1);
  if (body === 'n') {
    return '\n';
  } else if (body === 'r') {
    return '\r';
  } else if (body === 't') {
    return '\t';
  } else if (body === "'") {
    return "'";
  } else if (body === '"') {
    return '"';
  } else if (body === '{{') {
    // \{{
    return '{{';
  } else if (body === '}}') {
    // \}}
    return '}}';
  } else if (body.startsWith('x')) {
    // \xHH (2 hex digits)
    const hex = body.slice(1);
    if (hex.length === 2 && /^[0-9a-fA-F]{2}$/.test(hex)) {
      const n = parseInt(hex, 16);
      return String.fromCharCode(n);
    }
    return body; // Invalid hex escape
  } else if (body.startsWith('u')) {
    // \uHHHH (4 hex digits)
    const hex = body.slice(1);
    if (hex.length === 4 && /^[0-9a-fA-F]{4}$/.test(hex)) {
      const n = parseInt(hex, 16);
      return String.fromCharCode(n);
    }
    return body; // Invalid unicode escape
  } else if (body.startsWith('U')) {
    // \UHHHHHHHH (8 hex digits)
    const hex = body.slice(1);
    if (hex.length === 8 && /^[0-9a-fA-F]{8}$/.test(hex)) {
      const n = parseInt(hex, 16);
      return String.fromCodePoint(n);
    }
    return body; // Invalid unicode escape
  } else if (body === '\\') {
    return '\\';
  } else {
    // Unknown escape, return the sequence as-is minus the leading backslash (best effort)
    return body;
  }
}

// ---- Range and text utilities ----

/** Utility: create a LiteralNode from raw text and token range. */
function literal(value: string, range: Range): LiteralNode {
  return { kind: 'STRING', value, range };
}

/**
 * Create a LiteralNode from IToken list.
 */
function literalFromTokens(tokens: IToken[], fromIToken?: (tokens: IToken[]) => string): LiteralNode {
  const text = fromIToken ? fromIToken(tokens) : textFromRaw(tokens);
  return literal(text, rangeFromTokens(tokens));
}

/**
 * Convert CST token groups to a literal string.
 * String contents are kept as is, no escape decoding.
 */
function literalFromCstTokens(groups: CstTokens[], fromIToken?: (tokens: IToken[]) => string): LiteralNode {
  const text = textFromCstTokens(groups, fromIToken ?? textFromRaw);
  return literal(text, rangeFromCstTokens(groups));
}

/**
 * Range utilities.
 * Build a range from two offsets (inclusive start, inclusive end).
 */
function rangeFrom(start: number, end: number): Range {
  return { start, end };
}

/**
 * Range that spans a list of tokens (or is [0, 0] if none).
 */
function rangeFromTokens(tokens: IToken[]): Range {
  if (!tokens.length) {
    return { start: 0, end: 0 };
  }
  const first = tokens[0];
  const last = tokens[tokens.length - 1];
  return rangeFrom(first.startOffset ?? 0, last.endOffset ?? first.startOffset ?? 0);
}

/**
 * Range from Any CstNode (or is [0, 0] if none).
 */
function rangeFromCstNode(node: CstNode): Range {
  const start = node.location?.startOffset ?? 0;
  const end = node.location?.endOffset ?? node.location?.startOffset ?? start;
  return rangeFrom(start, end);
}

/**
 * Range that spans a list of CstTokens (or is [0, 0] if none).
 */
function rangeFromCstTokens(groups: CstTokens[]): Range {
  const allTokens = groups.flatMap((g) => g.children.Content ?? []);
  return rangeFromTokens(allTokens);
}

/** Gather raw text from a list of tokens without any decoding. */
function textFromRaw(tokens: IToken[]): string {
  return tokens.map((t) => t.image ?? '').join('');
}

/**
 * Gather text from tokens INSIDE QUOTED STRINGS (attribute values & pragma quoted options).
 * Rules:
 * - Backslash escapes ARE decoded
 * - Character entities are shown as-is (not decoded)
 */
function textFromQuoted(tokens: IToken[]): string {
  return tokens
    .map((t) => {
      if (t.tokenType === BackslashEscape) {
        return decodeEscape(t.image ?? '');
      } else {
        return t.image;
      }
    })
    .join('');
}

/**
 * Gather text from CstToken groups.
 * Each group is expected to be a list of ITokens.
 */
function textFromCstTokens(groups: CstTokens[], fromIToken: (tokens: IToken[]) => string): string {
  return groups.map((g) => fromIToken(g.children.Content ?? [])).join('');
}

// ---- AST Visitor ----

const BaseVisitor = extendedPomlParser.getBaseCstVisitorConstructorWithDefaults();

/**
 * Extended POML CST -> AST builder.
 *
 * This visitor performs a shape-preserving transformation from the concrete
 * syntax tree (CST) to the semantic abstract syntax tree (AST). It also
 * normalizes textual content according to the lexer/parser contracts:
 *  - between-tags text decodes character entities (&amp; -> &)
 *  - quoted strings decode backslash escapes (\n, \xHH, \uHHHH, ...)
 *  - template expressions are preserved as raw text; evaluation is later
 *
 * It additionally checks that open/close tag names match and records errors
 * instead of throwing where possible so downstream phases can proceed.
 */
export class ExtendedPomlAstVisitor extends BaseVisitor {
  constructor() {
    super();
    this.validateVisitor();
  }

  /**
   * A hack to let rule methods get a handle of the CstNode they are visiting.
   */
  visit(cstNode: CstNode | CstNode[], param?: any): AstNode {
    return super.visit(cstNode, { ...param, node: cstNode });
  }

  // ---- Rule implementations ----

  root(ctx: CstRootNode['children'], { node }: { node: CstRootNode }): RootNode {
    const children: ElementContentNode[] = [];
    for (const ec of ctx.Content ?? []) {
      const node = this.visit(ec) as ElementContentNode;
      if (node) {
        children.push(node);
      }
    }

    return { kind: 'ROOT', children, range: rangeFromCstNode(node) };
  }

  elementContent(
    ctx: CstElementContentNode['children'],
    { node }: { node: CstElementContentNode },
  ): ElementContentNode {
    if (ctx.Pragma?.length) {
      return this.visit(ctx.Pragma[0]) as PragmaNode;
    } else if (ctx.Comment?.length) {
      return this.visit(ctx.Comment[0]) as CommentNode;
    } else if (ctx.Template?.length) {
      return this.visit(ctx.Template[0]) as TemplateNode;
    } else if (ctx.Element?.length) {
      return this.visit(ctx.Element[0]) as ElementNode;
    } else if (ctx.TextContent?.length) {
      // Text contents between tags
      return this.visit(ctx.TextContent[0]) as LiteralNode;
    }
    // This should not happen
    diagnostics.error('Unknown element content', rangeFromCstNode(node));
    return literal('', rangeFromCstNode(node));
  }

  template(ctx: CstTemplateNode['children'], { node }: { node: CstTemplateNode }): TemplateNode {
    const exprNode = literalFromCstTokens(ctx.Content ?? []);
    return { kind: 'TEMPLATE', value: exprNode, range: rangeFromCstNode(node) };
  }

  comment(ctx: CstCommentNode['children'], { node }: { node: CstCommentNode }): CommentNode {
    return {
      kind: 'COMMENT',
      value: literalFromCstTokens(ctx.Content ?? []),
      range: rangeFromCstNode(node),
    };
  }

  pragma(ctx: CstPragmaNode['children'], { node }: { node: CstPragmaNode }): PragmaNode {
    const identifier = literalFromTokens(ctx.PragmaIdentifier ?? []);
    const options: LiteralNode[] = [];

    for (const option of ctx.PragmaOption ?? []) {
      if ('tokenType' in option) {
        // IToken
        options.push(literal(option.image ?? '', rangeFromTokens([option])));
      } else {
        // CstQuotedNode
        options.push(this.visit(option) as LiteralNode);
      }
    }

    return {
      kind: 'PRAGMA',
      identifier,
      options,
      range: rangeFromCstNode(node),
    };
  }

  quoted(ctx: CstQuotedNode['children'], { node }: { node: CstQuotedNode }): LiteralNode {
    // Ignore the special strings like templates, entities, ...
    return literalFromCstTokens(ctx.Content ?? [], textFromQuoted);
  }

  quotedTemplate(ctx: CstQuotedTemplateNode['children'], { node }: { node: CstQuotedTemplateNode }): ValueNode {
    const children: (LiteralNode | TemplateNode)[] = [];

    for (const content of ctx.Content ?? []) {
      if (content.name === 'template') {
        // CstTemplateNode
        const templateNode = this.visit(content) as TemplateNode;
        children.push(templateNode);
      } else {
        // CstTokens - regular text content
        const lit = literalFromCstTokens([content as CstTokens], textFromQuoted);
        children.push(lit);
      }
    }

    return {
      kind: 'VALUE',
      children,
      range: rangeFromCstNode(node),
    };
  }

  forIteratorValue(ctx: CstForIteratorNode['children'], { node }: { node: CstForIteratorNode }): ForIteratorNode {
    const iterator = literalFromTokens(ctx.Iterator ?? [], textFromQuoted);
    const collection = literalFromCstTokens(ctx.Collection ?? [], textFromQuoted);

    return {
      kind: 'FORITERATOR',
      iterator,
      collection,
      range: rangeFromCstNode(node),
    };
  }

  attribute(ctx: CstAttributeNode['children'], { node }: { node: CstAttributeNode }): AttributeNode {
    const key: LiteralNode = literalFromTokens(ctx.AttributeKey ?? []);
    const range = rangeFromCstNode(node);

    let value: ValueNode | ForIteratorNode;

    if (ctx.forIteratorValue?.length) {
      value = this.visit(ctx.forIteratorValue[0]) as ForIteratorNode;
    } else if (ctx.quotedValue?.length) {
      value = this.visit(ctx.quotedValue[0]) as ValueNode;
    } else if (ctx.templatedValue?.length) {
      // Unquoted: key={{ expr }} -> wrap as ValueNode with a TemplateNode child
      const tpl = this.visit(ctx.templatedValue[0]) as TemplateNode;
      value = { kind: 'VALUE', children: [tpl], range: tpl.range };
    } else {
      // Fallback empty value
      diagnostics.error(`Attribute "${key.value}" is missing a value`, range);
      value = { kind: 'VALUE', children: [], range: key.range };
    }

    return { kind: 'ATTRIBUTE', key, value, range };
  }

  /**
   * Gather text from tokens for TEXT CONTENT (between tags).
   * Rules:
   * - Character entities are decoded
   * - Backslash escapes are NOT interpreted (shown as-is)
   */
  betweenTagsTokens(ctx: CstTokens['children'], { node }: { node: CstTokens }): LiteralNode {
    const tokens = ctx.Content ?? [];
    const text = tokens
      .map((t) => {
        if (t.tokenType === CharacterEntity) {
          try {
            return he.decode(t.image ?? '', { strict: true });
          } catch (e) {
            diagnostics.error(`Failed to decode HTML entity: ${t.image}`, rangeFromTokens([t]));
          }
        }
        return t.image ?? '';
      })
      .join('');
    return literal(text, rangeFromTokens(tokens));
  }

  // openTagPartial and closeTag is skipped. They are handled implicitly in element()

  element(ctx: CstElementNode['children'], { node }: { node: CstElementNode }): ElementNode {
    const openTagPartial = ctx.OpenTagPartial?.[0];
    const name = textFromRaw(openTagPartial?.children?.TagName ?? []);

    const attributes = openTagPartial?.children?.Attribute?.map((a) => this.visit(a) as AttributeNode) ?? [];

    let children: ElementContentNode[];

    if (ctx.TextContent?.length) {
      // Literal element: everything inside is plain text (no template interpolation)
      children = [literalFromCstTokens(ctx.TextContent)];
    } else {
      // Normal element: nested content parsed as usual
      children = ctx.Content?.map((ec) => this.visit(ec) as ElementContentNode) ?? [];
    }

    // Tag name matching check
    const closeTag = ctx.CloseTag?.[0];
    const closeTagName = textFromRaw(closeTag?.children?.TagName ?? []);
    if (closeTag && name.toLowerCase() !== closeTagName.toLowerCase()) {
      diagnostics.error(
        `Mismatched closing tag: expected </${name}> but found </${closeTagName}>`,
        rangeFromCstNode(closeTag),
      );
    }

    return { kind: 'ELEMENT', name, attributes, children, range: rangeFromCstNode(node) };
  }
}

/** Build an AST RootNode from a CST produced by the parser. */
export function cstToAst(cst: CstNode): RootNode {
  const visitor = new ExtendedPomlAstVisitor();
  return visitor.visit(cst) as RootNode;
}
