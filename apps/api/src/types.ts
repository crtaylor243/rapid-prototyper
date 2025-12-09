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
  created_at: Date;
  updated_at: Date;
}
