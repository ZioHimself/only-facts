# AGENTS.md
<!-- This file orients AI agents working in this repository. Keep it under 200 lines. -->

## Project Overview

**only-facts** is an automated pipeline that identifies coordinated inauthentic campaigns through cross-platform signal analysis and established threat intelligence sources.
It constructs evidence chains, files reports to platform trust and safety channels, and documents platform responses for regulatory compliance.
Internal service accessed via private VPC port-forwarding.

## Architecture

- **API Layer** — Express.js REST endpoints for signal ingestion and report generation
- **Analysis Engine** — Campaign detection and evidence chain construction
- **Data Store** — MongoDB for flexible document storage (campaigns, evidence, reports)
- **Integrations** — Platform APIs, threat intel sources, trust & safety channels

Data flow: Signals → Analysis → Evidence Chain → Report → Platform/Government Dossier

Deployment: Internal service, private VPC, port-forwarding access

## Key Directories

| Directory | Contains |
|-----------|----------|
| `src/` | Production source code |
| `src/routes/` | Express route handlers |
| `src/models/` | Mongoose models |
| `src/services/` | Business logic |
| `tests/` | Test files |
| `docs/` | Project documentation |
| `.claude/` | SDD framework files (DO NOT MODIFY) |

## Build, Test, Run

| Action | Command |
|--------|---------|
| Install | `npm install` |
| Build | `npm run build` |
| Test (all) | `npm test` |
| Test (single file) | `npx jest {file}` |
| Test (coverage) | `npm run test:coverage` |
| Lint | `npm run lint` |
| Lint (single file) | `npx eslint {file}` |
| Format | `npm run format` |
| Format (single file) | `npx prettier --write {file}` |
| Type check | `npx tsc --noEmit` |
| Run locally | `npm run dev` |

## Tech Stack

- **Language:** TypeScript ^5.0
- **Runtime:** Node.js ^20.x LTS
- **Framework:** Express
- **Database:** MongoDB with Mongoose ODM
- **Test framework:** Jest with ts-jest, Supertest
- **Linting:** ESLint
- **Formatting:** Prettier

## Coding Conventions

- Use async/await for all asynchronous operations
- Error handling uses typed error classes, not raw throw
- Database access only through Mongoose models in `src/models/`
- All API responses follow consistent envelope: `{ success, data?, error? }`
- Environment variables accessed through a config module, never directly

## Forbidden Patterns

- NEVER use `any` type — use `unknown` and narrow, or define proper types
- NEVER commit `.env` files or secrets
- NEVER use callbacks for async operations — use async/await
- NEVER access `process.env` directly outside config module
- NEVER modify files in `.claude/` or `sdd-config.yaml` protected files

## Agent-Specific Guidance

- When creating new files, use kebab-case for filenames: `campaign-analyzer.ts`
- When modifying existing code, match the style of the surrounding code exactly
- If a task is ambiguous, flag it as an escalate-level gap — do not guess
- All SDD pipeline artifacts go under `docs/sdd/{epic}/{task}/`
- This is a 24h hackathon — prioritize working code over perfection
- Keep implementations minimal and focused on core functionality

## External Dependencies and APIs

- **Platform APIs** — Social media platform APIs for signal collection (TBD)
- **Threat Intel Sources** — External threat intelligence feeds (TBD)
- **Trust & Safety Channels** — Platform reporting endpoints (TBD)

## Known Gotchas

- Project is greenfield — no source code exists yet
- MongoDB connection requires local instance or connection string in `.env`
- Tests require MongoDB (consider mongodb-memory-server for isolation)
