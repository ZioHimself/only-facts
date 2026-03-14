import { Router } from 'express';
import type { ApiResponse, HealthData } from '../types/api.js';

/**
 * Health check router.
 * Provides endpoint for container orchestration and load balancers.
 */
export const healthRouter = Router();

healthRouter.get('/', (req, res) => {
  const response: ApiResponse<HealthData> = {
    success: true,
    data: {
      status: 'ok',
    },
  };

  res.json(response);
});
