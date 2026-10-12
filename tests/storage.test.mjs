import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
import path from 'node:path';
import { folderStorage } from '../runtime/storage.mjs';
import { startServer } from '../runtime/server.mjs';

test('inherited property names are counted as other files and directories', async () => {
  const folder = await mkdtemp(path.join(tmpdir(), 'anacapa-storage-names-'));
  try {
    await writeFile(path.join(folder, 'constructor'), Buffer.alloc(7));
    const single = await folderStorage(folder);
    assert.equal(single.totalBytes, 7);
    assert.deepEqual(single.groups.other, { bytes: 7, files: 1 });

    const files = [
      ['toString', 11],
      ['__proto__', 13],
      ['hasOwnProperty', 17],
      ['valueOf', 19],
    ];
    for (const [name, bytes] of files)
      await writeFile(path.join(folder, name), Buffer.alloc(bytes));
    // A nested category-looking name must stay under the unknown root directory.
    const nested = path.join(folder, 'isPrototypeOf', 'snapshots');
    await mkdir(nested, { recursive: true });
    await writeFile(path.join(nested, 'record.json'), Buffer.alloc(23));
    const storage = await folderStorage(folder);
    assert.equal(storage.totalBytes, 90);
    assert.deepEqual(storage.groups.other, { bytes: 90, files: 6 });
    for (const category of ['originals', 'snapshots', 'audit'])
      assert.deepEqual(storage.groups[category], { bytes: 0, files: 0 });
    assert.deepEqual(Object.keys(storage.groups).sort(), [
      'audit',
      'originals',
      'other',
      'snapshots',
    ]);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

test('storage groups exact byte totals and excludes links outside the case', async () => {
  const folder = await mkdtemp(path.join(tmpdir(), 'anacapa-storage-'));
  try {
    await mkdir(path.join(folder, 'originals'));
    await mkdir(path.join(folder, 'snapshots'));
    await writeFile(path.join(folder, 'originals', 'file.bin'), Buffer.alloc(15));
    await writeFile(path.join(folder, 'snapshots', '01.json'), Buffer.alloc(20));
    await writeFile(path.join(folder, 'case.json'), Buffer.alloc(10));
    // Windows unprivileged symlink creation may be unavailable; totals are still exercised.
    let linked = true;
    try {
      await symlink(
        tmpdir(),
        path.join(folder, 'outside'),
        process.platform === 'win32' ? 'junction' : 'dir',
      );
    } catch (error) {
      if (!['EPERM', 'EACCES'].includes(error.code)) throw error;
      linked = false;
    }
    const storage = await folderStorage(folder);
    assert.equal(storage.totalBytes, 45);
    assert.deepEqual(storage.groups.originals, { bytes: 15, files: 1 });
    assert.deepEqual(storage.groups.snapshots, { bytes: 20, files: 1 });
    assert.equal(storage.skippedLinks, Number(linked));
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

test('case storage reports growth and respects advanced locking', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'anacapa-storage-api-'));
  const server = startServer({ port: 0, dataDirectory: path.join(directory, 'registry') });
  try {
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    const first = await fetch(base + '/api/workspace');
    const cookie = first.headers.get('set-cookie').split(';')[0];
    await first.json();
    const request = (route, body) =>
      fetch(base + route, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { Cookie: cookie, 'X-Anacapa-Client': '1', 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    for (const mode of ['normal', 'advanced']) {
      const created = await request('/api/cases', {
        mode,
        title: 'Fictional storage check',
        parentFolder: directory,
        username: 'operator',
        password: 'fictional long password',
      });
      assert.equal(created.status, 200);
      const state = await created.json();
      const route = '/api/cases/' + state.workspace.activeCase;
      const before = await (await request(route + '/storage')).json();
      assert.equal(before.revisions, 1);
      assert.ok(before.totalBytes > 0);
      assert.ok(before.checkpointBytes > 0);
      await request(route + '/custody', {
        from: 'Fictional collector',
        to: 'Fictional reviewer',
        when: '2026-10-11',
        method: 'Local test copy',
        note: 'Testing storage growth',
      });
      const after = await (await request(route + '/storage')).json();
      assert.equal(after.revisions, 2);
      assert.ok(after.totalBytes > before.totalBytes);
      assert.ok(after.groups.snapshots.bytes > before.groups.snapshots.bytes);
      assert.equal((await request(route + '/storage', {})).status, 405);
      if (mode === 'advanced') {
        await request(route + '/lock', {});
        assert.equal((await request(route + '/storage')).status, 423);
      }
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
