import { CardModel } from '@common/types';

/** */
export async function processPasteEvent(event: ClipboardEvent): Promise<CardModel[]> {}

/** */
export async function processPasteEventAndThrow(
  event: ClipboardEvent,
): Promise<{ cards: CardModel[]; errors: string[] }> {
  const cards: CardModel[] = [];
  const errors: string[] = [];
}
