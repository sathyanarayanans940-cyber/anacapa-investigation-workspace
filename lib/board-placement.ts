import { titleOf, type Evidence } from './case-data.ts';

export type CardBounds = { x: number; y: number; width: number; height: number };

// Use measured cards when available; unopened branches need a conservative estimate.
export function cardSize(node: Evidence) {
  const width = node.pinned ? 270 : node.kind === 'Note' ? 245 : 248;
  const lines = (text: string, columns: number) =>
    text.split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / columns)), 0);
  const picture = node.images.some((i) =>
    ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(i.type),
  );
  const height =
    110 +
    lines(titleOf(node), 20) * 28 +
    (node.summary ? lines(node.summary.slice(0, 115), 28) * 22 : 0) +
    (node.fields.length ? 34 : 0) +
    (picture ? 132 : 0) +
    Math.ceil(node.tags.slice(0, 3).join(' · ').length / 28) * 16;
  return { width, height };
}

export function cardBounds(node: Evidence, size = cardSize(node)): CardBounds {
  const angle = ((node.rotation ?? (node.kind === 'Note' ? -2 : 0)) * Math.PI) / 180;
  const width = Math.abs(size.width * Math.cos(angle)) + Math.abs(size.height * Math.sin(angle));
  const height = Math.abs(size.height * Math.cos(angle)) + Math.abs(size.width * Math.sin(angle));
  return {
    x: node.x + (size.width - width) / 2,
    y: node.y + (size.height - height) / 2,
    width,
    height,
  };
}

/** Find a free gap without rearranging the user's existing cards. */
export function findBoardSpace(
  occupied: CardBounds[],
  preferred: { x: number; y: number },
  size: { width: number; height: number },
  right = preferred.x + 1000,
) {
  const gap = 24,
    ordered = [...occupied].sort((a, b) => a.x - b.x);
  const startX = Math.max(70, Math.min(99000, preferred.x)),
    startY = Math.max(70, Math.min(99000, preferred.y));
  const scan = (limit: number) => {
    let y = startY;
    for (let row = 0; row <= ordered.length && y <= 100000 - size.height; row++) {
      const blockers = ordered.filter(
        (r) => r.y - gap < y + size.height && r.y + r.height + gap > y,
      );
      let x = startX;
      for (const r of blockers) {
        if (r.x + r.width + gap <= x) continue;
        if (r.x - gap >= x + size.width) break;
        x = Math.max(x, r.x + r.width + gap);
      }
      if (x + size.width <= limit) return { x, y };
      const next = Math.min(
        ...blockers.map((r) => r.y + r.height + gap).filter((bottom) => bottom > y),
      );
      if (!Number.isFinite(next)) break;
      y = next;
    }
  };
  return (
    scan(Math.max(startX + size.width, Math.min(100000, right))) ??
    scan(100000) ?? { x: startX, y: startY }
  );
}
