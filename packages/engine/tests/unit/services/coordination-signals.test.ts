import { buildCoordinationSignals } from '../../../src/services/coordination-signals';
import type { BaselineClusteringPost, BaselineNarrativeCluster } from '../../../src/types/clustering';

function makePost(
  id: string,
  dateIso: string,
  account: string,
  content: string,
  isRetweet: boolean | null,
  referencePostId: string | null = null
): BaselineClusteringPost {
  return {
    id,
    date: new Date(dateIso),
    account,
    content,
    language: 'English',
    referencePostId,
    isRetweet,
  };
}

function makeCluster(postIds: string[], accountIds: string[]): BaselineNarrativeCluster {
  return {
    clusterId: 'c1',
    windowStart: new Date('2024-01-01T00:00:00.000Z'),
    windowEnd: new Date('2024-01-02T00:00:00.000Z'),
    postIds,
    accountIds,
    topTerms: ['term'],
    centroidSize: 3,
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
  };
}

describe('buildCoordinationSignals', () => {
  it('computes account concentration and retweet share correctly', () => {
    const posts = [
      makePost('1', '2024-01-01T00:00:00.000Z', 'a1', 'x', true),
      makePost('2', '2024-01-01T00:02:00.000Z', 'a1', 'y', true),
      makePost('3', '2024-01-01T00:05:00.000Z', 'a2', 'z', false),
      makePost('4', '2024-01-01T01:00:00.000Z', 'a3', 'w', false),
    ];
    const postsById = new Map(posts.map((post) => [post.id, post]));
    const cluster = makeCluster(
      ['1', '2', '3', '4'],
      ['a1', 'a2', 'a3']
    );

    const signals = buildCoordinationSignals(cluster, postsById);

    expect(signals.postCount).toBe(4);
    expect(signals.uniqueAccountCount).toBe(3);
    expect(signals.topAccountShare).toBe(0.5);
    expect(signals.retweetShare).toBe(0.5);
    expect(signals.synchronizedBurstShare).toBe(0.75);
    expect(signals.coordinationScore).toBeGreaterThan(0);
    expect(signals.flags).toEqual(expect.arrayContaining(['dominant-account', 'synchronized-burst']));
  });

  it('counts internal reference edges and sets dense graph flag', () => {
    const posts = [
      makePost('1', '2024-01-01T00:00:00.000Z', 'a1', 'x', true, null),
      makePost('2', '2024-01-01T00:01:00.000Z', 'a2', 'y', true, '1'),
      makePost('3', '2024-01-01T00:02:00.000Z', 'a3', 'z', true, '1'),
      makePost('4', '2024-01-01T00:03:00.000Z', 'a4', 'w', true, '2'),
    ];
    const postsById = new Map(posts.map((post) => [post.id, post]));
    const cluster = makeCluster(
      ['1', '2', '3', '4'],
      ['a1', 'a2', 'a3', 'a4']
    );

    const signals = buildCoordinationSignals(cluster, postsById);

    expect(signals.internalReferenceEdgeCount).toBe(3);
    expect(signals.referenceEdgeDensity).toBe(1);
    expect(signals.flags).toContain('dense-reference-graph');
  });
});
