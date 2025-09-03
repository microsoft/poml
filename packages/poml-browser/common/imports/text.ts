import { CardModel, TextCardContent, CardSource } from '@common/types';

export function cardFromText(text: string, options: { source: CardSource }): CardModel {
  const content: TextCardContent = {
    type: 'text',
    text: text.trim(),
  };

  return {
    content,
    source: options.source,
    mimeType: 'text/plain',
    timestamp: new Date(),
  };
}
