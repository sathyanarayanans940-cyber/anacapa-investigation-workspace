import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../runtime/server.mjs';
import { checkPwa } from './pwa-smoke.mjs';

test('install manifest and every icon are served by an isolated app server', async () => {
  const dataDirectory = await mkdtemp(path.join(tmpdir(), 'anacapa-pwa-'));
  const server = startServer({
    port: 0,
    dataDirectory,
    assets: fileURLToPath(new URL('../public', import.meta.url)),
  });
  try {
    await once(server, 'listening');
    await checkPwa(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(dataDirectory, { recursive: true, force: true });
  }
});
