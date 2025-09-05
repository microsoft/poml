import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import config from '../../playwright.config';
import { createArtifactDir } from './extension.spec';

const FIXTURE_ENDPOINT = config.use!.baseURL;
const testFixturesPath = config.metadata!.testFixturesPath;

test.describe('generate cards with pdfs', () => {
  // Discover PDF files from test-fixtures directory
  const pdfDir = path.join(testFixturesPath, 'pdf');
  const pdfFiles = fs.readdirSync(pdfDir).filter((file) => file.endsWith('.pdf'));

  for (const pdfFile of pdfFiles) {
    test(`extract content from ${pdfFile}`, async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'This approach is Chromium-only');
      const artifactDir = createArtifactDir();
      const pdfUrl = `${FIXTURE_ENDPOINT}/pdf/${pdfFile}`;
      await page.goto(pdfUrl);

      // Inject the content script that contains the extraction functions
      await page.addScriptTag({ path: path.resolve(__dirname, '../../dist/contentScript.js') });

      // Call the extractContent function that's exposed by the content script
      const extractionData = await page.evaluate(async () => {
        // The content script exposes window.extractContent
        const content = await (window as any).extractContent();
        // Get visualizations that were stored during PDF extraction
        const visualizations = (window as any).pdfVisualizations;
        return { content, visualizations };
      });

      const { content, visualizations } = extractionData;

      // Verify extraction was successful
      expect(content).toBeDefined();
      expect(Array.isArray(content)).toBe(true);
      expect(content.length).toBeGreaterThan(0);

      // Save individual JSON file for this test
      const sanitizedFileName = pdfFile.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filenameWithoutExt = path.basename(pdfFile, '.pdf');
      const outputPath = path.join(artifactDir, `pdf-${sanitizedFileName}.json`);
      const testResult = {
        source: pdfUrl,
        file: pdfFile,
        timestamp: new Date().toISOString(),
        cards: content,
        visualizations: visualizations ? visualizations.length : 0,
      };

      fs.writeFileSync(outputPath, JSON.stringify(testResult, null, 2));

      // Save visualization images if available
      if (visualizations && Array.isArray(visualizations)) {
        for (const viz of visualizations) {
          if (viz.base64 && viz.pageNumber) {
            const vizFileName = `pdf-${filenameWithoutExt}-page${viz.pageNumber}.png`;
            const vizPath = path.join(artifactDir, vizFileName);
            const buffer = Buffer.from(viz.base64, 'base64');
            fs.writeFileSync(vizPath, buffer);
            console.log(`Saved visualization for page ${viz.pageNumber} to ${vizPath}`);
          }
        }
      }
    });
  }
});

test.describe('generate cards with html pages', () => {
  // Discover HTML files from test-fixtures directory
  const webpageDir = path.join(testFixturesPath, 'webpage');
  const htmlFiles = fs.readdirSync(webpageDir).filter((file) => file.endsWith('.html'));

  for (const htmlFile of htmlFiles) {
    test(`extract content from ${htmlFile}`, async ({ page }) => {
      const artifactDir = createArtifactDir();
      const htmlUrl = `${FIXTURE_ENDPOINT}/webpage/${htmlFile}`;
      await page.goto(htmlUrl, { waitUntil: 'networkidle' });

      // Inject the content script that contains the extraction functions
      await page.addScriptTag({ path: path.resolve(__dirname, '../../dist/contentScript.js') });

      // Call the extractContent function that's exposed by the content script
      const content = await page.evaluate(async () => {
        // The content script exposes window.extractContent
        return await (window as any).extractContent();
      });

      // Verify extraction was successful
      expect(content).toBeDefined();
      expect(Array.isArray(content)).toBe(true);
      expect(content.length).toBeGreaterThan(0);

      // Save individual JSON file for this test
      const sanitizedFileName = htmlFile.replace(/[^a-zA-Z0-9.-]/g, '_');
      const outputPath = path.join(artifactDir, `html-${sanitizedFileName}.json`);
      const testResult = {
        source: htmlUrl,
        file: htmlFile,
        timestamp: new Date().toISOString(),
        cards: content,
      };

      fs.writeFileSync(outputPath, JSON.stringify(testResult, null, 2));
      console.log(`Saved HTML cards to ${outputPath}`);
    });
  }
});
