import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy, TextItem as PDFTextItem } from 'pdfjs-dist/types/src/display/api';
import { base64ToBinary } from './utils/base64';
import { notifyDebug, notifyError, notifyInfo } from './notification';
import { CardModel, CardModelSlim, TextContent, BinaryContent, createCardFromSlim } from './cardModel';

/**
 * Check if the current URL is a PDF document
 */
export function isPdfDocument(url?: string): boolean {
  const targetUrl = url || document.location.href;
  return targetUrl.toLowerCase().includes('.pdf') || document.contentType === 'application/pdf';
}

/**
 * Main extraction function for PDF documents
 */
export async function extractPdfDocumentContent(): Promise<CardModel[]> {
  try {
    return await extractPdfContent();
  } catch (error) {
    notifyError('Failed to extract PDF document content', error);
    throw error;
  }
}

// Types

interface LineItem {
  text: string;
  y: number;
  x: number;
  fontSize: number;
  width: number;
}

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PageNumberDetectionResult {
  shouldFilter: boolean;
  pattern: 'top' | 'bottom' | 'both' | null;
  yThresholdTop?: number;
  yThresholdBottom?: number;
}

interface TextBlock {
  type: 'text';
  text: string;
  isHeading: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface GraphicBlock {
  type: 'image';
  base64: string;
  mimeType: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PageVisualization {
  pageNumber: number;
  base64: string;
  mimeType: string;
}

type ContentBlock = TextBlock | GraphicBlock;

/**
 * Extracts structured content from a PDF document with proper image/text interleaving
 */
export async function extractPdfContentVisualized(
  pdfUrl?: string,
  visualization?: boolean,
): Promise<{ cards: CardModel[]; visualizations: PageVisualization[] }> {
  try {
    const targetUrl = pdfUrl || document.location.href;
    notifyDebug('Starting PDF structured extraction', { url: targetUrl });

    // Set worker source
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('external/pdf.worker.min.mjs');
    } else {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.54/pdf.worker.min.mjs';
    }

    // Load PDF
    let loadingTask;
    if (targetUrl.startsWith('file://')) {
      const response = (await chrome.runtime.sendMessage({
        action: 'readFile',
        filePath: targetUrl,
        binary: true,
      })) as { success: boolean; base64Data?: string; error?: string };

      if (!response.success || !response.base64Data) {
        throw new Error(`Failed to read PDF file: ${response.error || 'Unknown error'}`);
      }

      const uint8Array = base64ToBinary(response.base64Data);
      loadingTask = pdfjsLib.getDocument({ data: uint8Array });
    } else {
      loadingTask = pdfjsLib.getDocument(targetUrl);
    }

    const pdf = (await loadingTask.promise) as PDFDocumentProxy;
    const pageCount = pdf.numPages;
    notifyInfo(`PDF loaded successfully`, { pages: pageCount });

    // Process all pages and collect content blocks
    const allCards: CardModelSlim[] = [];

    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.0 });

      // Extract all content blocks with positions
      const contentBlocks = await extractPageContent(page, viewport);

      // Sort blocks by position (top to bottom, left to right)
      contentBlocks.sort((a, b) => {
        // First sort by Y position (with some tolerance for same line)
        const yDiff = b.y - a.y; // Note: PDF Y coordinates are bottom-up
        if (Math.abs(yDiff) > 5) {
          return yDiff;
        }
        // Then by X position for items on same line
        return a.x - b.x;
      });

      // Convert blocks to cards
      for (const block of contentBlocks) {
        if (block.type === 'text') {
          if (block.text.trim()) {
            allCards.push({
              content: { type: 'text', value: block.text } as TextContent,
              componentType: block.isHeading ? 'Header' : 'Paragraph',
            });
          }
        } else if (block.type === 'image') {
          allCards.push({
            content: {
              type: 'binary',
              value: block.base64,
              mimeType: block.mimeType,
              encoding: 'base64',
            } as BinaryContent,
            componentType: 'Image',
          });
        }
      }

      notifyDebug(`Processed page ${pageNum}/${pageCount}`, {
        contentBlocks: contentBlocks.length,
      });
    }

    notifyInfo('PDF extraction completed', { cardsCount: allCards.length, pages: pageCount });

    // Convert slim cards to full CardModel objects
    const timestamp = new Date();
    const finalCards =
      allCards.length > 0
        ? allCards
        : [
            {
              content: { type: 'text', value: 'No content found in PDF' } as TextContent,
              componentType: 'Paragraph',
            } as CardModelSlim,
          ];

    // Generate visualizations if requested
    const visualizations: PageVisualization[] = [];
    if (visualization) {
      for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const pageViz = await generatePageVisualization(page, pageNum);
        if (pageViz) {
          visualizations.push(pageViz);
        }
      }
    }

    return {
      cards: finalCards.map((slim) =>
        createCardFromSlim(slim, {
          timestamp,
          metadata: {
            source: 'file',
            url: targetUrl,
            tags: ['pdf'],
          },
        }),
      ),
      visualizations,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    notifyError('PDF extraction failed', error);

    const slimCard: CardModelSlim = {
      content: {
        type: 'text',
        value: `Failed to extract PDF: ${errorMsg}`,
      } as TextContent,
      componentType: 'Paragraph',
    };

    return {
      cards: [
        createCardFromSlim(slimCard, {
          metadata: {
            source: 'file',
            url: pdfUrl || document.location.href,
            tags: ['error', 'pdf'],
          },
        }),
      ],
      visualizations: [],
    };
  }
}

export async function extractPdfContent(pdfUrl?: string): Promise<CardModel[]> {
  const result = await extractPdfContentVisualized(pdfUrl, false);
  return result.cards;
}

/**
 * Extract page content with enhanced graphics region extraction
 */
async function extractPageContent(page: PDFPageProxy, viewport: any): Promise<ContentBlock[]> {
  const contentBlocks: ContentBlock[] = [];

  // First, detect graphics regions to use for text filtering
  const graphicBlocks = await detectGraphicsRegions(page);
  for (const graphicBlock of graphicBlocks) {
    contentBlocks.push(graphicBlock);
    notifyDebug('Detected graphics region', {
      x: graphicBlock.x,
      y: graphicBlock.y,
      width: graphicBlock.width,
      height: graphicBlock.height,
    });
  }

  // Extract text with filtering for embedded graphics text
  const textBlocks = await extractTextBlocks(page, viewport, graphicBlocks);
  for (const textBlock of textBlocks) {
    contentBlocks.push(textBlock);
  }

  return contentBlocks;
}

/**
 * Enhanced text extraction with better filtering
 */
async function extractTextBlocks(
  page: PDFPageProxy,
  viewport: any,
  graphicBlocks: GraphicBlock[],
): Promise<TextBlock[]> {
  const textContent = await page.getTextContent();
  const items = textContent.items as PDFTextItem[];

  if (items.length === 0) {
    notifyDebug('No text items found in page');
    return [];
  }

  // Detect page numbers
  const pageNumberInfo = detectPageNumbers(items, viewport);

  // Filter and extract lines
  const lines = extractFilteredLines(items, viewport, pageNumberInfo, graphicBlocks);

  // Group into text blocks with position info
  const blocks = groupLinesIntoBlocks(lines, viewport);

  return blocks;
}

/**
 * Detect page numbers in the document
 */
function detectPageNumbers(items: PDFTextItem[], viewport: any): PageNumberDetectionResult {
  const pageHeight = viewport.height;
  const topThreshold = pageHeight * 0.9; // Top 10% of page
  const bottomThreshold = pageHeight * 0.1; // Bottom 10% of page

  let topNumbers = 0;
  let bottomNumbers = 0;
  const pageNumberCandidates: Array<{ text: string; y: number }> = [];

  for (const item of items) {
    const y = item.transform[5];
    const text = item.str.trim();

    // Check if it looks like a page number
    if (isLikelyPageNumber(text)) {
      if (y > topThreshold) {
        topNumbers++;
        pageNumberCandidates.push({ text, y });
      } else if (y < bottomThreshold) {
        bottomNumbers++;
        pageNumberCandidates.push({ text, y });
      }
    }
  }

  // Determine pattern
  let pattern: 'top' | 'bottom' | 'both' | null = null;
  if (topNumbers > 0 && bottomNumbers > 0) {
    pattern = 'both';
  } else if (topNumbers > 0) {
    pattern = 'top';
  } else if (bottomNumbers > 0) {
    pattern = 'bottom';
  }

  const shouldFilter = pattern !== null;

  notifyDebug('Page number detection', {
    pattern,
    topNumbers,
    bottomNumbers,
    candidates: pageNumberCandidates.slice(0, 3),
  });

  return {
    shouldFilter,
    pattern,
    yThresholdTop: topThreshold,
    yThresholdBottom: bottomThreshold,
  };
}

/**
 * Check if text is likely a page number
 */
function isLikelyPageNumber(text: string): boolean {
  // Simple page number
  if (/^\d{1,4}$/.test(text)) {
    return true;
  }

  // Page number with prefix/suffix: "Page 1", "- 1 -", "1 of 10"
  if (/^(Page\s+)?\d{1,4}(\s+of\s+\d{1,4})?$/i.test(text)) {
    return true;
  }
  if (/^[-–—]\s*\d{1,4}\s*[-–—]$/.test(text)) {
    return true;
  }

  // Roman numerals
  if (/^[ivxlcdm]+$/i.test(text) && text.length <= 10) {
    return true;
  }

  return false;
}

/**
 * Extract lines with filtering
 */
function extractFilteredLines(
  items: PDFTextItem[],
  viewport: any,
  pageNumberInfo: PageNumberDetectionResult,
  graphicBlocks: GraphicBlock[],
): LineItem[] {
  const lines: LineItem[] = [];
  let currentLine: LineItem | null = null;

  for (const item of items) {
    const x = item.transform[4];
    const y = item.transform[5];
    const fontSize = Math.abs(item.transform[0]);

    // Skip if it's a page number
    if (shouldSkipAsPageNumber(item, y, pageNumberInfo)) {
      continue;
    }

    // Skip if it's inside a graphics region (likely embedded text)
    if (isInsideGraphicRegion(x, y, graphicBlocks)) {
      notifyDebug('Skipping text in graphics region', { text: item.str.substring(0, 20) });
      continue;
    }

    // Check if this is a new line
    if (!currentLine || Math.abs(y - currentLine.y) > 2) {
      if (currentLine && currentLine.text.trim()) {
        lines.push(currentLine);
      }
      currentLine = {
        text: item.str,
        y: y,
        x: x,
        fontSize: fontSize,
        width: item.width || 0,
      };
    } else {
      // Append to current line
      if (currentLine) {
        currentLine.text = appendToLine(currentLine.text, item.str);
        currentLine.width += item.width || 0;
      }
    }
  }

  // Add last line
  if (currentLine && currentLine.text.trim()) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Check if text should be skipped as page number
 */
function shouldSkipAsPageNumber(item: PDFTextItem, y: number, pageNumberInfo: PageNumberDetectionResult): boolean {
  if (!pageNumberInfo.shouldFilter) {
    return false;
  }

  const text = item.str.trim();
  if (!isLikelyPageNumber(text)) {
    return false;
  }

  if (pageNumberInfo.pattern === 'top' && pageNumberInfo.yThresholdTop && y > pageNumberInfo.yThresholdTop) {
    return true;
  }
  if (pageNumberInfo.pattern === 'bottom' && pageNumberInfo.yThresholdBottom && y < pageNumberInfo.yThresholdBottom) {
    return true;
  }
  if (pageNumberInfo.pattern === 'both') {
    if (
      (pageNumberInfo.yThresholdTop && y > pageNumberInfo.yThresholdTop) ||
      (pageNumberInfo.yThresholdBottom && y < pageNumberInfo.yThresholdBottom)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Check if position is inside a graphics region
 */
function isInsideGraphicRegion(x: number, y: number, graphicBlocks: GraphicBlock[]): boolean {
  for (const block of graphicBlocks) {
    if (x >= block.x && x <= block.x + block.width && y >= block.y && y <= block.y + block.height) {
      return true;
    }
  }
  return false;
}

/**
 * Group lines into text blocks with position information
 */
function groupLinesIntoBlocks(lines: LineItem[], viewport: any): TextBlock[] {
  const blocks: TextBlock[] = [];
  let currentParagraph: LineItem[] = [];
  let lastY: number | null = null;
  let lastFontSize: number | null = null;

  for (const line of lines) {
    const text = line.text.trim();
    if (!text) {
      continue;
    }

    const isHeading = detectHeading(text, line.fontSize, lastFontSize);
    const startsNewParagraph = shouldStartNewParagraph(text, isHeading, line.y, lastY, currentParagraph);

    if (startsNewParagraph && currentParagraph.length > 0) {
      // Create block from current paragraph
      const block = createTextBlock(currentParagraph, false);
      if (block) {
        blocks.push(block);
      }
      currentParagraph = [];
    }

    if (isHeading) {
      // Add heading as its own block
      blocks.push(createTextBlock([line], true)!);
    } else {
      currentParagraph.push(line);
    }

    lastY = line.y;
    lastFontSize = line.fontSize;
  }

  // Add remaining paragraph
  if (currentParagraph.length > 0) {
    const block = createTextBlock(currentParagraph, false);
    if (block) {
      blocks.push(block);
    }
  }

  return blocks;
}

/**
 * Create a text block from lines
 */
function createTextBlock(lines: LineItem[], isHeading: boolean): TextBlock | null {
  if (lines.length === 0) {
    return null;
  }

  const text = joinParagraphLines(lines.map((l) => l.text));
  if (!text.trim()) {
    return null;
  }

  // Calculate bounding box
  const minX = Math.min(...lines.map((l) => l.x));
  const maxX = Math.max(...lines.map((l) => l.x + l.width));
  const minY = Math.min(...lines.map((l) => l.y));
  const maxY = Math.max(...lines.map((l) => l.y));

  return {
    type: 'text',
    text,
    isHeading,
    x: minX,
    y: (minY + maxY) / 2, // Use center Y for sorting
    width: maxX - minX,
    height: maxY - minY,
  };
}

// Helper functions (keeping the good ones from original)

function appendToLine(currentText: string, newText: string): string {
  const needsSpace = currentText && !currentText.endsWith(' ') && !newText.startsWith(' ');
  return currentText + (needsSpace ? ' ' : '') + newText;
}

function detectHeading(text: string, fontSize: number, lastFontSize: number | null): boolean {
  const fontSizeIndicatesHeading = lastFontSize !== null && fontSize > lastFontSize * 1.2;
  const patternIndicatesHeading = isHeadingPattern(text);
  return fontSizeIndicatesHeading || patternIndicatesHeading;
}

function isHeadingPattern(text: string): boolean {
  if (text.length >= 100) {
    return false;
  }

  const headingPatterns = [
    /^\d+\.?\d*\.?\s/,
    /^[A-Z][A-Z\s]{3,}$/,
    /^(Chapter|Section|Part|Article|Appendix)\s+\d+/i,
    /^(Introduction|Conclusion|Abstract|Summary|References|Bibliography)$/i,
    /^[IVXLCDM]+\.\s/,
  ];

  return headingPatterns.some((pattern) => pattern.test(text));
}

function shouldStartNewParagraph(
  text: string,
  isHeading: boolean,
  currentY: number,
  lastY: number | null,
  currentParagraph: LineItem[],
): boolean {
  if (isHeading) {
    return true;
  }
  if (isParagraphBoundary(text)) {
    return true;
  }
  if (lastY !== null && Math.abs(currentY - lastY) > 15) {
    return true;
  }

  if (currentParagraph.length > 0) {
    const lastLine = currentParagraph[currentParagraph.length - 1];
    if (endsWithPunctuation(lastLine.text)) {
      return true;
    }
  }

  return false;
}

function isParagraphBoundary(text: string): boolean {
  const boundaryPatterns = [/^[\•\-\*\d]+[\.\)]\s/, /^[a-z]\)\s/, /^(Figure|Table|Example)\s/];

  return boundaryPatterns.some((pattern) => pattern.test(text));
}

function endsWithPunctuation(text: string): boolean {
  return /[.!?:]\s*$/.test(text);
}

function joinParagraphLines(lines: string[]): string {
  if (lines.length === 0) {
    return '';
  }
  if (lines.length === 1) {
    return lines[0];
  }

  let result = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (i === 0) {
      result = line;
    } else {
      const prevLine = lines[i - 1];
      result = joinTwoLines(result, prevLine, line);
    }
  }

  return result.replace(/\s+/g, ' ').trim();
}

function joinTwoLines(result: string, prevLine: string, currentLine: string): string {
  if (prevLine.endsWith('-')) {
    const lastWord = prevLine.slice(0, -1).split(' ').pop() || '';
    const firstWord = currentLine.split(' ')[0] || '';

    if (isHyphenatedWordSplit(lastWord, firstWord)) {
      return result.slice(0, -1) + currentLine;
    } else {
      return result + ' ' + currentLine;
    }
  } else {
    return result + ' ' + currentLine;
  }
}

function isHyphenatedWordSplit(lastWord: string, firstWord: string): boolean {
  return (
    lastWord.length > 0 &&
    firstWord.length > 0 &&
    lastWord[0].toLowerCase() === lastWord[0] &&
    firstWord[0].toLowerCase() === firstWord[0]
  );
}

async function detectGraphicsRegions(page: PDFPageProxy): Promise<GraphicBlock[]> {
  const scale = 1; // Base scale for rendering
  const downsampleFactor = 4; // Downsample for region detection
  const viewport = page.getViewport({ scale });

  // Create canvas for full resolution rendering
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  // Render the page
  await page.render({
    canvasContext: context,
    canvas: canvas,
    viewport: viewport,
  }).promise;

  // Get text items for text coverage analysis
  const textContent = await page.getTextContent();
  const textBounds = getTextBoundingBoxes(textContent as any, viewport);

  // Create downsampled canvas for region detection
  const downsampledCanvas = document.createElement('canvas');
  const downsampledCtx = downsampledCanvas.getContext('2d', { willReadFrequently: true })!;
  downsampledCanvas.width = Math.floor(canvas.width / downsampleFactor);
  downsampledCanvas.height = Math.floor(canvas.height / downsampleFactor);

  // Downsample the image
  downsampledCtx.drawImage(
    canvas,
    0,
    0,
    canvas.width,
    canvas.height,
    0,
    0,
    downsampledCanvas.width,
    downsampledCanvas.height,
  );

  // Find inked regions using flood fill
  const inkedRegions = findInkedRegions(downsampledCtx, downsampledCanvas.width, downsampledCanvas.height);

  // Scale regions back to original size and filter
  const graphicBlocks: GraphicBlock[] = [];

  for (const region of inkedRegions) {
    // Scale region back to original coordinates
    const scaledRegion: BoundingBox = {
      x: region.x * downsampleFactor,
      y: region.y * downsampleFactor,
      width: region.width * downsampleFactor,
      height: region.height * downsampleFactor,
    };

    // Calculate text coverage for this region
    const textCoverage = calculateTextCoverage(scaledRegion, textBounds);

    // Check if region is mostly text or too simple
    if (textCoverage > 0.8) {
      continue; // Skip regions that are mostly text
    }

    // Check if the region content outside text is too simple
    if (isRegionTooSimple(context, scaledRegion, textBounds)) {
      continue;
    }

    // Extract the region as base64
    const regionCanvas = document.createElement('canvas');
    const regionCtx = regionCanvas.getContext('2d')!;
    regionCanvas.width = scaledRegion.width;
    regionCanvas.height = scaledRegion.height;

    regionCtx.drawImage(
      canvas,
      scaledRegion.x,
      scaledRegion.y,
      scaledRegion.width,
      scaledRegion.height,
      0,
      0,
      scaledRegion.width,
      scaledRegion.height,
    );

    const dataUrl = regionCanvas.toDataURL('image/png');
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    graphicBlocks.push({
      type: 'image',
      x: scaledRegion.x / scale, // Convert to PDF coordinates
      y: scaledRegion.y / scale,
      width: scaledRegion.width / scale,
      height: scaledRegion.height / scale,
      base64,
      mimeType: 'image/png',
    });
  }

  return graphicBlocks;
}

function findInkedRegions(ctx: CanvasRenderingContext2D, width: number, height: number): BoundingBox[] {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const visited = new Uint8Array(width * height);
  const regions: BoundingBox[] = [];
  const luminanceThreshold = 240; // Pixels darker than this are considered "inked"

  // Helper function to get luminance
  function getLuminance(idx: number): number {
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }

  // Flood fill to find connected regions
  function floodFill(startX: number, startY: number): BoundingBox | null {
    const stack: [number, number][] = [[startX, startY]];
    let minX = startX,
      maxX = startX;
    let minY = startY,
      maxY = startY;
    let pixelCount = 0;

    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      const idx = y * width + x;

      if (x < 0 || x >= width || y < 0 || y >= height || visited[idx]) {
        continue;
      }

      const pixelIdx = idx * 4;
      const luminance = getLuminance(pixelIdx);

      if (luminance >= luminanceThreshold) {
        continue; // Too bright, not part of inked region
      }

      visited[idx] = 1;
      pixelCount++;

      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);

      // Add neighbors to stack
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    // Filter out very small regions (likely noise)
    if (pixelCount < 20) {
      return null;
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };
  }

  // Scan for inked regions
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (visited[idx]) {
        continue;
      }

      const pixelIdx = idx * 4;
      const luminance = getLuminance(pixelIdx);

      if (luminance < luminanceThreshold) {
        const region = floodFill(x, y);
        if (region) {
          regions.push(region);
        }
      }
    }
  }

  // Merge overlapping or nearby regions
  return mergeNearbyRegions(regions);
}

function mergeNearbyRegions(regions: BoundingBox[]): BoundingBox[] {
  if (regions.length <= 1) {
    return regions;
  }

  const merged: BoundingBox[] = [];
  const used = new Set<number>();
  const proximityThreshold = 10; // pixels

  for (let i = 0; i < regions.length; i++) {
    if (used.has(i)) {
      continue;
    }

    let current = { ...regions[i] };
    let didMerge = true;

    while (didMerge) {
      didMerge = false;

      for (let j = 0; j < regions.length; j++) {
        if (i === j || used.has(j)) {
          continue;
        }

        const other = regions[j];

        // Check if regions are close enough to merge
        const xOverlap = !(
          current.x + current.width + proximityThreshold < other.x ||
          other.x + other.width + proximityThreshold < current.x
        );
        const yOverlap = !(
          current.y + current.height + proximityThreshold < other.y ||
          other.y + other.height + proximityThreshold < current.y
        );

        if (xOverlap && yOverlap) {
          // Merge regions
          const minX = Math.min(current.x, other.x);
          const minY = Math.min(current.y, other.y);
          const maxX = Math.max(current.x + current.width, other.x + other.width);
          const maxY = Math.max(current.y + current.height, other.y + other.height);

          current = {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
          };

          used.add(j);
          didMerge = true;
        }
      }
    }

    merged.push(current);
  }

  return merged;
}

function getTextBoundingBoxes(textContent: TextContent, viewport: any): BoundingBox[] {
  const boxes: BoundingBox[] = [];

  for (const item of (textContent as any).items) {
    if ('str' in item && item.str.trim()) {
      const tx = item.transform;
      const fontSize = Math.abs(tx[3]); // Use the correct font size from transform matrix

      // Calculate bounding box - PDF coordinates have origin at bottom-left
      const x = tx[4];
      const y = tx[5];
      const width = item.width || item.str.length * fontSize * 0.6; // Fallback width estimation
      const height = fontSize;

      // Convert from PDF coordinates (bottom-left origin) to canvas coordinates (top-left origin)
      boxes.push({
        x: x,
        y: viewport.height - y - height, // Flip Y and adjust for height
        width: width,
        height: height,
      });
    }
  }

  return boxes;
}

function calculateTextCoverage(region: BoundingBox, textBounds: BoundingBox[]): number {
  let textArea = 0;
  const regionArea = region.width * region.height;

  for (const text of textBounds) {
    // Calculate intersection
    const xOverlap = Math.max(0, Math.min(region.x + region.width, text.x + text.width) - Math.max(region.x, text.x));
    const yOverlap = Math.max(0, Math.min(region.y + region.height, text.y + text.height) - Math.max(region.y, text.y));

    if (xOverlap > 0 && yOverlap > 0) {
      textArea += xOverlap * yOverlap;
    }
  }

  return textArea / regionArea;
}

function isRegionTooSimple(ctx: CanvasRenderingContext2D, region: BoundingBox, textBounds: BoundingBox[]): boolean {
  // Sample the region excluding text areas
  const sampleSize = 10;
  const samples: [number, number, number][] = [];

  for (let i = 0; i < sampleSize; i++) {
    for (let j = 0; j < sampleSize; j++) {
      const x = region.x + (region.width * i) / sampleSize;
      const y = region.y + (region.height * j) / sampleSize;

      // Check if this point is inside any text bound
      let insideText = false;
      for (const text of textBounds) {
        if (x >= text.x && x <= text.x + text.width && y >= text.y && y <= text.y + text.height) {
          insideText = true;
          break;
        }
      }

      if (!insideText) {
        const pixel = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
        samples.push([pixel[0], pixel[1], pixel[2]]);
      }
    }
  }

  if (samples.length === 0) {
    return true;
  }

  // Calculate color variance
  const avgColor = samples
    .reduce((acc, color) => [acc[0] + color[0], acc[1] + color[1], acc[2] + color[2]], [0, 0, 0])
    .map((v) => v / samples.length);

  const variance =
    samples.reduce((acc, color) => {
      const diff =
        Math.abs(color[0] - avgColor[0]) + Math.abs(color[1] - avgColor[1]) + Math.abs(color[2] - avgColor[2]);
      return acc + diff;
    }, 0) / samples.length;

  // If variance is very low, region is too simple (single color background)
  return variance < 30;
}

/**
 * Generate visualization for a page showing detected regions
 */
async function generatePageVisualization(page: PDFPageProxy, pageNumber: number): Promise<PageVisualization | null> {
  try {
    const scale = 2; // Higher scale for better quality
    const viewport = page.getViewport({ scale });

    // Create canvas for base rendering
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    // Render the page
    await page.render({
      canvasContext: context,
      canvas: canvas,
      viewport: viewport,
    }).promise;

    // Get text bounds for visualization
    const textContent = await page.getTextContent();
    const textBounds = getTextBoundingBoxes(textContent as any, viewport);

    // Detect graphics regions
    const graphicBlocks = await detectGraphicsRegions(page);

    // Find inked regions for visualization
    const inkedRegions = await findInkedRegionsForVisualization(context, canvas.width, canvas.height);

    // Draw visualizations on top of the rendered page
    drawVisualizationOverlays(context, {
      textBounds,
      graphicBlocks,
      inkedRegions,
      scale,
    });

    // Convert to base64
    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');

    return {
      pageNumber,
      base64,
      mimeType: 'image/png',
    };
  } catch (error) {
    notifyDebug(`Failed to generate visualization for page ${pageNumber}`, error);
    return null;
  }
}

/**
 * Find inked regions specifically for visualization purposes
 */
async function findInkedRegionsForVisualization(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): Promise<BoundingBox[]> {
  const downsampleFactor = 4;

  // Create downsampled canvas
  const downsampledCanvas = document.createElement('canvas');
  const downsampledCtx = downsampledCanvas.getContext('2d', { willReadFrequently: true })!;
  downsampledCanvas.width = Math.floor(width / downsampleFactor);
  downsampledCanvas.height = Math.floor(height / downsampleFactor);

  // Downsample the image
  downsampledCtx.drawImage(ctx.canvas, 0, 0, width, height, 0, 0, downsampledCanvas.width, downsampledCanvas.height);

  // Find inked regions
  const regions = findInkedRegions(downsampledCtx, downsampledCanvas.width, downsampledCanvas.height);

  // Scale regions back to original size
  return regions.map((region) => ({
    x: region.x * downsampleFactor,
    y: region.y * downsampleFactor,
    width: region.width * downsampleFactor,
    height: region.height * downsampleFactor,
  }));
}

/**
 * Draw visualization overlays on the canvas
 */
function drawVisualizationOverlays(
  ctx: CanvasRenderingContext2D,
  data: {
    textBounds: BoundingBox[];
    graphicBlocks: GraphicBlock[];
    inkedRegions: BoundingBox[];
    scale: number;
  },
): void {
  const { textBounds, graphicBlocks, inkedRegions, scale } = data;

  // Set composite operation for transparency
  ctx.globalCompositeOperation = 'source-over';

  // Draw inked regions in semi-transparent blue
  ctx.fillStyle = 'rgba(0, 100, 255, 0.2)';
  ctx.strokeStyle = 'rgba(0, 100, 255, 0.6)';
  ctx.lineWidth = 2;
  for (const region of inkedRegions) {
    ctx.fillRect(region.x, region.y, region.width, region.height);
    ctx.strokeRect(region.x, region.y, region.width, region.height);
  }

  // Draw graphic blocks (image regions) in semi-transparent green
  ctx.fillStyle = 'rgba(0, 255, 100, 0.2)';
  ctx.strokeStyle = 'rgba(0, 255, 100, 0.6)';
  ctx.lineWidth = 2;
  for (const block of graphicBlocks) {
    const x = block.x * scale;
    const y = block.y * scale;
    const width = block.width * scale;
    const height = block.height * scale;
    ctx.fillRect(x, y, width, height);
    ctx.strokeRect(x, y, width, height);
  }

  // Draw text bounds in semi-transparent red
  ctx.fillStyle = 'rgba(255, 0, 100, 0.1)';
  ctx.strokeStyle = 'rgba(255, 0, 100, 0.4)';
  ctx.lineWidth = 1;
  for (const textBound of textBounds) {
    // Scale text bounds for the higher resolution canvas
    const x = textBound.x * scale;
    const y = textBound.y * scale;
    const width = textBound.width * scale;
    const height = textBound.height * scale;
    ctx.fillRect(x, y, width, height);
    ctx.strokeRect(x, y, width, height);
  }

  // Add legend
  drawLegend(ctx, ctx.canvas.width, ctx.canvas.height);
}

/**
 * Draw a legend explaining the visualization colors
 */
function drawLegend(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number): void {
  const legendItems = [
    { color: 'rgba(0, 100, 255, 0.6)', label: 'Inked Regions' },
    { color: 'rgba(0, 255, 100, 0.6)', label: 'Graphics/Images' },
    { color: 'rgba(255, 0, 100, 0.4)', label: 'Text Bounds' },
  ];

  const padding = 20;
  const boxSize = 15;
  const lineHeight = 25;
  const fontSize = 14;

  // Calculate legend dimensions
  const legendWidth = 150;
  const legendHeight = padding * 2 + legendItems.length * lineHeight;

  // Position legend in top-right corner
  const legendX = canvasWidth - legendWidth - padding;
  const legendY = padding;

  // Draw semi-transparent background
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.fillRect(legendX, legendY, legendWidth, legendHeight);

  // Draw border
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.lineWidth = 1;
  ctx.strokeRect(legendX, legendY, legendWidth, legendHeight);

  // Draw legend items
  ctx.font = `${fontSize}px Arial`;
  ctx.textBaseline = 'middle';

  legendItems.forEach((item, index) => {
    const y = legendY + padding + index * lineHeight + boxSize / 2;

    // Draw color box
    ctx.fillStyle = item.color;
    ctx.fillRect(legendX + padding, y - boxSize / 2, boxSize, boxSize);
    ctx.strokeStyle = item.color;
    ctx.strokeRect(legendX + padding, y - boxSize / 2, boxSize, boxSize);

    // Draw label
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillText(item.label, legendX + padding + boxSize + 10, y);
  });
}
