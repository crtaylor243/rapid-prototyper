import { Router } from 'express';
import { csrfGuard } from '../security';
import { requireAuth } from '../middleware/requireAuth';
import {
  createPrompt,
  deletePrompt,
  findPromptByIdForUser,
  listPromptsForUser
} from '../repositories/promptRepository';
import { generatePromptTitle } from '../services/titleGenerator';
import { logError, logInfo } from '../logger';
import { Prompt, PromptEvent } from '../types';
import { listPromptEvents, listPromptEventsForPrompts } from '../repositories/promptEventRepository';

const router = Router();

interface PromptResponse {
  id: string;
  title: string;
  promptText: string;
  status: Prompt['status'];
  updatedAt: string;
  previewSlug: string | null;
  renderError: string | null;
  events: PromptEventResponse[];
}

interface PromptEventResponse {
  id: string;
  level: PromptEvent['level'];
  message: string;
  context: Record<string, unknown> | null;
  createdAt: string;
}

interface PromptDetailResponse extends PromptResponse {
  createdAt: string;
  jsxSource: string | null;
  compiledJs: string | null;
  sandboxConfig: Record<string, unknown> | null;
}

function serializePromptEvent(event: PromptEvent): PromptEventResponse {
  return {
    id: event.id,
    level: event.level,
    message: event.message,
    context: event.context,
    createdAt: event.created_at.toISOString()
  };
}

function serializePrompt(prompt: Prompt, events: PromptEvent[] = []): PromptResponse {
  return {
    id: prompt.id,
    title: prompt.title,
    promptText: prompt.prompt_text,
    status: prompt.status,
    updatedAt: prompt.updated_at.toISOString(),
    previewSlug: prompt.preview_slug,
    renderError: prompt.render_error,
    events: events.map(serializePromptEvent)
  };
}

function serializePromptDetail(prompt: Prompt, events: PromptEvent[]): PromptDetailResponse {
  return {
    ...serializePrompt(prompt, events),
    createdAt: prompt.created_at.toISOString(),
    jsxSource: prompt.jsx_source,
    compiledJs: prompt.compiled_js,
    sandboxConfig: prompt.sandbox_config
  };
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const prompts = await listPromptsForUser(req.user!.id);
    const promptEvents = await listPromptEventsForPrompts(prompts.map((prompt) => prompt.id));
    res.json({
      prompts: prompts.map((prompt) => serializePrompt(prompt, promptEvents.get(prompt.id) ?? []))
    });
  } catch (error) {
    logError('Failed to list prompts', { error, userId: req.user!.id });
    res.status(500).json({ message: 'Unable to load prompt history' });
  }
});

router.post('/', requireAuth, csrfGuard, async (req, res) => {
  const { promptText } = req.body as { promptText?: string };
  if (!promptText || !promptText.trim()) {
    return res.status(400).json({ message: 'Prompt text is required' });
  }

  try {
    const title = await generatePromptTitle(promptText);
    const prompt = await createPrompt({
      userId: req.user!.id,
      promptText,
      title
    });
    logInfo('Prompt created', { promptId: prompt.id, userId: req.user!.id });
    res.status(201).json({ prompt: serializePrompt(prompt) });
  } catch (error) {
    logError('Failed to create prompt', { error, userId: req.user!.id });
    res.status(500).json({ message: 'Unable to create prompt' });
  }
});

router.get('/:promptId', requireAuth, async (req, res) => {
  const { promptId } = req.params;

  try {
    const prompt = await findPromptByIdForUser(promptId, req.user!.id);
    if (!prompt) {
      return res.status(404).json({ message: 'Prompt not found' });
    }

    const events = await listPromptEvents(promptId, 20);
    return res.json({ prompt: serializePromptDetail(prompt, events) });
  } catch (error) {
    logError('Failed to fetch prompt detail', { error, promptId, userId: req.user!.id });
    return res.status(500).json({ message: 'Unable to load prompt' });
  }
});

router.delete('/:promptId', requireAuth, csrfGuard, async (req, res) => {
  const { promptId } = req.params;
  try {
    const deleted = await deletePrompt(promptId, req.user!.id);
    if (deleted === 0) {
      return res.status(404).json({ message: 'Prompt not found' });
    }

    logInfo('Prompt deleted', { promptId, userId: req.user!.id });
    return res.status(204).send();
  } catch (error) {
    logError('Failed to delete prompt', { error, promptId, userId: req.user!.id });
    return res.status(500).json({ message: 'Unable to delete prompt' });
  }
});

export default router;
