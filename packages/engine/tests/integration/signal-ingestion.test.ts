import { MongoMemoryServer } from 'mongodb-memory-server';

let mongo: MongoMemoryServer;
let app: import('express').Application;
let SignalModel: typeof import('../../src/models/signal.js').SignalModel;
let mongoose: typeof import('mongoose').default;

const TEST_API_KEY = 'test-key';

const basePayload = {
  platform: 'x' as const,
  externalId: '123',
  authorId: '456',
  conversationId: '123',
  text: 'Hello World #Demo @User https://example.com',
  language: 'en',
  hashtags: ['Demo'],
  mentions: ['User'],
  urls: ['https://example.com'],
  createdAt: '2026-03-14T12:34:56.000Z',
};

describe('/api/signals integration', () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    const uri = mongo.getUri();

    process.env.MONGO_URI = uri;
    process.env.SIGNAL_API_KEYS = TEST_API_KEY;

    jest.resetModules();

    const mongooseModule = await import('mongoose');
    mongoose = mongooseModule.default;
    await mongoose.connect(uri);

    const appModule = await import('../../src/app.js');
    const modelModule = await import('../../src/models/signal.js');

    app = appModule.app;
    SignalModel = modelModule.SignalModel;
  }, 120_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  afterEach(async () => {
    await SignalModel.deleteMany({});
  });

  it('rejects requests without API key', async () => {
    const request = (await import('supertest')).default;
    const response = await request(app).post('/api/signals').send(basePayload);

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects requests with invalid API key', async () => {
    const request = (await import('supertest')).default;
    const response = await request(app)
      .post('/api/signals')
      .set('x-api-key', 'wrong-key')
      .send(basePayload);

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it('ingests a signal with valid API key', async () => {
    const request = (await import('supertest')).default;
    const response = await request(app)
      .post('/api/signals')
      .set('x-api-key', TEST_API_KEY)
      .send(basePayload);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.duplicate).toBe(false);

    const count = await SignalModel.countDocuments({ externalId: '123' }).exec();
    expect(count).toBe(1);
  }, 15_000);

  it('treats duplicate signal as idempotent', async () => {
    const request = (await import('supertest')).default;
    await request(app)
      .post('/api/signals')
      .set('x-api-key', TEST_API_KEY)
      .send(basePayload);

    const second = await request(app)
      .post('/api/signals')
      .set('x-api-key', TEST_API_KEY)
      .send(basePayload);

    expect(second.status).toBe(200);
    expect(second.body.success).toBe(true);
    expect(second.body.data.duplicate).toBe(true);

    const count = await SignalModel.countDocuments({ externalId: '123' }).exec();
    expect(count).toBe(1);
  }, 15_000);

  it('returns 400 for invalid payload', async () => {
    const request = (await import('supertest')).default;
    const response = await request(app)
      .post('/api/signals')
      .set('x-api-key', TEST_API_KEY)
      .send({ platform: 'x' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
