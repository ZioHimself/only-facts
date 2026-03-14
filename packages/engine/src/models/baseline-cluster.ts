import mongoose, { Schema } from 'mongoose';
import type { BotBehaviorSignals, CoordinationSignals } from '../types/clustering.js';

export interface BaselineCluster {
  _id: mongoose.Types.ObjectId;
  runId: string;
  config: {
    windowHours: number;
    similarityThreshold: number;
    minClusterSize: number;
    minTokenLength: number;
    topTermsPerCluster: number;
  };
  clusterId: string;
  windowStart: Date;
  windowEnd: Date;
  postIds: string[];
  accountIds: string[];
  topTerms: string[];
  centroidSize: number;
  coordination: CoordinationSignals;
  botBehavior?: BotBehaviorSignals | null;
  createdAt: Date;
}

const baselineClusterSchema = new Schema<BaselineCluster>(
  {
    runId: { type: String, required: true, index: true },
    config: {
      windowHours: { type: Number, required: true },
      similarityThreshold: { type: Number, required: true },
      minClusterSize: { type: Number, required: true },
      minTokenLength: { type: Number, required: true },
      topTermsPerCluster: { type: Number, required: true },
    },
    clusterId: { type: String, required: true, index: true },
    windowStart: { type: Date, required: true, index: true },
    windowEnd: { type: Date, required: true, index: true },
    postIds: [{ type: String, required: true }],
    accountIds: [{ type: String, required: true }],
    topTerms: [{ type: String, required: true }],
    centroidSize: { type: Number, required: true },
    coordination: {
      postCount: { type: Number, required: true },
      uniqueAccountCount: { type: Number, required: true },
      topAccountShare: { type: Number, required: true },
      accountConcentrationHhi: { type: Number, required: true },
      accountConcentrationNormalized: { type: Number, required: true },
      retweetShare: { type: Number, required: true },
      internalReferenceEdgeCount: { type: Number, required: true },
      referenceEdgeDensity: { type: Number, required: true },
      synchronizedBurstShare: { type: Number, required: true },
      synchronizedAccountsShare: { type: Number, required: true },
      coordinationScore: { type: Number, required: true, index: true },
      flags: [{ type: String, required: true }],
    },
    botBehavior: {
      type: new Schema(
        {
          accountCount: { type: Number, required: true },
          suspectedBotAccountCount: { type: Number, required: true },
          suspectedBotAccountShare: { type: Number, required: true },
          suspectedBotPostShare: { type: Number, required: true },
          averageAccountSuspicion: { type: Number, required: true },
          maxAccountSuspicion: { type: Number, required: true },
          botLikelihoodScore: { type: Number, required: true },
          topSuspectAccounts: [
            {
              accountId: { type: String, required: true },
              postCount: { type: Number, required: true },
              suspicionScore: { type: Number, required: true },
              retweetShare: { type: Number, required: true },
              duplicateTextShare: { type: Number, required: true },
              burstShare10m: { type: Number, required: true },
              medianInterPostMinutes: { type: Number, required: false, default: null },
              flags: [{ type: String, required: true }],
            },
          ],
          flags: [{ type: String, required: true }],
        },
        { _id: false }
      ),
      required: false,
      default: null,
    },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  {
    collection: 'baseline_clusters',
    versionKey: false,
  }
);

baselineClusterSchema.index({ runId: 1, clusterId: 1 }, { unique: true });
baselineClusterSchema.index({ windowStart: 1, windowEnd: 1 });
baselineClusterSchema.index({ 'botBehavior.botLikelihoodScore': -1 }, { sparse: true });

export const BaselineClusterModel =
  mongoose.models.BaselineCluster ||
  mongoose.model<BaselineCluster>('BaselineCluster', baselineClusterSchema);
