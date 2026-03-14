/**
 * Integration tests for health endpoint with database status.
 * Tests the full request/response cycle including DB status reporting.
 */

import request from 'supertest';
import type { Express } from 'express';

const mockGetConnectionStatus = jest.fn();

jest.mock('../../src/db', () => ({
  __esModule: true,
  getConnectionStatus: () => mockGetConnectionStatus(),
  connectDB: jest.fn().mockResolvedValue(undefined),
  disconnectDB: jest.fn().mockResolvedValue(undefined),
}));

describe('Health Endpoint with Database Status', () => {
  let app: Express;

  beforeAll(async () => {
    const appModule = await import('../../src/app');
    app = appModule.app;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /health with DB connected', () => {
    beforeEach(() => {
      mockGetConnectionStatus.mockReturnValue({
        connected: true,
        readyState: 1,
      });
    });

    it('should return status: ok when DB is connected', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: {
          status: 'ok',
          db: {
            connected: true,
          },
        },
      });
    });

    it('should include db.connected: true in response', async () => {
      const response = await request(app).get('/health');

      expect(response.body.data.db).toBeDefined();
      expect(response.body.data.db.connected).toBe(true);
    });
  });

  describe('GET /health with DB disconnected', () => {
    beforeEach(() => {
      mockGetConnectionStatus.mockReturnValue({
        connected: false,
        readyState: 0,
      });
    });

    it('should return status: degraded when DB is disconnected', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('degraded');
    });

    it('should include db.connected: false in response', async () => {
      const response = await request(app).get('/health');

      expect(response.body.data.db).toBeDefined();
      expect(response.body.data.db.connected).toBe(false);
    });

    it('should still return success: true even when degraded', async () => {
      const response = await request(app).get('/health');

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /health during DB reconnection', () => {
    it('should return degraded when DB is connecting (readyState: 2)', async () => {
      mockGetConnectionStatus.mockReturnValue({
        connected: false,
        readyState: 2,
      });

      const response = await request(app).get('/health');

      expect(response.body.data.status).toBe('degraded');
      expect(response.body.data.db.connected).toBe(false);
    });

    it('should return degraded when DB is disconnecting (readyState: 3)', async () => {
      mockGetConnectionStatus.mockReturnValue({
        connected: false,
        readyState: 3,
      });

      const response = await request(app).get('/health');

      expect(response.body.data.status).toBe('degraded');
      expect(response.body.data.db.connected).toBe(false);
    });
  });
});
