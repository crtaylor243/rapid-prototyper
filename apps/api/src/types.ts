export interface User {
  id: string;
  email: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
  last_login_at: Date | null;
}

export type PromptStatus = 'pending' | 'building' | 'ready' | 'failed';

export interface Prompt {
  id: string;
  user_id: string;
  title: string;
  prompt_text: string;
  status: PromptStatus;
  codex_task_id: string | null;
  jsx_source: string | null;
  compiled_js: string | null;
  preview_slug: string | null;
  render_error: string | null;
  sandbox_config: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

export interface PromptEvent {
  id: string;
  prompt_id: string;
  level: 'info' | 'error';
  message: string;
  context: Record<string, unknown> | null;
  created_at: Date;
}
