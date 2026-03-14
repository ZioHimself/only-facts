# Test Dataset Ingestion (CSV -> MongoDB)

[Addresses: G-1, G-2]

This guide sets up a temporary test dataset pipeline so narrative clustering can proceed before the scraping epic is complete.

---

## Goal

Load a CSV file of social posts into MongoDB and normalize it into a clustering-ready collection with:
- Canonical fields: `date`, `account`, `content`, `referencePostId`
- Annotation fields for analysts and algorithms
- Query indexes for time, account, reference, and text search

---

## Prerequisites

- MongoDB running locally or reachable via URI
- MongoDB tools installed (`mongoimport`, `mongosh`)
- CSV file with headers that include equivalent fields for:
  - timestamp/date
  - account identifier
  - post text
  - reply/repost reference (optional)

---

## File Layout

- Import command: `scripts/import-test-dataset.ps1`
- Normalization script: `scripts/mongo/normalize-test-posts.js`

---

## Usage

From repository root in PowerShell:

```powershell
.\scripts\import-test-dataset.ps1 `
  -MongoUri "mongodb://localhost:27017" `
  -DbName "only-facts" `
  -CsvPath "data/raw/twitter-posts.csv" `
  -SourceCollection "raw_social_posts" `
  -TargetCollection "test_posts" `
  -DateField "publish_date" `
  -AccountField "author" `
  -ContentField "content" `
  -ReferenceField ""
```

### Header Mapping Notes

The importer now defaults to your provided Twitter dataset headers.

If your CSV uses different header names, update only the field parameter values.

Example:
- CSV column `created_at` -> `-DateField "created_at"`
- CSV column `user_screen_name` -> `-AccountField "user_screen_name"`
- CSV column `text` -> `-ContentField "text"`
- CSV column `in_reply_to_status_id` -> `-ReferenceField "in_reply_to_status_id"`

If no reply/repost reference column exists, keep `-ReferenceField ""`.

---

## Normalized Document Shape

```ts
{
  source: {
    dataset: "csv-test-dataset",
    sourceCollection: string,
    sourceRecordId: string,
    importedAt: Date
  },
  date: Date,
  account: string,
  content: string,
  referencePostId: string | null,
  metadata: {
    externalAuthorId: string | null,
    region: string | null,
    language: string | null,
    postType: string | null,
    isRetweet: boolean | null,
    followers: number | null,
    following: number | null,
    updates: number | null,
    accountType: string | null,
    accountCategory: string | null,
    harvestedDate: Date | null
  },
  annotations: {
    narrativeId: string | null,
    tags: string[],
    notes: string,
    scoreOverride: number | null
  },
  createdAt: Date,
  updatedAt: Date
}
```

Records missing required values (`date`, `account`, `content`) are skipped.

---

## Indexes Created

On target collection:
- `{ date: 1 }`
- `{ account: 1, date: 1 }`
- `{ referencePostId: 1 }`
- `{ "annotations.narrativeId": 1 }`
- `{ "metadata.language": 1, date: 1 }`
- `{ "metadata.region": 1, date: 1 }`
- `{ content: "text" }`

---

## Suggested Team Workflow

1. Keep scraper output separate from test imports (`raw_social_posts`).
2. Run normalization into a stable working collection (`test_posts`).
3. Let clustering code read from `test_posts`.
4. Store clustering annotations back into `annotations.*` fields.
5. Re-run import with `--drop` behavior in staging when dataset updates.

This keeps exploratory work fast while preserving a clean migration path to production ingestion.
