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
          const pngBase64 = await toPngBase64(base64, mime);
          const endTime = performance.now();

          return {
            success: true,
            pngBase64,
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
        const pngBase64 = await toPngBase64(url, mime);
        return {
          success: true,
          pngBase64,
          outputLength: pngBase64.length,
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
        await toPngBase64(123, 'image/png'); // Invalid input
        return { error: null };
      } catch (error) {
        return { error: (error as Error).message };
      }
    });

    expect(errorResult.error).toContain('Input must be ArrayBuffer or base64 string');

    // Test with invalid base64
    const invalidBase64Result = await serviceWorker.evaluate(async () => {
      const { toPngBase64 } = self as any;
      try {
        await toPngBase64('not-valid-base64!@#$', 'image/jpeg');
        return { error: null };
      } catch (error) {
        return { error: (error as Error).message };
      }
    });

    expect(invalidBase64Result.error).toBeTruthy();
  });
});
