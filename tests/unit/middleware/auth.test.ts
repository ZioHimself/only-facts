import type { Request, Response, NextFunction } from 'express';

describe('apiKeyAuth middleware', () => {
  const originalEnv = process.env;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };

    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    mockRequest = {
      header: jest.fn(),
    };
    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };
    mockNext = jest.fn();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns 401 when x-api-key header is missing', async () => {
    process.env.SIGNAL_API_KEYS = 'valid-key';
    (mockRequest.header as jest.Mock).mockReturnValue(undefined);

    const { apiKeyAuth } = await import('../../../src/middleware/auth');
    apiKeyAuth(mockRequest as Request, mockResponse as Response, mockNext as NextFunction);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'UNAUTHORIZED',
        }),
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('returns 401 when x-api-key is invalid', async () => {
    process.env.SIGNAL_API_KEYS = 'valid-key';
    (mockRequest.header as jest.Mock).mockReturnValue('wrong-key');

    const { apiKeyAuth } = await import('../../../src/middleware/auth');
    apiKeyAuth(mockRequest as Request, mockResponse as Response, mockNext as NextFunction);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('calls next() when x-api-key is valid', async () => {
    process.env.SIGNAL_API_KEYS = 'valid-key,another-key';
    (mockRequest.header as jest.Mock).mockReturnValue('valid-key');

    const { apiKeyAuth } = await import('../../../src/middleware/auth');
    apiKeyAuth(mockRequest as Request, mockResponse as Response, mockNext as NextFunction);

    expect(mockNext).toHaveBeenCalled();
    expect(statusMock).not.toHaveBeenCalled();
  });

  it('rejects all keys when SIGNAL_API_KEYS is empty', async () => {
    delete process.env.SIGNAL_API_KEYS;
    (mockRequest.header as jest.Mock).mockReturnValue('any-key');

    const { apiKeyAuth } = await import('../../../src/middleware/auth');
    apiKeyAuth(mockRequest as Request, mockResponse as Response, mockNext as NextFunction);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('supports multiple comma-separated keys', async () => {
    process.env.SIGNAL_API_KEYS = 'key1, key2, key3';
    (mockRequest.header as jest.Mock).mockReturnValue('key2');

    const { apiKeyAuth } = await import('../../../src/middleware/auth');
    apiKeyAuth(mockRequest as Request, mockResponse as Response, mockNext as NextFunction);

    expect(mockNext).toHaveBeenCalled();
  });
});
