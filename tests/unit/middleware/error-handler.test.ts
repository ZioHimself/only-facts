import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../../src/utils/errors';

describe('Error Handler Middleware', () => {
  const originalEnv = process.env;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };

    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    mockRequest = {};
    mockResponse = {
      status: statusMock,
      json: jsonMock,
      headersSent: false,
    };
    mockNext = jest.fn();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('error response format', () => {
    it('should return 500 for generic Error', async () => {
      process.env.NODE_ENV = 'development';
      const { errorHandler } = await import('../../../src/middleware/error-handler');

      const error = new Error('Something went wrong');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: expect.objectContaining({
          code: 'INTERNAL_ERROR',
          message: expect.any(String),
        }),
      });
    });

    it('should use statusCode from AppError', async () => {
      process.env.NODE_ENV = 'development';
      const { errorHandler } = await import('../../../src/middleware/error-handler');

      const error = new AppError('Resource not found', 404);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: expect.objectContaining({
          code: 'NOT_FOUND',
          message: 'Resource not found',
        }),
      });
    });

    it('should return ApiResponse envelope with success: false', async () => {
      process.env.NODE_ENV = 'development';
      const { errorHandler } = await import('../../../src/middleware/error-handler');

      const error = new Error('Test');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(jsonMock).toHaveBeenCalledWith(
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

  describe('production mode', () => {
    it('should hide stack trace in production', async () => {
      process.env.NODE_ENV = 'production';
      const { errorHandler } = await import('../../../src/middleware/error-handler');

      const error = new Error('Sensitive error details');
      error.stack = 'Error: Sensitive\n    at secret.ts:42\n    at internal.ts:100';

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      const response = jsonMock.mock.calls[0][0];
      expect(response.error.message).not.toContain('secret.ts');
      expect(response.error.message).not.toContain('internal.ts');
      expect(response.error.message).not.toContain('Sensitive error details');
    });

    it('should use generic message for non-AppError in production', async () => {
      process.env.NODE_ENV = 'production';
      const { errorHandler } = await import('../../../src/middleware/error-handler');

      const error = new Error('Detailed internal error message');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      const response = jsonMock.mock.calls[0][0];
      expect(response.error.message).toBe('An unexpected error occurred');
    });

    it('should preserve AppError message in production', async () => {
      process.env.NODE_ENV = 'production';
      const { errorHandler } = await import('../../../src/middleware/error-handler');

      const error = new AppError('User not found', 404);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      const response = jsonMock.mock.calls[0][0];
      expect(response.error.message).toBe('User not found');
    });
  });

  describe('development mode', () => {
    it('should include original error message in development', async () => {
      process.env.NODE_ENV = 'development';
      const { errorHandler } = await import('../../../src/middleware/error-handler');

      const error = new Error('Detailed debug information');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      const response = jsonMock.mock.calls[0][0];
      expect(response.error.message).toContain('Detailed debug information');
    });
  });

  describe('headers already sent', () => {
    it('should call next() if headers already sent', async () => {
      process.env.NODE_ENV = 'development';
      const { errorHandler } = await import('../../../src/middleware/error-handler');

      mockResponse.headersSent = true;
      const error = new Error('Test error');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(statusMock).not.toHaveBeenCalled();
    });
  });

  describe('status code mapping', () => {
    it('should map 400 errors to VALIDATION_ERROR code', async () => {
      process.env.NODE_ENV = 'development';
      const { errorHandler } = await import('../../../src/middleware/error-handler');

      const error = new AppError('Invalid input', 400);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
          }),
        })
      );
    });

    it('should map 404 errors to NOT_FOUND code', async () => {
      process.env.NODE_ENV = 'development';
      const { errorHandler } = await import('../../../src/middleware/error-handler');

      const error = new AppError('Not found', 404);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'NOT_FOUND',
          }),
        })
      );
    });

    it('should map 500 errors to INTERNAL_ERROR code', async () => {
      process.env.NODE_ENV = 'development';
      const { errorHandler } = await import('../../../src/middleware/error-handler');

      const error = new AppError('Server failure', 500);

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'INTERNAL_ERROR',
          }),
        })
      );
    });
  });
});
