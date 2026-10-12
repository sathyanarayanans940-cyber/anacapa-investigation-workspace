import { titleOf, type Evidence, type Thread } from './case-data.ts';

export function branchPath(nodes: Evidence[] | ReadonlyMap<string, Evidence>, id: string | null) {
  const byId = Array.isArray(nodes) ? new Map(nodes.map((n) => [n.id, n])) : nodes;
  const path: string[] = [],
    seen = new Set<string>();
  while (id && !seen.has(id)) {
    seen.add(id);
    const n = byId.get(id);
    if (!n) break;
    path.push(titleOf(n));
    id = n.parentId;
  }
  return ['Case timeline', ...path.reverse()].join(' / ');
}
export function crossBranchLinks(nodes: Evidence[], threads: Thread[], id: string) {
  const node = nodes.find((n) => n.id === id);
  return node
    ? threads.filter((t) => {
        const other = nodes.find((n) => n.id === (t.source === id ? t.target : t.source));
        return (t.source === id || t.target === id) && other && other.parentId !== node.parentId;
      })
    : [];
}
export function crossBranchCounts(nodes: Evidence[], threads: Thread[]) {
  const parents = new Map(nodes.map((n) => [n.id, n.parentId])),
    counts = new Map<string, number>();
  for (const t of threads) {
    if (
      !parents.has(t.source) ||
      !parents.has(t.target) ||
      parents.get(t.source) === parents.get(t.target)
    )
      continue;
    counts.set(t.source, (counts.get(t.source) || 0) + 1);
    counts.set(t.target, (counts.get(t.target) || 0) + 1);
  }
  return counts;
}
const tidy = (s: string) => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
function fieldKey(label: string) {
  const key = tidy(label).replace(/[_.-]/g, ' ').replace(/\s+/g, ' ');
  if (/^(phone|phone number|telephone|telephone number|tel|mobile|mobile number)$/.test(key))
    return 'phone';
  if (/^(ip|ip address|ipv4|ipv6)$/.test(key)) return 'ip';
  if (/^(website|web site|url|link)$/.test(key)) return 'website';
  if (/^(email|email address|e mail)$/.test(key)) return 'email';
  return key;
}
function normalizedValue(key: string, value: string) {
  if (key === 'phone') {
    // Keep extensions distinct, and do not guess missing country codes.
    return value
      .trim()
      .replace(/[\s().-]/g, '')
      .replace(/^\+/, '');
  }
  if (key === 'website') {
    try {
      const url = new URL(value.trim());
      if (!['http:', 'https:'].includes(url.protocol)) return value.trim();
      return url.href;
    } catch {
      return value.trim();
    }
  }
  return tidy(value);
}
export type CommonLink = {
  source: string;
  target: string;
  matches: { label: string; value: string }[];
};
/** Exact shared details are leads for review, never automatic relationships. */
export function commonLinks(nodes: Evidence[], threads: Thread[], limit = 200) {
  if (limit <= 0) return [];
  const connected = new Set(threads.map((t) => [t.source, t.target].sort().join('\0')));
  const index = new Map<string, { node: Evidence; label: string; value: string }[]>();
  for (const node of nodes) {
    const seen = new Set<string>();
    for (const f of [...node.fields, ...node.tags.map((value) => ({ label: 'Tag', value }))]) {
      const key = fieldKey(f.label),
        value = normalizedValue(key, f.value);
      if (!key || !value) continue;
      const identity = key + '\0' + value;
      if (seen.has(identity)) continue;
      seen.add(identity);
      const bucket = index.get(identity) || [];
      bucket.push({ node, label: f.label.trim(), value: f.value.trim() });
      index.set(identity, bucket);
    }
  }
  const pairs = new Map<string, CommonLink>();
  for (const bucket of index.values())
    for (let i = 0; i < bucket.length; i++)
      for (let j = i + 1; j < bucket.length; j++) {
        const a = bucket[i],
          b = bucket[j];
        if (a.node.parentId === b.node.parentId) continue;
        const ids = [a.node.id, b.node.id].sort(),
          key = ids.join('\0');
        if (connected.has(key)) continue;
        let pair = pairs.get(key);
        if (!pair) {
          if (pairs.size >= limit) continue;
          pair = { source: ids[0], target: ids[1], matches: [] };
          pairs.set(key, pair);
        }
        pair.matches.push({ label: a.label, value: a.value });
        if (pairs.size >= limit) return [...pairs.values()];
      }
  return [...pairs.values()];
}
