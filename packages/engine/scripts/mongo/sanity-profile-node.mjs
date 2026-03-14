import mongoose from "mongoose";

const [mongoUriWithDb = "mongodb://127.0.0.1:49829/only-facts"] =
  process.argv.slice(2);

await mongoose.connect(mongoUriWithDb);
const col = mongoose.connection.db.collection("test_posts");

const total = await col.countDocuments();

const topLanguages = await col
  .aggregate([
    { $group: { _id: { $ifNull: ["$metadata.language", "unknown"] }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ])
  .toArray();

const topAccounts = await col
  .aggregate([
    { $group: { _id: "$account", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ])
  .toArray();

const [retweet] = await col
  .aggregate([
    {
      $group: {
        _id: null,
        retweets: {
          $sum: { $cond: [{ $eq: ["$metadata.isRetweet", true] }, 1, 0] }
        },
        nonRetweets: {
          $sum: { $cond: [{ $eq: ["$metadata.isRetweet", false] }, 1, 0] }
        },
        unknownRetweet: {
          $sum: { $cond: [{ $eq: ["$metadata.isRetweet", null] }, 1, 0] }
        },
        total: { $sum: 1 }
      }
    }
  ])
  .toArray();

const postsPerDay = await col
  .aggregate([
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ])
  .toArray();

const counts = postsPerDay.map((d) => d.count).sort((a, b) => a - b);
const sum = counts.reduce((a, b) => a + b, 0);
const mean = sum / (counts.length || 1);
const median = counts.length
  ? counts.length % 2
    ? counts[(counts.length - 1) / 2]
    : (counts[counts.length / 2 - 1] + counts[counts.length / 2]) / 2
  : 0;
const p90 = counts.length
  ? counts[Math.min(counts.length - 1, Math.floor(counts.length * 0.9))]
  : 0;

const maxDay = postsPerDay.reduce(
  (m, d) => (d.count > m.count ? d : m),
  { _id: null, count: 0 }
);
const minDay = postsPerDay.reduce(
  (m, d) => (d.count < m.count ? d : m),
  postsPerDay[0] || { _id: null, count: 0 }
);

const retweetShare = retweet?.total
  ? Number(((retweet.retweets / retweet.total) * 100).toFixed(2))
  : 0;

console.log(
  JSON.stringify(
    {
      totalPosts: total,
      topLanguages,
      topAccounts,
      retweet: {
        ...retweet,
        retweetSharePercent: retweetShare
      },
      postsPerDaySummary: {
        dayCount: postsPerDay.length,
        minDay,
        maxDay,
        meanPerDay: Number(mean.toFixed(2)),
        medianPerDay: median,
        p90PerDay: p90
      },
      postsPerDaySamples: {
        first5: postsPerDay.slice(0, 5),
        last5: postsPerDay.slice(-5)
      }
    },
    null,
    2
  )
);

await mongoose.disconnect();
