# Tasks for Epic: foundation

[Addresses: G-1, G-2, G-3 (enables all MVP goals)]

---

## Task Summary

| # | Task | Type | Risk | Dependencies |
|---|------|------|------|--------------|
| 1 | project-scaffolding | Technical | HOTL | none |
| 2 | config-module | Technical | HOTL | project-scaffolding |
| 3 | express-server | Technical | HOTL | project-scaffolding, config-module |
| 4 | mongodb-connection | Technical | HOTL | express-server, config-module |
| 5 | logging | Technical | HOTL | express-server |
| 6 | ci-cd-pipeline | Technical | HIC | project-scaffolding, express-server, mongodb-connection |

---

## Dependency Graph

```
project-scaffolding
    ├── config-module
    │       └── mongodb-connection
    │       └── express-server
    │               ├── mongodb-connection
    │               ├── logging
    │               └── ci-cd-pipeline
    └── ci-cd-pipeline
```

---

## Recommended Execution Order

1. **project-scaffolding** — No dependencies, must be first
2. **config-module** — Needs scaffolding for TypeScript
3. **express-server** — Needs config
4. **mongodb-connection** — Needs express + config
5. **logging** — Needs express server
6. **ci-cd-pipeline** — Needs all above for meaningful CI

---

## Cycle Coverage

| Phase | Coverage |
|-------|----------|
| **Design** | Each task has design.md requirement |
| **Implementation** | All source code in src/ |
| **Testing** | Unit tests for all modules; integration tests for server + DB |
| **Documentation** | ADR documents in docs/adr, .env.example |

---

## Estimated Effort

For a 24h hackathon with experienced developers:
- Tasks 1-2: Sequential (scaffolding then config)
- Tasks 3-4: Sequential, core integration work
- Tasks 5-6: Can be parallelized after server is up

**Critical path:** project-scaffolding → config-module → express-server → mongodb-connection → ci-cd-pipeline

---

## Task: project-scaffolding

**Type:** Technical Task
**Summary:** Initialize TypeScript/Node.js project with build tooling, linting, and test infrastructure.

**Risk:** HOTL — reversibility: high, consequence: isolated

[Addresses: G-1, G-2, G-3 (enables all MVP goals)]

### Description

Set up the foundational TypeScript project structure for the only-facts campaign detection pipeline. This includes package.json with all required dependencies, TypeScript configuration with strict mode, ESLint + Prettier for code quality, Jest for testing, and the directory structure outlined in best-practices.md. This task enables all subsequent development by providing the build, test, and lint infrastructure.

### Dependencies

- Depends on: none
- Blocks: config-module, express-server, logging, ci-cd-pipeline

### Acceptance Criteria

#### Functional Criteria (what the code must do)

- [ ] VERIFY: `package.json` exists with name "only-facts", scripts for `build`, `test`, `lint`, `format`, `dev`
- [ ] VERIFY: `tsconfig.json` exists with `strict: true`, `target: "ES2022"`, `module: "NodeNext"`, `outDir: "dist"`
- [ ] VERIFY: `.eslintrc.json` (or equivalent) exists with TypeScript support and no-any rule
- [ ] VERIFY: `.prettierrc` exists with consistent formatting rules
- [ ] VERIFY: `jest.config.js` (or ts) exists with ts-jest preset
- [ ] VERIFY: Directory structure exists: `src/config/`, `src/models/`, `src/services/`, `src/routes/`, `src/middleware/`, `src/utils/`, `src/types/`
- [ ] VERIFY: `tests/` directory exists with `unit/` and `integration/` subdirectories
- [ ] VERIFY: `.env.example` exists documenting required environment variables
- [ ] VERIFY: `src/index.ts` exists as application entry point (can be placeholder)

#### Boundary Criteria (what the code must NOT do)

- [ ] VERIFY: No `any` types in generated TypeScript files
- [ ] VERIFY: No hardcoded secrets or real credentials in any file
- [ ] VERIFY: `.gitignore` includes `node_modules/`, `dist/`, `.env`, `coverage/`

#### Verification Gates (automated checks that must pass)

- [ ] `npm install` completes without errors
- [ ] `npm run build` compiles TypeScript to `dist/` without errors
- [ ] `npm run lint` passes with zero errors
- [ ] `npm test` runs (can have zero tests initially, but must not error)
- [ ] `npx tsc --noEmit` passes type checking

#### Definition of Done

- [ ] Code is committed to main branch (trunk-based)
- [ ] All verification gates above are green
- [ ] Design doc exists at `docs/sdd/foundation/project-scaffolding/design.md`
- [ ] Test handoff exists at `docs/sdd/foundation/project-scaffolding/test-handoff.md`

---

## Task: config-module

**Type:** Technical Task
**Summary:** Create centralized configuration module for type-safe environment variable access with validation.

**Risk:** HOTL — reversibility: high, consequence: isolated

[Addresses: G-8 (env-based configuration, no secrets in codebase)]

### Description

Implement a centralized configuration module at `src/config/index.ts` that provides type-safe access to all environment variables. The module must validate required variables at startup, provide sensible defaults for optional variables, and export a frozen config object. This prevents direct `process.env` access throughout the codebase (as specified in best-practices.md) and ensures configuration errors are caught early.

### Dependencies

- Depends on: project-scaffolding
- Blocks: express-server, mongodb-connection

### Acceptance Criteria

#### Functional Criteria (what the code must do)

- [ ] VERIFY: `src/config/index.ts` exists and exports a `config` object
- [ ] VERIFY: `config` object includes typed properties: `port` (number), `nodeEnv` (string), `mongoUri` (string), `logLevel` (string)
- [ ] VERIFY: Config values are read from `process.env` with fallback defaults: `PORT=3000`, `NODE_ENV=development`, `LOG_LEVEL=debug`
- [ ] VERIFY: `MONGO_URI` is required — module throws `ConfigurationError` if missing in production (`NODE_ENV=production`)
- [ ] VERIFY: Config object is frozen (`Object.freeze` or `as const` assertion)
- [ ] VERIFY: A `ConfigurationError` class exists in `src/utils/errors.ts` or `src/config/errors.ts`
- [ ] VERIFY: `validateConfig()` function exists and is called on module load

#### Boundary Criteria (what the code must NOT do)

- [ ] VERIFY: No `any` types in the config module
- [ ] VERIFY: No direct `process.env` access outside `src/config/` directory
- [ ] VERIFY: No hardcoded secrets or credentials in any file

#### Verification Gates (automated checks that must pass)

- [ ] `npm run build` compiles without errors
- [ ] `npm run lint` passes with zero errors
- [ ] `npm test` passes — config module unit tests exist and pass
- [ ] `npx tsc --noEmit` passes type checking
- [ ] Unit tests cover: valid config, missing required env var, default values

#### Definition of Done

- [ ] All verification gates above are green
- [ ] Design doc exists at `docs/sdd/foundation/config-module/design.md`
- [ ] Test handoff exists at `docs/sdd/foundation/config-module/test-handoff.md`

---

## Task: express-server

**Type:** Technical Task
**Summary:** Create Express.js HTTP server with health endpoint, graceful shutdown, and standardized API response envelope.

**Risk:** HOTL — reversibility: high, consequence: isolated

[Addresses: G-1, G-2 (enables API layer for signal ingestion and report generation)]

### Description

Implement the core Express.js HTTP server that will host all API endpoints for the campaign detection pipeline. The server must use the centralized config module for port configuration, implement a health check endpoint for container orchestration, support graceful shutdown for zero-downtime deployments, and establish the standardized API response envelope pattern. This task provides the HTTP foundation for all subsequent API development.

### Dependencies

- Depends on: project-scaffolding, config-module
- Blocks: mongodb-connection, logging, ci-cd-pipeline

### Acceptance Criteria

#### Functional Criteria (what the code must do)

- [ ] VERIFY: `src/app.ts` exists and exports an Express application instance (not started)
- [ ] VERIFY: `src/index.ts` imports the app and starts the server using `config.port`
- [ ] VERIFY: Health endpoint `GET /health` exists and returns `{ success: true, data: { status: "ok" } }`
- [ ] VERIFY: Health endpoint returns HTTP 200 status code
- [ ] VERIFY: All API responses follow the envelope pattern: `{ success: boolean, data?: T, error?: { code: string, message: string } }`
- [ ] VERIFY: Server logs startup message with port number using `console.log` (logging module not yet available)
- [ ] VERIFY: Graceful shutdown handler exists for `SIGTERM` and `SIGINT` signals
- [ ] VERIFY: Graceful shutdown closes the HTTP server and exits with code 0
- [ ] VERIFY: `src/types/api.ts` exports `ApiResponse<T>` interface matching the envelope pattern
- [ ] VERIFY: `src/middleware/error-handler.ts` exists with global error handling middleware

#### Boundary Criteria (what the code must NOT do)

- [ ] VERIFY: No `any` types in server code
- [ ] VERIFY: Server does not start automatically on module import (app.ts exports app, index.ts starts it)
- [ ] VERIFY: No hardcoded port values — must use `config.port`
- [ ] VERIFY: No direct `process.env` access — must use config module
- [ ] VERIFY: Error handler does not expose stack traces in production (`NODE_ENV=production`)

#### Verification Gates (automated checks that must pass)

- [ ] `npm run build` compiles without errors
- [ ] `npm run lint` passes with zero errors
- [ ] `npm test` passes — server tests exist and pass
- [ ] `npx tsc --noEmit` passes type checking
- [ ] Unit tests cover: app creation, health endpoint response
- [ ] Integration tests cover: health endpoint HTTP request/response, error handling middleware

#### Definition of Done

- [ ] All verification gates above are green
- [ ] Design doc exists at `docs/sdd/foundation/express-server/design.md`
- [ ] Test handoff exists at `docs/sdd/foundation/express-server/test-handoff.md`
