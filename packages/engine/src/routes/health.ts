import { Router } from 'express';
import type { ApiResponse, HealthData } from '../types/api.js';
import { getConnectionStatus } from '../db/index.js';

/**
 * Health check router.
 * Provides endpoint for container orchestration and load balancers.
 */
export const healthRouter = Router();

healthRouter.get('/', (req, res) => {
  const dbStatus = getConnectionStatus();

  const response: ApiResponse<HealthData> = {
    success: true,
    data: {
      status: dbStatus.connected ? 'ok' : 'degraded',
      db: {
        connected: dbStatus.connected,
      },
    },
  };

  res.json(response);
});
