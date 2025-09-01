import { createArtifactDir, test } from './extension.spec';
import { expect } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, basename, extname } from 'path';

import config from '../../playwright.config';

const FIXTURE_ENDPOINT = config.use!.baseURL;
const testFixturesPath = config.metadata!.testFixturesPath;

test.describe('toPngBase64 image conversion tests', () => {
  const testImages = [
    { file: 'gpt-5-random-image.png', mimeType: 'image/png' },
    { file: 'sample_1280×853.jpeg', mimeType: 'image/jpeg' },
    { file: 'google-webp-gallery.webp', mimeType: 'image/webp' },
    { file: 'video-to-gif-sample.gif', mimeType: 'image/gif' },
    { file: 'sample1.bmp', mimeType: 'image/bmp' },
    { file: 'wikipedia-example.svg', mimeType: 'image/svg+xml' },
  ];

  testImages.forEach(({ file, mimeType }) => {
    test(`converts ${file} to PNG base64`, async ({ serviceWorker, sidebarPage }) => {
      const artifactDir = createArtifactDir();
      const imagePath = join(testFixturesPath, 'image', file);
      const imageBuffer = readFileSync(imagePath);
      const base64Input = imageBuffer.toString('base64');

      // Run conversion in service worker
      const result = await serviceWorker.evaluate(
        async ({ base64, mime }) => {
          const { toPngBase64 } = self as any;

          if (!toPngBase64) {
            throw new Error('toPngBase64 function not found in service worker');
          }

          const startTime = performance.now();
          const image = await toPngBase64({ base64: base64 }, { mimeType: mime });
          const pngBase64 = image.base64;
          const { width, height, mimeType } = image;
          const endTime = performance.now();

          return {
            success: true,
            pngBase64,
            width,
            height,
            mimeType,
            duration: Math.round(endTime - startTime),
            inputLength: base64.length,
            outputLength: pngBase64.length,
            areEqual: base64 === pngBase64,
          };
        },
        { base64: base64Input, mime: mimeType },
      );

      // Verify result
      expect(result.success).toBe(true);
      expect(result.pngBase64).toBeTruthy();
      expect(typeof result.pngBase64).toBe('string');
      expect(result.pngBase64.length).toBeGreaterThan(0);
      expect(result.width).toBeGreaterThan(0);
      expect(result.height).toBeGreaterThan(0);
      expect(result.mimeType).toBe('image/png');

      if (mimeType === 'image/png') {
        // PNG input should return the same base64 without modification
        expect(result.areEqual).toBe(true);
      }

      // Save converted image for review
      const outputName = `${basename(file, extname(file))}_converted.png`;
      const outputPath = join(artifactDir, outputName);
      const resultBuffer = Buffer.from(result.pngBase64, 'base64');
      writeFileSync(outputPath, resultBuffer);
    });
  });

  test('handles data URL input', async ({ serviceWorker, sidebarPage }) => {
    const imagePath = join(testFixturesPath, 'image', 'sample_1280×853.jpeg');
    const imageBuffer = readFileSync(imagePath);
    const base64Input = imageBuffer.toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64Input}`;

    const result = await serviceWorker.evaluate(
      async ({ url, mime }) => {
        const { toPngBase64 } = self as any;
        const imageResult = await toPngBase64(url, { mimeType: mime });
        return {
          success: true,
          pngBase64: imageResult.base64,
          outputLength: imageResult.base64.length,
        };
      },
      { url: dataUrl, mime: 'image/jpeg' },
    );

    expect(result.success).toBe(true);
    expect(result.pngBase64).toBeTruthy();
    expect(result.outputLength).toBeGreaterThan(0);
  });

  test('handles errors gracefully', async ({ serviceWorker, sidebarPage }) => {
    // Test with invalid input type
    const errorResult = await serviceWorker.evaluate(async () => {
      const { toPngBase64 } = self as any;
      try {
        await toPngBase64(123, { mimeType: 'image/png' }); // Invalid input
        return { error: null };
      } catch (error) {
        return { error: (error as Error).message };
      }
    });

    expect(errorResult.error).toContain('Invalid input format');

    // Test with invalid base64
    const invalidBase64Result = await serviceWorker.evaluate(async () => {
      const { toPngBase64 } = self as any;
      try {
        await toPngBase64('not-valid-base64!@#$', { mimeType: 'image/jpeg' });
        return { error: null };
      } catch (error) {
        return { error: (error as Error).message };
      }
    });

    expect(invalidBase64Result.error).toContain('Failed to load image with MIME type');
  });
});

test.describe('srcToPngBase64 image conversion tests', () => {
  const testImages = [
    { file: 'gpt-5-random-image.png', mimeType: 'image/png' },
    { file: 'sample_1280×853.jpeg', mimeType: 'image/jpeg' },
    { file: 'google-webp-gallery.webp', mimeType: 'image/webp' },
    { file: 'video-to-gif-sample.gif', mimeType: 'image/gif' },
    { file: 'sample1.bmp', mimeType: 'image/bmp' },
    { file: 'wikipedia-example.svg', mimeType: 'image/svg+xml' },
  ];

  test('converts image URL to PNG base64', async ({ serviceWorker, sidebarPage }) => {
    for (const { file } of testImages) {
      const url = `${FIXTURE_ENDPOINT}/image/${file}`;
      const result = await serviceWorker.evaluate(async (src) => {
        const { toPngBase64 } = self as any;
        const imageResult = await toPngBase64(src);
        const pngBase64 = imageResult.base64;
        const header = Array.from(atob(pngBase64).slice(0, 8)).map((c) => c.charCodeAt(0));
        return { pngBase64Length: pngBase64.length, header };
      }, url);

      expect(result.pngBase64Length).toBeGreaterThan(0);
      // PNG signature: 89 50 4E 47 0D 0A 1A 0A
      expect(result.header).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    }
  });

  test('handles data URL input (PNG passthrough equality)', async ({ serviceWorker, sidebarPage }) => {
    const imagePath = join(testFixturesPath, 'image', 'gpt-5-random-image.png');
    const imageBuffer = readFileSync(imagePath);
    const base64Input = imageBuffer.toString('base64');
    const dataUrl = `data:image/png;base64,${base64Input}`;

    const result = await serviceWorker.evaluate(async (url) => {
      const { toPngBase64 } = self as any;
      const imageResult = await toPngBase64(url);
      const pngBase64 = imageResult.base64;
      return { pngBase64 };
    }, dataUrl);

    // PNG input should return the same base64 without modification
    expect(result.pngBase64).toBe(base64Input);
  });

  test('throws for non-image URLs', async ({ serviceWorker, sidebarPage }) => {
    const url = `${FIXTURE_ENDPOINT}/plain/hello.txt`;
    const result = await serviceWorker.evaluate(async (src) => {
      const { toPngBase64 } = self as any;
      try {
        await toPngBase64(src);
        return { error: null };
      } catch (e) {
        return { error: (e as Error).message };
      }
    }, url);

    expect(result.error).toBeTruthy();
    expect(result.error).toMatch(/Failed to load image/i);
  });
});
