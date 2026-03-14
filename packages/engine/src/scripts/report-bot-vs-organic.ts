import { connectDB, disconnectDB } from '../db/index.js';
import { BaselineClusterModel } from '../models/baseline-cluster.js';

interface CliOptions {
  readonly runId: string | null;
  readonly topN: number;
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

  const topNRaw = Number(args.get('--top-n') ?? '5');
  const topN = Number.isFinite(topNRaw) && topNRaw > 0 ? Math.floor(topNRaw) : 5;

  return {
    runId: args.get('--run-id') || null,
    topN,
  };
}

async function resolveRunId(explicitRunId: string | null): Promise<string | null> {
  if (explicitRunId) {
    return explicitRunId;
  }
  const latest = await BaselineClusterModel.findOne({
    botBehavior: { $ne: null },
  })
    .sort({ createdAt: -1 })
    .select({ runId: 1 })
    .lean();
  return latest?.runId ?? null;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  await connectDB();

  try {
    const runId = await resolveRunId(options.runId);
    if (!runId) {
      console.log('No bot-analyzed clustering run found.');
      return;
    }

    const baseQuery = {
      runId,
      botBehavior: { $ne: null },
    };

    const topBot = await BaselineClusterModel.find(baseQuery)
      .sort({
        'botBehavior.botLikelihoodScore': -1,
        'coordination.postCount': -1,
      })
      .limit(options.topN)
      .select({
        clusterId: 1,
        topTerms: 1,
        coordination: 1,
        botBehavior: 1,
      })
      .lean();

    const topOrganic = await BaselineClusterModel.find(baseQuery)
      .sort({
        'botBehavior.botLikelihoodScore': 1,
        'coordination.postCount': -1,
      })
      .limit(options.topN)
      .select({
        clusterId: 1,
        topTerms: 1,
        coordination: 1,
        botBehavior: 1,
      })
      .lean();

    const normalize = (
      clusters: Array<{
        clusterId: string;
        topTerms: string[];
        coordination: {
          postCount: number;
          uniqueAccountCount: number;
          coordinationScore: number;
        };
        botBehavior: {
          botLikelihoodScore: number;
          suspectedBotAccountShare: number;
          suspectedBotPostShare: number;
          flags: string[];
        };
      }>
    ) =>
      clusters.map((cluster) => ({
        clusterId: cluster.clusterId,
        postCount: cluster.coordination.postCount,
        uniqueAccountCount: cluster.coordination.uniqueAccountCount,
        topTerms: cluster.topTerms.slice(0, 6),
        coordinationScore: cluster.coordination.coordinationScore,
        botLikelihoodScore: cluster.botBehavior.botLikelihoodScore,
        suspectedBotAccountShare: cluster.botBehavior.suspectedBotAccountShare,
        suspectedBotPostShare: cluster.botBehavior.suspectedBotPostShare,
        botFlags: cluster.botBehavior.flags,
      }));

    console.log(
      JSON.stringify(
        {
          runId,
          topN: options.topN,
          topBotClusters: normalize(topBot),
          topOrganicClusters: normalize(topOrganic),
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
  console.error(`Bot vs organic report failed: ${message}`);
  process.exit(1);
});
