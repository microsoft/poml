import { describe, it, expect } from 'vitest';
import { parseUriList } from '@common/imports/uri';

describe('parseUriList', () => {
  it('should parse URI list with CRLF line endings', () => {
    const uriList = 'http://example.com\r\nhttp://example.org\r\nhttp://example.net';
    const result = parseUriList(uriList);
    expect(result).toEqual(['http://example.com', 'http://example.org', 'http://example.net']);
  });

  it('should parse URI list with LF line endings', () => {
    const uriList = 'http://example.com\nhttp://example.org\nhttp://example.net';
    const result = parseUriList(uriList);
    expect(result).toEqual(['http://example.com', 'http://example.org', 'http://example.net']);
  });

  it('should parse URI list with mixed line endings', () => {
    const uriList = 'http://example.com\r\nhttp://example.org\nhttp://example.net\r\nhttp://example.edu';
    const result = parseUriList(uriList);
    expect(result).toEqual(['http://example.com', 'http://example.org', 'http://example.net', 'http://example.edu']);
  });

  it('should filter out comment lines starting with #', () => {
    const uriList = '# This is a comment\r\nhttp://example.com\r\n# Another comment\r\nhttp://example.org';
    const result = parseUriList(uriList);
    expect(result).toEqual(['http://example.com', 'http://example.org']);
  });

  it('should filter out empty lines', () => {
    const uriList = 'http://example.com\r\n\r\nhttp://example.org\n\nhttp://example.net';
    const result = parseUriList(uriList);
    expect(result).toEqual(['http://example.com', 'http://example.org', 'http://example.net']);
  });

  it('should trim whitespace from URLs', () => {
    const uriList = '  http://example.com  \r\n\t http://example.org \t\n   http://example.net   ';
    const result = parseUriList(uriList);
    expect(result).toEqual(['http://example.com', 'http://example.org', 'http://example.net']);
  });

  it('should filter out whitespace-only lines', () => {
    const uriList = 'http://example.com\r\n   \r\nhttp://example.org\n\t\t\nhttp://example.net';
    const result = parseUriList(uriList);
    expect(result).toEqual(['http://example.com', 'http://example.org', 'http://example.net']);
  });

  it('should handle complex URI list with comments, empty lines, and whitespace', () => {
    const uriList = `# List of websites to visit
    
http://example.com
# Development sites
  http://dev.example.org  

# Production sites
http://example.net
    
# End of list`;
    const result = parseUriList(uriList);
    expect(result).toEqual(['http://example.com', 'http://dev.example.org', 'http://example.net']);
  });

  it('should return empty array for empty input', () => {
    const result = parseUriList('');
    expect(result).toEqual([]);
  });

  it('should return empty array for input with only comments and whitespace', () => {
    const uriList = '# Only comments\r\n# More comments\n   \r\n\t\t';
    const result = parseUriList(uriList);
    expect(result).toEqual([]);
  });

  it('should handle single URL without line endings', () => {
    const uriList = 'http://example.com';
    const result = parseUriList(uriList);
    expect(result).toEqual(['http://example.com']);
  });

  it('should handle URLs with different protocols and paths', () => {
    const uriList = `https://secure.example.com/path
ftp://files.example.org/folder
http://api.example.net/v1/endpoint
file:///local/file.txt
mailto:test@example.com`;
    const result = parseUriList(uriList);
    expect(result).toEqual([
      'https://secure.example.com/path',
      'ftp://files.example.org/folder',
      'http://api.example.net/v1/endpoint',
      'file:///local/file.txt',
      'mailto:test@example.com',
    ]);
  });

  it('should handle comment character in the middle of URL (not filtered)', () => {
    const uriList = 'http://example.com/search?q=hello#world\r\nhttp://example.org';
    const result = parseUriList(uriList);
    expect(result).toEqual(['http://example.com/search?q=hello#world', 'http://example.org']);
  });

  it('should filter lines that start with # after trimming', () => {
    const uriList = '   # Comment with leading spaces\r\nhttp://example.com\r\n\t#\tComment with tabs';
    const result = parseUriList(uriList);
    expect(result).toEqual(['http://example.com']);
  });

  it('should preserve URLs with query parameters and fragments', () => {
    const uriList = `http://example.com?param=value&other=data
https://example.org/path?query=test#section
http://example.net:8080/api/v1/users?limit=10`;
    const result = parseUriList(uriList);
    expect(result).toEqual([
      'http://example.com?param=value&other=data',
      'https://example.org/path?query=test#section',
      'http://example.net:8080/api/v1/users?limit=10',
    ]);
  });

  it('should handle international domain names and unicode characters', () => {
    const uriList = `http://example.com/测试
https://мой-сайт.рф
http://example.org/café`;
    const result = parseUriList(uriList);
    expect(result).toEqual(['http://example.com/测试', 'https://мой-сайт.рф', 'http://example.org/café']);
  });
});
