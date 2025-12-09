import { config } from '../config';
import { logError, logInfo } from '../logger';
import {
  findPromptsAwaitingBuild,
  markPromptBuilding,
  markPromptFailed,
  savePromptBuildResult
} from '../repositories/promptRepository';
import { recordPromptEvent } from '../repositories/promptEventRepository';
import { runPromptThroughCodex, isCodexConfigured } from '../services/codexService';
import { compileJsxToSandboxedJs } from '../services/babelCompiler';
import { Prompt } from '../types';

const pollIntervalMs = config.worker.pollIntervalMs;
const batchSize = config.worker.batchSize;
let warnedAboutConfig = false;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildPreviewSlug(promptId: string): string {
  const compact = promptId.replace(/[^a-z0-9]/gi, '').slice(0, 12);
  return `preview-${compact || promptId.slice(0, 8)}`;
}

function buildSandboxConfig() {
  return {
    runtime: 'react18',
    allowedGlobals: ['React', 'useState', 'useEffect'],
    compiledAt: new Date().toISOString()
  };
}

async function processPrompt(prompt: Prompt) {
  logInfo('Codex worker: picked prompt', {
    promptId: prompt.id,
    status: prompt.status
  });

  await recordPromptEvent(prompt.id, 'info', 'Codex worker: processing prompt', {
    status: prompt.status
  });

  try {
    await markPromptBuilding(prompt.id);
    logInfo('Codex worker: marked prompt building', { promptId: prompt.id });
    const { threadId, jsx } = await runPromptThroughCodex(prompt.prompt_text, prompt.codex_task_id);
    if (prompt.codex_task_id !== threadId) {
      await markPromptBuilding(prompt.id, threadId);
    }

    logInfo('Codex worker received JSX', {
      promptId: prompt.id,
      threadId,
      jsx
    });

    await recordPromptEvent(prompt.id, 'info', 'Codex worker: JSX received', {
      threadId
    });

    const compiledJs = await compileJsxToSandboxedJs(jsx);
    const previewSlug = prompt.preview_slug ?? buildPreviewSlug(prompt.id);
    const sandboxConfig = buildSandboxConfig();

    await savePromptBuildResult(prompt.id, {
      jsxSource: jsx,
      compiledJs,
      previewSlug,
      sandboxConfig
    });

    await recordPromptEvent(prompt.id, 'info', 'Codex worker: prompt ready', {
      previewSlug
    });
    logInfo('Prompt build completed', { promptId: prompt.id, previewSlug });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Codex error';
    await markPromptFailed(prompt.id, message);
    await recordPromptEvent(prompt.id, 'error', 'Codex worker: build failed', {
      error: message
    });
    logError('Prompt build failed', { promptId: prompt.id, error: message });
  }
}

async function tick() {
  if (!isCodexConfigured()) {
    if (!warnedAboutConfig) {
      logInfo('Codex worker idle: OPENAI_API_KEY is not configured');
      warnedAboutConfig = true;
    }
    return;
  }

  warnedAboutConfig = false;

  const prompts = await findPromptsAwaitingBuild(batchSize);
  logInfo('Codex worker: poll tick', { found: prompts.length });
  if (prompts.length === 0) {
    return;
  }

  for (const prompt of prompts) {
    await processPrompt(prompt);
  }
}

async function runLoop() {
  logInfo('Codex worker started', {
    pollIntervalMs,
    batchSize
  });

  while (true) {
    try {
      await tick();
    } catch (error) {
      logError('Codex worker tick failed', {
        error: error instanceof Error ? error.message : error
      });
    }
    await sleep(pollIntervalMs);
  }
}

runLoop().catch((error) => {
  logError('Codex worker crashed', { error: error instanceof Error ? error.message : error });
  process.exitCode = 1;
});
