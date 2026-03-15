import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

interface AnalysisRunDocument {
  runId: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  config?: {
    windowHours?: number;
    similarityThreshold?: number;
    minClusterSize?: number;
    region?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  };
  results?: {
    postsProcessed?: number;
    postsClustered?: number;
    clusters?: number;
    dailyEmotionDays?: number;
    misinformation?: {
      avg?: number;
      high?: number;
      medium?: number;
    };
    spam?: {
      avg?: number;
      high?: number;
    };
  };
  error?: string;
}

interface AnalysisRunSummary {
  runId: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  postsProcessed: number | null;
  postsClustered: number | null;
  clusters: number | null;
  region: string | null;
}

function getMongoUri(): string {
  const mongoUri = process.env.MONGO_URI?.trim();
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const resolved = mongoUri && mongoUri.length > 0 ? mongoUri : databaseUrl;
  if (!resolved) {
    throw new Error('Missing MONGO_URI/DATABASE_URL in server environment.');
  }
  if (!resolved.startsWith('mongodb://') && !resolved.startsWith('mongodb+srv://')) {
    throw new Error('Configured DB URL is not a MongoDB URL.');
  }
  return resolved;
}

function getDatabaseName(mongoUri: string): string {
  const parsed = new URL(mongoUri);
  const dbName = parsed.pathname.replace(/^\//, '').trim();
  return dbName.length > 0 ? dbName : 'admin';
}

export async function GET() {
  let client: MongoClient | null = null;
  try {
    const mongoUri = getMongoUri();
    const databaseName = getDatabaseName(mongoUri);
    client = new MongoClient(mongoUri, {
      connectTimeoutMS: 5000,
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 5,
    });
    await client.connect();

    const db = client.db(databaseName);
    const runs = await db
      .collection<AnalysisRunDocument>('analysis_runs')
      .find({})
      .sort({ startedAt: -1 })
      .limit(20)
      .toArray();

    const summaries: AnalysisRunSummary[] = runs.map((run) => ({
      runId: run.runId,
      status: run.status,
      startedAt: run.startedAt?.toISOString() ?? 'unknown',
      completedAt: run.completedAt?.toISOString() ?? null,
      postsProcessed: run.results?.postsProcessed ?? null,
      postsClustered: run.results?.postsClustered ?? null,
      clusters: run.results?.clusters ?? null,
      region: run.config?.region ?? null,
    }));

    return NextResponse.json({
      ok: true,
      database: databaseName,
      count: summaries.length,
      runs: summaries,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown analysis runs error';
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  } finally {
    await client?.close().catch(() => undefined);
  }
}
