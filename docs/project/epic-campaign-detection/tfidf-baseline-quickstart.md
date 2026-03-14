# TF-IDF Baseline Clustering Quickstart

Run baseline narrative clustering with TF-IDF similarity inside fixed time windows.

---

## Command

```powershell
npm run cluster:baseline -- --window-hours 24 --similarity-threshold 0.3 --min-cluster-size 3
```

## Common Filters

```powershell
npm run cluster:baseline -- --language English --start-date 2016-01-01 --end-date 2016-12-31
```

```powershell
npm run cluster:baseline -- --limit 50000
```

## Output

Clusters are written to MongoDB collection:
- `baseline_clusters`

Each run uses a unique `runId` and stores:
- `clusterId`
- time window (`windowStart`, `windowEnd`)
- `postIds`
- `accountIds`
- top TF-IDF terms (`topTerms`)
- clustering config snapshot
