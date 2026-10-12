import test from 'node:test';
import assert from 'node:assert/strict';
import { workspaceSchema } from '../lib/validation.ts';
import { sample, descendants, titleOf } from '../lib/case-data.ts';
test('sample workspace is valid', () =>
  assert.equal(workspaceSchema.safeParse(sample).success, true));
test('recursive branches include every nested item', () =>
  assert.deepEqual(descendants(sample.cases[0].nodes, 'delivery'), ['arrival', 'unload', 'check']));
test('custom headline uses the selected detail', () => {
  const n = structuredClone(sample.cases[0].nodes[1]);
  n.titleField = 'phone';
  assert.equal(titleOf(n), '+1 (202) 555-0142');
});
test('cyclic and missing parents are rejected', () => {
  const w = structuredClone(sample);
  w.cases[0].nodes[0].parentId = 'check';
  assert.equal(workspaceSchema.safeParse(w).success, false);
  w.cases[0].nodes[0].parentId = 'absent';
  assert.equal(workspaceSchema.safeParse(w).success, false);
});
test('dangling threads and unsafe attachment URLs are rejected', () => {
  const w = structuredClone(sample);
  w.cases[0].threads[0].target = 'absent';
  assert.equal(workspaceSchema.safeParse(w).success, false);
  const f = structuredClone(sample);
  f.cases[0].nodes[0].images = [{ url: 'javascript:alert(1)', name: 'bad', type: 'image/png' }];
  assert.equal(workspaceSchema.safeParse(f).success, false);
});
test('gentle card rotation survives validation and rejects unsafe angles', () => {
  const w = structuredClone(sample);
  w.cases[0].nodes[0].rotation = -7;
  assert.equal(workspaceSchema.parse(w).cases[0].nodes[0].rotation, -7);
  for (const rotation of [16, -16, Infinity, NaN]) {
    w.cases[0].nodes[0].rotation = rotation;
    assert.equal(workspaceSchema.safeParse(w).success, false);
  }
});
test('relationship label offsets survive save/export validation, and legacy threads still load', () => {
  const w = structuredClone(sample);
  w.cases[0].threads[2].labelOffset = { x: 43.25, y: -61 };
  const saved = workspaceSchema.parse(JSON.parse(JSON.stringify(w)));
  assert.deepEqual(saved.cases[0].threads[2].labelOffset, { x: 43.25, y: -61 });
  assert.equal(saved.cases[0].threads[0].labelOffset, undefined);
  for (const x of [Infinity, NaN, 100001]) {
    w.cases[0].threads[2].labelOffset.x = x;
    assert.equal(workspaceSchema.safeParse(w).success, false);
  }
});

test('duplicate connection and citation IDs cannot create ambiguous edit or delete targets', () => {
  const w = structuredClone(sample);
  w.cases[0].threads[1].id = w.cases[0].threads[0].id;
  assert.equal(workspaceSchema.safeParse(w).success, false);
  const citation = {
    id: 'source',
    source: 'Gate log',
    reference: '',
    locator: '',
    claim: '',
    collectedBy: '',
    collectedAt: '',
    method: '',
    url: '',
  };
  const c = structuredClone(sample);
  c.cases[0].nodes[0].citations = [citation, { ...citation }];
  assert.equal(workspaceSchema.safeParse(c).success, false);
});
test('the full 3,000-event depth validates and traverses without repeated ancestor searches', () => {
  const w = structuredClone(sample);
  w.cases[0].threads = [];
  w.cases[0].nodes = Array.from({ length: 3000 }, (_, i) => ({
    ...sample.cases[0].nodes[0],
    id: 'depth-' + i,
    parentId: i ? 'depth-' + (i - 1) : null,
    fields: [],
    images: [],
    tags: [],
  }));
  const start = performance.now();
  assert.equal(workspaceSchema.safeParse(w).success, true);
  assert.ok(performance.now() - start < 3000, 'Hierarchy validation must not freeze for seconds');
  assert.equal(descendants(w.cases[0].nodes, 'depth-0').length, 2999);
  w.cases[0].nodes[0].parentId = 'depth-2999';
  assert.equal(workspaceSchema.safeParse(w).success, false);
  w.cases[0].nodes[0].parentId = 'missing';
  assert.equal(workspaceSchema.safeParse(w).success, false);
  w.cases[0].nodes[0].parentId = null;
  w.cases[0].nodes.push({ ...w.cases[0].nodes[0], id: 'over-limit' });
  assert.equal(workspaceSchema.safeParse(w).success, false);
});
