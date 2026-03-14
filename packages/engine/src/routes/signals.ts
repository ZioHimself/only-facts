import { Router, type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { ingestSignal } from '../services/signal-service.js';
import { ValidationError } from '../errors/validation-error.js';
import { apiKeyAuth } from '../middleware/auth.js';
import { config } from '../config/index.js';

const router = Router();

const signalsRateLimiter = rateLimit({
  windowMs: config.signalRateLimitWindowMs,
  max: config.signalRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.header('x-api-key') ?? req.ip ?? 'unknown',
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many signal ingestion requests. Try again later.',
      },
    });
  },
});

router.post(
  '/api/signals',
  apiKeyAuth,
  signalsRateLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { signal, duplicate } = await ingestSignal(req.body);

      const statusCode = duplicate ? 200 : 201;

      res.status(statusCode).json({
        success: true,
        data: {
          id: signal.id,
          platform: signal.platform,
          externalId: signal.externalId,
          duplicate,
        },
      });
    } catch (error: unknown) {
      if (error instanceof ValidationError) {
        res.status(400).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        });
        return;
      }

      next(error);
    }
  }
);

export { router as signalsRouter };
