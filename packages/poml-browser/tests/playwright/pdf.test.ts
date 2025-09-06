import { expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import config from '../../playwright.config';
import { createArtifactDir, test } from './extension.spec';

const FIXTURE_ENDPOINT = config.use!.baseURL;
const testFixturesPath = config.metadata!.testFixturesPath;

test.describe('generate cards with pdfs', () => {
  // Discover PDF files from test-fixtures directory
  const pdfDir = path.join(testFixturesPath, 'pdf');
  const pdfFiles = fs.readdirSync(pdfDir).filter((file) => file.endsWith('.pdf'));

  for (const pdfFile of pdfFiles) {
    test(`extract content from ${pdfFile}`, async ({ serviceWorker, sidebarPage }) => {
      const artifactDir = createArtifactDir();
      const pdfUrl = `${FIXTURE_ENDPOINT}/pdf/${pdfFile}`;

      const result = await serviceWorker.evaluate(async (pdfUrl) => {
        const { _cardFromPdf } = self as any;
        return await _cardFromPdf(pdfUrl, { visualizePages: true });
      }, pdfUrl);
      const { card, visualized } = result;

      expect(card).toBeDefined();
      expect(typeof card).toBe('object');
      expect(visualized).toBeDefined();
      expect(Array.isArray(visualized)).toBe(true);

      // Save individual JSON file for this test
      const sanitizedFileName = pdfFile.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filenameWithoutExt = path.basename(pdfFile, '.pdf');
      const outputPath = path.join(artifactDir, `pdf-${sanitizedFileName}.json`);

      fs.writeFileSync(outputPath, JSON.stringify(card, null, 2));

      for (let i = 1; i <= visualized.length; i++) {
        const vizFileName = `pdf-${filenameWithoutExt}-page${i}.png`;
        const vizPath = path.join(artifactDir, vizFileName);
        const buffer = Buffer.from(visualized[i - 1].base64, 'base64');
        fs.writeFileSync(vizPath, buffer);
        console.log(`Saved visualization for page ${i} to ${vizPath}`);
      }
    });
  }
});
