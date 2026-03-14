import { connectDB, disconnectDB } from '../db/index.js';
import { BaselineClusterModel } from '../models/baseline-cluster.js';
import { TestPostModel } from '../models/test-post.js';
import { clusterByTfIdfTimeWindows } from '../services/tfidf-time-window-clustering.js';
import type { BaselineClusteringPost, TfIdfTimeWindowConfig } from '../types/clustering.js';

interface CliOptions {
  readonly windowHours: number;
  readonly similarityThreshold: number;
  readonly minClusterSize: number;
  readonly minTokenLength: number;
  readonly topTermsPerCluster: number;
  readonly language: string | null;
  readonly startDate: Date | null;
  readonly endDate: Date | null;
  readonly limit: number | null;
}

const DEFAULT_OPTIONS: CliOptions = {
  windowHours: 24,
  similarityThreshold: 0.3,
  minClusterSize: 3,
  minTokenLength: 3,
  topTermsPerCluster: 8,
  language: null,
  startDate: null,
  endDate: null,
  limit: null,
};

function parseNumberFlag(
  value: string | undefined,
  fallback: number,
  flagName: string
): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric value for ${flagName}: ${value}`);
  }
  return parsed;
}

function parseDateFlag(value: string | undefined, flagName: string): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date value for ${flagName}: ${value}`);
  }
  return parsed;
}

function parseArgs(argv: string[]): CliOptions {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      continue;
    }
    args.set(token, argv[i + 1] ?? '');
    i += 1;
  }

  return {
    windowHours: parseNumberFlag(args.get('--window-hours'), DEFAULT_OPTIONS.windowHours, '--window-hours'),
    similarityThreshold: parseNumberFlag(
      args.get('--similarity-threshold'),
      DEFAULT_OPTIONS.similarityThreshold,
      '--similarity-threshold'
    ),
    minClusterSize: parseNumberFlag(
      args.get('--min-cluster-size'),
      DEFAULT_OPTIONS.minClusterSize,
      '--min-cluster-size'
    ),
    minTokenLength: parseNumberFlag(
      args.get('--min-token-length'),
      DEFAULT_OPTIONS.minTokenLength,
      '--min-token-length'
    ),
    topTermsPerCluster: parseNumberFlag(
      args.get('--top-terms'),
      DEFAULT_OPTIONS.topTermsPerCluster,
      '--top-terms'
    ),
    language: args.get('--language') || null,
    startDate: parseDateFlag(args.get('--start-date'), '--start-date'),
    endDate: parseDateFlag(args.get('--end-date'), '--end-date'),
    limit: args.has('--limit')
      ? parseNumberFlag(args.get('--limit'), 0, '--limit')
      : null,
  };
}

function buildQuery(options: CliOptions): Record<string, unknown> {
  const query: Record<string, unknown> = {};
  if (options.language) {
    query['metadata.language'] = options.language;
  }
  if (options.startDate || options.endDate) {
    query.date = {};
    if (options.startDate) {
      (query.date as Record<string, Date>).$gte = options.startDate;
    }
    if (options.endDate) {
      (query.date as Record<string, Date>).$lte = options.endDate;
    }
  }
  return query;
}

function toConfig(options: CliOptions): TfIdfTimeWindowConfig {
  return {
    windowHours: options.windowHours,
    similarityThreshold: options.similarityThreshold,
    minClusterSize: options.minClusterSize,
    minTokenLength: options.minTokenLength,
    topTermsPerCluster: options.topTermsPerCluster,
  };
}

async function fetchPosts(options: CliOptions): Promise<BaselineClusteringPost[]> {
  let query = TestPostModel.find(buildQuery(options))
    .sort({ date: 1 })
    .select({ _id: 1, date: 1, account: 1, content: 1, 'metadata.language': 1 })
    .lean();

  if (options.limit && options.limit > 0) {
    query = query.limit(options.limit);
  }

  const docs = await query.exec();
  return docs.map((doc) => ({
    id: String(doc._id),
    date: new Date(doc.date),
    account: doc.account,
    content: doc.content,
    language: doc.metadata?.language ?? null,
  }));
}

async function persistClusters(
  runId: string,
  config: TfIdfTimeWindowConfig,
  clusters: ReturnType<typeof clusterByTfIdfTimeWindows>['clusters']
): Promise<void> {
  await BaselineClusterModel.deleteMany({ runId });
  if (clusters.length === 0) {
    return;
  }

  await BaselineClusterModel.insertMany(
    clusters.map((cluster) => ({
      runId,
      config,
      clusterId: cluster.clusterId,
      windowStart: cluster.windowStart,
      windowEnd: cluster.windowEnd,
      postIds: cluster.postIds,
      accountIds: cluster.accountIds,
      topTerms: cluster.topTerms,
      centroidSize: cluster.centroidSize,
      createdAt: new Date(),
    })),
    { ordered: false }
  );
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const config = toConfig(options);
  const runId = `baseline-${new Date().toISOString()}`;

  await connectDB();

  try {
    const posts = await fetchPosts(options);
    if (posts.length === 0) {
      console.log('No posts found for the selected filters.');
      return;
    }

    console.log(`Loaded ${posts.length} posts for clustering`);
    const result = clusterByTfIdfTimeWindows(posts, config);
    await persistClusters(runId, config, result.clusters);

    const summary = {
      runId,
      config,
      totalInputPosts: result.totalInputPosts,
      totalWindows: result.totalWindows,
      totalClusters: result.totalClusters,
      droppedSmallClusters: result.droppedSmallClusters,
    };
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await disconnectDB();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`Baseline clustering failed: ${message}`);
  process.exit(1);
});
