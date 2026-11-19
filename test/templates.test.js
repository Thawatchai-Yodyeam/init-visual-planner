import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { CANVAS_TEMPLATES_DIR } from '../src/lib/paths.js';
import { syncTemplates } from '../scripts/sync-templates.js';

const templates = (await fs.readdir(CANVAS_TEMPLATES_DIR)).filter((f) => f.endsWith('.html'));

test('every canvas template embeds the current runtime (run `npm run sync:templates`)', async () => {
  const { stale } = await syncTemplates({ check: true });
  assert.deepEqual(stale, []);
});

for (const file of templates) {
  test(`${file} follows the template contract`, async () => {
    // Ignore the agent guide comment, which mentions the attributes in prose.
    const html = (await fs.readFile(path.join(CANVAS_TEMPLATES_DIR, file), 'utf8')).replace(/<!--[\s\S]*?-->/g, '');
    assert.match(html, /<title>[^<]+<\/title>/);
    assert.match(html, /data-vp-title/, 'needs a [data-vp-title] element');
    assert.match(html, /data-vp-nav/, 'needs a [data-vp-nav] container');
    assert.match(html, /data-vp-canvas/, 'needs a [data-vp-canvas] container');
    assert.match(html, /data-vp-feedback="APPROVED"/);
    assert.match(html, /data-vp-feedback="REQUEST_CHANGES"/);

    const tabs = [...html.matchAll(/data-vp-tab="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(tabs.length >= 1, 'needs at least one <section data-vp-tab>');
    assert.equal(new Set(tabs).size, tabs.length, `duplicate tab ids: ${tabs}`);

    const markers = [...html.matchAll(/<marker id="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(markers).size, markers.length, `duplicate SVG marker ids: ${markers}`);
  });
}
