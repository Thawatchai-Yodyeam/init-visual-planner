import http from 'http';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';
import { WebSocketServer } from 'ws';
import chokidar from 'chokidar';
import open from 'open';

export async function runServer(htmlFilePath) {
  const serveDir = path.dirname(htmlFilePath);
  const targetFilename = path.basename(htmlFilePath);
  let port = parseInt(process.env.PORT || '3000', 10);

  // The reload script to inject before </body>
  const reloadScript = `
    <!-- Injected by Visual Planner Dev Server -->
    <script>
      (function() {
        const ws = new WebSocket('ws://' + window.location.host + '/livereload');
        ws.onmessage = function(event) {
          if (event.data === 'reload') {
            console.log('🔄 File changed, reloading...');
            window.location.reload();
          }
        };
        ws.onclose = function() {
          console.log('❌ Lost connection to dev server. Retrying...');
          setTimeout(() => window.location.reload(), 2000);
        };
      })();
    </script>
  `;

  const server = http.createServer(async (req, res) => {
    let reqPath = decodeURIComponent(req.url.split('?')[0]);
    if (reqPath === '/' || reqPath === '') {
      reqPath = '/' + targetFilename;
    }

    const filePath = path.join(serveDir, reqPath);

    // Check if file is outside serveDir for security
    if (!filePath.startsWith(serveDir)) {
      res.statusCode = 403;
      res.end('403 Forbidden');
      return;
    }

    try {
      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) {
        res.statusCode = 403;
        res.end('403 Forbidden');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();

      // Serve HTML with injected script
      if (ext === '.html') {
        let content = await fs.readFile(filePath, 'utf8');
        // Inject reload script before </body>
        if (content.includes('</body>')) {
          content = content.replace('</body>', reloadScript + '</body>');
        } else {
          content += reloadScript;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(content);
        return;
      }

      // MIME Types
      const mimeTypes = {
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon'
      };

      const contentType = mimeTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      createReadStream(filePath).pipe(res);
    } catch (error) {
      res.statusCode = 404;
      res.end('404 Not Found');
    }
  });

  // Set up WebSocket server
  const wss = new WebSocketServer({ noServer: true });
  const clients = new Set();

  wss.on('connection', (ws) => {
    clients.add(ws);
    ws.on('close', () => clients.delete(ws));
  });

  // Handle WebSocket upgrade
  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
    if (pathname === '/livereload') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  // Handle port conflicts dynamically
  function listen(portToTry) {
    server.listen(portToTry);
  }

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`⚠️  Port ${port} is already in use. Trying port ${port + 1}...`);
      port++;
      listen(port);
    } else {
      console.error('❌ Server error:', err.message);
      process.exit(1);
    }
  });

  server.on('listening', () => {
    const url = `http://localhost:${port}/${targetFilename}`;
    console.log(`\n🚀 Visual Planner Dev Server running at: ${url}`);
    console.log(`📂 Serving folder: ${serveDir}`);
    console.log(`🔄 Watching file: ${targetFilename} for changes...\n`);

    // Open in browser
    open(url).catch(err => console.error('⚠️ Failed to auto-open browser:', err.message));

    // Watch file changes
    const watcher = chokidar.watch(htmlFilePath, { persistent: true });
    watcher.on('change', () => {
      console.log(`⚡ File change detected in ${targetFilename}. Broadcasting reload...`);
      for (const client of clients) {
        if (client.readyState === 1) { // OPEN
          client.send('reload');
        }
      }
    });

    // Write PID file for portable shutdown tracking
    const pidDir = path.join(serveDir, '.visual-planner');
    const pidFile = path.join(pidDir, 'server.pid');
    fs.mkdir(pidDir, { recursive: true })
      .then(() => fs.writeFile(pidFile, process.pid.toString(), 'utf8'))
      .catch(err => console.error('⚠️ Failed to write PID file:', err.message));
  });

  listen(port);
}

export async function stopServer(targetDir) {
  const pidFile = path.join(targetDir, '.visual-planner', 'server.pid');
  try {
    const pidStr = await fs.readFile(pidFile, 'utf8');
    const pid = parseInt(pidStr.trim(), 10);
    if (pid) {
      console.log(`🛑 Stopping Dev Server (PID: ${pid})...`);
      try {
        process.kill(pid);
        console.log('✅ Server stopped successfully.');
      } catch (killError) {
        if (killError.code === 'ESRCH') {
          console.log(`ℹ️ Process ${pid} is already dead.`);
        } else {
          throw killError;
        }
      }
    }
    // Delete the PID file
    await fs.unlink(pidFile).catch(() => {});
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('ℹ️ No active Dev Server found (no server.pid file).');
    } else {
      console.error('❌ Failed to stop server:', error.message);
    }
  }
}
