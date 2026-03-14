import { buildBotBehaviorSignals } from '../../../src/services/bot-behavior-signals';
import type { BaselineClusteringPost, BaselineNarrativeCluster } from '../../../src/types/clustering';

function makePost(
  id: string,
  dateIso: string,
  account: string,
  content: string,
  options: {
    isRetweet?: boolean | null;
    followers?: number | null;
    following?: number | null;
    updates?: number | null;
    referencePostId?: string | null;
  } = {}
): BaselineClusteringPost {
  return {
    id,
    date: new Date(dateIso),
    account,
    content,
    language: 'English',
    referencePostId: options.referencePostId ?? null,
    isRetweet: options.isRetweet ?? null,
    followers: options.followers ?? null,
    following: options.following ?? null,
    updates: options.updates ?? null,
  };
}

function makeCluster(postIds: string[], accountIds: string[]): BaselineNarrativeCluster {
  return {
    clusterId: 'cluster-1',
    windowStart: new Date('2024-01-01T00:00:00.000Z'),
    windowEnd: new Date('2024-01-02T00:00:00.000Z'),
    postIds,
    accountIds,
    topTerms: ['term'],
    centroidSize: 4,
    coordination: {
      postCount: 0,
      uniqueAccountCount: 0,
      topAccountShare: 0,
      accountConcentrationHhi: 0,
      accountConcentrationNormalized: 0,
      retweetShare: 0,
      internalReferenceEdgeCount: 0,
      referenceEdgeDensity: 0,
      synchronizedBurstShare: 0,
      synchronizedAccountsShare: 0,
      coordinationScore: 0,
      flags: [],
    },
    botBehavior: {
      accountCount: 0,
      suspectedBotAccountCount: 0,
      suspectedBotAccountShare: 0,
      suspectedBotPostShare: 0,
      averageAccountSuspicion: 0,
      maxAccountSuspicion: 0,
      botLikelihoodScore: 0,
      topSuspectAccounts: [],
      flags: [],
    },
  };
}

describe('buildBotBehaviorSignals', () => {
  it('identifies high-output repetitive retweet account as suspicious', () => {
    const posts = [
      makePost('1', '2024-01-01T00:00:00.000Z', 'bot_a', 'breaking alert now', {
        isRetweet: true,
        followers: 20,
        updates: 900,
      }),
      makePost('2', '2024-01-01T00:01:00.000Z', 'bot_a', 'breaking alert now', {
        isRetweet: true,
        followers: 22,
        updates: 920,
      }),
      makePost('3', '2024-01-01T00:02:00.000Z', 'bot_a', 'breaking alert now', {
        isRetweet: true,
        followers: 21,
        updates: 905,
      }),
      makePost('4', '2024-01-01T00:03:00.000Z', 'bot_a', 'breaking alert now', {
        isRetweet: true,
        followers: 18,
        updates: 950,
      }),
      makePost('5', '2024-01-01T00:20:00.000Z', 'human_1', 'different opinion on story', {
        isRetweet: false,
        followers: 450,
        updates: 40,
      }),
      makePost('6', '2024-01-01T01:00:00.000Z', 'human_2', 'another original take', {
        isRetweet: false,
        followers: 520,
        updates: 60,
      }),
    ];

    const postsById = new Map(posts.map((post) => [post.id, post]));
    const cluster = makeCluster(
      ['1', '2', '3', '4', '5', '6'],
      ['bot_a', 'human_1', 'human_2']
    );
    const signals = buildBotBehaviorSignals(cluster, postsById);

    expect(signals.accountCount).toBe(3);
    expect(signals.suspectedBotAccountCount).toBeGreaterThanOrEqual(1);
    expect(signals.suspectedBotPostShare).toBeGreaterThan(0.5);
    expect(signals.botLikelihoodScore).toBeGreaterThanOrEqual(45);
    expect(signals.topSuspectAccounts[0].accountId).toBe('bot_a');
    expect(signals.topSuspectAccounts[0].flags).toEqual(
      expect.arrayContaining(['retweet-heavy-account', 'repetitive-text-account'])
    );
  });

  it('keeps bot likelihood lower for mixed original posting behavior', () => {
    const posts = [
      makePost('1', '2024-01-01T00:00:00.000Z', 'user_1', 'my original comment', {
        isRetweet: false,
        followers: 300,
        updates: 100,
      }),
      makePost('2', '2024-01-01T00:45:00.000Z', 'user_1', 'second different message', {
        isRetweet: false,
        followers: 300,
        updates: 100,
      }),
      makePost('3', '2024-01-01T01:00:00.000Z', 'user_2', 'unique perspective here', {
        isRetweet: false,
        followers: 250,
        updates: 80,
      }),
      makePost('4', '2024-01-01T02:00:00.000Z', 'user_3', 'another unique perspective', {
        isRetweet: false,
        followers: 270,
        updates: 90,
      }),
    ];

    const postsById = new Map(posts.map((post) => [post.id, post]));
    const cluster = makeCluster(
      ['1', '2', '3', '4'],
      ['user_1', 'user_2', 'user_3']
    );
    const signals = buildBotBehaviorSignals(cluster, postsById);

    expect(signals.suspectedBotAccountCount).toBe(0);
    expect(signals.botLikelihoodScore).toBeLessThan(35);
    expect(signals.flags).toEqual([]);
  });
});
