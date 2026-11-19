import http from 'http';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';
import { WebSocketServer } from 'ws';
import chokidar from 'chokidar';
import { isInside } from '../lib/paths.js';

const LIVERELOAD_PATH = '/__visual-planner/livereload';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

// Injected before </body> of every served HTML page. On disconnect it waits
// for the server to come back instead of hammering reload on a dead port.
const RELOAD_SCRIPT = `
<!-- Injected by Visual Planner Dev Server -->
<script>
(function () {
  var url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '${LIVERELOAD_PATH}';
  function connect(isRetry) {
    var ws = new WebSocket(url);
    ws.onopen = function () { if (isRetry) location.reload(); };
    ws.onmessage = function (e) { if (e.data === 'reload') location.reload(); };
    ws.onclose = function () {
      console.log('[visual-planner] Lost connection to dev server. Retrying...');
      setTimeout(function () { connect(true); }, 2000);
    };
  }
  connect(false);
})();
</script>
`;

export function injectReloadScript(html) {
  const idx = html.lastIndexOf('</body>');
  return idx === -1 ? html + RELOAD_SCRIPT : html.slice(0, idx) + RELOAD_SCRIPT + html.slice(idx);
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(body);
}

function createRequestHandler(serveDir, defaultFile) {
  return async (req, res) => {
    let reqPath;
    try {
      reqPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
      return send(res, 400, '400 Bad Request');
    }
    if (reqPath === '/') reqPath = '/' + defaultFile;

    const filePath = path.join(serveDir, reqPath);
    if (!isInside(serveDir, filePath)) return send(res, 403, '403 Forbidden');

    try {
      const stat = await fs.stat(filePath);
      if (!stat.isFile()) return send(res, 403, '403 Forbidden');

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const headers = { 'Content-Type': contentType, 'Cache-Control': 'no-store' };

      if (ext === '.html' || ext === '.htm') {
        const html = await fs.readFile(filePath, 'utf8');
        res.writeHead(200, { ...headers, 'Content-Type': MIME_TYPES['.html'] });
        return res.end(injectReloadScript(html));
      }

      res.writeHead(200, headers);
      createReadStream(filePath)
        .on('error', () => res.destroy())
        .pipe(res);
    } catch (err) {
      if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return send(res, 404, '404 Not Found');
      return send(res, 500, '500 Internal Server Error');
    }
  };
}

function listenOnFreePort(server, startPort, host, maxAttempts, log) {
  return new Promise((resolve, reject) => {
    let port = startPort;
    let attempts = 0;
    const onError = (err) => {
      if (err.code === 'EADDRINUSE' && port !== 0 && ++attempts < maxAttempts) {
        log(`⚠️  Port ${port} is in use, trying ${port + 1}...`);
        port += 1;
        server.listen(port, host);
      } else {
        server.off('listening', onListening);
        reject(err);
      }
    };
    const onListening = () => {
      server.off('error', onError);
      resolve(server.address().port);
    };
    server.on('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });
}

/**
 * Starts a static dev server rooted at the HTML file's directory, with live
 * reload whenever a file in that directory changes.
 *
 * Resolves to { url, port, close() } once the server is listening.
 */
export async function startDevServer(htmlFilePath, { port = 3000, host = '127.0.0.1', maxPortAttempts = 20, watch = true, log = console.log } = {}) {
  const stat = await fs.stat(htmlFilePath).catch(() => null);
  if (!stat || !stat.isFile()) {
    throw new Error(`File not found: ${htmlFilePath}`);
  }

  const serveDir = path.dirname(htmlFilePath);
  const targetFilename = path.basename(htmlFilePath);

  const server = http.createServer(createRequestHandler(serveDir, targetFilename));
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname !== LIVERELOAD_PATH) return socket.destroy();
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  const actualPort = await listenOnFreePort(server, port, host, maxPortAttempts, log);
  const url = `http://localhost:${actualPort}/${encodeURIComponent(targetFilename)}`;

  let watcher = null;
  if (watch) {
    // Watch the served folder (top level only) so edits to the spec or any
    // asset next to it trigger a reload. Debounced to coalesce editor saves.
    watcher = chokidar.watch(serveDir, {
      depth: 0,
      ignoreInitial: true,
      ignored: (p) => /(^|[\\/])(\.git|\.visual-planner|node_modules)([\\/]|$)/.test(p),
    });
    let timer = null;
    watcher.on('all', (event, changed) => {
      if (event === 'addDir' || event === 'unlinkDir') return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        log(`⚡ ${path.basename(changed)} changed. Reloading ${wss.clients.size} client(s)...`);
        for (const client of wss.clients) {
          if (client.readyState === client.OPEN) client.send('reload');
        }
      }, 50);
    });
  }

  async function close() {
    await watcher?.close();
    for (const client of wss.clients) client.terminate();
    wss.close();
    await new Promise((resolve) => server.close(() => resolve()));
  }

  return { url, port: actualPort, serveDir, close };
}
