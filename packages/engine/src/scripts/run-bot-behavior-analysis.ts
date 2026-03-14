import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../db/index.js';
import { BaselineClusterModel } from '../models/baseline-cluster.js';
import { TestPostModel } from '../models/test-post.js';
import { buildBotBehaviorSignals } from '../services/bot-behavior-signals.js';
import type { BaselineClusteringPost } from '../types/clustering.js';

interface CliOptions {
  readonly runId: string | null;
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
    runId: args.get('--run-id') || null,
  };
}

function toObjectId(postId: string): mongoose.Types.ObjectId | null {
  return /^[a-fA-F0-9]{24}$/.test(postId) ? new mongoose.Types.ObjectId(postId) : null;
}

async function resolveRunId(explicitRunId: string | null): Promise<string | null> {
  if (explicitRunId) {
    return explicitRunId;
  }
  const latest = await BaselineClusterModel.findOne({})
    .sort({ createdAt: -1 })
    .select({ runId: 1 })
    .lean();
  return latest?.runId ?? null;
}

function toPostMap(
  docs: Array<{
    _id: mongoose.Types.ObjectId;
    date: Date;
    account: string;
    content: string;
    referencePostId?: string | null;
    metadata?: {
      language?: string | null;
      isRetweet?: boolean | null;
      followers?: number | null;
      following?: number | null;
      updates?: number | null;
    };
  }>
): Map<string, BaselineClusteringPost> {
  const map = new Map<string, BaselineClusteringPost>();
  for (const doc of docs) {
    map.set(String(doc._id), {
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
  return map;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  await connectDB();

  try {
    const runId = await resolveRunId(options.runId);
    if (!runId) {
      console.log('No baseline clustering runs found.');
      return;
    }

    const clusters = await BaselineClusterModel.find({ runId })
      .select({ clusterId: 1, postIds: 1, accountIds: 1 })
      .lean();
    if (clusters.length === 0) {
      console.log(`No clusters found for runId=${runId}`);
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

    const posts = await TestPostModel.find({ _id: { $in: objectIds } })
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
    const postsById = toPostMap(posts);

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

    const summary = await BaselineClusterModel.aggregate([
      { $match: { runId, botBehavior: { $ne: null } } },
      {
        $group: {
          _id: null,
          analyzedClusters: { $sum: 1 },
          avgBotLikelihood: { $avg: '$botBehavior.botLikelihoodScore' },
          maxBotLikelihood: { $max: '$botBehavior.botLikelihoodScore' },
        },
      },
    ]);

    console.log(
      JSON.stringify(
        {
          runId,
          analyzedClusters: summary[0]?.analyzedClusters ?? 0,
          averageBotLikelihood: Number((summary[0]?.avgBotLikelihood ?? 0).toFixed(2)),
          maxBotLikelihood: Number((summary[0]?.maxBotLikelihood ?? 0).toFixed(2)),
        },
        null,
        2
      )
    );
  } finally {
    await disconnectDB();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`Bot behavior analysis failed: ${message}`);
  process.exit(1);
});
