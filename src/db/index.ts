/**
 * MongoDB connection module using Mongoose ODM.
 * Provides connection management, health status, and graceful shutdown support.
 */

import mongoose from 'mongoose';
import { config } from '../config/index.js';
import { DatabaseConnectionError } from '../utils/errors.js';

/**
 * Connection status returned by getConnectionStatus().
 */
export interface ConnectionStatus {
  connected: boolean;
  readyState: number;
}

const connectionOptions = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
};

/**
 * Establishes connection to MongoDB using the configured URI.
 * Idempotent: no-op if already connected.
 * @throws DatabaseConnectionError if connection fails
 */
export async function connectDB(): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  try {
    await mongoose.connect(config.mongoUri, connectionOptions);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown connection error';
    throw new DatabaseConnectionError(`Failed to connect to MongoDB: ${message}`);
  }
}

/**
 * Closes the MongoDB connection gracefully.
 * Idempotent: no-op if not connected.
 */
export async function disconnectDB(): Promise<void> {
  if (mongoose.connection.readyState === 0) {
    return;
  }

  try {
    await mongoose.disconnect();
  } catch {
    // Swallow disconnect errors - we're shutting down anyway
  }
}

/**
 * Returns current connection status.
 * readyState values:
 * - 0: disconnected
 * - 1: connected
 * - 2: connecting
 * - 3: disconnecting
 */
export function getConnectionStatus(): ConnectionStatus {
  return {
    connected: mongoose.connection.readyState === 1,
    readyState: mongoose.connection.readyState,
  };
}
