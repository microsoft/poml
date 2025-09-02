// https://github.com/jshttp/mime-types
// Migrated by GPT-5 to TypeScript for in-browser usage
// It relies on the `mime-db` package (JSON data). Use a bundler to include it.

import dbJson from 'mime-db';

// ---- Types ----

type Source = 'nginx' | 'apache' | 'iana' | 'default' | 'custom';

interface MimeRecord {
  source?: Source;
  extensions?: string[];
  charset?: string;
}

type MimeDB = Record<string, MimeRecord>;

// Some `mime-db` distributions don’t ship types; cast defensively.
const db = dbJson as unknown as MimeDB;

// Augmentations to `mime-db` types (if any) would go here
db['application/x-python-code'] = { source: 'custom', extensions: ['pyc'] };
db['text/x-python'] = { source: 'custom', extensions: ['py'], charset: 'UTF-8' };
db['text/x-poml'] = { source: 'custom', extensions: ['poml'], charset: 'UTF-8' };
db['text/x-pomx'] = { source: 'custom', extensions: ['pomx'], charset: 'UTF-8' };
db['text/x-rst'] = { source: 'custom', extensions: ['rst'], charset: 'UTF-8' };

// ---- Regex constants ----

const EXTRACT_TYPE_REGEXP = /^\s*([^;\s]*)(?:;|\s|$)/;
const TEXT_TYPE_REGEXP = /^text\//i;

// ---- Public maps ----

/** mime -> extensions[] */
export const extensions: Record<string, string[]> = Object.create(null);

/** extension -> mime */
export const types: Record<string, string> = Object.create(null);

// ---- Public API ----

/**
 * Get the default charset for a MIME type.
 * Returns "UTF-8" for text/* when unspecified, or null when unknown.
 */
export function charset(type: string): string | null {
  populateMaps(extensions, types);
  if (!type || typeof type !== 'string') {
    return null;
  }

  const match = EXTRACT_TYPE_REGEXP.exec(type);
  const mime = match && db[match[1].toLowerCase()];

  if (mime && mime.charset) {
    return mime.charset;
  }

  if (match && TEXT_TYPE_REGEXP.test(match[1])) {
    return 'UTF-8';
  }

  return null;
}

/**
 * Create a full Content-Type header given a MIME type or extension.
 * Adds a default charset when appropriate.
 */
export function contentType(str: string): string | null {
  populateMaps(extensions, types);
  if (!str || typeof str !== 'string') {
    return null;
  }

  const mime = str.indexOf('/') === -1 ? lookup(str) : str;
  if (!mime) {
    return null;
  }

  if (mime.indexOf('charset') === -1) {
    const cs = charset(mime);
    if (cs) {
      return `${mime}; charset=${cs.toLowerCase()}`;
    }
  }
  return mime;
}

/**
 * Get the default extension for a MIME type.
 */
export function extension(type: string): string | null {
  populateMaps(extensions, types);
  if (!type || typeof type !== 'string') {
    return null;
  }

  const match = EXTRACT_TYPE_REGEXP.exec(type);
  const exts = match && extensions[match[1].toLowerCase()];
  if (!exts || !exts.length) {
    return null;
  }

  return exts[0];
}

/**
 * Lookup the MIME type for a file path or extension.
 * Accepts "ext", ".ext", or "dir/file.ext".
 */
export function lookup(pathOrExt: string): string | null {
  populateMaps(extensions, types);
  if (!pathOrExt || typeof pathOrExt !== 'string') {
    return null;
  }

  // emulate Node's path.extname('x.' + str).slice(1) without Node:
  const ext = getExtension(pathOrExt);
  if (!ext) {
    return null;
  }

  return types[ext] || null;
}

// ---- Internal helpers ----

let _initialized = false;

/**
 * Populate the extensions and types maps using mime-db.
 */
function populateMaps(extMap: Record<string, string[]>, typeMap: Record<string, string>) {
  if (_initialized) {
    return;
  }
  Object.keys(db).forEach((type) => {
    const record = db[type];
    const exts = record.extensions;
    if (!exts || !exts.length) {
      return;
    }

    // mime -> extensions
    extMap[type] = exts;

    // extension -> mime (resolve conflicts with mimeScore)
    for (let i = 0; i < exts.length; i++) {
      const ext = exts[i];
      typeMap[ext] = preferredType(ext, typeMap[ext], type);
    }
  });
  _initialized = true;
}

/**
 * Resolve type conflict using mime-score.
 */
function preferredType(ext: string, currentType: string | undefined, candidateType: string): string {
  const score0 = currentType ? mimeScore(currentType, db[currentType]?.source) : 0;
  const score1 = candidateType ? mimeScore(candidateType, db[candidateType]?.source) : 0;
  return score0 > score1 ? (currentType as string) : candidateType;
}

/**
 * Minimal extension extractor compatible with:
 *  - "ext"          -> "ext"
 *  - ".ext"         -> "ext"
 *  - "dir/a.ext"    -> "ext"
 *  - "noext"        -> ""
 */
function getExtension(input: string): string {
  // prepend "x." to handle bare extensions the same way as original code
  const s = `x.${input}`;
  const idx = s.lastIndexOf('.');
  if (idx === -1 || idx === s.length - 1) {
    return '';
  }
  return s.slice(idx + 1).toLowerCase();
}

// ---- Mime scoring (browser-safe) ----
// Back-ported and inlined so no Node resolution is required.

/**
 * Score RFC facets (see https://tools.ietf.org/html/rfc6838#section-3)
 * Lower is more "vendor/x-" like; higher means more "official".
 */
const FACET_SCORES: Record<string, number> = {
  'prs.': 100,
  'x-': 200,
  'x.': 300,
  'vnd.': 400,
  'default': 900,
};

/**
 * Score mime source (logic inspired by `jshttp/mime-types`).
 */
const SOURCE_SCORES: Record<Source, number> = {
  nginx: 10,
  apache: 20,
  iana: 40,
  default: 30, // definitions added by `jshttp/mime-db` project?
  custom: 50, // definitions added in this file
};

/**
 * Prefer some top-level types over others when equal otherwise.
 */
const TYPE_SCORES: Record<string, number> = {
  // prefer application/xml over text/xml; application/rtf over text/rtf
  application: 1,

  // prefer font/woff over application/font-woff
  font: 2,

  default: 0,
};

/**
 * Get a numeric score for a MIME type.
 * The higher the score, the more "official".
 */
function mimeScore(mimeType: string, source: Source = 'default'): number {
  if (mimeType === 'application/octet-stream') {
    return 0;
  }

  const [type, subtype] = mimeType.split('/');
  const facet = subtype.replace(/(\.|x-).*/, '$1');

  const facetScore = FACET_SCORES[facet] ?? FACET_SCORES.default;
  const sourceScore = SOURCE_SCORES[source ?? 'default'] ?? SOURCE_SCORES.default;
  const typeScore = TYPE_SCORES[type] ?? TYPE_SCORES.default;

  // All else being equal prefer shorter types
  const lengthScore = 1 - mimeType.length / 100;

  return facetScore + sourceScore + typeScore + lengthScore;
}

// Initialize maps at module load (safe in browser)
populateMaps(extensions, types);

// ---- Default export (optional convenience) ----
export default {
  charset,
  charsets: { lookup: charset },
  contentType,
  extension,
  extensions,
  lookup,
  types,
};
