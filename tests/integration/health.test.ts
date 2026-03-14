/**
 * Integration tests for the health endpoint.
 * Uses Supertest to make HTTP requests against the Express app.
 */

import request from 'supertest';
import type { Express } from 'express';

jest.mock('../../src/db', () => ({
  __esModule: true,
  getConnectionStatus: () => ({ connected: false, readyState: 0 }),
  connectDB: jest.fn().mockResolvedValue(undefined),
  disconnectDB: jest.fn().mockResolvedValue(undefined),
}));

describe('Health Endpoint Integration Tests', () => {
  let app: Express;

  beforeAll(async () => {
    jest.resetModules();
    const appModule = await import('../../src/app');
    app = appModule.app;
  });

  describe('GET /health', () => {
    it('should return 200 OK', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
    });

    it('should return success: true', async () => {
      const response = await request(app).get('/health');
      expect(response.body.success).toBe(true);
    });

    it('should return data with status and db fields', async () => {
      const response = await request(app).get('/health');
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('db');
    });

    it('should have correct content-type', async () => {
      const response = await request(app).get('/health');
      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('should return full ApiResponse envelope with db status', async () => {
      const response = await request(app).get('/health');
      expect(response.body).toEqual({
        success: true,
        data: {
          status: 'degraded',
          db: {
            connected: false,
          },
        },
      });
    });
  });
});
