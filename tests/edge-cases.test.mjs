import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { startServer } from '../runtime/server.mjs';
import { sample } from '../lib/case-data.ts';
import { eventInstant, compareEvents } from '../lib/provenance.ts';

test('a valid large workspace exceeding the old 4 MB limit saves and reloads, while over-limit cards leave it unchanged', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'anacapa-size-'));
  let server;
  try {
    server = startServer({ port: 0, dataDirectory: dir });
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    const put = (workspace, revision) =>
      fetch(base + '/api/workspace', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Anacapa-Client': '1' },
        body: JSON.stringify({ workspace, revision }),
      });
    const w = structuredClone(sample);
    w.cases[0].threads = [];
    w.cases[0].nodes = Array.from({ length: 320 }, (_, i) => ({
      ...w.cases[0].nodes[0],
      id: 'large-' + i,
      title: 'Evidence ' + i,
      summary: 'x'.repeat(20000),
      fields: [],
      tags: [],
      images: [],
      parentId: null,
    }));
    assert.ok(Buffer.byteLength(JSON.stringify(w)) > 4000000);
    assert.equal((await put(w, 0)).status, 200);
    const loaded = await (await fetch(base + '/api/workspace')).json();
    assert.equal(loaded.workspace.cases[0].nodes[319].summary.length, 20000);
    const full = structuredClone(w);
    full.cases[0].nodes = Array.from({ length: 3000 }, (_, i) => ({
      ...w.cases[0].nodes[0],
      id: 'limit-' + i,
      summary: '',
      parentId: i ? 'limit-' + (i - 1) : null,
    }));
    full.cases[0].threads = Array.from({ length: 6000 }, (_, i) => ({
      id: 'thread-' + i,
      source: 'limit-' + (i % 2999),
      target: 'limit-' + ((i % 2999) + 1),
      label: 'Followed by',
      color: '#a58b70',
      dashed: false,
    }));
    assert.equal((await put(full, loaded.revision)).status, 200);
    full.cases[0].nodes.push({ ...full.cases[0].nodes[0], id: 'too-many' });
    assert.equal((await put(full, loaded.revision + 1)).status, 400);
    const intact = await (await fetch(base + '/api/workspace')).json();
    assert.equal(intact.revision, loaded.revision + 1);
    assert.equal(intact.workspace.cases[0].nodes.length, 3000);
    assert.equal(intact.workspace.cases[0].threads.length, 6000);
  } finally {
    if (server) await new Promise((r) => server.close(r));
    await rm(dir, { recursive: true, force: true });
  }
});

test('zero-byte and oversized attachments fail, an exact 10 MB original succeeds with intact bytes', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'anacapa-file-boundary-'));
  let server;
  try {
    server = startServer({ port: 0, dataDirectory: dir });
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    const upload = (bytes) => {
      const form = new FormData();
      form.set('file', new File([bytes], "Boundary's Exhibit α.txt", { type: 'text/plain' }));
      return fetch(base + '/api/files', {
        method: 'POST',
        headers: { 'X-Anacapa-Client': '1' },
        body: form,
      });
    };
    assert.equal((await upload(new Uint8Array())).status, 400);
    assert.equal((await upload(new Uint8Array(10 * 1024 * 1024 + 1))).status, 400);
    const bytes = new Uint8Array(10 * 1024 * 1024);
    bytes[0] = 42;
    bytes[bytes.length - 1] = 99;
    const response = await upload(bytes);
    assert.equal(response.status, 200);
    const asset = await response.json();
    assert.equal(asset.size, bytes.length);
    const downloaded = await fetch(base + asset.url);
    assert.match(
      downloaded.headers.get('content-disposition'),
      /Boundary%27s%20Exhibit%20%CE%B1\.txt/,
    );
    const original = new Uint8Array(await downloaded.arrayBuffer());
    assert.deepEqual(original, bytes);
    assert.equal((await upload(new Uint8Array(11 * 1024 * 1024 + 1))).status, 413);
  } finally {
    if (server) await new Promise((r) => server.close(r));
    await rm(dir, { recursive: true, force: true });
  }
});

test('date-only chronology respects its UTC offset instead of falling back to alphabetical order', () => {
  const day = { date: '2026-10-11', utcOffset: '+05:30', title: 'Z date only' },
    later = { date: '2026-10-11T00:10', utcOffset: '+05:30', title: 'A later time' };
  assert.equal(eventInstant(day), Date.parse('2026-10-10T18:30Z'));
  assert.ok(compareEvents(day, later) < 0);
});
