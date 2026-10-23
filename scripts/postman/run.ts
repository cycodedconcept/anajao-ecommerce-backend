import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import {
  mkdtemp,
  chmod,
  readFile,
  writeFile,
  rm,
  mkdir,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Server } from 'node:http';
import { createApp } from '../../src/app.js';
import { parseEnv } from '../../src/config/env.js';
import { createLogger } from '../../src/config/logger.js';
import { createDatabase } from '../../src/database/client.js';
import { MemoryDelivery } from '../../src/modules/identity/identity.delivery.js';
import { createIdentity } from '../../src/modules/identity/index.js';
import { domains, automatedScenarios } from './collection.js';
import { fixtureManager, isolatedTestUrl } from './fixtures.js';
import {
  sanitizeReport,
  reportMarkdown,
  type RequestResult,
} from './report.js';
const exec = promisify(execFile);
const cases = automatedScenarios();
const report = {
  runner: 'not started',
  runnerVersion: 'unknown',
  generatedAt: new Date().toISOString(),
  passed: false,
  requests: [] as RequestResult[],
  sideEffects: [] as { name: string; passed: boolean }[],
  cleanupPassed: null as boolean | null,
  failureStage: null as string | null,
};
let stage = 'configuration';
let temp: string | undefined;
let database: ReturnType<typeof createDatabase> | undefined;
let fixtures: ReturnType<typeof fixtureManager> | undefined;
const servers: Server[] = [];
let interrupted = false;
let child: ReturnType<typeof spawn> | undefined;
const interrupt = () => {
  interrupted = true;
  child?.kill('SIGTERM');
};
process.once('SIGINT', interrupt);
process.once('SIGTERM', interrupt);
async function listen(app: ReturnType<typeof createApp>) {
  const server = await new Promise<Server>((resolve, reject) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
    s.once('error', reject);
  });
  servers.push(server);
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Server binding failed');
  return `http://127.0.0.1:${address.port}`;
}
async function run(
  binary: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<number> {
  return new Promise((resolve, reject) => {
    child = spawn(binary, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let diagnostics = '';
    const capture = (chunk: Buffer) => {
      if (diagnostics.length < 16384) diagnostics += chunk.toString();
    };
    child.stdout?.on('data', capture);
    child.stderr?.on('data', capture);
    const timeout = setTimeout(() => child?.kill('SIGKILL'), 120_000);
    child.once('error', () => {
      clearTimeout(timeout);
      reject(new Error('Runner failed to start'));
    });
    child.once('exit', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        const categories = [
          'unknown option',
          'ENOENT',
          'EACCES',
          'login',
          'API key',
          'folder',
          'environment',
          'HOME',
          'reporter',
          'unsupported',
        ].filter((word) =>
          diagnostics.toLowerCase().includes(word.toLowerCase()),
        );
        console.log(
          `CLI exit ${code ?? 'signal'}; diagnostic categories: ${categories.join(', ') || 'unclassified'}`,
        );
      }
      resolve(code ?? 1);
    });
  });
}
try {
  const target = isolatedTestUrl(process.env);
  stage = 'Postman CLI startup (requires a supported host)';
  temp = await mkdtemp(join(tmpdir(), 'anajao-postman-'));
  await chmod(temp, 0o700);
  // Never forward database credentials, application secrets, or a cloud API key to the runner.
  const childEnv = { PATH: process.env.PATH ?? '', TMPDIR: temp, CI: '1' };
  const binary = resolve('node_modules/.bin/postman');
  const version = await exec(binary, ['--version'], {
    env: childEnv,
    timeout: 10000,
  });
  report.runner = 'Postman CLI';
  report.runnerVersion = version.stdout.trim();
  if (!/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(report.runnerVersion))
    throw new Error('Unexpected runner version');
  const config = parseEnv({
    NODE_ENV: 'test',
    DATABASE_URL: target,
    LOG_LEVEL: 'silent',
    RATE_LIMIT_MAX: '10000',
    AUTH_RATE_LIMIT_MAX: '100',
    AUTH_SIGNING_KEY: randomBytes(32).toString('hex'),
    MFA_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
  });
  database = createDatabase(config);
  stage = 'database readiness';
  await database.ping();
  const delivery = new MemoryDelivery();
  fixtures = fixtureManager(database.client, config, delivery);
  stage = 'fixture preparation';
  await fixtures.prepare();
  const app = createApp(
    config,
    database,
    createLogger('silent'),
    () => false,
    createIdentity(config, database.client, delivery),
  );
  fixtures.values.baseUrl = await listen(app);
  const unavailable = {
    ping: async () => {
      throw new Error('Test dependency unavailable');
    },
    disconnect: async () => {},
  };
  fixtures.values.unavailableUrl = await listen(
    createApp(config, unavailable, createLogger('silent')),
  );
  if ((await fetch(`${fixtures.values.baseUrl}/api/v1/ready`)).status !== 200)
    throw new Error('API not ready');
  let failed = false;
  for (const domain of domains) {
    if (interrupted) throw new Error('Interrupted');
    stage = `collection ${domain}`;
    if (domain === 'customers') await fixtures.freshMfaCode();
    const environment = join(temp, 'environment.json');
    const raw = join(temp, 'raw-report.json');
    await writeFile(
      environment,
      JSON.stringify({
        name: 'Ephemeral fixtures',
        values: Object.entries(fixtures.values).map(([key, value]) => ({
          key,
          value,
          enabled: true,
        })),
      }),
      { mode: 0o600 },
    );
    await rm(raw, { force: true });
    const args = [
      'collection',
      'run',
      resolve('postman/anajao-ecommerce.postman_collection.json'),
      '--folder',
      `automated-${domain}`,
      '-e',
      environment,
      '--reporters',
      'json',
      '--reporter-json-export',
      raw,
      '--reporter-json-structure',
      'newman',
      '--reporter-json-omitAllHeadersAndBody',
      '--timeout-request',
      '10000',
      '--timeout-script',
      '10000',
      '--no-report-events',
    ];
    const code = await run(binary, args, childEnv);
    stage = `report read ${domain}`;
    const rawReport = JSON.parse(await readFile(raw, 'utf8')) as unknown;
    stage = `report validation ${domain}`;
    const sanitized = sanitizeReport(
      rawReport,
      cases.filter((c) => c.domain === domain),
    );
    report.requests.push(...sanitized.requests);
    failed ||=
      code !== 0 ||
      sanitized.unexpectedFailure ||
      sanitized.requests.some((r) => !r.passed);
  }
  stage = 'database side effects';
  report.sideEffects = await fixtures.verifySideEffects();
  failed ||= report.sideEffects.some((c) => !c.passed);
  report.passed = !failed;
} catch {
  report.failureStage = stage;
  report.passed = false;
} finally {
  for (const server of servers) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  try {
    if (fixtures) {
      await fixtures.cleanup();
      report.cleanupPassed = true;
    }
  } catch {
    report.passed = false;
    report.failureStage = 'fixture cleanup';
  }
  await database?.disconnect().catch(() => {
    report.passed = false;
    report.failureStage = 'database shutdown';
  });
  if (temp) await rm(temp, { recursive: true, force: true });
  // Include every unexecuted request, rather than silently reporting a partial run as complete.
  for (const scenario of cases)
    if (!report.requests.some((r) => r.name === scenario.name))
      report.requests.push({
        name: scenario.name,
        executed: false,
        expectedStatus: scenario.status,
        actualStatus: null,
        passed: false,
        assertionsPassed: 0,
        assertionsFailed: 0,
        assertionsSkipped: 0,
      });
  report.passed &&=
    report.cleanupPassed === true &&
    !interrupted &&
    report.requests.every((r) => r.passed);
  await mkdir('reports/api-tests', { recursive: true });
  await writeFile(
    'reports/api-tests/latest.json',
    JSON.stringify(report, null, 2) + '\n',
  );
  await writeFile('reports/api-tests/latest.md', reportMarkdown(report));
  console.log(
    `${report.runner}: ${report.requests.filter((r) => r.passed).length}/${report.requests.length} requests passed; ${report.passed ? 'PASS' : 'FAIL'}. Sanitized report: reports/api-tests/latest.md`,
  );
  process.exitCode = report.passed ? 0 : 1;
}
