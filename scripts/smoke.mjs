import 'dotenv/config';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import assert from 'node:assert/strict';
const port = 13987;
const child = spawn(process.execPath, ['dist/server.js'], {
  env: { ...process.env, PORT: String(port), LOG_LEVEL: 'silent' },
  stdio: 'ignore',
});
const exited = once(child, 'exit');
try {
  let started = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null)
      throw new Error('Server exited before startup');
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/health`);
      if (res.status === 200) {
        started = true;
        break;
      }
    } catch {
      /* Wait for binding. */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(started, 'Server starts within 10 seconds');
  for (const [path, status] of [
    ['/api/v1/health', 200],
    ['/api/v1/ready', 200],
    ['/api-docs/', 200],
    ['/api-docs/openapi.json', 200],
    ['/missing', 404],
  ]) {
    const res = await fetch(`http://127.0.0.1:${port}${path}`);
    assert.equal(res.status, status, path);
    console.log(`${path}: ${res.status}`);
  }
  child.kill('SIGTERM');
  const timeout = setTimeout(() => child.kill('SIGKILL'), 12000);
  const [code, signal] = await exited;
  clearTimeout(timeout);
  assert.equal(code, 0);
  assert.equal(signal, null);
  console.log('Production build startup and SIGTERM shutdown: PASS');
} finally {
  if (child.exitCode === null && child.signalCode === null)
    child.kill('SIGKILL');
}
