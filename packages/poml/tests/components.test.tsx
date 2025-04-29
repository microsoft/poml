import * as React from 'react';

import { describe, expect, test } from '@jest/globals';

import { poml, read, write } from 'poml';
import { readDocx, readDocxFromPath, readPdfFromPath, Document } from 'poml/components/document';
import { Tree, TreeItemData } from 'poml/components/tree';
import { readFileSync } from 'fs';
import { ErrorCollection } from 'poml/base';

describe('document', () => {
  test('pdf', async () => {
    const document = await readPdfFromPath(__dirname + '/assets/pdfLatexImage.pdf');
    expect((document.props as any).children).toMatch(/1 Your Chapter\nLorem ipsum dolor sit amet/g);

    const document2 = await readPdfFromPath(__dirname + '/assets/pdfLatexImage.pdf', {
      selectedPages: '1:'
    });
    expect((document2.props as any).children).toMatch('');

    const document3 = await readPdfFromPath(__dirname + '/assets/pdfLatexImage.pdf', {
      selectedPages: ':1'
    });
    expect((document3.props as any).children).toMatch('1 Your Chapter\nLorem ipsum dolor sit amet');
  });

  test('docx', async () => {
    const document = await readDocxFromPath(__dirname + '/assets/sampleWord.docx');
    expect((document.props as any).children.length).toEqual(26);
  });

  test('txt', async () => {
    const document = await poml(<Document buffer={"123\n456"} />);
    expect(document).toBe('123\n456');

    const documentJson = await poml(<Document src={__dirname + '/assets/peopleList.json'} parser='txt' />);
    expect(documentJson).toBe(readFileSync(__dirname + '/assets/peopleList.json', 'utf-8'));
  });

  test('write result', async () => {
    const result = await poml(<Document src={__dirname + '/assets/sampleWord.docx'} />);
    expect(result.length).toEqual(5);
    expect((result[3] as any).base64).toBeTruthy();
    expect(result[4]).toMatch(/without any merged cells:\n\n\| Screen Reader \| Responses \| Share \|\n/g);
  });
});

describe('message', () => {
  test('msg', async () => {
    const text =
      "<poml><system-msg>start</system-msg><ai-msg>hello</ai-msg><human-msg speaker='human'>yes</human-msg></poml>";
    const element = await read(text);
    expect(write(element, { speaker: true })).toStrictEqual([
      { speaker: 'system', content: 'start' },
      { speaker: 'ai', content: 'hello' },
      { speaker: 'human', content: 'yes' }
    ]);
  });

  test('conversation', async () => {
    const text = `<poml>
      <conversation messages="{{[{ speaker: 'human', content: 'What is the capital of France?' }, { speaker: 'ai', content: 'Paris' }]}}" />
    </poml>`;
    const element = await read(text);
    expect(write(element, { speaker: true })).toStrictEqual([
      { speaker: 'human', content: 'What is the capital of France?' },
      { speaker: 'ai', content: 'Paris' }
    ]);
  });

  test('conversation selected', async () => {
    const text = `<poml>
      <conversation messages="{{[{ speaker: 'system', content: 'Be brief and clear in your responses' }, { speaker: 'human', content: 'What is the capital of France?' }, { speaker: 'ai', content: 'Paris' }]}}" selectedMessages="-1:" />
    </poml>`;
    const element = await read(text);
    expect(write(element, { speaker: true })).toStrictEqual([{ speaker: 'ai', content: 'Paris' }]);
  });

  test('conversation with image', async () => {
    const imagePath = __dirname + '/assets/tomCat.jpg';
    const text = `<poml>
      <let name="imagedata" src="${imagePath}" type="buffer" />
      <conversation messages='{{[{"speaker":"human","content":[{"type":"image/jpg","base64":imagedata.toString("base64")}]}]}}' />
    </poml>`;
    ErrorCollection.clear();
    const element = await read(text);
    expect(ErrorCollection.empty()).toBe(true);
    const result = write(element, { speaker: true });
    expect(result.length).toBe(1);
    expect((result[0].content as any)[0].type).toBe('image/jpg');
    expect((result[0].content as any)[0].base64).toBeTruthy();
  });
});

describe('tree',  () => {
  const treeData: TreeItemData[] = [
    {
      name: 'Data Grid',
      children: [{ name: 'data-grid' }, { name: 'data-grid-pro', value: 'Content Grid Pro' }, { name: 'data-grid-premium' }],
    },
    {
      name: 'Date and Time Pickers',
      children: [{ name: 'date-pickers', value: 'Content Date Pickers' }, { name: 'date-pickers-pro' }],
    },
    {
      name: 'Tree.view',
      value: 'Content Tree View'
    },
  ];

  const backticks = '```';

  const treeMarkdownWithContent = `# Data Grid

## Data Grid/data-grid

## Data Grid/data-grid-pro

${backticks}
Content Grid Pro
${backticks}

## Data Grid/data-grid-premium

# Date and Time Pickers

## Date and Time Pickers/date-pickers

${backticks}
Content Date Pickers
${backticks}

## Date and Time Pickers/date-pickers-pro

# Tree.view

${backticks}
Content Tree View
${backticks}`;

  const treeMarkdownWithoutContent = `- Data Grid
  - data-grid
  - data-grid-pro
  - data-grid-premium
- Date and Time Pickers
  - date-pickers
  - date-pickers-pro
- Tree.view`;

  const treeTextWithContent = `Data Grid/data-grid
Data Grid/data-grid-pro
    Content Grid Pro
Data Grid/data-grid-premium
Date and Time Pickers/date-pickers
    Content Date Pickers
Date and Time Pickers/date-pickers-pro
Tree.view
    Content Tree View`;

  // with box drawings
  const treeTextWithoutContent = `Data Grid
├─ data-grid
├─ data-grid-pro
│  └─ Content Grid Pro
└─ data-grid-premium
Date and Time Pickers
├── date-pickers
│   └── Content Date Pickers
└── date-pickers-pro
Tree.view
└── Content Tree View`;

  const treeYamlWithoutContent = `Data Grid:
  data-grid:
  data-grid-pro: Content Grid Pro
  data-grid-premium:
Date and Time Pickers:
  date-pickers: Content Date Pickers
  date-pickers-pro:
Tree.view:
  Content Tree View`;

  const testJsonWithContent = `{
  "Data Grid": {
    "data-grid": {},
    "data-grid-pro": "Content Grid Pro",
    "data-grid-premium": {}
  },
  "Date and Time Pickers": {
    "date-pickers": "Content Date Pickers",
    "date-pickers-pro": {}
  },
  "Tree.view": "Content Tree View"
}`;

  test('tree markdown with content', async () => {
    const markup = <Tree items={treeData} syntax="markdown" showContent={true} />;
    const result = await poml(markup);
    expect(result).toBe(treeMarkdownWithContent);
  });

  test('tree markdown without content', async () => {
    const markup = <Tree items={treeData} syntax="markdown" />;
    const result = await poml(markup);
    expect(result).toBe(treeMarkdownWithoutContent);
  });

  test('tree text with content', async () => {
    const markup = <Tree items={treeData} syntax="text" showContent={true} />;
    const result = await poml(markup);
    expect(result).toBe(treeTextWithContent);
  });

  test('tree text without content', async () => {
    const markup = <Tree items={treeData} syntax="text" />;
    const result = await poml(markup);
    expect(result).toBe(treeTextWithoutContent);
  });

  test('tree yaml without content', async () => {
    const markup = <Tree items={treeData} syntax="yaml" />;
    const result = await poml(markup);
    expect(result).toBe(treeYamlWithoutContent);
  });

  test('tree json with content', async () => {
    const markup = <Tree items={treeData} syntax="json" showContent={true} />;
    const result = await poml(markup);
    expect(result).toBe(testJsonWithContent);
  });
});