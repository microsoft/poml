// Browser-safe mammoth stub for poml-browser
// Mammoth is a library for converting .docx files to HTML
// In browser context, this functionality is not available

export interface ConversionResult {
  value: string;
  messages: any[];
}

export interface ConversionOptions {
  buffer: ArrayBuffer | Uint8Array;
}

export async function convertToHtml(_options: ConversionOptions): Promise<ConversionResult> {
  throw new Error(
    'convertToHtml is not available in browser context. Document conversion requires server-side processing.',
  );
}

export default {
  convertToHtml,
};
