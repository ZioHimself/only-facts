# Tasks for Epic: campaign-detection

[Addresses: G-2 (detect coordinated inauthentic campaigns)]

---

## Task Summary

| # | Task | Type | Risk | Dependencies |
|---|------|------|------|--------------|
| 1 | campaign-model | Technical | HOTL | epic:signal-ingestion |
| 2 | normalization-service | Technical | HOTL | campaign-model |
| 3 | analysis-pipeline-service | Technical | HIC | normalization-service |
| 4 | pipeline-api | Technical | HIC | analysis-pipeline-service |
| 5 | campaigns-endpoint | Technical | HOTL | campaign-model, analysis-pipeline-service |

---

## Dependency Graph

```
epic:signal-ingestion (external)
    └── campaign-model
            ├── normalization-service
            │       └── analysis-pipeline-service
            │               ├── pipeline-api
            │               └── campaigns-endpoint
            └── campaigns-endpoint
```

---

## Recommended Execution Order

1. **campaign-model** — Define data models for campaigns, normalized posts, and analysis results
2. **normalization-service** — Convert CLI normalization script to callable service
3. **analysis-pipeline-service** — Convert cluster variance script to callable service with DB output
4. **pipeline-api** — POST endpoint to trigger full pipeline (normalize → analyze → store)
5. **campaigns-endpoint** — GET endpoint to list detected campaigns

---

## Cycle Coverage

| Phase | Coverage |
|-------|----------|
| **Design** | Each task has design.md requirement |
| **Implementation** | Services in `src/services/`, routes in `src/routes/`, models in `src/models/` |
| **Testing** | Unit tests for services; integration tests for endpoints and DB operations |
| **Documentation** | Existing docs in epic-campaign-detection/ folder |

---

## Task: campaign-model

**Type:** Technical Task
**Summary:** Define Mongoose models for campaigns, normalized posts, and enriched cluster results.

**Risk:** HOTL — reversibility: high, consequence: isolated

[Addresses: G-2 (data foundation for campaign detection)]

### Description

Create the MongoDB data models required for campaign detection. This includes: (1) NormalizedPost — the standardized post format output by normalization, (2) EnrichedCluster — the analysis results with misinformation scores, sentiment, and cluster membership, (3) Campaign — the detected coordinated campaign with aggregated evidence. These models follow the existing patterns in `src/models/` and use the schema structures already proven in the CLI scripts.

### Dependencies

- Depends on: epic:signal-ingestion (signals collection must exist)
- Blocks: normalization-service, campaigns-endpoint

### Acceptance Criteria

#### Functional Criteria (what the code must do)

- [ ] VERIFY: `src/models/normalized-post.ts` exports `NormalizedPostModel` with schema matching the output structure of `normalize-test-posts-node.mjs`
- [ ] VERIFY: NormalizedPost schema includes: `source` (object with dataset, sourceCollection, sourceRecordId, importedAt), `date` (Date, indexed), `account` (string, indexed), `content` (string, text-indexed), `referencePostId`, `metadata` (object), `annotations` (object), `createdAt`, `updatedAt`
- [ ] VERIFY: `src/models/enriched-cluster.ts` exports `EnrichedClusterModel` with schema matching `account_enriched_clusters` from `run-full-report-cluster-variance.ts`
- [ ] VERIFY: EnrichedCluster schema includes: `runId` (indexed), `clusterId` (indexed), `clusterSize`, `topTerms`, `windowStart`, `windowEnd`, `postId`, `account` (indexed), `postedAt` (indexed), `content`, `sentiment`, `emotionalTone`, `misinformationScore` (indexed), `spamLikelihood` (indexed), `misinformationEffectiveness` (indexed), `scoreComponents`, `effectivenessComponents`, `dailyDominantEmotion`, `dailyDangerLevel`
- [ ] VERIFY: `src/models/campaign.ts` exports `CampaignModel` with fields: `runId`, `name`, `detectedAt`, `status` (enum: detected, confirmed, dismissed), `clusterIds` (array), `accountCount`, `postCount`, `avgMisinformationScore`, `topKeywords`, `timeRange` (start, end), `metadata`
- [ ] VERIFY: All models use TypeScript interfaces exported alongside the model
- [ ] VERIFY: All models follow existing patterns in `src/models/signal.ts`

#### Boundary Criteria (what the code must NOT do)

- [ ] VERIFY: No `any` types in model definitions
- [ ] VERIFY: Models do not include business logic — pure data structure definitions
- [ ] VERIFY: No hardcoded collection names outside the schema definition

#### Verification Gates (automated checks that must pass)

- [ ] `npm run build` compiles without errors
- [ ] `npm run lint` passes with zero errors
- [ ] `npm test` passes — model tests exist and pass
- [ ] `npx tsc --noEmit` passes type checking
- [ ] Unit tests cover: model creation, required field validation, index existence

#### Definition of Done

- [ ] All verification gates above are green
- [ ] Design doc exists at `docs/sdd/campaign-detection/campaign-model/design.md`
- [ ] Test handoff exists at `docs/sdd/campaign-detection/campaign-model/test-handoff.md`

---

## Task: normalization-service

**Type:** Technical Task
**Summary:** Convert CLI normalization script to a callable TypeScript service that transforms raw signals into normalized posts.

**Risk:** HOTL — reversibility: high, consequence: isolated

[Addresses: G-2 (standardize signal format for analysis)]

### Description

Extract the normalization logic from `packages/engine/scripts/mongo/normalize-test-posts-node.mjs` into a proper TypeScript service at `src/services/normalization-service.ts`. The service reads from a configurable source collection (default: `signals`), applies field mapping and validation, and writes normalized documents to a target collection (default: `normalized_posts`). This enables the normalization step to be called programmatically from the API rather than via CLI.

### Dependencies

- Depends on: campaign-model (NormalizedPost model must exist)
- Blocks: analysis-pipeline-service

### Acceptance Criteria

#### Functional Criteria (what the code must do)

- [ ] VERIFY: `src/services/normalization-service.ts` exports `NormalizationService` class or `runNormalization()` function
- [ ] VERIFY: Service accepts config object with: `sourceCollection` (default: "signals"), `targetCollection` (default: "normalized_posts"), field mappings for date, account, content, reference fields
- [ ] VERIFY: Service reads from source collection using cursor-based iteration (not loading all docs into memory)
- [ ] VERIFY: Service uses bulk writes with batch size of 1000 (matching existing script behavior)
- [ ] VERIFY: Service creates indexes on target collection: `date`, `account+date`, `referencePostId`, `annotations.narrativeId`, `metadata.language+date`, `metadata.region+date`, `content` (text)
- [ ] VERIFY: Service returns result object: `{ status: "ok", sourceCollection, targetCollection, processed, inserted, skipped }`
- [ ] VERIFY: Service handles missing required fields (date, account, content) by incrementing `skipped` counter
- [ ] VERIFY: Service applies same normalization logic as original script: `parseDate()`, `normalizeString()`, `parseOptionalNumber()`, `parseOptionalBoolean()`
- [ ] VERIFY: Service drops target collection before insert (or accepts `dropExisting: boolean` option)

#### Boundary Criteria (what the code must NOT do)

- [ ] VERIFY: No `any` types in service code
- [ ] VERIFY: Service does not use direct `process.env` access — uses config module
- [ ] VERIFY: Service does not log to console — returns structured results for caller to handle
- [ ] VERIFY: Service does not hard-code collection names — accepts them as parameters

#### Verification Gates (automated checks that must pass)

- [ ] `npm run build` compiles without errors
- [ ] `npm run lint` passes with zero errors
- [ ] `npm test` passes — normalization service tests exist and pass
- [ ] `npx tsc --noEmit` passes type checking
- [ ] Unit tests cover: field mapping, date parsing, string normalization, skip on missing required fields
- [ ] Integration tests cover: full normalization run with test data, index creation verification

#### Definition of Done

- [ ] All verification gates above are green
- [ ] Design doc exists at `docs/sdd/campaign-detection/normalization-service/design.md`
- [ ] Test handoff exists at `docs/sdd/campaign-detection/normalization-service/test-handoff.md`

---

## Task: analysis-pipeline-service

**Type:** Technical Task
**Summary:** Convert cluster variance analysis script to a callable service that outputs enriched results to MongoDB instead of console.

**Risk:** HIC — reversibility: medium, consequence: team

[Addresses: G-2 (core campaign detection logic)]

### Description

Extract the analysis pipeline logic from `packages/engine/src/scripts/run-full-report-cluster-variance.ts` into a proper service at `src/services/analysis-pipeline-service.ts`. The service reads from a configurable input collection (default: `normalized_posts`), runs TF-IDF clustering with Calinski-Harabasz threshold optimization, computes misinformation/spam/effectiveness scores, and writes results to output collections (`enriched_clusters`, `daily_emotion`) within the same database. Returns a structured summary instead of console output.

### Dependencies

- Depends on: normalization-service (normalized_posts collection must be populated)
- Blocks: pipeline-api, campaigns-endpoint

### Acceptance Criteria

#### Functional Criteria (what the code must do)

- [ ] VERIFY: `src/services/analysis-pipeline-service.ts` exports `AnalysisPipelineService` class or `runAnalysisPipeline()` function
- [ ] VERIFY: Service accepts config object with: `sourceCollection` (default: "normalized_posts"), `outputCollection` (default: "enriched_clusters"), `dailyEmotionCollection` (default: "daily_emotion"), plus all CLI options (windowHours, similarityThreshold, minClusterSize, minTokenLength, topTermsPerCluster, region, startDate, endDate, limit, velocityThreshold)
- [ ] VERIFY: Service performs Calinski-Harabasz optimal threshold search when `similarityThreshold` is null
- [ ] VERIFY: Service runs TF-IDF cosine clustering using existing `clusterByTfIdfTimeWindows()` from `src/services/tfidf-time-window-clustering.ts`
- [ ] VERIFY: Service computes per-post scores: `misinformationScore`, `spamLikelihood`, `misinformationEffectiveness`, `sentiment`, `emotionalTone`
- [ ] VERIFY: Service writes enriched cluster documents to `outputCollection` with `runId` for traceability
- [ ] VERIFY: Service writes daily emotion aggregates to `dailyEmotionCollection`
- [ ] VERIFY: Service returns structured result: `{ runId, postsProcessed, postsClustered, clusters, dailyEmotionDays, misinformation: { avg, high, medium }, spam: { avg, high }, topDangerDays, outputCollection, dailyEmotionCollection }`
- [ ] VERIFY: Service operates on a single database connection (no separate output DB) — collections colocated with source

#### Boundary Criteria (what the code must NOT do)

- [ ] VERIFY: No `any` types in service code
- [ ] VERIFY: Service does not write to console — returns structured results
- [ ] VERIFY: Service does not create separate database connections — uses existing mongoose connection
- [ ] VERIFY: Service does not hard-code collection names — accepts them as parameters
- [ ] VERIFY: Service does not block event loop — uses async iteration for large datasets

#### Verification Gates (automated checks that must pass)

- [ ] `npm run build` compiles without errors
- [ ] `npm run lint` passes with zero errors
- [ ] `npm test` passes — analysis pipeline tests exist and pass
- [ ] `npx tsc --noEmit` passes type checking
- [ ] Unit tests cover: NLP analysis functions (sentiment, emotion detection), score computation functions, threshold search
- [ ] Integration tests cover: full pipeline run with test data, output collection verification, daily emotion aggregation

#### Definition of Done

- [ ] All verification gates above are green
- [ ] Design doc exists at `docs/sdd/campaign-detection/analysis-pipeline-service/design.md`
- [ ] Test handoff exists at `docs/sdd/campaign-detection/analysis-pipeline-service/test-handoff.md`

---

## Task: pipeline-api

**Type:** Technical Task
**Summary:** Create POST endpoint to trigger the full normalization → analysis pipeline via web request.

**Risk:** HIC — reversibility: medium, consequence: team

[Addresses: G-2 (web interface for campaign detection)]

### Description

Implement a REST API endpoint `POST /api/pipelines/detect` that triggers the full campaign detection pipeline. The endpoint accepts configuration parameters (source collection, field mappings, analysis options), orchestrates normalization followed by analysis, and returns the combined results. Supports async execution with job status polling for long-running pipelines.

### Dependencies

- Depends on: analysis-pipeline-service (orchestrates both services)
- Blocks: none

### Acceptance Criteria

#### Functional Criteria (what the code must do)

- [ ] VERIFY: `src/routes/pipelines.ts` exports `pipelinesRouter` with route definitions
- [ ] VERIFY: `POST /api/pipelines/detect` endpoint exists and accepts JSON body
- [ ] VERIFY: Request body accepts: `sourceCollection` (string), `fieldMappings` (object with dateField, accountField, contentField, etc.), `analysisOptions` (object with windowHours, minClusterSize, etc.)
- [ ] VERIFY: Endpoint validates required fields and returns 400 with details for invalid input
- [ ] VERIFY: Endpoint orchestrates: (1) normalization service → (2) analysis pipeline service
- [ ] VERIFY: Endpoint returns 202 Accepted with `{ success: true, data: { jobId, status: "processing" } }` for async execution
- [ ] VERIFY: `GET /api/pipelines/jobs/:jobId` endpoint exists to check job status
- [ ] VERIFY: Job status endpoint returns: `{ success: true, data: { jobId, status: "completed"|"processing"|"failed", result?: {...}, error?: {...} } }`
- [ ] VERIFY: Completed job result includes both normalization stats and analysis summary
- [ ] VERIFY: Endpoint requires API key authentication (uses existing `apiKeyAuth` middleware)
- [ ] VERIFY: `src/app.ts` registers the pipelines router

#### Boundary Criteria (what the code must NOT do)

- [ ] VERIFY: No `any` types in route handlers
- [ ] VERIFY: Endpoint does not block on long-running pipeline — returns immediately with job ID
- [ ] VERIFY: Endpoint does not expose internal error stack traces in response
- [ ] VERIFY: Endpoint does not allow arbitrary collection names — validates against allowlist or pattern

#### Verification Gates (automated checks that must pass)

- [ ] `npm run build` compiles without errors
- [ ] `npm run lint` passes with zero errors
- [ ] `npm test` passes — pipeline endpoint tests exist and pass
- [ ] `npx tsc --noEmit` passes type checking
- [ ] Unit tests cover: request validation, job creation, status lookup
- [ ] Integration tests cover: full POST → poll → complete flow with test data

#### Definition of Done

- [ ] All verification gates above are green
- [ ] Design doc exists at `docs/sdd/campaign-detection/pipeline-api/design.md`
- [ ] Test handoff exists at `docs/sdd/campaign-detection/pipeline-api/test-handoff.md`

---

## Task: campaigns-endpoint

**Type:** Technical Task
**Summary:** Create GET endpoint to list detected campaigns with filtering and pagination.

**Risk:** HOTL — reversibility: high, consequence: isolated

[Addresses: G-2 (access campaign detection results)]

### Description

Implement a REST API endpoint `GET /api/campaigns` that lists detected campaigns from completed analysis runs. Supports filtering by status, date range, and minimum score thresholds. Returns paginated results with campaign summaries including cluster count, account count, and top keywords.

### Dependencies

- Depends on: campaign-model, analysis-pipeline-service (campaigns must exist in DB)
- Blocks: none

### Acceptance Criteria

#### Functional Criteria (what the code must do)

- [ ] VERIFY: `src/routes/campaigns.ts` exports `campaignsRouter` with route definitions
- [ ] VERIFY: `GET /api/campaigns` endpoint exists and returns JSON
- [ ] VERIFY: Response follows envelope pattern: `{ success: true, data: { campaigns: [...], pagination: { total, page, pageSize, pages } } }`
- [ ] VERIFY: Each campaign in response includes: `id`, `runId`, `name`, `detectedAt`, `status`, `accountCount`, `postCount`, `avgMisinformationScore`, `topKeywords`, `timeRange`
- [ ] VERIFY: Endpoint supports query params: `status` (filter by status), `minScore` (filter by avgMisinformationScore >= value), `startDate`/`endDate` (filter by detectedAt range), `page` (default: 1), `pageSize` (default: 20, max: 100)
- [ ] VERIFY: `GET /api/campaigns/:id` endpoint exists and returns single campaign with full details
- [ ] VERIFY: `GET /api/campaigns/:id` returns 404 for non-existent campaign ID
- [ ] VERIFY: `src/app.ts` registers the campaigns router
- [ ] VERIFY: Endpoint requires API key authentication (uses existing `apiKeyAuth` middleware)

#### Boundary Criteria (what the code must NOT do)

- [ ] VERIFY: No `any` types in route handlers
- [ ] VERIFY: Endpoint does not return raw MongoDB documents — maps to response DTOs
- [ ] VERIFY: Endpoint does not allow pageSize > 100 — caps at maximum
- [ ] VERIFY: Endpoint does not expose internal IDs — uses string representation

#### Verification Gates (automated checks that must pass)

- [ ] `npm run build` compiles without errors
- [ ] `npm run lint` passes with zero errors
- [ ] `npm test` passes — campaigns endpoint tests exist and pass
- [ ] `npx tsc --noEmit` passes type checking
- [ ] Unit tests cover: query param parsing, pagination calculation, DTO mapping
- [ ] Integration tests cover: list with filters, single campaign lookup, 404 handling

#### Definition of Done

- [ ] All verification gates above are green
- [ ] Design doc exists at `docs/sdd/campaign-detection/campaigns-endpoint/design.md`
- [ ] Test handoff exists at `docs/sdd/campaign-detection/campaigns-endpoint/test-handoff.md`
