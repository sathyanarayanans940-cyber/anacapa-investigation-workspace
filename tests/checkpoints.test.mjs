import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, rename, readdir, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { CaseStore } from '../runtime/case-store.mjs';
import { verifyCheckpoint } from '../runtime/checkpoints.mjs';
import { evidenceChanged } from '../lib/provenance.ts';
const password = 'fictional tutorial passphrase';
async function setup(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), 'anacapa-checkpoints-'));
  try {
    await fn(new CaseStore(path.join(dir, 'registry')), dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
async function create(s, dir, mode = 'normal') {
  const w = await s.create(
    { mode, title: 'Fictional test case', parentFolder: dir, username: 'operator', password },
    'client',
  );
  const id = w.workspace.activeCase;
  return { w, id, entry: (await s.index()).entries.find((e) => e.id === id) };
}
test('Simple creates Normal protection, keeps all evidence, and changing controls does not require an evidence reason', () =>
  setup(async (s, dir) => {
    const { w, id } = await create(s, dir, 'simple');
    let c = w.workspace.cases.find((c) => c.id === id);
    assert.equal(c.controls, 'simple');
    assert.equal(c.security.mode, 'normal');
    const before = structuredClone(c);
    c.controls = 'full';
    assert.equal(evidenceChanged(before, c), false);
    await s.save(w.workspace, w.revision, 'client');
    assert.equal(
      (await s.workspace('client')).workspace.cases.find((c) => c.id === id).controls,
      'full',
    );
    assert.equal((await s.export(id, {}, 'client')).bundle.investigation.controls, 'full');
    const adv = await create(s, dir, 'advanced');
    adv.w.workspace.cases.find((c) => c.id === adv.id).controls = 'simple';
    await s.save(adv.w.workspace, adv.w.revision, 'client');
    s.lock(adv.id, 'client');
    assert.equal(
      (await s.workspace('client')).workspace.cases.find((c) => c.id === adv.id).security.locked,
      true,
    );
  }));
test('every revision has a verifiable separate signature; altered and other-case receipts fail', () =>
  setup(async (s, dir) => {
    const { w, id, entry } = await create(s, dir);
    const receipt = await s.verify(id, 'client');
    assert.ok(!entry.checkpointFolder.startsWith(entry.folder + path.sep));
    verifyCheckpoint(receipt.checkpoint, entry.checkpointPublicKey);
    w.workspace.cases.find((c) => c.id === id).description = 'Second version';
    await s.save(w.workspace, w.revision, 'client');
    assert.equal((await s.compareCheckpoint(id, receipt, 'client')).sequence, 1);
    assert.equal((await s.verify(id, 'client')).sequence, 2);
    const bad = structuredClone(receipt);
    bad.checkpoint.auditHash = '0'.repeat(64);
    await assert.rejects(s.compareCheckpoint(id, bad, 'client'), { code: 'CHECKPOINT' });
    const other = await create(s, dir);
    await assert.rejects(s.compareCheckpoint(other.id, receipt, 'client'), { code: 'CHECKPOINT' });
  }));
test('rolling back only the case folder is detected before reads, saves, uploads or account changes', () =>
  setup(async (s, dir) => {
    const { w, id, entry } = await create(s, dir, 'advanced');
    const head = await readFile(path.join(entry.folder, 'head.json'));
    w.workspace.cases.find((c) => c.id === id).description = 'Second version';
    await s.save(w.workspace, w.revision, 'client', 'Adding confirmed source information');
    await writeFile(path.join(entry.folder, 'head.json'), head);
    await assert.rejects(s.verify(id, 'client'), { code: 'CHECKPOINT' });
    const current = await s.workspace('client');
    assert.equal(current.workspace.cases.find((c) => c.id === id).security.unavailable, true);
    await assert.rejects(
      s.upload(entry, 'client', Buffer.from('unwanted'), { name: 'x', type: 'text/plain' }),
      { code: 'CHECKPOINT' },
    );
    await assert.rejects(s.users(id, 'client', { username: 'reader', role: 'viewer', password }), {
      code: 'CHECKPOINT',
    });
    assert.equal((await readdir(path.join(entry.folder, 'snapshots'))).length, 2);
  }));
test('missing checkpoint drive fails safely; reconnecting resumes without discarding pending edits', () =>
  setup(async (s, dir) => {
    const { w, id, entry } = await create(s, dir);
    await rename(entry.checkpointFolder, entry.checkpointFolder + '-offline');
    w.workspace.cases.find((c) => c.id === id).description = 'Pending edit';
    await assert.rejects(s.save(w.workspace, w.revision, 'client'), { code: 'CHECKPOINT' });
    assert.equal(JSON.parse(await readFile(path.join(entry.folder, 'head.json'))).sequence, 1);
    await rename(entry.checkpointFolder + '-offline', entry.checkpointFolder);
    await s.save(w.workspace, w.revision, 'client');
    assert.equal((await s.verify(id, 'client')).sequence, 2);
  }));
test('missing or changed separate chain entries and signing keys are rejected', () =>
  setup(async (s, dir) => {
    const { w, id, entry } = await create(s, dir);
    w.workspace.cases.find((c) => c.id === id).description = 'Second version';
    await s.save(w.workspace, w.revision, 'client');
    const first = path.join(entry.checkpointFolder, '000000001.json'),
      original = await readFile(first);
    await rm(first);
    await assert.rejects(s.verify(id, 'client'), { code: 'CHECKPOINT' });
    await writeFile(first, original);
    await rm(s.checkpoints.keyFile);
    const current = await s.workspace('client');
    current.workspace.cases.find((c) => c.id === id).description = 'Third version';
    await assert.rejects(s.save(current.workspace, current.revision, 'client'), {
      code: 'CHECKPOINT',
    });
    assert.equal(JSON.parse(await readFile(path.join(entry.folder, 'head.json'))).sequence, 2);
    await assert.rejects(create(s, dir), { code: 'CHECKPOINT' });
  }));
test('checkpoint relocation retains chain and pin, rejects in-case paths and viewers, and backup remains portable', () =>
  setup(async (s, dir) => {
    const { id, entry } = await create(s, dir, 'advanced');
    await assert.rejects(s.checkpointLocation(id, entry.folder, 'client'));
    await s.users(id, 'client', { username: 'reader', role: 'viewer', password });
    await s.unlock(id, 'reader', password, 'reader-client');
    await assert.rejects(s.checkpointLocation(id, dir, 'reader-client'), { status: 403 });
    const prior = await s.verify(id, 'client');
    await s.checkpointLocation(id, dir, 'client');
    const moved = (await s.index()).entries.find((e) => e.id === id);
    assert.notEqual(moved.checkpointFolder, entry.checkpointFolder);
    assert.equal((await s.verify(id, 'client')).auditHash, prior.auditHash);
    assert.equal((await s.verify(id, 'client')).checkpointFingerprint, prior.checkpointFingerprint);
    const backup = await s.backup(id, dir, 'client');
    const newStore = new CaseStore(path.join(dir, 'other-registry'));
    await newStore.attachFolder(backup.folder, 'reader');
    await newStore.unlock(id, 'operator', password, 'reader');
    const supplied = JSON.parse(await readFile(path.join(backup.folder, 'backup-checkpoint.json')));
    assert.equal((await newStore.compareCheckpoint(id, supplied, 'reader')).matches, true);
    assert.equal((await newStore.verify(id, 'reader')).checkpoint, null);
    assert.equal((await newStore.compareCheckpoint(id, supplied, 'reader')).trustedKey, false);
    const publicFiles = await readdir(backup.folder, { recursive: true });
    assert.ok(!publicFiles.some((n) => n.includes('signing-key')));
    execFileSync(process.execPath, [
      'runtime/verify-checkpoint.mjs',
      backup.folder,
      path.join(backup.folder, 'backup-checkpoint.json'),
      supplied.checkpointFingerprint,
    ]);
    assert.throws(() =>
      execFileSync(
        process.execPath,
        [
          'runtime/verify-checkpoint.mjs',
          backup.folder,
          path.join(backup.folder, 'backup-checkpoint.json'),
          '0'.repeat(64),
        ],
        { stdio: 'pipe' },
      ),
    );
  }));
test('handling settings are audited, administrator controlled, retained on recovery, and reported honestly', () =>
  setup(async (s, dir) => {
    const { id } = await create(s, dir, 'advanced');
    const policy = {
      owner: 'Test review team',
      reference: 'Fictional procedure',
      reviewDate: '2026-12-01',
      backupDays: 7,
      legalHold: true,
      handlingNotes: 'Preserve originals. Use an encrypted offline drive.',
    };
    await s.handling(id, policy, 'client');
    const result = await s.handling(id, null, 'client');
    assert.equal(result.policy.reviewedBy, 'operator');
    await s.users(id, 'client', { username: 'editor', role: 'editor', password });
    await s.unlock(id, 'editor', password, 'editor-client');
    await assert.rejects(s.handling(id, policy, 'editor-client'), { status: 403 });
    await assert.rejects(s.handling(id, { ...policy, backupDays: 0 }, 'client'));
    await assert.rejects(s.handling(id, { ...policy, reviewDate: 'invalid' }, 'client'));
    const review = await s.readiness(id, 'client');
    assert.equal(review.integrity, 'passed');
    assert.equal(review.separateCheckpoints, true);
    assert.equal(review.backupDue, true);
    assert.equal(review.externalReview.agencyApproval, 'not established by this app');
    await s.backup(id, dir, 'client');
    assert.equal((await s.readiness(id, 'client')).backupDue, false);
    await s.restore(id, 1, 'Recover original blank board', 'client');
    assert.equal((await s.handling(id, null, 'client')).policy.owner, policy.owner);
  }));
test('an interrupted head commit can finish only with the separate signed pending intent', () =>
  setup(async (s, dir) => {
    const { id, entry } = await create(s, dir);
    const { record, head, auth } = await s.readRecord(entry, 'client');
    const { digest, sha256 } = await import('../runtime/crypto.mjs');
    const body = {
      sequence: 2,
      at: new Date().toISOString(),
      actor: 'Local operator',
      role: 'admin',
      action: 'case-change',
      reason: 'Pending save',
      detail: {},
      previousHash: head.auditHash,
      snapshotHash: '',
    };
    record.file.description = 'Committed intent';
    const bytes = Buffer.from(JSON.stringify(record));
    body.snapshotHash = sha256(bytes);
    const audit = { ...body, hash: digest(body) };
    await writeFile(path.join(entry.folder, 'snapshots', '000000002.json'), bytes);
    await writeFile(path.join(entry.folder, 'audit', '000000002.json'), JSON.stringify(audit));
    await s.checkpoints.append(entry, {
      sequence: 2,
      snapshotHash: body.snapshotHash,
      auditHash: audit.hash,
      at: body.at,
    });
    assert.equal((await s.readRecord(entry, 'client')).record.file.description, 'Committed intent');
    assert.equal((await s.verify(id, 'client')).sequence, 2);
    await assert.rejects(readFile(s.checkpoints.pendingFile(id)), { code: 'ENOENT' });
  }));
test('pending signed saves recover at either journal stage, without regenerating the signing key', () =>
  setup(async (s, dir) => {
    for (const missingPoint of [false, true]) {
      const { w, id, entry } = await create(s, dir);
      const priorState = await readFile(s.checkpoints.stateFile(id));
      const originalHead = await readFile(path.join(entry.folder, 'head.json'));
      w.workspace.cases.find((c) => c.id === id).description = 'Durable pending revision';
      await s.save(w.workspace, w.revision, 'client');
      const currentPoint = await readFile(s.checkpoints.stateFile(id));
      await writeFile(s.checkpoints.pendingFile(id), currentPoint);
      await writeFile(s.checkpoints.stateFile(id), priorState);
      await writeFile(path.join(entry.folder, 'head.json'), originalHead);
      if (missingPoint) await rm(path.join(entry.checkpointFolder, '000000002.json'));
      await rename(s.checkpoints.keyFile, s.checkpoints.keyFile + '-offline');
      assert.equal(
        (await s.readRecord(entry, 'client')).record.file.description,
        'Durable pending revision',
      );
      await rename(s.checkpoints.keyFile + '-offline', s.checkpoints.keyFile);
      assert.equal((await s.verify(id, 'client')).sequence, 2);
    }
  }));
test('damaged pending snapshot cannot be committed and viewer backups cannot mutate case history', () =>
  setup(async (s, dir) => {
    const { w, id, entry } = await create(s, dir, 'advanced');
    await s.users(id, 'client', { username: 'viewer', role: 'viewer', password });
    await s.unlock(id, 'viewer', password, 'viewer-client');
    const before = await readFile(path.join(entry.folder, 'head.json'));
    await assert.rejects(s.backup(id, dir, 'viewer-client'), { status: 403 });
    assert.deepEqual(await readFile(path.join(entry.folder, 'head.json')), before);
    const current = await s.workspace('client');
    current.workspace.cases.find((c) => c.id === id).description = 'Pending protected data';
    await s.save(
      current.workspace,
      current.revision,
      'client',
      'Document verified test information',
    );
    await writeFile(s.checkpoints.pendingFile(id), await readFile(s.checkpoints.stateFile(id)));
    await writeFile(path.join(entry.folder, 'head.json'), before);
    await writeFile(path.join(entry.folder, 'snapshots', '000000003.enc'), 'broken');
    await assert.rejects(s.readRecord(entry, 'client'), { code: 'CHECKPOINT' });
    assert.deepEqual(await readFile(path.join(entry.folder, 'head.json')), before);
  }));
test('account configuration is bound to a signed revision and missing keys cannot partially change accounts or originals', () =>
  setup(async (s, dir) => {
    const { id, entry } = await create(s, dir, 'advanced');
    await s.users(id, 'client', { username: 'viewer', role: 'viewer', password });
    const original = await readFile(path.join(entry.folder, 'case.json'));
    const { auth } = await s.readRecord(entry, 'client');
    const { mac } = await import('../runtime/crypto.mjs');
    const altered = JSON.parse(original);
    altered.users.find((u) => u.username === 'viewer').role = 'admin';
    delete altered.signature;
    altered.signature = mac(auth.key, altered);
    await writeFile(path.join(entry.folder, 'case.json'), JSON.stringify(altered));
    await assert.rejects(s.verify(id, 'client'), { code: 'INTEGRITY' });
    await writeFile(path.join(entry.folder, 'case.json'), original);
    const head = await readFile(path.join(entry.folder, 'head.json'));
    await rename(s.checkpoints.keyFile, s.checkpoints.keyFile + '-offline');
    await assert.rejects(s.users(id, 'client', { username: 'editor', role: 'editor', password }), {
      code: 'CHECKPOINT',
    });
    assert.deepEqual(await readFile(path.join(entry.folder, 'case.json')), original);
    await assert.rejects(
      s.upload(entry, 'client', Buffer.from('must not be written'), {
        name: 'fixture.txt',
        type: 'text/plain',
      }),
      { code: 'CHECKPOINT' },
    );
    assert.equal((await readdir(path.join(entry.folder, 'originals')).catch(() => [])).length, 0);
    assert.deepEqual(await readFile(path.join(entry.folder, 'head.json')), head);
  }));
test('interrupted account updates recover from signed staged headers and reject damaged staging before advancing trust', () =>
  setup(async (s, dir) => {
    for (const damaged of [false, true]) {
      const { id, entry } = await create(s, dir, 'advanced');
      const originalHeader = await readFile(path.join(entry.folder, 'case.json')),
        originalHead = await readFile(path.join(entry.folder, 'head.json')),
        originalState = await readFile(s.checkpoints.stateFile(id));
      await s.users(id, 'client', { username: 'viewer', role: 'viewer', password });
      const updatedHeader = await readFile(path.join(entry.folder, 'case.json')),
        point = await readFile(s.checkpoints.stateFile(id));
      await writeFile(s.checkpoints.pendingFile(id), point);
      await writeFile(s.checkpoints.stateFile(id), originalState);
      await writeFile(path.join(entry.folder, 'head.json'), originalHead);
      await writeFile(path.join(entry.folder, 'case.json'), originalHeader);
      if (damaged) {
        await writeFile(path.join(entry.folder, 'snapshots', '000000002.header.enc'), 'broken');
        await assert.rejects(s.readRecord(entry, 'client'));
        assert.deepEqual(await readFile(path.join(entry.folder, 'head.json')), originalHead);
        assert.deepEqual(await readFile(s.checkpoints.stateFile(id)), originalState);
      } else {
        assert.equal((await s.verify(id, 'client')).sequence, 2);
        assert.deepEqual(await readFile(path.join(entry.folder, 'case.json')), updatedHeader);
        await s.unlock(id, 'viewer', password, 'viewer-client');
        assert.equal(s.access(entry, 'viewer-client').role, 'viewer');
      }
    }
  }));
test('a portable older backup can establish a new baseline without discarding earlier evidence or history', () =>
  setup(async (s, dir) => {
    for (const mode of ['normal', 'advanced']) {
      const { w, id } = await create(s, dir, mode);
      w.workspace.cases.find((c) => c.id === id).description = 'Retained pre-baseline evidence';
      await s.save(w.workspace, w.revision, 'client', 'Record fictional test evidence');
      const backup = await s.backup(id, dir, 'client'),
        fresh = new CaseStore(path.join(dir, 'fresh-' + mode));
      await fresh.attachFolder(backup.folder, 'fresh');
      if (mode === 'advanced') await fresh.unlock(id, 'operator', password, 'fresh');
      const supplied = JSON.parse(
        await readFile(path.join(backup.folder, 'backup-checkpoint.json')),
      );
      assert.equal((await fresh.compareCheckpoint(id, supplied, 'fresh')).trustedKey, false);
      const before = await fresh.history(id, 'fresh');
      assert.equal(before.total, 2);
      await fresh.checkpointLocation(id, dir, 'fresh');
      const baseline = await fresh.verify(id, 'fresh');
      assert.equal(baseline.sequence, 2);
      assert.ok(baseline.checkpoint);
      assert.equal(baseline.checkpoint.previousCheckpointHash, null);
      const current = await fresh.workspace('fresh'),
        file = current.workspace.cases.find((c) => c.id === id);
      assert.equal(file.description, 'Retained pre-baseline evidence');
      file.description += ' plus subsequent evidence';
      await fresh.save(
        current.workspace,
        current.revision,
        'fresh',
        'Add a fictional subsequent observation',
      );
      assert.equal((await fresh.verify(id, 'fresh')).sequence, 3);
      assert.equal((await fresh.history(id, 'fresh')).total, 3);
      assert.equal((await fresh.compareCheckpoint(id, baseline, 'fresh')).trustedKey, true);
      await assert.rejects(fresh.compareCheckpoint(id, supplied, 'fresh'), { code: 'CHECKPOINT' });
    }
  }));
test('restart retains the pinned signing identity and rejects a rolled-back folder without silently resetting it', () =>
  setup(async (s, dir) => {
    const { w, id, entry } = await create(s, dir);
    const oldHead = await readFile(path.join(entry.folder, 'head.json'));
    w.workspace.cases.find((c) => c.id === id).description = 'Latest trusted revision';
    await s.save(w.workspace, w.revision, 'client');
    const restarted = new CaseStore(path.join(dir, 'registry'));
    assert.equal((await restarted.verify(id, 'client')).sequence, 2);
    assert.equal(
      (await restarted.index()).entries.find((e) => e.id === id).checkpointPublicKey,
      entry.checkpointPublicKey,
    );
    await writeFile(path.join(entry.folder, 'head.json'), oldHead);
    await assert.rejects(restarted.verify(id, 'client'), { code: 'CHECKPOINT' });
    const unavailable = await restarted.workspace('client');
    assert.equal(unavailable.workspace.cases.find((c) => c.id === id).security.unavailable, true);
    assert.equal((await restarted.checkpoints.state(entry)).sequence, 2);
  }));
test('damaged and replaced private signing keys fail before changing the current case revision', () =>
  setup(async (s, dir) => {
    const { w, id, entry } = await create(s, dir);
    const original = await readFile(s.checkpoints.keyFile),
      head = await readFile(path.join(entry.folder, 'head.json'));
    w.workspace.cases.find((c) => c.id === id).description = 'Pending evidence';
    for (const key of [
      'broken private key',
      generateKeyPairSync('ed25519').privateKey.export({ type: 'pkcs8', format: 'pem' }),
    ]) {
      await writeFile(s.checkpoints.keyFile, key);
      await assert.rejects(s.save(w.workspace, w.revision, 'client'), { code: 'CHECKPOINT' });
      assert.deepEqual(await readFile(path.join(entry.folder, 'head.json')), head);
      assert.equal((await readdir(path.join(entry.folder, 'snapshots'))).length, 1);
      assert.equal(await readFile(s.checkpoints.keyFile, 'utf8'), key);
    }
    await writeFile(s.checkpoints.keyFile, original);
    await s.save(w.workspace, w.revision, 'client');
    assert.equal((await s.verify(id, 'client')).sequence, 2);
  }));
