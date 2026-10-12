import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, readdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { CaseStore } from '../runtime/case-store.mjs';
import { openPackage } from '../runtime/crypto.mjs';
import { sample } from '../lib/case-data.ts';
import { packInvestigation } from '../lib/investigation-package.ts';
const password = 'fictional tutorial passphrase';
async function setup(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), 'anacapa-security-'));
  try {
    await fn(new CaseStore(path.join(dir, 'registry')), dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
const create = (store, dir, mode = 'advanced') =>
  store.create(
    {
      title: 'Secret investigation',
      description: 'Private case notes',
      mode,
      parentFolder: dir,
      username: 'analyst',
      password,
    },
    'client',
  );
test('advanced case data, originals and history are encrypted; restart locks and wrong credentials fail', async () =>
  setup(async (s, dir) => {
    const w = await create(s, dir),
      id = w.workspace.activeCase,
      index = await s.index(),
      entry = index.entries[0];
    const asset = await s.upload(entry, 'client', Buffer.from('sensitive original bytes'), {
      name: 'confidential.txt',
      type: 'text/plain',
    });
    const files = await readdir(entry.folder, { recursive: true });
    for (const name of files) {
      try {
        const text = await readFile(path.join(entry.folder, name), 'utf8');
        assert.ok(!text.includes('Secret investigation'));
        assert.ok(!text.includes('Private case notes'));
        assert.ok(!text.includes('sensitive original bytes'));
        assert.ok(!text.includes('confidential.txt'));
      } catch (e) {
        if (e.code !== 'EISDIR') throw e;
      }
    }
    const restarted = new CaseStore(path.join(dir, 'registry'));
    const locked = await restarted.workspace('new-client');
    assert.equal(locked.workspace.cases.find((c) => c.id === id).security.locked, true);
    await assert.rejects(restarted.unlock(id, 'analyst', 'wrong password', 'new-client'));
    await assert.rejects(restarted.attachment(asset.url.split('/').at(-1), 'new-client'), {
      status: 423,
    });
    await restarted.unlock(id, 'analyst', password, 'new-client');
    assert.equal(
      (await restarted.attachment(asset.url.split('/').at(-1), 'new-client')).bytes.toString(),
      'sensitive original bytes',
    );
  }));
test('advanced evidence changes require a reason and viewer role is enforced by the store', async () =>
  setup(async (s, dir) => {
    let w = await create(s, dir),
      id = w.workspace.activeCase;
    w.workspace.cases.find((c) => c.id === id).description = 'Changed evidence';
    await assert.rejects(s.save(w.workspace, w.revision, 'client'), { code: 'REASON_REQUIRED' });
    await s.save(w.workspace, w.revision, 'client', 'Correcting the source summary');
    assert.equal((await s.history(id, 'client')).events[0].reason, 'Correcting the source summary');
    await s.users(id, 'client', { username: 'reader', role: 'viewer', password });
    let viewer = await s.unlock(id, 'reader', password, 'reader-client');
    viewer.workspace.cases.find((c) => c.id === id).description = 'Unauthorized edit';
    await assert.rejects(
      s.save(viewer.workspace, viewer.revision, 'reader-client', 'Trying to overwrite evidence'),
      { status: 403 },
    );
    const entry = (await s.index()).entries[0];
    await assert.rejects(
      s.upload(entry, 'reader-client', Buffer.from('x'), { name: 'x', type: 'text/plain' }),
      { status: 403 },
    );
  }));
test('history verifies, restore appends a revision, and changed ciphertext is rejected', async () =>
  setup(async (s, dir) => {
    let w = await create(s, dir),
      id = w.workspace.activeCase;
    w.workspace.cases.find((c) => c.id === id).description = 'New version';
    await s.save(w.workspace, w.revision, 'client', 'Reviewing the original source');
    const receipt = await s.verify(id, 'client');
    assert.equal(receipt.sequence, 2);
    await s.restore(id, 1, 'Restore before the mistaken edit', 'client');
    const restored = await s.workspace('client');
    assert.equal(
      restored.workspace.cases.find((c) => c.id === id).description,
      'Private case notes',
    );
    assert.equal((await s.verify(id, 'client')).sequence, 3);
    const entry = (await s.index()).entries[0],
      p = path.join(entry.folder, 'snapshots', '000000003.enc');
    const bytes = await readFile(p);
    bytes[bytes.length - 20] ^= 1;
    await writeFile(p, bytes);
    await assert.rejects(s.verify(id, 'client'), { code: 'INTEGRITY' });
  }));
test('normal folders have no password requirement and advanced export requires encrypted sharing', async () =>
  setup(async (s, dir) => {
    let w = await create(s, dir, 'normal'),
      id = w.workspace.activeCase;
    w.workspace.cases.find((c) => c.id === id).description = 'Quick change';
    await s.save(w.workspace, w.revision, 'another-client');
    assert.equal((await s.export(id, {}, 'another-client')).protected, false);
    w = await create(s, dir);
    id = w.workspace.activeCase;
    await assert.rejects(s.export(id, {}, 'client'));
    const encrypted = await s.export(id, { password }, 'client');
    assert.equal(encrypted.protected, true);
    assert.ok(!JSON.stringify(encrypted.bundle).includes('Private case notes'));
    const bundle = await openPackage(encrypted.bundle, password);
    assert.equal(bundle.investigation.title, 'Secret investigation');
    assert.equal(bundle.history.length, 1);
    const selected = await openPackage(
      (await s.export(id, { password, ids: [], omitCitations: true }, 'client')).bundle,
      password,
    );
    assert.equal(selected.history, undefined);
    assert.equal(selected.custody, undefined);
  }));
test('expired sessions and revoked local accounts cannot read protected originals', async () =>
  setup(async (s, dir) => {
    const w = await create(s, dir),
      id = w.workspace.activeCase,
      entry = (await s.index()).entries[0];
    const im = await s.upload(entry, 'client', Buffer.from('original'), {
      name: 'original.txt',
      type: 'text/plain',
    });
    await s.users(id, 'client', { username: 'reader', role: 'viewer', password });
    await s.unlock(id, 'reader', password, 'reader-client');
    s.clients.get('reader-client').cases.get(id).last = Date.now() - 600001;
    await assert.rejects(s.attachment(im.url.split('/').at(-1), 'reader-client'), { status: 423 });
    await s.unlock(id, 'reader', password, 'reader-client');
    await s.users(id, 'client', { operation: 'remove', username: 'reader' });
    await assert.rejects(s.attachment(im.url.split('/').at(-1), 'reader-client'), { status: 423 });
    await assert.rejects(s.unlock(id, 'reader', password, 'new-reader'), { status: 403 });
    await assert.rejects(s.users(id, 'client', { operation: 'remove', username: 'analyst' }));
  }));
test('historical snapshot corruption is detected and cannot be restored', async () =>
  setup(async (s, dir) => {
    let w = await create(s, dir, 'normal'),
      id = w.workspace.activeCase;
    w.workspace.cases.find((c) => c.id === id).description = 'Another revision';
    await s.save(w.workspace, w.revision, 'client');
    const entry = (await s.index()).entries[0];
    await writeFile(path.join(entry.folder, 'snapshots', '000000001.json'), '{}');
    await assert.rejects(s.verify(id, 'client'), { code: 'INTEGRITY' });
    await assert.rejects(s.restore(id, 1, 'Try a damaged old version', 'client'), {
      code: 'INTEGRITY',
    });
  }));
test('complete backups preserve encryption and can be opened with a fresh app registry', async () =>
  setup(async (s, dir) => {
    const w = await create(s, dir),
      id = w.workspace.activeCase,
      entry = (await s.index()).entries[0];
    await s.upload(entry, 'client', Buffer.from('unreferenced original'), {
      name: 'original.txt',
      type: 'text/plain',
    });
    const backup = await s.backup(id, dir, 'client');
    assert.notEqual(backup.folder, entry.folder);
    assert.equal((await s.verify(id, 'client')).assets.length, 1);
    const restored = new CaseStore(path.join(dir, 'new-registry'));
    let result = await restored.attachFolder(backup.folder, 'new');
    assert.equal(result.workspace.cases.find((c) => c.id === id).security.locked, true);
    await restored.unlock(id, 'analyst', password, 'new');
    assert.equal((await restored.verify(id, 'new')).sequence, backup.sequence);
    await assert.rejects(s.backup(id, entry.folder, 'client'));
  }));
test('imported custody and earlier history are retained separately from local recovery versions', async () =>
  setup(async (s, dir) => {
    const source = await create(s, dir, 'normal'),
      id = source.workspace.activeCase;
    await s.custody(
      id,
      {
        from: 'Collector',
        to: 'Reviewer',
        when: '2026-10-10 14:00 +00:00',
        method: 'Encrypted drive',
        note: 'Review source exhibit',
      },
      'client',
    );
    const bundle = (await s.export(id, {}, 'client')).bundle;
    const opened = await s.create(
      { mode: 'normal', title: 'Imported review', parentFolder: dir, importBundle: bundle },
      'importer',
    );
    const history = await s.history(opened.workspace.activeCase, 'importer');
    assert.equal(history.total, 1);
    assert.equal(history.custody[0].from, 'Collector');
    assert.equal(history.importedEvents.length, 2);
    assert.equal((await s.verify(opened.workspace.activeCase, 'importer')).sequence, 1);
  }));

test('restoring a revision requires a bounded reason, including when omitted at the API boundary', async () =>
  setup(async (s, dir) => {
    const w = await create(s, dir),
      id = w.workspace.activeCase;
    for (const reason of [undefined, null, '', 'tiny', ' '.repeat(10), 'x'.repeat(2001)])
      await assert.rejects(s.restore(id, 1, reason, 'client'));
    assert.equal((await s.history(id, 'client')).total, 1);
  }));
test('an unavailable folder does not block other cases, and a moved folder can be reattached', async () =>
  setup(async (s, dir) => {
    const a = await create(s, dir, 'normal'),
      id = a.workspace.activeCase,
      entry = (await s.index()).entries.find((e) => e.id === id);
    const b = await s.create(
      { mode: 'normal', title: 'Healthy case', parentFolder: dir },
      'client',
    );
    await rename(entry.folder, entry.folder + '-moved');
    const w = await s.workspace('client'),
      missing = w.workspace.cases.find((c) => c.id === id);
    assert.equal(missing.security.unavailable, true);
    assert.equal(missing.nodes.length, 0);
    w.workspace.cases.find((c) => c.id === b.workspace.activeCase).description = 'Still usable';
    await s.save(w.workspace, w.revision, 'client');
    const attached = await s.attachFolder(entry.folder + '-moved', 'client');
    assert.equal(attached.workspace.cases.find((c) => c.id === id).title, 'Secret investigation');
    assert.equal(attached.workspace.cases.find((c) => c.id === id).security.unavailable, undefined);
    assert.equal(
      attached.workspace.cases.find((c) => c.id === b.workspace.activeCase).description,
      'Still usable',
    );
  }));
test('a corrupt current snapshot is isolated without replacing its evidence or history', async () =>
  setup(async (s, dir) => {
    const w = await create(s, dir, 'normal'),
      id = w.workspace.activeCase,
      entry = (await s.index()).entries.find((e) => e.id === id);
    const bad = path.join(entry.folder, 'snapshots', '000000001.json');
    await writeFile(bad, 'broken snapshot');
    const available = await s.workspace('client');
    assert.equal(available.workspace.cases.find((c) => c.id === id).security.unavailable, true);
    const sample = available.workspace.cases.find((c) => c.id !== id);
    sample.description = 'Sample can save';
    await s.save(available.workspace, available.revision, 'client');
    assert.equal(await readFile(bad, 'utf8'), 'broken snapshot');
  }));
test('every imported reference must match the original checksum and failed imports leave no new case folders', async () =>
  setup(async (s, dir) => {
    await create(s, dir, 'normal');
    const before = await readdir(dir),
      checkpointBefore = await readdir(path.join(dir, 'registry', 'checkpoints'));
    const file = structuredClone(sample.cases[0]),
      bytes = Buffer.from('Fictional shared exhibit'),
      { sha256 } = await import('../runtime/crypto.mjs');
    const image = {
      url: '/api/files/shared-original',
      name: 'exhibit.txt',
      type: 'text/plain',
      sha256: sha256(bytes),
      size: bytes.length,
    };
    file.nodes[0].images = [image];
    file.nodes[1].images = [{ ...image }];
    const valid = await packInvestigation(file, async () => bytes);
    for (const node of [0, 1]) {
      const bad = structuredClone(valid);
      bad.investigation.nodes[node].images[0].sha256 = '0'.repeat(64);
      await assert.rejects(
        s.create(
          { mode: 'normal', title: 'Rejected fixture', parentFolder: dir, importBundle: bad },
          'client',
        ),
      );
      assert.deepEqual(await readdir(dir), before);
      assert.deepEqual(await readdir(path.join(dir, 'registry', 'checkpoints')), checkpointBefore);
    }
    const badSize = structuredClone(valid);
    badSize.investigation.nodes[1].images[0].size++;
    await assert.rejects(
      s.create(
        { mode: 'normal', title: 'Wrong original size', parentFolder: dir, importBundle: badSize },
        'client',
      ),
    );
    const result = await s.create(
        { mode: 'simple', title: 'Valid shared exhibit', parentFolder: dir, importBundle: valid },
        'client',
      ),
      copy = result.workspace.cases.find((c) => c.id === result.workspace.activeCase);
    assert.equal(copy.nodes[0].images[0].url, copy.nodes[1].images[0].url);
    assert.equal((await s.verify(copy.id, 'client')).assets.length, 1);
  }));
