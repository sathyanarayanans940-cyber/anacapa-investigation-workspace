import type { Evidence, Thread } from './case-data.ts';
import { wirePath } from './connection-path.ts';

/** Offsets follow the relationship as its two cards move. */
export function threadLayout(thread: Thread, nodes: Evidence[] | ReadonlyMap<string, Evidence>) {
  const byId = Array.isArray(nodes) ? new Map(nodes.map((n) => [n.id, n])) : nodes;
  const a = byId.get(thread.source),
    b = byId.get(thread.target);
  if (!a || !b) return null;
  const sx = a.x + 118,
    sy = a.y + 82,
    tx = b.x + 118,
    ty = b.y + 82;
  const x = (sx + tx) / 2,
    y = (sy + ty) / 2;
  return {
    path: wirePath(sx, sy, tx, ty, thread.style),
    x,
    y,
    labelX: x + (thread.labelOffset?.x ?? 0),
    labelY: y + (thread.labelOffset?.y ?? 0),
  };
}
