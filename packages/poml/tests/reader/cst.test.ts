import { describe, expect, test } from '@jest/globals';
import { CstNode, IToken } from 'chevrotain';
import { ExtendedPomlParser } from 'poml/next/cst';
import { extendedPomlLexer, Whitespace, Identifier } from 'poml/next/lexer';
import {
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
  CstTokens,
} from 'poml/next/nodes';

function withParser<T>(input: string, run: (p: ExtendedPomlParser) => T, raiseOnError?: boolean) {
  const lex = extendedPomlLexer.tokenize(input);
  const parser = new ExtendedPomlParser();
  parser.input = lex.tokens;
  const node = run(parser);
  if (raiseOnError || raiseOnError === undefined) {
    expect(parser.errors).toHaveLength(0);
  }
  return { node, parser, tokens: lex.tokens, errors: parser.errors };
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
    const content = node.children.TextContent?.[0] as CstTokens;
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

    expect(node.location).toEqual({
      startOffset: 0,
      startLine: 1,
      startColumn: 1,
      endOffset: 70,
      endLine: 1,
      endColumn: 71,
    });
  });
});

describe('Special Tokens', () => {
  test('root document with no root tags', () => {
    const input = `Hello {{ user }}!
<!-- A comment -->  <text>Some text arbi&rary; symbols\\etc/></</text>

done`;
    const { node } = withParser(input, (p) => p.root()) as { node: CstRootNode };
    expect(images(node)).toStrictEqual([
      { TextContent: 'Hello ' },
      {
        Template: {
          TemplateOpen: '{{',
          WsAfterOpen: ' ',
          Content: 'user',
          WsAfterContent: ' ',
          TemplateClose: '}}',
        },
      },
      { TextContent: '!\n' },
      {
        Comment: {
          CommentOpen: '<!--',
          Content: ' A comment ',
          CommentClose: '-->',
        },
      },
      { TextContent: '  ' },
      {
        Element: {
          OpenTagPartial: { OpenBracket: '<', TagName: 'text' },
          OpenTagCloseBracket: '>',
          TextContent: 'Some text arbi&rary; symbols\\etc/></',
          CloseTag: { ClosingOpenBracket: '</', TagName: 'text', CloseBracket: '>' },
        },
      },
      { TextContent: '\n\ndone' },
    ]);

    expect(names(node)).toStrictEqual({
      name: 'root',
      children: [
        {
          name: 'elementContent',
          children: { TextContent: { name: 'betweenTagsTokens' } },
        },
        {
          name: 'elementContent',
          children: {
            Template: { name: 'template', children: { name: 'expressionTokens' } },
          },
        },
        {
          name: 'elementContent',
          children: { TextContent: { name: 'betweenTagsTokens' } },
        },
        {
          name: 'elementContent',
          children: {
            Comment: { name: 'comment', children: { name: 'commentTokens' } },
          },
        },
        {
          name: 'elementContent',
          children: { TextContent: { name: 'betweenTagsTokens' } },
        },
        {
          name: 'elementContent',
          children: {
            Element: {
              name: 'element',
              children: {
                OpenTagPartial: { name: 'openTagPartial' },
                TextContent: { name: 'literalTagTokens' },
                CloseTag: { name: 'closeTag' },
              },
            },
          },
        },
        {
          name: 'elementContent',
          children: { TextContent: { name: 'betweenTagsTokens' } },
        },
      ],
    });

    expect(locations(node)).toStrictEqual({
      start: 0,
      end: 92,
      children: [
        {
          start: 0,
          end: 5,
          children: { TextContent: { start: 0, end: 5 } },
        },
        {
          start: 6,
          end: 15,
          children: {
            Template: { start: 6, end: 15, children: { start: 9, end: 12 } },
          },
        },
        {
          start: 16,
          end: 17,
          children: { TextContent: { start: 16, end: 17 } },
        },
        {
          start: 18,
          end: 35,
          children: {
            Comment: { start: 18, end: 35, children: { start: 22, end: 32 } },
          },
        },
        {
          start: 36,
          end: 37,
          children: { TextContent: { start: 36, end: 37 } },
        },
        {
          start: 38,
          end: 86,
          children: {
            Element: {
              start: 38,
              end: 86,
              children: {
                OpenTagPartial: { start: 38, end: 42 },
                TextContent: { start: 44, end: 79 },
                CloseTag: { start: 80, end: 86 },
              },
            },
          },
        },
        {
          start: 87,
          end: 92,
          children: { TextContent: { start: 87, end: 92 } },
        },
      ],
    });
  });

  test('all kinds of whitespaces', () => {
    const input = `\t\n\r <\tdocument\t  >\n\t 　 {{  　 name   }}\r\n\t</document> 　 \t\n`;
    const { node } = withParser(input, (p) => p.root()) as { node: CstRootNode };

    expect(images(node)).toStrictEqual([
      { TextContent: '\t\n\r ' },
      {
        Element: {
          OpenTagPartial: {
            OpenBracket: '<',
            WsAfterOpen: '\t',
            TagName: 'document',
            WsAfterAll: '\t  ',
          },
          OpenTagCloseBracket: '>',
          Content: [
            { TextContent: '\n\t 　 ' },
            {
              Template: {
                TemplateOpen: '{{',
                WsAfterOpen: '  ',
                Content: '　 name',
                WsAfterContent: '   ',
                TemplateClose: '}}',
              },
            },
            { TextContent: '\r\n\t' },
          ],
          CloseTag: {
            ClosingOpenBracket: '</',
            TagName: 'document',
            CloseBracket: '>',
          },
        },
      },
      { TextContent: ' 　 \t\n' },
    ]);
  });

  test('single quotes vs double quotes edge cases', () => {
    const input = `<  div id='single' class="double"  > {{ 'nested "quote"' }} </ div   >`;
    const { node } = withParser(input, (p) => p.root()) as { node: CstRootNode };

    expect(images(node)).toStrictEqual({
      Element: {
        OpenTagPartial: {
          OpenBracket: '<',
          TagName: 'div',
          Attribute: [
            { AttributeKey: 'id', Equals: '=', quotedValue: { OpenQuote: "'", Content: 'single', CloseQuote: "'" } },
            { AttributeKey: 'class', Equals: '=', quotedValue: { OpenQuote: '"', Content: 'double', CloseQuote: '"' } },
          ],
          WsBeforeEachAttribute: '  ',
          WsAfterOpen: '  ',
          WsAfterAll: '  ',
        },
        OpenTagCloseBracket: '>',
        Content: [
          { TextContent: ' ' },
          {
            Template: {
              TemplateOpen: '{{',
              WsAfterOpen: ' ',
              Content: '\'nested "quote"\'',
              WsAfterContent: ' ',
              TemplateClose: '}}',
            },
          },
          { TextContent: ' ' },
        ],
        CloseTag: {
          ClosingOpenBracket: '</',
          TagName: 'div',
          CloseBracket: '>',
          WsAfterOpen: ' ',
          WsBeforeClose: '   ',
        },
      },
    });
  });

  test('empty quotes edge cases', () => {
    const input = `<tag attr1="" attr2=''></tag>`;
    const { node } = withParser(input, (p) => p.root()) as { node: CstRootNode };

    expect(images(node)).toStrictEqual({
      Element: {
        OpenTagPartial: {
          OpenBracket: '<',
          TagName: 'tag',
          Attribute: [
            { AttributeKey: 'attr1', Equals: '=', quotedValue: { OpenQuote: '"', CloseQuote: '"' } },
            { AttributeKey: 'attr2', Equals: '=', quotedValue: { OpenQuote: "'", CloseQuote: "'" } },
          ],
          WsBeforeEachAttribute: '  ',
        },
        OpenTagCloseBracket: '>',
        CloseTag: { ClosingOpenBracket: '</', TagName: 'tag', CloseBracket: '>' },
      },
    });
  });

  test('matched text element with literal content', () => {
    const input = `<text>Hello {{ world }} and <other>nested</other></text>`;
    const { node } = withParser(input, (p) => p.root()) as { node: CstRootNode };

    expect(images(node)).toStrictEqual({
      Element: {
        OpenTagPartial: { OpenBracket: '<', TagName: 'text' },
        OpenTagCloseBracket: '>',
        TextContent: 'Hello {{ world }} and <other>nested</other>',
        CloseTag: { ClosingOpenBracket: '</', TagName: 'text', CloseBracket: '>' },
      },
    });
  });

  test('mismatched tags - text opening with template closing', () => {
    const input = `<text>Content here</template></text>`;
    const { node } = withParser(input, (p) => p.root()) as { node: CstRootNode };

    expect(images(node)).toStrictEqual({
      Element: {
        CloseTag: { CloseBracket: '>', ClosingOpenBracket: '</', TagName: 'text' },
        OpenTagCloseBracket: '>',
        OpenTagPartial: { OpenBracket: '<', TagName: 'text' },
        TextContent: 'Content here</template>',
      },
    });
  });

  test('completely unmatched tags should not error', () => {
    const input = `<document>content</div><span>more</p>`;
    const { node } = withParser(input, (p) => p.root()) as { node: CstRootNode };

    expect(images(node)).toStrictEqual([
      {
        Element: {
          OpenTagPartial: { OpenBracket: '<', TagName: 'document' },
          OpenTagCloseBracket: '>',
          Content: { TextContent: 'content' },
          CloseTag: { ClosingOpenBracket: '</', TagName: 'div', CloseBracket: '>' },
        },
      },
      {
        Element: {
          OpenTagPartial: { OpenBracket: '<', TagName: 'span' },
          OpenTagCloseBracket: '>',
          Content: { TextContent: 'more' },
          CloseTag: { ClosingOpenBracket: '</', TagName: 'p', CloseBracket: '>' },
        },
      },
    ]);
  });

  test('nested quoted templates with mixed quotes', () => {
    const input = `<div title="Hello {{ 'user' }}"  meta  = '{if{{nothing''  }}123'>'World'</div>`;
    const { node } = withParser(input, (p) => p.root()) as { node: CstRootNode };

    expect(images(node)).toStrictEqual({
      Element: {
        OpenTagPartial: {
          OpenBracket: '<',
          TagName: 'div',
          WsBeforeEachAttribute: '   ',
          Attribute: [
            {
              AttributeKey: 'title',
              Equals: '=',
              quotedValue: {
                OpenQuote: '"',
                Content: [
                  'Hello ',
                  {
                    TemplateOpen: '{{',
                    WsAfterOpen: ' ',
                    Content: "'user'",
                    WsAfterContent: ' ',
                    TemplateClose: '}}',
                  },
                ],
                CloseQuote: '"',
              },
            },
            {
              AttributeKey: 'meta',
              Equals: '=',
              WsAfterEquals: ' ',
              WsAfterKey: '  ',
              quotedValue: {
                CloseQuote: "'",
                Content: [
                  '{if',
                  {
                    Content: "nothing''",
                    TemplateClose: '}}',
                    TemplateOpen: '{{',
                    WsAfterContent: '  ',
                  },
                  '123',
                ],
                OpenQuote: "'",
              },
            },
          ],
        },
        OpenTagCloseBracket: '>',
        Content: {
          TextContent: "'World'",
        },
        CloseTag: { ClosingOpenBracket: '</', TagName: 'div', CloseBracket: '>' },
      },
    });
  });

  test('special characters and symbols in content', () => {
    const input = `<text>@#$%^&*(){}[]|\\:";'<>?/.,~\`</text>`;
    const { node } = withParser(input, (p) => p.root()) as { node: CstRootNode };

    expect(images(node)).toStrictEqual({
      Element: {
        OpenTagPartial: { OpenBracket: '<', TagName: 'text' },
        OpenTagCloseBracket: '>',
        TextContent: '@#$%^&*(){}[]|\\:";\'<>?/.,~`',
        CloseTag: { ClosingOpenBracket: '</', TagName: 'text', CloseBracket: '>' },
      },
    });
  });

  test('multiple templates and elements mixed with whitespace', () => {
    const input = `  {{ a }}  <div>{{ b }}</div>  {{ c }}  `;
    const { node } = withParser(input, (p) => p.root()) as { node: CstRootNode };

    expect(images(node)).toStrictEqual([
      { TextContent: '  ' },
      {
        Template: {
          TemplateOpen: '{{',
          WsAfterOpen: ' ',
          Content: 'a',
          WsAfterContent: ' ',
          TemplateClose: '}}',
        },
      },
      { TextContent: '  ' },
      {
        Element: {
          OpenTagPartial: { OpenBracket: '<', TagName: 'div' },
          OpenTagCloseBracket: '>',
          Content: {
            Template: {
              TemplateOpen: '{{',
              WsAfterOpen: ' ',
              Content: 'b',
              WsAfterContent: ' ',
              TemplateClose: '}}',
            },
          },
          CloseTag: { ClosingOpenBracket: '</', TagName: 'div', CloseBracket: '>' },
        },
      },
      { TextContent: '  ' },
      {
        Template: {
          TemplateOpen: '{{',
          WsAfterOpen: ' ',
          Content: 'c',
          WsAfterContent: ' ',
          TemplateClose: '}}',
        },
      },
      { TextContent: '  ' },
    ]);
  });
});

describe('Error', () => {
  test('orphan closing tags should error', () => {
    const input = `Some text</orphan>{{ template }}</unknown>`;
    const { node, errors } = withParser(input, (p) => p.root(), false) as { node: CstRootNode; errors: any[] };
    expect(errors.length).toBe(4);

    expect(images(node)).toStrictEqual([
      { TextContent: 'Some text' },
      { TextContent: 'orphan' },
      {
        Template: {
          TemplateOpen: '{{',
          WsAfterOpen: ' ',
          Content: 'template',
          WsAfterContent: ' ',
          TemplateClose: '}}',
        },
      },
      { TextContent: 'unknown' },
    ]);
  });

  test('mismatched tags - template opening with text closing', () => {
    const input = `<template>Some content</text>`;
    const { node, errors } = withParser(input, (p) => p.root(), false) as { node: CstRootNode; errors: any[] };
    expect(errors.length).toBe(1);

    expect(images(node)).toStrictEqual({
      Element: {
        OpenTagPartial: { OpenBracket: '<', TagName: 'template' },
        OpenTagCloseBracket: '>',
        TextContent: 'Some content</text>',
      },
    });

    expect(names(node)).toStrictEqual({
      name: 'root',
      children: {
        name: 'elementContent',
        children: {
          Element: {
            name: 'element',
            children: {
              OpenTagPartial: { name: 'openTagPartial' },
              TextContent: { name: 'literalTagTokens' },
              CloseTag: { name: 'closeTag' },
            },
          },
        },
      },
    });
  });

  test('empty template', () => {
    const input = `<any foo={{}}>{{ }}</any>`;
    const { node, errors } = withParser(input, (p) => p.root(), false) as { node: CstRootNode; errors: any[] };
    expect(errors.length).toBe(2);
    expect(images(node)).toStrictEqual({
      Element: {
        OpenTagPartial: {
          OpenBracket: '<',
          TagName: 'any',
          WsBeforeEachAttribute: ' ',
          Attribute: {
            AttributeKey: 'foo',
            Equals: '=',
            templatedValue: { TemplateOpen: '{{', TemplateClose: '}}' },
          },
        },
        OpenTagCloseBracket: '>',
        Content: {
          Template: { TemplateOpen: '{{', WsAfterOpen: ' ', TemplateClose: '}}' },
        },
        CloseTag: { ClosingOpenBracket: '</', TagName: 'any', CloseBracket: '>' },
      },
    });
  });
});

/* -------------------- tiny guards -------------------- */
const isToken = (x: unknown): x is IToken => !!x && typeof (x as IToken).image === 'string';

const isCstNode = (x: unknown): x is CstNode =>
  !!x && typeof (x as any).name === 'string' && typeof (x as any).children === 'object';

/* -------------------- core normalize -------------------- */
/**
 * Rules:
 * - drop undefined
 * - arrays: [] -> undefined; [x] -> x; [strings...] -> joined string; otherwise keep (with inner normalize)
 * - objects: normalize recursively; if only key is "Content" -> unwrap value
 */
function normalizeAny(v: unknown): unknown {
  if (v == null) {
    return undefined;
  }
  if (Array.isArray(v)) {
    return normalizeArray(v);
  }
  if (isToken(v) || isCstNode(v)) {
    return v;
  }
  if (typeof v === 'object') {
    return normalizeObject(v as Record<string, unknown>);
  }
  return v;
}

function normalizeArray(arr: unknown[]): unknown {
  const mapped = arr.map(normalizeAny).filter((v) => v !== undefined);

  if (mapped.length === 0) {
    return undefined;
  }
  if (mapped.every((x) => typeof x === 'string')) {
    // concatenate pure string arrays
    return (mapped as string[]).join('');
  }
  if (mapped.length === 1) {
    return mapped[0];
  }
  return mapped;
}

function normalizeObject(obj: Record<string, unknown>): unknown {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const nv = normalizeAny(v);
    if (nv !== undefined) {
      out[k] = nv;
    }
  }
  const keys = Object.keys(out);
  if (keys.length === 0) {
    return undefined;
  }
  if (keys.length === 1 && keys[0] === 'Content') {
    return out.Content;
  }
  return out;
}

function normalizeChildren(node: CstNode): unknown {
  return normalizeObject(node.children as Record<string, unknown>);
}

/* -------------------- generic transformer -------------------- */
type Mode = 'images' | 'names' | 'locations';

type Strategies = {
  onToken(v: IToken): unknown; // what to emit for a token
  onNodeWrap(n: CstNode, children: unknown): unknown; // how to wrap a CST node around its transformed children
  keepChildKey(k: string, v: unknown): boolean; // allow pruning of token-only branches
};

function transformValue(val: unknown, S: Strategies): unknown {
  if (val == null) {
    return undefined;
  }

  if (isToken(val)) {
    return S.onToken(val);
  }

  if (Array.isArray(val)) {
    const mapped = val.map((x) => transformValue(x, S)).filter((x) => x !== undefined);
    if (mapped.length === 0) {
      return undefined;
    }
    if (mapped.every((x) => typeof x === 'string')) {
      return (mapped as string[]).join('');
    }
    if (mapped.length === 1) {
      return mapped[0];
    }
    return mapped;
  }

  if (isCstNode(val)) {
    const norm = normalizeChildren(val);
    const inner = transformValue(norm, S);
    return S.onNodeWrap(val, inner);
  }

  if (typeof val === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val)) {
      const mv = transformValue(v, S);
      if (mv !== undefined && S.keepChildKey(k, mv)) {
        out[k] = mv;
      }
    }
    const keys = Object.keys(out);
    if (keys.length === 0) {
      return undefined;
    }
    if (keys.length === 1 && keys[0] === 'Content') {
      return out.Content;
    }
    return out;
  }

  // primitive fallback: pass through (lets string concatenation work if present)
  return val;
}

/* -------------------- concrete modes -------------------- */

// images(): leaves become strings; nested objects keyed by child names.
// Token arrays get concatenated (via normalize/transform).
export function images(node: CstNode): unknown {
  const S: Strategies = {
    onToken: (t) => t.image, // keep token text
    onNodeWrap: (_n, children) => children, // node name not included; just the nested children map
    keepChildKey: (_k, _v) => true, // keep everything
  };
  return transformValue(normalizeChildren(node), S);
}

// names(): only node names; omit token leaves entirely, but KEEP the full node tree.
// If children collapse to an array/primitive, tuck under { Content: ... } so we don't lose the branch.
export function names(node: CstNode): { name: string; children?: Record<string, unknown> } {
  const S: Strategies = {
    onToken: (_t) => undefined, // drop token leaves
    onNodeWrap: (n, children) => {
      const out: { name: string; children?: Record<string, unknown> | unknown[] } = { name: n.name };
      if (children !== undefined) {
        if (typeof children === 'object' && !Array.isArray(children)) {
          // plain object: use as-is
          const keys = Object.keys(children as Record<string, unknown>);
          if (keys.length) {
            out.children = children as Record<string, unknown>;
          }
        } else {
          // array or primitive: wrap under Content
          out.children = children as unknown[];
        }
      }
      return out;
    },
    keepChildKey: (_k, v) => v !== undefined,
  };
  return transformValue(node, S) as any;
}

// locations(): node-level { start,end } only; omit token-level ranges.
// Same "wrap under Content if not a plain object" rule to preserve shape.
export function locations(node: CstNode): { start: number; end: number; children?: Record<string, unknown> } {
  const S: Strategies = {
    onToken: (_t) => undefined, // drop token ranges
    onNodeWrap: (n, children) => {
      const base: { start: number; end: number; children?: Record<string, unknown> | unknown[] } = {
        start: n.location?.startOffset ?? 0,
        end: n.location?.endOffset ?? 0,
      };
      if (children !== undefined) {
        if (typeof children === 'object' && !Array.isArray(children)) {
          const keys = Object.keys(children as Record<string, unknown>);
          if (keys.length) {
            base.children = children as Record<string, unknown>;
          }
        } else {
          base.children = children as unknown[];
        }
      }
      return base;
    },
    keepChildKey: (_k, v) => v !== undefined,
  };
  return transformValue(node, S) as any;
}
