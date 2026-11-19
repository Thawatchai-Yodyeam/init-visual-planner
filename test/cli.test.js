import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFile } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'cli.js');
const run = promisify(execFile);

test('--version prints the package version', async () => {
  const pkg = JSON.parse(await fs.readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const { stdout } = await run(process.execPath, [CLI, '--version']);
  assert.equal(stdout.trim(), pkg.version);
});

test('dev → status → dev (reuse) → stop lifecycle', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vp-cli-'));
  await fs.writeFile(path.join(dir, 'spec.html'), '<html><body>hi</body></html>');
  const opts = { cwd: dir };

  const child = spawn(process.execPath, [CLI, 'dev', 'spec.html', '--port', '0', '--no-open'], opts);
  try {
    // Wait until the server reports its URL.
    await new Promise((resolve, reject) => {
      let out = '';
      child.stdout.on('data', (d) => { out += d; if (/dev server: http/.test(out)) resolve(); });
      child.on('exit', (code) => reject(new Error(`dev exited early (${code}): ${out}`)));
    });

    const state = JSON.parse(await fs.readFile(path.join(dir, '.visual-planner', 'server.json'), 'utf8'));
    assert.equal(state.pid, child.pid);

    const status = await run(process.execPath, [CLI, 'status'], opts);
    assert.match(status.stdout, /running/);

    const again = await run(process.execPath, [CLI, 'dev', 'spec.html', '--no-open'], opts);
    assert.match(again.stdout, /already running/);

    const exited = new Promise((resolve) => child.on('exit', resolve));
    const stopped = await run(process.execPath, [CLI, 'stop'], opts);
    assert.match(stopped.stdout, /stopped/);
    await exited;

    await assert.rejects(fs.access(path.join(dir, '.visual-planner', 'server.json')));
    await assert.rejects(run(process.execPath, [CLI, 'status'], opts)); // exit code 1 when not running
  } finally {
    child.kill();
  }
});
