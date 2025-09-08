import { test } from './extension.spec';
import { expect } from '@playwright/test';
import { CardModel } from '@common/types';

import config from '../../playwright.config';
import path from 'path';
import { readFileSync } from 'fs';

const testFixturesPath = config.metadata!.testFixturesPath;

test.describe('POML Helper Tests', () => {
  test('should test utils/react.ts renderElementToString', async ({ sidebarPage }) => {
    const result = await sidebarPage.evaluate(async () => {
      // Access the renderElementToString function from utils/react
      const { renderElementToString, React } = window as any;

      // Create a simple React element
      const element = React.createElement(
        'div',
        { className: 'test-element', id: 'test-id' },
        'Hello from renderElementToString test!',
      );

      try {
        const rendered = await renderElementToString(element);
        return { success: true, result: rendered };
      } catch (error: any) {
        return { success: false, error: error.message, stack: error.stack };
      }
    });

    expect(result.success).toBe(true);
    expect(result.result).toBe('<div class="test-element" id="test-id">Hello from renderElementToString test!</div>');
  });

  test('should render minimal card with renderCardsByPoml', async ({ sidebarPage }) => {
    const result = await sidebarPage.evaluate(async () => {
      const { renderCardsByPoml } = window as any;

      // Create a simple text card
      const cards: CardModel[] = [
        {
          content: {
            type: 'text',
            text: 'Hello, minimal test!',
          },
        },
      ];

      try {
        const rendered = await renderCardsByPoml(cards);
        return { success: true, result: rendered };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
          stack: error.stack,
          name: error.name,
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.result).toBe('Hello, minimal test!');
  });

  test('should render complex cards with image, table, text, caption, and nested content', async ({ sidebarPage }) => {
    const imageData = readFileSync(path.join(testFixturesPath, 'image/gpt-5-random-image.png')).toString('base64');

    const result = await sidebarPage.evaluate(async (imageData) => {
      const { renderCardsByPoml } = window as any;

      // Create complex cards with various types
      const cards: CardModel[] = [
        // Text card with caption
        {
          content: {
            type: 'text',
            text: 'This is a text card with a caption',
            caption: 'Text Caption',
          },
        },
        // Image card with caption
        {
          content: {
            type: 'image',
            base64: imageData,
            alt: 'gpt-5-random-image.png',
            caption: 'Image Caption',
          },
        },
        // Table card with caption
        {
          content: {
            type: 'table',
            records: [
              { name: 'Alice', age: 30, city: 'New York', role: 'Engineer' },
              { name: 'Bob', age: 25, city: 'Los Angeles', role: 'Designer' },
              { name: 'Charlie', age: 35, city: 'Chicago', role: 'Manager' },
              { name: 'Diana', age: 28, city: 'Boston', role: 'Analyst' },
            ],
            columns: [
              { field: 'name', header: 'Full Name' },
              { field: 'age', header: 'Age' },
              { field: 'city', header: 'City' },
              { field: 'role', header: 'Job Role' },
            ],
            caption: 'Employee Data Table',
          },
        },
        // Nested cards with different containers and captions
        {
          content: {
            type: 'nested',
            cards: [
              {
                type: 'text',
                text: 'This is a task instruction nested inside',
                container: 'Task',
              },
              {
                type: 'text',
                text: 'This is a question nested inside',
                container: 'Question',
              },
              {
                type: 'text',
                text: 'This is a hint nested inside',
                container: 'Hint',
              },
            ],
            caption: 'Nested Content Collection',
          },
        },
        // Text with container
        {
          content: {
            type: 'text',
            text: 'This text uses a Role container',
            container: 'Role',
            caption: 'Role-based Text',
          },
        },
      ];

      const startTime = performance.now();
      try {
        const rendered = await renderCardsByPoml(cards);
        const endTime = performance.now();

        return {
          success: true,
          result: rendered,
          renderTime: Math.round(endTime - startTime),
          cardCount: cards.length,
        };
      } catch (error: any) {
        const endTime = performance.now();
        return {
          success: false,
          error: error.message,
          stack: error.stack,
          name: error.name,
          renderTime: Math.round(endTime - startTime),
          cardCount: cards.length,
        };
      }
    }, imageData);

    expect(result.success).toBe(true);
    expect(Array.isArray(result.result)).toBe(true);
    expect(result.result.length).toBeGreaterThan(0);

    // Verify the result contains content from all card types
    const output = result.result;

    expect(output[0]).toBe(`# Text Caption

This is a text card with a caption

# Image Caption`);

    expect(output[1].type).toBe('image/png');
    expect(output[1].base64).toBeTruthy();
    expect(output[1].alt).toBe('gpt-5-random-image.png');

    expect(output[2]).toBe(`# Employee Data Table

| Full Name | Age | City        | Job Role |
| --------- | --- | ----------- | -------- |
| Alice     | 30  | New York    | Engineer |
| Bob       | 25  | Los Angeles | Designer |
| Charlie   | 35  | Chicago     | Manager  |
| Diana     | 28  | Boston      | Analyst  |

# Nested Content Collection

## Task

This is a task instruction nested inside

**Question:**
This is a question nested inside

**Answer:**

**Hint:**
This is a hint nested inside

# Role-based Text

## Role

This text uses a Role container`);

    // Performance check - should complete in reasonable time
    expect(result.renderTime).toBeLessThan(10000); // Less than 10 seconds
  });

  test('should handle edge cases and error conditions', async ({ sidebarPage }) => {
    const result = await sidebarPage.evaluate(async () => {
      const { renderCardsByPoml } = window as any;

      const testCases = [
        // Empty cards array
        { name: 'empty array', cards: [] },

        // Card with empty text
        {
          name: 'empty text',
          cards: [{ content: { type: 'text', text: '' } }],
        },

        // Card with special characters
        {
          name: 'special characters',
          cards: [{ content: { type: 'text', text: 'Special chars: <>&"\'{}[]()' } }],
        },

        // Card with newlines and formatting
        {
          name: 'multiline text',
          cards: [{ content: { type: 'text', text: 'Line 1\n\nLine 2\n\tTabbed line\n\nFinal line' } }],
        },
      ];

      const results = [];

      for (const testCase of testCases) {
        try {
          const rendered = await renderCardsByPoml(testCase.cards);
          results.push({
            name: testCase.name,
            success: true,
            result: rendered,
            length: rendered ? rendered.length : 0,
          });
        } catch (error: any) {
          results.push({
            name: testCase.name,
            success: false,
            error: error.message,
          });
        }
      }

      return results;
    });

    // Verify all test cases
    expect(result).toHaveLength(4);

    expect(result[0].result).toEqual([]);
    expect(result[1].result).toEqual([]);
    expect(result[2].result).toBe('Special chars: <>&"\'{}[]()');
    expect(result[3].result).toBe('Line 1\n\nLine 2\n\tTabbed line\n\nFinal line');
  });
});
