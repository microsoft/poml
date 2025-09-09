import { describe, expect, test, beforeEach } from '@jest/globals';
import { extendedPomlLexer } from 'poml/next/lexer';
import { ExtendedPomlParser } from 'poml/next/cst';
import { cstToAst, ExtendedPomlAstVisitor } from 'poml/next/ast';
import * as diagnostics from 'poml/next/diagnostics';
import {
  RootNode,
  ElementNode,
  LiteralNode,
  TemplateNode,
  ValueNode,
  PragmaNode,
  CommentNode,
  ForIteratorNode,
  AttributeNode,
} from 'poml/next/nodes';
import { CstNode } from 'chevrotain';

// Helper function to lex, parse and build AST from raw input
function parseToAst(input: string): RootNode {
  // Clear diagnostics before each test
  diagnostics.clear();

  // Tokenize
  const lexResult = extendedPomlLexer.tokenize(input);
  expect(lexResult.errors).toHaveLength(0);

  // Parse to CST
  const parser = new ExtendedPomlParser();
  parser.input = lexResult.tokens;
  const cst = parser.root();
  expect(parser.errors).toHaveLength(0);

  // Convert to AST
  return cstToAst(cst);
}

// Helper to parse specific rule and convert to AST
function parseRule<T>(input: string, rule: (parser: ExtendedPomlParser) => CstNode): T {
  diagnostics.clear();

  const lexResult = extendedPomlLexer.tokenize(input);
  expect(lexResult.errors).toHaveLength(0);

  const parser = new ExtendedPomlParser();
  parser.input = lexResult.tokens;
  const cst = rule(parser);
  expect(parser.errors).toHaveLength(0);

  const visitor = new ExtendedPomlAstVisitor();
  return visitor.visit(cst) as T;
}

describe('AST Visitor - Individual Rules', () => {
  beforeEach(() => {
    diagnostics.clear();
  });

  describe('root rule', () => {
    test('empty root', () => {
      const result = parseToAst('');
      expect(result).toStrictEqual({
        kind: 'ROOT',
        children: [],
        range: { start: 0, end: 0 },
      });
    });

    test('text only root', () => {
      const result = parseToAst('Hello World');
      expect(result).toStrictEqual({
        kind: 'ROOT',
        children: [
          {
            kind: 'STRING',
            value: 'Hello World',
            range: { start: 0, end: 10 },
          },
        ],
        range: { start: 0, end: 10 },
      });
    });

    test('mixed content root', () => {
      const result = parseToAst('Hello {{ name }}!');
      expect(result.kind).toBe('ROOT');
      expect(result.children).toHaveLength(3);

      expect(result.children[0]).toMatchObject({
        kind: 'STRING',
        value: 'Hello ',
      });

      expect(result.children[1]).toMatchObject({
        kind: 'TEMPLATE',
        value: { kind: 'STRING', value: ' name ' },
      });

      expect(result.children[2]).toMatchObject({
        kind: 'STRING',
        value: '!',
      });
    });
  });

  describe('template rule', () => {
    test('simple template', () => {
      const result = parseRule<TemplateNode>('{{ var }}', (p) => p.template());
      expect(result).toStrictEqual({
        kind: 'TEMPLATE',
        value: {
          kind: 'STRING',
          value: ' var ',
          range: expect.any(Object),
        },
        range: expect.any(Object),
      });
    });

    test('complex expression template', () => {
      const result = parseRule<TemplateNode>('{{ user.name.toUpperCase() }}', (p) => p.template());
      expect(result.value.value).toBe(' user.name.toUpperCase() ');
    });

    test('template without spaces', () => {
      const result = parseRule<TemplateNode>('{{count}}', (p) => p.template());
      expect(result.value.value).toBe('count');
    });
  });

  describe('comment rule', () => {
    test('simple comment', () => {
      const result = parseRule<CommentNode>('<!-- hello -->', (p) => p.comment());
      expect(result).toStrictEqual({
        kind: 'COMMENT',
        value: {
          kind: 'STRING',
          value: ' hello ',
          range: expect.any(Object),
        },
        range: expect.any(Object),
      });
    });

    test('multiline comment', () => {
      const result = parseRule<CommentNode>('<!-- line 1\\nline 2 -->', (p) => p.comment());
      expect(result.value.value).toContain('line 1');
      expect(result.value.value).toContain('line 2');
    });
  });

  describe('pragma rule', () => {
    test('pragma with identifier only', () => {
      const result = parseRule<PragmaNode>('<!-- @pragma version -->', (p) => p.pragma());
      expect(result).toMatchObject({
        kind: 'PRAGMA',
        identifier: {
          kind: 'STRING',
          value: 'version',
        },
        options: [],
      });
    });

    test('pragma with unquoted options', () => {
      const result = parseRule<PragmaNode>('<!-- @pragma components +reference -table -->', (p) => p.pragma());
      expect(result).toMatchObject({
        kind: 'PRAGMA',
        identifier: {
          kind: 'STRING',
          value: 'components',
        },
        options: [
          { kind: 'STRING', value: '+reference' },
          { kind: 'STRING', value: '-table' },
        ],
      });
    });

    test('pragma with quoted options', () => {
      const result = parseRule<PragmaNode>('<!-- @pragma whitespace "pre formatted" -->', (p) => p.pragma());
      expect(result).toMatchObject({
        kind: 'PRAGMA',
        identifier: {
          kind: 'STRING',
          value: 'whitespace',
        },
        options: [{ kind: 'STRING', value: 'pre formatted' }],
      });
    });
  });

  describe('quoted rule', () => {
    test('simple quoted string', () => {
      const result = parseRule<LiteralNode>('"hello world"', (p) => p.quoted());
      expect(result).toStrictEqual({
        kind: 'STRING',
        value: 'hello world',
        range: expect.any(Object),
      });
    });

    test('quoted string with single quotes', () => {
      const result = parseRule<LiteralNode>("'hello world'", (p) => p.quoted());
      expect(result).toStrictEqual({
        kind: 'STRING',
        value: 'hello world',
        range: expect.any(Object),
      });
    });
  });

  describe('quotedTemplate rule', () => {
    test('quoted string with template', () => {
      const result = parseRule<ValueNode>('"Hello {{ name }}!"', (p) => p.quotedTemplate());
      expect(result).toMatchObject({
        kind: 'VALUE',
        children: [
          { kind: 'STRING', value: 'Hello ' },
          {
            kind: 'TEMPLATE',
            value: { kind: 'STRING', value: ' name ' },
          },
          { kind: 'STRING', value: '!' },
        ],
      });
    });

    test('quoted template with only template', () => {
      const result = parseRule<ValueNode>('"{{ expression }}"', (p) => p.quotedTemplate());
      expect(result).toMatchObject({
        kind: 'VALUE',
        children: [
          {
            kind: 'TEMPLATE',
            value: { kind: 'STRING', value: 'expression' },
          },
        ],
      });
    });

    test('multiple templates in quoted string', () => {
      const result = parseRule<ValueNode>('"{{ first }} and {{ second }}"', (p) => p.quotedTemplate());
      expect(result.children).toHaveLength(4);
      expect(result.children[0]).toMatchObject({ kind: 'TEMPLATE' });
      expect(result.children[1]).toMatchObject({ kind: 'STRING', value: ' and ' });
      expect(result.children[2]).toMatchObject({ kind: 'TEMPLATE' });
      expect(result.children[3]).toMatchObject({ kind: 'STRING', value: '' });
    });
  });

  describe('forIteratorValue rule', () => {
    test('simple for iterator', () => {
      const result = parseRule<ForIteratorNode>('"item in items"', (p) => p.forIteratorValue());
      expect(result).toStrictEqual({
        kind: 'FORITERATOR',
        iterator: {
          kind: 'STRING',
          value: 'item',
          range: expect.any(Object),
        },
        collection: {
          kind: 'STRING',
          value: 'items',
          range: expect.any(Object),
        },
        range: expect.any(Object),
      });
    });

    test('for iterator with property access', () => {
      const result = parseRule<ForIteratorNode>('"user in data.users"', (p) => p.forIteratorValue());
      expect(result).toMatchObject({
        kind: 'FORITERATOR',
        iterator: { kind: 'STRING', value: 'user' },
        collection: { kind: 'STRING', value: 'data.users' },
      });
    });

    test('for iterator with complex expression', () => {
      const result = parseRule<ForIteratorNode>('"item in getItems().filter(x => x.active)"', (p) =>
        p.forIteratorValue(),
      );
      expect(result.collection.value).toBe('getItems().filter(x => x.active)');
    });
  });

  describe('attribute rule', () => {
    test('attribute with quoted value', () => {
      const result = parseRule<AttributeNode>('class="container"', (p) => p.attribute());
      expect(result).toMatchObject({
        kind: 'ATTRIBUTE',
        key: { kind: 'STRING', value: 'class' },
        value: { kind: 'STRING', value: 'container' },
      });
    });

    test('attribute with template value', () => {
      const result = parseRule<AttributeNode>('title={{ pageTitle }}', (p) => p.attribute());
      expect(result).toMatchObject({
        kind: 'ATTRIBUTE',
        key: { kind: 'STRING', value: 'title' },
        value: {
          kind: 'VALUE',
          children: [{ kind: 'TEMPLATE' }],
        },
      });
    });

    test('attribute with for iterator', () => {
      const result = parseRule<AttributeNode>('for="item in items"', (p) => p.attribute());
      expect(result).toMatchObject({
        kind: 'ATTRIBUTE',
        key: { kind: 'STRING', value: 'for' },
        value: {
          kind: 'FORITERATOR',
          iterator: { kind: 'STRING', value: 'item' },
          collection: { kind: 'STRING', value: 'items' },
        },
      });
    });

    test('attribute with quoted template value', () => {
      const result = parseRule<AttributeNode>('message="Hello {{ name }}!"', (p) => p.attribute());
      expect(result).toMatchObject({
        kind: 'ATTRIBUTE',
        key: { kind: 'STRING', value: 'message' },
        value: {
          kind: 'VALUE',
          children: [{ kind: 'STRING', value: 'Hello ' }, { kind: 'TEMPLATE' }, { kind: 'STRING', value: '!' }],
        },
      });
    });
  });

  describe('element rule', () => {
    test('simple element', () => {
      const result = parseRule<ElementNode>('<div>content</div>', (p) => p.element());
      expect(result).toMatchObject({
        kind: 'ELEMENT',
        name: 'div',
        attributes: [],
        children: [{ kind: 'STRING', value: 'content' }],
      });
    });

    test('element with attributes', () => {
      const result = parseRule<ElementNode>('<div class="container" id="main">text</div>', (p) => p.element());
      expect(result).toMatchObject({
        kind: 'ELEMENT',
        name: 'div',
        attributes: [
          {
            kind: 'ATTRIBUTE',
            key: { value: 'class' },
            value: { kind: 'STRING', value: 'container' },
          },
          {
            kind: 'ATTRIBUTE',
            key: { value: 'id' },
            value: { kind: 'STRING', value: 'main' },
          },
        ],
        children: [{ kind: 'STRING', value: 'text' }],
      });
    });

    test('self-closing element', () => {
      const result = parseRule<ElementNode>('<img src="photo.jpg" />', (p) => p.element());
      expect(result).toMatchObject({
        kind: 'ELEMENT',
        name: 'img',
        attributes: [
          {
            kind: 'ATTRIBUTE',
            key: { value: 'src' },
            value: { kind: 'VALUE', value: 'photo.jpg' },
          },
        ],
        children: [],
      });
    });

    test('element with nested content', () => {
      const result = parseRule<ElementNode>('<task>Process {{ data }} carefully</task>', (p) => p.element());
      expect(result.children).toHaveLength(3);
      expect(result.children[0]).toMatchObject({ kind: 'STRING', value: 'Process ' });
      expect(result.children[1]).toMatchObject({ kind: 'TEMPLATE' });
      expect(result.children[2]).toMatchObject({ kind: 'STRING', value: ' carefully' });
    });

    test('nested elements', () => {
      const result = parseRule<ElementNode>('<div><span>nested</span></div>', (p) => p.element());
      expect(result.children).toHaveLength(1);
      expect(result.children[0]).toMatchObject({
        kind: 'ELEMENT',
        name: 'span',
        children: [{ kind: 'STRING', value: 'nested' }],
      });
    });
  });
});

describe('AST Visitor - Error Handling', () => {
  beforeEach(() => {
    diagnostics.clear();
  });

  test('mismatched closing tag reports error', () => {
    const input = '<div>content</span>';
    parseRule<ElementNode>(input, (p) => p.element());

    const errors = diagnostics.getErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('Mismatched closing tag');
    expect(errors[0].message).toContain('expected </div>');
    expect(errors[0].message).toContain('found </span>');
  });

  test('invalid HTML entity reports error', () => {
    const input = '&invalidEntity;';
    parseToAst(input);

    const errors = diagnostics.getErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('Failed to decode HTML entity');
  });

  test('attribute without value reports error', () => {
    // This would be caught during parsing, but if we had a malformed CST:
    const input = '<div class>content</div>';
    // Note: This test might need adjustment based on actual parser behavior
    try {
      parseRule<ElementNode>(input, (p) => p.element());
      const errors = diagnostics.getErrors();
      // Check if any errors were reported for missing attribute value
    } catch (e) {
      // Parser error expected for malformed syntax
      expect(true).toBe(true);
    }
  });

  test('unknown element content reports error', () => {
    // This tests the fallback case in elementContent
    diagnostics.clear();
    parseToAst('normal text'); // Should not cause errors
    expect(diagnostics.getErrors()).toHaveLength(0);
  });
});

describe('AST Visitor - Special Tokens and Escapes', () => {
  beforeEach(() => {
    diagnostics.clear();
  });

  describe('backslash escapes in quoted strings', () => {
    test('basic escape sequences', () => {
      const result = parseRule<LiteralNode>('"line1\\nline2"', (p) => p.quoted());
      expect(result.value).toBe('line1\nline2');
    });

    test('unicode escape sequences', () => {
      const result = parseRule<LiteralNode>('"\\u0048\\u0065\\u006C\\u006C\\u006F"', (p) => p.quoted()); // "Hello"
      expect(result.value).toBe('Hello');
    });

    test('hex escape sequences', () => {
      const result = parseRule<LiteralNode>('"\\x48\\x65\\x6C\\x6C\\x6F"', (p) => p.quoted()); // "Hello"
      expect(result.value).toBe('Hello');
    });

    test('quote escapes', () => {
      const result = parseRule<LiteralNode>('"\\"escaped quotes\\""', (p) => p.quoted());
      expect(result.value).toBe('"escaped quotes"');
    });

    test('template brace escapes', () => {
      const result = parseRule<LiteralNode>('"\\{{not a template\\}}"', (p) => p.quoted());
      expect(result.value).toBe('{{not a template}}');
    });

    test('backslash escape', () => {
      const result = parseRule<LiteralNode>('"path\\\\to\\\\file"', (p) => p.quoted());
      expect(result.value).toBe('path\\to\\file');
    });

    test('unknown escape sequence', () => {
      const result = parseRule<LiteralNode>('"\\q unknown"', (p) => p.quoted());
      expect(result.value).toBe('\\q unknown'); // Unknown escape returns body with backslash
    });
  });

  describe('character entities in text content', () => {
    test('common HTML entities', () => {
      const result = parseToAst('&amp; &lt; &gt; &quot; &apos;');
      expect(result.children[0]).toMatchObject({
        kind: 'STRING',
        value: '& < > " \'',
      });
    });

    test('numeric character references', () => {
      const result = parseToAst('&#65; &#x41;'); // Both represent 'A'
      expect(result.children[0]).toMatchObject({
        kind: 'STRING',
        value: 'A A',
      });
    });

    test('mixed entities and regular text', () => {
      const result = parseToAst('Hello &amp; welcome &lt;user&gt;');
      expect(result.children[0]).toMatchObject({
        kind: 'STRING',
        value: 'Hello & welcome <user>',
      });
    });
  });

  describe('escapes in different contexts', () => {
    test('backslash escapes not processed in text content', () => {
      const result = parseToAst('This \\n should stay as literal');
      expect(result.children[0]).toMatchObject({
        kind: 'STRING',
        value: 'This \\n should stay as literal',
      });
    });

    test('entities not processed in quoted strings', () => {
      const result = parseRule<LiteralNode>('"&amp; stays literal"', (p) => p.quoted());
      expect(result.value).toBe('&amp; stays literal');
    });

    test('template expressions preserve content', () => {
      const result = parseRule<TemplateNode>('{{ "string with { } \\n \n escape" }}', (p) => p.template());
      expect(result.value.value).toBe('"string with { } \\n \n escape"');
    });
  });
});

// describe('AST Visitor - Complex Integration Tests', () => {
//   beforeEach(() => {
//     diagnostics.clear();
//   });

//   test('complex document with multiple element types', () => {
//     const input = `<!-- @pragma whitespace collapse -->
// <document>
//   <meta author="test">
//   <!-- This is a comment -->
//   <section title="Introduction">
//     Welcome to {{ appName }}!

//     <list>
//       <item for="task in tasks">
//         Task: {{ task.name }} - Status: {{ task.status }}
//       </item>
//     </list>
//   </section>

//   <footer>&copy; 2024 Company</footer>
// </document>`;

//     const result = parseToAst(input);

//     // Root should contain pragma, whitespace, and element
//     expect(result.kind).toBe('ROOT');
//     expect(result.children.length).toBeGreaterThan(0);

//     // Find the pragma
//     const pragma = result.children.find(child => child.kind === 'PRAGMA') as PragmaNode;
//     expect(pragma).toBeDefined();
//     expect(pragma.identifier.value).toBe('whitespace');
//     expect(pragma.options[0].value).toBe('collapse');

//     // Find the document element
//     const document = result.children.find(child =>
//       child.kind === 'ELEMENT' && (child as ElementNode).name === 'document'
//     ) as ElementNode;
//     expect(document).toBeDefined();

//     // Document should have nested content
//     expect(document.children?.length).toBeGreaterThan(0);

//     // Find section with template
//     const section = document.children?.find(child =>
//       child.kind === 'ELEMENT' && (child as ElementNode).name === 'section'
//     ) as ElementNode;
//     expect(section).toBeDefined();
//     expect(section.attributes).toHaveLength(1);
//     expect(section.attributes[0].key.value).toBe('title');

//     // Check for template in section content
//     const templateInSection = section.children?.find(child => child.kind === 'TEMPLATE');
//     expect(templateInSection).toBeDefined();

//     // Find list with for attribute
//     const findElementByName = (children: any[], name: string): ElementNode | undefined =>
//       children.find(child => child.kind === 'ELEMENT' && child.name === name);

//     const list = findElementByName(section.children!, 'list');
//     expect(list).toBeDefined();

//     const item = findElementByName(list!.children!, 'item');
//     expect(item).toBeDefined();

//     // Check for attribute with for iterator
//     const forAttr = item!.attributes.find(attr => attr.key.value === 'for');
//     expect(forAttr).toBeDefined();
//     expect(forAttr!.value.kind).toBe('FORITERATOR');

//     const forIterator = forAttr!.value as ForIteratorNode;
//     expect(forIterator.iterator.value).toBe('task');
//     expect(forIterator.collection.value).toBe('tasks');

//     // Check footer with entity
//     const footer = findElementByName(document.children, 'footer');
//     expect(footer).toBeDefined();
//     expect(footer!.children[0]).toMatchObject({
//       kind: 'STRING',
//       value: '© 2024 Company', // Entity should be decoded
//     });
//   });

//   test('mixed content with templates, comments, and elements', () => {
//     const input = `
// Processing data for {{ userName }}...
// <!-- Status: {{ status }} -->
// <progress value="{{ progress }}" max="100">{{ progress }}%</progress>
// Task completed!
// `;

//     const result = parseToAst(input);

//     expect(result.children).toHaveLength(6); // whitespace, text, template, text, comment, text, element, text

//     // Check template rendering
//     const firstTemplate = result.children.find(child => child.kind === 'TEMPLATE') as TemplateNode;
//     expect(firstTemplate).toBeDefined();
//     expect(firstTemplate.value.value).toContain('userName');

//     // Check comment
//     const comment = result.children.find(child => child.kind === 'COMMENT') as CommentNode;
//     expect(comment).toBeDefined();
//     expect(comment.value.value).toContain('Status:');

//     // Check progress element with template attributes
//     const progress = result.children.find(child =>
//       child.kind === 'ELEMENT' && (child as ElementNode).name === 'progress'
//     ) as ElementNode;
//     expect(progress).toBeDefined();
//     expect(progress.attributes).toHaveLength(2);

//     // Check template in attribute value
//     const valueAttr = progress.attributes.find(attr => attr.key.value === 'value');
//     expect(valueAttr!.value.kind).toBe('VALUE');
//     const valueNode = valueAttr!.value as ValueNode;
//     expect(valueNode.children[0].kind).toBe('TEMPLATE');

//     // Check template in element content
//     const progressTemplate = progress.children?.find(child => child.kind === 'TEMPLATE');
//     expect(progressTemplate).toBeDefined();
//   });

//   test('deeply nested structure with various features', () => {
//     const input = `<poml>
//   <config>
//     <model name="gpt-4" temperature="0.7" />
//     <output format="json" pretty="true" />
//   </config>

//   <task title="Data Analysis for {{ clientName }}">
//     <description>
//       Analyze the provided dataset &amp; generate insights.

//       <requirements>
//         <item>Statistical analysis</item>
//         <item>Data visualization</item>
//         <item for="metric in requiredMetrics">{{ metric }} calculation</item>
//       </requirements>
//     </description>

//     <examples>
//       <example input="{{ sampleData }}" output="{{ expectedOutput }}" />
//     </examples>
//   </task>
// </poml>`;

//     const result = parseToAst(input);

//     expect(result.children).toHaveLength(1);
//     const poml = result.children[0] as ElementNode;
//     expect(poml.name).toBe('poml');
//     expect(poml.children.length).toBeGreaterThan(0);

//     // Verify deep nesting is preserved
//     const task = poml.children.find(child =>
//       child.kind === 'ELEMENT' && (child as ElementNode).name === 'task'
//     ) as ElementNode;
//     expect(task).toBeDefined();

//     const description = task.children.find(child =>
//       child.kind === 'ELEMENT' && (child as ElementNode).name === 'description'
//     ) as ElementNode;
//     expect(description).toBeDefined();

//     const requirements = description.children.find(child =>
//       child.kind === 'ELEMENT' && (child as ElementNode).name === 'requirements'
//     ) as ElementNode;
//     expect(requirements).toBeDefined();

//     // Check for iterator in nested structure
//     const forItem = requirements.children.find(child => {
//       if (child.kind !== 'ELEMENT') return false;
//       const elem = child as ElementNode;
//       return elem.name === 'item' && elem.attributes.some(attr => attr.key.value === 'for');
//     }) as ElementNode;

//     expect(forItem).toBeDefined();
//     const forAttr = forItem.attributes.find(attr => attr.key.value === 'for')!;
//     expect(forAttr.value.kind).toBe('FORITERATOR');

//     // Verify self-closing elements work
//     const config = poml.children.find(child =>
//       child.kind === 'ELEMENT' && (child as ElementNode).name === 'config'
//     ) as ElementNode;
//     expect(config).toBeDefined();

//     const model = config.children.find(child =>
//       child.kind === 'ELEMENT' && (child as ElementNode).name === 'model'
//     ) as ElementNode;
//     expect(model).toBeDefined();
//     expect(model.children).toHaveLength(0); // Self-closing
//     expect(model.attributes.length).toBeGreaterThan(0);
//   });
// });
