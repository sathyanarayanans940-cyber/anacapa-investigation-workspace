import test from 'node:test';
import assert from 'node:assert/strict';
import { sample } from '../lib/case-data.ts';
import { sharingCopy } from '../lib/sharing-copy.ts';
import { packInvestigation } from '../lib/investigation-package.ts';
const options = {
  title: 'Recovery',
  omitDescription: false,
  omitNotes: false,
  omitAttachments: false,
  omitCitations: false,
};
test('a recovery copy includes unsaved nested evidence and omits local security credentials and paths', async () => {
  const file = structuredClone(sample.cases[0]);
  file.nodes[0].summary = 'Unsaved source correction';
  file.security = {
    mode: 'advanced',
    managed: true,
    locked: false,
    folder: '/private/case',
    role: 'admin',
    operator: 'analyst',
  };
  const copy = sharingCopy(file, new Set(file.nodes.map((n) => n.id)), new Set(), options);
  const bundle = await packInvestigation(copy, async () => {
    throw Error('unexpected asset');
  });
  assert.equal(bundle.investigation.nodes[0].summary, 'Unsaved source correction');
  assert.equal(bundle.investigation.security, undefined);
  assert.equal(bundle.investigation.nodes.find((n) => n.id === 'check').parentId, 'unload');
  assert.equal(file.security.folder, '/private/case');
});
test('recovery copy redactions remove sensitive fields, notes and related dangling links', () => {
  const file = structuredClone(sample.cases[0]);
  const copy = sharingCopy(file, new Set(['morgan']), new Set(['phone']), {
    ...options,
    omitNotes: true,
    omitDescription: true,
  });
  assert.equal(copy.nodes.length, 1);
  assert.equal(copy.nodes[0].summary, '');
  assert.equal(copy.description, '');
  assert.ok(!copy.nodes[0].fields.some((f) => f.id === 'phone'));
  assert.equal(copy.threads.length, 0);
  assert.ok(file.nodes[1].fields.some((f) => f.id === 'phone'));
});
