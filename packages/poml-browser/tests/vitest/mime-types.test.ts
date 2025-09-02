import { describe, it, expect } from 'vitest';
import * as mimeTypes from '@common/utils/mime-types';

describe('mimeTypes', () => {
  describe('.charset(type)', () => {
    it('should return "UTF-8" for "application/json"', () => {
      expect(mimeTypes.charset('application/json')).toBe('UTF-8');
    });

    it('should return "UTF-8" for "application/json; foo=bar"', () => {
      expect(mimeTypes.charset('application/json; foo=bar')).toBe('UTF-8');
    });

    it('should return "UTF-8" for "application/javascript"', () => {
      expect(mimeTypes.charset('application/javascript')).toBe('UTF-8');
    });

    it('should return "UTF-8" for "application/JavaScript"', () => {
      expect(mimeTypes.charset('application/JavaScript')).toBe('UTF-8');
    });

    it('should return "UTF-8" for "text/html"', () => {
      expect(mimeTypes.charset('text/html')).toBe('UTF-8');
    });

    it('should return "UTF-8" for "TEXT/HTML"', () => {
      expect(mimeTypes.charset('TEXT/HTML')).toBe('UTF-8');
    });

    it('should return "UTF-8" for any text/*', () => {
      expect(mimeTypes.charset('text/x-bogus')).toBe('UTF-8');
    });

    it('should return null for unknown types', () => {
      expect(mimeTypes.charset('application/x-bogus')).toBe(null);
    });

    it('should return null for any application/octet-stream', () => {
      expect(mimeTypes.charset('application/octet-stream')).toBe(null);
    });

    it('should return null for invalid arguments', () => {
      expect(mimeTypes.charset({} as any)).toBe(null);
      expect(mimeTypes.charset(null as any)).toBe(null);
      expect(mimeTypes.charset(true as any)).toBe(null);
      expect(mimeTypes.charset(42 as any)).toBe(null);
    });
  });

  describe('.contentType(extension)', () => {
    it('should return content-type for "html"', () => {
      expect(mimeTypes.contentType('html')).toBe('text/html; charset=utf-8');
    });

    it('should return content-type for ".html"', () => {
      expect(mimeTypes.contentType('.html')).toBe('text/html; charset=utf-8');
    });

    it('should return content-type for "jade"', () => {
      expect(mimeTypes.contentType('jade')).toBe('text/jade; charset=utf-8');
    });

    it('should return content-type for "json"', () => {
      expect(mimeTypes.contentType('json')).toBe('application/json; charset=utf-8');
    });

    it('should return null for unknown extensions', () => {
      expect(mimeTypes.contentType('bogus')).toBe(null);
    });

    it('should return null for invalid arguments', () => {
      expect(mimeTypes.contentType({} as any)).toBe(null);
      expect(mimeTypes.contentType(null as any)).toBe(null);
      expect(mimeTypes.contentType(true as any)).toBe(null);
      expect(mimeTypes.contentType(42 as any)).toBe(null);
    });
  });

  describe('.contentType(type)', () => {
    it('should attach charset to "application/json"', () => {
      expect(mimeTypes.contentType('application/json')).toBe('application/json; charset=utf-8');
    });

    it('should attach charset to "application/json; foo=bar"', () => {
      expect(mimeTypes.contentType('application/json; foo=bar')).toBe('application/json; foo=bar; charset=utf-8');
    });

    it('should attach charset to "TEXT/HTML"', () => {
      expect(mimeTypes.contentType('TEXT/HTML')).toBe('TEXT/HTML; charset=utf-8');
    });

    it('should attach charset to "text/html"', () => {
      expect(mimeTypes.contentType('text/html')).toBe('text/html; charset=utf-8');
    });

    it('should not alter "text/html; charset=iso-8859-1"', () => {
      expect(mimeTypes.contentType('text/html; charset=iso-8859-1')).toBe('text/html; charset=iso-8859-1');
    });

    it('should return type for unknown types', () => {
      expect(mimeTypes.contentType('application/x-bogus')).toBe('application/x-bogus');
    });
  });

  describe('.extension(type)', () => {
    it('should return extension for mime type', () => {
      expect(mimeTypes.extension('text/html')).toBe('html');
      expect(mimeTypes.extension(' text/html')).toBe('html');
      expect(mimeTypes.extension('text/html ')).toBe('html');
    });

    it('should return null for unknown type', () => {
      expect(mimeTypes.extension('application/x-bogus')).toBe(null);
    });

    it('should return null for non-type string', () => {
      expect(mimeTypes.extension('bogus')).toBe(null);
    });

    it('should return null for non-strings', () => {
      expect(mimeTypes.extension(null as any)).toBe(null);
      expect(mimeTypes.extension(undefined as any)).toBe(null);
      expect(mimeTypes.extension(42 as any)).toBe(null);
      expect(mimeTypes.extension({} as any)).toBe(null);
    });

    it('should return extension for mime type with parameters', () => {
      expect(mimeTypes.extension('text/html;charset=UTF-8')).toBe('html');
      expect(mimeTypes.extension('text/HTML; charset=UTF-8')).toBe('html');
      expect(mimeTypes.extension('text/html; charset=UTF-8')).toBe('html');
      expect(mimeTypes.extension('text/html; charset=UTF-8 ')).toBe('html');
      expect(mimeTypes.extension('text/html ; charset=UTF-8')).toBe('html');
    });
  });

  describe('.lookup(extension)', () => {
    it('should return mime type for ".html"', () => {
      expect(mimeTypes.lookup('.html')).toBe('text/html');
    });

    it('should return mime type for ".js"', () => {
      expect(mimeTypes.lookup('.js')).toBe('text/javascript');
    });

    it('should return mime type for ".json"', () => {
      expect(mimeTypes.lookup('.json')).toBe('application/json');
    });

    it('should return mime type for ".rtf"', () => {
      expect(mimeTypes.lookup('.rtf')).toBe('application/rtf');
    });

    it('should return mime type for ".txt"', () => {
      expect(mimeTypes.lookup('.txt')).toBe('text/plain');
    });

    it('should return mime type for ".xml"', () => {
      expect(mimeTypes.lookup('.xml')).toBe('application/xml');
    });

    it('should return mime type for ".mp4"', () => {
      expect(mimeTypes.lookup('.mp4')).toBe('application/mp4');
    });

    it('should work without the leading dot', () => {
      expect(mimeTypes.lookup('html')).toBe('text/html');
      expect(mimeTypes.lookup('xml')).toBe('application/xml');
    });

    it('should be case insensitive', () => {
      expect(mimeTypes.lookup('HTML')).toBe('text/html');
      expect(mimeTypes.lookup('.Xml')).toBe('application/xml');
    });

    it('should return null for unknown extension', () => {
      expect(mimeTypes.lookup('.bogus')).toBe(null);
      expect(mimeTypes.lookup('bogus')).toBe(null);
    });

    it('should return null for non-strings', () => {
      expect(mimeTypes.lookup(null as any)).toBe(null);
      expect(mimeTypes.lookup(undefined as any)).toBe(null);
      expect(mimeTypes.lookup(42 as any)).toBe(null);
      expect(mimeTypes.lookup({} as any)).toBe(null);
    });
  });

  describe('custom types', () => {
    it('should recognize "text/x-python" for .py files', () => {
      expect(mimeTypes.lookup('.py')).toBe('text/x-python');
      expect(mimeTypes.extension('text/x-python')).toBe('py');
      expect(mimeTypes.charset('text/x-python')).toBe('UTF-8');
      expect(mimeTypes.contentType('text/x-python')).toBe('text/x-python; charset=utf-8');
    });

    it('should recognize "text/x-poml" for .poml files', () => {
      expect(mimeTypes.lookup('.poml')).toBe('text/x-poml');
      expect(mimeTypes.extension('text/x-poml')).toBe('poml');
      expect(mimeTypes.charset('text/x-poml')).toBe('UTF-8');
      expect(mimeTypes.contentType('text/x-poml')).toBe('text/x-poml; charset=utf-8');
    });
  });

  describe('.lookup(path)', () => {
    it('should return mime type for file name', () => {
      expect(mimeTypes.lookup('page.html')).toBe('text/html');
    });

    it('should return mime type for relative path', () => {
      expect(mimeTypes.lookup('path/to/page.html')).toBe('text/html');
      expect(mimeTypes.lookup('path\\to\\page.html')).toBe('text/html');
    });

    it('should return mime type for absolute path', () => {
      expect(mimeTypes.lookup('/path/to/page.html')).toBe('text/html');
      expect(mimeTypes.lookup('C:\\path\\to\\page.html')).toBe('text/html');
    });

    it('should be case insensitive', () => {
      expect(mimeTypes.lookup('/path/to/PAGE.HTML')).toBe('text/html');
      expect(mimeTypes.lookup('C:\\path\\to\\PAGE.HTML')).toBe('text/html');
    });

    it('should return null for unknown extension', () => {
      expect(mimeTypes.lookup('/path/to/file.bogus')).toBe(null);
    });

    it('should return null for path without extension', () => {
      expect(mimeTypes.lookup('/path/to/json')).toBe(null);
    });

    describe('path with dotfile', () => {
      it('should return null when extension-less', () => {
        expect(mimeTypes.lookup('/path/to/json')).toBe(null);
      });

      it('should return mime type when there is extension', () => {
        expect(mimeTypes.lookup('/path/to/.config.json')).toBe('application/json');
      });

      it('should return mime type when there is extension, but no path', () => {
        expect(mimeTypes.lookup('.config.json')).toBe('application/json');
      });
    });
  });

  describe('category annotations', () => {
    it('classifies text as plain', () => {
      expect(mimeTypes.category('text/plain')).toBe('plain');
      expect(mimeTypes.category('text/csv')).toBe('plain');
    });

    it('classifies common code types as code', () => {
      expect(mimeTypes.category('application/json')).toBe('code');
      expect(mimeTypes.category('text/markdown')).toBe('code');
      expect(mimeTypes.category('text/x-python')).toBe('code');
    });

    it('classifies +json/+xml/+yaml suffix types as code', () => {
      expect(mimeTypes.category('application/geo+json')).toBe('code');
      expect(mimeTypes.category('application/atom+xml')).toBe('code');
      expect(mimeTypes.category('application/raml+yaml')).toBe('code');
    });

    it('classifies media types by family', () => {
      expect(mimeTypes.category('image/png')).toBe('image');
      expect(mimeTypes.category('audio/mpeg')).toBe('audio');
      expect(mimeTypes.category('video/mp4')).toBe('video');
    });

    it('classifies custom types', () => {
      expect(mimeTypes.category('text/x-poml')).toBe('code');
      expect(mimeTypes.category('text/x-pomx')).toBe('code');
      expect(mimeTypes.category('text/x-rst')).toBe('code');
      expect(mimeTypes.category('application/x-python-code')).toBe('unknown');
    });

    it('defaults unknown to unknown', () => {
      expect(mimeTypes.category('application/octet-stream')).toBe('unknown');
    });
  });
});
