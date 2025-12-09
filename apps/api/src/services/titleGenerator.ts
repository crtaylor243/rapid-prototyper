import type { ThreadOptions } from '@openai/codex-sdk';
import { config } from '../config';
import { getCodexClient, isCodexConfigured } from './codexClient';
import { logError, logInfo } from '../logger';

const MAX_TITLE_LENGTH = 48;
const TITLE_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description: 'A descriptive 4-5 word title in Title Case with no trailing punctuation.'
    }
  },
  required: ['title'],
  additionalProperties: false
} as const;

const TITLE_THREAD_OPTIONS: ThreadOptions = {
  model: config.codexTitleModel,
  modelReasoningEffort: 'low',
  skipGitRepoCheck: true
};

export async function generatePromptTitle(promptText: string): Promise<string> {
  const fallback = fallbackTitle(promptText);
  if (!promptText.trim()) {
    return fallback;
  }

  if (!isCodexConfigured()) {
    return fallback;
  }

  try {
    const client = await getCodexClient();
    const thread = client.startThread(TITLE_THREAD_OPTIONS);
    const prompt = buildTitlePrompt(promptText);
    const turn = await thread.run(prompt, { outputSchema: TITLE_OUTPUT_SCHEMA });
    const result = parseTitleResponse(turn.finalResponse ?? '');
    if (result) {
      logInfo('Generated prompt title via Codex mini', { title: result });
      return result;
    }
    logError('Codex title response missing title field', { finalResponse: turn.finalResponse });
  } catch (error) {
    logError('Codex mini title generation failed', { error });
  }

  return fallback;
}

function buildTitlePrompt(promptText: string): string {
  const sanitized = promptText.trim().replace(/\s+/g, ' ');
  return `You create concise names for prototype ideas.

Rules:
- Provide a descriptive title that captures the intent of the request.
- Exactly 4 or 5 words. Use Title Case. No trailing punctuation or quotes.
- Focus on the product experience, not implementation details.

Prototype request:
"""
${sanitized}
"""

Respond with JSON shaped like {"title":"Your Title"} and nothing else.`;
}

function parseTitleResponse(response: string): string | null {
  let parsed: { title?: string } = {};
  try {
    parsed = JSON.parse(response);
  } catch {
    return null;
  }

  if (!parsed.title) {
    return null;
  }

  return normalizeGeneratedTitle(parsed.title);
}

function normalizeGeneratedTitle(candidate: string): string | null {
  const normalized = candidate.replace(/["\n]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return null;
  }

  const words = normalized.split(' ').filter(Boolean);
  if (words.length === 0) {
    return null;
  }

  const limitedWords = words.slice(0, 5);
  const recombined = limitedWords.join(' ');
  return recombined || null;
}

function fallbackTitle(promptText: string): string {
  const normalized = promptText.trim();
  if (!normalized) {
    return 'Untitled prompt';
  }

  if (normalized.length <= MAX_TITLE_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_TITLE_LENGTH - 3).trimEnd()}...`;
}
