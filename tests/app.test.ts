import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createApp } from '../src/app.js';
import { parseEnv } from '../src/config/env.js';
import { createLogger } from '../src/config/logger.js';
import { errorHandler } from '../src/common/middleware/error-handler.js';
const config = parseEnv({
  DATABASE_URL: 'mysql://test:test@localhost/anajao_test',
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
});
const logger = createLogger('silent');
const database = () => ({
  ping: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
});
describe('API foundation', () => {
  it('creates an app without connecting to the database', () => {
    const db = database();
    expect(createApp(config, db, logger)).toBeTypeOf('function');
    expect(db.ping).not.toHaveBeenCalled();
  });
  it('returns liveness with security and request headers', async () => {
    const res = await request(createApp(config, database(), logger)).get(
      '/api/v1/health',
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { status: 'ok' } });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-request-id']).toBeTruthy();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
  it('returns readiness after database probe', async () => {
    const db = database();
    const res = await request(createApp(config, db, logger)).get(
      '/api/v1/ready',
    );
    expect(res.status).toBe(200);
    expect(db.ping).toHaveBeenCalledOnce();
  });
  it('returns sanitized 503 on database failure', async () => {
    const db = database();
    db.ping.mockRejectedValue(new Error('mysql://secret'));
    const res = await request(createApp(config, db, logger)).get(
      '/api/v1/ready',
    );
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('NOT_READY');
    expect(res.text).not.toContain('secret');
  });
  it('rejects readiness while draining', async () => {
    const db = database();
    expect(
      (
        await request(createApp(config, db, logger, () => true)).get(
          '/api/v1/ready',
        )
      ).status,
    ).toBe(503);
    expect(db.ping).not.toHaveBeenCalled();
  });
  it('returns JSON 404', async () => {
    const res = await request(createApp(config, database(), logger)).get(
      '/missing',
    );
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
  it('validates query parameters', async () => {
    const res = await request(createApp(config, database(), logger)).get(
      '/api/v1/health?unexpected=1',
    );
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
  it('handles malformed JSON', async () => {
    const res = await request(createApp(config, database(), logger))
      .post('/missing')
      .set('Content-Type', 'application/json')
      .send('{');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });
  it('sanitizes unexpected errors', async () => {
    const app = express();
    app.get('/', () => {
      throw new Error('password=secret');
    });
    app.use(errorHandler(logger));
    const res = await request(app).get('/');
    expect(res.status).toBe(500);
    expect(res.text).not.toContain('secret');
  });
  it('blocks unlisted CORS origins and allows configured origins', async () => {
    const app = createApp(
      { ...config, CORS_ORIGINS: ['https://shop.example.com'] },
      database(),
      logger,
    );
    const denied = await request(app)
      .get('/api/v1/health')
      .set('Origin', 'https://evil.example.com');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
    const allowed = await request(app)
      .get('/api/v1/health')
      .set('Origin', 'https://shop.example.com');
    expect(allowed.headers['access-control-allow-origin']).toBe(
      'https://shop.example.com',
    );
  });
  it('rate limits with consistent errors', async () => {
    const app = createApp({ ...config, RATE_LIMIT_MAX: 1 }, database(), logger);
    await request(app).get('/api/v1/health');
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });
  it('serves Swagger UI and OpenAPI', async () => {
    const app = createApp(config, database(), logger);
    expect((await request(app).get('/api-docs/')).status).toBe(200);
    const res = await request(app).get('/api-docs/openapi.json');
    expect(res.body.openapi).toBe('3.0.3');
    expect(res.body.paths['/api/v1/ready']).toBeTruthy();
  });
});
describe('environment validation', () => {
  it.each([
    {},
    { DATABASE_URL: 'invalid' },
    { DATABASE_URL: 'postgres://user:secret@localhost/db' },
    { DATABASE_URL: config.DATABASE_URL, PORT: 'zero' },
    { DATABASE_URL: config.DATABASE_URL, CORS_ORIGINS: '*' },
  ])('rejects invalid configuration without leaking secrets', (env) => {
    expect(() => parseEnv(env)).toThrow('Invalid environment configuration');
    try {
      parseEnv(env);
    } catch (error) {
      expect(String(error)).not.toContain('secret');
    }
  });
  it('uses safe defaults', () => {
    expect(config.HOST).toBe('127.0.0.1');
    expect(config.CORS_ORIGINS).toEqual([]);
    expect(config.TRUST_PROXY_HOPS).toBe(0);
  });
});
