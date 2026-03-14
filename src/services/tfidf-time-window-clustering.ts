import type {
  BaselineClusteringPost,
  BaselineClusteringResult,
  BaselineNarrativeCluster,
  TfIdfTimeWindowConfig,
} from '../types/clustering.js';

type SparseVector = Map<string, number>;

interface WorkingCluster {
  readonly clusterId: string;
  readonly windowStart: Date;
  readonly windowEnd: Date;
  readonly postIds: string[];
  readonly accountIds: Set<string>;
  readonly sumVector: SparseVector;
  readonly topTerms: string[];
}

const STOP_WORDS = new Set<string>([
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
]);

const DEFAULT_CONFIG: TfIdfTimeWindowConfig = {
  windowHours: 24,
  similarityThreshold: 0.3,
  minClusterSize: 3,
  minTokenLength: 3,
  topTermsPerCluster: 8,
};

function tokenize(content: string, minTokenLength: number): string[] {
  return content
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/@\w+/g, ' ')
    .replace(/[^a-z0-9#_]+/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(
      (token) =>
        token.length >= minTokenLength &&
        !STOP_WORDS.has(token) &&
        !/^\d+$/.test(token)
    );
}

function vectorNorm(vector: SparseVector): number {
  let sumSquares = 0;
  for (const value of vector.values()) {
    sumSquares += value * value;
  }
  return Math.sqrt(sumSquares);
}

function cosineSimilarity(left: SparseVector, right: SparseVector): number {
  const leftNorm = vectorNorm(left);
  const rightNorm = vectorNorm(right);
  if (leftNorm === 0 || rightNorm === 0) {
    return 0;
  }

  let dotProduct = 0;
  const [smaller, larger] =
    left.size <= right.size ? [left, right] : [right, left];

  for (const [term, weight] of smaller.entries()) {
    dotProduct += weight * (larger.get(term) ?? 0);
  }

  return dotProduct / (leftNorm * rightNorm);
}

function toNormalizedTfIdfVectors(
  tokenizedDocuments: string[][]
): SparseVector[] {
  const documentCount = tokenizedDocuments.length;
  const documentFrequency = new Map<string, number>();

  for (const tokens of tokenizedDocuments) {
    const uniqueTerms = new Set(tokens);
    for (const term of uniqueTerms) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }

  return tokenizedDocuments.map((tokens) => {
    const termFrequency = new Map<string, number>();
    for (const term of tokens) {
      termFrequency.set(term, (termFrequency.get(term) ?? 0) + 1);
    }

    const tfIdf = new Map<string, number>();
    for (const [term, rawCount] of termFrequency.entries()) {
      const tf = rawCount / tokens.length;
      const df = documentFrequency.get(term) ?? 1;
      const idf = Math.log((documentCount + 1) / (df + 1)) + 1;
      tfIdf.set(term, tf * idf);
    }

    const norm = vectorNorm(tfIdf);
    if (norm === 0) {
      return new Map<string, number>();
    }

    const normalized = new Map<string, number>();
    for (const [term, weight] of tfIdf.entries()) {
      normalized.set(term, weight / norm);
    }
    return normalized;
  });
}

function makeWindowBuckets(
  posts: BaselineClusteringPost[],
  windowHours: number
): Map<number, BaselineClusteringPost[]> {
  const windowMs = windowHours * 60 * 60 * 1000;
  const buckets = new Map<number, BaselineClusteringPost[]>();

  for (const post of posts) {
    const windowStartEpoch = Math.floor(post.date.getTime() / windowMs) * windowMs;
    const existing = buckets.get(windowStartEpoch);
    if (existing) {
      existing.push(post);
    } else {
      buckets.set(windowStartEpoch, [post]);
    }
  }

  return buckets;
}

function topTermsFromSumVector(sumVector: SparseVector, maxTerms: number): string[] {
  return [...sumVector.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, maxTerms)
    .map(([term]) => term);
}

function createWorkingCluster(
  clusterId: string,
  windowStart: Date,
  windowEnd: Date,
  postId: string,
  accountId: string,
  vector: SparseVector,
  topTermsPerCluster: number
): WorkingCluster {
  const sumVector = new Map<string, number>(vector.entries());
  return {
    clusterId,
    windowStart,
    windowEnd,
    postIds: [postId],
    accountIds: new Set([accountId]),
    sumVector,
    topTerms: topTermsFromSumVector(sumVector, topTermsPerCluster),
  };
}

function updateWorkingCluster(
  cluster: WorkingCluster,
  postId: string,
  accountId: string,
  vector: SparseVector,
  topTermsPerCluster: number
): void {
  cluster.postIds.push(postId);
  cluster.accountIds.add(accountId);

  for (const [term, weight] of vector.entries()) {
    cluster.sumVector.set(term, (cluster.sumVector.get(term) ?? 0) + weight);
  }

  cluster.topTerms.splice(0, cluster.topTerms.length, ...topTermsFromSumVector(cluster.sumVector, topTermsPerCluster));
}

function clusterWithinWindow(
  posts: BaselineClusteringPost[],
  config: TfIdfTimeWindowConfig,
  clusterStartIndex: number,
  windowStart: Date,
  windowEnd: Date
): { clusters: WorkingCluster[]; nextClusterIndex: number } {
  const tokenized = posts.map((post) => tokenize(post.content, config.minTokenLength));
  const vectors = toNormalizedTfIdfVectors(tokenized);
  const clusters: WorkingCluster[] = [];
  let clusterIndex = clusterStartIndex;

  for (let i = 0; i < posts.length; i += 1) {
    const post = posts[i];
    const vector = vectors[i];
    let bestCluster: WorkingCluster | null = null;
    let bestScore = -1;

    for (const cluster of clusters) {
      const similarity = cosineSimilarity(vector, cluster.sumVector);
      if (similarity > bestScore) {
        bestScore = similarity;
        bestCluster = cluster;
      }
    }

    if (bestCluster && bestScore >= config.similarityThreshold) {
      updateWorkingCluster(
        bestCluster,
        post.id,
        post.account,
        vector,
        config.topTermsPerCluster
      );
      continue;
    }

    const clusterId = `baseline-${windowStart.toISOString()}-${clusterIndex}`;
    clusterIndex += 1;
    clusters.push(
      createWorkingCluster(
        clusterId,
        windowStart,
        windowEnd,
        post.id,
        post.account,
        vector,
        config.topTermsPerCluster
      )
    );
  }

  return { clusters, nextClusterIndex: clusterIndex };
}

function toNarrativeCluster(cluster: WorkingCluster): BaselineNarrativeCluster {
  return {
    clusterId: cluster.clusterId,
    windowStart: cluster.windowStart,
    windowEnd: cluster.windowEnd,
    postIds: cluster.postIds,
    accountIds: [...cluster.accountIds],
    topTerms: cluster.topTerms,
    centroidSize: cluster.sumVector.size,
  };
}

export function clusterByTfIdfTimeWindows(
  posts: BaselineClusteringPost[],
  partialConfig: Partial<TfIdfTimeWindowConfig> = {}
): BaselineClusteringResult {
  const config: TfIdfTimeWindowConfig = { ...DEFAULT_CONFIG, ...partialConfig };
  const buckets = makeWindowBuckets(posts, config.windowHours);
  const sortedWindowEpochs = [...buckets.keys()].sort((left, right) => left - right);

  const clusters: BaselineNarrativeCluster[] = [];
  let droppedSmallClusters = 0;
  let nextClusterIndex = 1;

  for (const windowEpoch of sortedWindowEpochs) {
    const windowStart = new Date(windowEpoch);
    const windowEnd = new Date(windowEpoch + config.windowHours * 60 * 60 * 1000);
    const windowPosts = buckets.get(windowEpoch) ?? [];

    const result = clusterWithinWindow(
      windowPosts,
      config,
      nextClusterIndex,
      windowStart,
      windowEnd
    );
    nextClusterIndex = result.nextClusterIndex;

    for (const workingCluster of result.clusters) {
      if (workingCluster.postIds.length < config.minClusterSize) {
        droppedSmallClusters += 1;
        continue;
      }
      clusters.push(toNarrativeCluster(workingCluster));
    }
  }

  return {
    totalInputPosts: posts.length,
    totalWindows: sortedWindowEpochs.length,
    totalClusters: clusters.length,
    droppedSmallClusters,
    clusters,
  };
}
