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
| GitHub Actions | CI/CD pipeline | Lint, test, build + Terraform apply on main |
| Terraform | Infrastructure as Code | VPC, GKE, IAM, Artifact Registry |

# Trunk based development without Pull Requests
We commit directly to main relying on CI / CD to deploy it directly to production.

## Deployment

| Aspect | Choice |
|--------|--------|
| Cloud Provider | Google Cloud Platform (GCP) |
| Infrastructure | Terraform-managed |
| Container Orchestration | GKE (Google Kubernetes Engine) |
| Container Registry | Artifact Registry |
| Environment | Internal / Private VPC |
| Access | Port-forwarding via kubectl or IAP |
| Node Type | Preemptible/Spot VMs (cost-optimized) |

## External Integrations (Planned)

| System | Purpose |
|--------|---------|
| Platform APIs | Cross-platform signal collection |
| Threat Intel Sources | Campaign identification |
| Trust & Safety Channels | Report filing |
