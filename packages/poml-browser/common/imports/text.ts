import { CardModel, TextCardContent, CardSource } from '@common/types';
import { createCard } from '@common/utils/card';

export function cardFromText(text: string, options: { source: CardSource }): CardModel {
  const content: TextCardContent = {
    type: 'text',
    text: text.trim(),
  };

  return createCard(content, {
    source: options.source,
    mimeType: 'text/plain',
  });
}
