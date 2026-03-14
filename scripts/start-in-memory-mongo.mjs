import { MongoMemoryServer } from "mongodb-memory-server";

const requestedPort = process.env.MONGO_MEMORY_PORT
  ? Number(process.env.MONGO_MEMORY_PORT)
  : undefined;

const mongoServer = await MongoMemoryServer.create({
  instance: requestedPort ? { port: requestedPort } : undefined
});

const mongoUri = mongoServer.getUri("only-facts");

console.log("In-memory MongoDB started.");
console.log(`MONGO_URI=${mongoUri}`);
console.log("Press Ctrl+C to stop.");

const shutdown = async () => {
  await mongoServer.stop();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await new Promise(() => {
  // Keep process alive until signal.
});
