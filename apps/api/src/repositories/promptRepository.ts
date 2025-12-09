import { db } from '../db';
import { Prompt, PromptStatus } from '../types';

interface CreatePromptParams {
  userId: string;
  promptText: string;
  title: string;
  status?: PromptStatus;
  codexTaskId?: string | null;
  previewSlug?: string | null;
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
      codex_task_id: params.codexTaskId ?? null,
      preview_slug: params.previewSlug ?? null
    })
    .returning('*');

  return prompt;
}

export async function deletePrompt(promptId: string, userId: string): Promise<number> {
  return db<Prompt>('prompts').where({ id: promptId, user_id: userId }).del();
}

export async function findPromptsAwaitingBuild(limit = 5): Promise<Prompt[]> {
  return db<Prompt>('prompts')
    .whereIn('status', ['pending', 'building'])
    .orderBy('updated_at', 'asc')
    .limit(limit);
}

export async function markPromptBuilding(promptId: string, codexTaskId?: string) {
  const update: Record<string, unknown> = {
    status: 'building',
    updated_at: db.fn.now()
  };

  if (codexTaskId) {
    update.codex_task_id = codexTaskId;
  }

  await db<Prompt>('prompts').where({ id: promptId }).update(update);
}

export async function markPromptFailed(promptId: string, errorMessage: string) {
  const truncated = errorMessage.slice(0, 2000);
  await db<Prompt>('prompts')
    .where({ id: promptId })
    .update({
      status: 'failed',
      render_error: truncated,
      updated_at: db.fn.now()
    });
}

interface BuildArtifacts {
  jsxSource: string;
  compiledJs: string;
  previewSlug: string;
  sandboxConfig: Record<string, unknown>;
}

export async function savePromptBuildResult(promptId: string, artifacts: BuildArtifacts) {
  await db<Prompt>('prompts')
    .where({ id: promptId })
    .update({
      status: 'ready',
      jsx_source: artifacts.jsxSource,
      compiled_js: artifacts.compiledJs,
      preview_slug: artifacts.previewSlug,
      sandbox_config: artifacts.sandboxConfig,
      render_error: null,
      updated_at: db.fn.now()
    });
}
