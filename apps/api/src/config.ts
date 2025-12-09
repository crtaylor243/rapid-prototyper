import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

function loadEnvFiles() {
  const repoRoot = path.resolve(__dirname, '../../..');
  const envPath = path.join(repoRoot, '.env');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  } else {
    dotenv.config();
  }
}

loadEnvFiles();

const required = ['DATABASE_URL', 'SESSION_SECRET'];
required.forEach((key) => {
  if (!process.env[key]) {
    console.warn(`[config] Missing environment variable ${key}. Using fallback value where possible.`);
  }
});

const env = process.env.NODE_ENV ?? 'development';
const defaultDbUrl = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5433/rapid_prototype';
const testDbUrl = process.env.TEST_DATABASE_URL ?? defaultDbUrl;
const defaultSystemPrompt = `You are an expert React engineer helping designers instantly prototype UI ideas.
Create a complete, self-contained React component named App. Avoid patches or diffs.
Only output runnable React code with necessary imports.`;

export const config = {
  env,
  port: Number(process.env.PORT ?? 4000),
  dbUrl: env === 'test' ? testDbUrl : defaultDbUrl,
  sessionSecret: process.env.SESSION_SECRET ?? 'dev-secret',
  sessionCookieName: process.env.SESSION_COOKIE_NAME ?? 'rp_session',
  csrfCookieName: process.env.CSRF_COOKIE_NAME ?? 'rp_csrf',
  corsOrigins: (process.env.CORS_ALLOWED_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  adminEmail: process.env.ADMIN_EMAIL ?? 'admin@example.com',
  adminPassword: process.env.ADMIN_PASSWORD ?? 'changeme',
  openAiApiKey: process.env.OPENAI_API_KEY ?? '',
  codexOrg: process.env.CODEX_ORG ?? '',
  codexSystemPrompt: process.env.CODEX_SYSTEM_PROMPT ?? defaultSystemPrompt,
  codexTitleModel: process.env.CODEX_TITLE_MODEL ?? 'o4-mini',
  worker: {
    pollIntervalMs: Number(process.env.CODEX_WORKER_POLL_MS ?? 5000),
    batchSize: Number(process.env.CODEX_WORKER_BATCH_SIZE ?? 2)
  }
};
