import mongoose from "mongoose";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "has",
  "have",
  "he",
  "her",
  "him",
  "his",
  "i",
  "in",
  "is",
  "it",
  "its",
  "me",
  "my",
  "of",
  "on",
  "or",
  "our",
  "rt",
  "she",
  "that",
  "the",
  "their",
  "them",
  "they",
  "this",
  "to",
  "us",
  "was",
  "we",
  "were",
  "will",
  "with",
  "you",
  "your"
]);

function tokenize(content) {
  return String(content)
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/@\w+/g, " ")
    .replace(/[^a-z0-9#_]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(
      (token) =>
        token.length >= 3 &&
        !STOP_WORDS.has(token) &&
        !/^\d+$/.test(token)
    );
}

function topEntries(map, limit) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([term, count]) => ({ term, count }));
}

function safeObjectId(id) {
  if (!id || typeof id !== "string") {
    return null;
  }
  if (!/^[a-fA-F0-9]{24}$/.test(id)) {
    return null;
  }
  return new mongoose.Types.ObjectId(id);
}

function extractSignals(posts) {
  const keywordCounts = new Map();
  const bigramCounts = new Map();
  const accountCounts = new Map();
  let retweetCount = 0;

  for (const post of posts) {
    accountCounts.set(post.account, (accountCounts.get(post.account) ?? 0) + 1);
    if (post?.metadata?.isRetweet === true) {
      retweetCount += 1;
    }

    const tokens = tokenize(post.content);
    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i];
      keywordCounts.set(token, (keywordCounts.get(token) ?? 0) + 1);
      if (i < tokens.length - 1) {
        const bigram = `${token} ${tokens[i + 1]}`;
        bigramCounts.set(bigram, (bigramCounts.get(bigram) ?? 0) + 1);
      }
    }
  }

  const topKeywords = topEntries(keywordCounts, 12);
  const topBigrams = topEntries(bigramCounts, 6);
  const topAccounts = topEntries(accountCounts, 5);
  const maxBigramCount = topBigrams[0]?.count ?? 0;
  const repeatedKeywordCount = [...keywordCounts.values()].filter(
    (count) => count >= 2
  ).length;
  const retweetShare =
    posts.length > 0 ? Number((retweetCount / posts.length).toFixed(4)) : 0;

  return {
    topKeywords,
    topBigrams,
    topAccounts,
    retweetShare,
    maxBigramCount,
    repeatedKeywordCount
  };
}

function buildSummary(cluster, signals) {
  const themes = signals.topKeywords.slice(0, 5).map((item) => item.term);
  const phrase = signals.topBigrams[0]?.term ?? "mixed phrasing";
  const accountLead = signals.topAccounts[0];
  const accountLeadPart = accountLead
    ? `${accountLead.term} contributes ${accountLead.count}/${cluster.postCount} posts`
    : "posting is spread across accounts";

  return `Primary themes center on ${themes.join(
    ", "
  )}. Frequent phrase: "${phrase}". Retweet share is ${Math.round(
    signals.retweetShare * 100
  )}% and ${accountLeadPart}.`;
}

const [
  mongoUriWithDb = "mongodb://127.0.0.1:49829/only-facts",
  explicitRunId = "",
  minUniqueAccountsArg = "0",
  maxRetweetShareArg = "1",
  maxClustersArg = "5",
  minTopBigramCountArg = "2",
  minRepeatedKeywordCountArg = "2"
] = process.argv.slice(2);

const minUniqueAccounts = Number(minUniqueAccountsArg);
const maxRetweetShare = Number(maxRetweetShareArg);
const maxClusters = Number(maxClustersArg);
const minTopBigramCount = Number(minTopBigramCountArg);
const minRepeatedKeywordCount = Number(minRepeatedKeywordCountArg);

if (!Number.isFinite(minUniqueAccounts) || minUniqueAccounts < 0) {
  throw new Error(`Invalid minUniqueAccounts value: ${minUniqueAccountsArg}`);
}
if (!Number.isFinite(maxRetweetShare) || maxRetweetShare < 0 || maxRetweetShare > 1) {
  throw new Error(`Invalid maxRetweetShare value: ${maxRetweetShareArg}`);
}
if (!Number.isFinite(maxClusters) || maxClusters <= 0) {
  throw new Error(`Invalid maxClusters value: ${maxClustersArg}`);
}
if (!Number.isFinite(minTopBigramCount) || minTopBigramCount < 1) {
  throw new Error(`Invalid minTopBigramCount value: ${minTopBigramCountArg}`);
}
if (!Number.isFinite(minRepeatedKeywordCount) || minRepeatedKeywordCount < 1) {
  throw new Error(
    `Invalid minRepeatedKeywordCount value: ${minRepeatedKeywordCountArg}`
  );
}

await mongoose.connect(mongoUriWithDb);

const db = mongoose.connection.db;
const clusterCol = db.collection("baseline_clusters");
const postsCol = db.collection("test_posts");

let runId = explicitRunId;
if (!runId) {
  const latest = await clusterCol.find({}).sort({ createdAt: -1 }).limit(1).toArray();
  runId = latest[0]?.runId ?? "";
}

if (!runId) {
  console.log(JSON.stringify({ status: "no-data", message: "No baseline_clusters found" }, null, 2));
  await mongoose.disconnect();
  process.exit(0);
}

const topClusters = await clusterCol
  .find({
    runId,
    "coordination.uniqueAccountCount": { $gte: minUniqueAccounts },
    "coordination.retweetShare": { $lte: maxRetweetShare }
  })
  .sort({ "coordination.postCount": -1, createdAt: -1 })
  .limit(maxClusters * 50)
  .toArray();

const analyzed = [];
for (const cluster of topClusters) {
  if (analyzed.length >= maxClusters) {
    break;
  }

  const objectIds = cluster.postIds
    .map((id) => safeObjectId(id))
    .filter((id) => id !== null);

  const posts = objectIds.length
    ? await postsCol
        .find(
          { _id: { $in: objectIds } },
          { projection: { account: 1, content: 1, metadata: 1, date: 1 } }
        )
        .toArray()
    : [];

  const signals = extractSignals(posts);
  const passesCoherence =
    signals.maxBigramCount >= minTopBigramCount &&
    signals.repeatedKeywordCount >= minRepeatedKeywordCount;
  if (!passesCoherence) {
    continue;
  }

  analyzed.push({
    runId,
    clusterId: cluster.clusterId,
    postCount: cluster.coordination?.postCount ?? cluster.postIds.length,
    uniqueAccountCount:
      cluster.coordination?.uniqueAccountCount ?? cluster.accountIds?.length ?? 0,
    windowStart: cluster.windowStart,
    windowEnd: cluster.windowEnd,
    topKeywords: signals.topKeywords,
    topBigrams: signals.topBigrams,
    topAccounts: signals.topAccounts,
    retweetShare: signals.retweetShare,
    maxBigramCount: signals.maxBigramCount,
    repeatedKeywordCount: signals.repeatedKeywordCount,
    contentSummary: buildSummary(
      {
        postCount: cluster.coordination?.postCount ?? cluster.postIds.length
      },
      signals
    )
  });
}

console.log(
  JSON.stringify(
    {
      status: "ok",
      runId,
      filters: {
        minUniqueAccounts,
        maxRetweetShare,
        maxClusters,
        minTopBigramCount,
        minRepeatedKeywordCount
      },
      analyzedClusterCount: analyzed.length,
      clusters: analyzed
    },
    null,
    2
  )
);

await mongoose.disconnect();
