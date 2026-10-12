import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { startServer } from '../runtime/server.mjs';
test('local server preserves cases across restart, rejects stale and invalid saves, and includes file bytes', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'anacapa-test-'));
  let server;
  try {
    server = startServer({ port: 0, dataDirectory: directory });
    await once(server, 'listening');
    let base = `http://127.0.0.1:${server.address().port}`;
    const read = () => fetch(base + '/api/workspace').then((r) => r.json());
    const put = (workspace, revision, headers = {}) =>
      fetch(base + '/api/workspace', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Anacapa-Client': '1', ...headers },
        body: JSON.stringify({ workspace, revision }),
      });
    const initial = await read();
    const w = structuredClone(initial.workspace);
    w.cases[0].description = 'Local save';
    assert.equal((await put(w, 0)).status, 200);
    assert.equal((await put(w, 0)).status, 409);
    assert.equal((await put(w, 1, { origin: 'https://example.com' })).status, 403);
    const bad = structuredClone(w);
    bad.cases[0].nodes[0].parentId = bad.cases[0].nodes[0].id;
    assert.equal((await put(bad, 1)).status, 400);
    const competing = await Promise.all([put(w, 1), put(w, 1)]);
    assert.deepEqual(competing.map((r) => r.status).sort(), [200, 409]);
    const form = new FormData();
    form.set('file', new File(['a portable attachment'], 'evidence.txt', { type: 'text/plain' }));
    const uploaded = await fetch(base + '/api/files', {
      method: 'POST',
      headers: { 'X-Anacapa-Client': '1' },
      body: form,
    });
    assert.equal(uploaded.status, 200);
    const file = await uploaded.json();
    assert.equal(await (await fetch(base + file.url)).text(), 'a portable attachment');
    assert.equal((await fetch(base + '/.anacapa-data/workspace.json')).status, 404);
    assert.equal((await fetch(base + '/sign-in')).status, 404);
    await new Promise((resolve) => server.close(resolve));
    server = startServer({ port: 0, dataDirectory: directory });
    await once(server, 'listening');
    base = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await read()).workspace.cases[0].description, 'Local save');
    assert.equal(await (await fetch(base + file.url)).text(), 'a portable attachment');
    assert.equal(JSON.parse(await readFile(path.join(directory, 'workspace.json'))).revision, 2);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
test('advanced API sessions protect case contents and require same-origin app writes', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'anacapa-api-security-'));
  let server;
  try {
    server = startServer({ port: 0, dataDirectory: path.join(directory, 'registry') });
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`,
      first = await fetch(base + '/api/workspace'),
      cookie = first.headers.get('set-cookie').split(';')[0];
    const post = (route, value, cookieValue = cookie, app = true) =>
      fetch(base + route, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(app ? { 'X-Anacapa-Client': '1' } : {}),
          Cookie: cookieValue,
        },
        body: JSON.stringify(value),
      });
    const options = {
      title: 'Fictional restricted case',
      description: 'Confidential fixture only',
      mode: 'advanced',
      parentFolder: directory,
      username: 'analyst',
      password: 'fictional tutorial passphrase',
    };
    assert.equal((await post('/api/cases', options, cookie, false)).status, 403);
    const created = await post('/api/cases', options);
    assert.equal(created.status, 200);
    const reply = await created.json(),
      id = reply.workspace.activeCase;
    const stranger = await fetch(base + '/api/workspace'),
      strangerCookie = stranger.headers.get('set-cookie').split(';')[0];
    assert.ok(!JSON.stringify(await stranger.json()).includes('Confidential fixture only'));
    assert.equal(
      (
        await post(
          '/api/cases/' + id + '/export',
          { password: 'fictional sharing passphrase' },
          strangerCookie,
        )
      ).status,
      423,
    );
    assert.equal((await post('/api/cases/' + id + '/lock', {})).status, 200);
    assert.equal((await post('/api/cases/' + id + '/verify', {})).status, 423);
    assert.equal(
      (
        await post('/api/cases/' + id + '/unlock', {
          username: 'analyst',
          password: 'wrong password',
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await post('/api/cases/' + id + '/unlock', {
          username: 'analyst',
          password: options.password,
        })
      ).status,
      200,
    );
    const exported = await (
      await post('/api/cases/' + id + '/export', { password: 'fictional sharing passphrase' })
    ).json();
    assert.equal(exported.bundle.format, 'anacapa-encrypted');
    assert.ok(!JSON.stringify(exported).includes('Confidential fixture only'));
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
