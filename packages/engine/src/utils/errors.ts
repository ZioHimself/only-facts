/**
 * Base application error class.
 * All custom errors extend this for consistent error handling.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Thrown when required configuration is missing or invalid.
 */
export class ConfigurationError extends AppError {
  constructor(message: string) {
    super(message, 500);
  }
}

/**
 * Thrown when database connection fails.
 */
export class DatabaseConnectionError extends AppError {
  constructor(message: string) {
    super(message, 503);
  }
}
