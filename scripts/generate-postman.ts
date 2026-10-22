import { writeFileSync } from 'node:fs';
import { buildCollection, buildEnvironment } from './postman/collection.js';
writeFileSync(
  'postman/anajao-ecommerce.postman_collection.json',
  JSON.stringify(buildCollection(), null, 2) + '\n',
);
writeFileSync(
  'postman/anajao-local.postman_environment.json',
  JSON.stringify(buildEnvironment(), null, 2) + '\n',
);
