import { describe, expect, test } from '@jest/globals';
import { estimateImageTokens, VisionModel, DetailLevel } from 'poml/util/tokenCounterImage';

describe('estimateImageTokens', () => {
  const cases: { w: number; h: number; model: VisionModel; detail?: DetailLevel; expected: number }[] = [
    { w: 1024, h: 1024, model: 'gpt-4.1-mini', expected: 1024 },
    { w: 1800, h: 2400, model: 'gpt-4.1-mini', expected: 1452 },
    { w: 1024, h: 1024, model: 'gpt-4o', detail: 'high', expected: 765 },
    { w: 2048, h: 4096, model: 'gpt-4o', detail: 'high', expected: 1105 },
    { w: 4096, h: 8192, model: 'gpt-4o', detail: 'low', expected: 85 },
  ];

  test.each(cases)('tokens for %j', ({ w, h, model, detail, expected }) => {
    const got = estimateImageTokens(w, h, { model, detail });
    expect(got).toBe(expected);
  });
});
