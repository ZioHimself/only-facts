import type {
  BaselineClusteringPost,
  BaselineNarrativeCluster,
  BotBehaviorSignals,
  SuspectAccount,
} from '../types/clustering.js';

interface AccountAggregate {
  readonly accountId: string;
  readonly postCount: number;
  readonly retweetShare: number;
  readonly duplicateTextShare: number;
  readonly burstShare10m: number;
  readonly medianInterPostMinutes: number | null;
  readonly followersMedian: number | null;
  readonly updatesMedian: number | null;
  readonly suspicionScore: number;
  readonly flags: string[];
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function normalizeText(content: string): string {
  return content
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/@\w+/g, ' ')
    .replace(/[^a-z0-9#_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function bucketEpoch10m(epochMs: number): number {
  const bucketMs = 10 * 60 * 1000;
  return Math.floor(epochMs / bucketMs) * bucketMs;
}

function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid];
  }
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function interPostMinutes(timestamps: number[]): number[] {
  if (timestamps.length < 2) {
    return [];
  }
  const sorted = [...timestamps].sort((a, b) => a - b);
  const intervals: number[] = [];
  for (let i = 1; i < sorted.length; i += 1) {
    intervals.push((sorted[i] - sorted[i - 1]) / 60000);
  }
  return intervals;
}

function buildAccountAggregate(
  accountId: string,
  posts: BaselineClusteringPost[],
  clusterPostCount: number
): AccountAggregate {
  const postCount = posts.length;
  const retweetCount = posts.reduce((sum, post) => sum + (post.isRetweet ? 1 : 0), 0);
  const retweetShare = postCount > 0 ? retweetCount / postCount : 0;

  const textCounts = new Map<string, number>();
  for (const post of posts) {
    const key = normalizeText(post.content);
    textCounts.set(key, (textCounts.get(key) ?? 0) + 1);
  }
  const maxTextCount = textCounts.size > 0 ? Math.max(...textCounts.values()) : 0;
  const duplicateTextShare = postCount > 0 ? maxTextCount / postCount : 0;

  const bucketCounts = new Map<number, number>();
  for (const post of posts) {
    const bucket = bucketEpoch10m(post.date.getTime());
    bucketCounts.set(bucket, (bucketCounts.get(bucket) ?? 0) + 1);
  }
  const maxBucketCount = bucketCounts.size > 0 ? Math.max(...bucketCounts.values()) : 0;
  const burstShare10m = postCount > 0 ? maxBucketCount / postCount : 0;

  const intervals = interPostMinutes(posts.map((post) => post.date.getTime()));
  const medianInterPostMinutes = median(intervals);
  const followersMedian = median(
    posts
      .map((post) => post.followers)
      .filter((value): value is number => typeof value === 'number')
  );
  const updatesMedian = median(
    posts
      .map((post) => post.updates)
      .filter((value): value is number => typeof value === 'number')
  );

  const volumeScore = Math.min(1, postCount / 8);
  const cadenceScore =
    medianInterPostMinutes === null
      ? 0
      : medianInterPostMinutes <= 2
      ? 1
      : medianInterPostMinutes <= 5
      ? 0.7
      : 0.2;
  const metadataScore =
    followersMedian === null || updatesMedian === null
      ? 0
      : followersMedian < 50 && updatesMedian > 500
      ? 1
      : followersMedian < 150 && updatesMedian > 200
      ? 0.6
      : 0;

  const suspicion01 =
    0.25 * volumeScore +
    0.2 * retweetShare +
    0.2 * duplicateTextShare +
    0.2 * burstShare10m +
    0.1 * cadenceScore +
    0.05 * metadataScore;
  const suspicionScore = roundTo(Math.max(0, Math.min(100, suspicion01 * 100)), 2);

  const flags: string[] = [];
  if (postCount >= Math.max(4, Math.ceil(clusterPostCount * 0.25))) {
    flags.push('high-output-account');
  }
  if (retweetShare >= 0.8) {
    flags.push('retweet-heavy-account');
  }
  if (duplicateTextShare >= 0.6) {
    flags.push('repetitive-text-account');
  }
  if (burstShare10m >= 0.7) {
    flags.push('burst-posting-account');
  }
  if (medianInterPostMinutes !== null && medianInterPostMinutes <= 2) {
    flags.push('rapid-cadence-account');
  }
  if (followersMedian !== null && updatesMedian !== null && followersMedian < 50 && updatesMedian > 500) {
    flags.push('low-follower-high-activity-account');
  }

  return {
    accountId,
    postCount,
    retweetShare: roundTo(retweetShare, 4),
    duplicateTextShare: roundTo(duplicateTextShare, 4),
    burstShare10m: roundTo(burstShare10m, 4),
    medianInterPostMinutes:
      medianInterPostMinutes === null ? null : roundTo(medianInterPostMinutes, 2),
    followersMedian: followersMedian === null ? null : roundTo(followersMedian, 2),
    updatesMedian: updatesMedian === null ? null : roundTo(updatesMedian, 2),
    suspicionScore,
    flags,
  };
}

function toSuspectAccount(account: AccountAggregate): SuspectAccount {
  return {
    accountId: account.accountId,
    postCount: account.postCount,
    suspicionScore: account.suspicionScore,
    retweetShare: account.retweetShare,
    duplicateTextShare: account.duplicateTextShare,
    burstShare10m: account.burstShare10m,
    medianInterPostMinutes: account.medianInterPostMinutes,
    flags: account.flags,
  };
}

function clusterFlags(signals: BotBehaviorSignals): string[] {
  const flags: string[] = [];
  if (signals.suspectedBotAccountShare >= 0.4) {
    flags.push('bot-heavy-account-mix');
  }
  if (signals.suspectedBotPostShare >= 0.5) {
    flags.push('bot-heavy-post-share');
  }
  if (signals.maxAccountSuspicion >= 80) {
    flags.push('single-highly-suspect-account');
  }
  return flags;
}

export function buildBotBehaviorSignals(
  cluster: Pick<BaselineNarrativeCluster, 'postIds' | 'accountIds'>,
  postsById: Map<string, BaselineClusteringPost>
): BotBehaviorSignals {
  const posts = cluster.postIds
    .map((postId) => postsById.get(postId))
    .filter((post): post is BaselineClusteringPost => Boolean(post));

  const byAccount = new Map<string, BaselineClusteringPost[]>();
  for (const post of posts) {
    const list = byAccount.get(post.account) ?? [];
    list.push(post);
    byAccount.set(post.account, list);
  }

  const accountAggregates = [...byAccount.entries()].map(([accountId, accountPosts]) =>
    buildAccountAggregate(accountId, accountPosts, posts.length)
  );

  const suspectAccounts = accountAggregates.filter((entry) => entry.suspicionScore >= 60);
  const suspectPosts = suspectAccounts.reduce((sum, entry) => sum + entry.postCount, 0);
  const averageAccountSuspicion =
    accountAggregates.length > 0
      ? accountAggregates.reduce((sum, entry) => sum + entry.suspicionScore, 0) /
        accountAggregates.length
      : 0;
  const maxAccountSuspicion =
    accountAggregates.length > 0
      ? Math.max(...accountAggregates.map((entry) => entry.suspicionScore))
      : 0;

  const suspectedBotAccountShare =
    accountAggregates.length > 0 ? suspectAccounts.length / accountAggregates.length : 0;
  const suspectedBotPostShare = posts.length > 0 ? suspectPosts / posts.length : 0;

  const botLikelihoodScore = roundTo(
    Math.max(
      0,
      Math.min(
        100,
        100 *
          (0.45 * suspectedBotAccountShare +
            0.35 * suspectedBotPostShare +
            0.2 * (averageAccountSuspicion / 100))
      )
    ),
    2
  );

  const topSuspectAccounts = [...accountAggregates]
    .sort((left, right) => right.suspicionScore - left.suspicionScore)
    .slice(0, 5)
    .map(toSuspectAccount);

  const baseSignals: BotBehaviorSignals = {
    accountCount: accountAggregates.length,
    suspectedBotAccountCount: suspectAccounts.length,
    suspectedBotAccountShare: roundTo(suspectedBotAccountShare, 4),
    suspectedBotPostShare: roundTo(suspectedBotPostShare, 4),
    averageAccountSuspicion: roundTo(averageAccountSuspicion, 2),
    maxAccountSuspicion: roundTo(maxAccountSuspicion, 2),
    botLikelihoodScore,
    topSuspectAccounts,
    flags: [],
  };

  return {
    ...baseSignals,
    flags: clusterFlags(baseSignals),
  };
}
