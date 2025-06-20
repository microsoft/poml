import { describe, expect, test } from '@jest/globals';
import { PomlFile } from 'poml/file';
import { read, write, poml } from 'poml';
import { ErrorCollection } from 'poml/base';

describe('stringToElement', () => {
  test('simple', async () => {
    const text = '<Markup.Paragraph>Hello, world!</Markup.Paragraph>';
    const element = new PomlFile(text).react();
    expect(await read(element)).toBe(
      '<env presentation=\"markup\" markup-lang=\"markdown\" original-start-index=\"0\" original-end-index=\"49\"><p original-start-index=\"0\" original-end-index=\"49\">Hello, world!</p></env>'
    );
  });

  test('space', async () => {
    const text =
      '<markup.paragraph><markup.header>hello\n\n</markup.header>\n\n\n<markup.bold>world</markup.bold>\n  </markup.paragraph>';
    const element = new PomlFile(text).react();
    expect((element.props as any).children.length).toBe(4);
    expect(await read(element)).toBe(
      '<env presentation=\"markup\" markup-lang=\"markdown\" original-start-index=\"0\" original-end-index=\"112\"><p original-start-index=\"0\" original-end-index=\"112\"><h level=\"1\" original-start-index=\"18\" original-end-index=\"55\">hello</h> <b original-start-index=\"59\" original-end-index=\"90\">world</b></p></env>'
    );
    expect(await read(element)).toBe(await read(text));
    expect(write(await read(element))).toBe('# hello\n\n**world**');
  });

  test('variable', async () => {
    const text = '<Markup.Paragraph> {{name}} </Markup.Paragraph>';
    const element = new PomlFile(text).react({ name: 'world' });
    expect(await read(element)).toBe(
      '<env presentation=\"markup\" markup-lang=\"markdown\" original-start-index=\"0\" original-end-index=\"46\"><p original-start-index=\"0\" original-end-index=\"46\">world</p></env>'
    );
  });

  test('list', async () => {
    ErrorCollection.clear();
    const text = '<list listStyle="decimal"><item>Do not have</item></list>';
    const element = new PomlFile(text).react();
    expect(write(await read(element))).toBe('1. Do not have');
  
    const textComplex = `<list listStyle="decimal">
    <item>Do not have</item>
    <item>true</item>
    <item><code inline="false" lang="cpp">world</code></item>
</list>`;
    const elementComplex = new PomlFile(textComplex).react();
    expect(write(await read(elementComplex))).toBe('1. Do not have\n2. true\n\n3. ```cpp\n   world\n   ```');
    expect(ErrorCollection.empty()).toBe(true);
  });

  test('variableObject', () => {
    const text = '<Markup.Header writerOptions="{{{markdownBaseHeaderLevel: 3}}}">hello</Markup.Header>';
    const element = new PomlFile(text).react();
    expect((element.props as any).writerOptions).toStrictEqual({ markdownBaseHeaderLevel: 3 });
  })

  test('attrVariable', () => {
    const text = '<Markup.Paragraph blankLine="{{true}}">hello</Markup.Paragraph>';
    const element = new PomlFile(text).react();
    expect((element.props as any).blankLine).toBe(true);
  });

  test('inEssentials', async () => {
    const markup = '<p syntax="html">hello</p>';
    const element = new PomlFile(markup).react();
    expect(await read(element)).toBe(
      '<env presentation=\"markup\" markup-lang=\"html\" original-start-index=\"0\" original-end-index=\"25\"><p original-start-index=\"0\" original-end-index=\"25\">hello</p></env>'
    );

    const markupHyphen = '<serialize.object syntax="json" data="{{myData}}"/>';
    const elementHyphen = new PomlFile(markupHyphen).react({
      myData: {
        name: 'world'
      }
    });
    expect(await poml(elementHyphen)).toBe('{\n  "name": "world"\n}');
  });

  test('inplaceContextStylesheet', async () => {
    const text =
      '<poml><p>{{name}}</p><stylesheet>{"p": {"speaker": "ai"}}</stylesheet><context>{"name": "world"}</context></poml>';
    const element = new PomlFile(text).react();
    expect(write(await read(element), { speaker: true })).toStrictEqual([
      { speaker: 'ai', content: 'world' }
    ]);

    const text2 = `<poml><p>hello world<p speaker="human">{{name}}</p></p>
<stylesheet>
{
    "p": {
        "speaker": "human"
    }
}
</stylesheet>
<context>
{
    "name": "world"
}
</context></poml>`;
    const element2 = new PomlFile(text2).react();
    expect(write(await read(element2), { speaker: true })).toStrictEqual([
      { speaker: 'human', content: 'hello world\n\nworld' }
    ]);
  });

  test('emptyLine', async () => {
    const text = '<poml>\n\n<examples>\n\nhello\n\n</examples>\n\n</poml>';
    const element = await read(text);
    expect(element).toMatch('Examples</h><p>hello</p></p></p>');
  });

  test('yaml', async () => {
    const text = `<poml syntax='yaml'>
<role>Senior Systems Architecture Consultant</role>
<task>Legacy System Migration Analysis</task>
</poml>`;
    const element = write(await read(text));
    expect(element).toBe('role: Senior Systems Architecture Consultant\ntask: Legacy System Migration Analysis');
  });

  test('xml', async () => {
    const text = `<poml syntax='xml'>
<role>Senior Systems Architecture Consultant</role>
<task>Legacy System Migration Analysis</task>
</poml>`;
    const element = write(await read(text));
    expect(element).toBe('<role>Senior Systems Architecture Consultant</role>\n<task>Legacy System Migration Analysis</task>');
  });

  test('escape', async () => {
    // const text = '<poml><p>hello <sp value="&"/> world</p> <sp value="&lt;" />end<sp value=">"/></poml>';
    // FIXME: extra space is not allowed here
    // const text = '<poml><p>hello #amp; world</p>   #lt;end#gt;</poml>';
    const text = '<poml><p>hello #amp; world</p>#lt;end#gt;</poml>';
    const element = write(await read(text));
    expect(element).toBe('hello & world\n\n<end>');
  });
});

describe('autoAddPoml', () => {
  test('freeText', async () => {
    const text = `My home\n\n1. The  house is big\n2. The house is small\n\nMy car\n\n1. The car is red\n    2. The car is blue`;
    const result = await poml(text);
    expect(result).toBe(text);
  });

  test('emptySpaceBeforeAfter', async () => {
    const text = '    <poml><p>hello</p>\n\n\n\n\n<p>hello</p></poml>    ';
    const result = await poml(text);
    expect(result).toBe('hello\n\nhello');
  });

  test('commentBefore', async () => {
    const text = '<!-- hello -->  \n  <poml syntax="json">hello</poml>';
    const readResult = await read(text);
    expect(readResult).toMatch(/^<env presentation="serialize" serializer="json"/);
    const writeResult = write(readResult);
    expect(writeResult).toBe('"hello"');
  });

  test('commentBetween', async () => {
    const text = `<poml>  
    <!-- hello1 -->
    <p> <!-- something -->  hello  </p>
    <!-- hello2 -->
    </poml>`;
    const readResult = await read(text);
    expect(readResult).toMatch(/>hello<\/p><\/p><\/env>$/);
    expect(readResult).toMatch(/><p /);
  });
});

describe('templateEngine', () => {
  test('forLoop', async () => {
    const text = '<p><p for="i in [1,2,3]">{{i}}</p></p>';
    expect(await poml(text)).toBe('1\n\n2\n\n3');
    expect(ErrorCollection.empty()).toBe(true);
  });

  test('forLoopNested', async () => {
    const text = '<p><p for="i in [1,2,3]"><p>{{i}}</p></p></p>';
    expect(await poml(text)).toBe('1\n\n2\n\n3');
  })

  test('ifCondition', async () => {
    const text =
      '<p><p if="true">hello</p><p if="i == 0">world</p><p if="{{ i == 1 }}">foo</p></p>';
    expect(write(await read(text, undefined, { i: 0 }))).toBe('hello\n\nworld');
    expect(ErrorCollection.empty()).toBe(true);
    expect(write(await read(text, undefined, { i: 1 }))).toBe('hello\n\nfoo');
    expect(ErrorCollection.empty()).toBe(true);
  });

  test('let', async () => {
    const text = '<p><let name="i" value="1"/><p>{{i}}</p></p>';
    expect(await poml(text)).toBe('1');
    expect(ErrorCollection.empty()).toBe(true);
  });

  test('letFileError', () => {
    const text1 =
      '<let src="assets/peopleList.json" name="people" /><p>hello {{people[0].name.first}}</p>';
    read(text1, undefined, undefined, undefined, __filename);
    expect(ErrorCollection.empty()).toBe(false);
    const error = ErrorCollection.first();
    expect(error.message).toMatch(/Cannot read properties of undefined \(reading 'first'\)/);
    expect((error as any).startIndex).toBe(59);
    expect((error as any).endIndex).toBe(82);
    ErrorCollection.clear();

    const text2 = '<let src="assets/people.json" name="people" />';
    read(text2, undefined, undefined, undefined, __filename);
    expect(ErrorCollection.empty()).toBe(false);
    const error2 = ErrorCollection.first();
    expect(error2.message).toMatch(/no such file or directory/);
    expect((error2 as any).startIndex).toBe(9);
    expect((error2 as any).endIndex).toBe(28);
    ErrorCollection.clear();
  });

  test('letFile', async () => {
    const text =
      '<let src="assets/peopleList.json" name="people" /><p>hello {{people[0].first_name}}</p>';
    expect(write(await read(text, undefined, undefined, undefined, __filename))).toBe('hello Jeanette');
  });

  test('letContent', async () => {
    const text = '<let>{ "name": "world" }</let><p>hello {{name}}</p>';
    expect(write(await read(text))).toBe('hello world');
  });

  test('letObject', async () => {
    const text = '<let>{ "object": { "complex": true } }</let><p>{{object}}</p>';
    expect(write(await read(text))).toBe('{"complex":true}');
  });
});

describe('include', () => {
  test('basic include', async () => {
    const text = '<poml><include src="assets/includeChild.poml"/></poml>';
    const result = write(
      await read(text, undefined, { name: 'world' }, undefined, __filename)
    );
    expect(result).toBe('hello world');
  });

  test('include loop', async () => {
    const text = '<poml><include src="assets/includeNumber.poml" for="i in [1,2]"/></poml>';
    const result = write(await read(text, undefined, undefined, undefined, __filename));
    expect(result).toBe('1\n\n2');
  });

  test('include if', async () => {
    const text = '<poml><include src="assets/includeChild.poml" if="false"/></poml>';
    const result = write(
      await read(text, undefined, { name: 'world' }, undefined, __filename)
    );
    expect(result).toStrictEqual([]);
  });

  test('nested include', async () => {
    const text = '<poml><include src="assets/includeNested.poml"/></poml>';
    const result = write(
      await read(text, undefined, { name: 'world' }, undefined, __filename)
    );
    expect(result).toBe('hello world\n\n3\n\n4');
  });
});

describe('testPropsPreprocess', () => {
  test('parameter', async () => {
    const text = '<div class-name="hello">w12345</div>';
    const stylesheet = { '.hello': { SPEAKER: 'ai' } };
    const result = write(await read(text, undefined, undefined, stylesheet), { speaker: true });
    expect(ErrorCollection.empty()).toBe(true);
    expect(result).toStrictEqual([{ speaker: 'ai', content: 'w12345' }]);
  });

  test('chatFalse', async () => {
    const text = '<example chat="0"><input>hello</input><output>world</output></example>';
    const result = write(await read(text), { speaker: true });
    expect(ErrorCollection.empty()).toBe(true);
    expect(result).toStrictEqual([
      {
        speaker: 'human',
        content: '**Input:** hello\n\n**Output:** world'
      }
    ]);
  });
});

describe('lspFeatures', () => {
  test('hover', () => {
    const text = '<p><p>hello</p></p>';
    const poml = new PomlFile(text);
    const hover = poml.getHoverToken(1);
    expect(hover).toStrictEqual({
      type: 'element',
      range: { start: 1, end: 1 },
      element: 'p'
    });
  });

  test('completion', () => {
    const text = '<p\n';
    const poml = new PomlFile(text);
    const completion = poml.getCompletions(2);
    expect(completion).toContainEqual({
      type: 'element',
      range: { start: 1, end: 1 },
      element: 'Paragraph'
    });
  });

  test('completionAlias', () => {
    const text = '<poml><di  </poml>';
    const poml = new PomlFile(text);
    const completion = poml.getCompletions(9);
    expect(completion).toStrictEqual([
      {
        type: 'element',
        range: { start: 7, end: 8 },
        element: 'div'
      }
    ]);
  });

  test('completionHyphen', () => {
    const text = '<output-fo';
    const poml = new PomlFile(text);
    const completion = poml.getCompletions(10);
    expect(completion).toStrictEqual([
      {
        type: 'element',
        range: { start: 1, end: 9 },
        element: 'output-format'
      }
    ]);
  });

  test('completionClose', () => {
    const text = '<paragraph></para';
    const poml = new PomlFile(text);
    const completion = poml.getCompletions(text.length);
    expect(completion).toStrictEqual([
      {
        type: 'element',
        range: { start: 13, end: 16 },
        element: 'paragraph'
      }
    ]);
  });

  test('completionCloseWithNonStandard', () => {
    const text = '<random></>';
    const poml = new PomlFile(text);
    const completion = poml.getCompletions(text.length - 1);
    expect(completion).toStrictEqual([
      {
        type: 'element',
        range: { start: text.length - 1, end: text.length - 2 },
        element: 'random'
      }
    ]);
  });

  test('completionAttribute', () => {
    const text = '<question sp';
    const poml = new PomlFile(text);
    const completion = poml.getCompletions(text.length);
    expect(completion).toStrictEqual([
      {
        type: 'attribute',
        range: { start: 10, end: 11 },
        element: 'Question',
        attribute: 'speaker'
      }
    ]);
  });

  test('completionAttributeWoPrefix', () => {
    const text = '<question ';
    const poml = new PomlFile(text);
    const completion = poml.getCompletions(text.length);
    expect(completion.length).toBeGreaterThan(5);
    expect(completion).toContainEqual({
      attribute: 'questionCaption',
      element: 'Question',
      range: { end: 9, start: 9 },
      type: 'attribute'
    });
  });

  test('completionAttributeValue', () => {
    const text = '<question speaker=""';
    const poml = new PomlFile(text);
    const completion = poml.getCompletions(text.length - 1);
    expect(completion).toContainEqual({
      type: 'attributeValue',
      range: { start: 19, end: 18 },
      element: 'Question',
      attribute: 'speaker',
      value: 'human'
    });
  });
});
