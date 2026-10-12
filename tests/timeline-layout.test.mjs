import test from 'node:test';
import assert from 'node:assert/strict';
import { sample } from '../lib/case-data.ts';
import { timelinePresentation } from '../lib/timeline-layout.ts';
import { workspaceSchema } from '../lib/validation.ts';
import { packInvestigation, restoreInvestigation } from '../lib/investigation-package.ts';

test('existing investigations get a staggered timeline without modifying evidence', () => {
  const before = structuredClone(sample),
    file = sample.cases[0],
    items = file.nodes
      .filter((n) => n.parentId === null)
      .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  assert.deepEqual(
    items.map((n, i) => timelinePresentation(n, i).side),
    ['above', 'below', 'above', 'below', 'above', 'below'],
  );
  assert.equal(timelinePresentation(items[0], 0).style, 'compact');
  assert.equal(
    timelinePresentation(
      file.nodes.find((n) => n.kind === 'Note'),
      0,
    ).style,
    'note',
  );
  assert.deepEqual(sample, before);
});
test('arrangements survive saving and sharing independently of board position and chronology', async () => {
  const workspace = structuredClone(sample),
    n = workspace.cases[0].nodes[0];
  n.timelineSide = 'above';
  n.timelineStyle = 'note';
  const saved = workspaceSchema.parse(workspace),
    bundle = await packInvestigation(saved.cases[0], async () => {
      throw Error('No files expected');
    });
  const restored = restoreInvestigation(bundle, 'shared-case', new Map()),
    copy = restored.nodes.find((x) => x.id === n.id);
  assert.deepEqual(timelinePresentation(copy, 1), { side: 'above', style: 'note' });
  assert.deepEqual([copy.date, copy.parentId, copy.x, copy.y], [n.date, n.parentId, n.x, n.y]);
  for (const invalid of [{ timelineSide: 'left' }, { timelineStyle: 'poster' }]) {
    const bad = structuredClone(workspace);
    Object.assign(bad.cases[0].nodes[0], invalid);
    assert.equal(workspaceSchema.safeParse(bad).success, false);
  }
});
