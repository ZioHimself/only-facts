import type {
  BaselineClusteringPost,
  BaselineNarrativeCluster,
  CoordinationSignals,
} from '../types/clustering.js';

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function calculateAccountMetrics(posts: BaselineClusteringPost[]): {
  topAccountShare: number;
  accountConcentrationHhi: number;
  accountConcentrationNormalized: number;
  uniqueAccountCount: number;
} {
  const counts = new Map<string, number>();
  for (const post of posts) {
    counts.set(post.account, (counts.get(post.account) ?? 0) + 1);
  }

  const postCount = posts.length;
  const uniqueAccountCount = counts.size;
  const maxCount = Math.max(...counts.values());
  const topAccountShare = postCount > 0 ? maxCount / postCount : 0;

  let hhi = 0;
  for (const count of counts.values()) {
    const share = count / postCount;
    hhi += share * share;
  }

  const minHhi = uniqueAccountCount > 0 ? 1 / uniqueAccountCount : 0;
  const normalizedHhi =
    uniqueAccountCount > 1 ? (hhi - minHhi) / (1 - minHhi) : uniqueAccountCount === 1 ? 1 : 0;

  return {
    topAccountShare,
    accountConcentrationHhi: hhi,
    accountConcentrationNormalized: Math.max(0, Math.min(1, normalizedHhi)),
    uniqueAccountCount,
  };
}

function calculateRetweetShare(posts: BaselineClusteringPost[]): number {
  if (posts.length === 0) {
    return 0;
  }
  const retweets = posts.reduce((sum, post) => sum + (post.isRetweet ? 1 : 0), 0);
  return retweets / posts.length;
}

function calculateReferenceMetrics(
  posts: BaselineClusteringPost[],
  clusterPostIds: Set<string>
): { internalReferenceEdgeCount: number; referenceEdgeDensity: number } {
  const internalReferenceEdgeCount = posts.reduce((sum, post) => {
    if (!post.referencePostId) {
      return sum;
    }
    return sum + (clusterPostIds.has(post.referencePostId) ? 1 : 0);
  }, 0);

  const maxPossibleDirectedEdges = posts.length > 1 ? posts.length - 1 : 1;
  const referenceEdgeDensity = internalReferenceEdgeCount / maxPossibleDirectedEdges;

  return { internalReferenceEdgeCount, referenceEdgeDensity };
}

function bucketEpoch10m(epochMs: number): number {
  const bucketMs = 10 * 60 * 1000;
  return Math.floor(epochMs / bucketMs) * bucketMs;
}

function calculateTemporalCoordination(posts: BaselineClusteringPost[]): {
  synchronizedBurstShare: number;
  synchronizedAccountsShare: number;
} {
  if (posts.length === 0) {
    return { synchronizedBurstShare: 0, synchronizedAccountsShare: 0 };
  }

  const bucketPosts = new Map<number, number>();
  const bucketAccounts = new Map<number, Set<string>>();
  const allAccounts = new Set<string>();

  for (const post of posts) {
    const bucket = bucketEpoch10m(post.date.getTime());
    bucketPosts.set(bucket, (bucketPosts.get(bucket) ?? 0) + 1);

    const accountsInBucket = bucketAccounts.get(bucket) ?? new Set<string>();
    accountsInBucket.add(post.account);
    bucketAccounts.set(bucket, accountsInBucket);
    allAccounts.add(post.account);
  }

  const peakBucketPosts = Math.max(...bucketPosts.values());
  let peakBucketAccounts = 0;
  for (const accounts of bucketAccounts.values()) {
    if (accounts.size > peakBucketAccounts) {
      peakBucketAccounts = accounts.size;
    }
  }

  return {
    synchronizedBurstShare: peakBucketPosts / posts.length,
    synchronizedAccountsShare: allAccounts.size > 0 ? peakBucketAccounts / allAccounts.size : 0,
  };
}

function coordinationFlags(signals: CoordinationSignals): string[] {
  const flags: string[] = [];
  if (signals.topAccountShare >= 0.35) {
    flags.push('dominant-account');
  }
  if (signals.accountConcentrationNormalized >= 0.5) {
    flags.push('concentrated-accounts');
  }
  if (signals.retweetShare >= 0.7) {
    flags.push('high-retweet-share');
  }
  if (signals.synchronizedBurstShare >= 0.4) {
    flags.push('synchronized-burst');
  }
  if (signals.referenceEdgeDensity >= 0.3) {
    flags.push('dense-reference-graph');
  }
  return flags;
}

function computeCoordinationScore(signals: Omit<CoordinationSignals, 'coordinationScore' | 'flags'>): number {
  const score01 =
    0.3 * signals.topAccountShare +
    0.25 * signals.accountConcentrationNormalized +
    0.2 * signals.retweetShare +
    0.15 * signals.synchronizedBurstShare +
    0.1 * signals.referenceEdgeDensity;
  return roundTo(Math.max(0, Math.min(100, score01 * 100)), 2);
}

export function buildCoordinationSignals(
  cluster: Pick<BaselineNarrativeCluster, 'postIds' | 'accountIds'>,
  postsById: Map<string, BaselineClusteringPost>
): CoordinationSignals {
  const posts = cluster.postIds
    .map((postId) => postsById.get(postId))
    .filter((post): post is BaselineClusteringPost => Boolean(post));

  const accountMetrics = calculateAccountMetrics(posts);
  const retweetShare = calculateRetweetShare(posts);
  const referenceMetrics = calculateReferenceMetrics(posts, new Set(cluster.postIds));
  const temporalMetrics = calculateTemporalCoordination(posts);

  const baseSignals: Omit<CoordinationSignals, 'coordinationScore' | 'flags'> = {
    postCount: posts.length,
    uniqueAccountCount: accountMetrics.uniqueAccountCount,
    topAccountShare: roundTo(accountMetrics.topAccountShare, 4),
    accountConcentrationHhi: roundTo(accountMetrics.accountConcentrationHhi, 4),
    accountConcentrationNormalized: roundTo(accountMetrics.accountConcentrationNormalized, 4),
    retweetShare: roundTo(retweetShare, 4),
    internalReferenceEdgeCount: referenceMetrics.internalReferenceEdgeCount,
    referenceEdgeDensity: roundTo(referenceMetrics.referenceEdgeDensity, 4),
    synchronizedBurstShare: roundTo(temporalMetrics.synchronizedBurstShare, 4),
    synchronizedAccountsShare: roundTo(temporalMetrics.synchronizedAccountsShare, 4),
  };

  const coordinationScore = computeCoordinationScore(baseSignals);
  const withScore: CoordinationSignals = {
    ...baseSignals,
    coordinationScore,
    flags: [],
  };

  return {
    ...withScore,
    flags: coordinationFlags(withScore),
  };
}
