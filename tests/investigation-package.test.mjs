import test from 'node:test';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { sample } from '../lib/case-data.ts';
import {
  packInvestigation,
  parseInvestigationPackage,
  base64ToBytes,
  packageFilename,
  restoreInvestigation,
} from '../lib/investigation-package.ts';
import { createInvestigationViewer } from '../lib/investigation-viewer.ts';

test('a portable investigation includes each referenced attachment once and preserves nested evidence', async () => {
  const c = structuredClone(sample.cases[0]);
  const image = { url: '/api/files/demo-file', name: 'photo.png', type: 'image/png' };
  c.nodes[0].images = [image];
  c.nodes[1].images = [image];
  c.threads[0].labelOffset = { x: 40, y: -12 };
  let reads = 0;
  const bytes = new Uint8Array([0, 1, 127, 128, 255]);
  const bundle = await packInvestigation(c, async (url) => {
    assert.equal(url, image.url);
    reads++;
    return bytes;
  });
  const restored = parseInvestigationPackage(JSON.parse(JSON.stringify(bundle)));
  assert.equal(reads, 1);
  assert.equal(restored.assets.length, 1);
  assert.deepEqual(restored.investigation, c);
  assert.deepEqual(base64ToBytes(restored.assets[0].data), bytes);
});
test('missing files, duplicate assets, malformed bytes and broken hierarchy cannot import', async () => {
  const c = structuredClone(sample.cases[0]);
  c.nodes[0].images = [{ url: '/api/files/example', name: 'file', type: 'text/plain' }];
  const valid = await packInvestigation(c, async () => new Uint8Array([10]));
  for (const change of [
    (b) => (b.assets = []),
    (b) => b.assets.push(b.assets[0]),
    (b) => (b.assets[0].data = 'javascript:alert(1)'),
    (b) => (b.investigation.nodes[0].parentId = 'absent'),
  ]) {
    const b = structuredClone(valid);
    change(b);
    assert.throws(() => parseInvestigationPackage(b));
  }
});
test('shareable HTML safely contains hostile evidence text and is fully self contained', async () => {
  const c = structuredClone(sample.cases[0]);
  const hostile = '</script><script>alert("injected")</script>';
  c.nodes[0].title = hostile;
  c.nodes[0].summary = '<img src=x onerror=alert(1)>';
  const bundle = await packInvestigation(c, async () => new Uint8Array());
  const html = createInvestigationViewer(bundle);
  const viewerScript = html.match(/<script>(.*?)<\/script>/s)[1];
  assert.doesNotThrow(() => new Script(viewerScript));
  assert.ok(!html.includes(hostile));
  const json = html.match(
    /<script id="investigation-data" type="application\/json">(.*?)<\/script>/s,
  )[1];
  assert.equal(JSON.parse(json).investigation.nodes[0].title, hostile);
  assert.match(html, /connect-src/);
  assert.ok(!/<script[^>]+src=/.test(html));
  assert.equal(packageFilename('../A case?', '\.anacapa'), 'A-case.anacapa');
});

test('opening a case copies attachment references without changing its hierarchy or original package', async () => {
  const c = structuredClone(sample.cases[0]);
  c.nodes[0].images = [{ url: '/api/files/original', name: 'evidence.txt', type: 'text/plain' }];
  const bundle = await packInvestigation(c, async () => new Uint8Array([97]));
  const restored = restoreInvestigation(
    bundle,
    'recipient-case',
    new Map([['/api/files/original', '/api/files/recipient-copy']]),
  );
  assert.equal(restored.id, 'recipient-case');
  assert.equal(restored.nodes[0].images[0].url, '/api/files/recipient-copy');
  assert.equal(bundle.investigation.nodes[0].images[0].url, '/api/files/original');
  assert.deepEqual(
    restored.nodes.map((n) => [n.id, n.parentId]),
    c.nodes.map((n) => [n.id, n.parentId]),
  );
  assert.deepEqual(restored.threads, c.threads);
  assert.throws(() => restoreInvestigation(bundle, 'recipient-case', new Map()));
});
test('portable filenames avoid Windows reserved devices and trailing dots', () => {
  for (const name of ['CON', 'con.txt', 'PRN', 'AUX', 'NUL', 'COM1', 'LPT9', 'LPT¹'])
    assert.match(packageFilename(name, '.anacapa'), /^Case-/);
  assert.equal(packageFilename('Evidence...', '.html'), 'Evidence.html');
  assert.equal(packageFilename('Control sample', '.anacapa'), 'Control-sample.anacapa');
});
