import { randomBytes, randomUUID } from 'node:crypto';
import { generate } from 'otplib';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import type { Config } from '../../src/config/env.js';
import {
  IdentityCrypto,
  hashPassword,
  opaqueToken,
  tokenHash,
  verifyPassword,
} from '../../src/modules/identity/identity.crypto.js';
import { IdentityRepository } from '../../src/modules/identity/identity.repository.js';
import { MemoryDelivery } from '../../src/modules/identity/identity.delivery.js';
import { createIdentity } from '../../src/modules/identity/index.js';
export function isolatedTestUrl(env: NodeJS.ProcessEnv): string {
  if (env.NODE_ENV === 'production')
    throw new Error('Production execution refused');
  const target = env.TEST_DATABASE_URL;
  if (!target) throw new Error('TEST_DATABASE_URL is required');
  const url = new URL(target);
  const identity = (value: string) => {
    const u = new URL(value);
    return `${u.hostname}:${u.port || 3306}${decodeURIComponent(u.pathname)}`;
  };
  if (
    url.protocol !== 'mysql:' ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    !decodeURIComponent(url.pathname).endsWith('_test') ||
    (env.DATABASE_URL && identity(target) === identity(env.DATABASE_URL))
  )
    throw new Error(
      'A separate loopback test schema ending in _test is required',
    );
  return target;
}
export function fixtureManager(
  db: PrismaClient,
  config: Config,
  delivery: MemoryDelivery,
) {
  const prefix = `postman-${randomUUID()}`;
  const values: Record<string, string> = {
    password: randomBytes(24).toString('base64url'),
    newPassword: randomBytes(24).toString('base64url'),
    wrongPassword: randomBytes(24).toString('base64url'),
    registrationEmail: `${prefix}-registration@example.test`,
    unknownEmail: `${prefix}-unknown@example.test`,
    apiTestRun: 'isolated-local',
  };
  const users: Record<string, string> = {};
  const repo = new IdentityRepository(db);
  const crypto = new IdentityCrypto(config);
  const service = createIdentity(config, db, delivery);
  let confirmSecret = '';
  return {
    values,
    async prepare() {
      const hash = await hashPassword(values.password!);
      for (const name of [
        'main',
        'other',
        'logout',
        'logoutAll',
        'reset',
        'change',
        'privacy',
        'phone',
        'mfaSetup',
        'mfaConfirm',
        'admin',
        'adminWithoutMfa',
        'seller',
      ]) {
        const email = `${prefix}-${name.toLowerCase()}@example.test`;
        const user = await repo.createCustomer(email, hash, 'API Fixture');
        if (!user) throw new Error('Fixture creation failed');
        users[name] = user.id;
        values[`${name}Email`] = email;
        await db.user.update({
          where: { id: user.id },
          data: {
            emailVerifiedAt: new Date(),
            role: name.startsWith('admin')
              ? 'ADMIN'
              : name === 'seller'
                ? 'SELLER'
                : 'CUSTOMER',
          },
        });
        let step: number | null = null;
        if (['admin', 'seller', 'mfaConfirm'].includes(name)) {
          const factor = crypto.newFactor(user.id);
          await db.mfaFactor.create({
            data: {
              userId: user.id,
              encryptedSecret: factor.encryptedSecret,
              enabledAt: name === 'mfaConfirm' ? null : new Date(),
            },
          });
          if (name === 'mfaConfirm') confirmSecret = factor.secret;
          else step = Math.floor(Date.now() / 30_000);
        }
        const session = await repo.createSession(
          user.id,
          hash,
          tokenHash(opaqueToken()),
          step,
        );
        if (!session) throw new Error('Fixture session failed');
        values[`${name}Access`] = await crypto.sign(user.id, session.id);
        if (name === 'logoutAll') {
          const second = await repo.createSession(
            user.id,
            hash,
            tokenHash(opaqueToken()),
            null,
          );
          if (!second) throw new Error('Fixture session failed');
          values.logoutAllSecondAccess = await crypto.sign(user.id, second.id);
        }
      }
      const verifyEmail = `${prefix}-verify@example.test`;
      await service.register({
        email: verifyEmail,
        password: values.password!,
        displayName: 'API Verify',
      });
      values.verificationToken = delivery.messages.at(-1)!.token;
      await service.instructions(values.resetEmail!, 'PASSWORD_RESET');
      values.resetToken = delivery.messages.at(-1)!.token;
      await service.phone(
        await service.authenticate(values.phoneAccess!),
        '+2348000000000',
      );
      values.phoneToken = delivery.messages.at(-1)!.token;
    },
    async freshMfaCode() {
      values.mfaCode = await generate({ secret: confirmSecret });
    },
    async verifySideEffects() {
      const checks: { name: string; passed: boolean }[] = [];
      const check = async (name: string, test: () => Promise<boolean>) => {
        try {
          checks.push({ name, passed: await test() });
        } catch {
          checks.push({ name, passed: false });
        }
      };
      await check(
        'Registration creates exactly one unverified customer',
        async () => {
          const list = await db.user.findMany({
            where: { email: values.registrationEmail! },
          });
          return (
            list.length === 1 &&
            list[0]!.role === 'CUSTOMER' &&
            list[0]!.emailVerifiedAt === null
          );
        },
      );
      await check(
        'Profile update persists',
        async () =>
          (
            await db.customerProfile.findUnique({
              where: { userId: users.main! },
            })
          )?.displayName === 'API Updated',
      );
      await check(
        'Deleted address is removed',
        async () =>
          (await db.address.count({ where: { userId: users.main! } })) === 0,
      );
      await check(
        'Logout revokes sessions',
        async () =>
          (await db.session.count({
            where: {
              userId: { in: [users.logout!, users.logoutAll!] },
              revokedAt: null,
            },
          })) === 0,
      );
      await check(
        'Refresh replay is audited',
        async () =>
          (await db.auditEvent.count({
            where: { userId: users.main!, event: 'REFRESH_REPLAY' },
          })) === 1,
      );
      await check('Password reset persists the new hash', async () =>
        verifyPassword(
          (await db.user.findUniqueOrThrow({ where: { id: users.reset! } }))
            .passwordHash,
          values.newPassword!,
        ),
      );
      await check(
        'Password change persists and revokes sessions',
        async () =>
          (await verifyPassword(
            (await db.user.findUniqueOrThrow({ where: { id: users.change! } }))
              .passwordHash,
            values.newPassword!,
          )) &&
          (await db.session.count({
            where: { userId: users.change!, revokedAt: null },
          })) === 0,
      );
      await check(
        'Phone verification persists',
        async () =>
          !!(
            await db.customerProfile.findUnique({
              where: { userId: users.phone! },
            })
          )?.phoneVerifiedAt,
      );
      await check(
        'MFA confirmation persists and revokes sessions',
        async () =>
          !!(
            await db.mfaFactor.findUnique({
              where: { userId: users.mfaConfirm! },
            })
          )?.enabledAt &&
          (await db.session.count({
            where: { userId: users.mfaConfirm!, revokedAt: null },
          })) === 0,
      );
      await check(
        'Privacy requests remain unique by pending kind',
        async () =>
          (await db.privacyRequest.count({
            where: { userId: users.privacy! },
          })) === 2,
      );
      await check(
        'Deletion suspends account and revokes sessions',
        async () =>
          (await db.user.findUnique({ where: { id: users.privacy! } }))
            ?.status === 'DELETION_PENDING' &&
          (await db.session.count({
            where: { userId: users.privacy!, revokedAt: null },
          })) === 0,
      );
      return checks;
    },
    async cleanup() {
      const owned = await db.user.findMany({
        where: { email: { startsWith: prefix } },
        select: { id: true },
      });
      const ids = owned.map((u) => u.id);
      await db.auditEvent.deleteMany({ where: { userId: { in: ids } } });
      await db.user.deleteMany({ where: { id: { in: ids } } });
      if (await db.user.count({ where: { email: { startsWith: prefix } } }))
        throw new Error('Fixture cleanup failed');
    },
  };
}
