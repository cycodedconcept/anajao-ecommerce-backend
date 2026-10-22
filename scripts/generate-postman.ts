import { writeFileSync } from 'node:fs';
import { identityContracts } from '../src/docs/identity-contracts.js';
const items = identityContracts.map((c) => {
  const req = {
    method: c.method.toUpperCase(),
    header: [
      { key: 'Content-Type', value: 'application/json' },
      ...(c.authenticated
        ? [{ key: 'Authorization', value: 'Bearer {{accessToken}}' }]
        : []),
    ],
    url: `{{baseUrl}}/api/v1${c.path.replace('{id}', '{{addressId}}')}`,
    description: c.summary,
    ...(c.exampleBody
      ? {
          body: {
            mode: 'raw',
            raw: JSON.stringify(c.exampleBody, null, 2),
            options: { raw: { language: 'json' } },
          },
        }
      : {}),
  };
  const tests = [
    `pm.test('Expected status', () => pm.response.to.have.status(${c.status}));`,
    "pm.test('JSON envelope', () => pm.expect(pm.response.json()).to.have.property('success'));",
    'const data = pm.response.json().data;',
    "if (data && data.accessToken) pm.environment.set('accessToken', data.accessToken);",
    "if (data && data.refreshToken) pm.environment.set('refreshToken', data.refreshToken);",
  ];
  if (c.path === '/me/addresses' && c.method === 'post')
    tests.push(
      "if (data && data.id) pm.environment.set('addressId', data.id);",
    );
  return {
    name: c.summary,
    request: req,
    event: [
      { listen: 'test', script: { type: 'text/javascript', exec: tests } },
    ],
    response: [
      {
        name: 'Example response (illustrative)',
        originalRequest: req,
        status:
          c.status === 202
            ? 'Accepted'
            : c.status === 201
              ? 'Created'
              : c.status === 503
                ? 'Service Unavailable'
                : 'OK',
        code: c.status,
        header: [{ key: 'Content-Type', value: 'application/json' }],
        body: JSON.stringify(
          c.status >= 400
            ? c.exampleResponse
            : { success: true, data: c.exampleResponse },
          null,
          2,
        ),
      },
    ],
  };
});
const negative = [
  {
    name: 'Unauthenticated account read',
    method: 'GET',
    path: '/me',
    status: 401,
    code: 'UNAUTHORIZED',
    body: undefined,
    auth: false,
  },
  {
    name: 'Reject public admin assignment',
    method: 'POST',
    path: '/auth/register',
    status: 400,
    code: 'VALIDATION_ERROR',
    body: {
      email: '{{email}}',
      password: '{{password}}',
      displayName: 'Example',
      role: 'ADMIN',
    },
    auth: false,
  },
  {
    name: 'Reject invalid reset token',
    method: 'POST',
    path: '/auth/reset-password',
    status: 400,
    code: 'INVALID_TOKEN',
    body: { token: 'x'.repeat(43), password: '{{newPassword}}' },
    auth: false,
  },
  {
    name: 'Customer denied admin access',
    method: 'GET',
    path: '/admin/access',
    status: 403,
    code: 'FORBIDDEN',
    body: undefined,
    auth: true,
  },
].map((c) => {
  const req = {
    method: c.method,
    header: [
      { key: 'Content-Type', value: 'application/json' },
      ...(c.auth
        ? [{ key: 'Authorization', value: 'Bearer {{accessToken}}' }]
        : []),
    ],
    url: `{{baseUrl}}/api/v1${c.path}`,
    ...(c.body
      ? {
          body: {
            mode: 'raw',
            raw: JSON.stringify(c.body, null, 2),
            options: { raw: { language: 'json' } },
          },
        }
      : {}),
  };
  return {
    name: c.name,
    request: req,
    event: [
      {
        listen: 'test',
        script: {
          type: 'text/javascript',
          exec: [
            `pm.test('Expected rejection', () => pm.response.to.have.status(${c.status}));`,
            `pm.test('Error code', () => pm.expect(pm.response.json().error.code).to.eql('${c.code}'));`,
          ],
        },
      },
    ],
    response: [
      {
        name: 'Example rejection',
        originalRequest: req,
        status:
          c.status === 401
            ? 'Unauthorized'
            : c.status === 403
              ? 'Forbidden'
              : 'Bad Request',
        code: c.status,
        header: [{ key: 'Content-Type', value: 'application/json' }],
        body: JSON.stringify(
          {
            success: false,
            error: { code: c.code, message: 'Request rejected' },
          },
          null,
          2,
        ),
      },
    ],
  };
});
const collection = {
  info: {
    name: 'Anajao Milestone 02 — Identity and Access',
    schema:
      'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    description:
      'Manual workflow collection; see docs/identity.md. Successful delivery examples require a verified adapter. Default server returns 503 for delivery and social providers. Examples are illustrative, not captured production responses. Do not run every request sequentially: logout/reset/MFA/deletion invalidate sessions.',
  },
  item: [
    { name: 'Identity workflows', item: items },
    { name: 'Negative cases', item: negative },
  ],
};
writeFileSync(
  'postman/anajao-milestone-02.postman_collection.json',
  JSON.stringify(collection, null, 2) + '\n',
);
const values = {
  baseUrl: 'http://127.0.0.1:3000',
  email: 'customer@example.test',
  password: 'Example-only-password-123!',
  newPassword: 'Example-new-password-456!',
  accessToken: '',
  refreshToken: '',
  verificationToken: '',
  resetToken: '',
  phoneToken: '',
  mfaCode: '',
  addressId: '',
};
writeFileSync(
  'postman/anajao-milestone-02.postman_environment.json',
  JSON.stringify(
    {
      name: 'Anajao local — example only',
      values: Object.entries(values).map(([key, value]) => ({
        key,
        value,
        enabled: true,
        type: /password|token|code/i.test(key) ? 'secret' : 'default',
      })),
      _postman_variable_scope: 'environment',
    },
    null,
    2,
  ) + '\n',
);
