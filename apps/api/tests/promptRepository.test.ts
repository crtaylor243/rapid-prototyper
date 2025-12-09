import assert from 'node:assert/strict';
import { db } from '../src/db';
import {
  createPrompt,
  deletePrompt,
  listPromptsForUser,
  findPromptsAwaitingBuild,
  markPromptBuilding,
  markPromptFailed,
  savePromptBuildResult
} from '../src/repositories/promptRepository';
import { findUserByEmail } from '../src/repositories/userRepository';
import { generatePromptTitle } from '../src/services/titleGenerator';
import { resetDatabase } from './helpers';

async function shouldSeedPromptHistory() {
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@example.com';
  const admin = await findUserByEmail(adminEmail);
  assert(admin, 'Seeded admin user should exist');

  const prompts = await listPromptsForUser(admin.id);
  assert(prompts.length >= 1, 'Seed should attach prompt history to each user');
}

async function shouldCreateAndDeletePrompt() {
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@example.com';
  const admin = await findUserByEmail(adminEmail);
  assert(admin, 'Seeded admin user should exist');

  const promptText = 'Compose a notifications center with unread badges';
  const created = await createPrompt({
    userId: admin.id,
    promptText,
    title: generatePromptTitle(promptText)
  });

  assert.equal(created.prompt_text, promptText, 'Prompt text should be stored as provided');

  const prompts = await listPromptsForUser(admin.id);
  assert(prompts.some((prompt) => prompt.id === created.id), 'Prompt history should include the new entry');

  const deleted = await deletePrompt(created.id, admin.id);
  assert.equal(deleted, 1, 'Prompt should be deleted for the owning user');
}

async function shouldPersistBuildLifecycle() {
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@example.com';
  const admin = await findUserByEmail(adminEmail);
  assert(admin, 'Seeded admin user should exist');

  const prompt = await createPrompt({
    userId: admin.id,
    promptText: 'Compose a control center layout',
    title: 'Control center'
  });

  const [pending] = await findPromptsAwaitingBuild(1);
  assert.equal(pending.id, prompt.id, 'Prompt should await build work');

  await markPromptBuilding(prompt.id, 'thread-123');
  await savePromptBuildResult(prompt.id, {
    jsxSource: '<App />',
    compiledJs: 'function App() { return null; }',
    previewSlug: 'preview-slug',
    sandboxConfig: { mode: 'sandbox' }
  });

  const [updated] = await listPromptsForUser(admin.id);
  assert.equal(updated.status, 'ready', 'Prompt should be marked ready after build result');
  assert.equal(updated.compiled_js, 'function App() { return null; }');
  assert.equal(updated.preview_slug, 'preview-slug');
  assert(updated.sandbox_config !== null, 'Sandbox config should persist');

  await markPromptFailed(prompt.id, 'Sample error');
  const [failed] = await listPromptsForUser(admin.id);
  assert.equal(failed.status, 'failed', 'Prompt should transition to failed');
  assert(failed.render_error?.includes('Sample error'), 'Failure reason should be stored');
}

async function run() {
  await resetDatabase();
  await shouldSeedPromptHistory();
  await shouldCreateAndDeletePrompt();
  await shouldPersistBuildLifecycle();
  console.log('Prompt repository tests passed');
}

run()
  .catch((error) => {
    console.error('Prompt repository tests failed');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.destroy();
  });
