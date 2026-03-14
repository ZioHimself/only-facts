/**
 * Full enrichment pipeline — single script combining:
 *   run-account-cluster  : TF-IDF cosine clustering, account / followers / following
 *   run-enrich-update    : spam likelihood, daily emotion, misinformation effectiveness
 *
 * Source DB : only-facts       (test_posts)
 * Output DB : cluster_only_facts
 * Collections written:
 *   account_enriched_clusters  – one document per clustered post, fully enriched
 *   daily_emotion              – one document per calendar day
 *
 * Each account_enriched_clusters document contains:
 *   account, postedAt, followers, following,
 *   content, language, reposts,
 *   sentiment [0,1], emotionalTone,
 *   misinformationScore [0,1], scoreComponents,
 *   spamLikelihood [0,1],
 *   misinformationEffectiveness [0,1], effectivenessComponents,
 *   dailyDominantEmotion, dailyDangerLevel,
 *   clusterId, clusterSize, topTerms, windowStart, windowEnd
 */

import mongoose, { Schema, Connection } from 'mongoose';
import { connectDB, disconnectDB } from '../db/index.js';
import { TestPostModel } from '../models/test-post.js';
import { clusterByTfIdfTimeWindows } from '../services/tfidf-time-window-clustering.js';
import type { BaselineClusteringPost, TfIdfTimeWindowConfig } from '../types/clustering.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Emotion = 'anger' | 'fear' | 'disgust' | 'sadness' | 'joy' | 'neutral';

interface RawPost {
  _id: mongoose.Types.ObjectId;
  date: Date;
  account: string;
  content: string;
  metadata?: {
    region?: string | null;
    language?: string | null;
    followers?: number | null;
    following?: number | null;
    updates?: number | null;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Output schemas
// ─────────────────────────────────────────────────────────────────────────────

const accountEnrichedSchema = new Schema(
  {
    runId: { type: String, required: true, index: true },

    // cluster context
    clusterId: { type: String, required: true, index: true },
    clusterSize: Number,
    topTerms: [String],
    windowStart: Date,
    windowEnd: Date,

    // post identity
    postId: String,
    account: { type: String, index: true },
    postedAt: { type: Date, index: true },
    language: String,
    content: String,
    reposts: { type: Number, default: null },

    // account metrics
    followers: { type: Number, default: null },
    following: { type: Number, default: null },

    // NLP
    sentiment: Number, // [0,1]
    emotionalTone: String, // anger | fear | disgust | sadness | joy | neutral

    // scores
    misinformationScore: { type: Number, index: true },
    spamLikelihood: { type: Number, index: true },
    misinformationEffectiveness: { type: Number, index: true },

    scoreComponents: Schema.Types.Mixed,
    effectivenessComponents: Schema.Types.Mixed,

    // daily emotion context
    dailyDominantEmotion: String,
    dailyDangerLevel: Number,
  },
  { collection: 'account_enriched_clusters', versionKey: false }
);

const dailyEmotionSchema = new Schema(
  {
    date: { type: String, required: true, index: true },
    dominantEmotion: { type: String, required: true },
    dominantEmotionDangerLevel: Number,
    emotionCounts: {
      anger: Number,
      fear: Number,
      disgust: Number,
      sadness: Number,
      joy: Number,
      neutral: Number,
    },
    totalPosts: Number,
  },
  { collection: 'daily_emotion', versionKey: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// NLP — lexicons
// ─────────────────────────────────────────────────────────────────────────────

const POSITIVE_WORDS = new Set([
  'good',
  'great',
  'love',
  'happy',
  'excellent',
  'amazing',
  'wonderful',
  'best',
  'hope',
  'peace',
  'joy',
  'beautiful',
  'freedom',
  'win',
  'success',
  'support',
  'thank',
  'proud',
  'strong',
  'brave',
  'trust',
  'safe',
  'care',
  'help',
  'kind',
  'fair',
  'truth',
  'honest',
  'real',
  'protect',
  'right',
  'benefit',
  'improve',
  'progress',
  'unite',
  'together',
  'celebrate',
  'blessed',
  'inspire',
  'hero',
  'victory',
  'positive',
  'clean',
  'justice',
  'awesome',
  'brilliant',
  'fantastic',
]);

const NEGATIVE_WORDS = new Set([
  'bad',
  'hate',
  'terrible',
  'awful',
  'horrible',
  'sad',
  'angry',
  'evil',
  'wrong',
  'corrupt',
  'fake',
  'dangerous',
  'destroy',
  'fail',
  'war',
  'death',
  'fear',
  'threat',
  'crisis',
  'blame',
  'attack',
  'lie',
  'disgrace',
  'stupid',
  'idiot',
  'criminal',
  'traitor',
  'loser',
  'cheat',
  'fraud',
  'scam',
  'hoax',
  'racist',
  'shame',
  'outrage',
  'violence',
  'illegal',
  'murder',
  'terror',
  'enemy',
  'radical',
  'chaos',
  'collapse',
  'revolt',
  'insane',
  'disgust',
  'protest',
  'riot',
  'ban',
  'boycott',
  'abuse',
  'steal',
  'kill',
]);

const ANGER_WORDS = new Set([
  'angry',
  'outrage',
  'fury',
  'rage',
  'hate',
  'disgusted',
  'infuriating',
  'unacceptable',
  'protest',
  'boycott',
  'corrupt',
  'traitor',
  'liar',
  'criminal',
  'fraud',
  'scam',
  'attack',
  'blame',
  'wrong',
  'insane',
  'stupid',
  'idiot',
  'moron',
  'fail',
  'destroy',
  'revolt',
  'ban',
  'radical',
  'abuse',
]);
const FEAR_WORDS = new Set([
  'fear',
  'afraid',
  'scared',
  'danger',
  'threat',
  'warning',
  'risk',
  'terror',
  'panic',
  'alarm',
  'crisis',
  'emergency',
  'dangerous',
  'unsafe',
  'warn',
  'attack',
  'collapse',
  'invasion',
  'takeover',
  'death',
  'kill',
  'murder',
  'violent',
  'chaos',
]);
const DISGUST_WORDS = new Set([
  'disgusting',
  'awful',
  'vile',
  'repulsive',
  'sick',
  'shameful',
  'filthy',
  'nasty',
  'gross',
  'horrible',
  'repugnant',
  'obscene',
  'corrupt',
  'evil',
  'fake',
  'fraud',
  'hoax',
  'garbage',
  'trash',
  'pathetic',
  'loser',
  'coward',
]);
const SADNESS_WORDS = new Set([
  'sad',
  'grief',
  'mourn',
  'loss',
  'tragedy',
  'crying',
  'heartbreak',
  'devastated',
  'sorrow',
  'depressed',
  'hopeless',
  'desperate',
  'lonely',
  'broken',
  'suffer',
  'pain',
  'hurt',
  'cry',
  'tear',
  'miss',
  'fail',
  'death',
  'gone',
  'lost',
]);
const JOY_WORDS = new Set([
  'happy',
  'joy',
  'excited',
  'amazing',
  'wonderful',
  'celebrate',
  'love',
  'great',
  'fantastic',
  'awesome',
  'brilliant',
  'best',
  'win',
  'victory',
  'proud',
  'thank',
  'blessed',
  'inspire',
  'hero',
  'beautiful',
  'hope',
  'peace',
  'success',
  'freedom',
]);

interface NlpResult {
  sentiment: number;
  emotionalTone: Emotion;
  emotionScore: number;
  sentimentExtremity: number;
}

function analyzeText(text: string): NlpResult {
  const tokens = text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '')
    .replace(/@\w+/g, '')
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);

  const total = Math.max(tokens.length, 1);
  let pos = 0;
  let neg = 0;
  let anger = 0;
  let fear = 0;
  let disgust = 0;
  let sadness = 0;
  let joy_ = 0;

  for (const t of tokens) {
    if (POSITIVE_WORDS.has(t)) pos += 1;
    if (NEGATIVE_WORDS.has(t)) neg += 1;
    if (ANGER_WORDS.has(t)) anger += 1;
    if (FEAR_WORDS.has(t)) fear += 1;
    if (DISGUST_WORDS.has(t)) disgust += 1;
    if (SADNESS_WORDS.has(t)) sadness += 1;
    if (JOY_WORDS.has(t)) joy_ += 1;
  }

  const sentiment = clamp(((pos - neg) / total + 1) / 2);
  const sentimentExtremity = Math.abs(sentiment - 0.5) * 2;

  const emotionMap: [Emotion, number][] = [
    ['anger', anger],
    ['fear', fear],
    ['disgust', disgust],
    ['sadness', sadness],
    ['joy', joy_],
  ];
  emotionMap.sort((a, b) => b[1] - a[1]);
  const [topEmotion, topCount] = emotionMap[0];
  const emotionalTone: Emotion = topCount > 0 ? topEmotion : 'neutral';
  const emotionScore = clamp(topCount / Math.max(total * 0.05, 1));

  return { sentiment, emotionalTone, emotionScore, sentimentExtremity };
}

// ─────────────────────────────────────────────────────────────────────────────
// Score helpers
// ─────────────────────────────────────────────────────────────────────────────

function clamp(v: number): number {
  return Math.min(1, Math.max(0, v));
}

const EMOTION_DANGER: Record<string, number> = {
  anger: 1.0,
  fear: 1.0,
  disgust: 0.8,
  sadness: 0.5,
  joy: 0.1,
  neutral: 0.0,
};
const EMOTION_FAMILY: Record<string, string> = {
  anger: 'negative-active',
  fear: 'negative-active',
  disgust: 'negative-passive',
  sadness: 'negative-passive',
  joy: 'positive',
  neutral: 'neutral',
};

function computeMisinformationScore(
  nlp: NlpResult,
  coordinationScore: number,
  velocityScore: number
): { score: number; components: Record<string, number> } {
  const emotionScore = clamp(nlp.emotionScore * (EMOTION_DANGER[nlp.emotionalTone] ?? 0));
  const components = {
    coordinationScore: clamp(coordinationScore),
    emotionScore,
    sentimentExtremity: clamp(nlp.sentimentExtremity),
    velocityScore: clamp(velocityScore),
  };
  return {
    score: clamp(
      0.35 * components.coordinationScore +
        0.25 * components.emotionScore +
        0.2 * components.sentimentExtremity +
        0.2 * components.velocityScore
    ),
    components,
  };
}

function computeSpamLikelihood(
  content: string,
  velocityScore: number,
  coordinationScore: number
): number {
  const mentionDensity = clamp((content.match(/@\w+/g) ?? []).length / 5);
  const hasUrl = /https?:\/\/\S+/.test(content) ? 1 : 0;
  const brevity = clamp(1 - content.length / 200);
  return clamp(
    0.3 * velocityScore +
      0.25 * mentionDensity +
      0.2 * hasUrl +
      0.15 * coordinationScore +
      0.1 * brevity
  );
}

function computeEffectiveness(
  misinformationScore: number,
  emotionalTone: string,
  dailyDominantEmotion: string,
  dailyDangerLevel: number,
  authorAvgMisinfoScore: number
): { score: number; components: Record<string, number> } {
  let amplification: number;
  if (emotionalTone === dailyDominantEmotion) amplification = 1.0;
  else if (EMOTION_FAMILY[emotionalTone] === EMOTION_FAMILY[dailyDominantEmotion])
    amplification = 0.65;
  else amplification = 0.15;

  const emotionAmplification = clamp(amplification * dailyDangerLevel);
  const score = clamp(
    0.4 * misinformationScore + 0.35 * emotionAmplification + 0.25 * clamp(authorAvgMisinfoScore)
  );
  return {
    score: r3(score),
    components: {
      misinformationScore: r3(misinformationScore),
      emotionAmplification: r3(emotionAmplification),
      authorToneScore: r3(authorAvgMisinfoScore),
    },
  };
}

function r3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

// ─────────────────────────────────────────────────────────────────────────────
// Optimal similarity-threshold search — Calinski-Harabasz criterion
//
// For every candidate threshold we run a greedy cosine clustering on a small
// sample, then compute the CH ratio:
//
//   CH = (SSB / (K-1)) / (SSW / (N-K))
//
// where SSB is between-cluster scatter (centroids far from global centroid)
// and SSW is within-cluster scatter (posts close to their centroid).
// A high CH score means tight, well-separated clusters — we pick that threshold.
// ─────────────────────────────────────────────────────────────────────────────

type SparseVec = Map<string, number>;

const THRESHOLD_CANDIDATES = [
  0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7,
];
const SEARCH_SAMPLE_SIZE = 3000;

const SEARCH_STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'has',
  'he',
  'in',
  'is',
  'it',
  'its',
  'of',
  'on',
  'that',
  'the',
  'to',
  'was',
  'were',
  'will',
  'with',
  'you',
  'your',
  'i',
  'me',
  'my',
  'we',
  'our',
  'they',
  'them',
  'this',
  'have',
  'had',
  'not',
  'but',
  'what',
  'so',
  'if',
  'about',
  'just',
  'can',
  'how',
  'when',
  'us',
  'do',
  'did',
]);

function tokenizeSample(text: string, minLen: number): string[] {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/@\w+/g, ' ')
    .replace(/[^a-z0-9#_]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= minLen && !SEARCH_STOP_WORDS.has(t) && !/^\d+$/.test(t));
}

function buildSampleVectors(docs: string[][]): SparseVec[] {
  const N = docs.length;
  const df = new Map<string, number>();
  for (const tokens of docs) {
    for (const t of new Set(tokens)) df.set(t, (df.get(t) ?? 0) + 1);
  }
  return docs.map((tokens) => {
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    const vec: SparseVec = new Map();
    for (const [t, cnt] of tf) {
      const tfw = cnt / tokens.length;
      const idf = Math.log((N + 1) / ((df.get(t) ?? 1) + 1)) + 1;
      vec.set(t, tfw * idf);
    }
    const norm = sVecNorm(vec);
    if (norm === 0) return vec;
    for (const [t, w] of vec) vec.set(t, w / norm);
    return vec;
  });
}

function sVecNorm(v: SparseVec): number {
  let s = 0;
  for (const w of v.values()) s += w * w;
  return Math.sqrt(s);
}

function sCosSim(a: SparseVec, b: SparseVec): number {
  const na = sVecNorm(a);
  const nb = sVecNorm(b);
  if (na === 0 || nb === 0) return 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [t, w] of small) dot += w * (large.get(t) ?? 0);
  return dot / (na * nb);
}

function sAddWeighted(centroid: SparseVec, vec: SparseVec, weight: number): void {
  for (const [t, w] of vec) centroid.set(t, (centroid.get(t) ?? 0) + w * weight);
}

function sNormalize(centroid: SparseVec): void {
  const norm = sVecNorm(centroid);
  if (norm === 0) return;
  for (const [t, w] of centroid) centroid.set(t, w / norm);
}

function greedyCluster(
  vectors: SparseVec[],
  threshold: number
): { assignments: number[]; centroids: SparseVec[]; sizes: number[] } {
  const assignments: number[] = [];
  // sums  : raw (un-normalised) sum of all member vectors for each cluster.
  //         Used as the accumulator so every member contributes equally.
  // centroids : normalize(sums[k]), recomputed from the true sum after each
  //         addition.  Used only for similarity comparisons.
  const sums: SparseVec[] = [];
  const centroids: SparseVec[] = [];
  const sizes: number[] = [];

  for (const vec of vectors) {
    let bestK = -1;
    let bestSim = threshold - 1e-9;
    for (let k = 0; k < centroids.length; k++) {
      const sim = sCosSim(vec, centroids[k]);
      if (sim > bestSim) {
        bestSim = sim;
        bestK = k;
      }
    }
    if (bestK >= 0) {
      assignments.push(bestK);
      sAddWeighted(sums[bestK], vec, 1); // accumulate into raw sum
      centroids[bestK] = new Map(sums[bestK]); // derive centroid from true sum
      sNormalize(centroids[bestK]); // normalise once, correctly
      sizes[bestK] += 1;
    } else {
      assignments.push(centroids.length);
      sums.push(new Map(vec)); // raw sum starts as the first vector
      centroids.push(new Map(vec)); // already unit-normalised
      sizes.push(1);
    }
  }
  return { assignments, centroids, sizes };
}

function calinskiHarabasz(
  vectors: SparseVec[],
  assignments: number[],
  centroids: SparseVec[],
  sizes: number[],
  minSize: number
): number {
  // Only count clusters that pass the minimum-size filter
  const validSet = new Set<number>(
    sizes.map((s, k) => (s >= minSize ? k : -1)).filter((k) => k >= 0)
  );
  const K = validSet.size;
  if (K <= 1) return 0;

  const N = vectors.length;

  // Global centroid of all posts in valid clusters
  const globalCentroid: SparseVec = new Map();
  let validN = 0;
  for (let i = 0; i < N; i++) {
    if (validSet.has(assignments[i])) {
      sAddWeighted(globalCentroid, vectors[i], 1);
      validN += 1;
    }
  }
  if (validN <= K) return 0;
  sNormalize(globalCentroid);

  // SSW — within-cluster scatter: sum of cosine distances to cluster centroid
  let SSW = 0;
  for (let i = 0; i < N; i++) {
    if (validSet.has(assignments[i])) {
      SSW += 1 - sCosSim(vectors[i], centroids[assignments[i]]);
    }
  }

  // SSB — between-cluster scatter: weighted centroid distance from global centroid
  let SSB = 0;
  for (const k of validSet) {
    SSB += sizes[k] * (1 - sCosSim(centroids[k], globalCentroid));
  }

  if (SSW <= 0) return 0;
  return SSB / (K - 1) / (SSW / (validN - K));
}

function findOptimalThreshold(
  posts: BaselineClusteringPost[],
  minTokenLength: number,
  minClusterSize: number
): number {
  const sample = posts.length > SEARCH_SAMPLE_SIZE ? posts.slice(0, SEARCH_SAMPLE_SIZE) : posts;

  console.log(`    Vectorising ${sample.length} sample posts…`);
  const tokenized = sample.map((p) => tokenizeSample(p.content, minTokenLength));
  const vectors = buildSampleVectors(tokenized);

  let bestThreshold = 0.3;
  let bestScore = -Infinity;

  console.log('    threshold  │  clusters  │  CH-score');
  console.log('    ───────────┼────────────┼───────────');

  for (const t of THRESHOLD_CANDIDATES) {
    const { assignments, centroids, sizes } = greedyCluster(vectors, t);
    const K = sizes.filter((s) => s >= minClusterSize).length;
    const score = calinskiHarabasz(vectors, assignments, centroids, sizes, minClusterSize);

    const tStr = t.toFixed(2).padStart(9);
    const kStr = String(K).padStart(10);
    const scoreStr = (score > 0 ? score.toFixed(4) : '—').padStart(11);
    console.log(`    ${tStr}  │${kStr}  │${scoreStr}`);

    if (score > bestScore) {
      bestScore = score;
      bestThreshold = t;
    }
  }

  console.log(`\n    ✓ Optimal threshold: ${bestThreshold}  (CH = ${bestScore.toFixed(4)})`);
  return bestThreshold;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────

interface CliOptions {
  windowHours: number;
  similarityThreshold: number | null; // null → auto-detect via CH criterion
  minClusterSize: number;
  minTokenLength: number;
  topTermsPerCluster: number;
  region: string | null;
  startDate: Date | null;
  endDate: Date | null;
  limit: number | null;
  velocityThreshold: number;
}

function parseArgs(argv: string[]): CliOptions {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) {
      args.set(argv[i], argv[i + 1] ?? '');
      i += 1;
    }
  }
  const num = (flag: string, def: number) => {
    const v = args.get(flag);
    if (!v) return def;
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  };
  const date = (flag: string) => {
    const v = args.get(flag);
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  return {
    windowHours: num('--window-hours', 24),
    similarityThreshold: args.has('--similarity-threshold')
      ? num('--similarity-threshold', 0.3)
      : null, // null → auto-detect
    minClusterSize: num('--min-cluster-size', 3),
    minTokenLength: num('--min-token-length', 3),
    topTermsPerCluster: num('--top-terms', 8),
    region: args.get('--region') || args.get('--language') || null,
    startDate: date('--start-date'),
    endDate: date('--end-date'),
    limit: args.has('--limit') ? num('--limit', 50000) : null,
    velocityThreshold: num('--velocity-threshold', 10),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const runId = `pipeline-${new Date().toISOString()}`;

  // Source DB (only-facts)
  await connectDB();

  // Output DB (cluster_only_facts)
  const sourceUri = process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017/only-facts';
  const baseUri = sourceUri.replace(/\/[^/?]+(\?.*)?$/, '');
  const outputUri = `${baseUri}/cluster_only_facts`;
  console.log(`Source : ${sourceUri}`);
  console.log(`Output : ${outputUri}`);

  const outConn: Connection = mongoose.createConnection(outputUri);
  await new Promise<void>((resolve, reject) => {
    outConn.once('open', resolve);
    outConn.once('error', reject);
  });

  const AccountEnrichedModel = outConn.model('AccountEnriched', accountEnrichedSchema);
  const DailyEmotionModel = outConn.model('DailyEmotion', dailyEmotionSchema);

  try {
    // ── 1. Fetch posts ──────────────────────────────────────────────────────
    console.log('\n[1/7] Fetching posts from only-facts…');
    const dbQuery: Record<string, unknown> = {};
    if (opts.region) dbQuery['metadata.region'] = opts.region;
    if (opts.startDate || opts.endDate) {
      const r: Record<string, Date> = {};
      if (opts.startDate) r.$gte = opts.startDate;
      if (opts.endDate) r.$lte = opts.endDate;
      dbQuery.date = r;
    }

    let q = TestPostModel.find(dbQuery)
      .sort({ date: 1 })
      .select({
        _id: 1,
        date: 1,
        account: 1,
        content: 1,
        'metadata.region': 1,
        'metadata.language': 1,
        'metadata.followers': 1,
        'metadata.following': 1,
        'metadata.updates': 1,
      })
      .lean<RawPost[]>();

    if (opts.limit && opts.limit > 0) q = q.limit(opts.limit);
    const rawPosts = await q.exec();

    if (rawPosts.length === 0) {
      console.log('No posts found.');
      return;
    }
    console.log(`    Loaded ${rawPosts.length} posts`);

    // ── 2. Build clustering input ───────────────────────────────────────────
    const clusteringInput: BaselineClusteringPost[] = rawPosts.map((p) => ({
      id: String(p._id),
      date: new Date(p.date),
      account: p.account,
      content: p.content,
      language: p.metadata?.region ?? p.metadata?.language ?? null,
      referencePostId: null,
      isRetweet: null,
      followers: p.metadata?.followers ?? null,
      following: p.metadata?.following ?? null,
      updates: p.metadata?.updates ?? null,
    }));

    // ── 3. Optimal threshold search (Calinski-Harabasz) ─────────────────────
    let similarityThreshold: number;
    if (opts.similarityThreshold !== null) {
      similarityThreshold = opts.similarityThreshold;
      console.log(`\n[2/7] Using fixed similarity threshold: ${similarityThreshold}`);
    } else {
      console.log('\n[2/7] Searching for optimal similarity threshold (Calinski-Harabasz)…');
      similarityThreshold = findOptimalThreshold(
        clusteringInput,
        opts.minTokenLength,
        opts.minClusterSize
      );
    }

    // ── 4. TF-IDF Clustering ────────────────────────────────────────────────
    console.log('\n[4/7] Running TF-IDF cosine clustering…');
    const config: TfIdfTimeWindowConfig = {
      windowHours: opts.windowHours,
      similarityThreshold,
      minClusterSize: opts.minClusterSize,
      minTokenLength: opts.minTokenLength,
      topTermsPerCluster: opts.topTermsPerCluster,
    };

    const clusterResult = clusterByTfIdfTimeWindows(clusteringInput, config);
    console.log(
      `    Found ${clusterResult.totalClusters} clusters (dropped ${clusterResult.droppedSmallClusters} small)`
    );

    // Build post → cluster lookup
    interface ClusterInfo {
      clusterId: string;
      clusterSize: number;
      topTerms: string[];
      windowStart: Date;
      windowEnd: Date;
    }
    const postToCluster = new Map<string, ClusterInfo>();
    const maxClusterSize = Math.max(1, ...clusterResult.clusters.map((c) => c.postIds.length));
    for (const c of clusterResult.clusters) {
      const info: ClusterInfo = {
        clusterId: c.clusterId,
        clusterSize: c.postIds.length,
        topTerms: c.topTerms,
        windowStart: c.windowStart,
        windowEnd: c.windowEnd,
      };
      for (const pid of c.postIds) postToCluster.set(pid, info);
    }

    // ── 3. Account velocity per 24 h window ────────────────────────────────
    console.log('\n[5/7] Computing account velocity + NLP signals…');
    const windowMs = opts.windowHours * 3_600_000;
    const velocityMap = new Map<string, number>();
    for (const p of rawPosts) {
      const key = `${p.account}__${Math.floor(new Date(p.date).getTime() / windowMs)}`;
      velocityMap.set(key, (velocityMap.get(key) ?? 0) + 1);
    }

    // ── 4. NLP + preliminary scores (need misinfo scores first for author avg)
    interface PostWork {
      raw: RawPost;
      cluster: ClusterInfo;
      nlp: NlpResult;
      velocityScore: number;
      coordinationScore: number;
      misinformationScore: number;
      scoreComponents: Record<string, number>;
      spamLikelihood: number;
    }

    const workItems: PostWork[] = [];
    for (const p of rawPosts) {
      const pid = String(p._id);
      const cluster = postToCluster.get(pid);
      if (!cluster) continue;

      const nlp = analyzeText(p.content);
      const bucket = Math.floor(new Date(p.date).getTime() / windowMs);
      const velScore = clamp(
        (velocityMap.get(`${p.account}__${bucket}`) ?? 1) / opts.velocityThreshold
      );
      const coordScore = cluster.clusterSize / maxClusterSize;

      const { score: misinfoScore, components } = computeMisinformationScore(
        nlp,
        coordScore,
        velScore
      );
      const spam = computeSpamLikelihood(p.content, velScore, coordScore);

      workItems.push({
        raw: p,
        cluster,
        nlp,
        velocityScore: velScore,
        coordinationScore: coordScore,
        misinformationScore: misinfoScore,
        scoreComponents: components,
        spamLikelihood: spam,
      });
    }
    console.log(`    ${workItems.length} posts to enrich`);

    // ── 5. Daily emotion + per-author avg (needs misinfo scores) ───────────
    console.log('\n[6/7] Computing daily emotion and author tone…');

    // Per-author average misinfo score
    const authorScoresBucket = new Map<string, number[]>();
    for (const w of workItems) {
      const arr = authorScoresBucket.get(w.raw.account) ?? [];
      arr.push(w.misinformationScore);
      authorScoresBucket.set(w.raw.account, arr);
    }
    const authorAvg = new Map<string, number>();
    for (const [acc, scores] of authorScoresBucket) {
      authorAvg.set(acc, scores.reduce((a, b) => a + b, 0) / scores.length);
    }

    // Daily emotion counts
    const dailyMap = new Map<string, Record<Emotion, number>>();
    for (const w of workItems) {
      const day = new Date(w.raw.date).toISOString().slice(0, 10);
      if (!dailyMap.has(day)) {
        dailyMap.set(day, { anger: 0, fear: 0, disgust: 0, sadness: 0, joy: 0, neutral: 0 });
      }
      const counts = dailyMap.get(day)!;
      const tone = w.nlp.emotionalTone in counts ? w.nlp.emotionalTone : 'neutral';
      counts[tone] += 1;
    }

    interface DailyRecord {
      date: string;
      dominantEmotion: Emotion;
      dominantEmotionDangerLevel: number;
      emotionCounts: Record<Emotion, number>;
      totalPosts: number;
    }
    const dailyRecords: DailyRecord[] = [];
    const dailyDominant = new Map<string, { emotion: Emotion; dangerLevel: number }>();

    for (const [day, counts] of dailyMap) {
      const dominant = (Object.entries(counts) as [Emotion, number][]).sort(
        (a, b) => b[1] - a[1]
      )[0][0];
      const dangerLevel = EMOTION_DANGER[dominant] ?? 0;
      dailyDominant.set(day, { emotion: dominant, dangerLevel });
      dailyRecords.push({
        date: day,
        dominantEmotion: dominant,
        dominantEmotionDangerLevel: dangerLevel,
        emotionCounts: counts,
        totalPosts: Object.values(counts).reduce((a, b) => a + b, 0),
      });
    }

    // Persist daily_emotion
    await DailyEmotionModel.deleteMany({});
    await DailyEmotionModel.insertMany(dailyRecords, { ordered: false });
    console.log(`    Written ${dailyRecords.length} daily emotion records`);

    // ── 6. Build and persist account_enriched_clusters ────────────────────
    console.log('\n[7/7] Writing account_enriched_clusters…');
    await AccountEnrichedModel.deleteMany({ runId });

    const BATCH = 500;
    let written = 0;

    for (let i = 0; i < workItems.length; i += BATCH) {
      const slice = workItems.slice(i, i + BATCH);
      const docs = slice.map((w) => {
        const p = w.raw;
        const day = new Date(p.date).toISOString().slice(0, 10);
        const daily = dailyDominant.get(day) ?? { emotion: 'neutral' as Emotion, dangerLevel: 0 };
        const { score: eff, components: effComp } = computeEffectiveness(
          w.misinformationScore,
          w.nlp.emotionalTone,
          daily.emotion,
          daily.dangerLevel,
          authorAvg.get(p.account) ?? 0
        );

        return {
          runId,
          clusterId: w.cluster.clusterId,
          clusterSize: w.cluster.clusterSize,
          topTerms: w.cluster.topTerms,
          windowStart: w.cluster.windowStart,
          windowEnd: w.cluster.windowEnd,
          postId: String(p._id),
          account: p.account,
          postedAt: new Date(p.date),
          language: p.metadata?.region ?? p.metadata?.language ?? 'unknown',
          content: p.content,
          reposts: p.metadata?.updates != null ? p.metadata.updates : w.cluster.clusterSize - 1,
          followers: p.metadata?.followers ?? null,
          following: p.metadata?.following ?? null,
          sentiment: r3(w.nlp.sentiment),
          emotionalTone: w.nlp.emotionalTone,
          misinformationScore: r3(w.misinformationScore),
          scoreComponents: {
            coordinationScore: r3(w.coordinationScore),
            emotionScore: r3(w.scoreComponents.emotionScore),
            sentimentExtremity: r3(w.scoreComponents.sentimentExtremity),
            velocityScore: r3(w.velocityScore),
          },
          spamLikelihood: r3(w.spamLikelihood),
          misinformationEffectiveness: eff,
          effectivenessComponents: effComp,
          dailyDominantEmotion: daily.emotion,
          dailyDangerLevel: daily.dangerLevel,
        };
      });

      await AccountEnrichedModel.insertMany(docs, { ordered: false });
      written += docs.length;
      process.stdout.write(`\r    Written ${written}/${workItems.length}…`);
    }

    // ── Summary ────────────────────────────────────────────────────────────
    console.log('\n');
    const scores = workItems.map((w) => w.misinformationScore);
    const spam = workItems.map((w) => w.spamLikelihood);
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / Math.max(arr.length, 1);

    const topDangerDays = dailyRecords
      .filter((d) => d.dominantEmotionDangerLevel >= 1)
      .sort((a, b) => b.totalPosts - a.totalPosts)
      .slice(0, 3);

    console.log(
      JSON.stringify(
        {
          runId,
          postsProcessed: rawPosts.length,
          postsClustered: workItems.length,
          clusters: clusterResult.totalClusters,
          dailyEmotionDays: dailyRecords.length,
          misinformation: {
            avg: r3(avg(scores)),
            high: scores.filter((s) => s >= 0.7).length,
            medium: scores.filter((s) => s >= 0.4 && s < 0.7).length,
          },
          spam: {
            avg: r3(avg(spam)),
            high: spam.filter((s) => s >= 0.6).length,
          },
          topDangerDays,
          outputDb: 'cluster_only_facts',
          collections: ['account_enriched_clusters', 'daily_emotion'],
        },
        null,
        2
      )
    );
  } finally {
    await disconnectDB();
    await outConn.close();
  }
}

main().catch((err: unknown) => {
  console.error(`Pipeline failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
