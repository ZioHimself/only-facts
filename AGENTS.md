# AGENTS.md
<!-- This file orients AI agents working in this repository. Keep it under 200 lines. -->

## Project Overview

**only-facts** is an automated pipeline that identifies coordinated inauthentic campaigns through cross-platform signal analysis and established threat intelligence sources.
It constructs evidence chains, files reports to platform trust and safety channels, and documents platform responses for regulatory compliance.
Internal service accessed via private VPC port-forwarding.

## Monorepo Structure

This is an npm workspaces monorepo with the following packages:

| Package | Description |
|---------|-------------|
| `@only-facts/engine` | Backend API — scraping, normalizing, analyzing signals |
| `@only-facts/reports` | Frontend — reporting dashboard (Next.js) — *planned* |

## Architecture

- **Engine** (`packages/engine/`) — Express.js API for signal ingestion, analysis, and campaign detection
- **Reports** (`packages/reports/`) — Next.js dashboard for viewing reports and evidence chains (planned)
- **Data Store** — MongoDB for flexible document storage (campaigns, evidence, reports)
- **Integrations** — Platform APIs, threat intel sources, trust & safety channels

Data flow: Signals → Analysis → Evidence Chain → Report → Platform/Government Dossier

Deployment: Internal service, private VPC, port-forwarding access

## Key Directories

| Directory | Contains |
|-----------|----------|
| `packages/engine/src/` | Engine production source code |
| `packages/engine/src/routes/` | Express route handlers |
| `packages/engine/src/models/` | Mongoose models |
| `packages/engine/src/services/` | Business logic |
| `packages/engine/tests/` | Engine test files |
| `docs/` | Project documentation (shared) |
| `.claude/` | SDD framework files (DO NOT MODIFY) |

## Build, Test, Run

| Action | Command |
|--------|---------|
| Install | `npm install` (from workspace root) |
| Build (all) | `npm run build` |
| Build (engine) | `npm run build -w @only-facts/engine` |
| Test (all) | `npm test` |
| Test (engine) | `npm test -w @only-facts/engine` |
| Test (single file) | `npm test -w @only-facts/engine -- {file}` |
| Test (coverage) | `npm run test:coverage` |
| Lint | `npm run lint` |
| Format | `npm run format` |
| Run engine locally | `npm run dev:engine` |

## Tech Stack

- **Language:** TypeScript ^5.0
- **Runtime:** Node.js ^20.x LTS
- **Framework:** Express
- **Database:** MongoDB with Mongoose ODM
- **Test framework:** Jest with ts-jest, Supertest
- **Linting:** ESLint
- **Formatting:** Prettier
- **Infrastructure:** Terraform (GCP, GKE, Artifact Registry)
- **CI/CD:** GitHub Actions (lint, test, build + terraform apply on main)

## Coding Conventions

- Use async/await for all asynchronous operations
- Error handling uses typed error classes, not raw throw
- Database access only through Mongoose models in `packages/engine/src/models/`
- All API responses follow consistent envelope: `{ success, data?, error? }`
- Environment variables accessed through a config module, never directly

## Forbidden Patterns

- NEVER use `any` type — use `unknown` and narrow, or define proper types
- NEVER commit `.env` files or secrets
- NEVER use callbacks for async operations — use async/await
- NEVER access `process.env` directly outside config module
- NEVER modify files in `.claude/` or `sdd-config.yaml` protected files
- NEVER commit `.tfvars` files with secrets — use GitHub Actions secrets for sensitive values
- NEVER hardcode GCP project IDs or credentials in Terraform — use variables + GitHub Actions secrets

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

- This is a monorepo — run commands from workspace root, not package directories
- Always use workspace flag `-w @only-facts/engine` when targeting a specific package
- MongoDB connection requires local instance or connection string in `.env`
- Tests use mongodb-memory-server for isolation (no external MongoDB needed)
- Shared configs (`.prettierrc`, `.env.example`, `.gitignore`) are at workspace root
