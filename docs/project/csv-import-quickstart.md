# CSV Import Quickstart

Use this guide to import CSV data into MongoDB for clustering work.

---

## Recommended (full pipeline)

Run the wrapper script:

```powershell
.\scripts\import-test-dataset.ps1 `
  -MongoUri "<mongo-uri>" `
  -DbName "only-facts" `
  -CsvPath "<path-to-csv>"
```

This performs both steps:
1. CSV -> `raw_social_posts` (staging import via `mongoimport`)
2. `raw_social_posts` -> `test_posts` (normalization for analysis)

---

## Normalization-only (advanced)

Use this only if the raw CSV has already been imported into `raw_social_posts`.

Script:
- `scripts/mongo/normalize-test-posts-node.mjs`

Example:

```powershell
& "C:\Program Files\nodejs\node.exe" "scripts/mongo/normalize-test-posts-node.mjs" `
  "mongodb://127.0.0.1:49829" `
  "only-facts" `
  "raw_social_posts" `
  "test_posts" `
  "publish_date" `
  "author" `
  "content" `
  "reference" `
  "external_author_id" `
  "region" `
  "language" `
  "post_type" `
  "retweet" `
  "followers" `
  "following" `
  "updates" `
  "account_type" `
  "account_category" `
  "harvested_date"
```

---

## Which script should I run?

- If you are importing a CSV file from scratch: run `scripts/import-test-dataset.ps1`
- If raw data already exists and you only want to rebuild `test_posts`: run `scripts/mongo/normalize-test-posts-node.mjs`
