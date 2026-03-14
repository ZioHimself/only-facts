import { ConfigurationError } from '../../src/utils/errors';

describe('Config Module', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('default values', () => {
    it('should use default values when environment variables are not set', async () => {
      delete process.env.PORT;
      delete process.env.NODE_ENV;
      delete process.env.MONGO_URI;
      delete process.env.LOG_LEVEL;

      const { config } = await import('../../src/config');

      expect(config.port).toBe(3000);
      expect(config.nodeEnv).toBe('development');
      expect(config.mongoUri).toBe('mongodb://localhost:27017/only-facts');
      expect(config.logLevel).toBe('debug');
    });

    it('should use environment values when provided', async () => {
      process.env.PORT = '8080';
      process.env.NODE_ENV = 'test';
      process.env.MONGO_URI = 'mongodb://testhost:27017/test-db';
      process.env.LOG_LEVEL = 'warn';

      const { config } = await import('../../src/config');

      expect(config.port).toBe(8080);
      expect(config.nodeEnv).toBe('test');
      expect(config.mongoUri).toBe('mongodb://testhost:27017/test-db');
      expect(config.logLevel).toBe('warn');
    });
  });

  describe('port parsing', () => {
    it('should parse valid port numbers', async () => {
      process.env.PORT = '4000';
      const { config } = await import('../../src/config');
      expect(config.port).toBe(4000);
    });

    it('should use default port for non-numeric PORT values', async () => {
      process.env.PORT = 'not-a-number';
      const { config } = await import('../../src/config');
      expect(config.port).toBe(3000);
    });
  });

  describe('validation', () => {
    it('should throw ConfigurationError when MONGO_URI is missing in production', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.MONGO_URI;

      await expect(import('../../src/config')).rejects.toThrow(
        'MONGO_URI environment variable is required in production'
      );
    });

    it('should not throw when MONGO_URI is provided in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.MONGO_URI = 'mongodb://prod:27017/prod-db';

      const { config } = await import('../../src/config');
      expect(config.nodeEnv).toBe('production');
    });

    it('should throw ConfigurationError for invalid log level', async () => {
      process.env.LOG_LEVEL = 'invalid-level';

      await expect(import('../../src/config')).rejects.toThrow('Invalid LOG_LEVEL: invalid-level');
    });

    it('should accept all valid log levels', async () => {
      const validLevels = ['error', 'warn', 'info', 'debug'];

      for (const level of validLevels) {
        jest.resetModules();
        process.env.LOG_LEVEL = level;
        const { config } = await import('../../src/config');
        expect(config.logLevel).toBe(level);
      }
    });
  });

  describe('signalApiKeys parsing', () => {
    it('should return empty array when SIGNAL_API_KEYS is not set', async () => {
      delete process.env.SIGNAL_API_KEYS;
      const { config } = await import('../../src/config');
      expect(config.signalApiKeys).toEqual([]);
    });

    it('should parse comma-separated keys', async () => {
      process.env.SIGNAL_API_KEYS = 'key1,key2,key3';
      const { config } = await import('../../src/config');
      expect(config.signalApiKeys).toEqual(['key1', 'key2', 'key3']);
    });

    it('should trim whitespace from keys', async () => {
      process.env.SIGNAL_API_KEYS = ' key1 , key2 ';
      const { config } = await import('../../src/config');
      expect(config.signalApiKeys).toEqual(['key1', 'key2']);
    });

    it('should filter out empty keys', async () => {
      process.env.SIGNAL_API_KEYS = 'key1,,key2,';
      const { config } = await import('../../src/config');
      expect(config.signalApiKeys).toEqual(['key1', 'key2']);
    });
  });

  describe('rate limit config', () => {
    it('should default signalRateLimitWindowMs to 60000', async () => {
      delete process.env.SIGNAL_RATE_LIMIT_WINDOW_MS;
      const { config } = await import('../../src/config');
      expect(config.signalRateLimitWindowMs).toBe(60000);
    });

    it('should parse SIGNAL_RATE_LIMIT_WINDOW_MS from env', async () => {
      process.env.SIGNAL_RATE_LIMIT_WINDOW_MS = '30000';
      const { config } = await import('../../src/config');
      expect(config.signalRateLimitWindowMs).toBe(30000);
    });

    it('should default signalRateLimitMax to 100', async () => {
      delete process.env.SIGNAL_RATE_LIMIT_MAX;
      const { config } = await import('../../src/config');
      expect(config.signalRateLimitMax).toBe(100);
    });

    it('should parse SIGNAL_RATE_LIMIT_MAX from env', async () => {
      process.env.SIGNAL_RATE_LIMIT_MAX = '50';
      const { config } = await import('../../src/config');
      expect(config.signalRateLimitMax).toBe(50);
    });
  });

  describe('immutability', () => {
    it('should return a frozen config object', async () => {
      const { config } = await import('../../src/config');
      expect(Object.isFrozen(config)).toBe(true);
    });

    it('should not allow property modification', async () => {
      const { config } = await import('../../src/config');

      expect(() => {
        (config as { port: number }).port = 9999;
      }).toThrow();
    });
  });
});

describe('AppError', () => {
  it('should have correct name and statusCode', async () => {
    const { AppError } = await import('../../src/utils/errors');
    const error = new AppError('Test error', 404);

    expect(error.name).toBe('AppError');
    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(404);
  });

  it('should default to 500 status code', async () => {
    const { AppError } = await import('../../src/utils/errors');
    const error = new AppError('Server error');

    expect(error.statusCode).toBe(500);
  });
});

describe('ConfigurationError', () => {
  it('should extend AppError with 500 status', () => {
    const error = new ConfigurationError('Config missing');

    expect(error.name).toBe('ConfigurationError');
    expect(error.message).toBe('Config missing');
    expect(error.statusCode).toBe(500);
    expect(error).toBeInstanceOf(Error);
  });
});
