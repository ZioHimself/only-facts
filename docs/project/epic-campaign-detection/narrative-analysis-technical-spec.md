# Narrative Analysis Technical Spec

[Addresses: G-2]

Technical design for clustering social media posts into narratives and scoring each narrative for likelihood of coordinated disinformation behavior.

---

## 1. Scope and Objective

### Objective
Given scraped social posts, produce:
- Narrative clusters (posts grouped by shared story/claim propagation)
- Narrative evolution signals over time
- A disinformation-likelihood score per narrative (`NRS`, 0-100)
- Analyst-facing explanation of why a narrative was scored

### In Scope (MVP)
- Single-platform post analysis from existing DB records
- Hybrid clustering using text + reference graph + time
- Heuristic scoring model with transparent sub-scores
- Persisted outputs in MongoDB for downstream reporting

### Out of Scope (MVP)
- Final truth classification ("true/false")
- Account-level identity verification
- Cross-platform identity linking
- Advanced graph ML or fully supervised model training

---

## 2. Input Contract

Each post record must provide at minimum:

```ts
type InputPost = {
  id: string;
  date: string; // ISO timestamp
  account: string; // platform account identifier
  content: string; // text content
  referencePostId?: string | null; // reposted-from / reply-to relation
};
```

### Assumptions
- `id` is unique and stable.
- `date` is parseable and normalized to UTC.
- `account` is stable enough for grouping.
- `referencePostId` can be missing or refer to post outside analysis window.

---

## 3. Output Contract

### 3.1 Narrative Cluster

```ts
type Narrative = {
  narrativeId: string;
  postIds: string[];
  accountIds: string[];
  timeWindow: {
    startAt: string;
    peakAt: string;
    endAt: string;
  };
  representativeClaims: string[];
  topSeedPostIds: string[];
  metrics: NarrativeMetrics;
  risk: NarrativeRisk;
  createdAt: string;
  updatedAt: string;
};
```

### 3.2 Metrics + Score

```ts
type NarrativeMetrics = {
  postCount: number;
  uniqueAccounts: number;
  repostRatio: number;
  replyRatio: number;
  burstiness: number;
  timeToPeakMinutes: number;
  accountConcentration: number;
  lexicalVariance: number;
  temporalReactivationCount: number;
};

type NarrativeRisk = {
  nrs: number; // 0..100
  confidence: number; // 0..1
  subScores: {
    coordination: number; // 0..100
    amplification: number; // 0..100
    concentration: number; // 0..100
    framingShift: number; // 0..100
    temporalAnomaly: number; // 0..100
  };
  reasons: string[];
  flags: string[];
};
```

---

## 4. System Design

Pipeline flow:

1. **Load + Normalize**
   - Filter by analysis window
   - Normalize text (lowercase, URL/user-token replacement, whitespace cleanup)
   - Deduplicate exact duplicates (`account + normalizedContent + minuteBucket`)

2. **Feature Extraction**
   - Semantic embedding vector from normalized content
   - Graph features from `referencePostId` edges
   - Time features from posting cadence and burst windows

3. **Candidate Narrative Generation**
   - Build reference graph components
   - Seed initial clusters from connected components
   - Add semantically close posts not linked by explicit references

4. **Cluster Refinement**
   - Merge clusters by semantic centroid similarity + time overlap
   - Split clusters with low internal coherence

5. **Narrative Metrics + Scoring**
   - Compute evolution and coordination metrics
   - Produce NRS and sub-scores
   - Generate human-readable reasons and flags

6. **Persistence**
   - Upsert narrative records
   - Store run metadata and versioning for reproducibility

---

## 5. Clustering Strategy (Hybrid)

### 5.1 Similarity Components

For posts `i`, `j`:

- `S_text(i,j)`: cosine similarity of embeddings
- `S_graph(i,j)`: graph affinity (same component / short path / shared parent)
- `S_time(i,j)`: temporal closeness (decays with absolute time difference)
- `S_account(i,j)`: account relation signal (same account or repeated co-participation)

Combined pairwise similarity:

```text
S_total = w_text*S_text + w_graph*S_graph + w_time*S_time + w_account*S_account
```

Suggested default weights (MVP):
- `w_text = 0.45`
- `w_graph = 0.30`
- `w_time = 0.20`
- `w_account = 0.05`

### 5.2 Practical Algorithm

1. Build graph components from reference edges.
2. For each component, run semantic clustering (HDBSCAN or agglomerative).
3. Assign unlinked posts to nearest cluster if:
   - `S_text >= T_text_attach`
   - and post timestamp in cluster active window +/- grace period
4. Merge clusters if:
   - centroid cosine similarity >= `T_merge_semantic`
   - and time windows overlap (or are separated by less than `T_merge_gap`)
5. Reject clusters below minimum support:
   - `postCount < MIN_POSTS`
   - or `uniqueAccounts < MIN_ACCOUNTS`

### 5.3 Baseline Thresholds

- `T_text_attach = 0.78`
- `T_merge_semantic = 0.84`
- `T_merge_gap = 6h`
- `MIN_POSTS = 5`
- `MIN_ACCOUNTS = 3`

All thresholds must be externalized via config.

---

## 6. Narrative Evolution Features

For each narrative:

- **Volume curve**: posts per fixed time bucket (e.g., 15 minutes)
- **Burstiness**: `(peakBucketCount - meanBucketCount) / (stdBucketCount + eps)`
- **Growth asymmetry**: compare rise slope vs decay slope
- **Time-to-peak**: `peakAt - startAt`
- **Reactivation count**: number of new bursts after inactivity threshold
- **Propagation depth**: longest reference-chain length
- **Amplifier fraction**: repost/reply-only accounts over total accounts
- **Mutation proxy**: lexical divergence of posts from cluster centroid text

These features feed scoring and analyst interpretation.

---

## 7. Narrative Risk Score (NRS)

### 7.1 Sub-scores (0-100 each)

1. **Coordination**
   - High near-simultaneous posting with similar content
   - High duplicate/near-duplicate text across distinct accounts

2. **Amplification**
   - High repost/reply cascade from few seed posts
   - Shallow originality, heavy re-amplification

3. **Concentration**
   - Narrative dominated by small account subset
   - High account concentration index (e.g., HHI/Gini-like proxy)

4. **Framing Shift**
   - Emotional framing intensity drift over time
   - Divergence between seed phrasing and later amplified phrasing

5. **Temporal Anomaly**
   - Non-organic burst periodicity
   - Abrupt synchronized reactivation after dormant periods

### 7.2 Composite Formula

```text
NRS = 0.30*Coordination
    + 0.25*Amplification
    + 0.20*Concentration
    + 0.10*FramingShift
    + 0.15*TemporalAnomaly
```

`NRS` clamped to `[0, 100]`.

### 7.3 Confidence Heuristic

```text
confidence = min(1.0, log1p(postCount) / log1p(200))
           * min(1.0, uniqueAccounts / 30)
           * dataQualityFactor
```

Where `dataQualityFactor` decreases when timestamps or references are sparse.

### 7.4 Risk Bands

- `0-34`: Low
- `35-64`: Medium
- `65-100`: High

Bands are configuration-driven and tuned after analyst feedback.

---

## 8. Explainability and Analyst UX Requirements

Each narrative result must include:
- Top 3-5 `reasons` generated from strongest sub-score signals
- Triggered `flags`, e.g.:
  - `synchronized-posting`
  - `single-seed-mass-amplification`
  - `reactivation-burst`
- Compact evidence summary:
  - top seed posts
  - top amplifying accounts
  - peak burst window

No black-box-only output; all high-risk narratives require readable rationale.

---

## 9. Data Model (MongoDB)

### 9.1 Collection: `narratives`

Core document fields:
- `narrativeId` (string, unique index)
- `postIds` (array index)
- `accountIds` (array index)
- `timeWindow.startAt`, `timeWindow.endAt` (index)
- `metrics` (embedded)
- `risk.nrs` (index)
- `risk.subScores` (embedded)
- `runVersion` (string)

Suggested indexes:
- `{ "timeWindow.startAt": 1, "timeWindow.endAt": 1 }`
- `{ "risk.nrs": -1 }`
- `{ "postIds": 1 }`
- `{ "accountIds": 1 }`

### 9.2 Collection: `narrative-analysis-runs`

Run audit metadata:
- `runId`
- `startedAt`, `completedAt`
- `inputWindow`
- `algorithmVersion`
- `thresholdConfig`
- `summary` (counts and score distributions)
- `status` + error diagnostics

---

## 10. Service/API Contracts

### Service Layer

- `NarrativeClusteringService`
  - `clusterPosts(posts, config): Promise<NarrativeDraft[]>`
- `NarrativeScoringService`
  - `scoreNarratives(narratives, config): Promise<Narrative[]>`
- `NarrativeAnalysisService`
  - `runAnalysis(window, config): Promise<RunSummary>`

### API Endpoints (MVP)

- `POST /api/narratives/analyze`
  - Input: `{ startAt, endAt, dryRun? }`
  - Output: `{ success, data: { runId, narrativesCreated, narrativesUpdated } }`

- `GET /api/narratives`
  - Query: `minRisk`, `startAt`, `endAt`, `limit`, `cursor`
  - Output: paginated narrative list with risk and summary metrics

- `GET /api/narratives/:id`
  - Output: full narrative detail including sub-scores and reasons

Responses must follow standard envelope:
`{ success, data?, error? }`

---

## 11. Quality Gates and Evaluation

### Offline Evaluation Dataset
- Build a labeled set of narrative windows:
  - `organic`
  - `likely coordinated`
  - `unknown`
- Labels initially from analyst judgment and known historical examples

### Metrics
- Clustering quality: silhouette-like proxy + manual coherence score
- Risk ranking quality: precision@K for high-risk narratives
- Stability: score variance under small input perturbations

### Required Tests
- Unit tests:
  - feature calculators
  - score normalization and clamping
  - threshold edge behavior
- Integration tests:
  - end-to-end analysis run with synthetic posts
  - persistence and retrieval of narratives

---

## 12. Delivery Plan

### Phase 1 (MVP)
- Implement normalization + hybrid clustering baseline
- Implement NRS with fixed heuristics and reasons
- Persist narratives and expose read APIs

### Phase 2
- Calibration using labeled data
- Better framing-shift features and multilingual handling
- Account behavior fingerprints across multiple narratives

### Phase 3
- Active-learning loop with analyst feedback
- Optional supervised model for re-ranking high-risk narratives

---

## 13. Risks and Mitigations

- **Risk:** False positives during breaking-news spikes
  - **Mitigation:** down-weight score when account diversity is broad and source diversity is high

- **Risk:** Missing reference links in scraped data
  - **Mitigation:** rely on semantic + time backfill attachment with confidence penalty

- **Risk:** Adversarial wording variation to evade near-duplicate checks
  - **Mitigation:** embedding-based similarity plus propagation behavior signals

- **Risk:** Overfitting to one platform behavior
  - **Mitigation:** isolate platform-specific features and version configs

---

## 14. Open Decisions

1. Exact embedding model for production (latency/cost trade-off)
2. Preferred clustering algorithm under target throughput
3. Initial labeling workflow and reviewer rubric
4. Whether NRS thresholds are global or topic-specific

These must be finalized before hardening beyond MVP.
