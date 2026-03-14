import { MongoMemoryServer } from 'mongodb-memory-server';

let mongo: MongoMemoryServer;
let app: import('express').Application;
let mongoose: typeof import('mongoose').default;

const TEST_API_KEY = 'test-key';

const basePayload = {
  platform: 'x' as const,
  externalId: '123',
  authorId: '456',
  conversationId: '123',
  text: 'Hello World',
  language: 'en',
  createdAt: '2026-03-14T12:34:56.000Z',
};

describe('POST /api/signals rate limiting', () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    const uri = mongo.getUri();

    process.env.MONGO_URI = uri;
    process.env.SIGNAL_API_KEYS = TEST_API_KEY;
    process.env.SIGNAL_RATE_LIMIT_WINDOW_MS = '60000';
    process.env.SIGNAL_RATE_LIMIT_MAX = '3';

    jest.resetModules();

    const mongooseModule = await import('mongoose');
    mongoose = mongooseModule.default;
    await mongoose.connect(uri);

    const appModule = await import('../../src/app.js');
    app = appModule.app;
  }, 120_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it('returns 429 after exceeding rate limit', async () => {
    const request = (await import('supertest')).default;

    for (let i = 0; i < 3; i++) {
      const payload = { ...basePayload, externalId: `rate-${i}` };
      const res = await request(app)
        .post('/api/signals')
        .set('x-api-key', TEST_API_KEY)
        .send(payload);
      expect([200, 201]).toContain(res.status);
    }

    const blocked = await request(app)
      .post('/api/signals')
      .set('x-api-key', TEST_API_KEY)
      .send({ ...basePayload, externalId: 'rate-blocked' });

    expect(blocked.status).toBe(429);
    expect(blocked.body.success).toBe(false);
    expect(blocked.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
  }, 30_000);
});
