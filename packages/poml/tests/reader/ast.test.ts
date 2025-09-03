import { describe, expect, test } from '@jest/globals';
import { parseAST, ASTNode } from 'poml/next/ast';

describe('parseAST', () => {
  test('pure text content', () => {
    const content = 'This is pure text content with no POML tags.';
    const ast = parseAST(content);

    expect(ast.kind).toBe('TEXT');
    expect(ast.content).toBe(content);
    expect(ast.start).toBe(0);
    expect(ast.end).toBe(content.length);
    expect(ast.children).toHaveLength(0);
  });

  test('single POML tag', () => {
    const content = '<task>Analyze the data</task>';
    const ast = parseAST(content);

    expect(ast.kind).toBe('POML');
    expect(ast.tagName).toBe('task');
    expect(ast.content).toBe(content);
    expect(ast.start).toBe(0);
    expect(ast.end).toBe(content.length);
  });

  test('mixed content with text and POML', () => {
    const content = `# My Analysis Document

This is a regular markdown document that explains the task.

<task>
  Analyze the following data and provide insights.
</task>

Here are some key points to consider:

- Data quality
- Statistical significance  
- Business impact`;

    const ast = parseAST(content);

    expect(ast.kind).toBe('TEXT');
    expect(ast.children).toHaveLength(4);

    const children = ast.children;
    expect(children[0].kind).toBe('TEXT');
    expect(children[0].content).toContain('# My Analysis Document');

    expect(children[1].kind).toBe('POML');
    expect(children[1].tagName).toBe('task');
    expect(children[1].content).toBe(`<task>
  Analyze the following data and provide insights.
</task>`);

    expect(children[2].kind).toBe('TEXT');
    expect(children[2].content).toContain('Here are some key points');

    expect(children[3].kind).toBe('TEXT');
    expect(children[3].content).toContain('- Data quality');
  });

  test('nested POML segments', () => {
    const content = `<examples syntax="json">
  <example>
    <input>Sample data point 1</input>
    <output>Analysis result 1</output>
  </example>
</examples>`;

    const ast = parseAST(content);

    expect(ast.kind).toBe('POML');
    expect(ast.tagName).toBe('examples');
    expect(ast.children).toHaveLength(0);
    expect(ast.content).toBe(content);
  });

  test('text in text', () => {
    const content = `<text>This is a text<text> with nested text content.</text></text>`;
    const ast = parseAST(content);
    expect(ast.kind).toBe('TEXT');
    expect(ast.content).toBe(content);
    expect(ast.children).toHaveLength(0);
  });

  test('text in text in POML', () => {
    const content = `<poml><text>This is a text<text> with nested text content.</text></text></poml>`;
    const ast = parseAST(content);
    expect(ast.kind).toBe('POML');
    expect(ast.tagName).toBe('poml');
    expect(ast.children).toHaveLength(1);
    const textNode = ast.children[0];
    expect(textNode.kind).toBe('TEXT');
    expect(textNode.content).toBe('This is a text<text> with nested text content.</text>');
  });

  test('nested same tag in POML', () => {
    const content = `<task>Process data<task> with nested task content.</task></task>`;
    const ast = parseAST(content);
    expect(ast.kind).toBe('POML');
    expect(ast.tagName).toBe('task');
    expect(ast.children).toHaveLength(0);
    expect(ast.content).toBe('<task>Process data<task> with nested task content.</task></task>');
  });

  test('text tag with nested content', () => {
    const content = `<poml>
  <task>Process the following data</task>
  <text>
    This is **markdown** content that will be processed as pure text.
    
    - Item 1
    - Item 2

    <cp caption="Nested POML">This is a nested POML component that will be processed as POML.</cp>

    No POML processing happens here.
  </text>
  <hint>Remember to check the format</hint>
</poml>`;

    const ast = parseAST(content);

    expect(ast.kind).toBe('POML');
    expect(ast.tagName).toBe('poml');
    expect(ast.children).toHaveLength(4);

    const textNode = ast.children.find((c) => c.kind === 'POML' && c.tagName === 'text');
    expect(textNode).toBeDefined();
    expect(textNode!.children).toHaveLength(3);

    const nestedCpNode = textNode!.children.find((c) => c.kind === 'POML' && c.tagName === 'cp');
    expect(nestedCpNode).toBeDefined();
    expect(nestedCpNode!.content).toBe(
      '<cp caption="Nested POML">This is a nested POML component that will be processed as POML.</cp>',
    );
  });

  test('meta tags', () => {
    const content = `<meta name="author">John Doe</variable>
  <stylesheet>
    { "task": { "captionStyle": "bold" } }
  </stylesheet>
</meta>

<task>Complete the analysis</task>`;

    const ast = parseAST(content);

    expect(ast.kind).toBe('TEXT');
    expect(ast.children).toHaveLength(3);

    const metaNode = ast.children.find((c) => c.kind === 'META');
    expect(metaNode).toBeDefined();
    expect(metaNode!.tagName).toBe('meta');
    expect(metaNode!.children).toHaveLength(0);

    const taskNode = ast.children.find((c) => c.kind === 'POML' && c.tagName === 'task');
    expect(taskNode).toBeDefined();
  });

  test('invalid tags are ignored', () => {
    const content = `<invalid-tag>This should be ignored</invalid-tag>
<task>This should be processed</task>
<random>This should also be ignored</random>`;

    const ast = parseAST(content);

    expect(ast.kind).toBe('TEXT');
    expect(ast.children).toHaveLength(3);

    const taskNode = ast.children.find((c) => c.kind === 'POML');
    expect(taskNode).toBeDefined();
    expect(taskNode!.tagName).toBe('task');

    const textNodes = ast.children.filter((c) => c.kind === 'TEXT');
    expect(textNodes).toHaveLength(2);
    expect(textNodes[0].content).toContain('<invalid-tag>This should be ignored</invalid-tag>');
    expect(textNodes[1].content).toContain('<random>This should also be ignored</random>');
  });

  test('self-closing tags are ignored', () => {
    const content = `<task>Valid task</task>
<br />
<img src="test.jpg" />
<hint>Valid hint</hint>`;

    const ast = parseAST(content);

    expect(ast.kind).toBe('TEXT');
    expect(ast.children).toHaveLength(4);

    const pomlNodes = ast.children.filter((c) => c.kind === 'POML');
    expect(pomlNodes).toHaveLength(3);
    expect(pomlNodes[0].tagName).toBe('task');
    expect(pomlNodes[2].tagName).toBe('hint');
  });

  test('malformed tags are handled gracefully', () => {
    const content = `<task>Incomplete tag
<hint>Complete hint</hint>
<unclosed>This has no closing tag`;

    const ast = parseAST(content);

    expect(ast.kind).toBe('TEXT');
    expect(ast.children).toHaveLength(3);

    const hintNode = ast.children.find((c) => c.kind === 'POML' && c.tagName === 'hint');
    expect(hintNode).toBeDefined();
    expect(hintNode!.content).toBe('<hint>Complete hint</hint>');

    const textNodes = ast.children.filter((c) => c.kind === 'TEXT');
    expect(textNodes).toHaveLength(2);
    expect(textNodes[0].content).toBe('<task>Incomplete tag\n');
    expect(textNodes[1].content).toBe('\n<unclosed>This has no closing tag');
  });

  test('malformed POML tags are ignored', () => {
    const content = `<task>Valid task`;
    const ast = parseAST(content);

    expect(ast.kind).toBe('TEXT');
    expect(ast.children).toHaveLength(0);
  });

  test('empty content', () => {
    const content = '';
    const ast = parseAST(content);

    expect(ast.kind).toBe('TEXT');
    expect(ast.content).toBe('');
    expect(ast.children).toHaveLength(0);
  });

  test('whitespace-only content', () => {
    const content = '   \n\n\t  \n  ';
    const ast = parseAST(content);

    expect(ast.kind).toBe('TEXT');
    expect(ast.content).toBe(content);
    expect(ast.children).toHaveLength(0);
  });

  test('hyphenated tag names', () => {
    const content = `<output-format>JSON format</output-format>
<system-msg>System message</system-msg>
<user-msg>User message</user-msg>`;

    const ast = parseAST(content);

    expect(ast.kind).toBe('TEXT');
    expect(ast.children).toHaveLength(4);

    const pomlNodes = ast.children.filter((c) => c.kind === 'POML');
    expect(pomlNodes).toHaveLength(3);
    expect(pomlNodes[0].tagName).toBe('output-format');
    expect(pomlNodes[1].tagName).toBe('system-msg');
    expect(pomlNodes[2].tagName).toBe('user-msg');
  });

  test('parent-child relationships', () => {
    const content = `<task>
  <hint>This is a hint</hint>
  Some text
  <examples>
    <example>Example 1</example>
  </examples>
</task>`;

    const ast = parseAST(content);

    const taskNode = ast;
    expect(taskNode.kind).toBe('POML');
    expect(taskNode.tagName).toBe('task');
    expect(taskNode.parent).toBeUndefined();

    const hintNode = taskNode.children.find((c) => c.kind === 'POML' && c.tagName === 'hint');
    expect(hintNode).toBeDefined();
    expect(hintNode!.parent).toBe(taskNode);

    const examplesNode = taskNode.children.find((c) => c.kind === 'POML' && c.tagName === 'examples');
    expect(examplesNode).toBeDefined();
    expect(examplesNode!.parent).toBe(taskNode);

    const exampleNode = examplesNode!.children.find((c) => c.kind === 'POML' && c.tagName === 'example');
    expect(exampleNode).toBeDefined();
    expect(exampleNode!.parent).toBe(examplesNode);
  });

  test('node IDs are unique', () => {
    const content = `<task>First task</task>
<task>Second task</task>
<hint>A hint</hint>`;

    const ast = parseAST(content);
    expect(ast.kind).toBe('TEXT');
    expect(ast.children).toHaveLength(5);

    function collectAllNodes(node: ASTNode): ASTNode[] {
      const all = [node];
      node.children.forEach((child) => {
        all.push(...collectAllNodes(child));
      });
      return all;
    }

    const allNodes = collectAllNodes(ast);
    const ids = allNodes.map((s) => s.id);
    const uniqueIds = new Set(ids);

    expect(uniqueIds.size).toBe(ids.length);
  });

  test('complex example from specification', () => {
    const content = `<poml>
  <task>Process the following data</task>
  <text>
    This is **markdown** content that will be processed as pure text.
    
    - Item 1
    - Item 2

    {{ VARIABLES_WILL_ALSO_SHOWN_AS_IS }}
    <cp caption="Nested POML">This is a nested POML component that will be processed as POML.</cp>

    No POML processing happens here.
  </text>
  <hint>Remember to check the format</hint>
</poml>

There can be some intervening text here as well.

<poml>
  <p>You can add another POML segment here: {{variable_will_be_substituted}}</p>
</poml>

<p>POML elements do not necessarily reside in a poml element.</p>`;

    const ast = parseAST(content);

    expect(ast.kind).toBe('TEXT');
    expect(ast.children).toHaveLength(5);

    const firstPomlNode = ast.children.find((c) => c.kind === 'POML' && c.tagName === 'poml');
    expect(firstPomlNode).toBeDefined();
    expect(firstPomlNode!.children).toHaveLength(4);

    const textNode = firstPomlNode!.children.find((c) => c.kind === 'POML' && c.tagName === 'text');
    expect(textNode).toBeDefined();
    expect(textNode!.children).toHaveLength(3);

    const cpNode = textNode!.children.find((c) => c.kind === 'POML' && c.tagName === 'cp');
    expect(cpNode).toBeDefined();

    const secondPomlNode = ast.children.filter((c) => c.kind === 'POML' && c.tagName === 'poml')[1];
    expect(secondPomlNode).toBeDefined();

    const lineBreakNode = ast.children[3];
    expect(lineBreakNode.kind).toBe('TEXT');
    expect(lineBreakNode.content).toBe('\n\n');

    const pNode = ast.children.find((c) => c.kind === 'POML' && c.tagName === 'p');
    expect(pNode).toBeDefined();
  });

  test('template variables in content', () => {
    const content = `<task>Process {{variable}} with {{another_variable}}</task>`;
    const ast = parseAST(content);

    expect(ast.kind).toBe('POML');
    expect(ast.tagName).toBe('task');
    expect(ast.children).toHaveLength(4); // text, template, text, template

    const templateNodes = ast.children.filter((c) => c.kind === 'TEMPLATE');
    expect(templateNodes).toHaveLength(2);
    expect(templateNodes[0].expression).toBe('variable');
    expect(templateNodes[1].expression).toBe('another_variable');
  });

  test('template variables in text nodes are treated as literal', () => {
    const content = `<text>Variables like {{this}} are shown as-is</text>`;
    const ast = parseAST(content);

    expect(ast.kind).toBe('TEXT');
    expect(ast.content).toBe(content);
    expect(ast.children).toHaveLength(0);
  });

  test('template variables in attribute values', () => {
    const content = `<task caption="Process {{variable}}">Content</task>`;
    const ast = parseAST(content);

    expect(ast.kind).toBe('POML');
    expect(ast.tagName).toBe('task');
    expect(ast.attributes).toHaveLength(1);

    const attr = ast.attributes![0];
    expect(attr.key).toBe('caption');
    expect(attr.value).toHaveLength(2); // text + template
    expect(attr.value[0].kind).toBe('TEXT');
    expect(attr.value[0].content).toBe('Process ');
    expect(attr.value[1].kind).toBe('TEMPLATE');
    expect(attr.value[1].expression).toBe('variable');
  });

  test('mixed template variables and text in attributes', () => {
    const content = `<task title="Hello {{name}}, process {{data}} please">Content</task>`;
    const ast = parseAST(content);

    expect(ast.kind).toBe('POML');
    expect(ast.attributes).toHaveLength(1);

    const attr = ast.attributes![0];
    expect(attr.value).toHaveLength(4); // text, template, text, template
    expect(attr.value[0].content).toBe('Hello ');
    expect(attr.value[1].expression).toBe('name');
    expect(attr.value[2].content).toBe(', process ');
    expect(attr.value[3].expression).toBe('data');
  });
});
