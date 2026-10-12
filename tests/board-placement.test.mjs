import test from 'node:test';
import assert from 'node:assert/strict';
import { sample } from '../lib/case-data.ts';
import { cardBounds, cardSize, findBoardSpace } from '../lib/board-placement.ts';

test('new cards find free space while preserving manual positions and measured tall cards', () => {
  const nodes = structuredClone(sample.cases[0].nodes),
    before = structuredClone(nodes);
  const occupied = nodes
    .filter((n) => n.parentId === null)
    .map((n) => cardBounds(n, n.id === 'morgan' ? { width: 248, height: 520 } : undefined));
  const size = { width: 270, height: 320 },
    position = findBoardSpace(occupied, { x: 78, y: 100 }, size, 1000);
  const intersects = (r) =>
    position.x < r.x + r.width + 24 &&
    position.x + size.width > r.x - 24 &&
    position.y < r.y + r.height + 24 &&
    position.y + size.height > r.y - 24;
  assert.ok(occupied.every((r) => !intersects(r)));
  assert.deepEqual(nodes, before);
  assert.deepEqual(findBoardSpace([], { x: 120, y: 150 }, size), { x: 120, y: 150 });
  const siblings = [{ x: 70, y: 70, width: 900, height: 500 }];
  assert.deepEqual(findBoardSpace(siblings, { x: 70, y: 70 }, size, 970), { x: 70, y: 594 });
  const rotated = cardBounds({ ...nodes[0], rotation: 15 }, { width: 270, height: 320 });
  assert.ok(rotated.width > 270 && rotated.height > 320);
  assert.ok(
    cardSize({
      ...nodes[0],
      title: 'Long title '.repeat(15),
      summary: 'Detail '.repeat(20),
      images: [{ name: 'image', url: '/api/files/image', type: 'image/png' }],
    }).height > 320,
  );
});
