import test from 'node:test';
import assert from 'node:assert/strict';
import { sample } from '../lib/case-data.ts';
import {
  boundedCardSize,
  compactCard,
  sizeCard,
  dragCardSize,
  cardAnchor,
  cardPreviewText,
  cardPreviewLines,
} from '../lib/card-size.ts';
import { cardBounds, cardSize } from '../lib/board-placement.ts';
import { threadLayout } from '../lib/thread-layout.ts';
import { workspaceSchema } from '../lib/validation.ts';
import {
  packInvestigation,
  parseInvestigationPackage,
  restoreInvestigation,
} from '../lib/investigation-package.ts';

const corner = (card) => {
  const angle = (card.rotation * Math.PI) / 180;
  return {
    x:
      card.x +
      card.width / 2 -
      (Math.cos(angle) * card.width) / 2 +
      (Math.sin(angle) * card.height) / 2,
    y:
      card.y +
      card.height / 2 -
      (Math.sin(angle) * card.width) / 2 -
      (Math.cos(angle) * card.height) / 2,
  };
};

test('large-card previews reveal more notes without rendering the entire maximum-length record', () => {
  const notes = 'Fictional long notes '.repeat(1000);
  const small = { width: 248, height: 200 },
    large = { width: 720, height: 640 };
  const short = cardPreviewText(notes, small.width, cardPreviewLines(small, 'Title', false, false));
  const long = cardPreviewText(notes, large.width, cardPreviewLines(large, 'Title', false, false));
  assert.ok(long.length > short.length);
  assert.ok(long.length < 4000);
  assert.ok(notes.startsWith(long.slice(0, -1)));
  assert.equal(notes.length, 21000);
});

test('resizing honours zoom and rotation and keeps the opposite corner fixed', () => {
  for (const rotation of [-15, -2, 0, 15])
    for (const zoom of [0.2, 1, 2]) {
      const start = { x: 72, y: 100, width: 248, height: 250, rotation };
      const angle = (rotation * Math.PI) / 180;
      const next = dragCardSize(
        start,
        (80 * Math.cos(angle) - 60 * Math.sin(angle)) * zoom,
        (80 * Math.sin(angle) + 60 * Math.cos(angle)) * zoom,
        zoom,
      );
      assert.ok(Math.abs(next.boardSize.width - 328) < 1e-9);
      assert.ok(Math.abs(next.boardSize.height - 310) < 1e-9);
      const before = corner(start),
        after = corner({ ...next, ...next.boardSize, rotation });
      assert.ok(Math.abs(before.x - after.x) < 1e-9);
      assert.ok(Math.abs(before.y - after.y) < 1e-9);
    }
});

test('minimum/maximum sizes stop overshoot without moving an unrotated card', () => {
  const start = { x: 70, y: 80, width: 248, height: 250, rotation: 0 };
  assert.deepEqual(sizeCard(start, { width: -100, height: -100 }), {
    x: 70,
    y: 80,
    boardSize: { width: 160, height: 100 },
  });
  assert.deepEqual(boundedCardSize({ width: 10000, height: 10000 }), { width: 720, height: 640 });
  assert.equal(compactCard({ width: 160, height: 640 }), true);
  assert.equal(compactCard({ width: 720, height: 100 }), true);
  assert.equal(compactCard({ width: 248, height: 250 }), false);
});

test('case data accepts old automatic sizes and bounded custom sizes but rejects broken dimensions', () => {
  const workspace = structuredClone(sample);
  assert.ok(workspaceSchema.safeParse(workspace).success);
  workspace.cases[0].nodes[0].boardSize = { width: 160, height: 100 };
  assert.ok(workspaceSchema.safeParse(workspace).success);
  for (const bad of [
    { width: 159, height: 100 },
    { width: 721, height: 100 },
    { width: 248, height: 99 },
    { width: 248, height: 641 },
    { width: NaN, height: 100 },
    { width: Infinity, height: 100 },
    { width: 248 },
  ]) {
    workspace.cases[0].nodes[0].boardSize = bad;
    assert.equal(workspaceSchema.safeParse(workspace).success, false);
  }
});

test('placement and relationship paths use the individual resized card and preserve label offsets', () => {
  const file = structuredClone(sample.cases[0]);
  const node = file.nodes.find((n) => n.id === 'morgan');
  const thread = { ...file.threads[0], labelOffset: { x: 18, y: -24 } };
  const before = threadLayout(thread, file.nodes);
  node.boardSize = { width: 420, height: 340 };
  assert.deepEqual(cardSize(node), node.boardSize);
  assert.deepEqual(cardBounds(node), { x: node.x, y: node.y, ...node.boardSize });
  const anchor = cardAnchor(node),
    next = threadLayout(thread, file.nodes);
  assert.ok(next.path.startsWith(`M${anchor.x} ${anchor.y}`));
  assert.equal(next.labelX - next.x, 18);
  assert.equal(next.labelY - next.y, -24);
  assert.notEqual(next.path, before.path);
});

test('editable packages preserve sizes and evidence without imposing sizes on other cards', async () => {
  const file = structuredClone(sample.cases[0]);
  file.nodes[0].boardSize = { width: 180, height: 120 };
  file.nodes.find((n) => n.id === 'check').boardSize = { width: 420, height: 340 };
  const bundle = parseInvestigationPackage(
    await packInvestigation(file, async () => new Uint8Array()),
  );
  const restored = restoreInvestigation(bundle, 'new-recipient', new Map());
  assert.deepEqual(restored.nodes, file.nodes);
  assert.deepEqual(restored.threads, file.threads);
  assert.equal(restored.nodes[1].boardSize, undefined);
});
