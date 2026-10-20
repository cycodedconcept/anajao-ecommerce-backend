import type {
  PrismaClient,
  Prisma,
  ChallengePurpose,
  PrivacyKind,
} from '../../generated/prisma/client.js';
import { AppError } from '../../common/errors/app-error.js';
import type { AddressInput } from './identity.validation.js';
const accountInclude = { profile: true, mfa: true } as const;
export class IdentityRepository {
  constructor(private readonly db: PrismaClient) {}
  findByEmail(email: string) {
    return this.db.user.findUnique({
      where: { email },
      include: accountInclude,
    });
  }
  findById(id: string) {
    return this.db.user.findUnique({ where: { id }, include: accountInclude });
  }
  async bootstrapAdmin(email: string) {
    const found = await this.findByEmail(email);
    if (!found || found.status !== 'ACTIVE') return false;
    return this.locked(found.id, async (tx) => {
      const user = await tx.user.findUniqueOrThrow({
        where: { id: found.id },
        include: { mfa: true },
      });
      if (
        user.role !== 'CUSTOMER' ||
        !user.emailVerifiedAt ||
        !user.mfa?.enabledAt
      )
        return false;
      await tx.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
      await tx.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.auditEvent.create({
        data: { userId: user.id, event: 'ADMIN_BOOTSTRAP_GRANTED' },
      });
      return true;
    });
  }
  private async locked<T>(
    userId: string,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.db.$transaction(
      async (tx) => {
        // All credential/lifecycle mutations lock the same parent row first.
        const locked = await tx.user.updateMany({
          where: { id: userId, status: 'ACTIVE' },
          data: { updatedAt: new Date() },
        });
        if (locked.count !== 1)
          throw new AppError(
            401,
            'UNAUTHORIZED',
            'Invalid credentials or session',
          );
        return work(tx);
      },
      { isolationLevel: 'ReadCommitted', maxWait: 5000, timeout: 10000 },
    );
  }
  async createCustomer(
    email: string,
    passwordHash: string,
    displayName: string,
  ) {
    try {
      return await this.db.user.create({
        data: {
          email,
          passwordHash,
          profile: { create: { displayName } },
          auditEvents: { create: { event: 'REGISTERED' } },
        },
        include: accountInclude,
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      )
        return null;
      throw error;
    }
  }
  async audit(userId: string | null, event: string): Promise<void> {
    await this.db.auditEvent.create({ data: { userId, event } });
  }
  async challenge(
    userId: string,
    purpose: ChallengePurpose,
    target: string,
    hash: string,
  ) {
    return this.locked(userId, async (tx) => {
      const now = new Date();
      await tx.verificationChallenge.updateMany({
        where: { userId, purpose, consumedAt: null },
        data: { consumedAt: now },
      });
      return tx.verificationChallenge.create({
        data: {
          userId,
          purpose,
          target,
          tokenHash: hash,
          expiresAt: new Date(now.getTime() + 30 * 60_000),
        },
      });
    });
  }
  async cancelChallenge(id: string) {
    await this.db.verificationChallenge.updateMany({
      where: { id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
  }
  consumePhone(userId: string, hash: string) {
    return this.consumeChallenge(hash, 'PHONE', undefined, userId);
  }
  async consumeChallenge(
    hash: string,
    purpose: ChallengePurpose,
    passwordHash?: string,
    userId?: string,
  ) {
    const found = await this.db.verificationChallenge.findUnique({
      where: { tokenHash: hash },
    });
    if (
      !found ||
      found.purpose !== purpose ||
      (userId && found.userId !== userId)
    )
      return false;
    return this.locked(found.userId, async (tx) => {
      const now = new Date();
      const claimed = await tx.verificationChallenge.updateMany({
        where: {
          id: found.id,
          purpose,
          consumedAt: null,
          expiresAt: { gt: now },
        },
        data: { consumedAt: now },
      });
      if (claimed.count !== 1) return false;
      if (purpose === 'EMAIL')
        await tx.user.update({
          where: { id: found.userId },
          data: { emailVerifiedAt: now },
        });
      if (purpose === 'PHONE')
        await tx.customerProfile.update({
          where: { userId: found.userId },
          data: { phone: found.target, phoneVerifiedAt: now },
        });
      if (purpose === 'PASSWORD_RESET') {
        if (!passwordHash) throw new Error('Password hash required');
        await tx.user.update({
          where: { id: found.userId },
          data: { passwordHash },
        });
        await tx.session.updateMany({
          where: { userId: found.userId, revokedAt: null },
          data: { revokedAt: now },
        });
        await tx.verificationChallenge.updateMany({
          where: { userId: found.userId, purpose, consumedAt: null },
          data: { consumedAt: now },
        });
      }
      await tx.auditEvent.create({
        data: { userId: found.userId, event: `${purpose}_COMPLETED` },
      });
      return true;
    });
  }
  async createSession(
    userId: string,
    expectedPasswordHash: string,
    refreshHash: string,
    mfaStep: number | null,
  ) {
    return this.locked(userId, async (tx) => {
      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        include: accountInclude,
      });
      if (user.passwordHash !== expectedPasswordHash || !user.emailVerifiedAt)
        return null;
      if (user.mfa?.enabledAt) {
        if (mfaStep === null) return null;
        const used = await tx.mfaFactor.updateMany({
          where: { userId, lastUsedStep: { lt: mfaStep } },
          data: { lastUsedStep: mfaStep },
        });
        if (used.count !== 1) return null;
      } else if (mfaStep !== null) return null;
      const expiresAt = new Date(Date.now() + 30 * 86400_000);
      const session = await tx.session.create({
        data: {
          userId,
          expiresAt,
          mfaVerifiedAt: mfaStep === null ? null : new Date(),
          refreshTokens: { create: { tokenHash: refreshHash, expiresAt } },
        },
      });
      await tx.auditEvent.create({ data: { userId, event: 'LOGIN' } });
      return session;
    });
  }
  async rotate(hash: string, replacementHash: string) {
    const found = await this.db.refreshToken.findUnique({
      where: { tokenHash: hash },
      include: { session: true },
    });
    if (!found) return null;
    return this.locked(found.session.userId, async (tx) => {
      const current = await tx.refreshToken.findUniqueOrThrow({
        where: { id: found.id },
        include: { session: true },
      });
      const now = new Date();
      if (current.consumedAt) {
        await tx.session.update({
          where: { id: current.sessionId },
          data: { revokedAt: now },
        });
        await tx.auditEvent.create({
          data: { userId: current.session.userId, event: 'REFRESH_REPLAY' },
        });
        return null; // Commit revocation before returning the authentication failure.
      }
      if (
        current.session.revokedAt ||
        current.expiresAt <= now ||
        current.session.expiresAt <= now
      )
        return null;
      await tx.refreshToken.update({
        where: { id: current.id },
        data: { consumedAt: now },
      });
      await tx.refreshToken.create({
        data: {
          sessionId: current.sessionId,
          tokenHash: replacementHash,
          expiresAt: current.session.expiresAt,
        },
      });
      return current.session;
    });
  }
  async session(userId: string, id: string) {
    return this.db.session.findFirst({
      where: {
        id,
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { status: 'ACTIVE', emailVerifiedAt: { not: null } },
      },
      include: { user: { include: accountInclude } },
    });
  }
  async revoke(userId: string, sessionId?: string) {
    await this.locked(userId, async (tx) => {
      await tx.session.updateMany({
        where: {
          userId,
          ...(sessionId ? { id: sessionId } : {}),
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
      await tx.auditEvent.create({
        data: { userId, event: sessionId ? 'LOGOUT' : 'LOGOUT_ALL' },
      });
    });
  }
  async password(userId: string, expected: string, passwordHash: string) {
    return this.locked(userId, async (tx) => {
      const changed = await tx.user.updateMany({
        where: { id: userId, passwordHash: expected },
        data: { passwordHash },
      });
      if (changed.count !== 1) return false;
      await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.verificationChallenge.updateMany({
        where: { userId, purpose: 'PASSWORD_RESET', consumedAt: null },
        data: { consumedAt: new Date() },
      });
      await tx.auditEvent.create({
        data: { userId, event: 'PASSWORD_CHANGED' },
      });
      return true;
    });
  }
  async profile(userId: string, displayName: string) {
    return this.locked(userId, (tx) =>
      tx.customerProfile.update({ where: { userId }, data: { displayName } }),
    );
  }
  addresses(userId: string, page: number, limit: number) {
    return this.db.address.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    });
  }
  async saveAddress(userId: string, input: AddressInput, id?: string) {
    const data = {
      ...input,
      line2: input.line2 ?? null,
      postalCode: input.postalCode ?? null,
    };
    return this.locked(userId, async (tx) => {
      if (id) {
        const changed = await tx.address.updateMany({
          where: { id, userId },
          data,
        });
        return changed.count
          ? tx.address.findFirst({ where: { id, userId } })
          : null;
      }
      if ((await tx.address.count({ where: { userId } })) >= 20)
        throw new AppError(409, 'ADDRESS_LIMIT', 'Maximum 20 saved addresses');
      return tx.address.create({ data: { ...data, userId } });
    });
  }
  async deleteAddress(userId: string, id: string) {
    return this.locked(userId, (tx) =>
      tx.address.deleteMany({ where: { id, userId } }),
    );
  }
  async setupMfa(
    userId: string,
    expectedPasswordHash: string,
    encryptedSecret: string,
  ) {
    return this.locked(userId, async (tx) => {
      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        include: { mfa: true },
      });
      if (user.passwordHash !== expectedPasswordHash || user.mfa?.enabledAt)
        return false;
      await tx.mfaFactor.upsert({
        where: { userId },
        create: { userId, encryptedSecret },
        update: { encryptedSecret, createdAt: new Date(), lastUsedStep: -1 },
      });
      await tx.auditEvent.create({
        data: { userId, event: 'MFA_ENROLLMENT_STARTED' },
      });
      return true;
    });
  }
  async confirmMfa(userId: string, encryptedSecret: string, step: number) {
    return this.locked(userId, async (tx) => {
      const enabled = await tx.mfaFactor.updateMany({
        where: {
          userId,
          encryptedSecret,
          enabledAt: null,
          createdAt: { gt: new Date(Date.now() - 10 * 60_000) },
        },
        data: { enabledAt: new Date(), lastUsedStep: step },
      });
      if (enabled.count !== 1) return false;
      await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.auditEvent.create({ data: { userId, event: 'MFA_ENABLED' } });
      return true;
    });
  }
  privacyRequests(userId: string, page: number, limit: number) {
    return this.db.privacyRequest.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    });
  }
  async requestPrivacy(
    userId: string,
    expectedPasswordHash: string,
    kind: PrivacyKind,
  ) {
    return this.locked(userId, async (tx) => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      if (user.passwordHash !== expectedPasswordHash) return null;
      const pending = await tx.privacyRequest.findFirst({
        where: { userId, kind, completedAt: null },
      });
      if (pending) return pending;
      const record = await tx.privacyRequest.create({ data: { userId, kind } });
      if (kind === 'DELETE') {
        await tx.user.update({
          where: { id: userId },
          data: { status: 'DELETION_PENDING' },
        });
        await tx.session.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await tx.verificationChallenge.updateMany({
          where: { userId, consumedAt: null },
          data: { consumedAt: new Date() },
        });
      }
      await tx.auditEvent.create({
        data: { userId, event: `PRIVACY_${kind}_REQUESTED` },
      });
      return record;
    });
  }
}
export type Account = NonNullable<
  Awaited<ReturnType<IdentityRepository['findById']>>
>;
