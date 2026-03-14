/**
 * Standard API response types for the only-facts application.
 * All API endpoints return responses in this format.
 */

/**
 * Standard API response envelope.
 * All responses follow this shape for consistent client handling.
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

/**
 * Error details included when success is false.
 */
export interface ApiError {
  code: string;
  message: string;
}

/**
 * Health check response data.
 */
export interface HealthData {
  status: 'ok' | 'degraded';
}
