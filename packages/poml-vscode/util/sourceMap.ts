import cheerio from 'cheerio';
import { EnvironmentDispatcher } from 'poml/writer';

export interface PlainSpan {
  text: string;
  offset: number;
}

export function computeMessageOffsets(ir: string): number[] {
  const $ = cheerio.load(ir, { xml: { xmlMode: true } });
  return $('[speaker]')
    .map((_, el) => parseInt($(el).attr('original-start-index') || '0', 10))
    .get();
}

export function computePlainSpans(ir: string): PlainSpan[] {
  const writer = new EnvironmentDispatcher();
  const result = writer.writeWithSourceMap(ir) as any;
  const output: string = result.output;
  const mappings: { inputStart: number; inputEnd: number; outputStart: number; outputEnd: number; }[] = result.mappings;
  const root = mappings.find(m => m.outputStart === 0 && m.outputEnd === output.length - 1) || mappings[0];
  const spans: PlainSpan[] = [];
  const sorted = mappings
    .filter(m => m !== root)
    .sort((a: { outputStart: number }, b: { outputStart: number }) => a.outputStart - b.outputStart);
  let pos = 0;
  const rootOffset = root.inputStart - root.outputStart;
  const pushSpan = (start: number, end: number, offset: number) => {
    if (end <= start) {
      return;
    }
    spans.push({ text: output.slice(start, end), offset });
  };
  for (const m of sorted as { inputStart: number; outputStart: number; outputEnd: number }[]) {
    if (pos < m.outputStart) {
      pushSpan(pos, m.outputStart, pos + rootOffset);
    }
    pushSpan(m.outputStart, m.outputEnd + 1, m.inputStart);
    pos = m.outputEnd + 1;
  }
  if (pos < output.length) {
    pushSpan(pos, output.length, pos + rootOffset);
  }
  return spans;
}
