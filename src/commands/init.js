import fs from 'fs/promises';
import path from 'path';
import { CANVAS_TEMPLATES_DIR, DOC_TEMPLATES_DIR, WORKSPACE_DIRNAME, workspaceDir } from '../lib/paths.js';

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries.filter((e) => e.isFile()).map((e) => e.name).sort();
}

/**
 * Bootstraps the Visual Planner workspace in `targetDir`:
 *   - .visual-planner/*.html  ← templates/canvas/*
 *   - agents.md, context.md, tasks.md ← templates/docs/*
 *
 * Existing files are left untouched unless `force` is set.
 * Returns { created, skipped } lists of project-relative paths.
 */
export async function init(targetDir, { force = false, log = console.log } = {}) {
  const vpDir = workspaceDir(targetDir);
  await fs.mkdir(vpDir, { recursive: true });

  const plan = [
    ...(await listFiles(CANVAS_TEMPLATES_DIR)).map((name) => ({
      src: path.join(CANVAS_TEMPLATES_DIR, name),
      dest: path.join(vpDir, name),
      label: `${WORKSPACE_DIRNAME}/${name}`,
    })),
    ...(await listFiles(DOC_TEMPLATES_DIR)).map((name) => ({
      src: path.join(DOC_TEMPLATES_DIR, name),
      dest: path.join(targetDir, name),
      label: name,
    })),
  ];

  const created = [];
  const skipped = [];
  for (const { src, dest, label } of plan) {
    if (!force && (await exists(dest))) {
      log(`⚠️  ${label} already exists. Skipping (use --force to overwrite).`);
      skipped.push(label);
      continue;
    }
    await fs.copyFile(src, dest);
    log(`✅ ${force ? 'Wrote' : 'Created'} ${label}`);
    created.push(label);
  }
  return { created, skipped };
}
