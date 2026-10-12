import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, readFile, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { startServer } from '../runtime/server.mjs';
test('Simple and review APIs preserve controls, enforce roles, compare receipts, and serialize saves', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'anacapa-assurance-api-'));
  let server;
  try {
    server = startServer({ port: 0, dataDirectory: path.join(directory, 'registry') });
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    const first = await fetch(base + '/api/workspace'),
      cookie = first.headers.get('set-cookie').split(';')[0];
    await first.json();
    const request = (route, method = 'GET', value, session = cookie, extra = {}) =>
      fetch(base + route, {
        method,
        headers: {
          Cookie: session,
          'Content-Type': 'application/json',
          'X-Anacapa-Client': '1',
          ...extra,
        },
        ...(value !== undefined ? { body: JSON.stringify(value) } : {}),
      });
    let response = await request('/api/cases', 'POST', {
      mode: 'simple',
      title: 'Fictional simple case',
      parentFolder: directory,
    });
    assert.equal(response.status, 200);
    let state = await response.json();
    const id = state.workspace.activeCase,
      route = '/api/cases/' + id;
    assert.equal(state.workspace.cases.find((c) => c.id === id).controls, 'simple');
    assert.equal(state.workspace.cases.find((c) => c.id === id).security.mode, 'normal');
    const receipt = await (await request(route + '/verify', 'POST', {})).json();
    assert.ok(receipt.checkpoint.signature);
    assert.equal((await request(route + '/compare-checkpoint', 'POST', receipt)).status, 200);
    for (const bad of [
      null,
      {},
      { checkpoint: { ...receipt.checkpoint, signature: 'invalid' } },
      { checkpoint: { ...receipt.checkpoint, sequence: 0 } },
    ])
      assert.equal((await request(route + '/compare-checkpoint', 'POST', bad)).status, 409);
    assert.equal((await request(route + '/compare-checkpoint', 'GET')).status, 405);
    assert.equal(
      (await request(route + '/verify', 'POST', {}, cookie, { Origin: 'https://example.com' }))
        .status,
      403,
    );
    const policy = {
      owner: 'Fictional team',
      reference: 'Test procedure',
      reviewDate: '2026-12-01',
      backupDays: 3,
      legalHold: true,
      handlingNotes: 'Keep approved independent backups.',
    };
    const beforeInvalid = await (await request(route + '/history')).json();
    for (const bad of [null, false, 0, [], ['invalid']])
      assert.equal((await request(route + '/handling', 'POST', bad)).status, 400);
    for (const readOnly of ['history', 'readiness'])
      assert.equal((await request(route + '/' + readOnly, 'POST', {})).status, 405);
    assert.equal((await (await request(route + '/history')).json()).total, beforeInvalid.total);
    assert.equal(
      (await request(route + '/handling', 'POST', { ...policy, reviewDate: '2026-02-30' })).status,
      400,
    );
    response = await request(route + '/handling', 'POST', policy);
    assert.equal(response.status, 200);
    state = await response.json();
    assert.equal((await (await request(route + '/handling')).json()).policy.owner, policy.owner);
    const review = await (await request(route + '/readiness')).json();
    assert.equal(review.controls, 'simple');
    assert.equal(review.integrity, 'passed');
    assert.equal(review.backupDue, true);
    assert.equal(review.externalReview.agencyApproval, 'not established by this app');
    const moved = path.join(directory, 'independent-checkpoints');
    await mkdir(moved);
    response = await request(route + '/checkpoint', 'POST', { parentFolder: moved });
    assert.equal(response.status, 200);
    state = await response.json();
    assert.ok(
      state.workspace.cases
        .find((c) => c.id === id)
        .security.checkpointFolder.startsWith(await realpath(moved)),
    );
    state.workspace.cases.find((c) => c.id === id).description = 'Expected save';
    const save = request('/api/workspace', 'PUT', state);
    const parallelRead = request(route + '/readiness');
    assert.equal((await save).status, 200);
    assert.equal((await parallelRead).status, 200);
    assert.equal((await request(route + '/compare-checkpoint', 'POST', receipt)).status, 200);
    const password = 'fictional security passphrase';
    response = await request('/api/cases', 'POST', {
      mode: 'advanced',
      title: 'Fictional protected case',
      parentFolder: directory,
      username: 'admin',
      password,
    });
    state = await response.json();
    const secure = '/api/cases/' + state.workspace.activeCase;
    assert.equal(
      (await request(secure + '/users', 'POST', { username: 'reader', role: 'viewer', password }))
        .status,
      200,
    );
    const guest = await request('/api/workspace', 'GET', undefined, '');
    const otherCookie = guest.headers.get('set-cookie').split(';')[0];
    await guest.json();
    assert.equal((await request(secure + '/readiness', 'GET', undefined, otherCookie)).status, 423);
    assert.equal(
      (await request(secure + '/unlock', 'POST', { username: 'reader', password }, otherCookie))
        .status,
      200,
    );
    for (const [action, body] of [
      ['handling', policy],
      ['checkpoint', { parentFolder: directory }],
      ['backup', { parentFolder: directory }],
    ])
      assert.equal((await request(secure + '/' + action, 'POST', body, otherCookie)).status, 403);
    assert.equal((await request(secure + '/handling', 'GET', undefined, otherCookie)).status, 200);
    assert.equal((await request(secure + '/readiness', 'GET', undefined, otherCookie)).status, 200);
    // Registry and private signing material must never be served as app assets.
    assert.ok(
      (
        await readFile(path.join(directory, 'registry', 'checkpoint-signing-key.pem'), 'utf8')
      ).includes('PRIVATE KEY'),
    );
    assert.equal((await request('/.anacapa-data/checkpoint-signing-key.pem')).status, 404);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
