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
  switch (body) {
    case 'n':
      return '\n';
    case 'r':
      return '\r';
    case 't':
      return '\t';
    case "'":
      return "'";
    case '"':
      return '"';
    case '{{': // \{{
      return '{{';
    case '}}': // \}}
      return '}}';
    case 'x':
    case 'u':
    case 'U': {
      const hex = body.slice(1);
      const n = parseInt(hex, 16);
      return String.fromCharCode(n);
    }
    case '\\':
      return '\\';
    default:
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
  return rangeFrom(node.location?.startOffset ?? 0, node.location?.endOffset ?? node.location?.startOffset ?? 0);
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

  // ---- Rule implementations ----

  root(ctx: CstRootNode): RootNode {
    const children: ElementContentNode[] = [];
    for (const ec of ctx.children.Content ?? []) {
      const node = this.visit(ec) as ElementContentNode;
      if (node) {
        children.push(node);
      }
    }

    return { kind: 'ROOT', children, range: rangeFromCstNode(ctx) };
  }

  elementContent(ctx: CstElementContentNode): ElementContentNode {
    if (ctx.children.Pragma?.length) {
      return this.visit(ctx.children.Pragma[0]) as PragmaNode;
    } else if (ctx.children.Comment?.length) {
      return this.visit(ctx.children.Comment[0]) as CommentNode;
    } else if (ctx.children.Template?.length) {
      return this.visit(ctx.children.Template[0]) as TemplateNode;
    } else if (ctx.children.Element?.length) {
      return this.visit(ctx.children.Element[0]) as ElementNode;
    } else if (ctx.children.TextContent?.length) {
      // Text contents between tags
      return this.visit(ctx.children.TextContent[0]) as LiteralNode;
    }
    // This should not happen
    diagnostics.error('Unknown element content', rangeFromCstNode(ctx));
    return literal('', rangeFromCstNode(ctx));
  }

  template(ctx: CstTemplateNode): TemplateNode {
    const exprNode = literalFromCstTokens(ctx.children.Content ?? []);
    return { kind: 'TEMPLATE', value: exprNode, range: rangeFromCstNode(ctx) };
  }

  comment(ctx: CstCommentNode): CommentNode {
    const text = textFromCstTokens(ctx.children.Content ?? [], textFromRaw);
    return {
      kind: 'COMMENT',
      value: literalFromCstTokens(ctx.children.Content ?? []),
      range: rangeFromCstNode(ctx),
    };
  }

  pragma(ctx: CstPragmaNode): PragmaNode {
    const identifier = literalFromTokens(ctx.children.PragmaIdentifier ?? []);
    const options: LiteralNode[] = [];

    for (const option of ctx.children.PragmaOption ?? []) {
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
      range: rangeFromCstNode(ctx),
    };
  }

  quoted(ctx: CstQuotedNode): LiteralNode {
    // Ignore the special strings like templates, entities, ...
    return literalFromCstTokens(ctx.children.Content ?? [], textFromQuoted);
  }

  quotedTemplate(ctx: CstQuotedTemplateNode): ValueNode {
    const children: (LiteralNode | TemplateNode)[] = [];

    for (const content of ctx.children.Content ?? []) {
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
      range: rangeFromCstNode(ctx),
    };
  }

  forIteratorValue(ctx: CstForIteratorNode): ForIteratorNode {
    const iterator = literalFromTokens(ctx.children.Iterator ?? [], textFromQuoted);
    const collection = literalFromCstTokens(ctx.children.Collection ?? [], textFromQuoted);

    return {
      kind: 'FORITERATOR',
      iterator,
      collection,
      range: rangeFromCstNode(ctx),
    };
  }

  attribute(ctx: CstAttributeNode): AttributeNode {
    const key: LiteralNode = literalFromTokens(ctx.children.AttributeKey ?? []);
    const range = rangeFromCstNode(ctx);

    let value: ValueNode | ForIteratorNode;

    if (ctx.children.forIteratorValue?.length) {
      value = this.visit(ctx.children.forIteratorValue[0]) as ForIteratorNode;
    } else if (ctx.children.quotedValue?.length) {
      value = this.visit(ctx.children.quotedValue[0]) as ValueNode;
    } else if (ctx.children.templatedValue?.length) {
      // Unquoted: key={{ expr }} -> wrap as ValueNode with a TemplateNode child
      const tpl = this.visit(ctx.children.templatedValue[0]) as TemplateNode;
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
  betweenTagsTokens(ctx: CstTokens): LiteralNode {
    const tokens = ctx.children.Content ?? [];
    const text = tokens
      .map((t) => {
        if (t.tokenType === CharacterEntity) {
          try {
            return he.decode(t.image ?? '', { strict: true });
          } catch (e) {
            diagnostics.error(`Failed to decode HTML entity: ${t.image}`, rangeFromTokens([t]));
          }
        }
      })
      .join('');
    return literal(text, rangeFromTokens(tokens));
  }

  // openTagPartial and closeTag is skipped. They are handled implicitly in element()

  element(ctx: CstElementNode): ElementNode {
    const openTagPartial = ctx.children.OpenTagPartial?.[0];
    const name = textFromRaw(openTagPartial?.children.TagName ?? []);

    const attributes = openTagPartial?.children.Attribute?.map((a) => this.visit(a) as AttributeNode) ?? [];

    let children: ElementContentNode[];

    if (ctx.children.TextContent?.length) {
      // Literal element: everything inside is plain text (no template interpolation)
      children = [literalFromCstTokens(ctx.children.TextContent ?? [])];
    } else {
      // Normal element: nested content parsed as usual
      children = ctx.children.Content?.map((ec) => this.visit(ec) as ElementContentNode) ?? [];
    }

    // Tag name matching check
    const closeTag = ctx.children.CloseTag?.[0];
    const closeTagName = textFromRaw(closeTag?.children.TagName ?? []);
    if (closeTag && name.toLowerCase() !== closeTagName.toLowerCase()) {
      diagnostics.error(
        `Mismatched closing tag: expected </${name}> but found </${closeTagName}>`,
        rangeFromCstNode(closeTag),
      );
    }

    return { kind: 'ELEMENT', name, attributes, children, range: rangeFromCstNode(ctx) };
  }
}

/** Build an AST RootNode (and errors) from a CST produced by the parser. */
export function cstToAst(cst: CstNode): { root: RootNode; errors: AstBuildError[] } {
  const visitor = new ExtendedPomlAstVisitor();
  return visitor.build(cst);
}
