import 'dotenv/config';
import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { generate } from 'otplib';
import { createDatabase } from '../../src/database/client.js';
import { parseEnv } from '../../src/config/env.js';
import { createApp } from '../../src/app.js';
import { createLogger } from '../../src/config/logger.js';
import { createIdentity } from '../../src/modules/identity/index.js';
import {
  MemoryDelivery,
  UnconfiguredDelivery,
} from '../../src/modules/identity/identity.delivery.js';
import { IdentityRepository } from '../../src/modules/identity/identity.repository.js';
import { tokenHash } from '../../src/modules/identity/identity.crypto.js';
const url = process.env.TEST_DATABASE_URL;
const databaseIdentity = (value: string) => {
  const u = new URL(value);
  return `${u.hostname}:${u.port || 3306}${u.pathname}`;
};
if (
  !url ||
  !new URL(url).pathname.endsWith('_test') ||
  (process.env.DATABASE_URL &&
    databaseIdentity(url) === databaseIdentity(process.env.DATABASE_URL))
)
  throw new Error(
    'A distinct isolated TEST_DATABASE_URL ending in _test is required',
  );
const config = parseEnv({
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL: url,
  LOG_LEVEL: 'silent',
  RATE_LIMIT_MAX: '10000',
  AUTH_RATE_LIMIT_MAX: '100',
  AUTH_SIGNING_KEY: randomBytes(32).toString('hex'),
  MFA_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
});
const database = createDatabase(config);
const db = database.client;
const prefix = `m2-${randomUUID()}`;
const password = 'Example-test-password-123!';
const address = {
  label: 'Home',
  recipient: 'Test Customer',
  line1: '1 Example Street',
  city: 'Lagos',
  region: 'Lagos',
  country: 'NG',
};
function harness(limit = 100, delivery = new MemoryDelivery()) {
  const settings = { ...config, AUTH_RATE_LIMIT_MAX: limit };
  const service = createIdentity(settings, db, delivery);
  return {
    app: createApp(
      settings,
      database,
      createLogger('silent'),
      () => false,
      service,
    ),
    delivery,
  };
}
async function customer(h = harness()) {
  const email = `${prefix}-${randomUUID()}@example.test`;
  const registered = await request(h.app)
    .post('/api/v1/auth/register')
    .send({ email, password, displayName: 'Test Customer' });
  expect(registered.status).toBe(202);
  const token = h.delivery.messages.find(
    (m) => m.destination === email && m.purpose === 'EMAIL',
  )!.token;
  expect(
    (await request(h.app).post('/api/v1/auth/verify').send({ token })).status,
  ).toBe(200);
  const login = await request(h.app)
    .post('/api/v1/auth/login')
    .send({ email, password });
  expect(login.status).toBe(200);
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  return {
    ...h,
    email,
    user,
    access: login.body.data.accessToken as string,
    refresh: login.body.data.refreshToken as string,
  };
}
const bearer = (access: string) => `Bearer ${access}`;
afterAll(async () => {
  const users = await db.user.findMany({
    where: { email: { startsWith: prefix } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  await db.auditEvent.deleteMany({ where: { userId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await database.disconnect();
});
describe('identity lifecycle and database invariants', () => {
  it('requires verification; hides duplicate and unknown account existence; stores hashes only', async () => {
    const h = harness();
    const email = `${prefix}-register@example.test`;
    const payload = { email, password, displayName: 'Example' };
    const first = await request(h.app)
      .post('/api/v1/auth/register')
      .send(payload);
    const duplicate = await request(h.app)
      .post('/api/v1/auth/register')
      .send({ ...payload, email: email.toUpperCase() });
    expect(first.status).toBe(202);
    expect(duplicate.body).toEqual(first.body);
    expect(await db.user.count({ where: { email } })).toBe(1);
    expect(
      (
        await request(h.app)
          .post('/api/v1/auth/login')
          .send({ email, password })
      ).status,
    ).toBe(401);
    const challenge = await db.verificationChallenge.findFirstOrThrow({
      where: { user: { email } },
    });
    expect(challenge.tokenHash).toBe(tokenHash(h.delivery.messages[0]!.token));
    const known = await request(h.app)
      .post('/api/v1/auth/forgot-password')
      .send({ email });
    const unknown = await request(h.app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: `${prefix}-missing@example.test` });
    expect(known.body).toEqual(unknown.body);
    const invalid = await request(h.app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'incorrect' });
    const missing = await request(h.app)
      .post('/api/v1/auth/login')
      .send({ email: `${prefix}-missing@example.test`, password });
    expect(invalid.body).toEqual(missing.body);
  });
  it('rejects invalid, expired, and concurrently reused verification challenges', async () => {
    const h = harness();
    const email = `${prefix}-verify@example.test`;
    await request(h.app)
      .post('/api/v1/auth/register')
      .send({ email, password, displayName: 'Verify' });
    const token = h.delivery.messages[0]!.token;
    const results = await Promise.all(
      [1, 2].map(() =>
        request(h.app).post('/api/v1/auth/verify').send({ token }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
    expect(
      (
        await request(h.app)
          .post('/api/v1/auth/verify')
          .send({ token: 'x'.repeat(43) })
      ).status,
    ).toBe(400);
    const secondEmail = `${prefix}-expired@example.test`;
    await request(h.app)
      .post('/api/v1/auth/register')
      .send({ email: secondEmail, password, displayName: 'Expired' });
    const expired = h.delivery.messages.at(-1)!.token;
    await db.verificationChallenge.update({
      where: { tokenHash: tokenHash(expired) },
      data: { expiresAt: new Date(0) },
    });
    expect(
      (
        await request(h.app)
          .post('/api/v1/auth/verify')
          .send({ token: expired })
      ).status,
    ).toBe(400);
  });
  it('returns safe profiles and blocks role escalation and unauthorized access', async () => {
    const c = await customer();
    const profile = await request(c.app)
      .get('/api/v1/me')
      .set('Authorization', bearer(c.access));
    expect(profile.body.data.email).toBe(c.email);
    expect(profile.body.data.role).toBe('CUSTOMER');
    expect(profile.text).not.toMatch(/passwordHash|encryptedSecret|tokenHash/);
    expect((await request(c.app).get('/api/v1/me')).status).toBe(401);
    expect(
      (
        await request(c.app)
          .get('/api/v1/me')
          .set('Cookie', `accessToken=${c.access}`)
      ).status,
    ).toBe(401);
    expect(
      (
        await request(c.app)
          .get('/api/v1/me')
          .set('Authorization', bearer(`${c.access}bad`))
      ).status,
    ).toBe(401);
    expect(
      (
        await request(c.app)
          .patch('/api/v1/me')
          .set('Authorization', bearer(c.access))
          .send({ role: 'ADMIN' })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(c.app)
          .patch('/api/v1/me')
          .set('Authorization', bearer(c.access))
          .send({ displayName: 'Updated' })
      ).body.data.displayName,
    ).toBe('Updated');
    expect(
      (
        await request(c.app)
          .get('/api/v1/admin/access')
          .set('Authorization', bearer(c.access))
      ).status,
    ).toBe(403);
    expect(
      (
        await request(c.app)
          .get('/api/v1/seller/access')
          .set('Authorization', bearer(c.access))
      ).status,
    ).toBe(403);
    expect(
      (
        await request(c.app).post('/api/v1/auth/register').send({
          email: 'other@example.test',
          password,
          displayName: 'Other',
          role: 'ADMIN',
        })
      ).status,
    ).toBe(400);
  });
  it('rotates refresh tokens and revokes the family on replay', async () => {
    const c = await customer();
    const rotated = await request(c.app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: c.refresh });
    expect(rotated.status).toBe(200);
    expect(rotated.body.data.refreshToken).not.toBe(c.refresh);
    expect(
      (
        await request(c.app)
          .post('/api/v1/auth/refresh')
          .send({ refreshToken: c.refresh })
      ).status,
    ).toBe(401);
    expect(
      (
        await request(c.app)
          .get('/api/v1/me')
          .set('Authorization', bearer(rotated.body.data.accessToken))
      ).status,
    ).toBe(401);
    expect(
      (
        await request(c.app)
          .post('/api/v1/auth/refresh')
          .send({ refreshToken: rotated.body.data.refreshToken })
      ).status,
    ).toBe(401);
    expect(
      await db.auditEvent.count({
        where: { userId: c.user.id, event: 'REFRESH_REPLAY' },
      }),
    ).toBe(1);
  });
  it('allows only one concurrent refresh and revokes the winner after replay', async () => {
    const c = await customer();
    const results = await Promise.all(
      [1, 2].map(() =>
        request(c.app)
          .post('/api/v1/auth/refresh')
          .send({ refreshToken: c.refresh }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
    const winner = results.find((r) => r.status === 200)!;
    expect(
      (
        await request(c.app)
          .get('/api/v1/me')
          .set('Authorization', bearer(winner.body.data.accessToken))
      ).status,
    ).toBe(401);
  });
  it('rejects expired and unknown refresh tokens', async () => {
    const c = await customer();
    await db.refreshToken.update({
      where: { tokenHash: tokenHash(c.refresh) },
      data: { expiresAt: new Date(0) },
    });
    expect(
      (
        await request(c.app)
          .post('/api/v1/auth/refresh')
          .send({ refreshToken: c.refresh })
      ).status,
    ).toBe(401);
    expect(
      (
        await request(c.app)
          .post('/api/v1/auth/refresh')
          .send({ refreshToken: 'x'.repeat(43) })
      ).status,
    ).toBe(401);
  });
  it('logs out one session then revokes all remaining sessions', async () => {
    const c = await customer();
    const second = await request(c.app)
      .post('/api/v1/auth/login')
      .send({ email: c.email, password });
    expect(
      (
        await request(c.app)
          .post('/api/v1/auth/logout')
          .set('Authorization', bearer(c.access))
      ).status,
    ).toBe(200);
    expect(
      (
        await request(c.app)
          .get('/api/v1/me')
          .set('Authorization', bearer(c.access))
      ).status,
    ).toBe(401);
    expect(
      (
        await request(c.app)
          .get('/api/v1/me')
          .set('Authorization', bearer(second.body.data.accessToken))
      ).status,
    ).toBe(200);
    expect(
      (
        await request(c.app)
          .post('/api/v1/auth/logout-all')
          .set('Authorization', bearer(second.body.data.accessToken))
      ).status,
    ).toBe(200);
    expect(
      (
        await request(c.app)
          .post('/api/v1/auth/refresh')
          .send({ refreshToken: second.body.data.refreshToken })
      ).status,
    ).toBe(401);
  });
  it('resets once under concurrency and invalidates existing sessions', async () => {
    const c = await customer();
    await request(c.app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: c.email });
    const token = c.delivery.messages.at(-1)!.token;
    const results = await Promise.all(
      [1, 2].map(() =>
        request(c.app)
          .post('/api/v1/auth/reset-password')
          .send({ token, password: `${password}new` }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
    expect(
      (
        await request(c.app)
          .get('/api/v1/me')
          .set('Authorization', bearer(c.access))
      ).status,
    ).toBe(401);
    expect(
      (
        await request(c.app)
          .post('/api/v1/auth/login')
          .send({ email: c.email, password })
      ).status,
    ).toBe(401);
    expect(
      (
        await request(c.app)
          .post('/api/v1/auth/login')
          .send({ email: c.email, password: `${password}new` })
      ).status,
    ).toBe(200);
  });
  it('rejects expired reset tokens and invalidates older challenges on resend', async () => {
    const c = await customer();
    await request(c.app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: c.email });
    const first = c.delivery.messages.at(-1)!.token;
    await request(c.app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: c.email });
    const latest = c.delivery.messages.at(-1)!.token;
    expect(
      (
        await request(c.app)
          .post('/api/v1/auth/reset-password')
          .send({ token: first, password })
      ).status,
    ).toBe(400);
    await db.verificationChallenge.update({
      where: { tokenHash: tokenHash(latest) },
      data: { expiresAt: new Date(0) },
    });
    expect(
      (
        await request(c.app)
          .post('/api/v1/auth/reset-password')
          .send({ token: latest, password })
      ).status,
    ).toBe(400);
  });
  it('changes passwords only after reauthentication and revokes refresh sessions', async () => {
    const c = await customer();
    expect(
      (
        await request(c.app)
          .post('/api/v1/me/password')
          .set('Authorization', bearer(c.access))
          .send({ currentPassword: 'wrong', password })
      ).status,
    ).toBe(401);
    expect(
      (
        await request(c.app)
          .post('/api/v1/me/password')
          .set('Authorization', bearer(c.access))
          .send({ currentPassword: password, password: `${password}new` })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(c.app)
          .post('/api/v1/auth/refresh')
          .send({ refreshToken: c.refresh })
      ).status,
    ).toBe(401);
  });
  it('enforces address ownership, bounded lists, update and deletion', async () => {
    const h = harness();
    const a = await customer(h);
    const b = await customer(h);
    const saved = await request(h.app)
      .post('/api/v1/me/addresses')
      .set('Authorization', bearer(a.access))
      .send(address);
    expect(saved.status).toBe(201);
    const id = saved.body.data.id as string;
    expect(
      (
        await request(h.app)
          .put(`/api/v1/me/addresses/${id}`)
          .set('Authorization', bearer(b.access))
          .send(address)
      ).status,
    ).toBe(404);
    expect(
      (
        await request(h.app)
          .delete(`/api/v1/me/addresses/${id}`)
          .set('Authorization', bearer(b.access))
      ).status,
    ).toBe(404);
    expect(
      (
        await request(h.app)
          .get('/api/v1/me/addresses')
          .set('Authorization', bearer(b.access))
      ).body.data,
    ).toEqual([]);
    expect(
      (
        await request(h.app)
          .get('/api/v1/me/addresses?limit=51')
          .set('Authorization', bearer(a.access))
      ).status,
    ).toBe(400);
    expect(
      (
        await request(h.app)
          .put(`/api/v1/me/addresses/${id}`)
          .set('Authorization', bearer(a.access))
          .send({ ...address, label: 'Office' })
      ).body.data.label,
    ).toBe('Office');
    expect(
      (
        await request(h.app)
          .delete(`/api/v1/me/addresses/${id}`)
          .set('Authorization', bearer(a.access))
      ).status,
    ).toBe(200);
  });
  it('binds phone challenges to the authenticated owner and accepts them once', async () => {
    const h = harness();
    const a = await customer(h);
    const b = await customer(h);
    expect(
      (
        await request(h.app)
          .post('/api/v1/me/phone')
          .set('Authorization', bearer(a.access))
          .send({ phone: '+2348000000000' })
      ).status,
    ).toBe(202);
    const token = h.delivery.messages.at(-1)!.token;
    expect(
      (
        await request(h.app)
          .post('/api/v1/me/phone/verify')
          .set('Authorization', bearer(b.access))
          .send({ token })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(h.app)
          .post('/api/v1/me/phone/verify')
          .set('Authorization', bearer(a.access))
          .send({ token })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(h.app)
          .post('/api/v1/me/phone/verify')
          .set('Authorization', bearer(a.access))
          .send({ token })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(h.app)
          .get('/api/v1/me')
          .set('Authorization', bearer(a.access))
      ).body.data.phoneVerified,
    ).toBe(true);
  });
  it('records idempotent export requests and suspends accounts on deletion requests', async () => {
    const c = await customer();
    const first = await request(c.app)
      .post('/api/v1/me/privacy-requests')
      .set('Authorization', bearer(c.access))
      .send({ kind: 'EXPORT', password });
    const second = await request(c.app)
      .post('/api/v1/me/privacy-requests')
      .set('Authorization', bearer(c.access))
      .send({ kind: 'EXPORT', password });
    expect(first.status).toBe(202);
    expect(second.body.data.id).toBe(first.body.data.id);
    expect(
      (
        await request(c.app)
          .get('/api/v1/me/privacy-requests')
          .set('Authorization', bearer(c.access))
      ).body.data,
    ).toHaveLength(1);
    expect(
      (
        await request(c.app)
          .post('/api/v1/me/privacy-requests')
          .set('Authorization', bearer(c.access))
          .send({ kind: 'DELETE', password })
      ).status,
    ).toBe(202);
    expect(
      (
        await request(c.app)
          .get('/api/v1/me')
          .set('Authorization', bearer(c.access))
      ).status,
    ).toBe(401);
    expect(
      (
        await request(c.app)
          .post('/api/v1/auth/login')
          .send({ email: c.email, password })
      ).status,
    ).toBe(401);
    expect(
      (
        await request(c.app)
          .post('/api/v1/auth/refresh')
          .send({ refreshToken: c.refresh })
      ).status,
    ).toBe(401);
  });
  it('enforces privileged MFA, encrypted enrollment, replay prevention and audited bootstrap', async () => {
    const c = await customer();
    const repo = new IdentityRepository(db);
    expect(await repo.bootstrapAdmin(c.email)).toBe(false);
    const setup = await request(c.app)
      .post('/api/v1/me/mfa/setup')
      .set('Authorization', bearer(c.access))
      .send({ password });
    expect(setup.status).toBe(200);
    const secret = setup.body.data.secret as string;
    // Use the previous permitted time step to allow a fresh login code without sleeps.
    const previous = await generate({
      secret,
      epoch: Math.floor(Date.now() / 1000) - 30,
    });
    expect(
      (
        await request(c.app)
          .post('/api/v1/me/mfa/confirm')
          .set('Authorization', bearer(c.access))
          .send({ code: previous })
      ).status,
    ).toBe(200);
    expect(await repo.bootstrapAdmin(c.email)).toBe(true);
    expect(
      (
        await request(c.app)
          .get('/api/v1/me')
          .set('Authorization', bearer(c.access))
      ).status,
    ).toBe(401);
    expect(
      (
        await request(c.app)
          .post('/api/v1/auth/login')
          .send({ email: c.email, password })
      ).status,
    ).toBe(401);
    const code = await generate({ secret });
    const login = await request(c.app)
      .post('/api/v1/auth/login')
      .send({ email: c.email, password, code });
    expect(login.status).toBe(200);
    expect(
      (
        await request(c.app)
          .get('/api/v1/admin/access')
          .set('Authorization', bearer(login.body.data.accessToken))
      ).status,
    ).toBe(200);
    expect(
      (
        await request(c.app)
          .get('/api/v1/seller/access')
          .set('Authorization', bearer(login.body.data.accessToken))
      ).status,
    ).toBe(403);
    expect(
      (
        await request(c.app)
          .post('/api/v1/auth/login')
          .send({ email: c.email, password, code })
      ).status,
    ).toBe(401);
    const factor = await db.mfaFactor.findUniqueOrThrow({
      where: { userId: c.user.id },
    });
    expect(factor.encryptedSecret).not.toContain(secret);
    expect(
      await db.auditEvent.count({
        where: { userId: c.user.id, event: 'ADMIN_BOOTSTRAP_GRANTED' },
      }),
    ).toBe(1);
  });
  it('blocks privileged access before MFA even with an otherwise valid session', async () => {
    const c = await customer();
    await db.user.update({
      where: { id: c.user.id },
      data: { role: 'SELLER' },
    });
    const denied = await request(c.app)
      .get('/api/v1/seller/access')
      .set('Authorization', bearer(c.access));
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('MFA_REQUIRED');
  });
  it('throttles login attempts and disables unconfigured providers', async () => {
    const h = harness(1);
    await request(h.app)
      .post('/api/v1/auth/login')
      .send({ email: `${prefix}-absent@example.test`, password });
    expect(
      (
        await request(h.app)
          .post('/api/v1/auth/login')
          .send({ email: `${prefix}-absent@example.test`, password })
      ).status,
    ).toBe(429);
    const disabled = createApp(
      config,
      database,
      createLogger('silent'),
      () => false,
      createIdentity(config, db, new UnconfiguredDelivery()),
    );
    expect(
      (
        await request(disabled)
          .post('/api/v1/auth/register')
          .send({
            email: `${prefix}-disabled@example.test`,
            password,
            displayName: 'Disabled',
          })
      ).status,
    ).toBe(503);
    expect(
      (
        await request(disabled)
          .post('/api/v1/auth/social/google')
          .send({ token: 'fake' })
      ).status,
    ).toBe(503);
    expect(
      (
        await request(disabled)
          .post('/api/v1/auth/social/apple')
          .send({ token: 'fake' })
      ).status,
    ).toBe(503);
  });
  it('sanitizes delivery failures and preserves generic registration responses', async () => {
    class FailingDelivery extends MemoryDelivery {
      override async send(): Promise<void> {
        throw new Error('provider-password-secret');
      }
    }
    const h = harness(100, new FailingDelivery());
    const email = `${prefix}-delivery@example.test`;
    const first = await request(h.app)
      .post('/api/v1/auth/register')
      .send({ email, password, displayName: 'Delivery' });
    const duplicate = await request(h.app)
      .post('/api/v1/auth/register')
      .send({ email, password, displayName: 'Delivery' });
    expect(first.status).toBe(202);
    expect(first.body).toEqual(duplicate.body);
    expect(first.text).not.toContain('secret');
    const challenge = await db.verificationChallenge.findFirstOrThrow({
      where: { user: { email } },
    });
    expect(challenge.consumedAt).not.toBeNull();
    expect(
      await db.auditEvent.count({
        where: { userId: challenge.userId, event: 'DELIVERY_FAILED' },
      }),
    ).toBe(1);
  });
  it('limits the same account across different client IPs behind an explicitly trusted proxy', async () => {
    const settings = { ...config, TRUST_PROXY_HOPS: 1, AUTH_RATE_LIMIT_MAX: 1 };
    const app = createApp(
      settings,
      database,
      createLogger('silent'),
      () => false,
      createIdentity(settings, db, new MemoryDelivery()),
    );
    const email = `${prefix}-throttle@example.test`;
    await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', '192.0.2.1')
      .send({ email, password });
    const denied = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', '192.0.2.2')
      .send({ email: email.toUpperCase(), password });
    expect(denied.status).toBe(429);
  });
  it('enforces database uniqueness under concurrent registration and foreign keys', async () => {
    const h = harness();
    const email = `${prefix}-concurrent@example.test`;
    const results = await Promise.all(
      [1, 2].map(() =>
        request(h.app)
          .post('/api/v1/auth/register')
          .send({ email, password, displayName: 'Concurrent' }),
      ),
    );
    expect(results.map((r) => r.status)).toEqual([202, 202]);
    expect(await db.user.count({ where: { email } })).toBe(1);
    expect(h.delivery.messages).toHaveLength(1);
    await expect(
      db.address.create({ data: { ...address, userId: randomUUID() } }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });
  it('rejects expired MFA enrollment and expired sessions', async () => {
    const c = await customer();
    const setup = await request(c.app)
      .post('/api/v1/me/mfa/setup')
      .set('Authorization', bearer(c.access))
      .send({ password });
    expect(setup.status).toBe(200);
    await db.mfaFactor.update({
      where: { userId: c.user.id },
      data: { createdAt: new Date(0) },
    });
    const code = await generate({ secret: setup.body.data.secret as string });
    expect(
      (
        await request(c.app)
          .post('/api/v1/me/mfa/confirm')
          .set('Authorization', bearer(c.access))
          .send({ code })
      ).status,
    ).toBe(400);
    await db.session.updateMany({
      where: { userId: c.user.id },
      data: { expiresAt: new Date(0) },
    });
    expect(
      (
        await request(c.app)
          .get('/api/v1/me')
          .set('Authorization', bearer(c.access))
      ).status,
    ).toBe(401);
    expect(
      (
        await request(c.app)
          .post('/api/v1/auth/refresh')
          .send({ refreshToken: c.refresh })
      ).status,
    ).toBe(401);
  });
});
