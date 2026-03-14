/* global db, process, ISODate, printjson */

function getScriptArgs() {
  const separatorIndex = process.argv.indexOf("--");
  if (separatorIndex === -1) {
    return process.argv.slice(2);
  }
  return process.argv.slice(separatorIndex + 1);
}

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

const args = getScriptArgs();

if (args.length < 6) {
  throw new Error(
    "Expected args: <sourceCollection> <targetCollection> <dateField> <accountField> <contentField> <referenceField> [externalAuthorIdField regionField languageField postTypeField retweetField followersField followingField updatesField accountTypeField accountCategoryField harvestedDateField]"
  );
}

const [
  sourceCollectionName,
  targetCollectionName,
  dateField,
  accountField,
  contentField,
  referenceField,
  externalAuthorIdField = "",
  regionField = "",
  languageField = "",
  postTypeField = "",
  retweetField = "",
  followersField = "",
  followingField = "",
  updatesField = "",
  accountTypeField = "",
  accountCategoryField = "",
  harvestedDateField = ""
] = args;

const sourceCollection = db.getCollection(sourceCollectionName);
const targetCollection = db.getCollection(targetCollectionName);

targetCollection.drop();

let processed = 0;
let inserted = 0;
let skipped = 0;
const now = new Date();
const bulkOps = [];
const bulkSize = 1000;

sourceCollection.find({}).forEach((rawDoc) => {
  processed += 1;

  const date = parseDate(rawDoc[dateField]);
  const account = normalizeString(rawDoc[accountField]);
  const content = normalizeString(rawDoc[contentField]);
  const referenceRaw = normalizeString(rawDoc[referenceField]);
  const harvestedDate = parseDate(rawDoc[harvestedDateField]);

  if (!date || !account || !content) {
    skipped += 1;
    return;
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
    referencePostId: referenceRaw || null,
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
    targetCollection.bulkWrite(bulkOps, { ordered: false });
    inserted += bulkOps.length;
    bulkOps.length = 0;
  }
});

if (bulkOps.length > 0) {
  targetCollection.bulkWrite(bulkOps, { ordered: false });
  inserted += bulkOps.length;
}

targetCollection.createIndex({ date: 1 });
targetCollection.createIndex({ account: 1, date: 1 });
targetCollection.createIndex({ referencePostId: 1 });
targetCollection.createIndex({ "annotations.narrativeId": 1 });
targetCollection.createIndex({ "metadata.language": 1, date: 1 });
targetCollection.createIndex({ "metadata.region": 1, date: 1 });
targetCollection.createIndex({ content: "text" });

printjson({
  status: "ok",
  sourceCollection: sourceCollectionName,
  targetCollection: targetCollectionName,
  processed: processed,
  inserted: inserted,
  skipped: skipped
});
