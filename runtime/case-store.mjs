import { folderStorage } from './storage.mjs';
import {
  mkdir,
  readFile,
  writeFile,
  rename,
  readdir,
  realpath,
  access,
  open,
  cp,
} from 'node:fs/promises';
import { randomUUID, randomBytes } from 'node:crypto';
import path from 'node:path';
import { homedir } from 'node:os';
import {
  workspaceSchema,
  sample,
  evidenceChanged,
  packInvestigation,
  parseInvestigationPackage,
  restoreInvestigation,
  shareSelection,
} from './model.mjs';
import { Checkpoints, verifyCheckpoint } from './checkpoints.mjs';
import {
  encrypt,
  decrypt,
  digest,
  sha256,
  mac,
  equal,
  passwordKey,
  requirePassphrase,
  sealPackage,
  openPackage,
} from './crypto.mjs';
export const idleLimit = 10 * 60 * 1000;
const fail = (message, status = 400, code) => Object.assign(Error(message), { status, code });
const clean = (file) => {
  const copy = structuredClone(file);
  delete copy.security;
  return copy;
};
export async function atomic(file, bytes) {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = file + '.' + randomUUID() + '.tmp';
  const handle = await open(temp, 'wx', 0o600);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temp, file);
}
async function json(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}
const numbered = (n) => String(n).padStart(9, '0');
export class CaseStore {
  constructor(directory) {
    this.directory = directory;
    this.indexFile = path.join(directory, 'case-registry.json');
    this.clients = new Map();
    this.failures = new Map();
    this.staged = new Map();
    this.checkpoints = new Checkpoints(directory);
  }
  async index() {
    try {
      return await json(this.indexFile);
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
      let previous;
      try {
        previous = await json(path.join(this.directory, 'workspace.json'));
      } catch (err) {
        if (err.code !== 'ENOENT') throw err;
        previous = { workspace: sample, revision: 0 };
      }
      return {
        version: 1,
        revision: previous.revision,
        activeCase: previous.workspace.activeCase,
        legacy: previous.workspace.cases,
        entries: [],
        owners: {},
      };
    }
  }
  async writeIndex(index) {
    await atomic(this.indexFile, JSON.stringify(index));
    const cases = index.legacy;
    if (cases.length)
      await atomic(
        path.join(this.directory, 'workspace.json'),
        JSON.stringify({
          workspace: {
            activeCase: cases.some((c) => c.id === index.activeCase)
              ? index.activeCase
              : cases[0].id,
            cases,
          },
          revision: index.revision,
        }),
      );
  }
  session(client) {
    let s = this.clients.get(client);
    if (!s) {
      if (this.clients.size > 100)
        for (const [id, old] of this.clients) {
          if (Date.now() - old.last > idleLimit) {
            for (const v of old.cases.values()) v.key.fill(0);
            this.clients.delete(id);
          }
        }
      s = { cases: new Map(), last: Date.now() };
      this.clients.set(client, s);
    }
    s.last = Date.now();
    return s;
  }
  access(entry, client, write = false) {
    if (entry.mode === 'normal') return { role: 'admin', actor: 'Local operator', key: null };
    const s = this.session(client),
      auth = s.cases.get(entry.id);
    if (auth && Date.now() - auth.last < idleLimit) {
      if (write && auth.role === 'viewer')
        throw fail('This account can view the case but cannot change it.', 403);
      auth.last = Date.now();
      return auth;
    }
    if (auth) {
      auth.key.fill(0);
      s.cases.delete(entry.id);
    }
    throw fail('Unlock this advanced case to continue.', 423, 'CASE_LOCKED');
  }
  lock(id, client) {
    const s = this.session(client),
      a = s.cases.get(id);
    if (a) a.key.fill(0);
    s.cases.delete(id);
  }
  entry(index, id) {
    const e = index.entries.find((e) => e.id === id);
    if (!e) throw fail('This case does not have a case folder yet.', 404);
    return e;
  }
  status(id, client) {
    const auth = this.session(client).cases.get(id);
    if (!auth || Date.now() - auth.last >= idleLimit) {
      this.lock(id, client);
      return { locked: true };
    }
    return { locked: false, role: auth.role };
  }
  async header(entry) {
    const h = await json(path.join(entry.folder, 'case.json'));
    if (
      h.id !== entry.id ||
      h.mode !== entry.mode ||
      h.format !== 'anacapa-case-folder' ||
      h.version !== 1
    )
      throw fail('The case folder header is invalid.', 409);
    return h;
  }
  async readRecord(entry, client) {
    const a = this.access(entry, client),
      head = await json(path.join(entry.folder, 'head.json'));
    if (!Number.isSafeInteger(head.sequence) || head.sequence < 1)
      throw fail('Invalid case revision.', 409);
    const { signature, ...unsigned } = head;
    if (a.key && !equal(signature, mac(a.key, unsigned)))
      throw fail('Case integrity check failed. The head record was changed.', 409, 'INTEGRITY');
    const bytes = await readFile(
      path.join(entry.folder, 'snapshots', numbered(head.sequence) + (a.key ? '.enc' : '.json')),
    );
    if (sha256(bytes) !== head.snapshotHash)
      throw fail('Case integrity check failed. A snapshot was changed.', 409, 'INTEGRITY');
    const record = JSON.parse(
      a.key ? decrypt(JSON.parse(bytes), a.key, entry.id + ':snapshot:' + head.sequence) : bytes,
    );
    workspaceSchema.parse({ activeCase: entry.id, cases: [record.file] });
    if (await this.finishPending(entry, head, a)) return this.readRecord(entry, client);
    await this.checkpoints.check(entry, head);
    if (
      record.headerHash &&
      sha256(await readFile(path.join(entry.folder, 'case.json'))) !== record.headerHash
    )
      throw fail('Case account or configuration integrity check failed.', 409, 'INTEGRITY');
    return { record, head, auth: a };
  }
  async finishPending(entry, head, auth) {
    if (!entry.checkpointFolder) return false;
    const point = await this.checkpoints.pending(entry);
    if (!point || point.sequence !== head.sequence + 1) return false;
    const audit = await this.audit(entry, auth, point.sequence),
      { hash, signature, ...body } = audit;
    if (
      body.sequence !== point.sequence ||
      body.previousHash !== head.auditHash ||
      digest(body) !== point.auditHash ||
      hash !== point.auditHash ||
      body.snapshotHash !== point.snapshotHash ||
      (auth.key && !equal(signature, mac(auth.key, body)))
    )
      throw fail('The interrupted save cannot be recovered safely.', 409, 'CHECKPOINT');
    const bytes = await readFile(
      path.join(
        entry.folder,
        'snapshots',
        numbered(point.sequence) + (auth.key ? '.enc' : '.json'),
      ),
    );
    if (sha256(bytes) !== point.snapshotHash)
      throw fail('The interrupted save snapshot is damaged.', 409, 'CHECKPOINT');
    const record = JSON.parse(
      auth.key
        ? decrypt(JSON.parse(bytes), auth.key, entry.id + ':snapshot:' + point.sequence)
        : bytes,
    );
    workspaceSchema.parse({ activeCase: entry.id, cases: [record.file] });
    let headerBytes;
    if (
      record.headerHash &&
      sha256(await readFile(path.join(entry.folder, 'case.json'))) !== record.headerHash
    ) {
      const staged = await readFile(
        path.join(
          entry.folder,
          'snapshots',
          numbered(point.sequence) + '.header' + (auth.key ? '.enc' : '.json'),
        ),
      );
      headerBytes = auth.key
        ? decrypt(JSON.parse(staged), auth.key, entry.id + ':header:' + point.sequence)
        : staged;
      if (sha256(headerBytes) !== record.headerHash)
        throw fail('The interrupted account update is damaged.', 409, 'CHECKPOINT');
    }
    await this.checkpoints.recover(entry, head, point);
    if (headerBytes) await atomic(path.join(entry.folder, 'case.json'), headerBytes);
    const next = {
      sequence: point.sequence,
      snapshotHash: point.snapshotHash,
      auditHash: point.auditHash,
      at: point.at,
    };
    await atomic(
      path.join(entry.folder, 'head.json'),
      JSON.stringify({ ...next, ...(auth.key ? { signature: mac(auth.key, next) } : {}) }),
    );
    await this.checkpoints.complete(entry);
    return true;
  }
  async exposed(entry, client) {
    try {
      const { record, auth } = await this.readRecord(entry, client);
      return {
        ...record.file,
        security: {
          mode: entry.mode,
          managed: true,
          locked: false,
          folder: entry.folder,
          role: auth.role,
          operator: auth.actor,
          checkpointFolder: entry.checkpointFolder,
          checkpointFingerprint: entry.checkpointPublicKey
            ? sha256(entry.checkpointPublicKey)
            : undefined,
        },
      };
    } catch (e) {
      if (e.status !== 423)
        return {
          id: entry.id,
          title: 'Unavailable case',
          description: 'The case folder cannot be read. Your other cases are still available.',
          nodes: [],
          threads: [],
          security: {
            mode: entry.mode,
            managed: true,
            locked: true,
            unavailable: true,
            folder: entry.folder,
          },
        };
      return {
        id: entry.id,
        title: 'Locked advanced case',
        description: 'Unlock to view this case.',
        nodes: [],
        threads: [],
        security: { mode: 'advanced', managed: true, locked: true, folder: entry.folder },
      };
    }
  }
  async workspace(client) {
    const index = await this.index(),
      cases = [
        ...index.legacy,
        ...(await Promise.all(index.entries.map((e) => this.exposed(e, client)))),
      ];
    return {
      workspace: {
        activeCase: cases.some((c) => c.id === index.activeCase) ? index.activeCase : cases[0].id,
        cases,
      },
      revision: index.revision,
    };
  }
  async writeRecord(entry, record, auth, action, reason, detail = {}, headerChange) {
    let old = null;
    try {
      old = await json(path.join(entry.folder, 'head.json'));
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
    if (old) await this.checkpoints.check(entry, old);
    if (entry.checkpointFolder) await this.checkpoints.signing(entry);
    const headerBytes = headerChange
      ? Buffer.from(JSON.stringify(headerChange))
      : await readFile(path.join(entry.folder, 'case.json'));
    record = { ...record, headerHash: sha256(headerBytes) };
    const sequence = (old?.sequence || 0) + 1,
      bytes = Buffer.from(JSON.stringify(record)),
      snapshot = auth.key
        ? Buffer.from(JSON.stringify(encrypt(bytes, auth.key, entry.id + ':snapshot:' + sequence)))
        : bytes,
      snapshotHash = sha256(snapshot);
    const event = {
        sequence,
        at: new Date().toISOString(),
        actor: auth.actor,
        role: auth.role,
        action,
        reason: reason || '',
        detail,
        previousHash: old?.auditHash || null,
        snapshotHash,
      },
      hash = digest(event),
      audit = { ...event, hash, ...(auth.key ? { signature: mac(auth.key, event) } : {}) };
    await atomic(
      path.join(entry.folder, 'snapshots', numbered(sequence) + (auth.key ? '.enc' : '.json')),
      snapshot,
    );
    await atomic(
      path.join(entry.folder, 'audit', numbered(sequence) + (auth.key ? '.enc' : '.json')),
      auth.key
        ? JSON.stringify(
            encrypt(Buffer.from(JSON.stringify(audit)), auth.key, entry.id + ':audit:' + sequence),
          )
        : JSON.stringify(audit),
    );
    if (headerChange)
      await atomic(
        path.join(
          entry.folder,
          'snapshots',
          numbered(sequence) + '.header' + (auth.key ? '.enc' : '.json'),
        ),
        auth.key
          ? JSON.stringify(encrypt(headerBytes, auth.key, entry.id + ':header:' + sequence))
          : headerBytes,
      );
    const head = { sequence, snapshotHash, auditHash: hash, at: event.at };
    await this.checkpoints.append(entry, head);
    if (headerChange) await atomic(path.join(entry.folder, 'case.json'), headerBytes);
    await atomic(
      path.join(entry.folder, 'head.json'),
      JSON.stringify({ ...head, ...(auth.key ? { signature: mac(auth.key, head) } : {}) }),
    );
    await this.checkpoints.complete(entry);
    return head;
  }
  async save(workspace, revision, client, reason = '') {
    if (typeof reason !== 'string' || reason.length > 20000)
      throw fail('Use a reason shorter than 20,000 characters.');
    const parsed = workspaceSchema.parse(workspace),
      index = await this.index();
    if (revision !== index.revision)
      throw fail(
        'Another window saved newer changes. Download your recovery copy, then load the latest workspace.',
        409,
        'REVISION_CONFLICT',
      );
    const changes = [];
    for (const entry of index.entries) {
      const supplied = parsed.cases.find((c) => c.id === entry.id);
      if (!supplied) throw fail('A folder-backed case cannot be removed through a workspace save.');
      let current;
      try {
        current = await this.readRecord(entry, client);
      } catch (e) {
        if (e.status !== 423) {
          if (
            supplied.security?.unavailable &&
            supplied.title === 'Unavailable case' &&
            !supplied.nodes.length &&
            !supplied.threads.length
          )
            continue;
          throw e;
        }
        if (
          supplied.nodes.length ||
          supplied.threads.length ||
          supplied.title !== 'Locked advanced case'
        )
          throw e;
        continue;
      }
      const file = clean(supplied);
      if (JSON.stringify(file) === JSON.stringify(current.record.file)) continue;
      const auth = this.access(entry, client, true);
      if (
        entry.mode === 'advanced' &&
        evidenceChanged(current.record.file, file) &&
        reason.trim().length < 5
      )
        throw fail('Add a reason for this evidence change.', 422, 'REASON_REQUIRED');
      for (const im of file.nodes.flatMap((n) => n.images)) {
        const meta = await this.assetMeta(entry, im.url.split('/').at(-1), auth);
        if (im.sha256 && im.sha256 !== meta.sha256)
          throw fail('The attachment hash does not match its original.', 409);
        Object.assign(im, meta);
      }
      changes.push({ entry, auth, file, current });
    }
    const legacy = parsed.cases.filter((c) => !index.entries.some((e) => e.id === c.id));
    if (legacy.some((c) => c.security?.mode === 'advanced' || c.security?.managed))
      throw fail('Use Create case to create a protected case folder.');
    for (const change of changes) {
      const { entry, auth, file, current } = change;
      await this.writeRecord(
        entry,
        { ...current.record, file },
        auth,
        'case-change',
        reason || 'Case updated',
        {
          nodes: file.nodes
            .filter(
              (n) =>
                JSON.stringify(n) !==
                JSON.stringify(current.record.file.nodes.find((x) => x.id === n.id)),
            )
            .map((n) => n.id),
          removedNodes: current.record.file.nodes
            .filter((n) => !file.nodes.some((x) => x.id === n.id))
            .map((n) => n.id),
          removedLinks: current.record.file.threads
            .filter((t) => !file.threads.some((x) => x.id === t.id))
            .map((t) => t.id),
          links: file.threads
            .filter(
              (t) =>
                JSON.stringify(t) !==
                JSON.stringify(current.record.file.threads.find((x) => x.id === t.id)),
            )
            .map((t) => t.id),
        },
      );
    }
    // Existing cases remain compatible. Recovery copies preserve the complete old local workspace.
    if (JSON.stringify(index.legacy) !== JSON.stringify(legacy))
      await atomic(
        path.join(
          this.directory,
          'recovery',
          'workspace-' + Date.now() + '-' + randomUUID() + '.json',
        ),
        JSON.stringify({
          workspace: { activeCase: index.legacy[0]?.id, cases: index.legacy },
          revision: index.revision,
        }),
      );
    index.legacy = legacy.map(clean);
    index.activeCase = parsed.activeCase;
    index.revision++;
    await this.writeIndex(index);
    return { revision: index.revision };
  }
  async folders(requested) {
    const folder = await realpath(requested || homedir()),
      items = await readdir(folder, { withFileTypes: true });
    return {
      path: folder,
      parent: path.dirname(folder),
      home: homedir(),
      items: items
        .filter((i) => i.isDirectory() && !i.name.startsWith('.'))
        .map((i) => i.name)
        .sort((a, b) => a.localeCompare(b)),
    };
  }
  async create(opts, client) {
    const index = await this.index();
    if (index.legacy.length + index.entries.length >= 100)
      throw fail('This workspace already contains 100 cases.');
    if (!['simple', 'normal', 'advanced'].includes(opts.mode))
      throw fail('Choose Simple, Normal, or Advanced mode.');
    if (typeof opts.title !== 'string' || !opts.title.trim() || opts.title.length > 200)
      throw fail('Give the case a name.');
    if (typeof opts.parentFolder !== 'string') throw fail('Choose a case folder.');
    const parent = await realpath(opts.parentFolder);
    await access(parent);
    const bundle = opts.importBundle ? parseInvestigationPackage(opts.importBundle) : undefined;
    if (bundle) {
      const references = new Map();
      for (const image of bundle.investigation.nodes.flatMap((node) => node.images)) {
        const same = references.get(image.url) || [];
        same.push(image);
        references.set(image.url, same);
      }
      for (const asset of bundle.assets) {
        const bytes = Buffer.from(asset.data, 'base64'),
          hash = sha256(bytes);
        if (
          references
            .get(asset.url)
            .some(
              (image) =>
                (image.sha256 && image.sha256 !== hash) ||
                (image.size !== undefined && image.size !== bytes.length),
            )
        )
          throw fail(
            'An imported original does not match its recorded hash or size.',
            409,
            'INTEGRITY',
          );
      }
    }
    const id = randomUUID(),
      protection = opts.mode === 'simple' ? 'normal' : opts.mode,
      entry = { id, mode: protection, folder: path.join(parent, 'Anacapa-' + id) };
    let auth = { actor: 'Local operator', role: 'admin', key: null },
      header = {
        format: 'anacapa-case-folder',
        version: 1,
        id,
        mode: protection,
        createdAt: new Date().toISOString(),
      };
    if (opts.mode === 'advanced') {
      requirePassphrase(opts.password);
      const username = this.username(opts.username),
        key = randomBytes(32);
      auth = { actor: username, role: 'admin', key, last: Date.now() };
      header.users = [await this.credential(id, username, 'admin', opts.password, key)];
      header.signature = mac(key, header);
    }
    let file = {
      id,
      title: opts.title.trim(),
      description: String(opts.description || '').slice(0, 20000),
      nodes: [],
      threads: [],
    };
    if (bundle) {
      file = clean(bundle.investigation);
      file.id = id;
      file.title = opts.title.trim();
      file.description = String(opts.description ?? file.description).slice(0, 20000);
    }
    file.controls = opts.mode === 'simple' ? 'simple' : 'full';
    workspaceSchema.parse({ activeCase: id, cases: [file] });
    const signing = await this.checkpoints.key(index.entries.some((e) => e.checkpointPublicKey));
    entry.checkpointFolder = path.join(this.directory, 'checkpoints', id);
    entry.checkpointPublicKey = signing.publicKey;
    await mkdir(entry.checkpointFolder, { recursive: true, mode: 0o700 });
    await mkdir(entry.folder, { mode: 0o700 });
    await atomic(path.join(entry.folder, 'case.json'), JSON.stringify(header));
    if (auth.key) this.session(client).cases.set(id, auth);
    try {
      if (bundle) {
        const urls = new Map();
        for (const asset of bundle.assets) {
          const stored = await this.upload(
            entry,
            client,
            Buffer.from(asset.data, 'base64'),
            { name: asset.name, type: asset.type },
            false,
          );
          urls.set(asset.url, stored.url);
          index.owners[stored.url.split('/').at(-1)] = id;
        }
        file = restoreInvestigation(bundle, id, urls);
        file.controls = opts.mode === 'simple' ? 'simple' : 'full';
        delete file.security;
        file.title = opts.title.trim();
        file.description = String(opts.description ?? file.description).slice(0, 20000);
        for (const im of file.nodes.flatMap((n) => n.images))
          Object.assign(im, await this.assetMeta(entry, im.url.split('/').at(-1), auth));
      }
      await this.writeRecord(
        entry,
        {
          file,
          custody: bundle?.custody || [],
          importedHistory: bundle?.history || [],
          importedIntegrity: bundle?.integrity || null,
        },
        auth,
        bundle ? 'case-import' : 'case-created',
        opts.reason || 'Case folder created',
      );
      index.entries.push(entry);
      index.activeCase = id;
      index.revision++;
      await this.writeIndex(index);
      return this.workspace(client);
    } catch (e) {
      this.lock(id, client);
      throw e;
    }
  }
  username(value) {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 80)
      throw fail('Enter an operator name, up to 80 characters.');
    return value.trim().toLowerCase();
  }
  async credential(id, username, role, password, key) {
    requirePassphrase(password);
    const salt = randomBytes(32).toString('base64'),
      derived = await passwordKey(password, salt);
    try {
      return { username, role, salt, wrapped: encrypt(key, derived, id + ':user:' + username) };
    } finally {
      derived.fill(0);
    }
  }
  async unlock(id, username, password, client) {
    const index = await this.index(),
      entry = this.entry(index, id),
      h = await this.header(entry),
      name = this.username(username),
      failure = this.failures.get(id + ':' + name);
    if (failure?.until > Date.now())
      throw fail('Too many attempts. Wait 30 seconds before trying again.', 429);
    const user = h.users?.find((u) => u.username === name);
    let key;
    try {
      if (!user) throw Error();
      const derived = await passwordKey(password, user.salt);
      try {
        key = decrypt(user.wrapped, derived, id + ':user:' + name);
      } finally {
        derived.fill(0);
      }
      const { signature, ...unsigned } = h;
      if (key.length !== 32 || !equal(signature, mac(key, unsigned))) throw Error();
      const auth = { key, actor: name, role: user.role, last: Date.now() };
      this.session(client).cases.set(id, auth);
      await this.readRecord(entry, client);
      this.failures.delete(id + ':' + name);
      return this.workspace(client);
    } catch (e) {
      if (key) key.fill(0);
      this.session(client).cases.delete(id);
      const count = (failure?.count || 0) + 1;
      this.failures.set(id + ':' + name, {
        count,
        until: count % 5 === 0 ? Date.now() + 30000 : 0,
      });
      throw fail('Wrong credentials or a damaged case folder.', 403);
    }
  }
  async users(id, client, change) {
    const index = await this.index(),
      entry = this.entry(index, id),
      auth = this.access(entry, client, !!change);
    if (auth.role !== 'admin') throw fail('Only the case administrator can manage accounts.', 403);
    if (entry.mode !== 'advanced')
      throw fail('Local accounts are only available in Advanced cases.');
    const h = await this.header(entry);
    const current = change ? await this.readRecord(entry, client) : null;
    if (change) {
      const name = this.username(change.username);
      if (change.operation === 'remove') {
        const user = h.users.find((u) => u.username === name);
        if (!user || user.role === 'admin') throw fail('The case administrator cannot be removed.');
        h.users = h.users.filter((u) => u.username !== name);
      } else {
        if (h.users.length >= 20) throw fail('This case already has 20 local accounts.');
        if (h.users.some((u) => u.username === name)) throw fail('That account already exists.');
        if (!['editor', 'viewer'].includes(change.role)) throw fail('Choose Editor or Viewer.');
        h.users.push(await this.credential(id, name, change.role, change.password, auth.key));
      }
      delete h.signature;
      h.signature = mac(auth.key, h);
      await this.writeRecord(
        entry,
        current.record,
        auth,
        change.operation === 'remove' ? 'account-revoked' : 'account-created',
        'Local case access updated',
        { username: name, role: change.role || '' },
        h,
      );
      if (change.operation === 'remove')
        for (const session of this.clients.values()) {
          const a = session.cases.get(id);
          if (a?.actor === name) {
            a.key.fill(0);
            session.cases.delete(id);
          }
        }
    }
    return { users: h.users.map(({ username, role }) => ({ username, role })) };
  }
  async assetMeta(entry, id, auth) {
    if (!/^[a-zA-Z0-9-]+$/.test(id)) throw fail('Invalid attachment.');
    const bytes = await readFile(
      path.join(entry.folder, 'originals', id + '.meta' + (auth.key ? '.enc' : '.json')),
    );
    return JSON.parse(
      auth.key ? decrypt(JSON.parse(bytes), auth.key, entry.id + ':metadata:' + id) : bytes,
    );
  }
  async upload(entry, client, bytes, metadata, register = true) {
    const auth = this.access(entry, client, true);
    if (register) {
      await this.readRecord(entry, client);
      if (entry.checkpointFolder) await this.checkpoints.signing(entry);
    }
    const id = randomUUID(),
      meta = {
        name: String(metadata.name).slice(0, 300),
        type: String(metadata.type || 'application/octet-stream').slice(0, 100),
        sha256: sha256(bytes),
        size: bytes.length,
        collectedAt: new Date().toISOString(),
        collectedBy: auth.actor,
      },
      dir = path.join(entry.folder, 'originals');
    await mkdir(dir, { recursive: true, mode: 0o700 });
    await writeFile(
      path.join(dir, id + (auth.key ? '.enc' : '.bin')),
      auth.key ? JSON.stringify(encrypt(bytes, auth.key, entry.id + ':asset:' + id)) : bytes,
      { flag: 'wx', mode: 0o600 },
    );
    await writeFile(
      path.join(dir, id + '.meta' + (auth.key ? '.enc' : '.json')),
      auth.key
        ? JSON.stringify(
            encrypt(Buffer.from(JSON.stringify(meta)), auth.key, entry.id + ':metadata:' + id),
          )
        : JSON.stringify(meta),
      { flag: 'wx', mode: 0o600 },
    );
    if (register) {
      const index = await this.index();
      index.owners[id] = entry.id;
      await this.writeIndex(index);
      const { record } = await this.readRecord(entry, client);
      await this.writeRecord(
        entry,
        record,
        auth,
        'attachment-collected',
        'Original bytes preserved',
        { id, sha256: meta.sha256, size: meta.size },
      );
    }
    return { url: '/api/files/' + id, ...meta };
  }
  async attachment(id, client) {
    const index = await this.index(),
      owner = index.owners[id];
    if (!owner) return null;
    const entry = this.entry(index, owner),
      auth = this.access(entry, client),
      meta = await this.assetMeta(entry, id, auth),
      raw = await readFile(path.join(entry.folder, 'originals', id + (auth.key ? '.enc' : '.bin'))),
      bytes = auth.key ? decrypt(JSON.parse(raw), auth.key, entry.id + ':asset:' + id) : raw;
    if (sha256(bytes) !== meta.sha256)
      throw fail('Original attachment integrity check failed.', 409, 'INTEGRITY');
    return { bytes, meta };
  }
  async audit(entry, auth, sequence) {
    const bytes = await readFile(
      path.join(entry.folder, 'audit', numbered(sequence) + (auth.key ? '.enc' : '.json')),
    );
    return JSON.parse(
      auth.key ? decrypt(JSON.parse(bytes), auth.key, entry.id + ':audit:' + sequence) : bytes,
    );
  }
  async history(id, client) {
    const index = await this.index(),
      entry = this.entry(index, id),
      { head, auth, record } = await this.readRecord(entry, client),
      events = [];
    for (let n = Math.max(1, head.sequence - 99); n <= head.sequence; n++)
      events.push(await this.audit(entry, auth, n));
    return {
      events: events.reverse(),
      total: head.sequence,
      custody: record.custody,
      importedEvents: record.importedHistory || [],
      importedIntegrity: record.importedIntegrity || null,
      folder: entry.folder,
    };
  }
  async storage(id, client) {
    const index = await this.index(),
      entry = this.entry(index, id);
    const { head } = await this.readRecord(entry, client);
    const folder = await folderStorage(entry.folder);
    const checkpoint = entry.checkpointFolder ? await folderStorage(entry.checkpointFolder) : null;
    return {
      ...folder,
      revisions: head.sequence,
      checkpointBytes: checkpoint?.totalBytes || 0,
      measuredAt: new Date().toISOString(),
    };
  }
  async verify(id, client) {
    const index = await this.index(),
      entry = this.entry(index, id),
      { head, auth } = await this.readRecord(entry, client);
    let previous = null;
    const expected = new Map();
    for (let n = 1; n <= head.sequence; n++) {
      const audit = await this.audit(entry, auth, n),
        { hash, signature, ...body } = audit;
      if (
        body.sequence !== n ||
        body.previousHash !== previous ||
        digest(body) !== hash ||
        (auth.key && !equal(signature, mac(auth.key, body)))
      )
        throw fail('History integrity check failed at revision ' + n, 409, 'INTEGRITY');
      const snapshot = await readFile(
        path.join(entry.folder, 'snapshots', numbered(n) + (auth.key ? '.enc' : '.json')),
      );
      if (body.snapshotHash !== sha256(snapshot))
        throw fail('Recovery snapshot integrity check failed at revision ' + n, 409, 'INTEGRITY');
      const historical = JSON.parse(
        auth.key ? decrypt(JSON.parse(snapshot), auth.key, id + ':snapshot:' + n) : snapshot,
      );
      for (const image of historical.file.nodes.flatMap((node) => node.images)) {
        const key = image.url.split('/').at(-1);
        if (image.sha256) expected.set(key, { sha256: image.sha256, size: image.size });
      }
      if (body.action === 'attachment-collected')
        expected.set(body.detail.id, { sha256: body.detail.sha256, size: body.detail.size });
      previous = hash;
    }
    if (previous !== head.auditHash)
      throw fail('History checkpoint does not match.', 409, 'INTEGRITY');
    const assets = [];
    const originalIds = new Set([
      ...expected.keys(),
      ...Object.keys(index.owners).filter((key) => index.owners[key] === id),
    ]);
    for (const originalId of originalIds) {
      const asset = await this.attachment(originalId, client),
        check = expected.get(originalId);
      if (
        !asset ||
        (check && (check.sha256 !== asset.meta.sha256 || check.size !== asset.bytes.length))
      )
        throw fail('An original attachment does not match its intake record.', 409, 'INTEGRITY');
      assets.push({ name: asset.meta.name, sha256: asset.meta.sha256, size: asset.meta.size });
    }
    const checkpoint = await this.checkpoints.check(entry, head, true);
    return {
      checkpoint,
      checkpointFingerprint: checkpoint ? sha256(checkpoint.publicKey) : null,
      format: 'anacapa-integrity-receipt',
      version: 1,
      caseId: id,
      checkedAt: new Date().toISOString(),
      sequence: head.sequence,
      auditHash: head.auditHash,
      snapshotHash: head.snapshotHash,
      assets,
    };
  }
  async restore(id, sequence, reason, client) {
    const index = await this.index(),
      entry = this.entry(index, id),
      { head, auth, record } = await this.readRecord(entry, client);
    this.access(entry, client, true);
    if (!Number.isInteger(sequence) || sequence < 1 || sequence > head.sequence)
      throw fail('Choose an existing revision.');
    if (typeof reason !== 'string' || reason.trim().length < 5 || reason.length > 2000)
      throw fail('Explain why you are restoring this revision.');
    const audit = await this.audit(entry, auth, sequence);
    const bytes = await readFile(
      path.join(entry.folder, 'snapshots', numbered(sequence) + (auth.key ? '.enc' : '.json')),
    );
    if (sha256(bytes) !== audit.snapshotHash)
      throw fail('Recovery snapshot integrity check failed.', 409, 'INTEGRITY');
    const old = JSON.parse(
      auth.key ? decrypt(JSON.parse(bytes), auth.key, id + ':snapshot:' + sequence) : bytes,
    );
    workspaceSchema.parse({ activeCase: id, cases: [old.file] });
    await this.writeRecord(
      entry,
      { ...record, file: old.file },
      auth,
      'revision-restored',
      reason,
      { restoredFrom: sequence },
    );
    index.revision++;
    await this.writeIndex(index);
    return this.workspace(client);
  }
  async custody(id, event, client) {
    const index = await this.index(),
      entry = this.entry(index, id),
      { record, auth } = await this.readRecord(entry, client);
    this.access(entry, client, true);
    if (
      !event?.from?.trim() ||
      !event?.to?.trim() ||
      !event?.note?.trim() ||
      !event?.when?.trim() ||
      !event?.method?.trim() ||
      [event.from, event.to, event.note, event.when, event.method].some(
        (v) => typeof v !== 'string' || v.length > 2000,
      )
    )
      throw fail('Enter the sender, recipient, time, method, and purpose of the transfer.');
    const custody = {
      ...event,
      id: randomUUID(),
      recordedAt: new Date().toISOString(),
      recordedBy: auth.actor,
    };
    await this.writeRecord(
      entry,
      { ...record, custody: [...record.custody, custody] },
      auth,
      'custody-transfer',
      event.note,
      custody,
    );
    return this.history(id, client);
  }
  async export(id, options, client) {
    const index = await this.index(),
      entry = this.entry(index, id),
      { record, auth } = await this.readRecord(entry, client);
    const ids = new Set(options.ids || record.file.nodes.map((n) => n.id)),
      redact = new Set(options.redact || []);
    let file = shareSelection(record.file, ids, redact);
    if (options.title) file.title = String(options.title).slice(0, 200);
    if (options.omitDescription) file.description = '';
    if (options.omitNotes) file.nodes = file.nodes.map((n) => ({ ...n, summary: '' }));
    if (options.omitAttachments) file.nodes = file.nodes.map((n) => ({ ...n, images: [] }));
    if (options.omitCitations) {
      file.nodes = file.nodes.map((n) => ({ ...n, citations: [] }));
      file.threads = file.threads.map((t) => ({ ...t, citations: [] }));
    }
    const bundle = await packInvestigation(
      file,
      async (url) => (await this.attachment(url.split('/').at(-1), client)).bytes,
    );
    bundle.integrity = await this.verify(id, client);
    bundle.history = [
      ...(await this.history(id, client)).events,
      ...(record.importedHistory || []),
    ].slice(0, 100);
    bundle.custody = record.custody;
    if (
      options.redact?.length ||
      options.ids ||
      options.omitNotes ||
      options.omitAttachments ||
      options.omitCitations ||
      options.omitDescription ||
      (options.title && options.title !== record.file.title)
    ) {
      delete bundle.history;
      delete bundle.custody;
      bundle.integrity = {
        ...bundle.integrity,
        assets: bundle.assets.map((a) => ({
          name: a.name,
          sha256: sha256(Buffer.from(a.data, 'base64')),
          size: Buffer.from(a.data, 'base64').length,
        })),
        note: 'Selected snapshot. Full history and custody excluded to prevent redacted content being exposed.',
      };
    }
    if (entry.mode === 'advanced' || options.encrypt) {
      requirePassphrase(options.password);
      return { bundle: await sealPackage(bundle, options.password), protected: true };
    }
    return { bundle, protected: false };
  }
  async compareCheckpoint(id, value, client) {
    const index = await this.index(),
      entry = this.entry(index, id),
      { head, auth } = await this.readRecord(entry, client);
    const point = value?.checkpoint || value;
    const signature = verifyCheckpoint(point, entry.checkpointPublicKey);
    if (point.caseId !== id || point.sequence > head.sequence)
      throw fail('This checkpoint belongs to another case or a newer revision.', 409, 'CHECKPOINT');
    const audit = await this.audit(entry, auth, point.sequence);
    if (point.auditHash !== audit.hash || point.snapshotHash !== audit.snapshotHash)
      throw fail('The case history differs from the supplied checkpoint.', 409, 'CHECKPOINT');
    await this.verify(id, client);
    return {
      matches: true,
      sequence: point.sequence,
      currentSequence: head.sequence,
      fingerprint: signature.fingerprint,
      trustedKey: !!entry.checkpointPublicKey,
    };
  }
  async checkpointLocation(id, parentFolder, client) {
    const index = await this.index(),
      entry = this.entry(index, id),
      { head, auth } = await this.readRecord(entry, client);
    if (auth.role !== 'admin')
      throw fail('Only the administrator can configure checkpoint storage.', 403);
    await this.verify(id, client);
    const parent = await realpath(parentFolder),
      caseFolder = await realpath(entry.folder);
    if (parent === caseFolder || parent.startsWith(caseFolder + path.sep))
      throw fail('Choose a checkpoint location outside the case folder.');
    if (
      entry.checkpointFolder &&
      (parent === entry.checkpointFolder || parent.startsWith(entry.checkpointFolder + path.sep))
    )
      throw fail('Choose a location outside the existing checkpoint folder.');
    const destination = path.join(parent, 'Anacapa-checkpoints-' + id + '-' + randomUUID());
    if (entry.checkpointFolder)
      await cp(entry.checkpointFolder, destination, {
        recursive: true,
        errorOnExist: true,
        force: false,
      });
    else {
      const signing = await this.checkpoints.key(index.entries.some((e) => e.checkpointPublicKey));
      entry.checkpointPublicKey = signing.publicKey;
      entry.checkpointFolder = destination;
      await mkdir(destination, { mode: 0o700 });
      await this.checkpoints.append(entry, head);
      await this.checkpoints.complete(entry);
    }
    entry.checkpointFolder = destination;
    index.revision++;
    await this.writeIndex(index);
    return this.workspace(client);
  }
  async handling(id, change, client) {
    const index = await this.index(),
      entry = this.entry(index, id),
      { record, auth } = await this.readRecord(entry, client);
    if (change) {
      if (auth.role !== 'admin')
        throw fail('Only the administrator can update case handling settings.', 403);
      const fields = ['owner', 'reference', 'reviewDate', 'handlingNotes'];
      if (
        fields.some(
          (k) =>
            typeof change[k] !== 'string' ||
            change[k].length > (k === 'handlingNotes' ? 4000 : 300),
        ) ||
        !change.owner.trim() ||
        !Number.isInteger(change.backupDays) ||
        change.backupDays < 1 ||
        change.backupDays > 365 ||
        typeof change.legalHold !== 'boolean' ||
        (change.reviewDate && !/^\d{4}-\d{2}-\d{2}$/.test(change.reviewDate)) ||
        (change.reviewDate &&
          (!Number.isFinite(Date.parse(change.reviewDate + 'T00:00:00Z')) ||
            new Date(change.reviewDate + 'T00:00:00Z').toISOString().slice(0, 10) !==
              change.reviewDate))
      )
        throw fail(
          'Enter an owner, a valid review date, and a backup interval from 1 to 365 days.',
        );
      const policy = Object.fromEntries(fields.map((k) => [k, change[k].trim()]));
      Object.assign(policy, {
        backupDays: change.backupDays,
        legalHold: change.legalHold,
        reviewedBy: auth.actor,
        reviewedAt: new Date().toISOString(),
      });
      await this.writeRecord(
        entry,
        { ...record, policy },
        auth,
        'handling-settings',
        'Case handling settings reviewed',
      );
      index.revision++;
      await this.writeIndex(index);
      return this.workspace(client);
    }
    const checkpoint = entry.checkpointFolder
      ? await this.checkpoints.check(entry, (await this.readRecord(entry, client)).head, true)
      : null;
    return {
      policy: record.policy || null,
      lastBackupAt: record.lastBackupAt || null,
      checkpointFolder: entry.checkpointFolder || null,
      checkpointFingerprint: checkpoint ? sha256(checkpoint.publicKey) : null,
    };
  }
  async readiness(id, client) {
    const index = await this.index(),
      entry = this.entry(index, id),
      { record, head } = await this.readRecord(entry, client),
      receipt = await this.verify(id, client);
    const dated = record.file.nodes.filter((n) => n.date),
      sourced = record.file.nodes.filter((n) => n.citations?.length),
      policy = record.policy;
    return {
      format: 'anacapa-case-review',
      version: 1,
      caseId: id,
      generatedAt: new Date().toISOString(),
      sequence: head.sequence,
      protection: entry.mode,
      controls: record.file.controls || 'full',
      integrity: 'passed',
      separateCheckpoints: !!receipt.checkpoint,
      checkpointFingerprint: receipt.checkpointFingerprint,
      policy: policy || null,
      lastBackupAt: record.lastBackupAt || null,
      backupDue:
        !record.lastBackupAt ||
        !policy ||
        Date.now() - Date.parse(record.lastBackupAt) > policy.backupDays * 86400000,
      sourceCoverage: { sourced: sourced.length, total: record.file.nodes.length },
      explicitTimeZones: { explicit: dated.filter((n) => n.utcOffset).length, dated: dated.length },
      externalReview: {
        independentSecurityReview: 'not established by this app',
        agencyApproval: 'not established by this app',
      },
      limitations: [
        'Local signatures do not protect against full computer or signing-key compromise.',
        'Reported custody and source notes do not prove physical handling or truthfulness.',
        'Review dates are reminders; Anacapa never automatically deletes evidence.',
      ],
    };
  }
  async backup(id, parentFolder, client) {
    const index = await this.index(),
      entry = this.entry(index, id);
    this.access(entry, client, true);
    const receipt = await this.verify(id, client),
      parent = await realpath(parentFolder);
    if (entry.checkpointFolder) await this.checkpoints.signing(entry);
    if (parent === entry.folder || parent.startsWith(entry.folder + path.sep))
      throw fail('Choose a backup location outside the active case folder.');
    const destination = path.join(parent, 'Anacapa-backup-' + randomUUID());
    await cp(entry.folder, destination, { recursive: true, errorOnExist: true, force: false });
    await atomic(
      path.join(destination, 'backup-checkpoint.json'),
      JSON.stringify({
        caseId: id,
        sequence: receipt.sequence,
        auditHash: receipt.auditHash,
        snapshotHash: receipt.snapshotHash,
        at: receipt.checkedAt,
        checkpoint: receipt.checkpoint,
        checkpointFingerprint: receipt.checkpointFingerprint,
      }),
    );
    const { record, auth } = await this.readRecord(entry, client);
    await this.writeRecord(
      entry,
      { ...record, lastBackupAt: receipt.checkedAt },
      auth,
      'backup-created',
      'Complete folder backup verified',
      { sequence: receipt.sequence },
    );
    index.revision++;
    await this.writeIndex(index);
    return {
      folder: destination,
      sequence: receipt.sequence,
      workspace: (await this.workspace(client)).workspace,
      revision: index.revision,
    };
  }
  async attachFolder(folder, client) {
    const actual = await realpath(folder),
      h = await json(path.join(actual, 'case.json'));
    if (
      h.format !== 'anacapa-case-folder' ||
      h.version !== 1 ||
      !['normal', 'advanced'].includes(h.mode) ||
      typeof h.id !== 'string' ||
      !/^[-a-zA-Z0-9]{1,80}$/.test(h.id)
    )
      throw fail('Choose an Anacapa case folder.');
    const index = await this.index(),
      existing = index.entries.find((e) => e.id === h.id);
    if (existing) {
      if (existing.mode !== h.mode)
        throw fail('The case mode does not match the registered folder.');
      if (existing.folder === actual) {
        index.activeCase = h.id;
        index.revision++;
        await this.writeIndex(index);
        return this.workspace(client);
      }
      try {
        await access(existing.folder);
        throw fail('This case is already open from another folder.');
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
      }
    }
    if (
      index.legacy.some((c) => c.id === h.id) ||
      (!existing && index.entries.length + index.legacy.length >= 100)
    )
      throw fail('This case cannot be added to this workspace.');
    const entry = { ...(existing || {}), id: h.id, mode: h.mode, folder: actual };
    if (h.mode === 'normal') await this.readRecord(entry, client);
    for (const name of await readdir(path.join(actual, 'originals')).catch(() => [])) {
      const match = name.match(/^([a-zA-Z0-9-]+)\.(?:bin|enc)$/);
      if (match && !name.includes('.meta')) index.owners[match[1]] = h.id;
    }
    if (existing) {
      index.entries = index.entries.map((e) => (e.id === h.id ? entry : e));
      this.lock(h.id, client);
    } else index.entries.push(entry);
    index.activeCase = h.id;
    index.revision++;
    await this.writeIndex(index);
    return this.workspace(client);
  }
}
