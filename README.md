# Rapid Prototyper

## Development Stack

Install dependencies with `npm install`, replicate env vars from `.env.sample`, then boot the entire stack (migrations + seed + API + UI with tailed logs) via:

```bash
npm run dev:stack
```

The script prints clickable URLs once servers are ready and stores prefixed logs under `.logs/` so you can trace activity per service.

## Current Scope

The project currently ships through **Iteration 3 (Codex orchestration)**. Prompt cards will show a `Ready` badge once the worker compiles JSX, but the preview/launch UI from Iteration 4 is intentionally deferred, so there is no in-app rendering yet.
