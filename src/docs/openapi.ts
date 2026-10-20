import { identityOpenapiPaths } from './identity-contracts.js';
const success = (status: string) => ({
  description: 'Success',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required: ['success', 'data'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: {
            type: 'object',
            properties: { status: { type: 'string', enum: [status] } },
            required: ['status'],
          },
        },
      },
    },
  },
});
const failure = (description: string) => ({
  description,
  content: {
    'application/json': { schema: { $ref: '#/components/schemas/Error' } },
  },
});
export const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'KAM VOGUE API',
    version: '0.2.0',
    description:
      'Foundation, authentication, customer identity and role-based access. Email/SMS and social providers remain unconfigured.',
  },
  servers: [{ url: '/' }],
  paths: {
    ...identityOpenapiPaths(),
    '/api/v1/health': {
      get: {
        summary: 'Application liveness',
        responses: {
          '200': success('ok'),
          '400': failure('Invalid query'),
          '429': failure('Rate limited'),
        },
      },
    },
    '/api/v1/ready': {
      get: {
        summary: 'Application and database readiness',
        responses: {
          '200': success('ready'),
          '503': failure('Temporarily unavailable'),
          '400': failure('Invalid query'),
          '429': failure('Rate limited'),
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        required: ['success', 'error'],
        properties: {
          success: { type: 'boolean', enum: [false] },
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
  },
};
