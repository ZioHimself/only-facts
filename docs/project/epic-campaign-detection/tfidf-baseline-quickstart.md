# TF-IDF Baseline Clustering Quickstart

Run baseline narrative clustering with TF-IDF similarity inside fixed time windows, then run bot-behavior analysis as a separate stage.

---

## **Run first clustering analysis**

Make sure the `MONGO_URI` is set. From repo root execute:

```
$env:MONGO_URI = "mongodb://127.0.0.1:49829/only-facts" 
```

```powershell
npm run cluster:baseline -w @only-facts/engine -- --language English --window-hours 24 --similarity-threshold 0.3 --min-cluster-size 3 --limit 50000
```

If `npm` is not found in your shell, use:
```
$env:Path = "C:\Program Files\nodejs;" + $env:Path
$env:MONGO_URI = "mongodb://127.0.0.1:49829/only-facts"
& "C:\Program Files\nodejs\npm.cmd" run cluster:baseline -- --language English --window-hours 24 --similarity-threshold 0.3 --min-cluster-size 3 --limit 50000
```

## Command

```powershell
npm run cluster:baseline -w @only-facts/engine -- --window-hours 24 --similarity-threshold 0.3 --min-cluster-size 3
```

## Common Filters

```powershell
npm run cluster:baseline -w @only-facts/engine -- --language English --start-date 2016-01-01 --end-date 2016-12-31
```

```powershell
npm run cluster:baseline -w @only-facts/engine -- --limit 50000
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
- coordination signals (`coordination.*`), including:
  - account concentration
  - retweet share
  - synchronized burst metrics
  - internal reference graph density
  - composite `coordinationScore` and `flags`
- clustering config snapshot

At this stage, `botBehavior` is intentionally not populated yet.

## Step 2: Run Bot-Behavior Analysis

```powershell
npm run cluster:bot-analysis -w @only-facts/engine -- --run-id <run-id-from-baseline>
```

If `--run-id` is omitted, the latest baseline run is used.

This populates `botBehavior.*` for each cluster, including:
- suspected bot account share and post share
- account-level suspicion scores and top suspect accounts
- composite `botLikelihoodScore` and behavior flags

## Step 3: Report Top Organic vs Top Bot Clusters

```powershell
npm run cluster:report-bot-vs-organic -w @only-facts/engine -- --run-id <run-id-from-baseline> --top-n 5
```

## One-Command Pipeline (Steps 1-3)

Runs clustering, then bot analysis, then prints concise top bot vs top organic summary.

```powershell
npm run cluster:pipeline -w @only-facts/engine -- --language English --window-hours 24 --similarity-threshold 0.32 --min-cluster-size 3 --limit 12000 --top-n 5
```

Final output includes:
- Top bot-like cluster: bot likelihood, cluster size, top keywords
- Top organic-like cluster: bot likelihood, cluster size, top keywords