/**
 * Unit tests for the database connection module.
 * Mocks mongoose to test connection logic in isolation.
 */

import { DatabaseConnectionError, AppError } from '../../../src/utils/errors';

const mockConnect = jest.fn();
const mockDisconnect = jest.fn();
const mockConnection = { readyState: 0 };

jest.mock('mongoose', () => ({
  __esModule: true,
  default: {
    connect: (...args: unknown[]) => mockConnect(...args),
    disconnect: (...args: unknown[]) => mockDisconnect(...args),
    connection: mockConnection,
  },
}));

describe('Database Module', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockConnection.readyState = 0;
  });

  describe('connectDB', () => {
    it('should connect to MongoDB with correct options', async () => {
      mockConnect.mockResolvedValueOnce(undefined);

      const { connectDB } = await import('../../../src/db');
      await connectDB();

      expect(mockConnect).toHaveBeenCalledTimes(1);
      expect(mockConnect).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          maxPoolSize: 10,
          serverSelectionTimeoutMS: 5000,
        })
      );
    });

    it('should throw DatabaseConnectionError on connection failure', async () => {
      const connectionError = new Error('Connection refused');
      mockConnect.mockRejectedValueOnce(connectionError);

      const { connectDB } = await import('../../../src/db');

      try {
        await connectDB();
        fail('Expected connectDB to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Failed to connect to MongoDB');
        expect((error as { statusCode?: number }).statusCode).toBe(503);
      }
    });

    it('should include original error message in DatabaseConnectionError', async () => {
      const originalMessage = 'ECONNREFUSED 127.0.0.1:27017';
      mockConnect.mockRejectedValueOnce(new Error(originalMessage));

      const { connectDB } = await import('../../../src/db');

      await expect(connectDB()).rejects.toThrow(originalMessage);
    });

    it('should handle non-Error rejection gracefully', async () => {
      mockConnect.mockRejectedValueOnce('string error');

      const { connectDB } = await import('../../../src/db');

      await expect(connectDB()).rejects.toThrow('Unknown connection error');
    });

    it('should be idempotent when already connected', async () => {
      mockConnection.readyState = 1;
      mockConnect.mockResolvedValueOnce(undefined);

      const { connectDB } = await import('../../../src/db');
      await connectDB();

      expect(mockConnect).not.toHaveBeenCalled();
    });
  });

  describe('disconnectDB', () => {
    it('should disconnect from MongoDB when connected', async () => {
      mockConnection.readyState = 1;
      mockDisconnect.mockResolvedValueOnce(undefined);

      const { disconnectDB } = await import('../../../src/db');
      await disconnectDB();

      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });

    it('should be no-op when not connected', async () => {
      mockConnection.readyState = 0;

      const { disconnectDB } = await import('../../../src/db');
      await disconnectDB();

      expect(mockDisconnect).not.toHaveBeenCalled();
    });

    it('should handle disconnect errors gracefully', async () => {
      mockConnection.readyState = 1;
      mockDisconnect.mockRejectedValueOnce(new Error('Disconnect failed'));

      const { disconnectDB } = await import('../../../src/db');

      await expect(disconnectDB()).resolves.toBeUndefined();
    });
  });

  describe('getConnectionStatus', () => {
    it('should return connected: true when readyState is 1', async () => {
      mockConnection.readyState = 1;

      const { getConnectionStatus } = await import('../../../src/db');
      const status = getConnectionStatus();

      expect(status).toEqual({
        connected: true,
        readyState: 1,
      });
    });

    it('should return connected: false when readyState is 0 (disconnected)', async () => {
      mockConnection.readyState = 0;

      const { getConnectionStatus } = await import('../../../src/db');
      const status = getConnectionStatus();

      expect(status).toEqual({
        connected: false,
        readyState: 0,
      });
    });

    it('should return connected: false when readyState is 2 (connecting)', async () => {
      mockConnection.readyState = 2;

      const { getConnectionStatus } = await import('../../../src/db');
      const status = getConnectionStatus();

      expect(status).toEqual({
        connected: false,
        readyState: 2,
      });
    });

    it('should return connected: false when readyState is 3 (disconnecting)', async () => {
      mockConnection.readyState = 3;

      const { getConnectionStatus } = await import('../../../src/db');
      const status = getConnectionStatus();

      expect(status).toEqual({
        connected: false,
        readyState: 3,
      });
    });
  });
});

describe('DatabaseConnectionError', () => {
  it('should extend AppError', () => {
    const error = new DatabaseConnectionError('Connection failed');

    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(Error);
  });

  it('should have status code 503', () => {
    const error = new DatabaseConnectionError('Connection failed');

    expect(error.statusCode).toBe(503);
  });

  it('should preserve error message', () => {
    const message = 'Failed to connect to MongoDB: timeout';
    const error = new DatabaseConnectionError(message);

    expect(error.message).toBe(message);
  });

  it('should have correct error name', () => {
    const error = new DatabaseConnectionError('test');

    expect(error.name).toBe('DatabaseConnectionError');
  });
});
