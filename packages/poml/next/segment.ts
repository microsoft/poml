import componentDocs from '../assets/componentDocs.json';

export interface Segment {
  // Unique ID for caching and React keys
  id: string;
  kind: 'META' | 'TEXT' | 'POML';
  start: number;
  end: number;
  // The raw string content of the segment
  content: string;
  // The path to the file or resource this segment belongs to
  path?: string;
  // Reference to the parent segment
  parent?: Segment;
  // Nested segments (e.g., a POML block within text)
  children: Segment[];
  // For POML segments, the name of the root tag (e.g., 'task')
  tagName?: string;
}

class Segmenter {
  private nextId: number;
  private sourcePath: string | undefined;

  constructor(sourcePath: string | undefined) {
    this.nextId = 0;
    this.sourcePath = sourcePath;
  }

  private generateId(): string {
    return `segment_${this.nextId++}`;
  }

  private isValidPomlTag(tagName: string): boolean {
    const validTags = new Set<string>();

    for (const doc of componentDocs) {
      if (doc.name) {
        validTags.add(doc.name.toLowerCase());
        validTags.add(
          doc.name
            .toLowerCase()
            .replace(/([A-Z])/g, '-$1')
            .toLowerCase(),
        );
      }
    }

    validTags.add('poml');
    validTags.add('text');
    validTags.add('meta');

    return validTags.has(tagName.toLowerCase());
  }

  private parseSegments(text: string, start: number = 0, parent?: Segment): Segment[] {
    const segments: Segment[] = [];
    let currentPos = start;

    while (currentPos < text.length) {
      const nextOpenTag = text.indexOf('<', currentPos);

      if (nextOpenTag === -1) {
        if (currentPos < text.length) {
          const textContent = text.substring(currentPos);
          if (textContent.trim()) {
            segments.push({
              id: this.generateId(),
              kind: 'TEXT',
              start: currentPos,
              end: text.length,
              content: textContent,
              path: this.sourcePath,
              parent,
              children: [],
            });
          }
        }
        break;
      }

      if (nextOpenTag > currentPos) {
        const textContent = text.substring(currentPos, nextOpenTag);
        if (textContent.trim()) {
          segments.push({
            id: this.generateId(),
            kind: 'TEXT',
            start: currentPos,
            end: nextOpenTag,
            content: textContent,
            path: this.sourcePath,
            parent,
            children: [],
          });
        }
      }

      const tagEndPos = text.indexOf('>', nextOpenTag);
      if (tagEndPos === -1) {
        currentPos = nextOpenTag + 1;
        continue;
      }

      const tagContent = text.substring(nextOpenTag + 1, tagEndPos);
      const tagName = tagContent.trim().split(/\s+/)[0];

      if (tagName.startsWith('/')) {
        currentPos = tagEndPos + 1;
        continue;
      }

      if (tagContent.endsWith('/')) {
        currentPos = tagEndPos + 1;
        continue;
      }

      if (!this.isValidPomlTag(tagName)) {
        currentPos = tagEndPos + 1;
        continue;
      }

      const closingTag = `</${tagName}>`;
      const closingTagPos = this.findClosingTag(text, tagName, tagEndPos + 1);

      if (closingTagPos === -1) {
        currentPos = tagEndPos + 1;
        continue;
      }

      const segmentContent = text.substring(nextOpenTag, closingTagPos + closingTag.length);
      const innerContent = text.substring(tagEndPos + 1, closingTagPos);

      const segment: Segment = {
        id: this.generateId(),
        kind: tagName.toLowerCase() === 'meta' ? 'META' : 'POML',
        start: nextOpenTag,
        end: closingTagPos + closingTag.length,
        content: segmentContent,
        path: this.sourcePath,
        parent,
        children: [],
        tagName: tagName.toLowerCase(),
      };

      if (tagName.toLowerCase() === 'text') {
        segment.children = this.parseSegments(innerContent, tagEndPos + 1, segment);
      } else if (tagName.toLowerCase() !== 'meta') {
        const childSegments = this.parseSegments(innerContent, tagEndPos + 1, segment);
        segment.children = childSegments;
      }

      segments.push(segment);
      currentPos = closingTagPos + closingTag.length;
    }

    return segments;
  }

  private findClosingTag(text: string, tagName: string, startPos: number): number {
    let depth = 1;
    let pos = startPos;

    while (pos < text.length && depth > 0) {
      const nextTag = text.indexOf('<', pos);
      if (nextTag === -1) {
        break;
      }

      const tagEndPos = text.indexOf('>', nextTag);
      if (tagEndPos === -1) {
        break;
      }

      const tagContent = text.substring(nextTag + 1, tagEndPos);
      const currentTagName = tagContent.trim().split(/\s+/)[0];

      if (currentTagName === tagName) {
        depth++;
      } else if (currentTagName === `/${tagName}`) {
        depth--;
      }

      pos = tagEndPos + 1;
    }

    return depth === 0 ? pos - `</${tagName}>`.length : -1;
  }

  public createSegments(content: string): Segment {
    const rootSegments = this.parseSegments(content);

    if (rootSegments.length === 1 && rootSegments[0].kind === 'POML') {
      return rootSegments[0];
    }

    if (rootSegments.length === 0) {
      return {
        id: this.generateId(),
        kind: 'TEXT',
        start: 0,
        end: content.length,
        content: content,
        path: this.sourcePath,
        children: [],
        parent: undefined,
      };
    }

    const rootSegment: Segment = {
      id: this.generateId(),
      kind: 'TEXT',
      start: 0,
      end: content.length,
      content: content,
      path: this.sourcePath,
      children: rootSegments,
      parent: undefined,
    };

    rootSegments.forEach((segment) => {
      segment.parent = rootSegment;
    });

    return rootSegment;
  }
}

export function createSegments(content: string, sourcePath?: string): Segment {
  const segmenter = new Segmenter(sourcePath);
  return segmenter.createSegments(content);
}
