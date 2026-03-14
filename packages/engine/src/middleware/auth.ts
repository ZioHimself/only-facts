import type { NextFunction, Request, Response } from 'express';
import { config } from '../config/index.js';

export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.header('x-api-key');

  if (!apiKey || !config.signalApiKeys.includes(apiKey)) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or missing API key',
      },
    });
    return;
  }

  next();
}
