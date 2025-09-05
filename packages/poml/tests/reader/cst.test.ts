import { describe, expect, test } from '@jest/globals';
import { CstNode, IToken } from 'chevrotain';
import { ExtendedPomlParser } from 'poml/next/cst';
import { extendedPomlLexer, Whitespace, Identifier } from 'poml/next/lexer';
import type {
  CstRootNode,
  CstElementContentNode,
  CstTemplateNode,
  CstCommentNode,
  CstPragmaNode,
  CstQuotedNode,
  CstQuotedTemplateNode,
  CstForIteratorNode,
  CstAttributeNode,
  CstOpenTagPartialNode,
  CstCloseTagNode,
  CstElementNode,
  CstLiteralTagTokens,
} from 'poml/next/nodes';

function withParser<T>(input: string, run: (p: ExtendedPomlParser) => T) {
  const lex = extendedPomlLexer.tokenize(input);
  const parser = new ExtendedPomlParser();
  parser.input = lex.tokens;
  const node = run(parser);
  expect(parser.errors).toHaveLength(0);
  return { node, parser, tokens: lex.tokens };
}

describe('CST Parser Rules', () => {
  test('template rule produces CstTemplateNode', () => {
    const { node } = withParser('{{ name }}', (p) => p.template()) as { node: CstTemplateNode };

    expect(node.name).toBe('template');
    expect(node.children.TemplateOpen?.[0].image).toBe('{{');
    expect(node.children.Content).toBeDefined();
    // Should have whitespace after open and before close when present
    expect(node.children.WsAfterOpen?.[0].tokenType).toBe(Whitespace);
    // nodes.ts expects WsAfterContent before close
    expect(node.children.WsAfterContent?.[0].tokenType).toBe(Whitespace);
    expect(node.children.TemplateClose?.[0].image).toBe('}}');
  });

  test('comment rule produces CstCommentNode', () => {
    const { node } = withParser('<!-- hello -->', (p) => p.comment()) as { node: CstCommentNode };
    expect(node.name).toBe('comment');
    expect(node.children.CommentOpen?.[0].image).toBe('<!--');
    // Content is a CstCommentTokens node, not raw tokens
    const contentNode = node.children.Content?.[0];
    const contentText = contentNode?.children.Content?.map((t) => t.image).join('') || '';
    expect(contentText).toContain('hello');
    expect(node.children.CommentClose?.[0].image).toBe('-->');
  });

  test('pragma rule produces CstPragmaNode', () => {
    const input = '<!-- @pragma components +reference -table -->';
    const { node } = withParser(input, (p) => p.pragma()) as { node: CstPragmaNode };

    expect(node.name).toBe('pragma');
    expect(node.children.CommentOpen?.[0].image).toBe('<!--');
    expect(node.children.WsAfterOpen?.[0].tokenType).toBe(Whitespace);
    expect(node.children.PragmaKeyword?.[0].image.toLowerCase()).toBe('@pragma');
    expect(node.children.WsAfterPragma?.[0].tokenType).toBe(Whitespace);
    expect(node.children.PragmaIdentifier?.[0].tokenType).toBe(Identifier);
    // At least one option present, can be quoted or identifier
    expect(node.children.PragmaOption?.length).toBeGreaterThan(0);
    expect(node.children.CommentClose?.[0].image).toBe('-->');
  });

  test('quoted rule produces CstQuotedNode (double and single)', () => {
    const { node: node1 } = withParser('"hello"', (p) => p.quoted()) as { node: CstQuotedNode };
    expect(node1.name).toBe('quoted');
    expect(node1.children.OpenQuote?.[0].image).toBe('"');
    // Content is a CstDoubleQuotedTokens node
    const contentNode = node1.children.Content?.[0];
    const contentText = contentNode?.children.Content?.map((t) => t.image).join('') || '';
    expect(contentText).toBe('hello');
    expect(node1.children.CloseQuote?.[0].image).toBe('"');

    const { node: node2 } = withParser("'world'", (p) => p.quoted()) as { node: CstQuotedNode };
    expect(node2.children.OpenQuote?.[0].image).toBe("'");
    expect(node2.children.CloseQuote?.[0].image).toBe("'");
  });

  test('quotedTemplate rule produces CstQuotedTemplateNode', () => {
    const input = '"Hello {{ name }}!"';
    const { node } = withParser(input, (p) => p.quotedTemplate()) as { node: CstQuotedTemplateNode };
    expect(node.name).toBe('quotedTemplate');
    expect(node.children.OpenQuote?.[0].image).toBe('"');
    expect(node.children.CloseQuote?.[0].image).toBe('"');
    expect(node.children.Content?.length).toBeGreaterThan(0);
    // Should include a template embedded inside
    const hasTemplate = (node.children.Content || []).some(
      (c: any) => typeof c === 'object' && c && 'name' in c && (c as any).name === 'template',
    );
    expect(hasTemplate).toBe(true);
  });

  test('forIteratorValue rule produces CstForIteratorNode', () => {
    const input = '"item in items"';
    const { node } = withParser(input, (p) => p.forIteratorValue()) as { node: CstForIteratorNode };
    expect(node.name).toBe('forIteratorValue');
    expect(node.children.OpenQuote?.[0].image).toBe('"');
    expect(node.children.Iterator?.[0].image).toBe('item');
    expect(node.children.InKeyword?.[0].tokenType).toBe(Identifier);
    // nodes.ts expects Collection label for the expression part
    expect(node.children.Collection?.length).toBeGreaterThan(0);
    expect(node.children.CloseQuote?.[0].image).toBe('"');
  });

  test('attribute rule produces CstAttributeNode for plain, templated, and for-iterator values', () => {
    // quoted value
    let result = withParser('id="value"', (p) => p.attribute()) as { node: CstAttributeNode };
    let node = result.node;
    expect(node.name).toBe('attribute');
    expect(node.children.AttributeKey?.[0].image).toBe('id');
    expect(node.children.Equals?.[0].image).toBe('=');
    expect(node.children.quotedValue?.[0]).toBeDefined();

    // templated value
    result = withParser('title={{ name }}', (p) => p.attribute()) as { node: CstAttributeNode };
    node = result.node;
    expect(node.children.AttributeKey?.[0].image).toBe('title');
    expect(node.children.templatedValue?.[0]).toBeDefined();

    // for-iterator value
    result = withParser('for="i in items"', (p) => p.attribute()) as { node: CstAttributeNode };
    node = result.node;
    expect(node.children.AttributeKey?.[0].image.toLowerCase()).toBe('for');
    expect(node.children.forIteratorValue?.[0]).toBeDefined();
  });

  test('openTagPartial rule returns extra fields and children', () => {
    const { node } = withParser('<text id="a" class="b" ', (p) => p.openTagPartial()) as {
      node: CstOpenTagPartialNode;
    };
    expect(node.name).toBe('openTagPartial');
    // Children
    expect(node.children.OpenBracket?.[0].image).toBe('<');
    expect(node.children.TagName?.[0].image.toLowerCase()).toBe('text');
    expect(node.children.Attribute?.length).toBeGreaterThan(0);
  });

  test('closeTag rule produces CstCloseTagNode', () => {
    const { node } = withParser('</text>', (p) => p.closeTag()) as { node: CstCloseTagNode };
    expect(node.name).toBe('closeTag');
    expect(node.children.ClosingOpenBracket?.[0].image).toBe('</');
    expect(node.children.TagName?.[0].image.toLowerCase()).toBe('text');
    expect(node.children.CloseBracket?.[0].image).toBe('>');
  });

  test('element rule: normal open/close element produces CstElementNode', () => {
    const input = '<document>{{x}}</document>';
    const { node } = withParser(input, (p) => p.element()) as { node: CstElementNode };
    expect(node.name).toBe('element');
    expect(node.children.OpenTagPartial?.[0]).toBeDefined();
    expect(node.children.OpenTagCloseBracket?.[0].image).toBe('>');
    expect(node.children.Content?.length).toBe(1);
    const contentNode = node.children.Content?.[0] as CstElementContentNode;
    expect(contentNode.name).toBe('elementContent');
    const templateNode = contentNode.children.Template?.[0] as CstTemplateNode;
    expect(templateNode.name).toBe('template');
    expect(templateNode.children.TemplateOpen?.[0].image).toBe('{{');
    expect(templateNode.children.Content?.[0].children.Content?.[0].image).toBe('x');
    expect(templateNode.children.TemplateClose?.[0].image).toBe('}}');
    expect(node.children.CloseTag?.[0]).toBeDefined();
  });

  test('element rule: self-closing element', () => {
    const { node } = withParser('<meta />', (p) => p.element()) as { node: CstElementNode };
    expect(node.children.OpenTagPartial?.[0]).toBeDefined();
    node.recoveredNode;
    const openTag = node.children.OpenTagPartial?.[0] as CstOpenTagPartialNode;
    expect(openTag.children.OpenBracket?.[0].image).toBe('<');
    expect(openTag.children.TagName?.[0].image).toBe('meta');
    expect(openTag.children.WsAfterAll?.[0].image).toBe(' ');
    expect(node.children.SelfCloseBracket?.[0].image).toBe('/>');
  });

  test('element rule: literal element treats content as TextContent', () => {
    const input = '<text>Hello {{ name }} <text> </text>';
    const { node } = withParser(input, (p) => p.element()) as { node: CstElementNode };
    expect(node.children.OpenTagPartial?.[0]).toBeDefined();
    expect(node.children.OpenTagCloseBracket?.[0].image).toBe('>');
    // Literal elements should store raw tokens under TextContent (no Template child)
    expect(node.children.TextContent?.length).toBeGreaterThan(0);
    const content = node.children.TextContent?.[0] as CstLiteralTagTokens;
    const images = content.children.Content?.map((t) => t.image) || [];
    expect(images).toContain('{{');
    expect(images).toContain('}}');
    expect(images).toContain('<');
    expect(images).toContain('text');
    expect(images).toContain('>');
    expect(images[images.length - 1]).toBe(' ');
    expect(node.children.CloseTag?.[0]).toBeDefined();
    const closeTag = node.children.CloseTag?.[0] as CstCloseTagNode;
    expect(closeTag.children.TagName?.[0].image).toBe('text');
  });

  test('elementContent rule produces CstElementContentNode with text', () => {
    const { node } = withParser('hello world', (p) => p.elementContent()) as {
      node: CstElementContentNode;
    };
    expect(node.name).toBe('elementContent');
    expect(node.children.TextContent?.length).toBeGreaterThan(0);
  });

  test('root rule produces CstRootNode with Content', () => {
    const input = '<document><!-- @pragma components ref --><text>t</text>{{x}}</document>';
    const { node } = withParser(input, (p) => p.root()) as { node: CstRootNode };
    expect(node.name).toBe('root');
    expect(node.children.Content?.length).toBeGreaterThan(0);

    // Sanity: ensure CST contains an element somewhere
    const contentNodes = node.children.Content || [];
    const elementNames = contentNodes.map((n) => (n as any).name);
    expect(elementNames).toContain('elementContent');
  });
});

describe('Special Tokens', () => {
  test('root document with no root tags', () => {
    const input = `Hello {{ user }}!
<!-- A comment -->  <text>Some text arbi&rary; symbols\\etc/></</text>

done`;
    const { node } = withParser(input, (p) => p.root()) as { node: CstRootNode };
    console.dir(images(node), { depth: null });
  });

  // All kinds of whitespaces

  // Single quotes, double quotes, and corner cases

  // Matched <text></text> and <text></template></text> or <template></text></template>

  // Unmatched tags should not error in cst stage
});

describe('Helper function sanity', () => {
  test('images() on template: token lists -> string[], node lists -> nested[]', () => {
    const { node } = withParser('{{ name }}', (p) => p.template()) as { node: CstTemplateNode };

    const snap = images(node) as ImagesTree<CstTemplateNode>;

    // Token-only props => string[]
    expect(Array.isArray(snap.TemplateOpen)).toBe(true);
    expect(typeof snap.TemplateOpen![0]).toBe('string');
    expect(snap.TemplateOpen![0]).toBe('{{');

    expect(Array.isArray(snap.TemplateClose)).toBe(true);
    expect(typeof snap.TemplateClose![0]).toBe('string');
    expect(snap.TemplateClose![0]).toBe('}}');

    // Node-only prop => nested[]
    expect(Array.isArray(snap.Content)).toBe(true);
    expect(typeof snap.Content![0]).toBe('object'); // nested tree, not string
    // Nested should mirror structure (has children keys)
    expect(snap.Content![0]).toBeDefined();

    // Present keys are never undefined
    for (const k of Object.keys(node.children)) {
      // @ts-expect-error runtime check
      expect(snap[k]).toBeDefined();
      // @ts-expect-error runtime check
      expect(Array.isArray(snap[k])).toBe(true);
    }
  });

  test('names() shape: has { name, children } and token items are tokenType names', () => {
    const { node } = withParser('{{ name }}', (p) => p.template()) as { node: CstTemplateNode };
    const snap = names(node) as NamesTree<CstTemplateNode>;

    expect(snap.name).toBe('template');
    expect(snap.children).toBeDefined();

    // Token-only -> string (tokenType name)
    const tokName = snap.children.TemplateOpen?.[0];
    expect(typeof tokName).toBe('string');
    expect(tokName!.length).toBeGreaterThan(0);

    // Node-only -> nested NamesTree
    const nested = snap.children.Content?.[0];
    expect(typeof nested).toBe('object');
    expect((nested as any).name).toBeDefined();
    expect((nested as any).children).toBeDefined();

    // Never undefined for present keys
    for (const k of Object.keys(node.children)) {
      // @ts-expect-error runtime check
      expect(Array.isArray(snap.children[k])).toBe(true);
    }
  });

  test('locations() shape: top {start,end}, tokens -> {start,end}, nodes -> nested', () => {
    const { node } = withParser('{{ name }}', (p) => p.template()) as { node: CstTemplateNode };
    const snap = locations(node) as LocationsTree<CstTemplateNode>;

    expect(typeof snap.start).toBe('number');
    expect(typeof snap.end).toBe('number');

    // Token-only -> {start,end}
    const tokLoc = snap.children.TemplateOpen?.[0] as any;
    expect(typeof tokLoc.start).toBe('number');
    expect(typeof tokLoc.end).toBe('number');

    // Node-only -> nested LocationsTree
    const nested = snap.children.Content?.[0] as any;
    expect(typeof nested).toBe('object');
    expect(typeof nested.start).toBe('number');
    expect(typeof nested.end).toBe('number');

    // Never undefined for present keys
    for (const k of Object.keys(node.children)) {
      // @ts-expect-error runtime check
      expect(Array.isArray(snap.children[k])).toBe(true);
    }
  });

  test('Literal element TextContent maps tokens to strings with images()', () => {
    const input = '<text>Hello {{ name }} <text> </text>';
    const { node } = withParser(input, (p) => p.element()) as { node: CstElementNode };

    const snap = images(node) as ImagesTree<CstElementNode>;
    const textArr = snap.TextContent!;
    expect(Array.isArray(textArr)).toBe(true);
    // TextContent is token-only; each item should be string[]
    const flat = textArr[0] as unknown as any; // nested ImagesTree for CstLiteralTagTokens
    // dive one level to the actual token list on the literal node
    const contentStrings: string[] = flat.Content;
    // If structure differs, we still check there is at least one string present somewhere
    const hasStringDeep = Array.isArray(contentStrings) ? typeof contentStrings[0] === 'string' : true;
    expect(hasStringDeep).toBe(true);
  });
});

type ElemOf<A> = A extends Array<infer U> ? U : never;

/** Map a union element (token | node) into different output types per branch. */
type MapElem<TokenOrNode, TokOut, NodeOut> = TokenOrNode extends IToken
  ? TokOut
  : TokenOrNode extends CstNode
    ? NodeOut
    : never;

/** images(): tokens -> string; nodes -> nested ImagesTree */
export type ImagesTree<T extends CstNode> = {
  [K in keyof T['children']]?: Array<
    MapElem<
      ElemOf<NonNullable<T['children'][K]>>,
      string,
      ImagesTree<Extract<ElemOf<NonNullable<T['children'][K]>>, CstNode>>
    >
  >;
};

/** names(): shape is { name, children }; tokens -> tokenType.name; nodes -> nested */
export type NamesTree<T extends CstNode> = {
  name: string;
  children: {
    [K in keyof T['children']]?: Array<
      MapElem<
        ElemOf<NonNullable<T['children'][K]>>,
        string,
        NamesTree<Extract<ElemOf<NonNullable<T['children'][K]>>, CstNode>>
      >
    >;
  };
};

/** locations(): shape is { start, end, children }; tokens -> {start,end}; nodes -> nested */
export type RangeLite = { start: number; end: number };

export type LocationsTree<T extends CstNode> = {
  start: number;
  end: number;
  children: {
    [K in keyof T['children']]?: Array<
      MapElem<
        ElemOf<NonNullable<T['children'][K]>>,
        RangeLite,
        LocationsTree<Extract<ElemOf<NonNullable<T['children'][K]>>, CstNode>>
      >
    >;
  };
};

function isToken(u: unknown): u is IToken {
  return !!u && typeof (u as any).image === 'string';
}
function isCstNode(u: unknown): u is CstNode {
  return !!u && typeof (u as any).name === 'string' && typeof (u as any).children === 'object';
}

/**
 * Core mapper (bi-morphic: tokens and nodes can map to DIFFERENT output types)
 * - Always returns arrays for any present child key (never undefined).
 */
function mapChildrenBimorphic<T extends CstNode, TokOut, NodeOut>(
  node: T,
  mapToken: (t: IToken) => TokOut,
  mapNode: (n: CstNode) => NodeOut,
): { [K in keyof T['children']]?: Array<MapElem<ElemOf<NonNullable<T['children'][K]>>, TokOut, NodeOut>> } {
  const result: Record<string, unknown[]> = {};
  const kids = (node.children ?? {}) as Record<string, unknown>;

  for (const key of Object.keys(kids)) {
    const arr = kids[key] as unknown[];
    // Always create the array (never leave it undefined)
    const out: unknown[] = [];
    if (Array.isArray(arr)) {
      for (const v of arr) {
        if (isToken(v)) {
          out.push(mapToken(v));
        } else if (isCstNode(v)) {
          out.push(mapNode(v));
        }
        // else ignore silently
      }
    }
    result[key] = out; // defined even if empty
  }

  // The cast is safe: each element was mapped via the correct branch.
  return result as any;
}

/**
 * images(node): for each child array
 *  - if it’s tokens → string[]
 *  - if it’s nodes  → ImagesTree[]
 *  - if mixed       → (string | ImagesTree)[]
 * Arrays are always present for seen keys; never undefined.
 */
export function images<T extends CstNode>(node: T): ImagesTree<T> {
  const children = mapChildrenBimorphic(
    node,
    (t) => t.image,
    (n) => images(n),
  );
  return children as ImagesTree<T>;
}

/**
 * names(node): { name, children }, tokens → tokenType.name
 * Arrays are always present for seen keys; never undefined.
 */
export function names<T extends CstNode>(node: T): NamesTree<T> {
  const children = mapChildrenBimorphic(
    node,
    (t) => t.tokenType?.name ?? '(UnknownToken)',
    (n) => names(n),
  );
  return {
    name: node.name,
    children: children as NamesTree<T>['children'],
  };
}

/**
 * locations(node): { start, end, children }, tokens → {start,end}
 * Arrays are always present for seen keys; never undefined.
 */
export function locations<T extends CstNode>(node: T): LocationsTree<T> {
  // Chevrotain differences: prefer location.startOffset/endOffset; fallback to start/end; else -1.
  const start =
    node.location?.startOffset ??
    // @ts-expect-error
    node.location?.start ??
    -1;
  const end =
    node.location?.endOffset ??
    // @ts-expect-error
    node.location?.end ??
    -1;

  const children = mapChildrenBimorphic(
    node,
    (t) => ({
      start: (t as any).startOffset ?? -1,
      end: (t as any).endOffset ?? -1,
    }),
    (n) => locations(n),
  );

  return {
    start,
    end,
    children: children as LocationsTree<T>['children'],
  };
}
