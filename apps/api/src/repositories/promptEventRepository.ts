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
