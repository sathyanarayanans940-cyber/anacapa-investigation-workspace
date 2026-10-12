import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { startServer } from '../runtime/server.mjs';
import { sample } from '../lib/case-data.ts';
import { wireStyles } from '../lib/connection-path.ts';

for (const mode of ['normal', 'advanced'])
  test(`${mode} saves wire styles and custom colours as layout changes and rejects invalid choices`, async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'anacapa-colours-'));
    let server;
    try {
      server = startServer({ port: 0, dataDirectory: path.join(directory, 'registry') });
      await once(server, 'listening');
      const base = `http://127.0.0.1:${server.address().port}`;
      const first = await fetch(base + '/api/workspace'),
        cookie = first.headers.get('set-cookie').split(';')[0];
      await first.json();
      const request = (route, method = 'GET', body) =>
        fetch(base + route, {
          method,
          headers: { Cookie: cookie, 'Content-Type': 'application/json', 'X-Anacapa-Client': '1' },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });
      const created = await request('/api/cases', 'POST', {
        mode,
        title: 'Fictional connection colours',
        parentFolder: directory,
        username: 'operator',
        password: 'fictional colour test passphrase',
      });
      assert.equal(created.status, 200);
      let state = await created.json();
      const id = state.workspace.activeCase;
      const find = () => state.workspace.cases.find((c) => c.id === id);
      Object.assign(find(), {
        nodes: structuredClone(sample.cases[0].nodes),
        threads: structuredClone(sample.cases[0].threads),
      });
      find().threads.push({
        id: 'sixth-link',
        source: 'warehouse',
        target: 'note',
        label: 'route note',
        color: '#648fbc',
        dashed: false,
      });
      assert.equal(
        (
          await request('/api/workspace', 'PUT', {
            ...state,
            reason: 'Add fictional tutorial evidence',
          })
        ).status,
        200,
      );
      state = await (await request('/api/workspace')).json();
      find().threads[0].color = '#274b93';
      find().threads[1].color = '#bf7370';
      find().threads.forEach((t, i) => (t.style = wireStyles[i]));
      // Changing only appearance does not require an evidence-change reason in Advanced mode.
      assert.equal((await request('/api/workspace', 'PUT', state)).status, 200);
      state = await (await request('/api/workspace')).json();
      assert.equal(find().threads[0].color, '#274b93');
      assert.equal(find().threads[1].color, '#bf7370');
      assert.deepEqual(
        find().threads.map((t) => t.style),
        [...wireStyles],
      );
      find().threads[0].color = 'red;display:none';
      assert.equal((await request('/api/workspace', 'PUT', state)).status, 400);
      state = await (await request('/api/workspace')).json();
      assert.equal(find().threads[0].color, '#274b93');
      find().threads[0].style = 'unknown';
      assert.equal((await request('/api/workspace', 'PUT', state)).status, 400);
      state = await (await request('/api/workspace')).json();
      assert.deepEqual(
        find().threads.map((t) => t.style),
        [...wireStyles],
      );
    } finally {
      if (server) await new Promise((resolve) => server.close(resolve));
      await rm(directory, { recursive: true, force: true });
    }
  });
