import type { Role } from '../../generated/prisma/client.js';
import { AppError } from '../../common/errors/app-error.js';
import { IdentityRepository, type Account } from './identity.repository.js';
import {
  IdentityCrypto,
  hashPassword,
  opaqueToken,
  tokenHash,
  unauthorized,
} from './identity.crypto.js';
import type { IdentityDelivery } from './identity.delivery.js';
import type { AddressInput, Registration } from './identity.validation.js';
export interface Principal {
  user: Account;
  sessionId: string;
  mfaVerified: boolean;
}
const accepted = {
  message: 'If the account is eligible, instructions will be sent',
};
export const accountDto = (user: Account) => ({
  id: user.id,
  email: user.email,
  role: user.role,
  emailVerified: !!user.emailVerifiedAt,
  displayName: user.profile?.displayName ?? '',
  phone: user.profile?.phone ?? null,
  phoneVerified: !!user.profile?.phoneVerifiedAt,
  mfaEnabled: !!user.mfa?.enabledAt,
  createdAt: user.createdAt,
});
export class IdentityService {
  constructor(
    private readonly repo: IdentityRepository,
    private readonly crypto: IdentityCrypto,
    private readonly delivery: IdentityDelivery,
  ) {}
  private async deliver(
    user: Account,
    purpose: 'EMAIL' | 'PHONE' | 'PASSWORD_RESET',
    target: string,
    hideDeliveryFailure = false,
  ) {
    const token = opaqueToken();
    const challenge = await this.repo.challenge(
      user.id,
      purpose,
      target,
      tokenHash(token),
    );
    try {
      await this.delivery.send({ destination: target, purpose, token });
    } catch {
      await this.repo.cancelChallenge(challenge.id);
      await this.repo.audit(user.id, 'DELIVERY_FAILED');
      if (!hideDeliveryFailure)
        throw new AppError(
          503,
          'DELIVERY_UNAVAILABLE',
          'Delivery temporarily unavailable',
        );
    }
  }
  async register(input: Registration) {
    this.delivery.assertAvailable('email');
    const hash = await hashPassword(input.password);
    const user = await this.repo.createCustomer(
      input.email,
      hash,
      input.displayName,
    );
    if (user) await this.deliver(user, 'EMAIL', user.email, true);
    return accepted;
  }
  async instructions(email: string, purpose: 'EMAIL' | 'PASSWORD_RESET') {
    this.delivery.assertAvailable('email');
    const user = await this.repo.findByEmail(email);
    if (
      user?.status === 'ACTIVE' &&
      (purpose === 'EMAIL' ? !user.emailVerifiedAt : !!user.emailVerifiedAt)
    ) {
      await this.deliver(user, purpose, user.email, true);
    }
    return accepted;
  }
  async verify(token: string) {
    if (!(await this.repo.consumeChallenge(tokenHash(token), 'EMAIL')))
      throw new AppError(400, 'INVALID_TOKEN', 'Invalid or expired token');
    return { verified: true };
  }
  async reset(token: string, password: string) {
    const hash = await hashPassword(password);
    if (
      !(await this.repo.consumeChallenge(
        tokenHash(token),
        'PASSWORD_RESET',
        hash,
      ))
    )
      throw new AppError(400, 'INVALID_TOKEN', 'Invalid or expired token');
    return { changed: true };
  }
  async login(email: string, password: string, code?: string) {
    const user = await this.repo.findByEmail(email);
    const correct = await this.crypto.checkPassword(
      user?.passwordHash,
      password,
    );
    if (
      !correct ||
      !user ||
      user.status !== 'ACTIVE' ||
      !user.emailVerifiedAt
    ) {
      await this.repo.audit(null, 'LOGIN_REJECTED');
      throw unauthorized();
    }
    let step: number | null = null;
    if (user.mfa?.enabledAt) {
      step = code
        ? await this.crypto.verifyFactor(
            user.mfa.encryptedSecret,
            user.id,
            code,
            user.mfa.lastUsedStep,
          )
        : null;
      if (step === null) {
        await this.repo.audit(user.id, 'MFA_REJECTED');
        throw unauthorized();
      }
    }
    const refreshToken = opaqueToken();
    const session = await this.repo.createSession(
      user.id,
      user.passwordHash,
      tokenHash(refreshToken),
      step,
    );
    if (!session) throw unauthorized();
    return {
      accessToken: await this.crypto.sign(user.id, session.id),
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: 600,
      mfaRequired: user.role !== 'CUSTOMER' && !session.mfaVerifiedAt,
    };
  }
  async refresh(token: string) {
    const refreshToken = opaqueToken();
    const session = await this.repo.rotate(
      tokenHash(token),
      tokenHash(refreshToken),
    );
    if (!session) throw unauthorized();
    return {
      accessToken: await this.crypto.sign(session.userId, session.id),
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: 600,
    };
  }
  async authenticate(token: string): Promise<Principal> {
    const claims = await this.crypto.verify(token);
    const session = await this.repo.session(claims.userId, claims.sessionId);
    if (!session) throw unauthorized();
    return {
      user: session.user,
      sessionId: session.id,
      mfaVerified: !!session.mfaVerifiedAt,
    };
  }
  requireRole(principal: Principal, roles: readonly Role[]): void {
    if (!roles.includes(principal.user.role))
      throw new AppError(403, 'FORBIDDEN', 'Access denied');
    if (!principal.mfaVerified)
      throw new AppError(
        403,
        'MFA_REQUIRED',
        'Multi-factor authentication required',
      );
  }
  async logout(principal: Principal, all = false) {
    await this.repo.revoke(
      principal.user.id,
      all ? undefined : principal.sessionId,
    );
    return { loggedOut: true };
  }
  async changePassword(
    principal: Principal,
    currentPassword: string,
    password: string,
  ) {
    if (
      !(await this.crypto.checkPassword(
        principal.user.passwordHash,
        currentPassword,
      ))
    )
      throw unauthorized();
    if (
      !(await this.repo.password(
        principal.user.id,
        principal.user.passwordHash,
        await hashPassword(password),
      ))
    )
      throw unauthorized();
    return { changed: true };
  }
  async profile(principal: Principal, displayName: string) {
    await this.repo.profile(principal.user.id, displayName);
    const user = await this.repo.findById(principal.user.id);
    if (!user) throw unauthorized();
    return accountDto(user);
  }
  async phone(principal: Principal, phone: string) {
    this.delivery.assertAvailable('sms');
    await this.deliver(principal.user, 'PHONE', phone);
    return accepted;
  }
  async verifyPhone(principal: Principal, token: string) {
    // Consume only challenges belonging to the authenticated account.
    if (!(await this.repo.consumePhone(principal.user.id, tokenHash(token))))
      throw new AppError(400, 'INVALID_TOKEN', 'Invalid or expired token');
    return { verified: true };
  }
  addresses(principal: Principal, page: number, limit: number) {
    return this.repo.addresses(principal.user.id, page, limit);
  }
  async saveAddress(principal: Principal, input: AddressInput, id?: string) {
    const result = await this.repo.saveAddress(principal.user.id, input, id);
    if (!result) throw new AppError(404, 'NOT_FOUND', 'Address not found');
    return result;
  }
  async deleteAddress(principal: Principal, id: string) {
    if (!(await this.repo.deleteAddress(principal.user.id, id)).count)
      throw new AppError(404, 'NOT_FOUND', 'Address not found');
    return { deleted: true };
  }
  async setupMfa(principal: Principal, password: string) {
    if (
      !(await this.crypto.checkPassword(principal.user.passwordHash, password))
    )
      throw unauthorized();
    const factor = this.crypto.newFactor(principal.user.id);
    if (
      !(await this.repo.setupMfa(
        principal.user.id,
        principal.user.passwordHash,
        factor.encryptedSecret,
      ))
    )
      throw new AppError(
        409,
        'MFA_ALREADY_ENABLED',
        'MFA enrollment unavailable',
      );
    return { secret: factor.secret, uri: factor.uri, expiresIn: 600 };
  }
  async confirmMfa(principal: Principal, code: string) {
    const factor = principal.user.mfa;
    const step =
      factor && !factor.enabledAt
        ? await this.crypto.verifyFactor(
            factor.encryptedSecret,
            principal.user.id,
            code,
            factor.lastUsedStep,
          )
        : null;
    if (
      !factor ||
      step === null ||
      !(await this.repo.confirmMfa(
        principal.user.id,
        factor.encryptedSecret,
        step,
      ))
    )
      throw new AppError(
        400,
        'INVALID_MFA_CODE',
        'Invalid or expired enrollment',
      );
    return { enabled: true, loginRequired: true };
  }
  privacyRequests(principal: Principal, page: number, limit: number) {
    return this.repo.privacyRequests(principal.user.id, page, limit);
  }
  async requestPrivacy(
    principal: Principal,
    kind: 'EXPORT' | 'DELETE',
    password: string,
  ) {
    if (
      !(await this.crypto.checkPassword(principal.user.passwordHash, password))
    )
      throw unauthorized();
    const record = await this.repo.requestPrivacy(
      principal.user.id,
      principal.user.passwordHash,
      kind,
    );
    if (!record) throw unauthorized();
    return record;
  }
}
