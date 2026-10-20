import 'dotenv/config';
import { createDatabase } from '../database/client.js';
import { parseEnv } from '../config/env.js';
import { IdentityRepository } from '../modules/identity/identity.repository.js';
import { email, parse } from '../modules/identity/identity.validation.js';
// Explicit operator command only; never called by startup, migrations, or tests.
const database = createDatabase(parseEnv(process.env));
try {
  const target = parse(email, process.env.ADMIN_BOOTSTRAP_EMAIL);
  const promoted = await new IdentityRepository(database.client).bootstrapAdmin(
    target,
  );
  if (!promoted) throw new Error('Ineligible account');
  console.log('Admin role granted; sessions revoked; audit event recorded.');
} catch {
  console.error(
    'Admin bootstrap failed. Requires an active, email-verified customer with confirmed MFA.',
  );
  process.exitCode = 1;
} finally {
  await database.disconnect();
}
