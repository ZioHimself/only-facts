/**
 * only-facts: Campaign detection pipeline
 * Server entry point.
 */

import { app } from './app.js';
import { config } from './config/index.js';

const server = app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});

/**
 * Graceful shutdown handler.
 * Stops accepting new connections and waits for existing ones to complete.
 */
function shutdown(): void {
  console.log('Shutting down gracefully...');

  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Forced shutdown - connections did not drain in time');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
