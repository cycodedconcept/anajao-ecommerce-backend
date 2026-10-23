import { readFileSync } from 'node:fs';
import { identityContracts } from '../../src/docs/identity-contracts.js';
import { openapi } from '../../src/docs/openapi.js';
import { scenarios, type Scenario } from './scenarios.js';
type Json = Record<string, unknown>;
export const domains = [
  'health',
  'authentication',
  'customers',
  'admin',
  'sellers',
] as const;
export const domainFor = (path: string): Scenario['domain'] =>
  path.startsWith('/auth/')
    ? 'authentication'
    : path.startsWith('/me')
      ? 'customers'
      : path.startsWith('/admin')
        ? 'admin'
        : path.startsWith('/seller')
          ? 'sellers'
          : 'health';
export const operationPath = (path: string) =>
  `/api/v1${path.split('?')[0]!.replace('{{addressId}}', '{id}')}`;
export function automatedScenarios(): Scenario[] {
  const negative = identityContracts.flatMap((c): Scenario[] => {
    const result: Scenario[] = [];
    const path = c.path.replace('{id}', '{{addressId}}');
    const method = c.method.toUpperCase() as Scenario['method'];
    if (c.authenticated)
      result.push({
        name: `${method} ${c.path} requires authentication`,
        domain: domainFor(c.path),
        method,
        path,
        status: 401,
        error: 'UNAUTHORIZED',
        ...(c.exampleBody ? { body: c.exampleBody } : {}),
      });
    if (c.body)
      result.push({
        name: `${method} ${c.path} rejects invalid payload`,
        domain: domainFor(c.path),
        method,
        path,
        status: 400,
        error: 'VALIDATION_ERROR',
        body: {},
        ...(c.authenticated ? { auth: 'mainAccess' } : {}),
      });
    return result;
  });
  return [...scenarios, ...negative];
}
const spec = openapi as unknown as {
  paths: Record<
    string,
    Record<
      string,
      {
        responses: Record<
          string,
          { content?: Record<string, { schema: Json }> }
        >;
      }
    >
  >;
  components: { schemas: Record<string, Json> };
};
function resolved(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(resolved);
  if (!value || typeof value !== 'object') return value;
  const object = value as Json;
  if (typeof object.$ref === 'string')
    return resolved(spec.components.schemas[object.$ref.split('/').at(-1)!]);
  const { nullable, ...rest } = object;
  const converted = Object.fromEntries(
    Object.entries(rest).map(([key, entry]) => [key, resolved(entry)]),
  );
  return nullable ? { anyOf: [converted, { type: 'null' }] } : converted;
}
export function responseSchema(s: Scenario): Json {
  if (s.status >= 400) return resolved(spec.components.schemas.Error) as Json;
  const schema =
    spec.paths[operationPath(s.path)]?.[s.method.toLowerCase()]?.responses[
      String(s.status)
    ]?.content?.['application/json']?.schema;
  if (!schema)
    throw new Error(`Missing response schema for ${s.method} ${s.path}`);
  return resolved(schema) as Json;
}
function requestFor(s: Scenario) {
  return {
    method: s.method,
    header: [
      { key: 'Content-Type', value: 'application/json' },
      ...(s.auth
        ? [{ key: 'Authorization', value: `Bearer {{${s.auth}}}` }]
        : []),
    ],
    url: `{{${s.base ?? 'baseUrl'}}}/api/v1${s.path}`,
    description: `${s.name}. Expected HTTP ${s.status}. Automated fixtures are supplied by npm run test:api.`,
    ...(s.body
      ? {
          body: {
            mode: 'raw',
            raw: JSON.stringify(s.body, null, 2),
            options: { raw: { language: 'json' } },
          },
        }
      : {}),
  };
}
function automatedItem(s: Scenario) {
  const tests = [
    `pm.test('HTTP status', () => pm.expect(pm.response.code).to.eql(${s.status}));`,
    `pm.test('Response schema', () => pm.response.to.have.jsonSchema(${JSON.stringify(responseSchema(s))}));`,
    'const body = pm.response.json();',
    `pm.test('Response envelope', () => pm.expect(body.success).to.eql(${s.status < 400}));`,
    ...(s.error
      ? [
          `pm.test('Expected error code', () => pm.expect(body.error.code).to.eql('${s.error}'));`,
        ]
      : []),
    ...(s.checks
      ? [`pm.test('Business rule', () => { ${s.checks.join(' ')} });`]
      : []),
    ...Object.entries(s.capture ?? {}).map(
      ([key, field]) =>
        `if (pm.response.code === ${s.status} && body.data) pm.environment.set('${key}', body.data['${field}']);`,
    ),
  ];
  return {
    name: s.name,
    request: requestFor(s),
    event: [
      {
        listen: 'prerequest',
        script: {
          type: 'text/javascript',
          exec: [
            "if (pm.environment.get('apiTestRun') !== 'isolated-local') { pm.execution.skipRequest(); throw new Error('Use the isolated test runner'); }",
            "for (const key of ['baseUrl', 'unavailableUrl']) { if (!new RegExp('^http://127[.]0[.]0[.]1:[0-9]+$').test(pm.environment.get(key))) { pm.execution.skipRequest(); throw new Error('Only loopback test servers are allowed'); } }",
          ],
        },
      },
      { listen: 'test', script: { type: 'text/javascript', exec: tests } },
    ],
  };
}
export function buildCollection() {
  const all = automatedScenarios();
  const foundation = JSON.parse(
    readFileSync('postman/anajao-milestone-01.postman_collection.json', 'utf8'),
  ) as { item: unknown[] };
  return {
    info: {
      name: 'Anajao Ecommerce API',
      schema:
        'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      description:
        'Version-controlled API reference and isolated automated scenarios. See postman/README.md. No payments, orders, logistics or blog endpoints exist yet. Reference examples are illustrative; only scenarios recorded by the runner are claimed executed.',
    },
    variable: [{ key: 'expectedReadyStatus', value: '200' }],
    event: [
      {
        listen: 'prerequest',
        script: {
          type: 'text/javascript',
          exec: [
            "if (!new RegExp('^http://127[.]0[.]0[.]1:[0-9]+$').test(pm.environment.get('baseUrl'))) { pm.execution.skipRequest(); throw new Error('Collection execution is restricted to loopback'); }",
          ],
        },
      },
    ],
    item: domains.map((domain) => ({
      name: domain,
      item: [
        {
          name: `reference-${domain}`,
          description: 'Manual reference; not part of the automatic run.',
          item:
            domain === 'health'
              ? foundation.item
              : identityContracts
                  .filter((c) => domainFor(c.path) === domain)
                  .map((c) => {
                    const s: Scenario = {
                      name: c.summary,
                      domain,
                      method: c.method.toUpperCase() as Scenario['method'],
                      path: c.path.replace('{id}', '{{addressId}}'),
                      status: c.status,
                      ...(c.authenticated ? { auth: 'accessToken' } : {}),
                      ...(c.exampleBody ? { body: c.exampleBody } : {}),
                    };
                    const req = requestFor(s);
                    return {
                      name: `${s.method} ${c.path}`,
                      request: req,
                      response: [
                        {
                          name: 'Illustrative response',
                          originalRequest: req,
                          code: c.status,
                          status:
                            c.status >= 400 ? 'Service Unavailable' : 'Success',
                          header: [
                            { key: 'Content-Type', value: 'application/json' },
                          ],
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
                  }),
        },
        {
          name: `automated-${domain}`,
          description:
            'Run only through npm run test:api with isolated disposable fixtures.',
          item: all.filter((s) => s.domain === domain).map(automatedItem),
        },
      ],
    })),
  };
}
export function buildEnvironment() {
  const text = JSON.stringify(buildCollection());
  const keys = [
    ...new Set([...text.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]!)),
    'apiTestRun',
  ];
  return {
    name: 'Anajao local template — no credentials',
    values: keys.sort().map((key) => ({
      key,
      value: key === 'baseUrl' ? 'http://127.0.0.1:3000' : '',
      enabled: true,
      type: /password|token|access|code/i.test(key) ? 'secret' : 'default',
    })),
    _postman_variable_scope: 'environment',
  };
}
