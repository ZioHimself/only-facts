# Best Practices — only-facts

Project-specific coding standards for the campaign detection pipeline.

---

## 1. Language & Framework Conventions

### Naming

| Element | Convention | Example |
|---------|------------|---------|
| Files | kebab-case | `campaign-analyzer.ts`, `evidence-chain.service.ts` |
| Classes | PascalCase | `CampaignAnalyzer`, `EvidenceChainService` |
| Functions | camelCase | `detectCampaign`, `buildEvidenceChain` |
| Constants | SCREAMING_SNAKE | `MAX_RETRY_ATTEMPTS`, `DEFAULT_TIMEOUT_MS` |
| Interfaces | PascalCase, no `I` prefix | `Campaign`, `Signal`, `EvidenceNode` |
| Type aliases | PascalCase | `CampaignId`, `PlatformResponse` |

### Do
- Use `async/await` for all async operations
- Prefer `unknown` over `any` and narrow with type guards
- Use strict TypeScript (`strict: true` in tsconfig)
- Destructure parameters for clarity: `({ campaignId, signals }: AnalyzeParams)`

### Don't
- Use `any` type — it defeats TypeScript's purpose
- Use callbacks for async — use Promises/async-await
- Mix named and default exports in the same file

---

## 2. Quality Standards

### Testing Strategy

| Layer | Test Type | Tools |
|-------|-----------|-------|
| Services/Utils | Unit tests | Jest, mocked deps |
| API Endpoints | Integration tests | Supertest + mongodb-memory-server |
| Data Models | Schema validation | Jest + Mongoose validation |

### Do
- Test edge cases: empty arrays, null inputs, malformed data
- Use `mongodb-memory-server` for isolated DB tests
- Name tests as `should {expected behavior} when {condition}`

### Don't
- Test implementation details — test behavior
- Share state between tests — each test is independent
- Skip error path testing

### Error Handling

```typescript
// Do: Typed errors with context
class CampaignNotFoundError extends AppError {
  constructor(campaignId: string) {
    super(`Campaign not found: ${campaignId}`, 404);
  }
}

// Don't: Raw throws without context
throw new Error("Not found");
```

### Logging

| Level | When |
|-------|------|
| `error` | Failures requiring attention |
| `warn` | Recoverable issues, degraded behavior |
| `info` | Significant business events (campaign detected, report filed) |
| `debug` | Diagnostic details (request/response payloads) |

---

## 3. Architecture & Design Patterns

### Module Structure

```
src/
├── config/          # Environment + app configuration
├── models/          # Mongoose schemas + types
├── services/        # Business logic (no HTTP concerns)
├── routes/          # Express route handlers
├── middleware/      # Express middleware
├── utils/           # Pure utility functions
└── types/           # Shared TypeScript types
```

### Do
- Keep route handlers thin — delegate to services
- Access DB only through models in `src/models/`
- Use dependency injection for testability

### Don't
- Import `process.env` directly — use `src/config/`
- Put business logic in route handlers
- Create circular dependencies between modules

### API Response Envelope

```typescript
// All responses follow this shape
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
```

### Configuration

```typescript
// src/config/index.ts — single source of truth
export const config = {
  port: process.env.PORT || 3000,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/only-facts',
  // ... other config
} as const;
```

---

## 4. Development Workflow

### Commits
- Format: `[SDD] <type>: <description>` for pipeline commits
- Types: `feat`, `fix`, `refactor`, `test`, `docs`
- Keep commits atomic — one logical change per commit

### Git Workflow
- Trunk-based: all commits go directly to `main`
- No feature branches or PRs
- Run tests locally before pushing

### Code Review Focus
- Type safety — no `any` escapes
- Error handling coverage
- Test quality and coverage
- Security: input validation, no secrets in code

---

## 5. Infrastructure as Code (Terraform)

### Directory Structure

```
infra/
├── main.tf              # Provider config, backend, module calls
├── variables.tf         # Input variable definitions
├── outputs.tf           # Output values
├── versions.tf          # Provider version constraints
├── terraform.tfvars.example  # Template for local overrides (committed)
├── environments/
│   └── prod.tfvars      # Non-sensitive production values (committed)
└── modules/             # Reusable modules (if needed)
```

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Resources | snake_case with prefix | `google_container_cluster.only_facts_gke` |
| Variables | snake_case | `gcp_project`, `app_port` |
| Outputs | snake_case | `gke_cluster_endpoint` |
| Files | kebab-case or standard tf names | `main.tf`, `gke-cluster.tf` |
| Modules | kebab-case directories | `modules/gke-cluster/` |

### Do
- Use variables for all environment-specific values
- Mark sensitive variables with `sensitive = true`
- Use remote state backend (GCS) with locking
- Pin provider versions in `versions.tf`
- Use `terraform fmt` before committing

### Don't
- Commit `.tfvars` files with secrets — use GitHub Actions secrets
- Hardcode project IDs, regions, or credentials
- Use `local-exec` provisioners — prefer native resources
- Store state locally — always use remote backend

### Variable Management

```hcl
# variables.tf — define with descriptions and validation
variable "mongo_uri" {
  description = "MongoDB connection string"
  type        = string
  sensitive   = true  # Never shown in logs/output
}

variable "gcp_region" {
  description = "GCP region for resources"
  type        = string
  default     = "us-central1"
}
```

```hcl
# terraform.tfvars.example — committed template
gcp_project = "your-project-id"
gcp_region  = "us-central1"
environment = "prod"
# mongo_uri = "mongodb+srv://..." # Set via TF_VAR_mongo_uri or GitHub secret
```

### State Management

```hcl
# main.tf — remote backend
terraform {
  backend "gcs" {
    bucket = "only-facts-tf-state"  # From GitHub Actions variable
    prefix = "terraform/state"
  }
}
```

---

## 6. CI/CD Practices

### Workflow Structure

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | Push to main, PRs | Lint, typecheck, test, build |
| `terraform.yml` | Changes to `infra/**` | Validate, plan, apply |

### Do
- Use `actions/cache` for `node_modules` and Terraform plugins
- Use Workload Identity Federation for GCP auth (no long-lived keys)
- Run `terraform plan` on PRs, `terraform apply` only on main
- Fail fast — no `continue-on-error` on quality gates
- Use GitHub Actions secrets for sensitive values

### Don't
- Run `terraform apply` on pull requests
- Store credentials in workflow files
- Skip validation steps to "save time"
- Use `latest` tags for actions — pin versions

### Secrets Management

| Secret Type | Where to Store | How to Access |
|-------------|----------------|---------------|
| GCP credentials | Workload Identity Federation | `google-github-actions/auth` |
| MongoDB URI | GitHub Actions secret | `${{ secrets.MONGO_URI }}` |
| Terraform state bucket | GitHub Actions variable | `${{ vars.TF_STATE_BUCKET }}` |
| GCP Project ID | GitHub Actions variable | `${{ vars.GCP_PROJECT }}` |

### Deployment Pattern

```yaml
# terraform.yml — plan on PR, apply on main
on:
  push:
    branches: [main]
    paths: ['infra/**']
  pull_request:
    paths: ['infra/**']

jobs:
  terraform:
    steps:
      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ vars.WIF_PROVIDER }}
          service_account: ${{ vars.WIF_SERVICE_ACCOUNT }}
      
      - run: terraform init
      - run: terraform validate
      - run: terraform fmt -check
      - run: terraform plan -var-file=environments/prod.tfvars
      
      # Apply only on main branch
      - if: github.ref == 'refs/heads/main'
        run: terraform apply -auto-approve -var-file=environments/prod.tfvars
```

---

## Quick Reference

```typescript
// Good pattern
export async function analyzeSignals(
  signals: Signal[]
): Promise<AnalysisResult> {
  if (!signals.length) {
    return { campaigns: [], confidence: 0 };
  }
  // ... business logic
}

// Bad pattern
export function analyzeSignals(signals: any): any {
  // Missing types, sync when should be async
}
```
