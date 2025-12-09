import { db } from '../db';
import { Prompt, PromptStatus } from '../types';

interface CreatePromptParams {
  userId: string;
  promptText: string;
  title: string;
  status?: PromptStatus;
  codexTaskId?: string | null;
}

export async function listPromptsForUser(userId: string): Promise<Prompt[]> {
  return db<Prompt>('prompts').where({ user_id: userId }).orderBy('updated_at', 'desc');
}

export async function createPrompt(params: CreatePromptParams): Promise<Prompt> {
  const [prompt] = await db<Prompt>('prompts')
    .insert({
      user_id: params.userId,
      prompt_text: params.promptText,
      title: params.title,
      status: params.status ?? 'pending',
      codex_task_id: params.codexTaskId ?? null
    })
    .returning('*');

  return prompt;
}

export async function deletePrompt(promptId: string, userId: string): Promise<number> {
  return db<Prompt>('prompts').where({ id: promptId, user_id: userId }).del();
}
