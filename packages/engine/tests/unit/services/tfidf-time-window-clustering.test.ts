import { clusterByTfIdfTimeWindows } from '../../../src/services/tfidf-time-window-clustering';
import type { BaselineClusteringPost } from '../../../src/types/clustering';

function makePost(
  id: string,
  isoDate: string,
  account: string,
  content: string
): BaselineClusteringPost {
  return {
    id,
    date: new Date(isoDate),
    account,
    content,
    language: 'English',
    referencePostId: null,
    isRetweet: null,
    followers: null,
    following: null,
    updates: null,
  };
}

describe('clusterByTfIdfTimeWindows', () => {
  it('clusters semantically similar posts inside the same window', () => {
    const posts: BaselineClusteringPost[] = [
      makePost('1', '2024-01-01T00:00:00.000Z', 'a1', 'vaccine mandate protest downtown'),
      makePost('2', '2024-01-01T01:00:00.000Z', 'a2', 'downtown protest against vaccine mandate'),
      makePost('3', '2024-01-01T02:00:00.000Z', 'a3', 'football match final score tonight'),
      makePost('4', '2024-01-01T03:00:00.000Z', 'a4', 'vaccine mandate protest rally'),
    ];

    const result = clusterByTfIdfTimeWindows(posts, {
      windowHours: 24,
      similarityThreshold: 0.2,
      minClusterSize: 2,
      minTokenLength: 3,
      topTermsPerCluster: 5,
    });

    expect(result.totalInputPosts).toBe(4);
    expect(result.totalClusters).toBe(1);
    expect(result.droppedSmallClusters).toBe(1);
    expect(result.clusters[0].postIds).toHaveLength(3);
    expect(result.clusters[0].topTerms).toEqual(
      expect.arrayContaining(['vaccine', 'mandate', 'protest'])
    );
  });

  it('keeps clusters separated across different time windows', () => {
    const posts: BaselineClusteringPost[] = [
      makePost('1', '2024-01-01T00:00:00.000Z', 'a1', 'energy prices are rising quickly'),
      makePost('2', '2024-01-01T01:00:00.000Z', 'a2', 'rising energy prices affect families'),
      makePost('3', '2024-01-02T00:00:00.000Z', 'a3', 'energy prices are rising quickly'),
      makePost('4', '2024-01-02T01:00:00.000Z', 'a4', 'rising energy prices affect families'),
    ];

    const result = clusterByTfIdfTimeWindows(posts, {
      windowHours: 12,
      similarityThreshold: 0.2,
      minClusterSize: 2,
      minTokenLength: 3,
      topTermsPerCluster: 5,
    });

    expect(result.totalWindows).toBe(2);
    expect(result.totalClusters).toBe(2);
    expect(result.clusters[0].windowStart.toISOString()).not.toBe(
      result.clusters[1].windowStart.toISOString()
    );
  });
});
