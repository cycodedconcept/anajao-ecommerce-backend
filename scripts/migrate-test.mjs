import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { URL } from 'node:url';
const target = process.env.TEST_DATABASE_URL;
const runtime = process.env.DATABASE_URL;
const identity = (value) => {
  const u = new URL(value);
  return `${u.hostname}:${u.port || 3306}${u.pathname}`;
};
if (
  !target ||
  !new URL(target).pathname.endsWith('_test') ||
  (runtime && identity(target) === identity(runtime))
) {
  throw new Error('A distinct TEST_DATABASE_URL ending in _test is required');
}
const migration = process.env.TEST_MIGRATION_DATABASE_URL ?? target;
if (identity(migration) !== identity(target))
  throw new Error('Test migration and runtime schema must match');
const result = spawnSync('npm', ['run', 'db:migrate'], {
  stdio: 'inherit',
  env: { ...process.env, MIGRATION_DATABASE_URL: migration },
});
process.exitCode = result.status ?? 1;
