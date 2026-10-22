import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import SwaggerParser from '@apidevtools/swagger-parser';
import { openapi } from '../src/docs/openapi.js';
import { identityContracts } from '../src/docs/identity-contracts.js';
it('publishes a valid OpenAPI 3 contract', async () => {
  await expect(
    SwaggerParser.validate(JSON.parse(JSON.stringify(openapi))),
  ).resolves.toBeDefined();
});
it('includes all identity operations and examples in the importable Postman collection', () => {
  const collection = JSON.parse(
    readFileSync('postman/anajao-milestone-02.postman_collection.json', 'utf8'),
  ) as {
    info: { schema: string };
    item: {
      item: {
        request: { method: string; url: string };
        response: { code: number; body: string }[];
        event: unknown[];
      }[];
    }[];
  };
  expect(collection.info.schema).toBe(
    'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  );
  const items = collection.item.flatMap((folder) => folder.item);
  for (const contract of identityContracts) {
    const item = items.find(
      (entry) =>
        entry.request.method === contract.method.toUpperCase() &&
        entry.request.url ===
          `{{baseUrl}}/api/v1${contract.path.replace('{id}', '{{addressId}}')}`,
    );
    expect(item, `${contract.method} ${contract.path}`).toBeDefined();
    expect(item!.response[0]!.code).toBe(contract.status);
    expect(JSON.parse(item!.response[0]!.body)).toHaveProperty('success');
    expect(item!.event.length).toBeGreaterThan(0);
  }
  const environment = JSON.parse(
    readFileSync(
      'postman/anajao-milestone-02.postman_environment.json',
      'utf8',
    ),
  ) as { values: { key: string; value: string }[] };
  for (const field of environment.values.filter((v) => /token/i.test(v.key)))
    expect(field.value).toBe('');
});
