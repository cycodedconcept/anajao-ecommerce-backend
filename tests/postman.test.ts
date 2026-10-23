import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import Ajv from 'ajv-draft-04';
import addFormats from 'ajv-formats';
import {
  buildCollection,
  buildEnvironment,
  automatedScenarios,
  operationPath,
} from '../scripts/postman/collection.js';
import { isolatedTestUrl } from '../scripts/postman/fixtures.js';
import { sanitizeReport } from '../scripts/postman/report.js';
import { openapi } from '../src/docs/openapi.js';
describe('Postman workflow contracts', () => {
  it('validates the canonical collection against the official Postman v2.1 schema', () => {
    const ajv = new Ajv.default({ strict: false });
    addFormats.default(ajv);
    const validate = ajv.compile(
      JSON.parse(readFileSync('postman/collection-v2.1.schema.json', 'utf8')),
    );
    expect(validate(buildCollection()), JSON.stringify(validate.errors)).toBe(
      true,
    );
    expect(
      validate({
        info: { name: 'Invalid' },
        item: [{ request: { method: 12 } }],
      }),
    ).toBe(false);
  });
  it('keeps generated collection and secret-free environment synchronized', () => {
    const collection = JSON.parse(
      readFileSync('postman/anajao-ecommerce.postman_collection.json', 'utf8'),
    );
    expect(collection).toEqual(buildCollection());
    const environment = JSON.parse(
      readFileSync('postman/anajao-local.postman_environment.json', 'utf8'),
    );
    expect(environment).toEqual(buildEnvironment());
    for (const v of buildEnvironment().values)
      if (v.key !== 'baseUrl') expect(v.value).toBe('');
  });
  it('provides executable coverage for every documented API operation', () => {
    const cases = automatedScenarios();
    expect(new Set(cases.map((c) => c.name)).size).toBe(cases.length);
    const covered = new Set(
      cases.map((c) => `${c.method.toLowerCase()} ${operationPath(c.path)}`),
    );
    for (const [path, methods] of Object.entries(openapi.paths))
      for (const method of Object.keys(methods))
        expect(covered.has(`${method} ${path}`), `${method} ${path}`).toBe(
          true,
        );
  });
  it.each([
    {},
    { TEST_DATABASE_URL: 'mysql://x:y@127.0.0.1/production' },
    { TEST_DATABASE_URL: 'mysql://x:y@remote.example/app_test' },
    {
      TEST_DATABASE_URL: 'mysql://x:y@127.0.0.1/app_test',
      DATABASE_URL: 'mysql://other:secret@127.0.0.1:3306/app_test',
    },
    {
      NODE_ENV: 'production',
      TEST_DATABASE_URL: 'mysql://x:y@127.0.0.1/app_test',
    },
  ])('refuses unsafe database targets', (env) =>
    expect(() => isolatedTestUrl(env)).toThrow(),
  );
  it('accepts a distinct loopback test schema', () =>
    expect(
      isolatedTestUrl({
        DATABASE_URL: 'mysql://x:y@127.0.0.1/app_dev',
        TEST_DATABASE_URL: 'mysql://x:y@127.0.0.1/app_test',
      }),
    ).toContain('app_test'));
  it('whitelists report data and counts only actually executed passing requests', () => {
    const expected = automatedScenarios().slice(0, 2);
    const raw = {
      environment: { secret: 'DO-NOT-PUBLISH' },
      run: {
        executions: [
          {
            item: { name: expected[0]!.name },
            request: { body: 'DO-NOT-PUBLISH' },
            response: { code: 200, body: 'DO-NOT-PUBLISH' },
            assertions: [
              { assertion: 'HTTP status' },
              { assertion: 'Response schema' },
              { assertion: 'Response envelope' },
            ],
          },
        ],
        failures: [],
      },
    };
    const sanitized = sanitizeReport(raw, expected);
    expect(sanitized.requests[0]!.passed).toBe(true);
    expect(sanitized.requests[1]!.passed).toBe(false);
    expect(sanitized.requests[1]!.executed).toBe(false);
    expect(sanitized.unexpectedFailure).toBe(true);
    expect(JSON.stringify(sanitized)).not.toContain('DO-NOT-PUBLISH');
    const requiresBusinessRule = [{ ...expected[0]!, checks: ['required'] }];
    expect(sanitizeReport(raw, requiresBusinessRule).requests[0]!.passed).toBe(
      false,
    );
    raw.run.executions[0]!.assertions[0] = { assertion: 'Unrelated assertion' };
    expect(sanitizeReport(raw, expected).requests[0]!.passed).toBe(false);
    raw.run.executions[0]!.assertions = [
      { assertion: 'HTTP status', error: { message: 'DO-NOT-PUBLISH' } } as {
        assertion: string;
      },
    ];
    expect(sanitizeReport(raw, expected).requests[0]!.passed).toBe(false);
  });
});
