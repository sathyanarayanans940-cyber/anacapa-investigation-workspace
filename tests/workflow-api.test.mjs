import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { Script } from 'node:vm';
import { startServer } from '../runtime/server.mjs';
import { sample } from '../lib/case-data.ts';
import { createInvestigationViewer } from '../lib/investigation-viewer.ts';
import { commonLinks } from '../lib/relationships.ts';

for (const mode of ['simple', 'normal', 'advanced'])
  test(`${mode} API workflow preserves nested evidence, original bytes, cross-branch links, sharing, and restored revisions`, async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'anacapa-workflow-'));
    let server;
    try {
      const dataDirectory = path.join(directory, 'registry'),
        password = 'fictional test case passphrase';
      server = startServer({ port: 0, dataDirectory });
      await once(server, 'listening');
      let base = `http://127.0.0.1:${server.address().port}`;
      const first = await fetch(base + '/api/workspace'),
        cookie = first.headers.get('set-cookie').split(';')[0];
      await first.json();
      const request = (route, method = 'GET', body) =>
        fetch(base + route, {
          method,
          headers: { Cookie: cookie, 'Content-Type': 'application/json', 'X-Anacapa-Client': '1' },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });
      const read = () => request('/api/workspace').then((r) => r.json());
      let response = await request('/api/cases', 'POST', {
        mode,
        title: 'Fictional workflow ' + mode,
        parentFolder: directory,
        username: 'operator',
        password,
      });
      assert.equal(response.status, 200);
      let state = await response.json();
      const id = state.workspace.activeCase,
        route = '/api/cases/' + id;
      const bytes = Buffer.from('Fictional exhibit: café, Ελληνικά, 日本語.');
      const form = new FormData();
      form.set('caseId', id);
      form.set('file', new File([bytes], "Exhibit's α.txt", { type: 'text/plain' }));
      response = await fetch(base + '/api/files', {
        method: 'POST',
        headers: { Cookie: cookie, 'X-Anacapa-Client': '1' },
        body: form,
      });
      assert.equal(response.status, 200);
      const original = await response.json();
      state = await read();
      const file = state.workspace.cases.find((c) => c.id === id),
        source = structuredClone(sample.cases[0]);
      file.nodes = source.nodes;
      file.threads = source.threads;
      const arrival = file.nodes.find((n) => n.id === 'arrival'),
        check = file.nodes.find((n) => n.id === 'check');
      arrival.fields = [{ id: 'reference-a', label: 'Container ID', value: 'HBR-2048' }];
      check.fields = [{ id: 'reference-b', label: 'Container ID', value: 'HBR-2048' }];
      check.images = [original];
      arrival.images = [{ ...original }];
      check.customKind = 'Interview';
      check.date = '2026-10-11T14:30';
      check.utcOffset = '+05:30';
      check.timePrecision = 'approximate';
      check.originalTimestamp = 'Source says about 2:30 PM';
      check.citations = [
        {
          id: 'source-1',
          source: 'Fictional register',
          reference: 'Exhibit 04',
          locator: 'Page 2',
          claim: 'Links the shared container',
          collectedBy: 'Tutorial operator',
          collectedAt: '2026-10-11',
          method: 'Copied original',
          url: '',
        },
      ];
      assert.ok(
        commonLinks(file.nodes, file.threads).some(
          (v) =>
            new Set([v.source, v.target]).has('arrival') &&
            new Set([v.source, v.target]).has('check'),
        ),
      );
      file.threads.push({
        id: 'cross-branch',
        source: 'arrival',
        target: 'check',
        label: 'shares Container ID: HBR-2048',
        color: '#a58b70',
        dashed: true,
        labelOffset: { x: 80, y: -40 },
        citations: check.citations,
      });
      arrival.rotation = -7;
      check.timelineSide = 'above';
      check.timelineStyle = 'note';
      response = await request('/api/workspace', 'PUT', {
        ...state,
        reason: 'Record fictional linked evidence',
      });
      assert.equal(response.status, 200);
      state = await read();
      const saved = structuredClone(state.workspace.cases.find((c) => c.id === id));
      assert.equal(saved.controls, mode === 'simple' ? 'simple' : 'full');
      response = await request(route + '/verify', 'POST', {});
      assert.equal(response.status, 200);
      const receipt = await response.json();
      assert.equal(receipt.assets.length, 1);
      // Removing a parent alone must not silently discard its children or links.
      const broken = structuredClone(state);
      broken.workspace.cases.find((c) => c.id === id).nodes = broken.workspace.cases
        .find((c) => c.id === id)
        .nodes.filter((n) => n.id !== 'delivery');
      assert.equal(
        (
          await request('/api/workspace', 'PUT', {
            ...broken,
            reason: 'Attempt a malformed test edit',
          })
        ).status,
        400,
      );
      assert.equal((await read()).revision, state.revision);
      const changed = structuredClone(state),
        leaf = changed.workspace.cases.find((c) => c.id === id);
      leaf.nodes = leaf.nodes.filter((n) => n.id !== 'check');
      leaf.threads = leaf.threads.filter((t) => t.source !== 'check' && t.target !== 'check');
      assert.equal(
        (
          await request('/api/workspace', 'PUT', {
            ...changed,
            reason: 'Remove a fictional leaf temporarily',
          })
        ).status,
        200,
      );
      response = await request(route + '/restore', 'POST', {
        sequence: receipt.sequence,
        reason: 'Restore the complete fictional branch',
      });
      assert.equal(response.status, 200);
      state = await response.json();
      assert.deepEqual(state.workspace.cases.find((c) => c.id === id).nodes, saved.nodes);
      const custody = {
        from: 'Fictional collector',
        to: 'Fictional reviewer',
        when: '2026-10-11 14:30 +05:30',
        method: 'Offline test drive',
        note: 'Review the fictional exhibit',
      };
      assert.equal((await request(route + '/custody', 'POST', custody)).status, 200);
      response = await request(route + '/export', 'POST', mode === 'advanced' ? { password } : {});
      assert.equal(response.status, 200);
      const shared = await response.json();
      let bundle = shared.bundle;
      if (mode === 'advanced') {
        assert.equal(shared.protected, true);
        assert.ok(!JSON.stringify(shared).includes(custody.from));
        const decrypted = await request('/api/packages/decrypt', 'POST', {
          envelope: bundle,
          password,
        });
        assert.equal(decrypted.status, 200);
        bundle = (await decrypted.json()).bundle;
      }
      assert.equal(bundle.investigation.security, undefined);
      assert.equal(bundle.assets.length, 1);
      assert.equal(bundle.custody[0].from, custody.from);
      assert.deepEqual(bundle.investigation.nodes, saved.nodes);
      assert.deepEqual(bundle.investigation.threads, saved.threads);
      const html = createInvestigationViewer(bundle);
      assert.doesNotThrow(() => new Script(html.match(/<script>(.*?)<\/script>/s)[1]));
      assert.ok(!/<script[^>]+src=/.test(html));
      response = await request('/api/cases', 'POST', {
        mode: 'simple',
        title: 'Recipient fictional copy',
        parentFolder: directory,
        importBundle: bundle,
      });
      assert.equal(response.status, 200);
      const imported = await response.json(),
        recipient = imported.workspace.cases.find((c) => c.id === imported.workspace.activeCase);
      assert.notEqual(recipient.id, id);
      assert.deepEqual(recipient.threads, saved.threads);
      assert.deepEqual(
        recipient.nodes.map((n) => [n.id, n.parentId]),
        saved.nodes.map((n) => [n.id, n.parentId]),
      );
      const copiedOriginal = recipient.nodes.find((n) => n.id === 'check').images[0];
      assert.notEqual(copiedOriginal.url, original.url);
      assert.deepEqual(Buffer.from(await (await request(copiedOriginal.url)).arrayBuffer()), bytes);
      assert.equal(
        (await (await request('/api/cases/' + recipient.id + '/history')).json()).custody[0].from,
        custody.from,
      );
      await new Promise((resolve) => server.close(resolve));
      server = startServer({ port: 0, dataDirectory });
      await once(server, 'listening');
      base = `http://127.0.0.1:${server.address().port}`;
      state = await read();
      const restarted = state.workspace.cases.find((c) => c.id === id);
      if (mode === 'advanced') {
        assert.equal(restarted.security.locked, true);
        assert.equal((await request(original.url)).status, 423);
        assert.equal(
          (await request(route + '/unlock', 'POST', { username: 'operator', password })).status,
          200,
        );
      } else assert.deepEqual(restarted.nodes, saved.nodes);
      assert.deepEqual(Buffer.from(await (await request(original.url)).arrayBuffer()), bytes);
      assert.equal((await request(route + '/verify', 'POST', {})).status, 200);
    } finally {
      if (server) await new Promise((resolve) => server.close(resolve));
      await rm(directory, { recursive: true, force: true });
    }
  });
