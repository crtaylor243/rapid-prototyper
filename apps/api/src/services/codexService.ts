import type { Thread } from '@openai/codex-sdk';
import { config } from '../config';
import { getCodexClient } from './codexClient';

const codexOutputSchema = {
  type: 'object',
  properties: {
    jsx: {
      type: 'string',
      description:
        'Complete React component code (including imports). Output plain code without Markdown or explanations.'
    }
  },
  required: ['jsx'],
  additionalProperties: false
} as const;

function buildPrompt(userPrompt: string): string {
  const trimmed = userPrompt.trim();
  const normalizedUserPrompt = trimmed.length > 0 ? trimmed : 'Build a minimal placeholder component.';
  return `${config.codexSystemPrompt.trim()}

User prompt:\n${normalizedUserPrompt}`;
}

async function threadForId(threadId?: string | null): Promise<Thread> {
  const client = await getCodexClient();
  if (threadId) {
    return client.resumeThread(threadId);
  }
  return client.startThread();
}

function normalizeResponse(response: string): string {
  return response.trim();
}

export async function runPromptThroughCodex(promptText: string, threadId?: string | null) {
  const thread = await threadForId(threadId);
  const prompt = buildPrompt(promptText);
  const turn = await thread.run(prompt, { outputSchema: codexOutputSchema });
  const finalResponse = normalizeResponse(turn.finalResponse ?? '');
  if (!finalResponse) {
    throw new Error('Codex returned an empty response');
  }

  let parsed: { jsx?: string } = {};
  try {
    parsed = JSON.parse(finalResponse);
  } catch (error) {
    throw new Error(`Codex returned malformed JSON: ${error instanceof Error ? error.message : error}`);
  }

  const structuredJsx = parsed.jsx?.trim();
  if (!structuredJsx) {
    throw new Error('Codex did not provide JSX in the structured response');
  }

  const extractedJsx = extractCodeFromResponse(structuredJsx);
  if (!extractedJsx) {
    throw new Error('Codex did not return any React component code');
  }
  const resolvedThreadId = thread.id;
  if (!resolvedThreadId) {
    throw new Error('Codex thread did not provide an identifier');
  }

  return { threadId: resolvedThreadId, jsx: extractedJsx };
}

const CODE_BLOCK_REGEX = /```(?:tsx|jsx|javascript|js)?\s*([\s\S]*?)```/i;

function extractCodeFromResponse(response: string): string {
  const codeBlockMatch = CODE_BLOCK_REGEX.exec(response);
  if (codeBlockMatch?.[1]) {
    return codeBlockMatch[1].trim();
  }

  const lines = response.split('\n');
  const probableStart = lines.findIndex((line) => {
    const trimmed = line.trim();
    return (
      trimmed.startsWith('import ') ||
      trimmed.startsWith('const ') ||
      trimmed.startsWith('function ') ||
      trimmed.startsWith('export ') ||
      trimmed.startsWith('class ')
    );
  });

  if (probableStart >= 0) {
    return lines.slice(probableStart).join('\n').trim();
  }

  return response.trim();
}

export { isCodexConfigured } from './codexClient';
