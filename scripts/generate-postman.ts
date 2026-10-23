import { writeFileSync } from 'node:fs';
import { format, resolveConfig } from 'prettier';
import { buildCollection, buildEnvironment } from './postman/collection.js';
for (const [path, value] of [
  ['postman/anajao-ecommerce.postman_collection.json', buildCollection()],
  ['postman/anajao-local.postman_environment.json', buildEnvironment()],
] as const) {
  writeFileSync(
    path,
    await format(JSON.stringify(value, null, 2), {
      ...(await resolveConfig(path)),
      filepath: path,
    }),
  );
}
