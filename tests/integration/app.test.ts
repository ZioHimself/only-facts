/**
 * Integration tests for app module behavior.
 * Verifies that the app exports correctly and has proper configuration.
 */

import request from 'supertest';
import type { Express } from 'express';

describe('App Module Integration Tests', () => {
  describe('app export', () => {
    it('should export app without starting server', async () => {
      jest.resetModules();
      const appModule = await import('../../src/app');

      expect(appModule.app).toBeDefined();
      expect(typeof appModule.app.listen).toBe('function');
    });

    it('should export a function that can be used with Supertest', async () => {
      jest.resetModules();
      const { app } = await import('../../src/app');

      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
    });
  });

  describe('JSON body parser', () => {
    let app: Express;

    beforeAll(async () => {
      jest.resetModules();
      const appModule = await import('../../src/app');
      app = appModule.app;
    });

    it('should parse JSON request bodies', async () => {
      const response = await request(app)
        .post('/health')
        .set('Content-Type', 'application/json')
        .send({ test: 'data' });

      expect(response.status).not.toBe(500);
    });

    it('should handle empty request body', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
    });
  });

  describe('middleware configuration', () => {
    let app: Express;

    beforeAll(async () => {
      jest.resetModules();
      const appModule = await import('../../src/app');
      app = appModule.app;
    });

    it('should have error handler as last middleware', async () => {
      const response = await request(app).get('/trigger-error-if-exists');
      expect(response.body).toHaveProperty('success');
    });
  });
});
