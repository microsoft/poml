import * as React from 'react';

import { describe, expect, test } from '@jest/globals';

import { Table, Task, OutputFormat, ExampleSet, Example, ExampleInput, ExampleOutput, Question } from 'poml/components';
import { toRecordColumns } from 'poml/components/table';
import { Markup, Serialize } from 'poml/presentation';
import { Code, Text, Inline } from 'poml/essentials';
import { HtmlWriter, MarkdownWriter } from 'poml/writer';
import { read, write } from 'poml';
import { ErrorCollection } from 'poml/base';
import { readFileSync } from 'fs';

describe('other formats', () => {
  test('csv', () => {
    const recordColumns = toRecordColumns({ src: __dirname + '/assets/wikitqSampleData.csv' });
    expect(recordColumns.records.length).toBe(17);
    expect(recordColumns.columns!.length).toBe(6);
  });

  test('excel', () => {
    const recordColumns = toRecordColumns({ src: __dirname + '/assets/wikitqSampleData.xlsx' });
    const reference = toRecordColumns({ src: __dirname + '/assets/wikitqSampleData.csv' });
    expect(recordColumns).toStrictEqual(reference);
  });

  test('parse inline', async () => {
    ErrorCollection.clear();
    const table = '<poml><table records="start,end,text\n0,10,how are you\n10,20,today" parser="csv"/></poml>';
    const result = write(await read(table));
    expect(result).toMatch(/\| 20 {2}\| today/g);

    const tableIllegal = '<poml><table records="start,end,text\\n0,10,how are you\\n10,20,today" parser="csv"/></poml>';
    const resultIllegal = write(await read(tableIllegal));
    expect(resultIllegal).toMatch(/\| start \| end \| text\\n0 \| 10 \| how are you\\n10 \| 20 \| today \|/g);
    expect(ErrorCollection.empty());
  });

  test('to csv', async () => {
    const writer = new MarkdownWriter();
    const markdown = writer.write(await read(<Table src={__dirname + '/assets/wikitqSampleData.csv'} syntax='csv' />));
    expect(markdown).toMatch(
      readFileSync(__dirname + '/assets/wikitqSampleData.csv', 'utf-8').replaceAll('\r\n', '\n'),
    );

    const markdownSlim = writer.write(
      await read(
        <Table
          src={__dirname + '/assets/wikitqSampleData.csv'}
          syntax='csv'
          selectedRecords={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]}
          maxRecords={5}
          maxColumns={4}
        />,
      ),
    );
    expect(markdownSlim).toMatch(
      /3,México,\.\.\.,5,23\n\.\.\.,\.\.\.,\.\.\.,\.\.\.,\.\.\.\n9,U.S. Virgin Islands,\.\.\.,3,5/gm,
    );
  });

  test('to tsv', async () => {
    const writer = new MarkdownWriter();
    const markdown = writer.write(await read(<Table src={__dirname + '/assets/wikitqSampleData.csv'} syntax='tsv' />));
    expect(markdown).toMatch(/14\tDominican Republic\t0\t2\t4\t6/g);

    const markdownWithPeriod = writer.write(
      await read(
        <Table
          src={__dirname + '/assets/wikitqSampleData.csv'}
          syntax='tsv'
          writerOptions={{ csvSeparator: '.', csvHeader: false }}
        />,
      ),
    );
    expect(markdownWithPeriod).toMatch(/9\."U\.S\. Virgin Islands"\.1\.1\.3\.5/g);
  });

  test('to csv no header', async () => {
    const writer = new MarkdownWriter();
    const ir = await read(
      <Table
        src={__dirname + '/assets/wikitqSampleData.csv'}
        syntax='csv'
        writerOptions={{ csvSeparator: ';', csvHeader: false }}
      />,
    );
    const markdown = writer.write(ir);
    expect(markdown).toMatch(/^1;Puerto Rico;17;27;13;57\n2;Bahamas;17;15;19;51/g);
  });

  test('list of lists', async () => {
    const recordColumns = toRecordColumns({
      records: [
        [1, 2, 3],
        [4, 5, 6],
      ],
    });
    expect(recordColumns).toStrictEqual({
      records: [
        { '0': 1, '1': 2, '2': 3 },
        { '0': 4, '1': 5, '2': 6 },
      ],
      columns: [
        { field: '0', header: 'Column 0' },
        { field: '1', header: 'Column 1' },
        { field: '2', header: 'Column 2' },
      ],
    });
  });
});

describe('table', () => {
  const records = [
    { name: 'Frozen yoghurt', calories: 159, fat: 6.0, carbs: 24, protein: 4.0 },
    { name: 'Ice cream sandwich', calories: 237, fat: 9.0, carbs: 37, protein: 4.3 },
    { name: 'Eclair', calories: 262, fat: 16.0, carbs: 24, protein: 6.0 },
    { name: 'Cupcake', calories: 305, fat: 3.7, carbs: 67, protein: 4.3 },
    { name: 'Gingerbread', calories: 356, fat: 16.0, carbs: 49, protein: 3.9 },
  ];
  const columns = [
    { field: 'name', header: 'Dessert (100g serving)' },
    { field: 'calories', header: 'Calories' },
    { field: 'fat', header: 'Fat (g)' },
    { field: 'carbs', header: 'Carbs (g)' },
    { field: 'protein', header: 'Protein (g)' },
  ];

  test('markdown', async () => {
    ErrorCollection.clear();
    const table = (
      <Markup.Environment>
        <Table records={records} columns={columns} />
      </Markup.Environment>
    );
    const rendered = await read(table);
    expect(ErrorCollection.empty()).toBe(true);
    expect(rendered).toMatch(/<table><thead><trow><tcell>.*<tbody><trow><tcell>.*<\/table>/g);
    const writer = new MarkdownWriter();
    const markdown = writer.write(rendered);
    const expectMarkdown = `| Dessert (100g serving) | Calories | Fat (g) | Carbs (g) | Protein (g) |
      | ---------------------- | -------- | ------- | --------- | ----------- |
      | Frozen yoghurt         | 159      | 6       | 24        | 4           |
      | Ice cream sandwich     | 237      | 9       | 37        | 4.3         |
      | Eclair                 | 262      | 16      | 24        | 6           |
      | Cupcake                | 305      | 3.7     | 67        | 4.3         |
      | Gingerbread            | 356      | 16      | 49        | 3.9         |`.replace(/\n\s*/g, '\n');
    expect(markdown).toBe(expectMarkdown);

    const writerCollapse = new MarkdownWriter(undefined, { markdownTableCollapse: true } as any);
    const markdownCollapse = writerCollapse.write(rendered);
    expect(markdownCollapse).toMatch('| Frozen yoghurt | 159 | 6 | 24 | 4 |');
  });

  test('markdown selection', async () => {
    const table = (
      <Markup.Environment>
        <Table
          records={records}
          columns={columns}
          selectedColumns={['name', 'fat', 'carbs']}
          maxColumns={2}
          maxRecords={2}
          selectedRecords='1:4'
        />
      </Markup.Environment>
    );
    const rendered = await read(table);
    const writer = new MarkdownWriter();
    const markdown = writer.write(rendered);
    const expectedMarkdown = `| Dessert (100g serving) | ... | Carbs (g) |
      | ---------------------- | --- | --------- |
      | Ice cream sandwich     | ... | 37        |
      | ...                    | ... | ...       |
      | Cupcake                | ... | 67        |`.replace(/\n\s*/g, '\n');
    expect(markdown).toBe(expectedMarkdown);

    const indexedTable = (
      <Markup.Environment>
        <Table
          records={records}
          columns={columns}
          selectedColumns={['index', 'name']}
          maxColumns={2}
          maxRecords={4}
          selectedRecords='1:'
        />
      </Markup.Environment>
    );
    const indexedRendered = await read(indexedTable);
    const indexedMarkdown = writer.write(indexedRendered);
    const indexedExpected = `| Index | Dessert (100g serving) |
      | ----- | ---------------------- |
      | 1     | Ice cream sandwich     |
      | 2     | Eclair                 |
      | 3     | Cupcake                |`.replace(/\n\s*/g, '\n');
    expect(indexedMarkdown).toMatch(indexedExpected);

    const plusIndexedTable = (
      <Markup.Environment markupLang='csv'>
        <Table records={records} columns={columns} selectedColumns='+index' />
      </Markup.Environment>
    );
    const plusIndexedRendered = await read(plusIndexedTable);
    const plusIndexedCsv = writer.write(plusIndexedRendered);
    expect(plusIndexedCsv).toMatch('0,Frozen yoghurt,159,6,24,4\n1,Ice cream sandwich,237,9,37,4.3');
  });

  test('xml', async () => {
    const table = (
      <Serialize.Environment serializer='xml'>
        <Table records={records} columns={columns} />
      </Serialize.Environment>
    );
    const rendered = write(await read(table));
    expect(rendered).toMatch('<calories>305</calories>');
  });

  test('html', async () => {
    const table = (
      <Markup.Environment markupLang='html'>
        <Table records={records} columns={columns} />
      </Markup.Environment>
    );
    const rendered = await read(table);
    expect(rendered).toMatch(/<env presentation="markup" markup-lang="html"><table><thead><trow>/g);
    const writer = new HtmlWriter();
    const html = writer.write(rendered);
    expect(html).toMatch(/<table>\n {2}<thead>\n/g);
    expect(html).toMatch(/<th>Dessert/g);
  });

  test('serialize', async () => {
    const table = (
      <Markup.Environment>
        <Table records={records} columns={columns} syntax='json' />
      </Markup.Environment>
    );
    const rendered = await read(table);
    const writer = new MarkdownWriter();
    const markdown = writer.write(rendered);
    expect(markdown).toMatch(/```json\n\{[\s\S]*```/g);
  });

  const complexPrompt = (
    <Text>
      <Task>Here is the table to answer this question.</Task>
      <OutputFormat>
        Please provide your explanation first, then answer the question in a short phrase starting by 'Therefore, the
        answer is:'. If the answer contains multiple items, use three hashtags
        {' ('}
        <Code>###</Code>
        {')'} to separate them.
      </OutputFormat>
      <ExampleSet>
        <Example>
          <ExampleInput>
            <Table columns={columns} records={records} />
            <Question>How many calories are in Yogurt?</Question>
          </ExampleInput>
          <ExampleOutput>
            <Inline>
              The table shows the nutritional information of different desserts. Yogurt contains 159 calories.
            </Inline>{' '}
            Therefore, the answer is: <Inline>159</Inline>
          </ExampleOutput>
        </Example>
      </ExampleSet>
      <Text className='query' name='query'>
        <Table columns={columns} records={records.slice(2)} />
        <Question>How many calories are in Cupcake?</Question>
      </Text>
    </Text>
  );

  test('complex', async () => {
    const ir = await read(complexPrompt);
    const messages = write(ir, { speaker: true });
    expect(messages.length).toBe(4);
    expect(messages[3].content).toBe(
      '| Dessert (100g serving) | Calories | Fat (g) | Carbs (g) | Protein (g) |\n' +
        '| ---------------------- | -------- | ------- | --------- | ----------- |\n' +
        '| Eclair                 | 262      | 16      | 24        | 6           |\n' +
        '| Cupcake                | 305      | 3.7     | 67        | 4.3         |\n' +
        '| Gingerbread            | 356      | 16      | 49        | 3.9         |\n' +
        '\n' +
        '**Question:** How many calories are in Cupcake?\n' +
        '\n' +
        '**Answer:**',
    );
  });

  test('complexInJson', async () => {
    const ir = await read(complexPrompt, undefined, undefined, {
      text: { syntax: 'json' },
      table: { syntax: 'json' },
      qa: { captionStyle: 'bold' },
    });
    const output = JSON.parse(write(ir, { speaker: false }) as string);
    expect(Object.keys(output).length).toBe(4);
    expect(Object.keys(output)).toStrictEqual(['task', 'outputFormat', 'examples', 'query']);
  });

  test('file', async () => {
    const result = write(await read(`<table records="{{[{ name: 'Alice', age: 20 }, { name: 'Bob', age: 30 }]}}" />`));
    expect(result).toMatch(
      `| name  | age |
      | ----- | --- |
      | Alice | 20  |
      | Bob   | 30  |`.replace(/\n\s*/g, '\n'),
    );
  });
});
