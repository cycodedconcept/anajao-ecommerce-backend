import 'dotenv/config';
import { afterAll, expect, it } from 'vitest';
import request from 'supertest';
import { createDatabase } from '../../src/database/client.js';
import { parseEnv } from '../../src/config/env.js';
import { createApp } from '../../src/app.js';
import { createLogger } from '../../src/config/logger.js';
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test'))
  throw new Error('An isolated TEST_DATABASE_URL ending in _test is required');
if (url === process.env.DATABASE_URL)
  throw new Error('Integration database must differ from application database');
const config = parseEnv({
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL: url,
  LOG_LEVEL: 'silent',
});
const database = createDatabase(config);
afterAll(async () => database.disconnect());
it('connects to isolated MariaDB via Prisma and reports readiness', async () => {
  await expect(database.ping()).resolves.toBeUndefined();
  const res = await request(
    createApp(config, database, createLogger('silent')),
  ).get('/api/v1/ready');
  expect(res.status).toBe(200);
  expect(res.body.data.status).toBe('ready');
});
it('returns 503 for an unreachable database', async () => {
  const badUrl = new URL(url);
  badUrl.port = '1';
  const unavailable = createDatabase({
    ...config,
    DATABASE_URL: badUrl.toString(),
    DB_CONNECT_TIMEOUT_MS: 200,
  });
  try {
    const res = await request(
      createApp(config, unavailable, createLogger('silent')),
    ).get('/api/v1/ready');
    expect(res.status).toBe(503);
  } finally {
    await unavailable.disconnect();
  }
});
