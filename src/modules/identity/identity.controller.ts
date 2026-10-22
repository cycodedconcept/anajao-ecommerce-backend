import type { Request, Response, RequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../../common/errors/app-error.js';
import { accountDto, type IdentityService } from './identity.service.js';
import { principal } from './identity.middleware.js';
import * as v from './identity.validation.js';
export function identityController(service: IdentityService) {
  const endpoint =
    (
      action: (req: Request, res: Response) => unknown,
      status = 200,
    ): RequestHandler =>
    async (req, res) => {
      res.status(status).json({ success: true, data: await action(req, res) });
    };
  const id = (req: Request) => v.parse(z.string().uuid(), req.params.id);
  return {
    register: endpoint(
      (req) => service.register(v.parse(v.registerSchema, req.body)),
      202,
    ),
    login: endpoint((req) => {
      const input = v.parse(v.loginSchema, req.body);
      return service.login(input.email, input.password, input.code);
    }),
    refresh: endpoint((req) =>
      service.refresh(v.parse(v.refreshSchema, req.body).refreshToken),
    ),
    verify: endpoint((req) =>
      service.verify(v.parse(v.tokenSchema, req.body).token),
    ),
    resend: endpoint(
      (req) =>
        service.instructions(v.parse(v.emailSchema, req.body).email, 'EMAIL'),
      202,
    ),
    forgot: endpoint(
      (req) =>
        service.instructions(
          v.parse(v.emailSchema, req.body).email,
          'PASSWORD_RESET',
        ),
      202,
    ),
    reset: endpoint((req) => {
      const input = v.parse(v.resetSchema, req.body);
      return service.reset(input.token, input.password);
    }),
    logout: endpoint((_req, res) => service.logout(principal(res))),
    logoutAll: endpoint((_req, res) => service.logout(principal(res), true)),
    me: endpoint((_req, res) => accountDto(principal(res).user)),
    profile: endpoint((req, res) =>
      service.profile(
        principal(res),
        v.parse(v.profileSchema, req.body).displayName!,
      ),
    ),
    password: endpoint((req, res) => {
      const input = v.parse(v.changePasswordSchema, req.body);
      return service.changePassword(
        principal(res),
        input.currentPassword,
        input.password,
      );
    }),
    phone: endpoint(
      (req, res) =>
        service.phone(principal(res), v.parse(v.phoneSchema, req.body).phone),
      202,
    ),
    verifyPhone: endpoint((req, res) =>
      service.verifyPhone(
        principal(res),
        v.parse(v.tokenSchema, req.body).token,
      ),
    ),
    addresses: endpoint((req, res) => {
      const { page, limit } = v.parse(v.paginationSchema, req.query);
      return service.addresses(principal(res), page, limit);
    }),
    addAddress: endpoint(
      (req, res) =>
        service.saveAddress(principal(res), v.parse(v.addressSchema, req.body)),
      201,
    ),
    updateAddress: endpoint((req, res) =>
      service.saveAddress(
        principal(res),
        v.parse(v.addressSchema, req.body),
        id(req),
      ),
    ),
    deleteAddress: endpoint((req, res) =>
      service.deleteAddress(principal(res), id(req)),
    ),
    setupMfa: endpoint((req, res) =>
      service.setupMfa(
        principal(res),
        v.parse(v.mfaSetupSchema, req.body).password,
      ),
    ),
    confirmMfa: endpoint((req, res) =>
      service.confirmMfa(
        principal(res),
        v.parse(v.mfaConfirmSchema, req.body).code,
      ),
    ),
    privacy: endpoint((req, res) => {
      const { page, limit } = v.parse(v.paginationSchema, req.query);
      return service.privacyRequests(principal(res), page, limit);
    }),
    requestPrivacy: endpoint((req, res) => {
      const input = v.parse(v.privacySchema, req.body);
      return service.requestPrivacy(principal(res), input.kind, input.password);
    }, 202),
    admin: endpoint((_req, res) => {
      service.requireRole(principal(res), ['ADMIN']);
      return { role: 'ADMIN', mfaVerified: true };
    }),
    seller: endpoint((_req, res) => {
      service.requireRole(principal(res), ['SELLER']);
      return { role: 'SELLER', mfaVerified: true };
    }),
    social: endpoint(() => {
      throw new AppError(
        503,
        'PROVIDER_NOT_CONFIGURED',
        'Social login is not configured',
      );
    }),
  };
}
