import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import net from 'net';
import os from 'os';
import path from 'path';
import { startDevServer, injectReloadScript } from '../src/commands/dev.js';
import { isInside } from '../src/lib/paths.js';

let root;
let server;

before(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'vp-dev-'));
  await fs.mkdir(path.join(root, 'site'));
  await fs.mkdir(path.join(root, 'site-secrets'));
  await fs.writeFile(path.join(root, 'site', 'spec.html'), '<html><body><h1>Spec</h1></body></html>');
  await fs.writeFile(path.join(root, 'site', 'style.css'), 'body{}');
  await fs.writeFile(path.join(root, 'site-secrets', 'secret.txt'), 'top secret');
  server = await startDevServer(path.join(root, 'site', 'spec.html'), { port: 0, watch: false, log: () => {} });
});

after(async () => {
  await server?.close();
});

/** Sends a raw request line so `..` segments are not normalised by the client. */
function rawGet(port, rawPath) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, '127.0.0.1', () => {
      socket.write(`GET ${rawPath} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n`);
    });
    let data = '';
    socket.on('data', (chunk) => (data += chunk));
    socket.on('end', () => resolve({ status: parseInt(data.split(' ')[1], 10), body: data }));
    socket.on('error', reject);
  });
}

test('serves the default HTML file at / with the live-reload script injected', async () => {
  const res = await fetch(`http://127.0.0.1:${server.port}/`);
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.match(body, /<h1>Spec<\/h1>/);
  assert.match(body, /livereload/);
  assert.ok(body.indexOf('livereload') < body.indexOf('</body>'));
});

test('serves static assets with the right content type', async () => {
  const res = await fetch(`http://127.0.0.1:${server.port}/style.css`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/css/);
});

test('returns 404 for missing files', async () => {
  const res = await fetch(`http://127.0.0.1:${server.port}/nope.html`);
  assert.equal(res.status, 404);
});

test('blocks path traversal, including into prefix-sharing sibling folders', async () => {
  // Plain and dot-encoded `..` segments are normalised away by URL parsing.
  for (const p of ['/../site-secrets/secret.txt', '/%2e%2e/site-secrets/secret.txt']) {
    const res = await rawGet(server.port, p);
    assert.notEqual(res.status, 200, p);
    assert.doesNotMatch(res.body, /top secret/, p);
  }
  // An encoded slash survives URL parsing and must be caught by the root check
  // (`/tmp/x/site-secrets` starts with `/tmp/x/site`, which fooled the old check).
  const res = await rawGet(server.port, '/..%2fsite-secrets/secret.txt');
  assert.equal(res.status, 403);
  assert.doesNotMatch(res.body, /top secret/);
});

test('rejects malformed URLs without crashing', async () => {
  const res = await rawGet(server.port, '/%E0%A4%A');
  assert.equal(res.status, 400);
  const ok = await fetch(`http://127.0.0.1:${server.port}/`);
  assert.equal(ok.status, 200);
});

test('falls through to the next free port when the preferred one is busy', async () => {
  const second = await startDevServer(path.join(root, 'site', 'spec.html'), { port: server.port, watch: false, log: () => {} });
  try {
    assert.notEqual(second.port, server.port);
  } finally {
    await second.close();
  }
});

test('injectReloadScript appends when there is no </body>', () => {
  assert.match(injectReloadScript('<p>hi</p>'), /^<p>hi<\/p>[\s\S]*livereload/);
});

test('isInside', () => {
  assert.equal(isInside('/a/b', '/a/b/c.html'), true);
  assert.equal(isInside('/a/b', '/a/b'), true);
  assert.equal(isInside('/a/b', '/a/bc/x'), false);
  assert.equal(isInside('/a/b', '/a/x'), false);
});
