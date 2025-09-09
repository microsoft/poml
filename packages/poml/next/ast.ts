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
  CstOpenTagPartialNode,
  CstCloseTagNode,
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
import * as error from './error';

/** Error produced while building the AST (beyond lex/parse errors). */
export interface AstBuildError {
  message: string;
  range?: Range;
}

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
function literalFromTokens(tokens: IToken[]): LiteralNode {
  return literal(textFromRaw(tokens), rangeFromTokens(tokens));
}

/**
 * Convert CST token groups to a literal string.
 * String contents are kept as is, no escape decoding.
 */
function literalFromCstTokens(groups: CstTokens[]): LiteralNode {
  const text = textFromCstTokens(groups, textFromRaw);
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
  private errors: AstBuildError[] = [];

  constructor() {
    super();
    this.validateVisitor();
  }

  /** Entry point: visit a CstRootNode and return an AST RootNode & errors. */
  build(cst: CstNode): { root: RootNode; errors: AstBuildError[] } {
    const root = this.visit(cst) as RootNode;
    return { root, errors: this.errors };
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
    this.errors.push({ message: 'Unknown element content', range: rangeFromCstNode(ctx) });
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
    const open = ctx.children.CommentOpen?.[0];
    const close = ctx.children.CommentClose?.[0];

    const idTok = ctx.children.PragmaIdentifier?.[0];
    const identifier: LiteralNode = literal(idTok?.image ?? '', idTok?.startOffset ?? 0, (idTok?.endOffset ?? -1) + 1);

    const options: LiteralNode[] = [];
    for (const opt of ctx.children.PragmaOption ?? []) {
      if ((opt as CstQuotedNode).children) {
        // Quoted option
        const q = opt as CstQuotedNode;
        const bodyTokens = q.children.Content?.[0]?.children.Content ?? [];
        const value = textFromQuoted(bodyTokens);
        const start = q.children.OpenQuote?.[0]?.startOffset ?? 0;
        const end = (q.children.CloseQuote?.[0]?.endOffset ?? start) + 1;
        options.push(literal(value, start, end));
      } else {
        // Unquoted identifier-ish tokens captured by commentIdentifierTokens
        const toks = (opt as any).children?.Content ?? [];
        const value = rawFrom(toks);
        const r = rangeFromTokens(toks);
        options.push(literal(value, r.start, r.end));
      }
    }

    const start = open?.startOffset ?? identifier.range.start;
    const end = (close?.endOffset ?? identifier.range.end - 1) + 1;

    return {
      kind: 'PRAGMA',
      identifier,
      options,
      range: rangeFrom(start, end),
    };
  }

  quoted(ctx: CstQuotedNode): ValueNode {
    const open = ctx.children.OpenQuote?.[0];
    const close = ctx.children.CloseQuote?.[0];
    const toks = ctx.children.Content?.[0]?.children.Content ?? [];
    const text = textFromQuoted(toks);

    const innerStart = (open?.endOffset ?? -1) + 1;
    const innerEnd = close?.startOffset ?? innerStart;

    const lit = literal(text, innerStart, innerEnd);
    return {
      kind: 'VALUE',
      children: [lit],
      range: rangeFrom(open?.startOffset ?? innerStart, (close?.endOffset ?? innerEnd - 1) + 1),
    };
  }

  quotedTemplate(ctx: CstQuotedTemplateNode): ValueNode {
    const open = ctx.children.OpenQuote?.[0];
    const close = ctx.children.CloseQuote?.[0];

    const children: (LiteralNode | TemplateNode)[] = [];

    // Build mixed children maintaining order
    for (const part of ctx.children.Content ?? []) {
      const asTpl = part as unknown as CstTemplateNode;
      if (asTpl.children && (asTpl.children.TemplateOpen || asTpl.children.TemplateClose)) {
        children.push(this.visit(asTpl) as TemplateNode);
      } else {
        // token run outside {{ }} inside quotes
        const toks = (part as CstTokens).children.Content ?? [];
        const text = textFromQuoted(toks);
        const r = rangeFromTokens(toks);
        if (text.length > 0) {
          children.push(literal(text, r.start, r.end));
        }
      }
    }

    const start = open?.startOffset ?? children[0]?.range.start ?? 0;
    const end = (close?.endOffset ?? (children[children.length - 1]?.range.end ?? start) - 1) + 1;

    return { kind: 'VALUE', children, range: rangeFrom(start, end) };
  }

  forIteratorValue(ctx: CstForIteratorNode): ForIteratorNode {
    const open = ctx.children.OpenQuote?.[0];
    const close = ctx.children.CloseQuote?.[0];

    const itTok = ctx.children.Iterator?.[0];
    const iterator = literal(itTok?.image ?? '', itTok?.startOffset ?? 0, (itTok?.endOffset ?? -1) + 1);

    const collText = textFromExpressionTokens(ctx.children.Collection ?? []);
    const collStart = ctx.children.Collection?.[0]?.children.Content?.[0]?.startOffset;
    const collEnd = ctx.children.Collection?.[0]?.children.Content?.slice(-1)[0]?.endOffset;
    const collection: ExpressionNode = {
      kind: 'EXPRESSION',
      value: collText,
      range: rangeFrom(collStart ?? iterator.range.end, (collEnd ?? iterator.range.end - 1) + 1),
    };

    const start = open?.startOffset ?? iterator.range.start;
    const end = (close?.endOffset ?? collection.range.end - 1) + 1;

    return { kind: 'FORITERATOR', iterator, collection, range: rangeFrom(start, end) };
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
      this.errors.push({
        message: `Attribute "${key.value}" is missing a value`,
        range,
      });
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
            this.errors.push({
              message: `Failed to decode HTML entity: ${t.image}`,
              range: rangeFromTokens([t]),
            });
          }
        }
      })
      .join('');
    return literal(text, rangeFromTokens(tokens));
  }

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
      this.errors.push({
        message: `Mismatched closing tag: expected </${name}> but found </${closeTagName}>`,
        range: rangeFromCstNode(closeTag),
      });
    }

    return { kind: 'ELEMENT', name, attributes, children, range: rangeFromCstNode(ctx) };
  }
}

/** Build an AST RootNode (and errors) from a CST produced by the parser. */
export function cstToAst(cst: CstNode): { root: RootNode; errors: AstBuildError[] } {
  const visitor = new ExtendedPomlAstVisitor();
  return visitor.build(cst);
}
