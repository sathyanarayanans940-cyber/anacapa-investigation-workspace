import { mkdir, readFile, open, rename, readdir, rm } from 'node:fs/promises';
import {
  generateKeyPairSync,
  createPrivateKey,
  createPublicKey,
  sign,
  verify,
  randomUUID,
} from 'node:crypto';
import path from 'node:path';
import { digest, sha256 } from './crypto.mjs';
const fail = (message) => Object.assign(Error(message), { status: 409, code: 'CHECKPOINT' });
const numbered = (n) => String(n).padStart(9, '0') + '.json';
async function exclusive(file, bytes, createParent = true) {
  if (createParent) await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const h = await open(file, 'wx', 0o600);
  try {
    await h.writeFile(bytes);
    await h.sync();
  } finally {
    await h.close();
  }
}
async function atomic(file, value) {
  const temp = file + '.' + randomUUID() + '.tmp';
  await exclusive(temp, JSON.stringify(value));
  await rename(temp, file);
}
export function checkpointPayload(value) {
  return {
    format: value.format,
    version: value.version,
    caseId: value.caseId,
    sequence: value.sequence,
    auditHash: value.auditHash,
    snapshotHash: value.snapshotHash,
    at: value.at,
    previousCheckpointHash: value.previousCheckpointHash,
    publicKey: value.publicKey,
  };
}
export function verifyCheckpoint(value, expectedKey) {
  if (
    !value ||
    value.format !== 'anacapa-signed-checkpoint' ||
    value.version !== 1 ||
    typeof value.caseId !== 'string' ||
    !/^[-a-zA-Z0-9]{1,150}$/.test(value.caseId) ||
    !Number.isSafeInteger(value.sequence) ||
    value.sequence < 1 ||
    ![value.auditHash, value.snapshotHash].every(
      (v) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v),
    ) ||
    !(
      value.previousCheckpointHash === null || /^[a-f0-9]{64}$/.test(value.previousCheckpointHash)
    ) ||
    typeof value.at !== 'string' ||
    !Number.isFinite(Date.parse(value.at)) ||
    typeof value.publicKey !== 'string' ||
    value.publicKey.length > 1000 ||
    typeof value.signature !== 'string' ||
    value.signature.length > 200
  )
    throw fail('Invalid signed checkpoint.');
  try {
    const key = createPublicKey(value.publicKey);
    if (
      key.asymmetricKeyType !== 'ed25519' ||
      (expectedKey && value.publicKey !== expectedKey) ||
      !verify(
        null,
        Buffer.from(JSON.stringify(checkpointPayload(value))),
        key,
        Buffer.from(value.signature, 'base64'),
      )
    )
      throw Error();
  } catch {
    throw fail('The checkpoint signature or trusted signing key does not match.');
  }
  return { hash: digest(value), fingerprint: sha256(value.publicKey) };
}
export class Checkpoints {
  constructor(directory) {
    this.directory = directory;
    this.keyFile = path.join(directory, 'checkpoint-signing-key.pem');
  }
  async key(required = false) {
    let pem;
    try {
      pem = await readFile(this.keyFile, 'utf8');
    } catch (e) {
      if (e.code !== 'ENOENT' || required)
        throw fail(
          'The checkpoint signing key is unavailable. Restore the app data from a trusted backup.',
        );
      const key = generateKeyPairSync('ed25519').privateKey.export({
        type: 'pkcs8',
        format: 'pem',
      });
      try {
        await exclusive(this.keyFile, key);
        pem = key;
      } catch (err) {
        if (err.code !== 'EEXIST') throw err;
        pem = await readFile(this.keyFile, 'utf8');
      }
    }
    try {
      const privateKey = createPrivateKey(pem);
      if (privateKey.asymmetricKeyType !== 'ed25519') throw Error();
      return {
        privateKey,
        publicKey: createPublicKey(privateKey).export({ type: 'spki', format: 'pem' }),
      };
    } catch {
      throw fail('The checkpoint signing key is damaged. Restore its trusted copy before editing.');
    }
  }
  stateFile(id) {
    return path.join(this.directory, 'checkpoint-heads', id + '.json');
  }
  async state(entry) {
    try {
      const value = JSON.parse(await readFile(this.stateFile(entry.id), 'utf8'));
      verifyCheckpoint(value, entry.checkpointPublicKey);
      if (value.caseId !== entry.id) throw Error();
      return value;
    } catch {
      throw fail(
        'The separate checkpoint record is missing or damaged. Restore its trusted copy before editing.',
      );
    }
  }
  async check(entry, head, full = false) {
    if (!entry.checkpointFolder) return null;
    const state = await this.state(entry);
    if (
      state.sequence !== head.sequence ||
      state.auditHash !== head.auditHash ||
      state.snapshotHash !== head.snapshotHash
    )
      throw fail(
        'The case differs from its separate checkpoint. It may have been rolled back, replaced, or interrupted during a save.',
      );
    let names;
    try {
      names = (await readdir(entry.checkpointFolder)).filter((n) => /^\d{9}\.json$/.test(n)).sort();
    } catch {
      throw fail('The checkpoint folder is unavailable. Reconnect it before editing this case.');
    }
    if (!names.length || names.at(-1) !== numbered(state.sequence))
      throw fail('The separate checkpoint chain is incomplete or ahead of the case.');
    const last = JSON.parse(
      await readFile(path.join(entry.checkpointFolder, names.at(-1)), 'utf8'),
    );
    verifyCheckpoint(last, entry.checkpointPublicKey);
    if (digest(last) !== digest(state))
      throw fail('The checkpoint folder differs from the trusted app record.');
    if (full) {
      let previous = null,
        lastSequence = null;
      for (const name of names) {
        const point = JSON.parse(await readFile(path.join(entry.checkpointFolder, name), 'utf8'));
        verifyCheckpoint(point, entry.checkpointPublicKey);
        if (
          point.caseId !== entry.id ||
          numbered(point.sequence) !== name ||
          point.previousCheckpointHash !== previous ||
          (lastSequence !== null && point.sequence !== lastSequence + 1)
        )
          throw fail('The separate checkpoint chain was changed.');
        previous = digest(point);
        lastSequence = point.sequence;
      }
    }
    return state;
  }
  pendingFile(id) {
    return path.join(this.directory, 'checkpoint-pending', id + '.json');
  }
  async pending(entry) {
    try {
      const value = JSON.parse(await readFile(this.pendingFile(entry.id), 'utf8'));
      verifyCheckpoint(value, entry.checkpointPublicKey);
      return value;
    } catch (e) {
      if (e.code === 'ENOENT') return null;
      throw fail('The pending checkpoint record is damaged.');
    }
  }
  async complete(entry) {
    if (entry.checkpointFolder) await rm(this.pendingFile(entry.id), { force: true });
  }
  async recover(entry, head, point) {
    verifyCheckpoint(point, entry.checkpointPublicKey);
    if (point.caseId !== entry.id || point.sequence !== head.sequence + 1)
      throw fail('The pending save belongs to another case or revision.');
    const state = await this.state(entry);
    const committed = state.sequence === point.sequence && digest(state) === digest(point);
    if (
      !committed &&
      (state.sequence !== head.sequence ||
        state.auditHash !== head.auditHash ||
        state.snapshotHash !== head.snapshotHash ||
        point.previousCheckpointHash !== digest(state))
    )
      throw fail('The pending save differs from the trusted checkpoint.');
    let names;
    try {
      names = (await readdir(entry.checkpointFolder)).filter((n) => /^\d{9}\.json$/.test(n)).sort();
    } catch {
      throw fail('The checkpoint folder is unavailable. Reconnect it to finish the pending save.');
    }
    let previous = null,
      lastSequence = null;
    for (const name of names) {
      const existing = JSON.parse(await readFile(path.join(entry.checkpointFolder, name), 'utf8'));
      verifyCheckpoint(existing, entry.checkpointPublicKey);
      if (
        existing.caseId !== entry.id ||
        numbered(existing.sequence) !== name ||
        existing.previousCheckpointHash !== previous ||
        (lastSequence !== null && existing.sequence !== lastSequence + 1) ||
        existing.sequence > point.sequence
      )
        throw fail('The separate checkpoint chain was changed.');
      if (
        existing.sequence === head.sequence &&
        digest(existing) !== (committed ? point.previousCheckpointHash : digest(state))
      )
        throw fail('The previous checkpoint differs from the pending save.');
      if (existing.sequence === point.sequence && digest(existing) !== digest(point))
        throw fail('The pending checkpoint file was changed.');
      previous = digest(existing);
      lastSequence = existing.sequence;
    }
    if (lastSequence === head.sequence && previous === point.previousCheckpointHash) {
      await exclusive(
        path.join(entry.checkpointFolder, numbered(point.sequence)),
        JSON.stringify(point),
        false,
      );
    } else if (lastSequence !== point.sequence || previous !== digest(point))
      throw fail('The separate checkpoint chain is incomplete.');
    if (!committed) await atomic(this.stateFile(entry.id), point);
  }

  async signing(entry) {
    const keys = await this.key(true);
    if (keys.publicKey !== entry.checkpointPublicKey)
      throw fail('This case belongs to a different checkpoint signing key.');
    return keys;
  }
  async append(entry, head) {
    if (!entry.checkpointFolder) return null;
    const { privateKey, publicKey } = await this.signing(entry);
    let previous = null;
    try {
      previous = await this.state(entry);
    } catch (e) {
      try {
        await readFile(this.stateFile(entry.id));
        throw e;
      } catch (err) {
        if (err.code !== 'ENOENT') throw e;
      }
    }
    const payload = {
      format: 'anacapa-signed-checkpoint',
      version: 1,
      caseId: entry.id,
      sequence: head.sequence,
      auditHash: head.auditHash,
      snapshotHash: head.snapshotHash,
      at: head.at,
      previousCheckpointHash: previous ? digest(previous) : null,
      publicKey,
    };
    const point = {
      ...payload,
      signature: sign(null, Buffer.from(JSON.stringify(payload)), privateKey).toString('base64'),
    };
    try {
      await atomic(this.pendingFile(entry.id), point);
      await exclusive(
        path.join(entry.checkpointFolder, numbered(head.sequence)),
        JSON.stringify(point),
        false,
      );
      await atomic(this.stateFile(entry.id), point);
    } catch (e) {
      throw fail(
        'Could not save the separate checkpoint. Reconnect its folder; do not discard your unsaved changes.',
      );
    }
    return point;
  }
}
