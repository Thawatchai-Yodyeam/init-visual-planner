import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Root of this package (where package.json lives). */
export const PACKAGE_ROOT = path.resolve(here, '..', '..');

/** Bundled templates shipped with the package. */
export const TEMPLATES_DIR = path.join(PACKAGE_ROOT, 'templates');
export const CANVAS_TEMPLATES_DIR = path.join(TEMPLATES_DIR, 'canvas');
export const DOC_TEMPLATES_DIR = path.join(TEMPLATES_DIR, 'docs');

/** Name of the per-project working folder created by `init`. */
export const WORKSPACE_DIRNAME = '.visual-planner';

export function workspaceDir(projectDir) {
  return path.join(projectDir, WORKSPACE_DIRNAME);
}

/**
 * Returns true when `child` resolves to a location inside `parent`
 * (or is `parent` itself). Safe against `..` segments and sibling
 * directories that share a prefix (e.g. `/app` vs `/app-secrets`).
 */
export function isInside(parent, child) {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}
