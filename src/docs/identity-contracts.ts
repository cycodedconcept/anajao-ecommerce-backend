import { z } from 'zod';
import * as v from '../modules/identity/identity.validation.js';
type Schema = Record<string, unknown>;
const object = (
  properties: Schema,
  required = Object.keys(properties),
): Schema => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});
const text = { type: 'string' };
const date = { type: 'string', format: 'date-time' };
const bool = { type: 'boolean' };
const nullableText = { type: 'string', nullable: true };
const id = { type: 'string', format: 'uuid' };
const account = object({
  id,
  email: { type: 'string', format: 'email' },
  role: { type: 'string', enum: ['CUSTOMER', 'ADMIN', 'SELLER'] },
  emailVerified: bool,
  displayName: text,
  phone: nullableText,
  phoneVerified: bool,
  mfaEnabled: bool,
  createdAt: date,
});
const tokens = object(
  {
    accessToken: text,
    refreshToken: text,
    tokenType: { type: 'string', enum: ['Bearer'] },
    expiresIn: { type: 'integer', example: 600 },
    mfaRequired: bool,
  },
  ['accessToken', 'refreshToken', 'tokenType', 'expiresIn'],
);
const address = object({
  id,
  userId: id,
  label: text,
  recipient: text,
  line1: text,
  line2: nullableText,
  city: text,
  region: text,
  postalCode: nullableText,
  country: { type: 'string', minLength: 2, maxLength: 2 },
  createdAt: date,
  updatedAt: date,
});
const privacy = object({
  id,
  userId: id,
  kind: { type: 'string', enum: ['EXPORT', 'DELETE'] },
  createdAt: date,
  completedAt: { ...date, nullable: true },
});
const message = object({ message: text });
const exampleId = '00000000-0000-4000-8000-000000000001';
const exampleDate = '2026-10-20T12:00:00.000Z';
const accepted = {
  message: 'If the account is eligible, instructions will be sent',
};
const exampleTokens = {
  accessToken: '<signed-access-token>',
  refreshToken: '<opaque-refresh-token>',
  tokenType: 'Bearer',
  expiresIn: 600,
};
const exampleAddress = {
  id: exampleId,
  userId: exampleId,
  label: 'Home',
  recipient: 'Example Customer',
  line1: '1 Example Street',
  line2: null,
  city: 'Lagos',
  region: 'Lagos',
  postalCode: null,
  country: 'NG',
  createdAt: exampleDate,
  updatedAt: exampleDate,
};
const addressInput = {
  label: 'Home',
  recipient: 'Example Customer',
  line1: '1 Example Street',
  city: 'Lagos',
  region: 'Lagos',
  country: 'NG',
};
const examplePrivacy = {
  id: exampleId,
  userId: exampleId,
  kind: 'EXPORT',
  createdAt: exampleDate,
  completedAt: null,
};
export interface IdentityContract {
  method: 'get' | 'post' | 'patch' | 'put' | 'delete';
  path: string;
  summary: string;
  authenticated: boolean;
  status: number;
  body?: z.ZodType;
  exampleBody?: Record<string, unknown>;
  response: Schema;
  exampleResponse: unknown;
  paginated?: boolean;
}
export const identityContracts: IdentityContract[] = [
  {
    method: 'post',
    path: '/auth/register',
    summary: 'Register a customer (requires configured email delivery)',
    authenticated: false,
    status: 202,
    body: v.registerSchema,
    exampleBody: {
      email: '{{email}}',
      password: '{{password}}',
      displayName: 'Example Customer',
    },
    response: message,
    exampleResponse: accepted,
  },
  {
    method: 'post',
    path: '/auth/login',
    summary: 'Login; add a six-digit code when MFA is enabled',
    authenticated: false,
    status: 200,
    body: v.loginSchema,
    exampleBody: { email: '{{email}}', password: '{{password}}' },
    response: tokens,
    exampleResponse: { ...exampleTokens, mfaRequired: false },
  },
  {
    method: 'post',
    path: '/auth/refresh',
    summary: 'Rotate refresh token; replay revokes its session',
    authenticated: false,
    status: 200,
    body: v.refreshSchema,
    exampleBody: { refreshToken: '{{refreshToken}}' },
    response: tokens,
    exampleResponse: exampleTokens,
  },
  {
    method: 'post',
    path: '/auth/verify',
    summary: 'Consume email verification token',
    authenticated: false,
    status: 200,
    body: v.tokenSchema,
    exampleBody: { token: '{{verificationToken}}' },
    response: object({ verified: bool }),
    exampleResponse: { verified: true },
  },
  {
    method: 'post',
    path: '/auth/resend-verification',
    summary: 'Resend email verification instructions',
    authenticated: false,
    status: 202,
    body: v.emailSchema,
    exampleBody: { email: '{{email}}' },
    response: message,
    exampleResponse: accepted,
  },
  {
    method: 'post',
    path: '/auth/forgot-password',
    summary: 'Request one-time password recovery',
    authenticated: false,
    status: 202,
    body: v.emailSchema,
    exampleBody: { email: '{{email}}' },
    response: message,
    exampleResponse: accepted,
  },
  {
    method: 'post',
    path: '/auth/reset-password',
    summary: 'Reset password and revoke all sessions',
    authenticated: false,
    status: 200,
    body: v.resetSchema,
    exampleBody: { token: '{{resetToken}}', password: '{{newPassword}}' },
    response: object({ changed: bool }),
    exampleResponse: { changed: true },
  },
  ...['logout', 'logout-all'].map((action): IdentityContract => ({
    method: 'post',
    path: `/auth/${action}`,
    summary:
      action === 'logout' ? 'Revoke current session' : 'Revoke all sessions',
    authenticated: true,
    status: 200,
    response: object({ loggedOut: bool }),
    exampleResponse: { loggedOut: true },
  })),
  {
    method: 'get',
    path: '/me',
    summary: 'Read own account',
    authenticated: true,
    status: 200,
    response: account,
    exampleResponse: {
      id: exampleId,
      email: 'customer@example.test',
      role: 'CUSTOMER',
      emailVerified: true,
      displayName: 'Example Customer',
      phone: null,
      phoneVerified: false,
      mfaEnabled: false,
      createdAt: exampleDate,
    },
  },
  {
    method: 'patch',
    path: '/me',
    summary: 'Update own display name; email and roles are immutable here',
    authenticated: true,
    status: 200,
    body: v.profileSchema,
    exampleBody: { displayName: 'Updated Customer' },
    response: account,
    exampleResponse: {
      id: exampleId,
      email: 'customer@example.test',
      role: 'CUSTOMER',
      emailVerified: true,
      displayName: 'Updated Customer',
      phone: null,
      phoneVerified: false,
      mfaEnabled: false,
      createdAt: exampleDate,
    },
  },
  {
    method: 'post',
    path: '/me/password',
    summary: 'Change password and revoke all sessions',
    authenticated: true,
    status: 200,
    body: v.changePasswordSchema,
    exampleBody: {
      currentPassword: '{{password}}',
      password: '{{newPassword}}',
    },
    response: object({ changed: bool }),
    exampleResponse: { changed: true },
  },
  {
    method: 'post',
    path: '/me/phone',
    summary: 'Request phone verification (requires SMS adapter)',
    authenticated: true,
    status: 202,
    body: v.phoneSchema,
    exampleBody: { phone: '+2348000000000' },
    response: message,
    exampleResponse: accepted,
  },
  {
    method: 'post',
    path: '/me/phone/verify',
    summary: 'Verify own pending phone',
    authenticated: true,
    status: 200,
    body: v.tokenSchema,
    exampleBody: { token: '{{phoneToken}}' },
    response: object({ verified: bool }),
    exampleResponse: { verified: true },
  },
  {
    method: 'get',
    path: '/me/addresses',
    summary: 'List own addresses',
    authenticated: true,
    status: 200,
    paginated: true,
    response: { type: 'array', items: address },
    exampleResponse: [exampleAddress],
  },
  {
    method: 'post',
    path: '/me/addresses',
    summary: 'Save an address (maximum 20)',
    authenticated: true,
    status: 201,
    body: v.addressSchema,
    exampleBody: addressInput,
    response: address,
    exampleResponse: exampleAddress,
  },
  {
    method: 'put',
    path: '/me/addresses/{id}',
    summary: 'Replace own saved address',
    authenticated: true,
    status: 200,
    body: v.addressSchema,
    exampleBody: { ...addressInput, label: 'Office' },
    response: address,
    exampleResponse: { ...exampleAddress, label: 'Office' },
  },
  {
    method: 'delete',
    path: '/me/addresses/{id}',
    summary: 'Delete own saved address',
    authenticated: true,
    status: 200,
    response: object({ deleted: bool }),
    exampleResponse: { deleted: true },
  },
  {
    method: 'post',
    path: '/me/mfa/setup',
    summary:
      'Begin password-confirmed TOTP enrollment; protect returned secret',
    authenticated: true,
    status: 200,
    body: v.mfaSetupSchema,
    exampleBody: { password: '{{password}}' },
    response: object({
      secret: text,
      uri: text,
      expiresIn: { type: 'integer' },
    }),
    exampleResponse: {
      secret: '<base32-secret>',
      uri: 'otpauth://totp/Anajao:example?secret=<secret>&issuer=Anajao',
      expiresIn: 600,
    },
  },
  {
    method: 'post',
    path: '/me/mfa/confirm',
    summary:
      'Confirm TOTP enrollment and revoke sessions; login with a fresh code',
    authenticated: true,
    status: 200,
    body: v.mfaConfirmSchema,
    exampleBody: { code: '{{mfaCode}}' },
    response: object({ enabled: bool, loginRequired: bool }),
    exampleResponse: { enabled: true, loginRequired: true },
  },
  {
    method: 'get',
    path: '/me/privacy-requests',
    summary: 'List own privacy requests',
    authenticated: true,
    status: 200,
    paginated: true,
    response: { type: 'array', items: privacy },
    exampleResponse: [examplePrivacy],
  },
  {
    method: 'post',
    path: '/me/privacy-requests',
    summary:
      'Request export or deletion; deletion immediately suspends account',
    authenticated: true,
    status: 202,
    body: v.privacySchema,
    exampleBody: { kind: 'EXPORT', password: '{{password}}' },
    response: privacy,
    exampleResponse: examplePrivacy,
  },
  ...['admin', 'seller'].map((role): IdentityContract => ({
    method: 'get',
    path: `/${role}/access`,
    summary: `Verify ${role} role and session MFA`,
    authenticated: true,
    status: 200,
    response: object({
      role: { type: 'string', enum: [role.toUpperCase()] },
      mfaVerified: bool,
    }),
    exampleResponse: { role: role.toUpperCase(), mfaVerified: true },
  })),
  ...['google', 'apple'].map((provider): IdentityContract => ({
    method: 'post',
    path: `/auth/social/${provider}`,
    summary: `${provider} login unavailable pending verified provider integration`,
    authenticated: false,
    status: 503,
    response: {},
    exampleResponse: {
      success: false,
      error: {
        code: 'PROVIDER_NOT_CONFIGURED',
        message: 'Social login is not configured',
      },
    },
  })),
];
// Convert the limited JSON Schema constructs emitted by our Zod request schemas to OpenAPI 3.0.
function openApiSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(openApiSchema);
  if (!value || typeof value !== 'object') return value;
  const schema = value as Record<string, unknown>;
  if (
    Array.isArray(schema.anyOf) &&
    schema.anyOf.some((entry: Record<string, unknown>) => entry.type === 'null')
  ) {
    const alternatives = schema.anyOf.filter(
      (entry: Record<string, unknown>) => entry.type !== 'null',
    );
    if (alternatives.length === 1)
      return { ...(openApiSchema(alternatives[0]) as Schema), nullable: true };
  }
  return Object.fromEntries(
    Object.entries(schema)
      .filter(([key]) => key !== '$schema')
      .map(([key, item]) => [key, openApiSchema(item)]),
  );
}
export function identityOpenapiPaths() {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const contract of identityContracts) {
    const error = (description: string) => ({
      description,
      content: {
        'application/json': { schema: { $ref: '#/components/schemas/Error' } },
      },
    });
    const response =
      contract.status >= 400
        ? error('Provider not configured')
        : {
            description: 'Success',
            content: {
              'application/json': {
                schema: object({
                  success: { type: 'boolean', enum: [true] },
                  data: contract.response,
                }),
                example: { success: true, data: contract.exampleResponse },
              },
            },
          };
    const parameters = [];
    if (contract.path.includes('{id}'))
      parameters.push({ in: 'path', name: 'id', required: true, schema: id });
    if (contract.paginated)
      parameters.push(
        {
          in: 'query',
          name: 'page',
          schema: { type: 'integer', minimum: 1, maximum: 1000, default: 1 },
        },
        {
          in: 'query',
          name: 'limit',
          schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
        },
      );
    paths[`/api/v1${contract.path}`] ??= {};
    paths[`/api/v1${contract.path}`]![contract.method] = {
      summary: contract.summary,
      tags: ['Identity'],
      security: contract.authenticated ? [{ bearerAuth: [] }] : [],
      parameters,
      ...(contract.body
        ? {
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: openApiSchema(
                    z.toJSONSchema(contract.body, { io: 'input' }),
                  ),
                  example: contract.exampleBody,
                },
              },
            },
          }
        : {}),
      responses: {
        [String(contract.status)]: response,
        '400': error('Invalid request or token'),
        '401': error('Invalid credentials or session'),
        '403': error('Role or MFA denied'),
        '404': error('Resource not found'),
        '409': error('Resource limit or enrollment conflict'),
        '429': error('Rate limited'),
        '503': error('Provider unavailable'),
        '500': error('Unexpected failure'),
      },
    };
  }
  return paths;
}
