import { NextResponse } from "next/server";
import { MongoClient } from "mongodb";

type ExploreAction = "collections" | "sample" | "search";

function toAction(value: string | null): ExploreAction {
  if (value === "sample" || value === "search") {
    return value;
  }
  return "collections";
}

function toLimit(value: string | null, fallback: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(1, Math.min(max, Math.floor(parsed)));
}

function getMongoUri(): string {
  const mongoUri = process.env.MONGO_URI?.trim();
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const resolved = mongoUri && mongoUri.length > 0 ? mongoUri : databaseUrl;
  if (!resolved) {
    throw new Error("Missing MONGO_URI/DATABASE_URL in server environment.");
  }
  if (!resolved.startsWith("mongodb://") && !resolved.startsWith("mongodb+srv://")) {
    throw new Error("Configured DB URL is not a MongoDB URL.");
  }
  return resolved;
}

function getDatabaseName(mongoUri: string): string {
  const parsed = new URL(mongoUri);
  const dbName = parsed.pathname.replace(/^\//, "").trim();
  return dbName.length > 0 ? dbName : "admin";
}

function normalizeDocs<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const action = toAction(url.searchParams.get("action"));
  const collectionName = (url.searchParams.get("collection") ?? "signals").trim() || "signals";
  const q = (url.searchParams.get("q") ?? "").trim();
  const limit = toLimit(url.searchParams.get("limit"), action === "collections" ? 50 : 10, 50);

  let client: MongoClient | null = null;
  try {
    const mongoUri = getMongoUri();
    const databaseName = getDatabaseName(mongoUri);
    client = new MongoClient(mongoUri, {
      connectTimeoutMS: 3000,
      serverSelectionTimeoutMS: 3000,
      maxPoolSize: 5,
    });
    await client.connect();

    const db = client.db(databaseName);
    if (action === "collections") {
      const [collections, totalDocuments] = await Promise.all([
        db.listCollections().toArray(),
        db.collection(collectionName).estimatedDocumentCount(),
      ]);
      return NextResponse.json({
        ok: true,
        action,
        database: databaseName,
        collection: collectionName,
        collections: collections.map((item) => item.name),
        collectionsCount: collections.length,
        totalDocuments,
      });
    }

    if (action === "sample") {
      const collectionRef = db.collection(collectionName);
      const [docs, totalDocuments] = await Promise.all([
        collectionRef.find({}, { limit }).sort({ _id: -1 }).toArray(),
        collectionRef.estimatedDocumentCount(),
      ]);
      return NextResponse.json({
        ok: true,
        action,
        database: databaseName,
        collection: collectionName,
        count: docs.length,
        totalDocuments,
        docs: normalizeDocs(docs),
      });
    }

    if (!q) {
      return NextResponse.json(
        { ok: false, error: "Query string `q` is required for search." },
        { status: 400 },
      );
    }

    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const collectionRef = db.collection(collectionName);
    const searchFilter = {
      $or: [{ text: regex }, { label: regex }, { username_encoded: regex }, { tweet_hashtags: regex }],
    };
    const [docs, matchedDocuments, totalDocuments] = await Promise.all([
      collectionRef
        .find(searchFilter, {
          limit,
          maxTimeMS: 4000,
        })
        .sort({ _id: -1 })
        .toArray(),
      collectionRef.countDocuments(searchFilter, { maxTimeMS: 4000 }),
      collectionRef.estimatedDocumentCount(),
    ]);

    return NextResponse.json({
      ok: true,
      action,
      database: databaseName,
      collection: collectionName,
      query: q,
      count: docs.length,
      matchedDocuments,
      totalDocuments,
      docs: normalizeDocs(docs),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Mongo explorer error";
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  } finally {
    await client?.close().catch(() => undefined);
  }
}
