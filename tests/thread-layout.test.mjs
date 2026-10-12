import test from 'node:test';
import assert from 'node:assert/strict';
import { sample } from '../lib/case-data.ts';
import { threadLayout } from '../lib/thread-layout.ts';
import { wirePath, wireStyles } from '../lib/connection-path.ts';
import { workspaceSchema } from '../lib/validation.ts';

test('a placed label follows the relationship when either card moves', () => {
  const c = structuredClone(sample.cases[0]);
  const t = c.threads[2];
  t.labelOffset = { x: 55, y: -34 };
  const before = threadLayout(t, c.nodes);
  c.nodes.find((n) => n.id === t.target).x += 100;
  c.nodes.find((n) => n.id === t.target).y += 60;
  const after = threadLayout(t, c.nodes);
  assert.equal(after.labelX - before.labelX, 50);
  assert.equal(after.labelY - before.labelY, 30);
  assert.equal(after.labelX - after.x, 55);
  assert.equal(after.labelY - after.y, -34);
});
test('existing labels use the curve midpoint and missing endpoints render nothing', () => {
  const c = sample.cases[0];
  const layout = threadLayout(c.threads[0], c.nodes);
  assert.equal(layout.labelX, layout.x);
  assert.equal(layout.labelY, layout.y);
  assert.equal(threadLayout({ ...c.threads[0], target: 'missing' }, c.nodes), null);
});

test('all six styles are distinct and stay finite for reverse, vertical, coincident and short links', () => {
  assert.equal(wirePath(0, 0, 200, 100), 'M0 0 C100 0,100 100,200 100');
  assert.equal(new Set(wireStyles.map((style) => wirePath(0, 0, 200, 100, style))).size, 6);
  for (const style of wireStyles)
    for (const [sx, sy, tx, ty] of [
      [0, 0, 200, 100],
      [200, 100, 0, 0],
      [20, -40, 20, 260],
      [100, 30, -300, 30],
      [15, 20, 15, 20],
      [15, 20, 15.01, 20.01],
    ]) {
      const path = wirePath(sx, sy, tx, ty, style);
      assert.ok(path.startsWith(`M${sx} ${sy}`));
      assert.ok(path.endsWith(`${tx} ${ty}`));
      assert.doesNotMatch(path, /NaN|Infinity/);
      assert.ok([...path.matchAll(/-?\d+(?:\.\d+)?/g)].every((m) => Number.isFinite(Number(m[0]))));
    }
});

test('pattern complexity stays bounded on very long connections', () => {
  assert.ok((wirePath(-100000, -100000, 100000, 100000, 'spring').match(/C/g) || []).length <= 96);
  assert.ok((wirePath(-100000, -100000, 100000, 100000, 'wave').match(/Q/g) || []).length <= 48);
  assert.ok((wirePath(-100000, -100000, 100000, 100000, 'zigzag').match(/L/g) || []).length <= 51);
});

test('wire shapes follow moved cards while retaining their manually placed labels', () => {
  for (const style of wireStyles) {
    const file = structuredClone(sample.cases[0]),
      thread = { ...file.threads[0], style, labelOffset: { x: 20, y: -30 } };
    const before = threadLayout(thread, file.nodes),
      target = file.nodes.find((n) => n.id === thread.target);
    target.x += 100;
    target.y += 60;
    const after = threadLayout(thread, file.nodes);
    assert.notEqual(before.path, after.path);
    assert.equal(after.labelX - before.labelX, 50);
    assert.equal(after.labelY - before.labelY, 30);
    assert.equal(after.labelX - after.x, 20);
    assert.equal(after.labelY - after.y, -30);
  }
});

test('old cases retain their curve and only supported wire styles can enter case data', () => {
  assert.ok(workspaceSchema.safeParse(sample).success);
  const file = structuredClone(sample);
  for (const style of wireStyles) {
    file.cases[0].threads[0].style = style;
    assert.equal(workspaceSchema.parse(file).cases[0].threads[0].style, style);
  }
  file.cases[0].threads[0].style = 'custom-script';
  assert.equal(workspaceSchema.safeParse(file).success, false);
});
