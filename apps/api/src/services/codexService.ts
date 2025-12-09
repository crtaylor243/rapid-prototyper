import type { Codex, Thread } from '@openai/codex-sdk';
import { config } from '../config';

let codexClient: Codex | null = null;

async function loadCodexModule() {
  return import('@openai/codex-sdk');
}

async function getClient(): Promise<Codex> {
  if (!config.openAiApiKey) {
    throw new Error('Codex SDK is not configured. Set OPENAI_API_KEY.');
  }

  if (!codexClient) {
    const options: { apiKey: string; env?: Record<string, string> } = {
      apiKey: config.openAiApiKey
    };

    if (config.codexOrg) {
      options.env = { CODEX_ORG: config.codexOrg };
    }

    const { Codex: CodexConstructor } = await loadCodexModule();
    codexClient = new CodexConstructor(options);
  }

  return codexClient;
}

function buildPrompt(userPrompt: string): string {
  const trimmed = userPrompt.trim();
  const normalizedUserPrompt = trimmed.length > 0 ? trimmed : 'Build a minimal placeholder component.';
  return `${config.codexSystemPrompt.trim()}

User prompt:\n${normalizedUserPrompt}`;
}

async function threadForId(threadId?: string | null): Promise<Thread> {
  const client = await getClient();
  if (threadId) {
    return client.resumeThread(threadId);
  }
  return client.startThread();
}

function normalizeResponse(response: string): string {
  return response.trim();
}

export function isCodexConfigured(): boolean {
  return Boolean(config.openAiApiKey);
}

export async function runPromptThroughCodex(promptText: string, threadId?: string | null) {
  const thread = await threadForId(threadId);
  const prompt = buildPrompt(promptText);
  const turn = await thread.run(prompt);
  const finalResponse = normalizeResponse(turn.finalResponse ?? '');
  if (!finalResponse) {
    throw new Error('Codex returned an empty response');
  }

  const resolvedThreadId = thread.id;
  if (!resolvedThreadId) {
    throw new Error('Codex thread did not provide an identifier');
  }

  return { threadId: resolvedThreadId, jsx: finalResponse };
}
