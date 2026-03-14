import mongoose, { Schema } from 'mongoose';

export interface TestPost {
  _id: mongoose.Types.ObjectId;
  date: Date;
  account: string;
  content: string;
  metadata?: {
    language?: string | null;
  };
}

const testPostSchema = new Schema<TestPost>(
  {
    date: { type: Date, required: true },
    account: { type: String, required: true },
    content: { type: String, required: true },
    metadata: {
      language: { type: String, required: false },
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
