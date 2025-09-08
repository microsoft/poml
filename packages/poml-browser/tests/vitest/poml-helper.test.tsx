import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { cardToPomlReact, cardsToPomlDocument, richContentToString, renderCardsByPoml } from '@common/poml-helper';
import {
  CardModel,
  CardContent,
  TextCardContent,
  ListCardContent,
  ImageCardContent,
  TableCardContent,
  NestedCardContent,
  PomlContainerType,
  SettingsBundle,
} from '@common/types';
import { reactRender } from 'poml/util/reactRender';

// Mock getSettings globally to return default settings
vi.mock('@common/settings', () => ({
  getSettings: vi.fn().mockResolvedValue({
    theme: 'auto',
    uiNotificationLevel: 'info',
    consoleNotificationLevel: 'debug',
  } as SettingsBundle),
  setSettings: vi.fn(),
  clearSettingsCache: vi.fn(),
}));

// Mock renderElementToString to use Node.js reactRender instead of browser renderToReadableStream
vi.mock('@common/utils/react', async (importOriginal) => {
  const original = (await importOriginal()) as any;
  return {
    ...original,
    renderElementToString: vi.fn().mockImplementation(async (element: React.ReactElement) => {
      return await reactRender(element);
    }),
  };
});

describe('poml-helper', () => {
  it('minimal', async () => {
    const card: CardModel = {
      content: {
        type: 'text',
        text: 'Hello, world!',
      },
    };
    const result = await renderCardsByPoml([card]);
    expect(result).toBe('Hello, world!');
  });
});
