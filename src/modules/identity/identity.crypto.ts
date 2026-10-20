import {
  createHash,
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from 'node:crypto';
import argon2 from 'argon2';
import { SignJWT, jwtVerify } from 'jose';
import { generateSecret, generateURI, verify } from 'otplib';
import type { Config } from '../../config/env.js';
import { AppError } from '../../common/errors/app-error.js';
export const opaqueToken = () => randomBytes(32).toString('base64url');
export const tokenHash = (token: string) =>
  createHash('sha256').update(token).digest('hex');
export const unauthorized = () =>
  new AppError(401, 'UNAUTHORIZED', 'Invalid credentials or session');
export const hashPassword = (password: string) =>
  argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
export const verifyPassword = (hash: string, password: string) =>
  argon2.verify(hash, password);
export class IdentityCrypto {
  private readonly signingKey: Buffer;
  private readonly encryptionKey: Buffer;
  private dummyHash: Promise<string> | undefined;
  constructor(private readonly config: Config) {
    if (
      !config.AUTH_SIGNING_KEY ||
      !config.MFA_ENCRYPTION_KEY ||
      config.AUTH_SIGNING_KEY === config.MFA_ENCRYPTION_KEY
    ) {
      throw new Error(
        'Distinct AUTH_SIGNING_KEY and MFA_ENCRYPTION_KEY are required',
      );
    }
    this.signingKey = Buffer.from(config.AUTH_SIGNING_KEY, 'hex');
    this.encryptionKey = Buffer.from(config.MFA_ENCRYPTION_KEY, 'hex');
  }
  async checkPassword(
    hash: string | undefined,
    password: string,
  ): Promise<boolean> {
    this.dummyHash ??= hashPassword(opaqueToken());
    const valid = await verifyPassword(
      hash ?? (await this.dummyHash),
      password,
    );
    return hash !== undefined && valid;
  }
  async sign(userId: string, sessionId: string): Promise<string> {
    return new SignJWT({ sid: sessionId })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(userId)
      .setIssuer(this.config.AUTH_ISSUER)
      .setAudience(this.config.AUTH_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(this.signingKey);
  }
  async verify(token: string): Promise<{ userId: string; sessionId: string }> {
    try {
      const { payload } = await jwtVerify(token, this.signingKey, {
        algorithms: ['HS256'],
        typ: 'JWT',
        issuer: this.config.AUTH_ISSUER,
        audience: this.config.AUTH_AUDIENCE,
        requiredClaims: ['sub', 'sid', 'iat', 'exp'],
        maxTokenAge: '10m',
      });
      if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string')
        throw unauthorized();
      return { userId: payload.sub, sessionId: payload.sid };
    } catch {
      throw unauthorized();
    }
  }
  newFactor(label: string) {
    const secret = generateSecret();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    cipher.setAAD(Buffer.from(label));
    const ciphertext = Buffer.concat([
      cipher.update(secret, 'utf8'),
      cipher.final(),
    ]);
    return {
      secret,
      uri: generateURI({ issuer: 'Anajao', label, secret }),
      encryptedSecret: Buffer.concat([
        iv,
        cipher.getAuthTag(),
        ciphertext,
      ]).toString('base64'),
    };
  }
  async verifyFactor(
    encrypted: string,
    label: string,
    code: string,
    afterTimeStep: number,
  ): Promise<number | null> {
    const bytes = Buffer.from(encrypted, 'base64');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey,
      bytes.subarray(0, 12),
    );
    decipher.setAAD(Buffer.from(label));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const secret = Buffer.concat([
      decipher.update(bytes.subarray(28)),
      decipher.final(),
    ]).toString('utf8');
    const result = await verify({
      secret,
      token: code,
      epochTolerance: [30, 0],
      ...(afterTimeStep >= 0 ? { afterTimeStep } : {}),
    });
    return result.valid && 'timeStep' in result ? result.timeStep : null;
  }
}
