import { describe, expect, test } from '@jest/globals';
import { PomlFile } from 'poml/file';
import { read, write, poml } from 'poml';
import { ErrorCollection } from 'poml/base';

describe('stringToElement', () => {
  test('simple', async () => {
    const text = '<Markup.Paragraph>Hello, world!</Markup.Paragraph>';
    const element = new PomlFile(text).react();
    expect(await read(element)).toBe(
      '<env presentation="markup" markup-lang="markdown" original-start-index="0" original-end-index="49"><p original-start-index="0" original-end-index="49">Hello, world!</p></env>',
    );
  });

  test('space', async () => {
    const text =
      '<markup.paragraph><markup.header>hello\n\n</markup.header>\n\n\n<markup.bold>world</markup.bold>\n  </markup.paragraph>';
    const element = new PomlFile(text).react();
    expect((element.props as any).children.length).toBe(4);
    expect(await read(element)).toBe(
      '<env presentation="markup" markup-lang="markdown" original-start-index="0" original-end-index="112"><p original-start-index="0" original-end-index="112"><h level="1" original-start-index="18" original-end-index="55">hello</h> <b original-start-index="59" original-end-index="90">world</b></p></env>',
    );
    expect(await read(element)).toBe(await read(text));
    expect(write(await read(element))).toBe('# hello\n\n**world**');
  });

  test('variable', async () => {
    const text = '<Markup.Paragraph> {{name}} </Markup.Paragraph>';
    const element = new PomlFile(text).react({ name: 'world' });
    expect(await read(element)).toBe(
      '<env presentation="markup" markup-lang="markdown" original-start-index="0" original-end-index="46"><p original-start-index="0" original-end-index="46">world</p></env>',
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
  });

  test('attrVariable', () => {
    const text = '<Markup.Paragraph blankLine="{{true}}">hello</Markup.Paragraph>';
    const element = new PomlFile(text).react();
    expect((element.props as any).blankLine).toBe(true);
  });

  test('inEssentials', async () => {
    const markup = '<p syntax="html">hello</p>';
    const element = new PomlFile(markup).react();
    expect(await read(element)).toBe(
      '<env presentation="markup" markup-lang="html" original-start-index="0" original-end-index="25"><p original-start-index="0" original-end-index="25">hello</p></env>',
    );

    const markupHyphen = '<serialize.object syntax="json" data="{{myData}}"/>';
    const elementHyphen = new PomlFile(markupHyphen).react({
      myData: {
        name: 'world',
      },
    });
    expect(await poml(elementHyphen)).toBe('{\n  "name": "world"\n}');
  });

  test('inplaceContextStylesheet', async () => {
    const text =
      '<poml><p>{{name}}</p><stylesheet>{"p": {"speaker": "ai"}}</stylesheet><context>{"name": "world"}</context></poml>';
    const element = new PomlFile(text).react();
    expect(write(await read(element), { speaker: true })).toStrictEqual([{ speaker: 'ai', content: 'world' }]);

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
      { speaker: 'human', content: 'hello world\n\nworld' },
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
    expect(element).toBe(
      '<role>Senior Systems Architecture Consultant</role>\n<task>Legacy System Migration Analysis</task>',
    );
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
  });

  test('forLoopIf', async () => {
    const text = '<p><p for="i in [0,1,2]" if="i % 2 == 0">{{i}}</p></p>';
    expect(await poml(text)).toBe('0\n\n2');
  });

  test('forLoopIfLoopIndex', async () => {
    const text = '<p><p for="i in [1,2]" if="loop.index == 1">{{i}}</p></p>';
    expect(await poml(text)).toBe('2');
  });

  test('ifCondition', async () => {
    const text = '<p><p if="true">hello</p><p if="i == 0">world</p><p if="{{ i == 1 }}">foo</p></p>';
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
    const text1 = '<let src="assets/peopleList.json" name="people" /><p>hello {{people[0].name.first}}</p>';
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
    const text = '<let src="assets/peopleList.json" name="people" /><p>hello {{people[0].first_name}}</p>';
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

  test('letValueString', async () => {
    const text = '<let name="greeting" value="\'Hello, world!\'" /><p>{{greeting}}</p>';
    expect(await poml(text)).toBe('Hello, world!');
    expect(ErrorCollection.empty()).toBe(true);
  });

  test('letValueStringDoubleQuotes', async () => {
    const text = '<let name="greeting" value=\'"Hello, world!"\' /><p>{{greeting}}</p>';
    expect(await poml(text)).toBe('Hello, world!');
    expect(ErrorCollection.empty()).toBe(true);
  });

  test('letValueNumber', async () => {
    const text = '<let name="count" value="42" /><p>{{count}}</p>';
    expect(await poml(text)).toBe('42');
    expect(ErrorCollection.empty()).toBe(true);
  });

  test('letValueArray', async () => {
    const text = '<let name="items" value="[1, 2, 3]" /><p>{{items[1]}}</p>';
    expect(await poml(text)).toBe('2');
    expect(ErrorCollection.empty()).toBe(true);
  });

  test('letValueObject', async () => {
    const text = '<let name="person" value="{name: \'Alice\', age: 30}" /><p>{{person.name}}</p>';
    expect(await poml(text)).toBe('Alice');
    expect(ErrorCollection.empty()).toBe(true);
  });

  test('letValueExpression', async () => {
    const text = '<let name="result" value="5 * 8 + 2" /><p>{{result}}</p>';
    expect(await poml(text)).toBe('42');
    expect(ErrorCollection.empty()).toBe(true);
  });

  test('letValueBooleanTrue', async () => {
    const text = '<let name="flag" value="true" /><p if="flag">Visible</p>';
    expect(await poml(text)).toBe('Visible');
    expect(ErrorCollection.empty()).toBe(true);
  });

  test('letValueBooleanFalse', async () => {
    const text = '<let name="flag" value="false" /><p if="flag">Hidden</p><p if="!flag">Visible</p>';
    expect(await poml(text)).toBe('Visible');
    expect(ErrorCollection.empty()).toBe(true);
  });

  test('letValueStringWithoutQuotes', async () => {
    ErrorCollection.clear();
    const text = '<let name="greeting" value="Hello, world!" /><p>{{greeting}}</p>';
    try {
      await poml(text);
      // This should fail because Hello, world! is not a valid JavaScript expression
      expect(true).toBe(false); // This should not be reached
    } catch (error) {
      expect(ErrorCollection.empty()).toBe(false);
    }
    ErrorCollection.clear();
  });

  test('letValueInChildren', async () => {
    const text = '<let name="greeting">Hello, world!</let><p>{{greeting}}</p>';
    expect(await poml(text)).toBe('Hello, world!');
    expect(ErrorCollection.empty()).toBe(true);
  });

  test('letLocal', async () => {
    const text = '<poml><p for="i in [1,2]"><let name="j" value="i * 2"/><p>{{j}}</p></p></poml>';
    const ir = await read(text);
    expect(await poml(text)).toBe('2\n\n4');
    expect(ErrorCollection.empty()).toBe(true);
  });
});

describe('expressionEvaluation', () => {
  test('captures expression tokens for meta parser="eval"', () => {
    const text = `<poml>
      <let name="fields" value='["name", "age"]' />
      <output-schema parser="eval">
        z.object({
          name: z.string(),
          age: z.number()
        })
      </output-schema>
    </poml>`;
    const file = new PomlFile(text);
    file.react();

    const tokens = file.getExpressionTokens();
    // Should have tokens for: let value attribute and meta eval content
    expect(tokens.length).toBeGreaterThanOrEqual(2);

    // Find the let value token
    const letToken = tokens.find((t) => t.expression === '["name", "age"]');
    expect(letToken).toBeDefined();
    expect(letToken?.type).toBe('expression');

    // Find the output-schema eval token
    const metaToken = tokens.find((t) => t.expression?.includes('z.object'));
    expect(metaToken).toBeDefined();
    expect(metaToken?.type).toBe('expression');
  });

  test('captures evaluation history', () => {
    ErrorCollection.clear();
    const text = '<p for="i in [1,2]">{{i}}</p>';
    const file = new PomlFile(text);
    file.react();
    const tokens = file.getExpressionTokens();
    expect(tokens.length).toBe(2);
    const position = text.indexOf('{{i}}');
    expect(file.getExpressionEvaluations({ start: position, end: position + 4 })).toStrictEqual([1, 2]);
    expect(ErrorCollection.empty()).toBe(true);
  });

  test('tracks meta eval evaluation', () => {
    ErrorCollection.clear();
    const text = `<poml>
      <let name="num" value="42" />
      <output-schema parser="eval">
        z.object({ value: z.number().max(num) })
      </output-schema>
    </poml>`;
    const file = new PomlFile(text);
    file.react();

    // Verify the schema was created successfully
    const schema = file.getResponseSchema();
    expect(schema).toBeDefined();

    // Verify expression tokens are collected
    const tokens = file.getExpressionTokens();
    const metaToken = tokens.find((t) => t.expression?.includes('z.object'));
    expect(metaToken).toBeDefined();
    expect(metaToken?.type).toBe('expression');

    // The expression should be the full z.object expression
    expect(metaToken?.expression?.trim()).toContain('z.object');
    expect(metaToken?.expression?.trim()).toContain('z.number()');

    ErrorCollection.clear();
  });

  test('tracks each expression separately', () => {
    ErrorCollection.clear();
    const text = '<p>{{1+2}} {{1+2}}</p>';
    const file = new PomlFile(text);
    file.react();
    const tokens = file.getExpressionTokens();
    expect(tokens.length).toBe(2);
    expect(file.getExpressionEvaluations({ start: tokens[0].range.start, end: tokens[0].range.end })).toStrictEqual([
      3,
    ]);
    expect(file.getExpressionEvaluations({ start: tokens[1].range.start, end: tokens[1].range.end })).toStrictEqual([
      3,
    ]);
  });
});

describe('include', () => {
  test('basic include', async () => {
    const text = '<poml><include src="assets/includeChild.poml"/></poml>';
    const result = write(await read(text, undefined, { name: 'world' }, undefined, __filename));
    expect(result).toBe('hello world');
  });

  test('include loop', async () => {
    const text = '<poml><include src="assets/includeNumber.poml" for="i in [1,2]"/></poml>';
    const result = write(await read(text, undefined, undefined, undefined, __filename));
    expect(result).toBe('1\n\n2');
  });

  test('include if', async () => {
    const text = '<poml><include src="assets/includeChild.poml" if="false"/></poml>';
    const result = write(await read(text, undefined, { name: 'world' }, undefined, __filename));
    expect(result).toStrictEqual([]);
  });

  test('nested include', async () => {
    const text = '<poml><include src="assets/includeNested.poml"/></poml>';
    const result = write(await read(text, undefined, { name: 'world' }, undefined, __filename));
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
        content: '**Input:** hello\n\n**Output:** world',
      },
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
      element: 'p',
    });
  });

  test('completion', () => {
    const text = '<p\n';
    const poml = new PomlFile(text);
    const completion = poml.getCompletions(2);
    expect(completion).toContainEqual({
      type: 'element',
      range: { start: 1, end: 1 },
      element: 'Paragraph',
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
        element: 'div',
      },
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
        element: 'output-format',
      },
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
        element: 'paragraph',
      },
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
        element: 'random',
      },
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
        attribute: 'speaker',
      },
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
      type: 'attribute',
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
      value: 'human',
    });
  });
});

describe('meta elements', () => {
  test('responseSchema with JSON', () => {
    const text = `<poml>
      <output-schema parser="json">
        {
          "type": "object",
          "properties": {
            "name": { "type": "string" },
            "age": { "type": "number" }
          },
          "required": ["name"]
        }
      </output-schema>
    </poml>`;
    const file = new PomlFile(text);
    file.react();
    const schema = file.getResponseSchema();
    expect(schema).toBeDefined();
    expect(schema?.toOpenAPI()).toEqual({
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['name'],
    });
  });

  test('responseSchema with Zod', () => {
    ErrorCollection.clear();
    const text = `<poml>
      <output-schema>
        z.object({
          name: z.string(),
          age: z.number().optional()
        })
      </output-schema>
    </poml>`;
    const file = new PomlFile(text);
    file.react();
    expect(ErrorCollection.empty()).toBe(true);
    const schema = file.getResponseSchema();
    expect(schema).toBeDefined();
    const zodSchema = schema?.toZod();
    expect(zodSchema).toBeDefined();
    ErrorCollection.clear();
  });

  test('tool with JSON schema', () => {
    const text = `<poml>
      <tool-definition name="getWeather" description="Get weather information">
        {
          "type": "object",
          "properties": {
            "location": { "type": "string" },
            "unit": { "type": "string", "enum": ["celsius", "fahrenheit"] }
          },
          "required": ["location"]
        }
      </tool-definition>
    </poml>`;
    const file = new PomlFile(text);
    file.react();
    const toolsSchema = file.getToolsSchema();
    expect(toolsSchema).toBeDefined();
    expect(toolsSchema?.size()).toBe(1);
    const tool = toolsSchema?.getTool('getWeather');
    expect(tool).toBeDefined();
    expect(tool?.name).toBe('getWeather');
    expect(tool?.description).toBe('Get weather information');
  });

  test('tool with Zod schema', () => {
    ErrorCollection.clear();
    const text = `<poml>
      <tool-definition name="calculate" description="Perform calculation">
        z.object({
          operation: z.enum(['add', 'subtract']),
          a: z.number(),
          b: z.number()
        })
      </tool-definition>
    </poml>`;
    const file = new PomlFile(text);
    file.react();
    expect(ErrorCollection.empty()).toBe(true);
    const toolsSchema = file.getToolsSchema();
    expect(toolsSchema).toBeDefined();
    expect(toolsSchema?.size()).toBe(1);
    const tool = toolsSchema?.getTool('calculate');
    expect(tool).toBeDefined();
    expect(tool?.name).toBe('calculate');
    expect(tool?.description).toBe('Perform calculation');
    ErrorCollection.clear();
  });

  test('multiple responseSchema error', () => {
    ErrorCollection.clear();
    const text = `<poml>
      <output-schema parser="json">{"type": "string"}</output-schema>
      <output-schema parser="json">{"type": "number"}</output-schema>
    </poml>`;
    const file = new PomlFile(text);
    file.react();
    expect(ErrorCollection.empty()).toBe(false);
    const error = ErrorCollection.first();
    expect(error.message).toContain('Multiple output-schema elements found');
    ErrorCollection.clear();
  });

  test('tool without name error', () => {
    ErrorCollection.clear();
    const text = `<poml>
      <tool description="Missing name">
        {"type": "object"}
      </tool>
    </poml>`;
    const file = new PomlFile(text);
    file.react();
    expect(ErrorCollection.empty()).toBe(false);
    const error = ErrorCollection.first();
    expect(error.message).toContain('name attribute is required for tool definition');
    ErrorCollection.clear();
  });

  test('runtime parameters', () => {
    const text = `<poml>
      <runtime temperature="0.7" max-tokens="1000" model="gpt-4">
      </runtime>
    </poml>`;
    const file = new PomlFile(text);
    file.react();
    const runtimeParams = file.getRuntimeParameters();
    expect(runtimeParams).toEqual({
      temperature: 0.7,
      maxTokens: 1000,
      model: 'gpt-4',
    });
  });

  test('runtime parameters with key conversion', () => {
    const text = `<poml>
      <runtime 
        max-tokens="1500" 
        top-p="0.9" 
        frequency-penalty="0.5"
        presence-penalty="0.3"
        stop-sequences='["END", "STOP"]'
      />
    </poml>`;
    const file = new PomlFile(text);
    file.react();
    const runtimeParams = file.getRuntimeParameters();
    expect(runtimeParams).toEqual({
      maxTokens: 1500,
      topP: 0.9,
      frequencyPenalty: 0.5,
      presencePenalty: 0.3,
      stopSequences: ['END', 'STOP'],
    });
  });

  test('runtime parameters with boolean conversion', () => {
    const text = `<poml>
      <runtime 
        stream="true" 
        debug="false"
        enable-logging="true"
      />
    </poml>`;
    const file = new PomlFile(text);
    file.react();
    const runtimeParams = file.getRuntimeParameters();
    expect(runtimeParams).toEqual({
      stream: true,
      debug: false,
      enableLogging: true,
    });
  });

  test('runtime parameters with number conversion', () => {
    const text = `<poml>
      <runtime 
        temperature="0.7"
        max-tokens="2000"
        seed="12345"
        timeout="30.5"
      />
    </poml>`;
    const file = new PomlFile(text);
    file.react();
    const runtimeParams = file.getRuntimeParameters();
    expect(runtimeParams).toEqual({
      temperature: 0.7,
      maxTokens: 2000,
      seed: 12345,
      timeout: 30.5,
    });
  });

  test('runtime parameters with JSON conversion', () => {
    const text = `<poml>
      <runtime 
        stop='["\\n", "END"]'
        config='{"retry": 3, "timeout": 5000}'
        metadata='{"user": "test", "session": 123}'
      />
    </poml>`;
    const file = new PomlFile(text);
    file.react();
    const runtimeParams = file.getRuntimeParameters();
    expect(runtimeParams).toEqual({
      stop: ['\n', 'END'],
      config: { retry: 3, timeout: 5000 },
      metadata: { user: 'test', session: 123 },
    });
  });

  test('runtime parameters with mixed types', () => {
    const text = `<poml>
      <runtime 
        model="gpt-4"
        temperature="0.8"
        max-output-tokens="1000"
        stream="true"
        stop-sequences='["END", "STOP"]'
        custom-config='{"advanced": true}'
      />
    </poml>`;
    const file = new PomlFile(text);
    file.react();
    const runtimeParams = file.getRuntimeParameters();
    expect(runtimeParams).toEqual({
      model: 'gpt-4',
      temperature: 0.8,
      maxOutputTokens: 1000,
      stream: true,
      stopSequences: ['END', 'STOP'],
      customConfig: { advanced: true },
    });
  });

  test('runtime parameters with invalid JSON fallback to string', () => {
    const text = `<poml>
      <runtime 
        valid-json='["test"]'
        invalid-json='{"missing": quote}'
        not-json="just a string"
      />
    </poml>`;
    const file = new PomlFile(text);
    file.react();
    const runtimeParams = file.getRuntimeParameters();
    expect(runtimeParams).toEqual({
      validJson: ['test'],
      invalidJson: '{"missing": quote}', // Falls back to string
      notJson: 'just a string',
    });
  });

  test('runtime parameters with template expressions', () => {
    const text = `<poml>
      <let name="temp" value="0.8" />
      <let name="maxTokens" value="2000" />
      <let name="modelName">gpt-4</let>
      <runtime 
        temperature="{{temp}}"
        max-tokens="{{maxTokens}}"
        model="{{modelName}}"
        debug="{{temp > 0.5}}"
        stop-sequences='{{JSON.stringify(["END", "STOP"])}}'
      />
    </poml>`;
    const file = new PomlFile(text);
    file.react();
    const runtimeParams = file.getRuntimeParameters();
    expect(runtimeParams).toEqual({
      temperature: 0.8,
      maxTokens: 2000,
      model: 'gpt-4',
      debug: true,
      stopSequences: ['END', 'STOP'],
    });
  });

  test('output schema with template expressions', () => {
    ErrorCollection.clear();
    const text = `<poml>
      <let name="fieldName" value="{{ 'username' }}" />
      <let name="maxLength" value="50" />
      <let name="parser">json</let>
      <output-schema parser="{{ parser }}">
        {
          "type": "object",
          "properties": {
            "{{fieldName}}": {
              "type": "string",
              "maxLength": {{maxLength}}
            },
            "email": {
              "type": "string",
              "format": "email"
            }
          },
          "required": ["{{fieldName}}"]
        }
      </output-schema>
      <p>Test content</p>
    </poml>`;
    const file = new PomlFile(text);
    file.react();
    const schema = file.getResponseSchema();
    expect(schema).toBeDefined();
    const openApiSchema = schema?.toOpenAPI();
    expect(openApiSchema).toEqual({
      type: 'object',
      properties: {
        username: {
          type: 'string',
          maxLength: 50,
        },
        email: {
          type: 'string',
          format: 'email',
        },
      },
      required: ['username'],
    });
    expect(ErrorCollection.empty()).toBe(true);
    ErrorCollection.clear();
  });

  test('tool definition with template expressions', () => {
    ErrorCollection.clear();
    const text = `<poml>
      <let name="toolName">calculate</let>
      <let name="toolDescription">Perform mathematical calculations</let>
      <let name="operations" value='["add", "subtract", "multiply", "divide"]' />
      <tool-definition name="{{toolName}}" description="{{toolDescription}}" parser="json">
        {
          "type": "object",
          "properties": {
            "operation": {
              "type": "string",
              "enum": {{JSON.stringify(operations)}}
            },
            "a": {
              "type": "number"
            },
            "b": {
              "type": "number"
            }
          },
          "required": ["operation", "a", "b"]
        }
      </tool-definition>
      <p>Test content</p>
    </poml>`;
    const file = new PomlFile(text);
    file.react();
    const toolsSchema = file.getToolsSchema();
    expect(toolsSchema).toBeDefined();
    const tools = toolsSchema?.getTools();
    expect(tools).toHaveLength(1);
    expect(tools![0].name).toBe('calculate');
    expect(tools![0].description).toBe('Perform mathematical calculations');
    const inputSchema = tools![0].inputSchema.toOpenAPI();
    expect(inputSchema).toEqual({
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['add', 'subtract', 'multiply', 'divide'],
        },
        a: {
          type: 'number',
        },
        b: {
          type: 'number',
        },
      },
      required: ['operation', 'a', 'b'],
    });
    expect(ErrorCollection.empty()).toBe(true);
    ErrorCollection.clear();
  });

  test('tool definition with template attributes from docs', () => {
    ErrorCollection.clear();
    const text = `<poml>
      <let name="toolName">calculate</let>
      <let name="toolDesc">Perform mathematical calculations</let>
      <let name="schemaParser">json</let>

      <tool-definition name="{{toolName}}" description="{{toolDesc}}" parser="{{schemaParser}}">
        {
          "type": "object",
          "properties": {
            "operation": { "type": "string" }
          }
        }
      </tool-definition>
    </poml>`;
    const file = new PomlFile(text);
    file.react();
    const toolsSchema = file.getToolsSchema();
    expect(toolsSchema).toBeDefined();
    const tools = toolsSchema?.getTools();
    expect(tools).toHaveLength(1);
    expect(tools![0].name).toBe('calculate');
    expect(tools![0].description).toBe('Perform mathematical calculations');
    const inputSchema = tools![0].inputSchema.toOpenAPI();
    expect(inputSchema).toEqual({
      type: 'object',
      properties: {
        operation: { type: 'string' },
      },
    });
    expect(ErrorCollection.empty()).toBe(true);
    ErrorCollection.clear();
  });

  test('output schema with template content from docs', () => {
    ErrorCollection.clear();
    const text = `<poml>
      <let name="schemaJson">
      {
        "type": "object",
        "properties": {
          "result": { "type": "string" }
        }
      }
      </let>
      <output-schema parser="json">
      {{ schemaJson }}
      </output-schema>
    </poml>`;
    const file = new PomlFile(text);
    file.react();
    const schema = file.getResponseSchema();
    expect(schema).toBeDefined();
    const openApiSchema = schema?.toOpenAPI();
    expect(openApiSchema).toEqual({
      type: 'object',
      properties: {
        result: { type: 'string' },
      },
    });
    expect(ErrorCollection.empty()).toBe(true);
    ErrorCollection.clear();
  });

  test('responseSchema with expression evaluation', () => {
    ErrorCollection.clear();
    const text = `<poml>
      <let name="maxAge" value="100" />
      <output-schema parser="json">
        {
          "type": "object",
          "properties": {
            "name": { "type": "string" },
            "age": { 
              "type": "number",
              "minimum": 0,
              "maximum": {{ maxAge }}
            }
          }
        }
      </output-schema>
    </poml>`;
    const file = new PomlFile(text);
    file.react();
    expect(ErrorCollection.empty()).toBe(true);
    const schema = file.getResponseSchema();
    expect(schema).toBeDefined();
    expect(schema?.toOpenAPI()).toEqual({
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: {
          type: 'number',
          minimum: 0,
          maximum: 100,
        },
      },
    });
    ErrorCollection.clear();
  });

  test('tool with expression evaluation in Zod', () => {
    ErrorCollection.clear();
    const text = `<poml>
      <let name="operations" value='["add", "subtract", "multiply", "divide"]' />
      <tool-definition name="calculator" description="Math operations" parser="eval">
        z.object({
          operation: z.enum(operations),
          a: z.number(),
          b: z.number()
        })
      </tool-definition>
    </poml>`;
    const file = new PomlFile(text);
    file.react();
    expect(ErrorCollection.empty()).toBe(true);
    const toolsSchema = file.getToolsSchema();
    expect(toolsSchema).toBeDefined();
    expect(toolsSchema?.size()).toBe(1);
    const tool = toolsSchema?.getTool('calculator');
    expect(tool).toBeDefined();
    expect(tool?.name).toBe('calculator');
    expect(tool?.description).toBe('Math operations');
    ErrorCollection.clear();
  });

  test('responseSchema Zod with z variable available', () => {
    ErrorCollection.clear();
    const text = `<poml>
      <let name="fields" value='{ "name": "string", "age": "number" }' />
      <output-schema parser="eval">
        z.object({
          name: z.string(),
          age: z.number(),
          timestamp: z.string().datetime()
        })
      </output-schema>
    </poml>`;
    const file = new PomlFile(text);
    file.react();
    expect(ErrorCollection.empty()).toBe(true);
    const schema = file.getResponseSchema();
    expect(schema).toBeDefined();
    const zodSchema = schema?.toZod();
    expect(zodSchema).toBeDefined();
    ErrorCollection.clear();
  });

  test('malformed JSON syntax error', () => {
    ErrorCollection.clear();
    const text = `<poml>
      <output-schema parser="json">
        {
          "type": "object",
          "properties": {
            "name": { "type": "string" },
          }
        }
      </output-schema>
    </poml>`;
    const file = new PomlFile(text);
    file.react();
    expect(ErrorCollection.empty()).toBe(false);
    const error = ErrorCollection.first();
    // JSON parse errors contain specific messages about the syntax error
    expect(error.message).toBeDefined();
    ErrorCollection.clear();
  });

  test('invalid expression evaluation error', () => {
    ErrorCollection.clear();
    const text = `<poml>
      <output-schema parser="eval">
        z.object({
          name: z.nonexistent(),
          age: z.number()
        })
      </output-schema>
    </poml>`;
    const file = new PomlFile(text);
    file.react();
    expect(ErrorCollection.empty()).toBe(false);
    const error = ErrorCollection.first();
    expect(error.message).toContain('z.nonexistent is not a function');
    ErrorCollection.clear();
  });

  test('invalid OpenAPI schema structure', () => {
    ErrorCollection.clear();
    const text = `<poml>
      <output-schema parser="json">
        "not an object"
      </output-schema>
    </poml>`;
    const file = new PomlFile(text);
    file.react();
    // Schema.fromOpenAPI should handle this - it might not error but create a schema
    const schema = file.getResponseSchema();
    expect(ErrorCollection.empty()).toBe(false);
    const error = ErrorCollection.first();
    expect(error.message).toContain('Invalid OpenAPI schema');
    expect(schema).toBeUndefined();
    ErrorCollection.clear();
  });
});
