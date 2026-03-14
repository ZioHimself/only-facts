export interface BaselineClusteringPost {
  readonly id: string;
  readonly date: Date;
  readonly account: string;
  readonly content: string;
  readonly language: string | null;
}

export interface TfIdfTimeWindowConfig {
  readonly windowHours: number;
  readonly similarityThreshold: number;
  readonly minClusterSize: number;
  readonly minTokenLength: number;
  readonly topTermsPerCluster: number;
}

export interface BaselineNarrativeCluster {
  readonly clusterId: string;
  readonly windowStart: Date;
  readonly windowEnd: Date;
  readonly postIds: string[];
  readonly accountIds: string[];
  readonly topTerms: string[];
  readonly centroidSize: number;
}

export interface BaselineClusteringResult {
  readonly totalInputPosts: number;
  readonly totalWindows: number;
  readonly totalClusters: number;
  readonly droppedSmallClusters: number;
  readonly clusters: BaselineNarrativeCluster[];
}
