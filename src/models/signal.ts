import { Schema, model, type Document } from 'mongoose';

export type PlatformType = 'x';

export interface SignalMetrics {
  likeCount: number;
  replyCount: number;
  retweetCount: number;
  quoteCount: number;
}

export interface SignalGeo {
  countryCode?: string;
  placeId?: string;
}

export interface Signal extends Document {
  platform: PlatformType;
  externalId: string;
  authorId: string;
  conversationId: string;
  text: string;
  language: string;
  hashtags: string[];
  mentions: string[];
  urls: string[];
  createdAt: Date;
  ingestedAt: Date;
  source: 'api' | 'batch' | 'manual';
  geo?: SignalGeo;
  metrics: SignalMetrics;
  raw?: Record<string, unknown>;
}

const metricsSchema = new Schema<SignalMetrics>(
  {
    likeCount: { type: Number, required: true, default: 0, min: 0 },
    replyCount: { type: Number, required: true, default: 0, min: 0 },
    retweetCount: { type: Number, required: true, default: 0, min: 0 },
    quoteCount: { type: Number, required: true, default: 0, min: 0 },
  },
  { _id: false }
);

const geoSchema = new Schema<SignalGeo>(
  {
    countryCode: { type: String },
    placeId: { type: String },
  },
  { _id: false }
);

const signalSchema = new Schema<Signal>(
  {
    platform: { type: String, required: true, enum: ['x'] },
    externalId: { type: String, required: true },
    authorId: { type: String, required: true },
    conversationId: { type: String, required: true },
    text: { type: String, required: true, maxlength: 2000 },
    language: { type: String, required: true },
    hashtags: { type: [String], default: [] },
    mentions: { type: [String], default: [] },
    urls: { type: [String], default: [] },
    createdAt: { type: Date, required: true },
    ingestedAt: { type: Date, required: true, default: Date.now },
    source: {
      type: String,
      required: true,
      enum: ['api', 'batch', 'manual'],
      default: 'api',
    },
    geo: { type: geoSchema, required: false },
    metrics: { type: metricsSchema, required: true, default: () => ({}) },
    raw: { type: Schema.Types.Mixed },
  },
  {
    timestamps: false,
  }
);

signalSchema.index({ platform: 1, externalId: 1 }, { unique: true });
signalSchema.index({ authorId: 1, createdAt: -1 });
signalSchema.index({ conversationId: 1, createdAt: -1 });

export const SignalModel = model<Signal>('Signal', signalSchema);
