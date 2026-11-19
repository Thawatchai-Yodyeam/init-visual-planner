import fs from 'fs/promises';
import { unlinkSync } from 'fs';
import path from 'path';
import { workspaceDir } from './paths.js';

// Server state lives in <project>/.visual-planner/server.json.
// `server.pid` is the format used by v1.1.x and is still read for compatibility.
const STATE_FILE = 'server.json';
const LEGACY_PID_FILE = 'server.pid';

export function stateFilePath(projectDir) {
  return path.join(workspaceDir(projectDir), STATE_FILE);
}

export async function writeState(projectDir, state) {
  await fs.mkdir(workspaceDir(projectDir), { recursive: true });
  await fs.writeFile(stateFilePath(projectDir), JSON.stringify(state, null, 2) + '\n', 'utf8');
}

/** Reads the saved server state, or returns null when none exists. */
export async function readState(projectDir) {
  try {
    return JSON.parse(await fs.readFile(stateFilePath(projectDir), 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT' && !(err instanceof SyntaxError)) throw err;
  }
  try {
    const raw = await fs.readFile(path.join(workspaceDir(projectDir), LEGACY_PID_FILE), 'utf8');
    const pid = parseInt(raw.trim(), 10);
    return Number.isInteger(pid) && pid > 0 ? { pid, legacy: true } : null;
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

export async function clearState(projectDir) {
  const dir = workspaceDir(projectDir);
  await Promise.all([
    fs.unlink(path.join(dir, STATE_FILE)).catch(() => {}),
    fs.unlink(path.join(dir, LEGACY_PID_FILE)).catch(() => {}),
  ]);
}

/** Synchronous variant for use inside process `exit` handlers. */
export function clearStateSync(projectDir) {
  try { unlinkSync(stateFilePath(projectDir)); } catch { /* already gone */ }
}

export function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM: the process exists but belongs to another user.
    return err.code === 'EPERM';
  }
}

/**
 * Returns the state of a dev server that is still running for this project,
 * cleaning up stale state files left behind by crashed processes.
 */
export async function getRunningServer(projectDir) {
  const state = await readState(projectDir);
  if (!state) return null;
  if (isProcessAlive(state.pid)) return state;
  await clearState(projectDir);
  return null;
}
