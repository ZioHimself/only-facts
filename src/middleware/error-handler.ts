import type { Request, Response, NextFunction } from 'express';
import type { ApiResponse } from '../types/api.js';

interface ErrorWithStatusCode extends Error {
  statusCode?: number;
}

/**
 * Maps HTTP status codes to error codes.
 */
function getErrorCode(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return 'VALIDATION_ERROR';
    case 404:
      return 'NOT_FOUND';
    default:
      return 'INTERNAL_ERROR';
  }
}

/**
 * Checks if error has a statusCode property (duck typing for AppError).
 */
function hasStatusCode(err: Error): err is ErrorWithStatusCode {
  return 'statusCode' in err && typeof (err as ErrorWithStatusCode).statusCode === 'number';
}

/**
 * Global error handling middleware.
 * Catches all errors and returns standardized API responses.
 * Must be registered as the last middleware in the Express app.
 */
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  const isAppError = hasStatusCode(err);

  const statusCode = isAppError ? err.statusCode! : 500;
  const errorCode = getErrorCode(statusCode);

  let message: string;
  if (isProduction && !isAppError) {
    message = 'An unexpected error occurred';
  } else {
    message = err.message;
  }

  const response: ApiResponse<never> = {
    success: false,
    error: {
      code: errorCode,
      message,
    },
  };

  res.status(statusCode).json(response);
}
