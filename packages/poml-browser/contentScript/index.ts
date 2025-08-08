import { Readability } from '@mozilla/readability';
import * as pdfjsLib from 'pdfjs-dist';

interface ExtractedContent {
  title: string;
  content: string;
  excerpt: string;
  debug: string;
}

// PDF text extraction function
async function extractPdfContent(): Promise<ExtractedContent> {
  try {
    console.log('[DEBUG] Starting PDF text extraction');
    
    // Set worker source to use the local worker file
    pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('external/pdf.worker.min.mjs');
    
    // Get PDF URL - handle different PDF embedding scenarios
    const pdfUrl = document.location.href;
    
    console.log('[DEBUG] PDF URL:', pdfUrl);
    
    // For file:// URLs, we need to request file content from background script
    let loadingTask;
    if (pdfUrl.startsWith('file://')) {
      console.log('[DEBUG] Local file detected, requesting binary data from background script');
      
      // Send message to background script to read the file as binary
      const response = await chrome.runtime.sendMessage({
        action: 'readFile',
        filePath: pdfUrl,
        binary: true
      }) as {success: boolean, base64Data?: string, error?: string};
      
      if (!response.success || !response.base64Data) {
        throw new Error(`Failed to read PDF file: ${response.error || 'Unknown error'}`);
      }
      
      // Convert base64 back to ArrayBuffer
      const binaryString = atob(response.base64Data);
      const uint8Array = Uint8Array.from(binaryString, c => c.charCodeAt(0));
      
      console.log('[DEBUG] Received and converted base64 to Uint8Array, size:', uint8Array.byteLength);
      loadingTask = pdfjsLib.getDocument({ data: uint8Array });
    } else {
      // Load the PDF document directly from URL
      loadingTask = pdfjsLib.getDocument(pdfUrl);
    }
    const pdf = await loadingTask.promise;
    
    console.log('[DEBUG] PDF loaded, pages:', pdf.numPages);
    
    let fullText = '';
    const title = document.title || 'PDF Document';
    
    // Extract text from all pages
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Combine all text items from the page
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      
      fullText += pageText + '\n\n';
      console.log(`[DEBUG] Extracted text from page ${pageNum}, length: ${pageText.length}`);
    }
    
    // Clean up the text
    fullText = fullText.trim();
    
    console.log('[DEBUG] Total PDF text extracted, length:', fullText.length);
    
    return {
      title: title,
      content: fullText,
      excerpt: fullText.substring(0, 200) + (fullText.length > 200 ? '...' : ''),
      debug: `PDF extraction successful - ${pdf.numPages} pages processed`
    };
    
  } catch (error) {
    console.error('[DEBUG] Error extracting PDF content:', error);
    
    return {
      title: document.title || 'PDF Document',
      content: 'Error extracting PDF content',
      excerpt: '',
      debug: `PDF extraction failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

// Content extraction function that will be injected into pages
async function extractContent(): Promise<ExtractedContent> {
  try {
    console.log('[DEBUG] Content extractor script loaded');
    console.log('[DEBUG] Document title:', document.title);
    console.log('[DEBUG] Document URL:', document.location.href);
    console.log('[DEBUG] Document body exists:', !!document.body);
    console.log('[DEBUG] Document body innerHTML length:', document.body ? document.body.innerHTML.length : 0);
    
    // Check if this is a PDF document
    if (document.location.href.toLowerCase().includes('.pdf') || 
        document.contentType === 'application/pdf') {
      console.log('[DEBUG] PDF detected, attempting PDF text extraction');
      return await extractPdfContent();
    }
    
    // Always provide fallback first, then try to enhance with Readability
    const fallbackTitle = document.title || 'Untitled';
    const fallbackContent = document.body ? (document.body.innerText || document.body.textContent || '') : '';
    
    console.log('[DEBUG] Fallback content length:', fallbackContent.length);
    
    // If we have no fallback content, return early
    if (!fallbackContent.trim()) {
      console.log('[DEBUG] No fallback content available');
      return {
        title: fallbackTitle,
        content: 'No text content found on this page',
        excerpt: '',
        debug: 'No text content available'
      };
    }
    
    console.log('[DEBUG] Readability is available, proceeding with extraction');
    
    // Create a clone of the document to avoid modifying the original
    const documentClone = document.cloneNode(true) as Document;
    console.log('[DEBUG] Document cloned successfully');
    
    // Use Readability to extract main content
    const reader = new Readability(documentClone, {
      debug: true,
      // maxElemsToDivide: 300,
      nbTopCandidates: 5,
      charThreshold: 500,
      classesToPreserve: []
    });
    
    console.log('[DEBUG] Readability reader created');
    
    const article = reader.parse();
    console.log('[DEBUG] Readability parse completed');
    console.log('[DEBUG] Article result:', article ? 'success' : 'null');
    
    if (article && article.textContent && article.textContent.trim()) {
      console.log('[DEBUG] Article title:', article.title);
      console.log('[DEBUG] Article content length:', article.textContent.length);
      console.log('[DEBUG] Article excerpt length:', article.excerpt ? article.excerpt.length : 0);
      
      return {
        title: article.title || fallbackTitle,
        content: article.textContent,
        excerpt: article.excerpt || '',
        debug: 'Readability extraction successful'
      };
    } else {
      console.log('[DEBUG] Readability failed or returned empty content, using fallback');
      return {
        title: fallbackTitle,
        content: fallbackContent,
        excerpt: fallbackContent.substring(0, 200) + (fallbackContent.length > 200 ? '...' : ''),
        debug: 'Readability failed, used fallback text extraction'
      };
    }
    
  } catch (error) {
    console.error('[DEBUG] Error in content extractor:', error);
    
    // Emergency fallback
    const emergencyTitle = document.title || 'Error extracting title';
    const emergencyContent = document.body ? (document.body.innerText || document.body.textContent || 'Error extracting content') : 'No body element found';
    
    return {
      title: emergencyTitle,
      content: emergencyContent,
      excerpt: '',
      debug: `Script error: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

// Make the function globally available when loaded as a script
declare global {
  interface Window {
    extractContent: () => Promise<ExtractedContent>;
  }
}

(window as any).extractContent = extractContent;

// The following are to extract contents from a Word.

/**
 * Defines the structure for a Header block.
 */
interface HeaderBlock {
  type: 'header';
  level: number;
  content: string;
}

/**
 * Defines the structure for a Paragraph block.
 * This also covers list items, which are treated as paragraphs.
 */
interface ParagraphBlock {
  type: 'paragraph';
  content: string;
}

/**
 * Defines the structure for an Image block.
 */
interface ImageBlock {
  type: 'image';
  src: string;
  alt: string;
}

/**
 * A union type representing any possible block.
 */
type Block = HeaderBlock | ParagraphBlock | ImageBlock;

/**
 * Cleans and normalizes a string by replacing non-breaking spaces,
 * collapsing multiple whitespace characters, and trimming the result.
 * @param text - The input string to clean.
 * @returns The cleaned string.
 */
function cleanText(text: string | null): string {
  if (!text) {
    return '';
  }
  // Replace non-breaking spaces with regular spaces and collapse whitespace
  return text.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Parses an HTML string and converts it into a structured list of blocks.
 *
 * @param htmlContent - The raw HTML string of the document.
 * @returns An array of Block objects (Header, Paragraph, Image).
 */
function convertDomToMarkup(): Block[] {
  const blocks: Block[] = [];
  
  console.log('[DEBUG] Starting convertDomToMarkup');
  console.log('[DEBUG] Document URL:', document.location.href);
  console.log('[DEBUG] Document title:', document.title);
  
  // Since we're now injected directly into the frame, we can access the document directly
  const targetDocument = document;
  
  // Select all primary content containers, which seem to be '.OutlineElement'
  const elements = targetDocument.querySelectorAll('.OutlineElement');

  console.log('[DEBUG] Found', elements.length, 'OutlineElement elements to process');
  
  // If no OutlineElements found, try alternative selectors for Word content
  if (elements.length === 0) {
    console.log('[DEBUG] No OutlineElement found, trying alternative selectors');
    
    // Try other common Word Online selectors
    const alternativeSelectors = [
      '.Paragraph',
      '[role="document"] p',
      '.DocumentFragment p',
      '.Page p',
      'p',
      'div[contenteditable="true"] *',
      '[data-automation-id="documentCanvas"] *'
    ];
    
    for (const selector of alternativeSelectors) {
      const altElements = targetDocument.querySelectorAll(selector);
      console.log(`[DEBUG] Found ${altElements.length} elements with selector: ${selector}`);
      
      if (altElements.length > 0) {
        // Process these elements directly as paragraphs
        altElements.forEach(element => {
          const content = cleanText(element.textContent);
          if (content) {
            // Check if it's a heading
            if (element.getAttribute('role') === 'heading' || element.tagName.match(/^H[1-6]$/)) {
              const level = element.tagName.match(/^H([1-6])$/) ? 
                parseInt(element.tagName.charAt(1)) : 
                parseInt(element.getAttribute('aria-level') || '1', 10);
              
              const headerBlock: HeaderBlock = {
                type: 'header',
                level: isNaN(level) ? 1 : level,
                content: content,
              };
              blocks.push(headerBlock);
            } else {
              const paragraphBlock: ParagraphBlock = {
                type: 'paragraph',
                content: content,
              };
              blocks.push(paragraphBlock);
            }
          }
        });
        break; // Stop after finding the first working selector
      }
    }
  } else {
    // Process OutlineElements as originally intended
    elements.forEach(element => {
      // 1. Check for Images
      const imageEl = element.querySelector('image');
      if (imageEl && imageEl.getAttribute('href')) {
        const imageBlock: ImageBlock = {
          type: 'image',
          // The src is stored in the 'href' attribute of the <image> SVG tag
          src: imageEl.getAttribute('href')!,
          // Alt text is not clearly available, so we'll use a default
          alt: 'Document image'
        };
        blocks.push(imageBlock);
        return; // Continue to the next element
      }

      // 2. Check for Paragraphs and Headers
      const p = element.querySelector('p.Paragraph');
      if (p) {
        const content = cleanText(p.textContent);

        // Skip empty or whitespace-only paragraphs
        if (!content) {
          return;
        }
        
        // Check if the paragraph is a header
        if (p.getAttribute('role') === 'heading') {
          const level = parseInt(p.getAttribute('aria-level') || '1', 10);
          const headerBlock: HeaderBlock = {
            type: 'header',
            level: isNaN(level) ? 1 : level,
            content: content,
          };
          blocks.push(headerBlock);
        } else {
          // Otherwise, it's a standard paragraph (or list item)
          const paragraphBlock: ParagraphBlock = {
            type: 'paragraph',
            content: content,
          };
          blocks.push(paragraphBlock);
        }
      }
    });
  }

  console.log('[DEBUG] Processed', blocks.length, 'blocks total');
  return blocks;
}

(window as any).convertDomToMarkup = convertDomToMarkup;
