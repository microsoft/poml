const log = console.log;
console.log = (m, ...a) => (/Cannot polyfill `(DOMMatrix|Path2D)`/.test(m) ? null : log(m, ...a));

// import * as PDFJS from 'pdfjs-dist';
// import PDFJS from 'pdfjs-dist/legacy/build/pdf.js';
import * as PDFJS from 'pdfjs-dist/legacy/build/pdf.js';

let pdfjs = PDFJS;

if (PDFJS.GlobalWorkerOptions === undefined) {
  // in esm
  pdfjs = (PDFJS as any).default;
} else {
  // in commonjs
  pdfjs = PDFJS;
}

pdfjs.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/legacy/build/pdf.worker.js';

console.log = log; // restore original console.log

export async function getNumPages(pdfBuffer: ArrayBuffer | Buffer): Promise<number> {
  const uint8Array = pdfBuffer instanceof ArrayBuffer ? new Uint8Array(pdfBuffer) : new Uint8Array(pdfBuffer);
  const loadingTask = pdfjs.getDocument({ data: uint8Array });
  const pdfDocument = await loadingTask.promise;
  return pdfDocument.numPages;
}

export async function pdfParse(pdfBuffer: ArrayBuffer | Buffer, maxPages?: number): Promise<string> {
  const uint8Array = pdfBuffer instanceof ArrayBuffer ? new Uint8Array(pdfBuffer) : new Uint8Array(pdfBuffer);
  const loadingTask = pdfjs.getDocument({ data: uint8Array });
  const pdfDocument = await loadingTask.promise;

  let fullTexts: string[] = [];

  if (maxPages == undefined) {
    maxPages = pdfDocument.numPages;
  } else {
    maxPages = Math.min(maxPages, pdfDocument.numPages);
  }

  for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
    const page = await pdfDocument.getPage(pageNum);
    const pageText = await extractTextFromPage(page);
    fullTexts.push(pageText);
  }

  return fullTexts.join('\n\n');
}

async function extractTextFromPage(page: PDFJS.PDFPageProxy): Promise<string> {
  const textContent = await page.getTextContent();
  let lastY,
    text = '';
  for (let item of textContent.items) {
    if (lastY == (item as any).transform[5] || !lastY) {
      text += (item as any).str;
    } else {
      text += '\n' + (item as any).str;
    }
    lastY = (item as any).transform[5];
  }
  return text;
}
