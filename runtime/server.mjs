import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createLocalApi } from './api.mjs';
export const root = fileURLToPath(new URL('../', import.meta.url));
export function startServer({
  port = 5173,
  dataDirectory = path.join(root, '.anacapa-data'),
  assets = path.join(root, 'dist'),
} = {}) {
  const api = createLocalApi(dataDirectory),
    types = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.json': 'application/json',
      '.pdf': 'application/pdf',
    };
  const server = createServer((req, res) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'; form-action 'self'",
    );
    void api(req, res, async () => {
      try {
        const url = new URL(req.url, 'http://127.0.0.1');
        const rel =
          decodeURIComponent(url.pathname) === '/'
            ? '/index.html'
            : decodeURIComponent(url.pathname);
        const file = path.resolve(assets, '.' + rel);
        if (!file.startsWith(path.resolve(assets) + path.sep)) throw Error();
        const bytes = await readFile(file);
        res.writeHead(200, {
          'Content-Type': types[path.extname(file)] || 'application/octet-stream',
          'X-Content-Type-Options': 'nosniff',
        });
        res.end(bytes);
      } catch {
        res.writeHead(404);
        res.end('Not found');
      }
    });
  });
  server.listen(port, '127.0.0.1');
  return server;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.ANACAPA_PORT || 5173),
    url = `http://127.0.0.1:${port}/`;
  const server = startServer({ port });
  server.on('listening', () => {
    console.log(
      `Anacapa is ready: ${url}\nCases are saved locally in .anacapa-data. Keep this window open.\nPress Ctrl+C to stop.`,
    );
    if (process.argv.includes('--open')) {
      const command =
        process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
      const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
      const p = spawn(command, args, { stdio: 'ignore' });
      p.on('error', () => {});
    }
  });
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.log(`Anacapa is already running. Open ${url}`);
      process.exitCode = 0;
    } else {
      console.error(e.message);
      process.exitCode = 1;
    }
  });
}
