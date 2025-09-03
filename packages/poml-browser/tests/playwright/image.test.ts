import { createArtifactDir, test } from './extension.spec';
import { expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'fs';
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

  test('handles non-base64 data URL input (SVG)', async ({ serviceWorker, sidebarPage }) => {
    const artifactDir = createArtifactDir();
    // Test with the exact SVG data URL from the user's example
    const svgDataUrl =
      'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect fill-opacity="0"/></svg>';

    const result = await serviceWorker.evaluate(async (url) => {
      const { toPngBase64 } = self as any;
      const imageResult = await toPngBase64(url);
      return {
        success: true,
        pngBase64: imageResult.base64,
        width: imageResult.width,
        height: imageResult.height,
        mimeType: imageResult.mimeType,
        outputLength: imageResult.base64.length,
      };
    }, svgDataUrl);

    expect(result.success).toBe(true);
    expect(result.pngBase64).toBeTruthy();
    expect(result.width).toBe(64);
    expect(result.height).toBe(64);
    expect(result.mimeType).toBe('image/png');
    expect(result.outputLength).toBeGreaterThan(0);

    // Save converted image for review
    const outputPath = join(artifactDir, 'svg_from_plain_data_url.png');
    const resultBuffer = Buffer.from(result.pngBase64, 'base64');
    writeFileSync(outputPath, resultBuffer);
  });

  test('handles non-base64 data URL with URL-encoded content', async ({ serviceWorker, sidebarPage }) => {
    const artifactDir = createArtifactDir();
    // Test with URL-encoded SVG
    const encodedSvgDataUrl =
      'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22100%22%20height%3D%22100%22%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%2240%22%20fill%3D%22red%22%2F%3E%3C%2Fsvg%3E';

    const result = await serviceWorker.evaluate(async (url) => {
      const { toPngBase64 } = self as any;
      const imageResult = await toPngBase64(url);
      return {
        success: true,
        pngBase64: imageResult.base64,
        width: imageResult.width,
        height: imageResult.height,
        mimeType: imageResult.mimeType,
        outputLength: imageResult.base64.length,
      };
    }, encodedSvgDataUrl);

    expect(result.success).toBe(true);
    expect(result.pngBase64).toBeTruthy();
    expect(result.width).toBe(100);
    expect(result.height).toBe(100);
    expect(result.mimeType).toBe('image/png');
    expect(result.outputLength).toBeGreaterThan(0);

    // Save converted image for review
    const outputPath = join(artifactDir, 'svg_from_encoded_data_url.png');
    const resultBuffer = Buffer.from(result.pngBase64, 'base64');
    writeFileSync(outputPath, resultBuffer);
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

test.describe('cardFromImage card creation tests', () => {
  const testImages = [
    { file: 'gpt-5-random-image.png', mimeType: 'image/png' },
    { file: 'sample_1280×853.jpeg', mimeType: 'image/jpeg' },
    { file: 'google-webp-gallery.webp', mimeType: 'image/webp' },
    { file: 'wikipedia-example.svg', mimeType: 'image/svg+xml' },
  ];

  test('creates card from URL and verifies PNG conversion', async ({ serviceWorker, sidebarPage }) => {
    const artifactDir = createArtifactDir();

    for (const { file, mimeType } of testImages) {
      const url = `${FIXTURE_ENDPOINT}/image/${file}`;

      const result = await serviceWorker.evaluate(
        async ({ imageUrl, expectedMimeType, fileName }) => {
          const { cardFromImage } = self as any;
          if (!cardFromImage) {
            throw new Error('cardFromImage function not found');
          }

          const card = await cardFromImage(imageUrl);

          // Verify PNG conversion by checking base64 header
          const header = Array.from(atob(card.content.base64).slice(0, 8)).map((c) => c.charCodeAt(0));

          return {
            success: true,
            card: {
              contentType: card.content.type,
              alt: card.content.alt,
              url: card.url,
              source: card.source,
              mimeType: card.mimeType,
              hasTimestamp: !!card.timestamp,
              isPNG: header.join(',') === '137,80,78,71,13,10,26,10', // PNG signature
            },
          };
        },
        { imageUrl: url, expectedMimeType: mimeType, fileName: file },
      );

      expect(result.success).toBe(true);
      expect(result.card.contentType).toBe('image');
      expect(result.card.alt).toBe(file);
      expect(result.card.url).toBe(url);
      expect(result.card.source).toBe('webpage');
      expect(result.card.mimeType).toBe('image/png');
      expect(result.card.hasTimestamp).toBe(true);
      expect(result.card.isPNG).toBe(true); // All images should be converted to PNG
    }

    // Save sample card for review
    const sampleUrl = `${FIXTURE_ENDPOINT}/image/${testImages[0].file}`;
    const sampleResult = await serviceWorker.evaluate(async (url) => {
      const { cardFromImage } = self as any;
      const card = await cardFromImage(url);
      return {
        ...card,
        timestamp: card.timestamp?.toISOString(),
        content: { ...card.content, base64: card.content.base64.substring(0, 50) + '...' },
      };
    }, sampleUrl);
    writeFileSync(join(artifactDir, 'sample_image_card.json'), JSON.stringify(sampleResult, null, 2));
  });

  test('creates card from File/Blob with custom source', async ({ serviceWorker, sidebarPage }) => {
    const imagePath = join(testFixturesPath, 'image', 'sample_1280×853.jpeg');
    const imageBuffer = readFileSync(imagePath);

    // Test File object
    const fileResult = await serviceWorker.evaluate(async (buffer) => {
      const { cardFromImage } = self as any;
      const uint8Array = new Uint8Array(buffer);
      const file = new File([uint8Array], 'test-image.jpeg', { type: 'image/jpeg' });

      const card = await cardFromImage(file, { source: 'clipboard' });
      return {
        contentType: card.content.type,
        alt: card.content.alt,
        url: card.url,
        mimeType: card.mimeType,
        source: card.source,
      };
    }, Array.from(imageBuffer));

    expect(fileResult.contentType).toBe('image');
    expect(fileResult.alt).toBe('test-image.jpeg');
    expect(fileResult.url).toBe('test-image.jpeg');
    expect(fileResult.mimeType).toBe('image/png');
    expect(fileResult.source).toBe('clipboard');

    // Test Blob object
    const blobResult = await serviceWorker.evaluate(async (buffer) => {
      const { cardFromImage } = self as any;
      const uint8Array = new Uint8Array(buffer);
      const blob = new Blob([uint8Array], { type: 'image/jpeg' });

      const card = await cardFromImage(blob, { source: 'drag-drop' });
      return {
        contentType: card.content.type,
        alt: card.content.alt,
        url: card.url,
        mimeType: card.mimeType,
        source: card.source,
      };
    }, Array.from(imageBuffer));

    expect(blobResult.contentType).toBe('image');
    expect(blobResult.alt).toBe('blob');
    expect(blobResult.url).toBe(undefined);
    expect(blobResult.mimeType).toBe('image/png');
    expect(blobResult.source).toBe('drag-drop');
  });

  test('handles data URLs including non-base64 SVG', async ({ serviceWorker, sidebarPage }) => {
    // Test base64 data URL
    const imagePath = join(testFixturesPath, 'image', 'gpt-5-random-image.png');
    const imageBuffer = readFileSync(imagePath);
    const base64DataUrl = `data:image/png;base64,${imageBuffer.toString('base64')}`;

    const base64Result = await serviceWorker.evaluate(async (url) => {
      const { cardFromImage } = self as any;
      const card = await cardFromImage(url);
      return {
        contentType: card.content.type,
        hasBase64: !!card.content.base64,
        mimeType: card.mimeType,
      };
    }, base64DataUrl);

    expect(base64Result.contentType).toBe('image');
    expect(base64Result.hasBase64).toBe(true);
    expect(base64Result.mimeType).toBe('image/png');

    // Test non-base64 SVG data URL
    const svgDataUrl =
      'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40" fill="blue"/></svg>';

    const svgResult = await serviceWorker.evaluate(async (url) => {
      const { cardFromImage } = self as any;
      const card = await cardFromImage(url);
      const header = Array.from(atob(card.content.base64).slice(0, 8)).map((c) => c.charCodeAt(0));
      return {
        contentType: card.content.type,
        isPNG: header.join(',') === '137,80,78,71,13,10,26,10',
        mimeType: card.mimeType,
      };
    }, svgDataUrl);

    expect(svgResult.contentType).toBe('image');
    expect(svgResult.isPNG).toBe(true);
    expect(svgResult.mimeType).toBe('image/png');
  });

  test('handles errors for invalid inputs', async ({ serviceWorker, sidebarPage }) => {
    // Test with invalid URL scheme
    const invalidUrlResult = await serviceWorker.evaluate(async () => {
      const { cardFromImage } = self as any;
      try {
        await cardFromImage('invalid://not-a-real-url');
        return { error: null };
      } catch (error) {
        return { error: (error as Error).message };
      }
    });

    expect(invalidUrlResult.error).toBeTruthy();
    expect(invalidUrlResult.error).toContain('Could not determine MIME type');

    // Test with non-image URL
    const textUrl = `${FIXTURE_ENDPOINT}/plain/hello.txt`;
    const nonImageResult = await serviceWorker.evaluate(async (url) => {
      const { cardFromImage } = self as any;
      try {
        await cardFromImage(url);
        return { error: null };
      } catch (error) {
        return { error: (error as Error).message };
      }
    }, textUrl);

    expect(nonImageResult.error).toBeTruthy();
  });
});
