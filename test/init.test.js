import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { init } from '../src/commands/init.js';

const quiet = () => {};

async function tmpDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'vp-init-'));
}

test('init scaffolds canvas templates and docs', async () => {
  const dir = await tmpDir();
  const { created, skipped } = await init(dir, { log: quiet });

  assert.equal(skipped.length, 0);
  for (const name of ['agents.md', 'context.md', 'tasks.md']) {
    assert.ok(created.includes(name), `missing ${name}`);
    await fs.access(path.join(dir, name));
  }
  const canvas = await fs.readdir(path.join(dir, '.visual-planner'));
  assert.deepEqual(canvas.sort(), [
    'comparison_template.html',
    'explainer_template.html',
    'meeting_template.html',
    'priority_template.html',
    'spec_template.html',
  ]);
});

test('init never overwrites existing files unless forced', async () => {
  const dir = await tmpDir();
  await fs.writeFile(path.join(dir, 'context.md'), 'my notes');

  const first = await init(dir, { log: quiet });
  assert.ok(first.skipped.includes('context.md'));
  assert.equal(await fs.readFile(path.join(dir, 'context.md'), 'utf8'), 'my notes');

  const second = await init(dir, { log: quiet, force: true });
  assert.ok(second.created.includes('context.md'));
  assert.notEqual(await fs.readFile(path.join(dir, 'context.md'), 'utf8'), 'my notes');
});
