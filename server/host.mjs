/**
 * Suki Engine — static host + mock Stake RGS routes.
 */

import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.jsonl': 'application/json',
  '.csv': 'text/csv',
  '.zst': 'application/octet-stream',
};

/**
 * @param {object} options
 * @param {string} options.rootDir — game project root (static files)
 * @param {{ handleRgsRequest: Function, handleBetEvent: Function, handleReplayRequest: Function }} options.rgs
 * @param {string} [options.sukiPackageDir] — serve @kap-solo/suki-engine for browser import maps
 * @param {number} [options.port]
 * @param {string} [options.host]
 * @param {string} [options.label]
 */
export function createSukiHost({
  rootDir,
  rgs,
  sukiPackageDir = null,
  port = Number(process.env.PORT) || 5174,
  host = process.env.HOST || (process.env.PORT ? '0.0.0.0' : '127.0.0.1'),
  label = 'Suki game',
}) {
  const root = normalize(rootDir);

  function safePath(base, requestPath) {
    const filePath = normalize(join(base, requestPath));
    if (!filePath.startsWith(base)) return null;
    return filePath;
  }

  function serveFile(filePath, res) {
    if (!existsSync(filePath)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(readFileSync(filePath));
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);

    if (req.method === 'GET' && url.pathname.startsWith('/bet/replay/')) {
      const parts = url.pathname.split('/').filter(Boolean);
      const game = parts[2];
      const version = parts[3];
      const mode = parts[4];
      const event = parts.slice(5).join('/');
      const result = rgs.handleReplayRequest(
        game,
        version,
        mode,
        decodeURIComponent(event),
        url.searchParams.get('amount'),
      );
      const status = result.error ? (result.error.code === 'ERR_BNF' ? 404 : 400) : 200;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    if (req.method === 'POST' && (url.pathname.startsWith('/wallet/') || url.pathname === '/bet/event')) {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        let parsed = {};
        try {
          parsed = body ? JSON.parse(body) : {};
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { code: 'ERR_VAL', message: 'Invalid JSON' } }));
          return;
        }

        const result =
          url.pathname === '/bet/event'
            ? rgs.handleBetEvent(parsed)
            : rgs.handleRgsRequest(url.pathname, parsed);
        if (!result) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { code: 'ERR_VAL', message: 'Not found' } }));
          return;
        }

        const status = result.error ? 400 : 200;
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      });
      return;
    }

    if (sukiPackageDir && url.pathname.startsWith('/vendor/suki-engine/')) {
      const rel = url.pathname.slice('/vendor/suki-engine/'.length);
      const filePath = safePath(normalize(sukiPackageDir), rel);
      if (!filePath) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      serveFile(filePath, res);
      return;
    }

    const filePath = safePath(root, url.pathname === '/' ? 'index.html' : url.pathname);
    if (!filePath) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    serveFile(filePath, res);
  });

  return {
    listen(callback) {
      server.listen(port, host, () => {
        console.log(`${label} + mock RGS listening on ${host}:${port}`);
        if (!process.env.PORT) {
          console.log(`Local: http://127.0.0.1:${port}/`);
        }
        callback?.();
      });
      return server;
    },
    server,
  };
}

/** Resolve suki-engine package dir from node_modules next to game root. */
export function resolveSukiPackageDir(gameRootDir) {
  const pkgRoot = join(gameRootDir, 'node_modules', '@kap-solo', 'suki-engine');
  return existsSync(pkgRoot) ? pkgRoot : null;
}
