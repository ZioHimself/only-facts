import mongoose, { Schema } from 'mongoose';

export interface TestPost {
  _id: mongoose.Types.ObjectId;
  date: Date;
  account: string;
  content: string;
  referencePostId?: string | null;
  metadata?: {
    language?: string | null;
    isRetweet?: boolean | null;
  };
}

const testPostSchema = new Schema<TestPost>(
  {
    date: { type: Date, required: true },
    account: { type: String, required: true },
    content: { type: String, required: true },
    referencePostId: { type: String, required: false },
    metadata: {
      language: { type: String, required: false },
      isRetweet: { type: Boolean, required: false },
    },
  },
  {
    strict: false,
    collection: 'test_posts',
    versionKey: false,
  }
);

export const TestPostModel =
  mongoose.models.TestPost || mongoose.model<TestPost>('TestPost', testPostSchema);
