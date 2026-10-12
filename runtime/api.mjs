import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, randomBytes } from 'node:crypto';
import { createManifest, readInstallAppearance, parseInvestigationPackage } from './model.mjs';
import { CaseStore, atomic } from './case-store.mjs';
import { sha256, openPackage, sealPackage } from './crypto.mjs';
export function createLocalApi(dataDirectory) {
  const store = new CaseStore(dataDirectory),
    files = path.join(dataDirectory, 'files');
  let writes = Promise.resolve();
  const json = (res, status, value) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(value));
  };
  const body = async (req, limit) => {
    const parts = [];
    let size = 0;
    for await (const part of req) {
      size += part.length;
      if (size > limit)
        throw Object.assign(Error('This request exceeds the size limit.'), { status: 413 });
      parts.push(part);
    }
    return Buffer.concat(parts);
  };
  const requestJson = async (req, limit = 4000000) =>
    JSON.parse((await body(req, limit)).toString());
  const serial = async (fn) => {
    const result = writes.then(fn);
    writes = result.catch(() => {});
    return result;
  };
  return async (req, res, next) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname !== '/manifest.webmanifest' && !url.pathname.startsWith('/api/'))
      return next();
    if (
      !/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host || '') ||
      (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`)
    )
      return json(res, 403, { error: 'Use Anacapa from its local address.' });
    let client = (req.headers.cookie || '').match(
      /(?:^|;\s*)anacapa_session=([a-f0-9]{64})(?:;|$)/,
    )?.[1];
    if (!client) {
      client = randomBytes(32).toString('hex');
      res.setHeader('Set-Cookie', `anacapa_session=${client}; HttpOnly; SameSite=Strict; Path=/`);
    }
    if (!['GET', 'HEAD'].includes(req.method) && req.headers['x-anacapa-client'] !== '1')
      return json(res, 403, { error: 'Use the Anacapa app to change case records.' });
    try {
      if (url.pathname === '/manifest.webmanifest' && req.method === 'GET') {
        res.writeHead(200, {
          'Content-Type': 'application/manifest+json',
          'Cache-Control': 'no-store',
          Vary: 'Cookie',
        });
        return res.end(
          JSON.stringify(
            createManifest(readInstallAppearance(url.href, req.headers.cookie || null)),
          ),
        );
      }
      if (url.pathname === '/api/workspace' && req.method === 'GET')
        return json(res, 200, await serial(() => store.workspace(client)));
      if (url.pathname === '/api/workspace' && req.method === 'PUT') {
        const value = await requestJson(req, 80 * 1024 * 1024);
        return json(
          res,
          200,
          await serial(() =>
            store.save(value.workspace, value.revision, client, value.reason || ''),
          ),
        );
      }
      if (url.pathname === '/api/folders' && req.method === 'GET')
        return json(res, 200, await store.folders(url.searchParams.get('path')));
      if (url.pathname === '/api/cases' && req.method === 'POST') {
        const value = await requestJson(req, 80 * 1024 * 1024);
        return json(res, 200, await serial(() => store.create(value, client)));
      }
      if (url.pathname === '/api/cases/open-folder' && req.method === 'POST') {
        const value = await requestJson(req, 10000);
        return json(res, 200, await serial(() => store.attachFolder(value.folder, client)));
      }
      if (url.pathname === '/api/packages/encrypt' && req.method === 'POST') {
        const value = await requestJson(req, 80 * 1024 * 1024);
        return json(res, 200, {
          bundle: await sealPackage(parseInvestigationPackage(value.bundle), value.password),
          protected: true,
        });
      }
      if (url.pathname === '/api/packages/decrypt' && req.method === 'POST') {
        const value = await requestJson(req, 110 * 1024 * 1024);
        return json(res, 200, {
          bundle: parseInvestigationPackage(await openPackage(value.envelope, value.password)),
        });
      }
      const route = url.pathname.match(
        /^\/api\/cases\/([a-zA-Z0-9-]+)\/(storage|unlock|lock|history|verify|restore|custody|users|export|backup|session|checkpoint|compare-checkpoint|handling|readiness)$/,
      );
      if (route) {
        const [, id, action] = route;
        if (action === 'session' && req.method === 'GET')
          return json(res, 200, store.status(id, client));
        if (action === 'storage' && req.method === 'GET')
          return json(res, 200, await serial(() => store.storage(id, client)));
        if (action === 'history' && req.method === 'GET')
          return json(res, 200, await serial(() => store.history(id, client)));
        if (action === 'handling' && req.method === 'GET')
          return json(res, 200, await serial(() => store.handling(id, null, client)));
        if (action === 'readiness' && req.method === 'GET')
          return json(res, 200, await serial(() => store.readiness(id, client)));
        if (action === 'users' && req.method === 'GET')
          return json(res, 200, await serial(() => store.users(id, client)));
        if (
          req.method !== 'POST' ||
          action === 'history' ||
          action === 'storage' ||
          action === 'readiness'
        )
          return json(res, 405, { error: 'Unsupported case action.' });
        const value = await requestJson(req, 1000000);
        if (
          action !== 'compare-checkpoint' &&
          (!value || typeof value !== 'object' || Array.isArray(value))
        )
          return json(res, 400, { error: 'Choose valid case action settings.' });
        const result = await serial(async () => {
          if (action === 'session') {
            const index = await store.index();
            store.access(store.entry(index, id), client);
            return store.status(id, client);
          }
          if (action === 'checkpoint')
            return store.checkpointLocation(id, value.parentFolder, client);
          if (action === 'compare-checkpoint') return store.compareCheckpoint(id, value, client);
          if (action === 'handling') return store.handling(id, value, client);
          if (action === 'unlock') return store.unlock(id, value.username, value.password, client);
          if (action === 'lock') {
            store.lock(id, client);
            return store.workspace(client);
          }
          if (action === 'verify') return store.verify(id, client);
          if (action === 'restore') return store.restore(id, value.sequence, value.reason, client);
          if (action === 'custody') return store.custody(id, value, client);
          if (action === 'users') return store.users(id, client, value);
          if (action === 'backup') return store.backup(id, value.parentFolder, client);
          if (action === 'export') return store.export(id, value, client);
          throw Error('Unsupported case action.');
        });
        return json(res, 200, result);
      }
      if (url.pathname === '/api/files' && req.method === 'POST') {
        const raw = await body(req, 11 * 1024 * 1024),
          request = new Request('http://127.0.0.1/api/files', {
            method: 'POST',
            headers: { 'Content-Type': req.headers['content-type'] || '' },
            body: raw,
          }),
          form = await request.formData(),
          file = form.get('file');
        if (!(file instanceof File) || file.size === 0 || file.size > 10 * 1024 * 1024)
          return json(res, 400, { error: 'Choose a file up to 10 MB.' });
        const bytes = Buffer.from(await file.arrayBuffer()),
          caseId = form.get('caseId');
        if (caseId) {
          const index = await store.index(),
            entry = store.entry(index, String(caseId));
          return json(
            res,
            200,
            await serial(() =>
              store.upload(entry, client, bytes, { name: file.name, type: file.type }),
            ),
          );
        }
        const id = randomUUID(),
          meta = {
            name: file.name,
            type: file.type || 'application/octet-stream',
            sha256: sha256(bytes),
            size: bytes.length,
            collectedAt: new Date().toISOString(),
            collectedBy: 'Local operator',
          };
        await atomic(path.join(files, id), bytes);
        await atomic(path.join(files, id + '.json'), JSON.stringify(meta));
        return json(res, 200, { url: '/api/files/' + id, ...meta });
      }
      const match = url.pathname.match(/^\/api\/files\/([a-zA-Z0-9-]+)$/);
      if (match && req.method === 'GET') {
        const id = match[1];
        let asset = await store.attachment(id, client);
        if (!asset) {
          const bytes = await readFile(path.join(files, id)),
            meta = JSON.parse(await readFile(path.join(files, id + '.json'), 'utf8'));
          if (meta.sha256 && sha256(bytes) !== meta.sha256)
            throw Object.assign(Error('Attachment integrity check failed.'), { status: 409 });
          asset = { bytes, meta };
        }
        const { bytes, meta } = asset,
          images = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
        const filename = encodeURIComponent(meta.name).replace(
          /['()*]/g,
          (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
        );
        res.writeHead(200, {
          'Content-Type': meta.type,
          'X-Content-Type-Options': 'nosniff',
          'Content-Disposition': `${images.includes(meta.type) ? 'inline' : 'attachment'}; filename*=UTF-8''${filename}`,
          'Cache-Control': 'no-store',
        });
        res.end(bytes);
        return;
      }
      return json(res, 404, { error: 'Not found.' });
    } catch (e) {
      return json(res, e.code === 'ENOENT' ? 404 : e.status || 400, {
        error:
          e.code === 'ENOENT'
            ? 'File or folder not found.'
            : e.status
              ? e.message
              : 'Could not complete this action. Check the folder, credentials, and case data.',
        code: e.code,
      });
    }
  };
}
