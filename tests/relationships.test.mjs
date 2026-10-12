import test from 'node:test';
import assert from 'node:assert/strict';
import { sample } from '../lib/case-data.ts';
import {
  branchPath,
  crossBranchLinks,
  crossBranchCounts,
  commonLinks,
} from '../lib/relationships.ts';
import { workspaceSchema } from '../lib/validation.ts';
import {
  packInvestigation,
  parseInvestigationPackage,
  restoreInvestigation,
} from '../lib/investigation-package.ts';
function fixture() {
  const f = structuredClone(sample.cases[0]);
  const a = f.nodes.find((n) => n.id === 'arrival'),
    b = f.nodes.find((n) => n.id === 'check');
  a.fields = [
    { id: 'phone-a', label: 'Phone', value: '+1 (202) 555-0199' },
    { id: 'container-a', label: 'Container ID', value: 'HBR-2048' },
  ];
  b.fields = [
    { id: 'phone-b', label: 'Mobile number', value: '1 202 555 0199' },
    { id: 'container-b', label: 'Container ID', value: 'HBR-2048' },
  ];
  return f;
}
test('shared fields find cross-branch pairs and collect more than one common detail', () => {
  const f = fixture();
  const m = commonLinks(f.nodes, f.threads).find(
    (m) =>
      new Set([m.source, m.target]).has('arrival') && new Set([m.source, m.target]).has('check'),
  );
  assert.ok(m);
  assert.equal(m.matches.length, 2);
  assert.equal(
    branchPath(f.nodes, 'unload'),
    'Case timeline / The midnight delivery / Container unloaded',
  );
});
test('shared details ignore blank values, mismatched labels, same-branch pairs and existing reverse links', () => {
  const f = fixture();
  const a = f.nodes.find((n) => n.id === 'arrival'),
    b = f.nodes.find((n) => n.id === 'check');
  b.parentId = a.parentId;
  assert.equal(
    commonLinks(f.nodes, f.threads).some(
      (m) => [m.source, m.target].includes('check') && [m.source, m.target].includes('arrival'),
    ),
    false,
  );
  b.parentId = 'unload';
  f.threads.push({
    id: 'cross',
    source: 'check',
    target: 'arrival',
    label: 'shares container',
    color: '#a58b70',
    dashed: true,
  });
  assert.equal(
    commonLinks(f.nodes, f.threads).some(
      (m) => [m.source, m.target].includes('check') && [m.source, m.target].includes('arrival'),
    ),
    false,
  );
  a.fields = [
    { id: 'a', label: 'Account', value: '1234' },
    { id: 'empty', label: 'Reference', value: ' ' },
  ];
  b.fields = [
    { id: 'b', label: 'Phone', value: '1234' },
    { id: 'blank', label: 'Reference', value: '' },
  ];
  assert.equal(
    commonLinks(f.nodes, []).some(
      (m) => [m.source, m.target].includes('check') && [m.source, m.target].includes('arrival'),
    ),
    false,
  );
});
test('URL paths stay case sensitive and phone country codes are never guessed', () => {
  const f = fixture(),
    a = f.nodes.find((n) => n.id === 'arrival'),
    b = f.nodes.find((n) => n.id === 'check');
  a.fields = [
    { id: 'a', label: 'Website', value: 'https://EXAMPLE.com/Case' },
    { id: 'p', label: 'Phone', value: '+1 202 555 0199' },
  ];
  b.fields = [
    { id: 'b', label: 'URL', value: 'https://example.com/case' },
    { id: 'q', label: 'Phone', value: '202 555 0199' },
  ];
  assert.equal(commonLinks([a, b], []).length, 0);
  b.fields[0].value = 'https://example.com/Case';
  assert.equal(commonLinks([a, b], []).length, 1);
});
test('shared tags are deduplicated and suggestions respect their limit', () => {
  const f = fixture(),
    a = f.nodes.find((n) => n.id === 'arrival'),
    b = f.nodes.find((n) => n.id === 'check');
  a.fields = [];
  b.fields = [];
  a.tags = ['Harbor', 'harbor'];
  b.tags = [' HARBOR '];
  assert.equal(commonLinks([a, b], [])[0].matches.length, 1);
  assert.equal(commonLinks(f.nodes, [], 1).length, 1);
  assert.deepEqual(commonLinks(f.nodes, [], 0), []);
});
test('outside-link badges count both endpoints without counting same-branch links', () => {
  const f = fixture();
  f.threads.push({
    id: 'cross',
    source: 'arrival',
    target: 'check',
    label: 'shared reference',
    color: '#a58b70',
    dashed: true,
  });
  const counts = crossBranchCounts(f.nodes, f.threads);
  assert.equal(counts.get('arrival'), 1);
  assert.equal(counts.get('check'), 1);
  assert.equal(counts.get('delivery'), undefined);
});
test('cross-timeline relationships survive save, editable sharing, and restore without reparenting nodes', async () => {
  const f = fixture();
  f.threads.push({
    id: 'cross',
    source: 'arrival',
    target: 'check',
    label: 'shares Container ID: HBR-2048',
    color: '#a58b70',
    dashed: true,
  });
  const w = workspaceSchema.parse({ activeCase: f.id, cases: [f] });
  assert.deepEqual(
    crossBranchLinks(f.nodes, f.threads, 'arrival').map((t) => t.id),
    ['cross'],
  );
  const bundle = parseInvestigationPackage(
    JSON.parse(JSON.stringify(await packInvestigation(w.cases[0], async () => new Uint8Array()))),
  );
  const copy = restoreInvestigation(bundle, 'copy', new Map());
  assert.equal(copy.threads.at(-1).target, 'check');
  assert.equal(copy.nodes.find((n) => n.id === 'arrival').parentId, 'delivery');
  assert.equal(copy.nodes.find((n) => n.id === 'check').parentId, 'unload');
});
test('indexed paths retain complete ancestry at the maximum supported depth', () => {
  const nodes = Array.from({ length: 3000 }, (_, i) => ({
    ...sample.cases[0].nodes[0],
    id: 'n-' + i,
    title: 'Event ' + i,
    parentId: i ? 'n-' + (i - 1) : null,
  }));
  const index = new Map(nodes.map((n) => [n.id, n]));
  const start = performance.now();
  let length = 0;
  for (const n of nodes) length += branchPath(index, n.parentId).length;
  assert.ok(length > 1000000);
  assert.ok(performance.now() - start < 3000, 'Indexed path searches must not freeze for seconds');
  const full = branchPath(index, 'n-2999');
  assert.ok(full.startsWith('Case timeline / Event 0 / Event 1'));
  assert.ok(full.endsWith('Event 2998 / Event 2999'));
});
