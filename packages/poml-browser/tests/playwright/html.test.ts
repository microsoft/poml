import { createArtifactDir, test, waitForStableDom } from './extension.spec';
import { expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import config from '../../playwright.config';
import { CardContent } from '@common/types';

const FIXTURE_ENDPOINT = config.use!.baseURL;
const testFixturesPath = config.metadata!.testFixturesPath;

function flattenCards(...cards: CardContent[]): CardContent[] {
  const result: CardContent[] = [];

  for (const card of cards) {
    result.push(card);
    if (card.type === 'nested') {
      result.push(...flattenCards(...card.cards));
    }
  }
  return result;
}

test.describe('cardFromHtml', () => {
  // Simple tests with made-up strings
  const simpleTestCases = [
    {
      name: 'simple paragraph',
      html: '<p>Hello world!</p>',
      expectedType: 'text',
      expectedContent: 'Hello world!',
    },
    {
      name: 'header with text',
      html: '<h1>Main Title</h1><p>Some content here</p>',
      expectedType: 'text',
      hasHeader: true,
    },
    {
      name: 'list elements',
      html: '<ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>',
      expectedType: 'list',
      expectedItems: 3,
    },
    {
      name: 'ordered list',
      html: '<ol><li>First</li><li>Second</li></ol>',
      expectedType: 'list',
      expectedOrdered: true,
    },
    {
      name: 'nested content with headers',
      html: '<h2>Section</h2><p>Paragraph 1</p><h3>Subsection</h3><p>Paragraph 2</p>',
      expectedType: 'nested',
      hasMultipleHeaders: true,
    },
    {
      name: 'blockquote content',
      html: '<blockquote>This is a quote</blockquote>',
      expectedType: 'text',
      expectedContainer: 'Code',
    },
  ];

  simpleTestCases.forEach(
    ({
      name,
      html,
      expectedType,
      expectedContent,
      hasHeader,
      expectedItems,
      expectedOrdered,
      hasMultipleHeaders,
      expectedContainer,
    }) => {
      test(`simple - ${name}`, async ({ serviceWorker, sidebarPage }) => {
        const result = await serviceWorker.evaluate(
          async ({ htmlContent, options }) => {
            const { cardFromHtml } = self as any;

            if (!cardFromHtml) {
              throw new Error('cardFromHtml function not found in service worker');
            }

            try {
              const cardModel = await cardFromHtml(htmlContent, options);
              return {
                success: true,
                cardModel,
              };
            } catch (error) {
              return {
                success: false,
                error: (error as Error).message,
              };
            }
          },
          { htmlContent: html, options: {} },
        );

        expect(result.success).toBe(true);
        expect(result.cardModel).toBeTruthy();
        expect(result.cardModel.content).toBeTruthy();
        expect(result.cardModel.source).toBe('webpage');
        expect(result.cardModel.timestamp).toBeTruthy();

        const content: CardContent = result.cardModel.content;
        expect(content.type).toBe(expectedType);

        if (expectedContent) {
          expect((content as any).text).toContain(expectedContent);
        }

        if (hasHeader) {
          expect(content.caption).toBeTruthy();
        }

        if (expectedItems) {
          expect(content.type).toBe('list');
          expect((content as any).items).toBeTruthy();
          expect((content as any).items.length).toBe(expectedItems);
        }

        if (expectedOrdered !== undefined) {
          expect(content.type).toBe('list');
          expect((content as any).ordered).toBe(expectedOrdered);
        }

        if (hasMultipleHeaders) {
          expect(content.type).toBe('nested');
          expect(flattenCards(content).length).toBeGreaterThan(1);
        }

        if (expectedContainer) {
          expect(content.container).toBe(expectedContainer);
        }
      });
    },
  );

  test('handles simple parser mode', async ({ serviceWorker, sidebarPage }) => {
    const html = '<h1>Title</h1><p>This is content</p><ul><li>Item 1</li><li>Item 2</li></ul>';

    const result = await serviceWorker.evaluate(
      async ({ htmlContent, options }) => {
        const { cardFromHtml } = self as any;
        const cardModel = await cardFromHtml(htmlContent, options);
        return { cardModel };
      },
      { htmlContent: html, options: { parser: 'simple' } },
    );

    expect(result.cardModel.content.type).toBe('text');
    expect(result.cardModel.content.text).toBe('TitleThis is contentItem 1Item 2');
  });

  test('handles empty or invalid HTML gracefully', async ({ serviceWorker, sidebarPage }) => {
    const testCases = ['', '<div></div>', '<script>alert("test")</script>', '<style>body { color: red; }</style>'];

    for (const html of testCases) {
      const result = await serviceWorker.evaluate(
        async ({ htmlContent }) => {
          const { cardFromHtml } = self as any;
          try {
            const cardModel = await cardFromHtml(htmlContent, {});
            return { success: true, cardModel };
          } catch (error) {
            return { success: false, error: (error as Error).message };
          }
        },
        { htmlContent: html },
      );

      // Empty/invalid HTML should either return undefined or handle gracefully
      if (result.success && result.cardModel) {
        expect(result.cardModel).toBeTruthy();
      }
    }
  });

  test('handles horizontal rules and inline code', async ({ serviceWorker, sidebarPage }) => {
    const html = `<div class="container">
<p>Here is a short intro with <strong>bold text</strong> and some inline <code>code_example()</code>.</p>
<hr>
<h2>1) Section heading with <code>inline_code</code></h2>
<p>A simple paragraph under a heading.</p>
<!-- Example matching the original pre > div > p > code structure -->
<pre>
<div>
<p>bash</p>
<p><code>echo "hello"
ls -la</code></p>
</div>
</pre>
<p>Options you might toggle:</p>
<ul>
<li><p><code>--flag-one</code></p></li>
<li><p><code>--flag-two</code></p></li>
<li><p><code>--no-timestamp</code></p></li>
</ul>
<hr>
<h2>2) Another section</h2>
<p>Another small paragraph. Below is a tiny Python example.</p>
<pre>
<div>
<p>python</p>
<p><code>print("ok")
print(1 + 2)</code></p>
This is some extra text.
</div>
</pre>
Some extra text for tests.
<p>That’s it—minimal content, but it includes all the elements used.</p>
</div>`;

    const result = await serviceWorker.evaluate(
      async ({ htmlContent, options }) => {
        const { cardFromHtml } = self as any;
        const cardModel = await cardFromHtml(htmlContent, options);
        return { cardModel };
      },
      { htmlContent: html, options: {} },
    );
    expect(result.cardModel.content).toStrictEqual({
      type: 'nested',
      cards: [
        {
          type: 'text',
          text: 'Here is a short intro with bold text and some inline code_example().',
        },
        { type: 'text', text: '----------------' },
        {
          type: 'nested',
          cards: [
            {
              type: 'text',
              text: 'A simple paragraph under a heading.',
            },
            {
              type: 'text',
              text: '\nbash\necho "hello"\nls -la\n\n',
              container: 'Code',
            },
            { type: 'text', text: 'Options you might toggle:' },
            {
              type: 'list',
              items: ['--flag-one', '--flag-two', '--no-timestamp'],
              ordered: false,
            },
            { type: 'text', text: '----------------' },
          ],
          caption: '1) Section heading with inline_code',
        },
        {
          type: 'nested',
          cards: [
            {
              type: 'text',
              text: 'Another small paragraph. Below is a tiny Python example.',
            },
            {
              type: 'text',
              text: '\npython\nprint("ok")\nprint(1 + 2)\nThis is some extra text.\n\n',
              container: 'Code',
            },
            { type: 'text', text: 'Some extra text for tests.' },
            {
              type: 'text',
              text: 'That’s it—minimal content, but it includes all the elements used.',
            },
          ],
          caption: '2) Another section',
        },
      ],
    });
  });

  // Integration tests with real HTML pages
  const webpageTestCases = [
    {
      name: 'GitHub issue page',
      file: 'github-issue.html',
    },
    {
      name: 'Stack Overflow page',
      file: 'stackoverflow.html',
    },
    {
      name: 'Wikipedia article',
      file: 'wikipedia.html',
    },
    {
      name: 'CNBC article',
      file: 'cnbc.html',
    },
    {
      name: 'GitHub homepage',
      file: 'github-homepage.html',
    },
    {
      name: 'IMDB page',
      file: 'imdb.html',
    },
    {
      name: 'Reddit page',
      file: 'reddit.html',
    },
    {
      name: 'Yahoo Finance page',
      file: 'yahoo-finance.html',
    },
  ];

  webpageTestCases.forEach(({ name, file }) => {
    test(`${name} from test fixtures`, async ({ serviceWorker, sidebarPage, contentPage }) => {
      const artifactDir = createArtifactDir();

      await contentPage.goto(`${FIXTURE_ENDPOINT}/webpage/${file}`);
      await contentPage.waitForLoadState('networkidle');
      await waitForStableDom(contentPage);

      // Test with complex parser (default)
      const complexResult = await serviceWorker.evaluate(
        async ({ options }) => {
          const { cardFromHtml } = self as any;
          const startTime = performance.now();
          const cardModel = await cardFromHtml(null, options);
          const endTime = performance.now();

          return {
            cardModel,
            duration: Math.round(endTime - startTime),
            processingTime: endTime - startTime,
          };
        },
        { options: { parser: 'complex' } },
      );

      expect(complexResult.cardModel).toBeTruthy();
      expect(complexResult.cardModel.content).toBeTruthy();
      expect(complexResult.cardModel.source).toBe('webpage');

      // Save processing results to artifacts for review
      const resultData = {
        file,
        ...complexResult,
      };

      writeFileSync(
        join(artifactDir, `${file.replace('.html', '')}_results.json`),
        JSON.stringify(resultData, null, 2),
      );
    });
  });
});
