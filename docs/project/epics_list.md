# Project Epics — only-facts

[Addresses: G-1, G-2, G-3]

---

## MVP Epics (24h Hackathon)

### 1. Epic: foundation

**Goal:** Establish project infrastructure — Express server, MongoDB connection, TypeScript config, and base models.

**Value:** All subsequent epics depend on a working API skeleton and database connectivity.

**Scope:**
- Project scaffolding (package.json, tsconfig, eslint, prettier)
- Express server with health endpoint
- MongoDB connection with Mongoose
- Base error handling and logging
- Environment configuration module

---

### 2. Epic: signal-ingestion

**Goal:** Ingest signals from X (Twitter) platform via REST API. [Addresses: G-1]

**Value:** Enables the system to receive and persist raw signal data for analysis.

**Scope:**
- Signal data model (Mongoose schema)
- POST `/api/signals` endpoint for ingestion
- Signal validation and normalization
- Basic rate limiting / input validation

---

### 3. Epic: campaign-detection

**Goal:** Detect coordinated inauthentic campaigns from ingested signals. [Addresses: G-2]

**Value:** Core business logic that identifies when signals form a coordinated campaign.

**Scope:**
- Campaign data model
- Detection service with configurable heuristics
- Campaign creation when pattern detected
- GET `/api/campaigns` endpoint to list detected campaigns

---

### 4. Epic: evidence-chain

**Goal:** Construct evidence chains linking signals to detected campaigns. [Addresses: G-3]

**Value:** Creates the audit trail connecting raw signals to campaign conclusions.

**Scope:**
- Evidence chain data model (nodes, links, timestamps)
- Service to build chain when campaign detected
- GET `/api/campaigns/:id/evidence` endpoint
- Chain visualization data structure (for future UI)

---

## Post-MVP Epics (Future)

### 5. Epic: reporting (Post-MVP)

**Goal:** Generate structured reports for trust & safety channels. [Addresses: G-4]

### 6. Epic: response-tracking (Post-MVP)

**Goal:** Document platform responses for regulatory compliance. [Addresses: G-5]

---

## Dependency Graph

```
foundation
    ↓
signal-ingestion
    ↓
campaign-detection
    ↓
evidence-chain
```

All MVP epics are sequential — each depends on the previous.
