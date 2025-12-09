import type { Codex } from '@openai/codex-sdk';
import { config } from '../config';

let codexClient: Codex | null = null;

async function loadCodexModule() {
  const dynamicImport = new Function('specifier', 'return import(specifier);') as (
    specifier: string
  ) => Promise<typeof import('@openai/codex-sdk')>;
  return dynamicImport('@openai/codex-sdk');
}

export function isCodexConfigured(): boolean {
  return Boolean(config.openAiApiKey);
}

export async function getCodexClient(): Promise<Codex> {
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
