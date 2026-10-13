import type { Evidence } from './case-data.ts';

/** A custom name keeps the same muted hue across cases, themes, and portable viewers. */
export function cardTypeTone(node: Pick<Evidence, 'kind' | 'customKind'>) {
  if (!node.customKind) return { type: node.kind.toLowerCase(), hue: 0, saturation: 0, lift: 0 };
  const name = node.customKind.normalize('NFKC').trim().toLowerCase();
  let hash = 2166136261;
  for (let i = 0; i < name.length; i++) hash = Math.imul(hash ^ name.charCodeAt(i), 16777619) >>> 0;
  return {
    type: 'custom',
    hue: hash % 360,
    saturation: 22 + ((hash >>> 16) % 7),
    lift: ((hash >>> 24) % 4) / 2,
  };
}
