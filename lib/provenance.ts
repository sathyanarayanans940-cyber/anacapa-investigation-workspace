import type { CaseFile, Evidence } from './case-data.ts';
import { timestamp } from './local-date.ts';
export function eventInstant(n: Pick<Evidence, 'date' | 'utcOffset'>) {
  if (!n.date) return Infinity;
  return Date.parse(timestamp(n.date, n.utcOffset));
}
export function compareEvents(a: Evidence, b: Evidence) {
  return eventInstant(a) - eventInstant(b) || a.title.localeCompare(b.title);
}
export function materialCase(file: CaseFile) {
  const { security, controls, ...rest } = file;
  return {
    ...rest,
    nodes: file.nodes.map(
      ({
        x,
        y,
        rotation,
        boardSize,
        timelineSide,
        timelineStyle,
        color,
        pinned,
        titleField,
        ...n
      }) => n,
    ),
    threads: file.threads.map(({ labelOffset, color, style, ...t }) => t),
  };
}
export function evidenceChanged(before: CaseFile, after: CaseFile) {
  return JSON.stringify(materialCase(before)) !== JSON.stringify(materialCase(after));
}
export function shareSelection(file: CaseFile, ids: Set<string>, redact: Set<string>) {
  const chosen = structuredClone(file);
  delete chosen.security;
  chosen.nodes = chosen.nodes
    .filter((n) => ids.has(n.id))
    .map((n) => ({
      ...n,
      parentId: ids.has(n.parentId || '') ? n.parentId : null,
      fields: n.fields.filter((f) => !redact.has(f.id)),
      titleField: redact.has(n.titleField) ? 'title' : n.titleField,
    }));
  chosen.threads = chosen.threads.filter((t) => ids.has(t.source) && ids.has(t.target));
  return chosen;
}
