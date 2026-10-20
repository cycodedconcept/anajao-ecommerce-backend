import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { SignJWT } from 'jose';
import { generate } from 'otplib';
import { parseEnv } from '../src/config/env.js';
import {
  IdentityCrypto,
  hashPassword,
  opaqueToken,
  tokenHash,
  verifyPassword,
} from '../src/modules/identity/identity.crypto.js';
import {
  registerSchema,
  loginSchema,
  profileSchema,
  addressSchema,
  paginationSchema,
} from '../src/modules/identity/identity.validation.js';
import { UnconfiguredDelivery } from '../src/modules/identity/identity.delivery.js';
const config = parseEnv({
  DATABASE_URL: 'mysql://test:test@localhost/unit_test',
  AUTH_SIGNING_KEY: randomBytes(32).toString('hex'),
  MFA_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
});
describe('identity security primitives', () => {
  it('hashes passwords with Argon2id and verifies without plaintext storage', async () => {
    const hash = await hashPassword('a-long-test-password');
    expect(hash).toMatch(/^\$argon2id\$v=19\$/);
    expect(hash.split('$')[3]!.split(',').sort()).toEqual([
      'm=19456',
      'p=1',
      't=2',
    ]);
    expect(hash).not.toContain('a-long-test-password');
    expect(await verifyPassword(hash, 'a-long-test-password')).toBe(true);
    expect(await verifyPassword(hash, 'wrong')).toBe(false);
  });
  it('uses bounded random opaque tokens and one-way hashes', () => {
    const token = opaqueToken();
    expect(token).toHaveLength(43);
    expect(tokenHash(token)).toHaveLength(64);
    expect(opaqueToken()).not.toBe(token);
  });
  it('requires distinct signing and encryption keys', () => {
    expect(
      () =>
        new IdentityCrypto({
          ...config,
          MFA_ENCRYPTION_KEY: config.AUTH_SIGNING_KEY,
        }),
    ).toThrow('Distinct');
  });
  it('rejects absent-account passwords using a dummy hash', async () => {
    expect(
      await new IdentityCrypto(config).checkPassword(undefined, 'not-present'),
    ).toBe(false);
  });
  it('verifies signed subject/session and rejects tampering', async () => {
    const crypto = new IdentityCrypto(config);
    const token = await crypto.sign('user', 'session');
    expect(await crypto.verify(token)).toEqual({
      userId: 'user',
      sessionId: 'session',
    });
    await expect(
      crypto.verify(`${token.slice(0, -8)}tampered`),
    ).rejects.toThrow('Invalid credentials');
  });
  it.each(['expired', 'issuer', 'audience', 'algorithm', 'missing-session'])(
    'rejects %s JWTs',
    async (variant) => {
      const token = await new SignJWT(
        variant === 'missing-session' ? {} : { sid: 'session' },
      )
        .setSubject('user')
        .setProtectedHeader({
          alg: variant === 'algorithm' ? 'HS384' : 'HS256',
          typ: 'JWT',
        })
        .setIssuer(variant === 'issuer' ? 'other' : config.AUTH_ISSUER)
        .setAudience(variant === 'audience' ? 'other' : config.AUTH_AUDIENCE)
        .setIssuedAt()
        .setExpirationTime(variant === 'expired' ? '0s' : '10m')
        .sign(Buffer.from(config.AUTH_SIGNING_KEY!, 'hex'));
      await expect(new IdentityCrypto(config).verify(token)).rejects.toThrow(
        'Invalid credentials',
      );
    },
  );
  it('encrypts TOTP secrets, binds them to the user, and rejects replay steps', async () => {
    const crypto = new IdentityCrypto(config);
    const factor = crypto.newFactor('user-id');
    expect(factor.encryptedSecret).not.toContain(factor.secret);
    const code = await generate({ secret: factor.secret });
    const step = await crypto.verifyFactor(
      factor.encryptedSecret,
      'user-id',
      code,
      -1,
    );
    expect(step).toBeTypeOf('number');
    expect(
      await crypto.verifyFactor(factor.encryptedSecret, 'user-id', code, step!),
    ).toBeNull();
    await expect(
      crypto.verifyFactor(factor.encryptedSecret, 'different-user', code, -1),
    ).rejects.toThrow();
  });
  it('fails closed when delivery is unconfigured', () => {
    expect(() => new UnconfiguredDelivery().assertAvailable()).toThrow(
      'not configured',
    );
  });
});
describe('identity boundaries', () => {
  it('normalizes email and rejects public privilege assignments', () => {
    const input = {
      email: ' User@Example.com ',
      password: 'long-test-password',
      displayName: 'User',
    };
    expect(registerSchema.parse(input).email).toBe('user@example.com');
    expect(registerSchema.safeParse({ ...input, role: 'ADMIN' }).success).toBe(
      false,
    );
    expect(
      registerSchema.safeParse({ ...input, password: 'short' }).success,
    ).toBe(false);
  });
  it('bounds credential input and rejects unknown profile fields', () => {
    expect(
      loginSchema.safeParse({
        email: 'a@example.com',
        password: 'x'.repeat(129),
      }).success,
    ).toBe(false);
    expect(profileSchema.safeParse({ role: 'ADMIN' }).success).toBe(false);
    expect(profileSchema.safeParse({ email: 'new@example.com' }).success).toBe(
      false,
    );
    expect(profileSchema.safeParse({}).success).toBe(false);
  });
  it('bounds pagination and address ownership input', () => {
    expect(paginationSchema.safeParse({ limit: 51 }).success).toBe(false);
    expect(paginationSchema.parse({})).toEqual({ page: 1, limit: 20 });
    expect(addressSchema.safeParse({ userId: 'someone-else' }).success).toBe(
      false,
    );
  });
});
