# Project Goals — only-facts

Measurable success criteria for the campaign detection pipeline.

---

## MVP Goals (24h Hackathon)

| ID | Category | Goal | Verification | Priority |
|----|----------|------|--------------|----------|
| **G-1** | Functional | Ingest signals from X (Twitter) platform | API endpoint accepts X signal payloads, persists to DB, returns 200 | **MVP** |
| **G-2** | Functional | Detect coordinated inauthentic campaigns from ingested signals | Detection service identifies campaign patterns; unit tests pass | **MVP** |
| **G-3** | Functional | Construct evidence chains linking signals to detected campaigns | Evidence chain model links signals → campaign with timestamps and metadata | **MVP** |

## Post-MVP Goals

| ID | Category | Goal | Verification | Priority |
|----|----------|------|--------------|----------|
| **G-4** | Functional | Generate structured reports for trust & safety channels | Report generation endpoint produces valid output format | Post-MVP |
| **G-5** | Functional | Document platform responses for regulatory compliance | Response tracking model stores platform replies with timestamps | Post-MVP |
| **G-6** | Quality | 80% test coverage on business logic | Coverage report meets threshold | Post-MVP |
| **G-7** | Operational | Service runs in private VPC, accessible via port-forwarding | Deployment config reflects internal-only access | Post-MVP |
| **G-8** | Security | No secrets in codebase; env-based configuration | No `.env` values in committed code | Ongoing |

---

## Design Constraints

| Constraint | Decision | Rationale |
|------------|----------|-----------|
| Platform scope | X (Twitter) only for MVP | Hackathon time constraint |
| Detection technique | TBD in design phase | Avoid premature optimization |
| Threat intelligence | Heuristics-based, not SaaS | Simpler integration, no external dependencies |
| Report format | To be designed | No pre-existing format requirement |

---

## Cross-Reference Protocol

All downstream artifacts must reference which goal(s) they address using the format:

```
[Addresses: G-1, G-3]
```

This enables traceability: Goals → Epics → Tasks → Design → Tests → Code

---

## Success Definition

**Hackathon MVP is successful when:**
1. A signal from X can be ingested via API (G-1)
2. The system can identify that multiple signals form a coordinated campaign (G-2)
3. An evidence chain document links those signals to the campaign (G-3)

**Demo scenario:** Ingest 5+ related signals → system detects they're part of a campaign → evidence chain shows the connection.
