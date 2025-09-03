import { describe, expect, test } from '@jest/globals';
import { parseExtendedPoml, ASTNode } from 'poml/next/cst';

describe('Extended POML CST Parser', () => {
  test('parses pure text content', () => {
    const input = 'This is plain text content.';
    const result = parseExtendedPoml(input);

    expect(result.kind).toBe('TEXT');
    expect(result.content).toBe(input);
    expect(result.children).toHaveLength(0);
  });

  test('parses simple POML element', () => {
    const input = '<task>Analyze the data</task>';
    const result = parseExtendedPoml(input);

    expect(result.kind).toBe('TEXT');
    expect(result.children).toHaveLength(1);

    const taskNode = result.children[0];
    expect(taskNode.kind).toBe('POML');
    expect(taskNode.tagName).toBe('task');
    expect(taskNode.children).toHaveLength(1);
    expect(taskNode.children[0].content).toBe('Analyze the data');
  });

  test('parses mixed content', () => {
    const input = `# My Document

This is regular text.

<task>
  Process this data
</task>

More text here.`;

    const result = parseExtendedPoml(input);

    expect(result.kind).toBe('TEXT');
    expect(result.children.length).toBeGreaterThan(1);

    // Should have text nodes and POML nodes
    const pomlNodes = result.children.filter((child) => child.kind === 'POML');
    expect(pomlNodes).toHaveLength(1);
    expect(pomlNodes[0].tagName).toBe('task');
  });

  test('parses self-closing elements', () => {
    const input = '<meta components="+reference,-table" />';
    const result = parseExtendedPoml(input);

    expect(result.children).toHaveLength(1);
    const metaNode = result.children[0];
    expect(metaNode.kind).toBe('META');
    expect(metaNode.tagName).toBe('meta');
    expect(metaNode.attributes).toHaveLength(1);
    expect(metaNode.attributes![0].key).toBe('components');
  });

  test('parses template expressions', () => {
    const input = 'Hello {{name}}!';
    const result = parseExtendedPoml(input);

    expect(result.children.length).toBeGreaterThan(1);
    const templateNode = result.children.find((child) => child.kind === 'TEMPLATE');
    expect(templateNode).toBeDefined();
    expect(templateNode!.expression).toBe('name');
  });

  test('parses attributes with mixed content', () => {
    const input = '<p class="header" id="{{elementId}}">Content</p>';
    const result = parseExtendedPoml(input);

    const pNode = result.children.find((child) => child.kind === 'POML');
    expect(pNode).toBeDefined();
    expect(pNode!.attributes).toHaveLength(2);

    const classAttr = pNode!.attributes!.find((attr) => attr.key === 'class');
    expect(classAttr).toBeDefined();
    expect(classAttr!.value[0].content).toBe('header');

    const idAttr = pNode!.attributes!.find((attr) => attr.key === 'id');
    expect(idAttr).toBeDefined();
    expect(idAttr!.value[0].kind).toBe('TEMPLATE');
  });

  test('handles text tag with nested POML', () => {
    const input = `<text>
This is **markdown** content.
<cp caption="Nested">This is nested POML</cp>
More markdown here.
</text>`;

    const result = parseExtendedPoml(input);
    const textNode = result.children.find((child) => child.kind === 'POML' && child.tagName === 'text');

    expect(textNode).toBeDefined();
    expect(textNode!.children.length).toBeGreaterThan(1);

    const cpNode = textNode!.children.find((child) => child.kind === 'POML' && child.tagName === 'cp');
    expect(cpNode).toBeDefined();
  });

  test('preserves source position information', () => {
    const input = '<task>Test</task>';
    const result = parseExtendedPoml(input);

    const taskNode = result.children[0];
    expect(taskNode.start).toBe(0);
    expect(taskNode.end).toBe(input.length);
    expect(taskNode.openingTag).toBeDefined();
    expect(taskNode.closingTag).toBeDefined();
    expect(taskNode.openingTag!.nameRange.start).toBeGreaterThan(0);
    expect(taskNode.openingTag!.nameRange.end).toBeGreaterThan(taskNode.openingTag!.nameRange.start);
  });

  test('handles unknown components gracefully', () => {
    const input = '<unknown>This should be treated as text</unknown>';

    // Should not throw by default (warning behavior)
    const result = parseExtendedPoml(input);
    expect(result).toBeDefined();

    // Should treat unknown tag as text content
    expect(result.children.length).toBeGreaterThan(0);
  });
});
