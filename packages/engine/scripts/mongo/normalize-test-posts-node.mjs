import mongoose from "mongoose";

function parseDate(value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const parsed = new Date(String(value).trim());
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeString(value) {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value).trim();
}

function parseOptionalNumber(value) {
  const raw = normalizeString(value);
  if (!raw) {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalBoolean(value) {
  const raw = normalizeString(value).toLowerCase();
  if (!raw) {
    return null;
  }
  if (raw === "1" || raw === "true" || raw === "yes") {
    return true;
  }
  if (raw === "0" || raw === "false" || raw === "no") {
    return false;
  }
  return null;
}

function extractStatusId(value) {
  const raw = normalizeString(value);
  if (!raw) {
    return null;
  }

  // Accept direct numeric IDs as-is.
  if (/^\d{8,}$/.test(raw)) {
    return raw;
  }

  const statusMatch = raw.match(/\/status\/(\d{8,})/i);
  if (statusMatch) {
    return statusMatch[1];
  }

  const queryMatch = raw.match(/[?&](?:status_id|tweet_id|id)=(\d{8,})/i);
  if (queryMatch) {
    return queryMatch[1];
  }

  return null;
}

function maybeDecodeBase64(value) {
  const raw = normalizeString(value);
  if (!raw || raw.length % 4 !== 0 || !/^[A-Za-z0-9+/=_-]+$/.test(raw)) {
    return "";
  }

  const normalized = raw.replace(/-/g, "+").replace(/_/g, "/");
  try {
    const decoded = Buffer.from(normalized, "base64").toString("utf8").trim();
    // Keep only text that resembles URL-like content.
    if (decoded.includes("http") || decoded.includes("/status/") || decoded.includes("status_id=")) {
      return decoded;
    }
  } catch {
    // Ignore decode errors and fall back to direct parsing.
  }

  return "";
}

function extractReferencePostId(value) {
  const direct = extractStatusId(value);
  if (direct) {
    return direct;
  }

  const decoded = maybeDecodeBase64(value);
  if (!decoded) {
    return null;
  }

  return extractStatusId(decoded);
}

const [
  mongoUri,
  dbName,
  sourceCollectionName,
  targetCollectionName,
  dateField,
  accountField,
  contentField,
  referenceField,
  externalAuthorIdField,
  regionField,
  languageField,
  postTypeField,
  retweetField,
  followersField,
  followingField,
  updatesField,
  accountTypeField,
  accountCategoryField,
  harvestedDateField
] = process.argv.slice(2);

if (!mongoUri || !dbName || !sourceCollectionName || !targetCollectionName) {
  throw new Error(
    "Usage: node scripts/mongo/normalize-test-posts-node.mjs <mongoUri> <dbName> <sourceCollection> <targetCollection> <dateField> <accountField> <contentField> <referenceField> <externalAuthorIdField> <regionField> <languageField> <postTypeField> <retweetField> <followersField> <followingField> <updatesField> <accountTypeField> <accountCategoryField> <harvestedDateField>"
  );
}

const connectionUri = `${mongoUri}/${dbName}`;
await mongoose.connect(connectionUri);

const sourceCollection = mongoose.connection.db.collection(sourceCollectionName);
const targetCollection = mongoose.connection.db.collection(targetCollectionName);

await targetCollection.drop().catch(() => {
  // Ignore "namespace not found" when target does not exist yet.
});

let processed = 0;
let inserted = 0;
let skipped = 0;
const now = new Date();
const bulkOps = [];
const bulkSize = 1000;

const cursor = sourceCollection.find({});

for await (const rawDoc of cursor) {
  processed += 1;

  const date = parseDate(rawDoc[dateField]);
  const account = normalizeString(rawDoc[accountField]);
  const content = normalizeString(rawDoc[contentField]);
  const referencePostId = extractReferencePostId(rawDoc[referenceField]);
  const harvestedDate = parseDate(rawDoc[harvestedDateField]);

  if (!date || !account || !content) {
    skipped += 1;
    continue;
  }

  const normalizedDoc = {
    source: {
      dataset: "csv-test-dataset",
      sourceCollection: sourceCollectionName,
      sourceRecordId: String(rawDoc._id),
      importedAt: now
    },
    date: date,
    account: account,
    content: content,
    referencePostId: referencePostId,
    metadata: {
      externalAuthorId: normalizeString(rawDoc[externalAuthorIdField]) || null,
      region: normalizeString(rawDoc[regionField]) || null,
      language: normalizeString(rawDoc[languageField]) || null,
      postType: normalizeString(rawDoc[postTypeField]) || null,
      isRetweet: parseOptionalBoolean(rawDoc[retweetField]),
      followers: parseOptionalNumber(rawDoc[followersField]),
      following: parseOptionalNumber(rawDoc[followingField]),
      updates: parseOptionalNumber(rawDoc[updatesField]),
      accountType: normalizeString(rawDoc[accountTypeField]) || null,
      accountCategory: normalizeString(rawDoc[accountCategoryField]) || null,
      harvestedDate: harvestedDate
    },
    annotations: {
      narrativeId: null,
      tags: [],
      notes: "",
      scoreOverride: null
    },
    createdAt: now,
    updatedAt: now
  };

  bulkOps.push({ insertOne: { document: normalizedDoc } });

  if (bulkOps.length >= bulkSize) {
    await targetCollection.bulkWrite(bulkOps, { ordered: false });
    inserted += bulkOps.length;
    bulkOps.length = 0;
  }
}

if (bulkOps.length > 0) {
  await targetCollection.bulkWrite(bulkOps, { ordered: false });
  inserted += bulkOps.length;
}

await targetCollection.createIndex({ date: 1 });
await targetCollection.createIndex({ account: 1, date: 1 });
await targetCollection.createIndex({ referencePostId: 1 });
await targetCollection.createIndex({ "annotations.narrativeId": 1 });
await targetCollection.createIndex({ "metadata.language": 1, date: 1 });
await targetCollection.createIndex({ "metadata.region": 1, date: 1 });
await targetCollection.createIndex({ content: "text" });

console.log(
  JSON.stringify(
    {
      status: "ok",
      sourceCollection: sourceCollectionName,
      targetCollection: targetCollectionName,
      processed,
      inserted,
      skipped
    },
    null,
    2
  )
);

await mongoose.disconnect();
