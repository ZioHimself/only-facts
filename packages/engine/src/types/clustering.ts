export interface BaselineClusteringPost {
  readonly id: string;
  readonly date: Date;
  readonly account: string;
  readonly content: string;
  readonly language: string | null;
  readonly referencePostId: string | null;
  readonly isRetweet: boolean | null;
  readonly followers: number | null;
  readonly following: number | null;
  readonly updates: number | null;
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
  readonly coordination: CoordinationSignals;
  readonly botBehavior: BotBehaviorSignals | null;
}

export interface CoordinationSignals {
  readonly postCount: number;
  readonly uniqueAccountCount: number;
  readonly topAccountShare: number;
  readonly accountConcentrationHhi: number;
  readonly accountConcentrationNormalized: number;
  readonly retweetShare: number;
  readonly internalReferenceEdgeCount: number;
  readonly referenceEdgeDensity: number;
  readonly synchronizedBurstShare: number;
  readonly synchronizedAccountsShare: number;
  readonly coordinationScore: number;
  readonly flags: string[];
}

export interface SuspectAccount {
  readonly accountId: string;
  readonly postCount: number;
  readonly suspicionScore: number;
  readonly retweetShare: number;
  readonly duplicateTextShare: number;
  readonly burstShare10m: number;
  readonly medianInterPostMinutes: number | null;
  readonly flags: string[];
}

export interface BotBehaviorSignals {
  readonly accountCount: number;
  readonly suspectedBotAccountCount: number;
  readonly suspectedBotAccountShare: number;
  readonly suspectedBotPostShare: number;
  readonly averageAccountSuspicion: number;
  readonly maxAccountSuspicion: number;
  readonly botLikelihoodScore: number;
  readonly topSuspectAccounts: SuspectAccount[];
  readonly flags: string[];
}

export interface BaselineClusteringResult {
  readonly totalInputPosts: number;
  readonly totalWindows: number;
  readonly totalClusters: number;
  readonly droppedSmallClusters: number;
  readonly clusters: BaselineNarrativeCluster[];
}
