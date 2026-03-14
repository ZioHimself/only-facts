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
| **Implementation** | All source code in src/, infrastructure in infra/ |
| **Testing** | Unit tests for all modules; integration tests for server + DB; Terraform validation |
| **Documentation** | ADR documents in docs/adr, .env.example, terraform.tfvars.example |

---

## Estimated Effort

For a 24h hackathon with experienced developers:
- Tasks 1-2: Sequential (scaffolding then config)
- Tasks 3-4: Sequential, core integration work
- Task 5: Logging, can run in parallel after server is up
- Task 6: CI/CD pipeline + Terraform infrastructure (expanded scope — includes full GCP/GKE IaC)

**Critical path:** project-scaffolding → config-module → express-server → mongodb-connection → ci-cd-pipeline

**Note:** Task 6 (ci-cd-pipeline) now includes Terraform infrastructure-as-code for GCP/GKE deployment. This is larger than a typical CI-only task but bundles related DevOps work together.

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

---

## Task: mongodb-connection

**Type:** Technical Task
**Summary:** Create MongoDB connection module with Mongoose ODM, connection pooling, health integration, and graceful shutdown.

**Risk:** HOTL — reversibility: high, consequence: isolated

[Addresses: G-1, G-2 (enables data persistence for campaigns, evidence, and reports)]

### Description

Implement a MongoDB connection module using Mongoose ODM that integrates with the existing config module and Express server. The module must establish a connection pool at application startup, expose connection status for health checks, and cleanly disconnect during graceful shutdown. This provides the data persistence layer for all subsequent models (campaigns, evidence, reports) and follows the project conventions of centralized configuration and typed interfaces.

### Dependencies

- Depends on: express-server, config-module
- Blocks: ci-cd-pipeline (needs DB for meaningful integration tests)

### Acceptance Criteria

#### Functional Criteria (what the code must do)

- [ ] VERIFY: `src/db/index.ts` exists and exports `connectDB()` async function
- [ ] VERIFY: `connectDB()` uses `config.mongoUri` for the connection string (no direct `process.env` access)
- [ ] VERIFY: `connectDB()` configures Mongoose with connection options: `maxPoolSize: 10`, `serverSelectionTimeoutMS: 5000`
- [ ] VERIFY: `connectDB()` returns a Promise that resolves on successful connection
- [ ] VERIFY: `connectDB()` throws `DatabaseConnectionError` on connection failure (defined in `src/utils/errors.ts`)
- [ ] VERIFY: `disconnectDB()` async function exists and closes the Mongoose connection
- [ ] VERIFY: `getConnectionStatus()` function exists and returns `{ connected: boolean, readyState: number }`
- [ ] VERIFY: `src/index.ts` calls `connectDB()` before starting the Express server
- [ ] VERIFY: Graceful shutdown handler calls `disconnectDB()` before exiting
- [ ] VERIFY: Health endpoint (`GET /health`) includes database connection status in response: `{ success: true, data: { status: "ok", db: { connected: boolean } } }`

#### Boundary Criteria (what the code must NOT do)

- [ ] VERIFY: No `any` types in database module
- [ ] VERIFY: No hardcoded connection strings — must use `config.mongoUri`
- [ ] VERIFY: No direct `process.env` access — must use config module
- [ ] VERIFY: Connection errors do not crash the process silently — must be logged and thrown

#### Verification Gates (automated checks that must pass)

- [ ] `npm run build` compiles without errors
- [ ] `npm run lint` passes with zero errors
- [ ] `npm test` passes — database module tests exist and pass
- [ ] `npx tsc --noEmit` passes type checking
- [ ] Unit tests cover: `connectDB()` success, `connectDB()` failure, `disconnectDB()`, `getConnectionStatus()`
- [ ] Integration tests cover: health endpoint with DB status, graceful shutdown disconnects DB

#### Definition of Done

- [ ] All verification gates above are green
- [ ] Design doc exists at `docs/sdd/foundation/mongodb-connection/design.md`
- [ ] Test handoff exists at `docs/sdd/foundation/mongodb-connection/test-handoff.md`

---

## Task: logging

**Type:** Technical Task
**Summary:** Implement structured logging with Winston, request ID correlation, and log level configuration.

**Risk:** HOTL — reversibility: high, consequence: isolated

[Addresses: G-8 (operational observability for internal service)]

### Description

Implement a structured logging module using Winston that provides consistent JSON-formatted logs for all application components. The logger must support configurable log levels via the config module, correlate logs with request IDs for traceability, and integrate with Express middleware for automatic request/response logging. This replaces the temporary `console.log` statements with production-ready logging.

### Dependencies

- Depends on: express-server
- Blocks: none (optional enhancement for other tasks)

### Acceptance Criteria

#### Functional Criteria (what the code must do)

- [ ] VERIFY: `src/utils/logger.ts` exists and exports a configured Winston logger instance
- [ ] VERIFY: Logger uses `config.logLevel` for minimum log level (no direct `process.env` access)
- [ ] VERIFY: Logger outputs JSON format in production, pretty format in development
- [ ] VERIFY: Log entries include: `timestamp`, `level`, `message`, `requestId` (when available)
- [ ] VERIFY: `src/middleware/request-logger.ts` exists with Express middleware for request/response logging
- [ ] VERIFY: Request logger middleware assigns unique `requestId` to each request (UUID v4)
- [ ] VERIFY: Request logger logs: method, path, status code, response time in ms
- [ ] VERIFY: `src/index.ts` replaces `console.log` with logger calls

#### Boundary Criteria (what the code must NOT do)

- [ ] VERIFY: No `any` types in logger module
- [ ] VERIFY: No `console.log` statements remain in production code (except in logger implementation)
- [ ] VERIFY: No sensitive data (passwords, tokens) logged at any level

#### Verification Gates (automated checks that must pass)

- [ ] `npm run build` compiles without errors
- [ ] `npm run lint` passes with zero errors
- [ ] `npm test` passes — logger tests exist and pass
- [ ] `npx tsc --noEmit` passes type checking
- [ ] Unit tests cover: logger creation, log level filtering, JSON format output

#### Definition of Done

- [ ] All verification gates above are green
- [ ] Design doc exists at `docs/sdd/foundation/logging/design.md`
- [ ] Test handoff exists at `docs/sdd/foundation/logging/test-handoff.md`

---

## Task: ci-cd-pipeline

**Type:** Technical Task
**Summary:** Configure GitHub Actions CI/CD pipeline and Terraform infrastructure-as-code for GCP/GKE deployment.

**Risk:** HIC — reversibility: medium, consequence: team

[Addresses: G-8 (automated quality gates, infrastructure provisioning for internal VPC service)]

### Description

Set up a GitHub Actions CI/CD pipeline that runs on every push and pull request, plus Terraform infrastructure-as-code for GCP/GKE deployment. The CI pipeline must execute lint, type-check, test (with coverage), and build stages in sequence, failing fast on any error. The Terraform configuration must define the complete infrastructure for the internal VPC service: networking, GKE cluster, database connectivity, and internal load balancing. On merge to main, Terraform automatically applies infrastructure changes (continuous deployment).

### Dependencies

- Depends on: project-scaffolding, express-server, mongodb-connection
- Blocks: none (enables future CD stages and infrastructure provisioning)

### Acceptance Criteria

#### Functional Criteria — CI Pipeline (what the workflow must do)

- [ ] VERIFY: `.github/workflows/ci.yml` exists with valid GitHub Actions syntax
- [ ] VERIFY: Workflow triggers on `push` to `main` and on `pull_request`
- [ ] VERIFY: Workflow uses `ubuntu-latest` runner with Node.js 20.x
- [ ] VERIFY: Workflow includes step: `npm ci` (clean install)
- [ ] VERIFY: Workflow includes step: `npm run lint` (must pass)
- [ ] VERIFY: Workflow includes step: `npx tsc --noEmit` (type check, must pass)
- [ ] VERIFY: Workflow includes step: `npm run test:coverage` (must pass with coverage report)
- [ ] VERIFY: Workflow includes step: `npm run build` (must pass)
- [ ] VERIFY: Workflow uses `actions/cache` for `node_modules` with `package-lock.json` hash key
- [ ] VERIFY: Workflow fails if any step fails (fail-fast behavior)

#### Functional Criteria — Terraform Infrastructure (what the IaC must define)

- [ ] VERIFY: `infra/` directory exists at project root with Terraform configuration
- [ ] VERIFY: `infra/main.tf` exists with Google provider configuration (project, region parameterized)
- [ ] VERIFY: `infra/variables.tf` exists with input variables: `environment`, `gcp_project`, `gcp_region`, `app_port`, `mongo_uri` (sensitive)
- [ ] VERIFY: `infra/outputs.tf` exists with outputs: `gke_cluster_name`, `gke_cluster_endpoint`, `load_balancer_ip`
- [ ] VERIFY: VPC module/resource defines: custom VPC, private subnet, Cloud NAT for egress, firewall rules
- [ ] VERIFY: GKE cluster defined with: private nodes, workload identity enabled, release channel (REGULAR)
- [ ] VERIFY: GKE node pool defined with: autoscaling (1-3 nodes), preemptible/spot VMs for cost savings (configurable)
- [ ] VERIFY: Kubernetes namespace `only-facts` created via Terraform kubernetes provider
- [ ] VERIFY: Kubernetes Deployment manifest for `only-facts` container (image placeholder, port, env vars from Secret)
- [ ] VERIFY: Kubernetes Service (ClusterIP) and internal Ingress for load balancing within VPC
- [ ] VERIFY: GCP Service Account for GKE workload identity with permissions: Artifact Registry reader, Secret Manager accessor, Cloud Logging writer
- [ ] VERIFY: Artifact Registry repository for container images
- [ ] VERIFY: `infra/terraform.tfvars.example` exists documenting required variable values (no secrets)

#### Functional Criteria — Variable Management

- [ ] VERIFY: `infra/*.tfvars` pattern added to `.gitignore` (local override files excluded from git)
- [ ] VERIFY: `infra/terraform.tfvars.example` exists with placeholder values (no secrets)
- [ ] VERIFY: Sensitive variables (`mongo_uri`, service account keys) sourced from GitHub Actions secrets in CI/CD
- [ ] VERIFY: Non-sensitive variables (`environment`, `gcp_region`, `app_port`) defined in workflow or `infra/environments/*.tfvars` (committed)
- [ ] VERIFY: `infra/environments/` directory exists with `prod.tfvars` (non-sensitive values only)

#### Functional Criteria — Terraform CI/CD Workflow

- [ ] VERIFY: `.github/workflows/terraform.yml` exists with CI/CD workflow
- [ ] VERIFY: Terraform workflow triggers on changes to `infra/**` files
- [ ] VERIFY: On pull request: runs `terraform init`, `terraform validate`, `terraform fmt -check`, `terraform plan`
- [ ] VERIFY: On push to main: runs `terraform apply -auto-approve` after successful plan
- [ ] VERIFY: Workflow uses `google-github-actions/auth` for GCP authentication via Workload Identity Federation (preferred) or service account key
- [ ] VERIFY: Terraform state bucket and GCP project configured via GitHub Actions variables/secrets

#### Boundary Criteria (what the code must NOT do)

- [ ] VERIFY: No secrets or credentials hardcoded in workflow files or Terraform
- [ ] VERIFY: No `.tfvars` files with actual values committed to git (only `.tfvars.example` and `environments/*.tfvars` with non-sensitive defaults)
- [ ] VERIFY: No `continue-on-error: true` on quality gate steps (lint, typecheck, test, build, plan)
- [ ] VERIFY: Terraform state backend is configured for remote state (GCS bucket) — bucket name sourced from GitHub Actions variables
- [ ] VERIFY: No public ingress rules — GKE nodes are private, Ingress is internal-only
- [ ] VERIFY: Sensitive variables marked with `sensitive = true` in Terraform
- [ ] VERIFY: GKE master authorized networks restricted to VPC CIDR (no public access)
- [ ] VERIFY: `terraform apply` only runs on main branch (not on PRs)

#### Verification Gates (automated checks that must pass)

- [ ] CI workflow YAML is valid (GitHub Actions syntax)
- [ ] Local simulation: `npm ci && npm run lint && npx tsc --noEmit && npm run test:coverage && npm run build` passes
- [ ] `terraform init` succeeds in `infra/` directory
- [ ] `terraform validate` passes with no errors
- [ ] `terraform fmt -check` passes (consistent formatting)
- [ ] `terraform plan` succeeds with valid GCP credentials (manual verification)

#### Definition of Done

- [ ] All verification gates above are green
- [ ] Design doc exists at `docs/sdd/foundation/ci-cd-pipeline/design.md`
- [ ] Test handoff exists at `docs/sdd/foundation/ci-cd-pipeline/test-handoff.md`
- [ ] First CI run passes on main branch
- [ ] Terraform CI/CD workflow passes on main branch (plan + apply succeeds)
- [ ] CONFIRM: Infrastructure design reviewed for security (internal-only access, least-privilege IAM)
