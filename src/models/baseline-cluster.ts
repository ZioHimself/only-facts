import mongoose, { Schema } from 'mongoose';

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
    createdAt: { type: Date, required: true, default: Date.now },
  },
  {
    collection: 'baseline_clusters',
    versionKey: false,
  }
);

baselineClusterSchema.index({ runId: 1, clusterId: 1 }, { unique: true });
baselineClusterSchema.index({ windowStart: 1, windowEnd: 1 });

export const BaselineClusterModel =
  mongoose.models.BaselineCluster ||
  mongoose.model<BaselineCluster>('BaselineCluster', baselineClusterSchema);
