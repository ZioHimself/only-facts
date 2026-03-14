import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../db/index.js';
import { BaselineClusterModel } from '../models/baseline-cluster.js';
import { TestPostModel } from '../models/test-post.js';
import { buildBotBehaviorSignals } from '../services/bot-behavior-signals.js';
import { buildCoordinationSignals } from '../services/coordination-signals.js';
import { clusterByTfIdfTimeWindows } from '../services/tfidf-time-window-clustering.js';
import type {
  BaselineClusteringPost,
  BaselineNarrativeCluster,
  BotBehaviorSignals,
  TfIdfTimeWindowConfig,
} from '../types/clustering.js';

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
  readonly topN: number;
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
  topN: 5,
};

function parseNumberFlag(value: string | undefined, fallback: number, flagName: string): number {
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
    limit: args.has('--limit') ? parseNumberFlag(args.get('--limit'), 0, '--limit') : null,
    topN: parseNumberFlag(args.get('--top-n'), DEFAULT_OPTIONS.topN, '--top-n'),
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

function toClusteringConfig(options: CliOptions): TfIdfTimeWindowConfig {
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
    .select({
      _id: 1,
      date: 1,
      account: 1,
      content: 1,
      referencePostId: 1,
      'metadata.language': 1,
      'metadata.isRetweet': 1,
      'metadata.followers': 1,
      'metadata.following': 1,
      'metadata.updates': 1,
    })
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
    referencePostId: doc.referencePostId ?? null,
    isRetweet: doc.metadata?.isRetweet ?? null,
    followers: doc.metadata?.followers ?? null,
    following: doc.metadata?.following ?? null,
    updates: doc.metadata?.updates ?? null,
  }));
}

function enrichClustersWithCoordination(
  clusters: BaselineNarrativeCluster[],
  posts: BaselineClusteringPost[]
): BaselineNarrativeCluster[] {
  const postsById = new Map<string, BaselineClusteringPost>();
  for (const post of posts) {
    postsById.set(post.id, post);
  }

  return clusters.map((cluster) => ({
    ...cluster,
    coordination: buildCoordinationSignals(cluster, postsById),
    botBehavior: null,
  }));
}

async function persistClusters(
  runId: string,
  config: TfIdfTimeWindowConfig,
  clusters: BaselineNarrativeCluster[]
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
      coordination: cluster.coordination,
      botBehavior: null,
      createdAt: new Date(),
    })),
    { ordered: false }
  );
}

function toObjectId(postId: string): mongoose.Types.ObjectId | null {
  return /^[a-fA-F0-9]{24}$/.test(postId) ? new mongoose.Types.ObjectId(postId) : null;
}

async function runBotAnalysis(runId: string): Promise<void> {
  const clusters = await BaselineClusterModel.find({ runId })
    .select({ _id: 1, postIds: 1, accountIds: 1 })
    .lean();
  if (clusters.length === 0) {
    return;
  }

  const uniquePostIds = new Set<string>();
  for (const cluster of clusters) {
    for (const postId of cluster.postIds) {
      uniquePostIds.add(postId);
    }
  }

  const objectIds = [...uniquePostIds]
    .map((postId) => toObjectId(postId))
    .filter((postId): postId is mongoose.Types.ObjectId => postId !== null);

  const docs = await TestPostModel.find({ _id: { $in: objectIds } })
    .select({
      _id: 1,
      date: 1,
      account: 1,
      content: 1,
      referencePostId: 1,
      'metadata.language': 1,
      'metadata.isRetweet': 1,
      'metadata.followers': 1,
      'metadata.following': 1,
      'metadata.updates': 1,
    })
    .lean();

  const postsById = new Map<string, BaselineClusteringPost>();
  for (const doc of docs) {
    postsById.set(String(doc._id), {
      id: String(doc._id),
      date: new Date(doc.date),
      account: doc.account,
      content: doc.content,
      language: doc.metadata?.language ?? null,
      referencePostId: doc.referencePostId ?? null,
      isRetweet: doc.metadata?.isRetweet ?? null,
      followers: doc.metadata?.followers ?? null,
      following: doc.metadata?.following ?? null,
      updates: doc.metadata?.updates ?? null,
    });
  }

  const operations = clusters.map((cluster) => ({
    updateOne: {
      filter: { _id: cluster._id },
      update: {
        $set: {
          botBehavior: buildBotBehaviorSignals(
            { postIds: cluster.postIds, accountIds: cluster.accountIds },
            postsById
          ),
        },
      },
    },
  }));

  if (operations.length > 0) {
    await BaselineClusterModel.bulkWrite(operations, { ordered: false });
  }
}

type ClusterForReport = {
  clusterId: string;
  topTerms: string[];
  coordination: {
    postCount: number;
  };
  botBehavior: BotBehaviorSignals;
};

function conciseClusterLine(label: string, cluster: ClusterForReport | null): string {
  if (!cluster) {
    return `${label}: no cluster found`;
  }
  const keywords = cluster.topTerms.slice(0, 6).join(', ');
  return `${label}: cluster=${cluster.clusterId}, size=${cluster.coordination.postCount}, botLikelihood=${cluster.botBehavior.botLikelihoodScore}, keywords=[${keywords}]`;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const config = toClusteringConfig(options);
  const runId = `baseline-${new Date().toISOString()}`;

  await connectDB();

  try {
    // Step 1: clustering + coordination
    const posts = await fetchPosts(options);
    if (posts.length === 0) {
      console.log('No posts found for the selected filters.');
      return;
    }
    const clusteringResult = clusterByTfIdfTimeWindows(posts, config);
    const clusters = enrichClustersWithCoordination(clusteringResult.clusters, posts);
    await persistClusters(runId, config, clusters);

    // Step 2: bot behavior analysis
    await runBotAnalysis(runId);

    // Step 3: top bot vs top organic summary
    const reportQuery = {
      runId,
      botBehavior: { $ne: null },
    };

    const [topBotCluster] = (await BaselineClusterModel.find(reportQuery)
      .sort({ 'botBehavior.botLikelihoodScore': -1, 'coordination.postCount': -1 })
      .limit(options.topN)
      .select({ clusterId: 1, topTerms: 1, coordination: 1, botBehavior: 1 })
      .lean()) as ClusterForReport[];

    const [topOrganicCluster] = (await BaselineClusterModel.find(reportQuery)
      .sort({ 'botBehavior.botLikelihoodScore': 1, 'coordination.postCount': -1 })
      .limit(options.topN)
      .select({ clusterId: 1, topTerms: 1, coordination: 1, botBehavior: 1 })
      .lean()) as ClusterForReport[];

    console.log(
      JSON.stringify(
        {
          runId,
          config,
          totalInputPosts: clusteringResult.totalInputPosts,
          totalWindows: clusteringResult.totalWindows,
          totalClusters: clusteringResult.totalClusters,
          droppedSmallClusters: clusteringResult.droppedSmallClusters,
        },
        null,
        2
      )
    );
    console.log('--- concise-analysis ---');
    console.log(conciseClusterLine('Top bot-like cluster', topBotCluster ?? null));
    console.log(conciseClusterLine('Top organic-like cluster', topOrganicCluster ?? null));
  } finally {
    await disconnectDB();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`Cluster pipeline failed: ${message}`);
  process.exit(1);
});
