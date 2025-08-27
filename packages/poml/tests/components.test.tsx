import * as React from 'react';

import { describe, expect, test, beforeAll } from '@jest/globals';

import { poml, read, write } from 'poml';
import { readDocx, readDocxFromPath, readPdfFromPath, readTxtFromPath, Document } from 'poml/components/document';
import { Tree, TreeItemData, Folder } from 'poml/components/tree';
import { Webpage } from 'poml/components/webpage';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { ErrorCollection, BufferCollection } from 'poml/base';
import * as path from 'path';

describe('document', () => {
  test('pdf', async () => {
    const document = await readPdfFromPath(__dirname + '/assets/pdfLatexImage.pdf');
    expect((document.props as any).children).toMatch(/1 Your Chapter\nLorem ipsum dolor sit amet/g);

    const document2 = await readPdfFromPath(__dirname + '/assets/pdfLatexImage.pdf', {
      selectedPages: '1:',
    });
    expect((document2.props as any).children).toMatch('');

    const document3 = await readPdfFromPath(__dirname + '/assets/pdfLatexImage.pdf', {
      selectedPages: ':1',
    });
    expect((document3.props as any).children).toMatch('1 Your Chapter\nLorem ipsum dolor sit amet');
  });

  test('docx', async () => {
    const document = await readDocxFromPath(__dirname + '/assets/sampleWord.docx');
    expect((document.props as any).children.length).toEqual(26);
  });

  test('txt', async () => {
    const document = await poml(<Document buffer={'123\n456'} />);
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

  test('docx from base64', async () => {
    const buffer = readFileSync(__dirname + '/assets/sampleWord.docx');
    const base64 = buffer.toString('base64');
    const result = await poml(<Document base64={base64} parser='docx' />);
    expect(result[4]).toMatch(/without any merged cells:\n\n\| Screen Reader \| Responses \| Share \|\n/g);
  });

  test('buffer caching', async () => {
    const filePath = path.join(__dirname, 'assets', 'peopleList.json');
    BufferCollection.clear();
    await readTxtFromPath(filePath);
    const key = `content://${path.resolve(filePath)}`;
    const first = BufferCollection.get<{ value: Buffer; mtime: number }>(key);
    expect(first?.value).toBeInstanceOf(Buffer);

    await readTxtFromPath(filePath);
    const second = BufferCollection.get<{ value: Buffer; mtime: number }>(key);
    expect(second?.mtime).toBe(first?.mtime);
    expect(second?.value).toBe(first?.value);
  });

  test('skip cache when over limit', () => {
    BufferCollection.clear();
    const inst = (BufferCollection as any).instance as any;
    const originalLimit = inst.limit;
    inst.limit = 10;
    BufferCollection.set('big', { data: 'a'.repeat(50) });
    expect(BufferCollection.get('big')).toBeUndefined();
    inst.limit = originalLimit;
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
      { speaker: 'human', content: 'yes' },
    ]);
  });

  test('conversation', async () => {
    const text = `<poml>
      <conversation messages="{{[{ speaker: 'human', content: 'What is the capital of France?' }, { speaker: 'ai', content: 'Paris' }]}}" />
    </poml>`;
    const element = await read(text);
    expect(write(element, { speaker: true })).toStrictEqual([
      { speaker: 'human', content: 'What is the capital of France?' },
      { speaker: 'ai', content: 'Paris' },
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

describe('tree', () => {
  const treeData: TreeItemData[] = [
    {
      name: 'Data Grid',
      children: [
        { name: 'data-grid' },
        { name: 'data-grid-pro', value: 'Content Grid Pro' },
        { name: 'data-grid-premium' },
      ],
    },
    {
      name: 'Date and Time Pickers',
      children: [{ name: 'date-pickers', value: 'Content Date Pickers' }, { name: 'date-pickers-pro' }],
    },
    {
      name: 'Tree.view',
      value: 'Content Tree View',
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

${backticks}view
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

  const treeTextWithContent = `Data Grid
Data Grid/data-grid
Data Grid/data-grid-pro
==> start Data Grid/data-grid-pro <==
Content Grid Pro
==> end Data Grid/data-grid-pro <==

Data Grid/data-grid-premium
Date and Time Pickers
Date and Time Pickers/date-pickers
==> start Date and Time Pickers/date-pickers <==
Content Date Pickers
==> end Date and Time Pickers/date-pickers <==

Date and Time Pickers/date-pickers-pro
Tree.view
==> start Tree.view <==
Content Tree View
==> end Tree.view <==
`;

  // with box drawings
  const treeTextWithoutContent = `Data Grid
├── data-grid
├── data-grid-pro
└── data-grid-premium
Date and Time Pickers
├── date-pickers
└── date-pickers-pro
Tree.view`;

  const treeYamlWithoutContent = `Data Grid:
  data-grid: null
  data-grid-pro: null
  data-grid-premium: null
Date and Time Pickers:
  date-pickers: null
  date-pickers-pro: null
Tree.view: null`;

  const testJsonWithContent = `{
  "Data Grid": {
    "data-grid": null,
    "data-grid-pro": "Content Grid Pro",
    "data-grid-premium": null
  },
  "Date and Time Pickers": {
    "date-pickers": "Content Date Pickers",
    "date-pickers-pro": null
  },
  "Tree.view": "Content Tree View"
}`;

  test('tree markdown with content', async () => {
    const markup = <Tree items={treeData} syntax='markdown' showContent={true} />;
    const result = await poml(markup);
    expect(result).toBe(treeMarkdownWithContent);
  });

  test('tree markdown without content', async () => {
    const markup = <Tree items={treeData} syntax='markdown' />;
    const result = await poml(markup);
    expect(result).toBe(treeMarkdownWithoutContent);
  });

  test('tree text with content', async () => {
    const markup = <Tree items={treeData} syntax='text' showContent={true} />;
    const result = await poml(markup);
    expect(result).toBe(treeTextWithContent);
  });

  test('tree text without content', async () => {
    const markup = <Tree items={treeData} syntax='text' />;
    const result = await poml(markup);
    expect(result).toBe(treeTextWithoutContent);
  });

  test('tree yaml without content', async () => {
    const markup = <Tree items={treeData} syntax='yaml' />;
    const result = await poml(markup);
    expect(result).toBe(treeYamlWithoutContent);
  });

  test('tree json with content', async () => {
    const markup = <Tree items={treeData} syntax='json' showContent={true} />;
    const result = await poml(markup);
    expect(result).toBe(testJsonWithContent);
  });
});

describe('folder', () => {
  const directory = __dirname + '/assets/directory';
  const content123jsx = readFileSync(directory + '/anotherdirectory/123.jsx', 'utf-8');
  const content456cpp = readFileSync(directory + '/anotherdirectory/456.cpp', 'utf-8');
  const contentNestedFileTxt = readFileSync(directory + '/nested1/nested2/nested3/nested5/nestedFile.txt', 'utf-8');
  const contentIgnoreplease = readFileSync(directory + '/nested1/nested2/nested4/.ignoreplease', 'utf-8');
  const contentIgnoremeplease = readFileSync(directory + '/.ignoremeplease', 'utf-8');

  // Create directory structure if it doesn't exist
  beforeAll(() => {
    const directories = [
      directory,
      path.join(directory, 'anotherdirectory'),
      path.join(directory, 'nested1'),
      path.join(directory, 'nested1', 'nested2'),
      path.join(directory, 'nested1', 'nested2', 'nested3'),
      path.join(directory, 'nested1', 'nested2', 'nested3', 'nested5'),
      path.join(directory, 'nested1', 'nested2', 'nested4'),
      path.join(directory, 'nested1', 'nested6'),
    ];

    // Create each directory if it doesn't exist
    directories.forEach((dir) => {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    });
  });

  test('basic folder structure', async () => {
    const markup = <Folder src={directory} syntax='text' maxDepth={10} />;
    const result = await poml(markup);

    expect(result).toBe(`directory
├── anotherdirectory
│   ├── 123.jsx
│   └── 456.cpp
├── nested1
│   ├── nested2
│   │   ├── nested3
│   │   │   └── nested5
│   │   │       └── nestedFile.txt
│   │   └── nested4
│   │       └── .ignoreplease
│   └── nested6
└── .ignoremeplease`);
  });

  test('test file contents', async () => {
    const markup = <Folder src={directory} syntax='json' maxDepth={10} showContent={true} />;
    const result = await poml(markup);
    expect(JSON.parse(result as string)).toStrictEqual({
      directory: {
        'anotherdirectory': {
          '123.jsx': content123jsx,
          '456.cpp': content456cpp,
        },
        'nested1': {
          nested2: {
            nested3: {
              nested5: {
                'nestedFile.txt': contentNestedFileTxt,
              },
            },
            nested4: {
              '.ignoreplease': contentIgnoreplease,
            },
          },
          nested6: null,
        },
        '.ignoremeplease': contentIgnoremeplease,
      },
    });
  });

  test('folder with maxDepth=1', async () => {
    const markup = <Folder src={directory} maxDepth={1} syntax='markdown' showContent={true} />;
    const result = await poml(markup);

    const backticks = '```';
    expect((result as string).replace(/\r\n/g, '\n')).toBe(
      `# directory

## directory/anotherdirectory

## directory/nested1

## directory/.ignoremeplease

${backticks}
abcde
fhijk
${backticks}`.replace(/\r\n/g, '\n'),
    );
  });

  test('folder with maxDepth=2', async () => {
    const markup = <Folder src={directory} maxDepth={2} syntax='xml' showContent={false} />;
    const result = await poml(markup);

    expect(result).toBe(`<directory>
  <anotherdirectory>
    <_123.jsx/>
    <_456.cpp/>
  </anotherdirectory>
  <nested1>
    <nested2/>
    <nested6/>
  </nested1>
  <_.ignoremeplease/>
</directory>`);
  });

  test('folder with filter=jsx', async () => {
    const markup = <Folder src={directory} filter={/.*\.jsx$/} syntax='text' maxDepth={4} />;
    const result = await poml(markup);

    // Using full text match with JSX filter
    expect(result).toBe(`directory
└── anotherdirectory
    └── 123.jsx`);
  });

  test('folder with filter not starting with dot', async () => {
    const markup = <Folder src={directory} filter={/^[^.].*$/} syntax='text' maxDepth={10} />;
    const result = await poml(markup);

    // Using a filter that excludes files starting with dot
    expect(result).toBe(`directory
├── anotherdirectory
│   ├── 123.jsx
│   └── 456.cpp
└── nested1
    └── nested2
        └── nested3
            └── nested5
                └── nestedFile.txt`);
  });

  test('folder with filter and maxDepth combined', async () => {
    const markup = <Folder src={directory} filter={/.*\.txt$/} maxDepth={3} syntax='text' />;
    const result = await poml(markup);

    expect(result).toBe(`directory`);
  });

  test('folder with different syntax (markdown)', async () => {
    const markup = <Folder src={directory} maxDepth={2} syntax='markdown' />;
    const result = await poml(markup);

    // Using full text match with markdown syntax
    expect(result).toBe(`- directory
  - anotherdirectory
    - 123.jsx
    - 456.cpp
  - nested1
    - nested2
    - nested6
  - .ignoremeplease`);
  });
});

describe('webpage', () => {
  const webpagePath = __dirname + '/assets/sampleWebpage.html';

  test('extracting text from HTML', async () => {
    const markup = <Webpage src={webpagePath} />;
    const result = await poml(markup);
    expect(result).toEqual([
      `# Enter the main heading, usually the same as the title.

Be **bold** in stating your key points. Put them in a list: 

- The first item in your list
- The second item; *italicize* key words

Improve your image by including an image. `,
      expect.objectContaining({
        alt: 'A Great HTML Resource',
        type: 'image/png',
        base64: expect.stringMatching(/^.{27}/),
      }),
      `Add a link to your favorite Web site.
Break up your page with a horizontal rule or two. 

Finally, link to another page in your own Web site.

© Wiley Publishing, 2011`,
    ]);
  });

  test('using selector to extract specific content', async () => {
    const markup = <Webpage src={webpagePath} selector='ul' />;
    const result = await poml(markup);
    expect(result).toBe(`- The first item in your list
- The second item; *italicize* key words`);
  });

  test('selector with no matches', async () => {
    const markup = <Webpage src={webpagePath} selector='.non-existent-class' />;
    const result = await poml(markup);

    expect(result).toContain('No elements found matching selector: .non-existent-class');
  });

  test('extract text from HTML', async () => {
    const markup = <Webpage src={webpagePath} extractText={true} />;
    const result = await poml(markup);

    expect(result).toBe(`Enter the main heading, usually the same as the title.
Be bold in stating your key points. Put them in a list: 

The first item in your list
The second item; italicize key words

Improve your image by including an image. 

Add a link to your favorite Web site.
Break up your page with a horizontal rule or two. 

Finally, link to another page in your own Web site.

© Wiley Publishing, 2011`);
  });

  test('loading HTML from buffer', async () => {
    const htmlContent = readFileSync(webpagePath, 'utf-8');
    const markup = <Webpage buffer={htmlContent} selector='h1' syntax='html' />;
    const result = await poml(markup);

    expect(result).toContain('<h1>Enter the main heading, usually the same as the title.</h1>');
  });

  test('loading HTML from base64', async () => {
    const htmlContent = readFileSync(webpagePath, 'utf-8');
    const base64Content = Buffer.from(htmlContent).toString('base64');
    const markup = <Webpage base64={base64Content} selector='h1' syntax='html' />;
    const result = await poml(markup);

    expect(result).toContain('<h1>Enter the main heading, usually the same as the title.</h1>');
  });
});
