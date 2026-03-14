# Tasks for Epic: foundation

[Addresses: G-1, G-2, G-3 (enables all MVP goals)]

---

## Task Summary

| # | Task | Type | Risk | Dependencies |
|---|------|------|------|--------------|
| 1 | project-scaffolding | Technical | HOTL | none |
| 2 | config-module | Technical | HOTL | project-scaffolding |
| 3 | task-3-error-handling.md | Technical | HOTL | project-scaffolding |
| 4 | express-server | Technical | HOTL | project-scaffolding, config-module, error-handling |
| 5 | mongodb-connection | Technical | HOTL | express-server, config-module |
| 6 | logging | Technical | HOTL | express-server |
| 7 | ci-cd-pipeline | Technical | HIC | project-scaffolding, express-server, mongodb-connection |

---

## Dependency Graph

```
project-scaffolding
    ├── config-module
    │       └── mongodb-connection
    ├── error-handling
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
3. **error-handling** — Needs scaffolding for TypeScript
4. **express-server** — Needs config + error handling
5. **mongodb-connection** — Needs express + config
6. **logging** — Needs express server
7. **ci-cd-pipeline** — Needs all above for meaningful CI

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
- Tasks 1-3: Can be parallelized after scaffolding
- Tasks 4-5: Sequential, core integration work
- Tasks 6-7: Can be parallelized

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
- Blocks: config-module, error-handling, express-server, logging, ci-cd-pipeline

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
