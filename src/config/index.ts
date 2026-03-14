import { ConfigurationError } from '../utils/errors.js';

/**
 * Application configuration interface.
 * All environment variables are accessed through this typed config object.
 */
export interface Config {
  readonly port: number;
  readonly nodeEnv: string;
  readonly mongoUri: string;
  readonly logLevel: string;
}

/**
 * Validates configuration and throws if required values are missing.
 */
function validateConfig(config: Config): void {
  if (config.nodeEnv === 'production' && !process.env.MONGO_URI) {
    throw new ConfigurationError('MONGO_URI environment variable is required in production');
  }

  if (config.port < 0 || config.port > 65535) {
    throw new ConfigurationError(`Invalid PORT value: ${config.port}. Must be between 0 and 65535`);
  }

  const validLogLevels = ['error', 'warn', 'info', 'debug'];
  if (!validLogLevels.includes(config.logLevel)) {
    throw new ConfigurationError(
      `Invalid LOG_LEVEL: ${config.logLevel}. Must be one of: ${validLogLevels.join(', ')}`
    );
  }
}

/**
 * Parses PORT from environment, returning default if invalid.
 */
function parsePort(portStr: string | undefined, defaultPort: number): number {
  if (!portStr) return defaultPort;
  const parsed = parseInt(portStr, 10);
  return Number.isNaN(parsed) ? defaultPort : parsed;
}

/**
 * Builds the configuration object from environment variables.
 */
function buildConfig(): Config {
  const config: Config = {
    port: parsePort(process.env.PORT, 3000),
    nodeEnv: process.env.NODE_ENV || 'development',
    mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/only-facts',
    logLevel: process.env.LOG_LEVEL || 'debug',
  };

  validateConfig(config);

  return Object.freeze(config);
}

/**
 * Frozen configuration object.
 * Import this to access configuration values throughout the application.
 *
 * @example
 * import { config } from '../config';
 * console.log(`Server running on port ${config.port}`);
 */
export const config: Config = buildConfig();
