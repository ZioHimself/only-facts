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
