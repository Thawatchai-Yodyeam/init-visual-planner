#!/usr/bin/env node
import { readFileSync } from 'fs';
import path from 'path';
import { parseArgs } from 'util';
import { PACKAGE_ROOT } from '../src/lib/paths.js';
import { init } from '../src/commands/init.js';
import { startDevServer } from '../src/commands/dev.js';
import { stop } from '../src/commands/stop.js';
import { clearStateSync, getRunningServer, writeState } from '../src/lib/state.js';

const pkg = JSON.parse(readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'));

const HELP = `
init-visual-planner v${pkg.version}

Usage:
  init-visual-planner [init] [dir] [--force]   Scaffold .visual-planner/ templates and agents/context/tasks docs
  init-visual-planner dev <file.html> [opts]   Serve an HTML spec with live reload
  init-visual-planner status [dir]             Show whether a dev server is running for this project
  init-visual-planner stop [dir]               Stop the dev server started from this project

Options:
  -f, --force        (init) Overwrite existing files
  -p, --port <n>     (dev)  Preferred port (default: $PORT or 3000; next free port is used if busy)
      --host <addr>  (dev)  Interface to bind (default: 127.0.0.1)
      --no-open      (dev)  Do not open the browser automatically
  -h, --help         Show this help
  -v, --version      Show version
`;

const COMMANDS = new Set(['init', 'dev', 'status', 'stop']);

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function parse(argv) {
  try {
    return parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        force: { type: 'boolean', short: 'f' },
        port: { type: 'string', short: 'p' },
        host: { type: 'string' },
        'no-open': { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
      },
    });
  } catch (err) {
    fail(`${err.message}\n${HELP}`);
  }
}

async function runInit(dir, { force }) {
  const targetDir = path.resolve(dir ?? '.');
  console.log(`\n🚀 Initializing Visual Planner in: ${targetDir}`);
  await init(targetDir, { force });
  console.log('\n🎉 Visual Planner initialized!');
  console.log('AI agents working in this repository will now follow the Visual Agentic Workflow (see agents.md).');
}

async function runDev(file, { port, host, open: shouldOpen }) {
  if (!file) fail('Please specify the HTML file to serve, e.g. `init-visual-planner dev meeting_spec.html`');

  const projectDir = process.cwd();
  const htmlPath = path.resolve(file);

  // Idempotent: if this project already has a server running, reuse it.
  const running = await getRunningServer(projectDir);
  if (running && !running.legacy) {
    const rel = path.relative(running.serveDir, htmlPath);
    if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
      const url = `http://localhost:${running.port}/${rel.split(path.sep).map(encodeURIComponent).join('/')}`;
      console.log(`ℹ️  Dev server already running (PID ${running.pid}). It live-reloads on save.`);
      console.log(`👉 ${url}`);
      return;
    }
    fail(`A dev server (PID ${running.pid}) is already serving ${running.serveDir}.\n   Run \`init-visual-planner stop\` first to serve a file from another folder.`);
  }

  const preferredPort = parseInt(port ?? process.env.PORT ?? '3000', 10);
  if (!Number.isInteger(preferredPort) || preferredPort < 0 || preferredPort > 65535) fail(`Invalid port: ${port}`);

  let server;
  try {
    server = await startDevServer(htmlPath, { port: preferredPort, host });
  } catch (err) {
    fail(err.message);
  }

  await writeState(projectDir, {
    pid: process.pid,
    port: server.port,
    url: server.url,
    file: htmlPath,
    serveDir: server.serveDir,
    startedAt: new Date().toISOString(),
  });

  console.log(`\n🚀 Visual Planner dev server: ${server.url}`);
  console.log(`📂 Serving: ${server.serveDir}`);
  console.log('🔄 Live reload is on. Press Ctrl+C or run `init-visual-planner stop` to quit.\n');

  // Always remove the state file, however the process ends.
  process.on('exit', () => clearStateSync(projectDir));
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(signal, () => {
      console.log('\n👋 Shutting down dev server...');
      server.close().finally(() => process.exit(0));
      setTimeout(() => process.exit(0), 1000).unref();
    });
  }

  if (shouldOpen) {
    try {
      const { default: open } = await import('open');
      await open(server.url);
    } catch (err) {
      console.error(`⚠️  Could not open browser automatically: ${err.message}`);
    }
  }
}

async function runStatus(dir) {
  const running = await getRunningServer(path.resolve(dir ?? '.'));
  if (!running) {
    console.log('⚪ No dev server running for this project.');
    process.exitCode = 1;
    return;
  }
  console.log(`🟢 Dev server running (PID ${running.pid})${running.url ? `: ${running.url}` : ''}`);
}

async function main() {
  const { values, positionals } = parse(process.argv.slice(2));

  if (values.help) return console.log(HELP);
  if (values.version) return console.log(pkg.version);

  // A bare `init-visual-planner [dir]` keeps working as an alias of `init`.
  const [first, ...rest] = positionals;
  const command = COMMANDS.has(first) ? first : 'init';
  const args = COMMANDS.has(first) ? rest : positionals;

  switch (command) {
    case 'init':
      return runInit(args[0], { force: values.force });
    case 'dev':
      return runDev(args[0], { port: values.port, host: values.host, open: !values['no-open'] });
    case 'status':
      return runStatus(args[0]);
    case 'stop':
      return void (await stop(path.resolve(args[0] ?? '.')));
  }
}

main().catch((err) => fail(err.message));
