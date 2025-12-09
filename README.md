# Rapid Prototyper

## Development Stack

Install dependencies with `npm install`, replicate env vars from `.env.sample`, then boot the entire stack (migrations + seed + API + UI with tailed logs) via:

```bash
npm run dev:stack
```

The script prints clickable URLs once servers are ready and stores prefixed logs under `.logs/` so you can trace activity per service.
