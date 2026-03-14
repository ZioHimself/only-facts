import express, { type Request, type Response, type NextFunction } from 'express';
import { healthRouter } from './routes/health.js';
import { errorHandler } from './middleware/error-handler.js';
import { AppError } from './utils/errors.js';
import type { ApiResponse } from './types/api.js';

/**
 * Express application instance.
 * Configured with middleware, routes, and error handling.
 * Does NOT start the server - that's index.ts's responsibility.
 */
export const app = express();

app.use(express.json());

app.use('/health', healthRouter);

app.use((req: Request, res: Response, next: NextFunction) => {
  next(new AppError(`Route not found: ${req.method} ${req.path}`, 404));
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err) {
    const response: ApiResponse<never> = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid JSON in request body',
      },
    };
    res.status(400).json(response);
    return;
  }

  errorHandler(err, req, res, next);
});
