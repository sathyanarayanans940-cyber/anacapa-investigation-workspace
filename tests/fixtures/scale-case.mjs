import { sample } from '../../runtime/model.mjs';

/** Synthetic grids measure worst-case rendering; they do not prescribe board layout. */
export function scaleCase(count, layout = 'branched') {
  const node = sample.cases[0].nodes[0];
  const nodes = Array.from({ length: count }, (_, i) => ({
    ...structuredClone(node),
    id: 'scale-' + i,
    title: 'Fictional event ' + i,
    summary:
      'Synthetic performance fixture. An event has a source reference and a shared case tag.',
    kind: ['Event', 'Person', 'Document', 'Digital'][i % 4],
    parentId: layout === 'flat' || i % 30 === 0 ? null : 'scale-' + (i - (i % 30)),
    x: (i % 12) * 310 + 70,
    y: Math.floor(i / 12) * 270 + 70,
    date: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString().slice(0, 16),
    fields: [{ id: 'reference-' + i, label: 'Source reference', value: 'Exhibit ' + i }],
    pinned: false,
    tags: ['Group ' + Math.floor(i / 30)],
    images: [],
  }));
  const threads = nodes.flatMap((n, i) =>
    [1, 2].map((step) => ({
      id: 'scale-link-' + i + '-' + step,
      source: n.id,
      target: nodes[(i + step) % count].id,
      label: step === 1 ? 'followed by' : 'related source',
      color: step === 1 ? '#a58b70' : '#648fbc',
      dashed: step === 2,
      style: 'curved',
    })),
  );
  return {
    id: 'scale-case',
    title: `Fictional ${layout} case · ${count} items`,
    description: 'Disposable benchmark data.',
    nodes,
    threads,
  };
}
