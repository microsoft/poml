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
  OpenTagNode,
  CloseTagNode,
  SelfCloseElementNode,
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

/** Error produced while building the AST (beyond lex/parse errors). */
export interface AstBuildError {
  message: string;
  range?: Range;
}

/** Utility: build a range from two offsets (inclusive start, exclusive end). */
function rangeFrom(start: number, end: number): Range {
  return { start, end };
}

/** Utility: range that spans a list of tokens (or is empty if none). */
function rangeFromTokens(tokens: IToken[]): Range {
  if (!tokens.length) {
return { start: 0, end: 0 };
}
  const first = tokens[0];
  const last = tokens[tokens.length - 1];
  return rangeFrom(first.startOffset ?? 0, (last.endOffset ?? first.startOffset ?? 0) + 1);
}

/** Utility: create a LiteralNode from raw text and token range. */
function literal(value: string, start: number, end: number): LiteralNode {
  return { kind: 'STRING', value, range: rangeFrom(start, end) };
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
 * Gather text from tokens INSIDE TEMPLATE EXPRESSION ({{ ... }}).
 * We simply join raw images because evaluation is a later phase.
 */
function textFromExpressionTokens(groups: CstTokens[]): string {
  const pieces: string[] = [];
  for (const g of groups) {
    const toks = g.children.Content ?? [];
    pieces.push(textFromRaw(toks));
  }
  return pieces.join('');
}

/** Build a range from a CST token group sequence. */
function rangeFromTokenGroups(groups: CstTokens[], fallback: Range): Range {
  const firstTok = groups[0]?.children.Content?.[0];
  const lastGroup = groups[groups.length - 1];
  const lastTok = lastGroup?.children.Content?.[lastGroup.children.Content.length - 1];
  if (firstTok && lastTok) {
    return rangeFrom(firstTok.startOffset ?? 0, (lastTok.endOffset ?? 0) + 1);
  }
  return fallback;
}

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

  // ---- Private helper methods ----

  /**
   * Gather text from tokens for TEXT CONTENT (between tags).
   * Rules:
   * - Character entities are decoded
   * - Backslash escapes are NOT interpreted (shown as-is)
   */
  //   private textFromBetweenTags(tokens: IToken[]): string {
  //     return tokens
  //       .map((t) => {
  //         if (t.tokenType === CharacterEntity) {
  //           try {
  //             return he.decode(t.image ?? '', { strict: true });
  //           } catch (e) {
  //             this.errors.push({
  //               message: `Failed to decode HTML entity: ${t.image}`,
  //               range: rangeFromTokens([t])
  //             })
  //           }
  //         }
  //       }
  //         if (name === 'CharacterEntity') return decodeEntity(t.image ?? '')
  //     return t.image ?? ''
  //   })
  //       .join('')
  // }

  // ---- Rule implementations ----

  root(ctx: CstRootNode): RootNode {
    const children: ElementContentNode[] = [];
    for (const ec of ctx.children.Content ?? []) {
      const node = this.visit(ec) as ElementContentNode;
      if (node) {
children.push(node);
}
    }

    const start = children[0]?.range.start ?? 0;
    const end = children.length ? children[children.length - 1].range.end : 0;
    return { kind: 'ROOT', children, range: rangeFrom(start, end) };
  }

  elementContent(ctx: CstElementContentNode): ElementContentNode {
    if (ctx.Pragma?.length) {
return this.visit(ctx.Pragma[0]) as PragmaNode;
}
    if (ctx.Comment?.length) {
return this.visit(ctx.Comment[0]) as CommentNode;
}
    if (ctx.Template?.length) {
return this.visit(ctx.Template[0]) as TemplateNode;
}
    if (ctx.Element?.length) {
return this.visit(ctx.Element[0]) as ElementNode;
}

    // Text content between tags → LiteralNode
    const toks = ctx.TextContent?.[0]?.children.Content ?? [];
    const text = textFromBetweenTags(toks);
    const r = rangeFromTokens(toks);
    return literal(text, r.start, r.end);
  }

  template(ctx: CstTemplateNode): TemplateNode {
    const open = ctx.children.TemplateOpen?.[0];
    const close = ctx.children.TemplateClose?.[0];

    const exprText = textFromExpressionTokens(ctx.children.Content ?? []);

    // Expression node range: inner content without braces/outer ws if present
    const innerStart =
      ctx.children.WsAfterOpen?.[0]?.endOffset != null
        ? ctx.children.WsAfterOpen[0].endOffset + 1
        : (open?.endOffset ?? 0) + 1;
    const innerEnd =
      ctx.children.WsAfterContent?.[0]?.startOffset != null
        ? ctx.children.WsAfterContent[0].startOffset
        : (close?.startOffset ?? innerStart);

    const exprNode: ExpressionNode = {
      kind: 'EXPRESSION',
      value: exprText,
      range: rangeFrom(innerStart, innerEnd),
    };

    const outerStart = open?.startOffset ?? innerStart;
    const outerEnd = (close?.endOffset ?? outerStart - 1) + 1;

    return { kind: 'TEMPLATE', value: exprNode, range: rangeFrom(outerStart, outerEnd) };
  }

  comment(ctx: CstCommentNode): CommentNode {
    const open = ctx.children.CommentOpen?.[0];
    const close = ctx.children.CommentClose?.[0];
    const toks = ctx.children.Content?.[0]?.children.Content ?? [];
    const text = rawFrom(toks);
    const innerStart = (open?.endOffset ?? -1) + 1;
    const innerEnd = close?.startOffset ?? innerStart;
    return {
      kind: 'COMMENT',
      value: literal(text, innerStart, innerEnd),
      range: rangeFrom(open?.startOffset ?? innerStart, (close?.endOffset ?? innerEnd - 1) + 1),
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
    const keyTok = ctx.children.AttributeKey?.[0];
    const key: LiteralNode = literal(keyTok?.image ?? '', keyTok?.startOffset ?? 0, (keyTok?.endOffset ?? -1) + 1);

    let value: ValueNode | ForIteratorNode;

    if (ctx.children.forIteratorValue?.length) {
      value = this.visit(ctx.children.forIteratorValue[0]) as ForIteratorNode;
    } else if (ctx.children.quotedValue?.length) {
      value = this.visit(ctx.children.quotedValue[0]) as ValueNode;
    } else if (ctx.children.templatedValue?.length) {
      // Unquoted: key={{ expr }} → wrap as ValueNode with a TemplateNode child
      const tpl = this.visit(ctx.children.templatedValue[0]) as TemplateNode;
      value = { kind: 'VALUE', children: [tpl], range: tpl.range };
    } else {
      // Fallback empty value
      value = { kind: 'VALUE', children: [], range: key.range };
    }

    const start = key.range.start;
    const end = value.range.end;

    return { kind: 'ATTRIBUTE', key, value, range: rangeFrom(start, end) };
  }

  openTagPartial(ctx: CstOpenTagPartialNode): OpenTagNode | { partialEnd: number } {
    const open = ctx.children.OpenBracket?.[0];
    const nameTok = ctx.children.TagName?.[0];

    const tagName = nameTok?.image ?? '';
    const tagStart = open?.startOffset ?? nameTok?.startOffset ?? 0;
    let lastEnd = (nameTok?.endOffset ?? tagStart) + 1;

    const attributes: AttributeNode[] = [];
    for (const a of ctx.children.Attribute ?? []) {
      const attr = this.visit(a) as AttributeNode;
      attributes.push(attr);
      lastEnd = Math.max(lastEnd, attr.range.end);
    }

    const node: OpenTagNode = {
      kind: 'OPEN',
      value: literal(tagName, nameTok?.startOffset ?? tagStart, (nameTok?.endOffset ?? tagStart - 1) + 1),
      attributes,
      range: rangeFrom(tagStart, lastEnd),
    };

    return node as any;
  }

  closeTag(ctx: CstCloseTagNode): CloseTagNode {
    const open = ctx.children.ClosingOpenBracket?.[0];
    const nameTok = ctx.children.TagName?.[0];
    const close = ctx.children.CloseBracket?.[0];

    const start = open?.startOffset ?? nameTok?.startOffset ?? 0;
    const end = (close?.endOffset ?? (nameTok?.endOffset ?? start) - 1) + 1;

    return {
      kind: 'CLOSE',
      value: literal(nameTok?.image ?? '', nameTok?.startOffset ?? start, (nameTok?.endOffset ?? start - 1) + 1),
      range: rangeFrom(start, end),
    };
  }

  element(ctx: CstElementNode): ElementNode | SelfCloseElementNode {
    const partial = this.visit(ctx.children.OpenTagPartial?.[0]!) as OpenTagNode;

    if (ctx.children.SelfCloseBracket?.length) {
      const selfTok = ctx.children.SelfCloseBracket[0];
      const end = (selfTok.endOffset ?? partial.range.end - 1) + 1;
      return {
        kind: 'SELFCLOSE',
        value: partial.value,
        attributes: partial.attributes,
        range: rangeFrom(partial.range.start, end),
      };
    }

    // Normal or literal element with explicit CloseTag
    const openCloseTok = ctx.children.OpenTagCloseBracket?.[0];
    let children: ElementContentNode[] = [];
    let close: CloseTagNode;

    if (ctx.children.TextContent?.length) {
      // Literal element: everything inside is plain text (no template interpolation)
      const toks = ctx.children.TextContent[0].children.Content ?? [];
      const text = rawFrom(toks);
      const r = rangeFromTokens(toks);
      children = [literal(text, r.start, r.end)];
    } else {
      // Normal element: nested content parsed as usual
      for (const ec of ctx.children.Content ?? []) {
        children.push(this.visit(ec) as ElementContentNode);
      }
    }

    close = this.visit(ctx.children.CloseTag?.[0]!) as CloseTagNode;

    // Tag name matching check
    const openName = partial.value.value.toLowerCase();
    const closeName = close.value.value.toLowerCase();
    if (openName !== closeName) {
      this.errors.push({
        message: `Mismatched closing tag: expected </${openName}> but found </${closeName}>`,
        range: close.range,
      });
    }

    const start = partial.range.start;
    const end = close.range.end;

    return { kind: 'ELEMENT', open: partial, close, children, range: rangeFrom(start, end) };
  }
}

// ---------------------------
// Public helpers
// ---------------------------

/** Build an AST RootNode (and errors) from a CST produced by the parser. */
export function cstToAst(cst: CstNode): { root: RootNode; errors: AstBuildError[] } {
  const visitor = new ExtendedPomlAstVisitor();
  return visitor.build(cst);
}

/** Convenience: from input string → { root, errors } using the full pipeline. */
export function parsePomlToAst(input: string): { root: RootNode | undefined; errors: AstBuildError[] } {
  const { cst } = (extendedPomlParser as any).constructor.parse
    ? ((): any => {
        throw new Error('Use parsePomlToCst from cst.ts to obtain a CST first.');
      })()
    : { cst: undefined };
  // The parser wrapper already exists: users should call parsePomlToCst then cstToAst.
  return { root: undefined, errors: [{ message: 'Call parsePomlToCst(input) then cstToAst(cst).' }] };
}
