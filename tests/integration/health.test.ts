/**
 * Integration tests for the health endpoint.
 * Uses Supertest to make HTTP requests against the Express app.
 */

import request from 'supertest';
import type { Express } from 'express';

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

    it('should return data.status: ok', async () => {
      const response = await request(app).get('/health');
      expect(response.body.data).toEqual({ status: 'ok' });
    });

    it('should have correct content-type', async () => {
      const response = await request(app).get('/health');
      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('should return full ApiResponse envelope', async () => {
      const response = await request(app).get('/health');
      expect(response.body).toEqual({
        success: true,
        data: {
          status: 'ok',
        },
      });
    });
  });
});
