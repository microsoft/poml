export function parseUriList(data: string): string[] {
  // Spec prefers CRLF; accept LF as fallback. Ignore comment lines (#...).
  return data
    .split(/\r\n|\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}
