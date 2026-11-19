// End-to-end checks of the canvas runtime in a real browser.
// Runs only when Playwright is installed (it is not a dependency of this package).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import { CANVAS_TEMPLATES_DIR } from '../src/lib/paths.js';
import { startDevServer } from '../src/commands/dev.js';

let chromium = null;
try {
  ({ chromium } = createRequire(import.meta.url)('playwright'));
} catch {
  try { ({ chromium } = await import('playwright')); } catch { /* not installed */ }
}
const skip = chromium ? false : 'playwright is not installed';

let browser;
let server;
let dir;

before(async () => {
  if (skip) return;
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vp-browser-'));
  for (const f of await fs.readdir(CANVAS_TEMPLATES_DIR)) {
    await fs.copyFile(path.join(CANVAS_TEMPLATES_DIR, f), path.join(dir, f));
  }
  server = await startDevServer(path.join(dir, 'spec_template.html'), { port: 0, log: () => {} });
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  await server?.close();
});

async function openPage(file, { clipboard = true } = {}) {
  const origin = `http://127.0.0.1:${server.port}`;
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  if (clipboard) await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
  // Tailwind's CDN is irrelevant to behaviour; keep tests offline and fast.
  await context.route(/cdn\.tailwindcss\.com/, (r) => r.abort());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${origin}/${file}`);
  return { page, context, errors };
}

// Clears the clipboard, runs the action, then waits for the copy (which is async) to land.
async function copied(page, action) {
  await page.evaluate(() => navigator.clipboard.writeText(''));
  await action();
  for (let i = 0; i < 50; i++) {
    const text = await page.evaluate(() => navigator.clipboard.readText());
    if (text) return JSON.parse(text);
    await page.waitForTimeout(50);
  }
  throw new Error('nothing was copied to the clipboard');
}

test('tabs: sidebar is generated from sections and the active tab lives in the URL hash', { skip }, async () => {
  const { page, context, errors } = await openPage('spec_template.html');
  const labels = await page.locator('[data-vp-nav] button').allTextContents();
  assert.deepEqual(labels, ['🗺️ System Overview', '📐 UI/UX Wireframe', '🔀 Workflow & Data Flow', '🛡️ API & Security']);

  await page.getByRole('button', { name: '🛡️ API & Security' }).click();
  assert.equal(new URL(page.url()).hash, '#api-specs');
  assert.equal(await page.locator('[data-vp-tab]:visible').getAttribute('data-vp-tab'), 'api-specs');
  assert.equal(await page.locator('[aria-current="page"]').textContent(), '🛡️ API & Security');
  assert.deepEqual(errors, []);
  await context.close();
});

test('live reload keeps the active tab and scroll position', { skip }, async () => {
  const { page, context } = await openPage('spec_template.html#workflow-flow');
  await page.setViewportSize({ width: 1280, height: 400 });
  await page.locator('[data-vp-canvas]').evaluate((el) => { el.scrollTop = 150; });

  const reloaded = page.waitForEvent('load');
  const file = path.join(dir, 'spec_template.html');
  await fs.appendFile(file, '\n<!-- touched -->\n');
  await reloaded;

  assert.equal(await page.locator('[data-vp-tab]:visible').getAttribute('data-vp-tab'), 'workflow-flow');
  const scrollTop = await page.locator('[data-vp-canvas]').evaluate((el) => el.scrollTop);
  assert.ok(Math.abs(scrollTop - 150) < 5, `scrollTop was ${scrollTop}`);
  await context.close();
});

test('approve / request changes / select option copy structured JSON', { skip }, async () => {
  const { page, context, errors } = await openPage('spec_template.html');

  let json = await copied(page, () => page.locator('[data-vp-feedback="APPROVED"]').click());
  assert.equal(json.status, 'APPROVED');
  assert.equal(json.file, 'spec_template.html');
  assert.equal(json.document, '[Project Name] · System Spec');
  await page.locator('.vp-toast[data-show]').waitFor();

  json = await copied(page, async () => {
    await page.locator('[data-vp-feedback="REQUEST_CHANGES"]').click();
    await page.locator('dialog textarea').fill('Add rate limiting to POST /orders');
    await page.locator('dialog textarea').press('Control+Enter');
  });
  assert.equal(json.status, 'REQUEST_CHANGES');
  assert.equal(json.changes, 'Add rate limiting to POST /orders');
  assert.equal(json.viewing_section, '🗺️ System Overview');

  // Cancelling must not copy anything.
  await page.evaluate(() => navigator.clipboard.writeText('untouched'));
  await page.locator('[data-vp-feedback="REQUEST_CHANGES"]').click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.locator('dialog').waitFor({ state: 'detached' });
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'untouched');

  json = await copied(page, async () => {
    await page.locator('[data-vp-select^="Option B"]').click();
    await page.locator('dialog textarea').fill('Keep it mobile-first');
    await page.getByRole('button', { name: 'Copy selection' }).click();
  });
  assert.equal(json.status, 'APPROVED_WITH_DIRECTION');
  assert.equal(json.action, 'SELECT_OPTION');
  assert.equal(json.selected_option, 'Option B: [Option B Name]');
  assert.equal(json.direction, 'Keep it mobile-first');
  assert.equal(await page.locator('[data-vp-option][data-vp-selected]').count(), 1);
  assert.deepEqual(errors, []);
  await context.close();
});

test('meeting checklist tracks progress and copies item statuses', { skip }, async () => {
  const { page, context, errors } = await openPage('meeting_template.html#action-items');
  const progress = page.locator('[data-vp-progress="action-items"]');
  assert.equal(await progress.textContent(), '1 / 3 done');
  await page.locator('[data-id="task-1"] input').check();
  assert.equal(await progress.textContent(), '2 / 3 done');

  const json = await copied(page, () => page.locator('[data-vp-copy-checklist]').click());
  assert.equal(json.action, 'UPDATE_MEETING_ACTIONS');
  assert.deepEqual(json.items[0], {
    id: 'task-1', task: 'Draft API routes and endpoint schema', completed: true, assignee: 'Alice', due: 'YYYY-MM-DD',
  });
  assert.equal(json.items.filter((i) => i.completed).length, 2);
  assert.deepEqual(errors, []);
  await context.close();
});

test('priority board: keyboard and drag-and-drop reorder, counts and JSON follow', { skip }, async () => {
  const { page, context, errors } = await openPage('priority_template.html');

  await page.locator('[data-id="task-4"]').focus();
  await page.keyboard.press('ArrowLeft'); // low → medium (appended)
  await page.keyboard.press('ArrowUp'); // above task-3
  assert.equal(await page.locator('[data-vp-column="medium"] [data-vp-count]').textContent(), '2');
  assert.equal(await page.locator('[data-vp-column="low"] [data-vp-count]').textContent(), '0');

  await page.locator('[data-id="task-1"]').dragTo(page.locator('[data-vp-column="low"] [data-vp-dropzone]'));

  const json = await copied(page, () => page.locator('[data-vp-copy-board]').click());
  const ids = (col) => json.priorities[col].map((c) => c.id);
  assert.deepEqual(ids('high'), ['task-2']);
  assert.deepEqual(ids('medium'), ['task-4', 'task-3']);
  assert.deepEqual(ids('low'), ['task-1']);
  assert.equal(json.priorities.medium[0].task, 'Write project documentation');
  assert.deepEqual(errors, []);
  await context.close();
});

test('falls back to a manual-copy dialog when the clipboard is unavailable', { skip }, async () => {
  const { page, context } = await openPage('explainer_template.html', { clipboard: false });
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined });
    document.execCommand = () => false;
  });
  await page.locator('[data-vp-feedback="APPROVED"]').click();
  const box = page.locator('dialog textarea');
  await box.waitFor();
  const json = JSON.parse(await box.inputValue());
  assert.equal(json.status, 'APPROVED');
  assert.equal(await box.evaluate((el) => el.readOnly), true);
  await page.getByRole('button', { name: 'Done' }).click();
  await page.locator('dialog').waitFor({ state: 'detached', timeout: 2000 });
  await context.close();
});

test('every template renders without script errors', { skip }, async () => {
  for (const file of ['spec', 'meeting', 'comparison', 'priority', 'explainer']) {
    const { page, context, errors } = await openPage(`${file}_template.html`);
    assert.ok((await page.locator('[data-vp-nav] button').count()) >= 1, file);
    assert.deepEqual(errors, [], file);
    await context.close();
  }
});
