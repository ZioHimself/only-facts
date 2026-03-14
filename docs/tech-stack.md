# Tech Stack

## Language & Runtime

| Component | Choice | Version |
|-----------|--------|---------|
| Language | TypeScript | ^5.0 |
| Runtime | Node.js | ^20.x LTS |

## Framework

| Component | Choice | Notes |
|-----------|--------|-------|
| Web Framework | Express | Minimal, fast, well-documented |
| API Style | REST | Standard HTTP endpoints |

## Database

| Component | Choice | Notes |
|-----------|--------|-------|
| Primary Database | MongoDB | Document store for flexible schemas |
| ODM | Mongoose | Type-safe models, validation |

## Build & Tooling

| Tool | Choice | Config File |
|------|--------|-------------|
| Package Manager | npm | `package.json` |
| Build | tsc | `tsconfig.json` |
| Bundler | None (tsc only) | — |

## Code Quality

| Tool | Purpose | Config File |
|------|---------|-------------|
| ESLint | Linting | `.eslintrc.json` |
| Prettier | Formatting | `.prettierrc` |
| TypeScript | Type checking | `tsconfig.json` |

## Testing

| Tool | Purpose | Notes |
|------|---------|-------|
| Jest | Unit & Integration tests | With ts-jest |
| Supertest | HTTP endpoint testing | Express integration |

## CI/CD

| Tool | Purpose | Notes |
|------|---------|-------|
| GitHub Actions | CI/CD pipeline | Lint, test, build, deploy |
| Terraform | Infrastructure as Code | GCP resource provisioning |

## Deployment

| Aspect | Choice |
|--------|--------|
| Cloud Provider | Google Cloud Platform (GCP) |
| Infrastructure | Terraform-managed |
| Environment | Internal / Private VPC |
| Access | Port-forwarding |
| Containerization | TBD |

## External Integrations (Planned)

| System | Purpose |
|--------|---------|
| Platform APIs | Cross-platform signal collection |
| Threat Intel Sources | Campaign identification |
| Trust & Safety Channels | Report filing |
