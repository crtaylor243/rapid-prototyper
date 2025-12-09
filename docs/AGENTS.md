# AI & Human Agents
This matrix captures the key agents (AI copilots or human owners) that execute the roadmap in `docs/PLAN.md`. Each agent is mapped to the iterations they unlock along with success criteria and hand-offs.

## Delivery Lead Agent
- **Iterations**: All (maintains continuity as phases progress).
- **Inputs**: PLAN.md roadmap, backlog, stakeholder priorities.
- **Responsibilities**: Sequence work, update PLAN/AGENTS docs as the scope evolves, negotiate trade-offs, and ensure each iteration ships as a reviewable vertical slice.
- **Outputs/Handoffs**: Sprint goals, iteration acceptance notes, presentation outlines for demos.

## Scaffolding Engineer Agent
- **Iterations**: Iteration 0.
- **Inputs**: Repo access, Docker/Postgres tooling, `.env.sample` spec.
- **Responsibilities**: Create monorepo layout, Docker Compose stack, seed migrations, baseline Express + React apps, and smoke tests that confirm login succeeds with the seeded password.
- **Outputs/Handoffs**: Working `docker compose up`, CLI scripts for migrations/seeds, documentation on how to log in with the default admin account.

## Auth & API Agent
- **Iterations**: Iteration 1 and the foundational API pieces in Iteration 2.
- **Inputs**: Scaffolding baseline, DB schema, security requirements.
- **Responsibilities**: Implement secure login/logout endpoints, CSRF/JWT/session layers, user repository tests, and CI workflows that enforce lint + auth coverage.
- **Outputs/Handoffs**: Hardened auth services/APIs, failing test cases for uncovered flows, CI badges that downstream agents can trust.

## Prompt Workflow Agent
- **Iterations**: Iteration 2 (Prompt Submission & History).
- **Inputs**: Authenticated API/UI shell, DB access, prompt schema definition.
- **Responsibilities**: Build `/prompts` endpoints, UI forms/cards, title generation service (mock or real), and worker metadata for Codex tasks while ensuring tests cover persistence and history retrieval.
- **Outputs/Handoffs**: Prompt CRUD contracts, sample payloads/fixtures, and UI elements ready for Codex/GitHub wiring.

## Codex & GitHub Automation Agent
- **Iterations**: Iteration 3.
- **Inputs**: Prompt workflow data, Codex SDK credentials, GitHub App secrets, CI pipeline hooks.
- **Responsibilities**: Integrate Codex SDK thread lifecycle, manage GitHub branch/PR automation, orchestrate background workers that poll Codex and GitHub Actions, and store deployment URLs + failure logs.
- **Outputs/Handoffs**: Worker services, credential management guides, feature flags or toggles for external calls, and telemetry hooks for downstream UI rendering.

## Preview Experience Agent
- **Iterations**: Iteration 4.
- **Inputs**: Prompt status APIs, Babel standalone config, UI component library.
- **Responsibilities**: Elevate prompt cards with status badges/logs, implement the preview/launch detail views, sandbox Babel-rendered React components, and deliver real-time updates (polling or WebSockets).
- **Outputs/Handoffs**: Accessible UI flows, QA scripts for preview rendering, and guidance for demo presenters.

## Ops & Observability Agent
- **Iterations**: Iteration 5.
- **Inputs**: End-to-end system, deployment environments, logging/metrics stack.
- **Responsibilities**: Instrument API/workers with telemetry, configure alerting, manage feature flags, document AI/human fallback procedures, and polish UX (error states, retries).
- **Outputs/Handoffs**: Runbooks, dashboards, alert configs, and final readiness checklist for production demos.
