/**
 * Integration tests for error handling.
 * Verifies that errors are handled correctly at the HTTP level.
 */

import request from 'supertest';
import type { Express } from 'express';

describe('Error Handling Integration Tests', () => {
  let app: Express;

  beforeAll(async () => {
    jest.resetModules();
    const appModule = await import('../../src/app');
    app = appModule.app;
  });

  describe('404 Not Found', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/nonexistent-route');
      expect(response.status).toBe(404);
    });

    it('should return ApiResponse envelope with success: false', async () => {
      const response = await request(app).get('/nonexistent-route');
      expect(response.body.success).toBe(false);
    });

    it('should return NOT_FOUND error code', async () => {
      const response = await request(app).get('/nonexistent-route');
      expect(response.body.error).toEqual(
        expect.objectContaining({
          code: 'NOT_FOUND',
        })
      );
    });
  });

  describe('Invalid JSON', () => {
    it('should return 400 for malformed JSON body', async () => {
      const response = await request(app)
        .post('/health')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect(response.status).toBe(400);
    });

    it('should return ApiResponse envelope for JSON parse errors', async () => {
      const response = await request(app)
        .post('/health')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect(response.body).toEqual(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: expect.any(String),
            message: expect.any(String),
          }),
        })
      );
    });
  });

  describe('Error response format', () => {
    it('should always return JSON content-type for errors', async () => {
      const response = await request(app).get('/nonexistent-route');
      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('should have error object with code and message', async () => {
      const response = await request(app).get('/nonexistent-route');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
    });
  });
});
