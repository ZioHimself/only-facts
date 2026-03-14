# TF-IDF Baseline Clustering Quickstart

Run baseline narrative clustering with TF-IDF similarity inside fixed time windows.

---

## **Run first clustering analysis**

Make sure the `MONGO_URI` is set. From repo root execute:

``` 
$env:MONGO_URI = "mongodb://127.0.0.1:49829/only-facts" 
```

``` 
npm run cluster:baseline -- --language English --window-hours 24 --similarity-threshold 0.3 --min-cluster-size 3 --limit 50000
``` 

If `npm` is not found in your shell, use:
```
$env:Path = "C:\Program Files\nodejs;" + $env:Path
$env:MONGO_URI = "mongodb://127.0.0.1:49829/only-facts"
& "C:\Program Files\nodejs\npm.cmd" run cluster:baseline -- --language English --window-hours 24 --similarity-threshold 0.3 --min-cluster-size 3 --limit 50000
```

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

