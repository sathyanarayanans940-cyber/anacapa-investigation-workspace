import test from 'node:test';
import assert from 'node:assert/strict';
import { compareEvents, evidenceChanged, shareSelection } from '../lib/provenance.ts';
import { sample } from '../lib/case-data.ts';
import { packInvestigation, parseInvestigationPackage } from '../lib/investigation-package.ts';
import { createInvestigationViewer } from '../lib/investigation-viewer.ts';
import { sealPackage, openPackage } from '../runtime/crypto.mjs';
import { Script } from 'node:vm';
test('chronology uses explicit UTC offsets and keeps source precision without changing dates', () => {
  const early = { date: '2026-10-10T14:00', utcOffset: '+05:30', title: 'Early' },
    late = { date: '2026-10-10T10:00', utcOffset: '+00:00', title: 'Late' };
  assert.ok(compareEvents(early, late) < 0);
  assert.equal(early.date, '2026-10-10T14:00');
});
test('layout edits do not require an evidence reason, while citations, links and time do', () => {
  const a = structuredClone(sample.cases[0]),
    b = structuredClone(a);
  b.nodes[0].x += 20;
  b.nodes[0].rotation = 3;
  b.nodes[0].boardSize = { width: 180, height: 120 };
  b.threads[0].style = 'spring';
  assert.equal(evidenceChanged(a, b), false);
  b.threads[0].dashed = true;
  assert.equal(evidenceChanged(a, b), true);
  b.threads[0].dashed = a.threads[0].dashed;
  b.nodes[0].date = '2026-10-10T12:00';
  assert.equal(evidenceChanged(a, b), true);
});
test('selected exports remove private fields, orphan parents and dangling connections', () => {
  const file = structuredClone(sample.cases[0]);
  file.security = { mode: 'advanced', managed: true, locked: false, folder: '/private/secret' };
  const n = file.nodes.find((n) => n.parentId);
  n.fields = [{ id: 'secret', label: 'Private phone', value: 'secret value', type: 'text' }];
  n.titleField = 'secret';
  const result = shareSelection(file, new Set([n.id]), new Set(['secret']));
  assert.equal(result.nodes[0].parentId, null);
  assert.equal(result.nodes[0].titleField, 'title');
  assert.equal(result.threads.length, 0);
  assert.equal(result.security, undefined);
  assert.ok(!JSON.stringify(result).includes('secret value'));
});
test('protected HTML contains only encrypted evidence and uses compatible authenticated crypto', async () => {
  const file = structuredClone(sample.cases[0]);
  file.title = 'Secret fictional case';
  file.security = { mode: 'advanced', managed: true, locked: false, folder: '/private/secret' };
  file.nodes.forEach((n) => (n.images = []));
  file.nodes[0].citations = [
    {
      id: 'source',
      source: 'Camera exhibit',
      reference: 'EX-01',
      locator: '00:04',
      claim: 'Vehicle arrival',
      collectedBy: 'Analyst',
      collectedAt: '2026-10-10 +00:00',
      method: 'Preserved recording',
      url: '',
    },
  ];
  const bundle = await packInvestigation(file, async () => new Uint8Array());
  assert.equal(
    parseInvestigationPackage(bundle).investigation.nodes[0].citations[0].reference,
    'EX-01',
  );
  assert.equal(bundle.investigation.security, undefined);
  const envelope = await sealPackage(bundle, 'fictional sharing passphrase');
  const html = createInvestigationViewer(envelope);
  assert.ok(!html.includes(file.title));
  assert.ok(!html.includes('Camera exhibit'));
  assert.ok(!html.includes('/private/secret'));
  const scripts = [...html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g)];
  new Script(scripts.at(-1)[1]);
  const salt = Uint8Array.from(Buffer.from(envelope.salt, 'base64')),
    iv = Uint8Array.from(Buffer.from(envelope.iv, 'base64'));
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode('fictional sharing passphrase'),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
  const plain = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: new TextEncoder().encode('anacapa-portable-v1'),
      tagLength: 128,
    },
    key,
    Buffer.from(envelope.data, 'base64'),
  );
  assert.equal(JSON.parse(new TextDecoder().decode(plain)).investigation.title, file.title);
  await assert.rejects(openPackage(envelope, 'different passphrase'));
});
