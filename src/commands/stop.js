import { clearState, isProcessAlive, readState } from '../lib/state.js';

/**
 * Stops the dev server recorded in <projectDir>/.visual-planner/server.json.
 * Only the recorded PID is signalled; other Node processes are never touched.
 *
 * Returns one of: 'stopped' | 'not-running' | 'stale'.
 */
export async function stop(projectDir, { log = console.log } = {}) {
  const state = await readState(projectDir);
  if (!state) {
    log('ℹ️  No active dev server found for this project.');
    return 'not-running';
  }

  if (!isProcessAlive(state.pid)) {
    log(`ℹ️  Process ${state.pid} is no longer running. Cleaning up stale state.`);
    await clearState(projectDir);
    return 'stale';
  }

  log(`🛑 Stopping dev server (PID ${state.pid}${state.port ? `, port ${state.port}` : ''})...`);
  try {
    process.kill(state.pid, 'SIGTERM');
  } catch (err) {
    if (err.code !== 'ESRCH') throw err;
  }

  // Give the process a moment to exit and remove its own state file.
  for (let i = 0; i < 20 && isProcessAlive(state.pid); i++) {
    await new Promise((r) => setTimeout(r, 100));
  }
  await clearState(projectDir);
  log('✅ Server stopped.');
  return 'stopped';
}
