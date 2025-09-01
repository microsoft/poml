import { createArtifactDir, test } from './extension.spec';
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

test.describe('htmlToCards HTML processing tests', () => {
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
            const { htmlToCards } = self as any;

            if (!htmlToCards) {
              throw new Error('htmlToCards function not found in service worker');
            }

            try {
              const cardModel = await htmlToCards(htmlContent, options);
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
        expect(result.cardModel.source).toBe('clipboard');
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
        const { htmlToCards } = self as any;
        const cardModel = await htmlToCards(htmlContent, options);
        return { cardModel };
      },
      { htmlContent: html, options: { parser: 'simple' } },
    );

    await sidebarPage.waitForTimeout(50000);

    expect(result.cardModel.content.type).toBe('text');
    expect(result.cardModel.content.text).toBeTruthy();
    expect(result.cardModel.content.caption).toBeTruthy();
  });

  test('handles empty or invalid HTML gracefully', async ({ serviceWorker, sidebarPage }) => {
    const testCases = ['', '<div></div>', '<script>alert("test")</script>', '<style>body { color: red; }</style>'];

    for (const html of testCases) {
      const result = await serviceWorker.evaluate(
        async ({ htmlContent }) => {
          const { htmlToCards } = self as any;
          try {
            const cardModel = await htmlToCards(htmlContent, {});
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
    test(`processes ${name} from test fixtures`, async ({ serviceWorker, sidebarPage }) => {
      const artifactDir = createArtifactDir();
      const htmlPath = join(testFixturesPath, 'webpage', file);
      const htmlContent = readFileSync(htmlPath, 'utf-8');

      // Test with complex parser (default)
      const complexResult = await serviceWorker.evaluate(
        async ({ htmlContent, options }) => {
          const { htmlToCards } = self as any;
          const startTime = performance.now();
          const cardModel = await htmlToCards(htmlContent, options);
          const endTime = performance.now();

          return {
            cardModel,
            duration: Math.round(endTime - startTime),
            processingTime: endTime - startTime,
          };
        },
        { htmlContent, options: { parser: 'complex' } },
      );

      expect(complexResult.cardModel).toBeTruthy();
      expect(complexResult.cardModel.content).toBeTruthy();
      expect(complexResult.cardModel.source).toBe('clipboard');

      // Test with simple parser
      const simpleResult = await serviceWorker.evaluate(
        async ({ htmlContent, options }) => {
          const { htmlToCards } = self as any;
          const cardModel = await htmlToCards(htmlContent, options);
          return { cardModel };
        },
        { htmlContent, options: { parser: 'simple' } },
      );

      expect(simpleResult.cardModel).toBeTruthy();
      expect(simpleResult.cardModel.content.type).toBe('text');

      // Save processing results to artifacts for review
      const resultData = {
        file,
        complex: {
          duration: complexResult.duration,
          contentType: complexResult.cardModel.content.type,
          hasTitle: !!complexResult.cardModel.content.caption,
          hasExcerpt: !!complexResult.cardModel.excerpt,
        },
        simple: {
          contentType: simpleResult.cardModel.content.type,
          textLength: simpleResult.cardModel.content.text?.length || 0,
          hasCaption: !!simpleResult.cardModel.content.caption,
        },
      };

      writeFileSync(
        join(artifactDir, `${file.replace('.html', '')}_processing_results.json`),
        JSON.stringify(resultData, null, 2),
      );

      // Verify the content has meaningful data
      if (complexResult.cardModel.content.type === 'nested') {
        expect(complexResult.cardModel.content.cards.length).toBeGreaterThan(0);
      } else if (complexResult.cardModel.content.type === 'text') {
        expect(complexResult.cardModel.content.text.length).toBeGreaterThan(0);
      }
    });
  });
});
