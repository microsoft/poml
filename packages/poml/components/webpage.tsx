import { PropsSyntaxBase } from 'poml/essentials';
import * as React from 'react';
import * as fs from 'fs';
import { component, expandRelative, useWithCatch } from 'poml/base';
import { Text } from 'poml/essentials';
import * as cheerio from 'cheerio';
import { htmlToPoml } from './document';

export interface WebpageProps extends PropsSyntaxBase {
  src?: string;
  url?: string;
  buffer?: string | Buffer;
  base64?: string;
  extractText?: boolean;
  selector?: string;
}

async function fetchWebpage(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return await response.text();
  } catch (error) {
    throw new Error(`Error fetching webpage from ${url}: ${error}`);
  }
}

async function extractTextFromHtml(html: string, selector?: string): Promise<string> {
  const $ = cheerio.load(html);

  // Remove scripts and styles
  $('script').remove();
  $('style').remove();

  // If selector is provided, extract content from matching elements
  if (selector) {
    try {
      const elements = $(selector);
      if (elements.length === 0) {
        return `No elements found matching selector: ${selector}`;
      }

      return elements
        .map((_, el) => $(el).text())
        .get()
        .join('\n\n');
    } catch (error) {
      throw new Error(`Error with selector "${selector}": ${error}`);
    }
  }

  // Get text from body, preserving some structure
  return $('body').text().trim() || '';
}

async function processWebpage(props: WebpageProps): Promise<React.ReactElement> {
  const { src, url, buffer, extractText = false, selector } = props;

  let html: string;

  if (url) {
    html = await fetchWebpage(url);
  } else if (src) {
    const filePath = expandRelative(src);
    html = fs.readFileSync(filePath, 'utf-8');
  } else if (buffer) {
    if (typeof buffer === 'string') {
      html = buffer;
    } else {
      html = buffer.toString('utf-8');
    }
  } else {
    throw new Error('Either url, src, or buffer must be provided');
  }

  if (extractText) {
    const text = await extractTextFromHtml(html, selector);
    return <Text whiteSpace='pre'>{text}</Text>;
  } else {
    // Use the htmlToPoml function to convert HTML to POML components
    const $ = cheerio.load(html);
    let content: React.ReactElement;

    if (selector) {
      const selected = $(selector);
      if (selected.length === 0) {
        return <Text>No elements found matching selector: {selector}</Text>;
      }
      content = htmlToPoml(selected, $, props);
    } else {
      content = htmlToPoml($('body'), $, props);
    }

    return content;
  }
}

/**
 * Displays content from a webpage.
 *
 * @param {string} url - The URL of the webpage to fetch and display.
 * @param {string} src - Local file path to an HTML file to display.
 * @param {string|Buffer} buffer - HTML content as string or buffer.
 * @param {string} base64 - Base64 encoded HTML content.
 * @param {boolean} extractText - Whether to extract plain text content (true) or convert HTML to structured POML (false). Default is false.
 * @param {string} selector - CSS selector to extract specific content from the page (e.g., "article", ".content", "#main"). Default is "body".
 *
 * @see {@link Inline} for other props available.
 *
 * @example
 * Display content from a URL:
 * ```xml
 * <webpage url="https://example.com" />
 * ```
 *
 * Extract only specific content using a selector:
 * ```xml
 * <webpage url="https://example.com" selector="main article" />
 * ```
 *
 * Convert HTML to structured POML components:
 * ```xml
 * <webpage url="https://example.com" extractText="false" />
 * ```
 */
export const Webpage = component('Webpage', { asynchorous: true })((props: WebpageProps) => {
  let { src, url, buffer, base64, extractText, selector, ...others } = props;
  if (base64) {
    if (buffer !== undefined) {
      throw new Error('Either buffer or base64 should be provided, not both.');
    }
    buffer = Buffer.from(base64, 'base64');
  }
  const content = useWithCatch(processWebpage({ ...props, buffer: buffer }), others);
  return <Text {...others}>{content ?? null}</Text>;
});
