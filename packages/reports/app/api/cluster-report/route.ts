import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import type { DataColumnData, MarkerTone, SummarySegmentData } from '@/app/data/dashboardData';

interface AggregationResult {
  summary: Array<{
    _id: null;
    totalPosts: number;
    totalEngagements: number;
    uniqueAuthors: string[];
  }>;
  sentiment: Array<{ _id: string; count: number }>;
  emotions: Array<{ _id: string; count: number }>;
  risk: Array<{
    _id: null;
    anomalous: number;
    toxic: number;
    highRiskEngagements: number;
  }>;
  topics: Array<{ _id: string; count: number }>;
  clusters: Array<{ _id: string; count: number }>;
}

interface AnalysisRun {
  runId: string;
  status: string;
  completedAt?: Date;
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

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatPercentage(count: number, total: number): string {
  if (total === 0) return '0%';
  return `${((count / total) * 100).toFixed(1)}%`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedRunId = url.searchParams.get('runId')?.trim() || null;

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

    // Get the runId to use - either requested or latest completed
    let runId = requestedRunId;
    if (!runId) {
      const latestRun = await db
        .collection<AnalysisRun>('analysis_runs')
        .findOne({ status: 'completed' }, { sort: { completedAt: -1 } });
      if (!latestRun) {
        return NextResponse.json({
          ok: false,
          error: 'No completed analysis runs found. Run cluster analysis first.',
        });
      }
      runId = latestRun.runId;
    }

    // Run the aggregation pipeline
    const pipeline = [
      { $match: { runId } },
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,
                totalPosts: { $sum: 1 },
                totalEngagements: { $sum: { $ifNull: ['$reposts', 0] } },
                uniqueAuthors: { $addToSet: '$account' },
              },
            },
          ],
          sentiment: [
            {
              $group: {
                _id: {
                  $cond: [
                    { $lt: ['$sentiment', 0.4] },
                    'negative',
                    { $cond: [{ $gt: ['$sentiment', 0.6] }, 'positive', 'neutral'] },
                  ],
                },
                count: { $sum: 1 },
              },
            },
          ],
          emotions: [{ $group: { _id: '$emotionalTone', count: { $sum: 1 } } }],
          risk: [
            {
              $group: {
                _id: null,
                anomalous: {
                  $sum: { $cond: [{ $gte: ['$misinformationScore', 0.7] }, 1, 0] },
                },
                toxic: { $sum: { $cond: [{ $gte: ['$spamLikelihood', 0.6] }, 1, 0] } },
                highRiskEngagements: {
                  $sum: {
                    $cond: [
                      { $gte: ['$misinformationEffectiveness', 0.5] },
                      { $ifNull: ['$reposts', 0] },
                      0,
                    ],
                  },
                },
              },
            },
          ],
          topics: [
            { $unwind: '$topTerms' },
            { $group: { _id: '$topTerms', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 8 },
          ],
          clusters: [
            { $group: { _id: '$clusterId', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],
        },
      },
    ];

    const results = await db
      .collection('account_enriched_clusters')
      .aggregate<AggregationResult>(pipeline)
      .toArray();

    if (results.length === 0 || !results[0].summary[0]) {
      return NextResponse.json({
        ok: false,
        error: `No data found for runId: ${runId}`,
        runId,
      });
    }

    const data = results[0];
    const summaryData = data.summary[0];
    const riskData = data.risk[0] ?? { anomalous: 0, toxic: 0, highRiskEngagements: 0 };
    const totalPosts = summaryData.totalPosts;
    const totalAuthors = summaryData.uniqueAuthors.length;
    const totalEngagements = summaryData.totalEngagements;

    // Build sentiment map
    const sentimentMap = new Map(data.sentiment.map((s) => [s._id, s.count]));
    const negativeCount = sentimentMap.get('negative') ?? 0;
    const positiveCount = sentimentMap.get('positive') ?? 0;
    const neutralSentimentCount = sentimentMap.get('neutral') ?? 0;

    // Build emotion map
    const emotionMap = new Map(data.emotions.map((e) => [e._id, e.count]));
    const angerCount = emotionMap.get('anger') ?? 0;
    const joyCount = emotionMap.get('joy') ?? 0;
    const fearCount = emotionMap.get('fear') ?? 0;
    const disgustCount = emotionMap.get('disgust') ?? 0;
    const sadnessCount = emotionMap.get('sadness') ?? 0;
    const neutralEmotionCount = emotionMap.get('neutral') ?? 0;

    // Find dominant emotion
    const emotionEntries = Array.from(emotionMap.entries()).sort((a, b) => b[1] - a[1]);
    const dominantEmotion = emotionEntries[0]?.[0] ?? 'neutral';
    const dominantEmotionCount = emotionEntries[0]?.[1] ?? 0;

    // Top topic
    const topTopic = data.topics[0]?._id ?? 'Unknown';

    // Build summary segments
    const summarySegments: SummarySegmentData[] = [
      { label: 'POSTS', value: formatNumber(totalPosts), icon: 'posts' },
      { label: 'ENGAGEMENTS', value: formatNumber(totalEngagements), icon: 'engagements' },
      { label: 'AUTHORS', value: formatNumber(totalAuthors), icon: 'authors' },
      { label: 'TOPICS', value: topTopic, icon: 'topics' },
      {
        label: 'SENTIMENT',
        value: `${formatPercentage(negativeCount, totalPosts)} Negative`,
        icon: 'sentiment',
      },
      {
        label: 'EMOTIONS',
        value: `${formatPercentage(dominantEmotionCount, totalPosts)} ${dominantEmotion.charAt(0).toUpperCase() + dominantEmotion.slice(1)}`,
        icon: 'emotions',
      },
    ];

    // Estimate original vs shared (using cluster size as proxy)
    const originalPosts = data.clusters.filter((c) => c.count === 1).length;
    const sharedPosts = totalPosts - originalPosts;

    // Build columns
    const columns: DataColumnData[] = [
      {
        title: 'POSTS',
        sections: [
          {
            rows: [
              {
                label: 'Original Posts',
                value: formatNumber(originalPosts),
                percentage: formatPercentage(originalPosts, totalPosts),
              },
              {
                label: 'Clustered Posts',
                value: formatNumber(sharedPosts),
                percentage: formatPercentage(sharedPosts, totalPosts),
              },
              {
                label: 'Anomalous Posts',
                value: formatNumber(riskData.anomalous),
                percentage: formatPercentage(riskData.anomalous, totalPosts),
              },
              {
                label: 'Toxic Posts',
                value: formatNumber(riskData.toxic),
                percentage: formatPercentage(riskData.toxic, totalPosts),
              },
            ],
          },
        ],
      },
      {
        title: 'ENGAGEMENTS',
        sections: [
          {
            rows: [
              {
                label: 'Engagements on High Risk Posts',
                value: formatNumber(riskData.highRiskEngagements),
                percentage: formatPercentage(riskData.highRiskEngagements, totalEngagements),
              },
              {
                label: 'Total Reposts',
                value: formatNumber(totalEngagements),
                percentage: '100%',
              },
            ],
          },
        ],
      },
      {
        title: 'AUTHORS',
        sections: [
          {
            rows: [
              {
                label: 'Unique Authors',
                value: formatNumber(totalAuthors),
                percentage: '100%',
              },
            ],
          },
        ],
      },
      {
        title: 'TOPICS',
        sections: [
          {
            rows: data.topics.map((topic) => ({
              label: topic._id,
              value: formatNumber(topic.count),
              percentage: formatPercentage(topic.count, totalPosts),
            })),
          },
        ],
      },
      {
        title: 'SENTIMENT',
        sections: [
          {
            rows: [
              {
                label: 'Negative',
                value: formatNumber(negativeCount),
                percentage: formatPercentage(negativeCount, totalPosts),
                markerTone: 'negative' as MarkerTone,
              },
              {
                label: 'Positive',
                value: formatNumber(positiveCount),
                percentage: formatPercentage(positiveCount, totalPosts),
                markerTone: 'positive' as MarkerTone,
              },
              {
                label: 'Neutral',
                value: formatNumber(neutralSentimentCount),
                percentage: formatPercentage(neutralSentimentCount, totalPosts),
                markerTone: 'neutral' as MarkerTone,
              },
            ],
          },
        ],
      },
      {
        title: 'EMOTIONS',
        sections: [
          {
            rows: [
              {
                label: 'Anger',
                value: formatNumber(angerCount),
                percentage: formatPercentage(angerCount, totalPosts),
                markerTone: 'negative' as MarkerTone,
              },
              {
                label: 'Joy',
                value: formatNumber(joyCount),
                percentage: formatPercentage(joyCount, totalPosts),
                markerTone: 'positive' as MarkerTone,
              },
              {
                label: 'Disgust',
                value: formatNumber(disgustCount),
                percentage: formatPercentage(disgustCount, totalPosts),
                markerTone: 'disgust' as MarkerTone,
              },
              {
                label: 'Fear',
                value: formatNumber(fearCount),
                percentage: formatPercentage(fearCount, totalPosts),
                markerTone: 'fear' as MarkerTone,
              },
              {
                label: 'Sadness',
                value: formatNumber(sadnessCount),
                percentage: formatPercentage(sadnessCount, totalPosts),
                markerTone: 'sadness' as MarkerTone,
              },
              {
                label: 'Neutral',
                value: formatNumber(neutralEmotionCount),
                percentage: formatPercentage(neutralEmotionCount, totalPosts),
                markerTone: 'neutral' as MarkerTone,
              },
            ],
          },
        ],
      },
    ];

    return NextResponse.json({
      ok: true,
      runId,
      database: databaseName,
      lastUpdate: new Date().toISOString(),
      summarySegments,
      columns,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown cluster report error';
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
