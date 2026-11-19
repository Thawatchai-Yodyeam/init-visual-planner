#!/usr/bin/env node
// Inlines the shared runtime (scripts/runtime/*) into every canvas template.
//
// Templates must stay self-contained single files (agents copy them anywhere and
// users open them straight from disk), so the runtime is embedded rather than
// linked. This script keeps all copies identical:
//
//   npm run sync:templates           rewrite templates/canvas/*.html
//   npm run sync:templates -- --check exit 1 if any template is out of date
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtimeDir = path.join(root, 'scripts', 'runtime');
const canvasDir = path.join(root, 'templates', 'canvas');

const NOTE = 'generated from scripts/runtime by `npm run sync:templates`. Keep this block; do not edit it by hand.';

const TAILWIND = `<script src="https://cdn.tailwindcss.com"></script>
<script>
  if (window.tailwind) tailwind.config = { theme: { extend: { colors: { ide: {
    bg: '#1e1e1e', panel: '#252526', raised: '#2d2d2d', hover: '#37373d',
    border: '#3c3c3c', inset: '#1a1a1a', accent: '#007acc'
  } } } } };
</script>`;

export async function renderBlocks() {
  const css = (await fs.readFile(path.join(runtimeDir, 'runtime.css'), 'utf8')).trim();
  const js = (await fs.readFile(path.join(runtimeDir, 'runtime.js'), 'utf8')).trim();
  return {
    head: `${TAILWIND}\n<style>\n${css}\n</style>`,
    script: `<script>\n${js}\n</script>`,
  };
}

function replaceBlock(html, name, content, file) {
  const re = new RegExp(`<!-- vp-runtime:${name}:start[^>]*-->[\\s\\S]*?<!-- vp-runtime:${name}:end -->`);
  if (!re.test(html)) throw new Error(`${file}: missing <!-- vp-runtime:${name}:start --> … <!-- vp-runtime:${name}:end --> markers`);
  return html.replace(re, () => `<!-- vp-runtime:${name}:start · ${NOTE} -->\n${content}\n<!-- vp-runtime:${name}:end -->`);
}

export async function syncTemplates({ check = false } = {}) {
  const blocks = await renderBlocks();
  const files = (await fs.readdir(canvasDir)).filter((f) => f.endsWith('.html')).sort();
  const stale = [];
  for (const file of files) {
    const full = path.join(canvasDir, file);
    const before = await fs.readFile(full, 'utf8');
    let after = replaceBlock(before, 'head', blocks.head, file);
    after = replaceBlock(after, 'script', blocks.script, file);
    if (after !== before) {
      stale.push(file);
      if (!check) await fs.writeFile(full, after);
    }
  }
  return { files, stale };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const { files, stale } = await syncTemplates({ check });
  if (check && stale.length) {
    console.error(`❌ Out of date: ${stale.join(', ')}\n   Run \`npm run sync:templates\`.`);
    process.exit(1);
  }
  console.log(check ? `✅ ${files.length} templates in sync.` : `✅ Synced ${stale.length}/${files.length} templates.`);
}
