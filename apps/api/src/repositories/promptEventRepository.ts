import { db } from '../db';
import { PromptEvent } from '../types';

export async function recordPromptEvent(
  promptId: string,
  level: PromptEvent['level'],
  message: string,
  context: Record<string, unknown> | null = null
) {
  await db<PromptEvent>('prompt_events').insert({
    prompt_id: promptId,
    level,
    message,
    context: context ?? null
  });
}

export async function listPromptEvents(promptId: string, limit = 50): Promise<PromptEvent[]> {
  return db<PromptEvent>('prompt_events')
    .where({ prompt_id: promptId })
    .orderBy('created_at', 'desc')
    .limit(limit);
}

export async function listPromptEventsForPrompts(
  promptIds: readonly string[],
  perPromptLimit = 5
): Promise<Map<string, PromptEvent[]>> {
  const eventsByPrompt = new Map<string, PromptEvent[]>();
  if (promptIds.length === 0) {
    return eventsByPrompt;
  }

  const rows = await db<PromptEvent>('prompt_events')
    .whereIn('prompt_id', promptIds)
    .orderBy('created_at', 'desc')
    .limit(perPromptLimit * promptIds.length);

  for (const event of rows) {
    const bucket = eventsByPrompt.get(event.prompt_id) ?? [];
    if (bucket.length >= perPromptLimit) {
      continue;
    }
    bucket.push(event);
    eventsByPrompt.set(event.prompt_id, bucket);
  }

  return eventsByPrompt;
}
