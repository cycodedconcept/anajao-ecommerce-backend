import { Router } from 'express';
import type { Config } from '../../config/env.js';
import type { IdentityService } from './identity.service.js';
import { identityController } from './identity.controller.js';
import { authenticate, identityLimiter } from './identity.middleware.js';
export function identityRoutes(service: IdentityService, config: Config) {
  const router = Router();
  const c = identityController(service);
  const authLimit = identityLimiter(config.AUTH_RATE_LIMIT_MAX);
  const accountLimit = identityLimiter(config.AUTH_RATE_LIMIT_MAX, true);
  router.use('/auth', authLimit, accountLimit);
  router.post('/auth/register', c.register);
  router.post('/auth/login', c.login);
  router.post('/auth/refresh', c.refresh);
  router.post('/auth/verify', c.verify);
  router.post('/auth/resend-verification', c.resend);
  router.post('/auth/forgot-password', c.forgot);
  router.post('/auth/reset-password', c.reset);
  router.post('/auth/social/google', c.social);
  router.post('/auth/social/apple', c.social);
  const auth = authenticate(service);
  router.post('/auth/logout', auth, c.logout);
  router.post('/auth/logout-all', auth, c.logoutAll);
  router.use(
    '/me',
    auth,
    identityLimiter(config.AUTH_RATE_LIMIT_MAX * 5, true),
  );
  router.get('/me', c.me);
  router.patch('/me', c.profile);
  router.post('/me/password', c.password);
  router.post('/me/phone', c.phone);
  router.post('/me/phone/verify', c.verifyPhone);
  router.get('/me/addresses', c.addresses);
  router.post('/me/addresses', c.addAddress);
  router.put('/me/addresses/:id', c.updateAddress);
  router.delete('/me/addresses/:id', c.deleteAddress);
  router.post('/me/mfa/setup', c.setupMfa);
  router.post(
    '/me/mfa/confirm',
    identityLimiter(config.AUTH_RATE_LIMIT_MAX, true),
    c.confirmMfa,
  );
  router.get('/me/privacy-requests', c.privacy);
  router.post('/me/privacy-requests', c.requestPrivacy);
  router.get('/admin/access', auth, c.admin);
  router.get('/seller/access', auth, c.seller);
  return router;
}
