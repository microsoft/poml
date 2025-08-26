// Browser-safe pdfjs-dist stub for poml-browser
// PDF.js functionality is not available in browser extension context
// This stub provides minimal interface to prevent runtime errors

interface PDFDocument {
  numPages: number;
  getPage(pageNum: number): Promise<PDFPage>;
}

interface PDFPage {
  getTextContent(): Promise<{ items: Array<{ str: string }> }>;
}

interface LoadingTask {
  promise: Promise<PDFDocument>;
}

interface GlobalWorkerOptions {
  workerSrc: string;
}

class PDFJSStub {
  static GlobalWorkerOptions: GlobalWorkerOptions = {
    workerSrc: '',
  };

  static getDocument(_src: { data: Uint8Array }): LoadingTask {
    return {
      promise: Promise.reject(new Error('PDF processing is not available in browser extension context')),
    };
  }
}

// Export the stub with the same structure as pdfjs-dist
export const GlobalWorkerOptions = PDFJSStub.GlobalWorkerOptions;
export const getDocument = PDFJSStub.getDocument;

export default PDFJSStub;
