import type { RequestHandler, Response } from 'express';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import type { IdentityService, Principal } from './identity.service.js';
import { tokenHash, unauthorized } from './identity.crypto.js';
export const principal = (res: Response): Principal =>
  res.locals.principal as Principal;
export const authenticate =
  (service: IdentityService): RequestHandler =>
  async (req, res, next) => {
    const header = req.headers.authorization;
    if (
      !header ||
      !/^Bearer [A-Za-z0-9_.-]+$/.test(header) ||
      header.length > 4096
    )
      throw unauthorized();
    res.locals.principal = await service.authenticate(header.slice(7));
    next();
  };
const message = {
  success: false,
  error: { code: 'RATE_LIMITED', message: 'Too many requests' },
};
export const identityLimiter = (limit: number, account = false) =>
  rateLimit({
    windowMs: 15 * 60_000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message,
    keyGenerator: (req, res) => {
      if (account) {
        const p = res.locals.principal as Principal | undefined;
        if (p) return p.user.id;
        const body = req.body as Record<string, unknown> | undefined;
        if (typeof body?.email === 'string' && body.email.length <= 254)
          return tokenHash(body.email.trim().toLowerCase());
      }
      return ipKeyGenerator(req.ip ?? 'unknown');
    },
  });
