/**
 * only-facts: Campaign detection pipeline
 * Server entry point.
 */

import { app } from './app.js';
import { config } from './config/index.js';
import { connectDB, disconnectDB } from './db/index.js';

let server: ReturnType<typeof app.listen>;

/**
 * Starts the application: connects to DB, then starts HTTP server.
 */
async function start(): Promise<void> {
  await connectDB();
  console.log('Connected to MongoDB');

  server = app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
  });
}

/**
 * Graceful shutdown handler.
 * Stops accepting new connections, disconnects DB, then exits.
 */
async function shutdown(): Promise<void> {
  console.log('Shutting down gracefully...');

  server.close(async () => {
    await disconnectDB();
    console.log('Server and database closed');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Forced shutdown - connections did not drain in time');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
