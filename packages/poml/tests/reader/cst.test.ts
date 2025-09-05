import { describe, expect, test } from '@jest/globals';
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
    // Extra fields defined in nodes.ts
    expect(typeof node.isLiteral).toBe('boolean');
    expect(node.tagName?.toLowerCase()).toBe('text');
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
    expect(node.children.Content?.length).toBeGreaterThan(0);
    expect(node.children.CloseTag?.[0]).toBeDefined();
  });

  test('element rule: self-closing element', () => {
    const { node } = withParser('<meta />', (p) => p.element()) as { node: CstElementNode };
    expect(node.children.SelfCloseBracket?.[0].image).toBe('/>');
  });

  test('element rule: literal element treats content as TextContent', () => {
    const input = '<text>Hello {{ name }} </text>';
    const { node } = withParser(input, (p) => p.element()) as { node: CstElementNode };
    expect(node.children.OpenTagPartial?.[0]).toBeDefined();
    expect(node.children.OpenTagCloseBracket?.[0].image).toBe('>');
    // Literal elements should store raw tokens under TextContent (no Template child)
    expect(node.children.TextContent?.length).toBeGreaterThan(0);
    const images = (node.children.TextContent || []).map((t) => (t as any).image);
    expect(images).toContain('{{');
    expect(images).toContain('}}');
    expect(node.children.CloseTag?.[0]).toBeDefined();
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
    const hasElement = contentNodes.some((n) => (n as any).name === 'element');
    expect(hasElement).toBe(true);
  });
});
