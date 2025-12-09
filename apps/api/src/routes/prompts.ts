import { Router } from 'express';
import { csrfGuard } from '../security';
import { requireAuth } from '../middleware/requireAuth';
import { createPrompt, deletePrompt, listPromptsForUser } from '../repositories/promptRepository';
import { generatePromptTitle } from '../services/titleGenerator';
import { logError, logInfo } from '../logger';
import { Prompt } from '../types';

const router = Router();

interface PromptResponse {
  id: string;
  title: string;
  promptText: string;
  status: Prompt['status'];
  updatedAt: string;
}

function serializePrompt(prompt: Prompt): PromptResponse {
  return {
    id: prompt.id,
    title: prompt.title,
    promptText: prompt.prompt_text,
    status: prompt.status,
    updatedAt: prompt.updated_at.toISOString()
  };
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const prompts = await listPromptsForUser(req.user!.id);
    res.json({ prompts: prompts.map(serializePrompt) });
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
    const prompt = await createPrompt({
      userId: req.user!.id,
      promptText,
      title: generatePromptTitle(promptText)
    });
    logInfo('Prompt created', { promptId: prompt.id, userId: req.user!.id });
    res.status(201).json({ prompt: serializePrompt(prompt) });
  } catch (error) {
    logError('Failed to create prompt', { error, userId: req.user!.id });
    res.status(500).json({ message: 'Unable to create prompt' });
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
