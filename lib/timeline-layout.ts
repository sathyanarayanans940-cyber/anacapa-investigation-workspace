import type { Evidence, TimelineSide, TimelineStyle } from './case-data.ts';

// An explicit arrangement travels with the evidence. Older files get a staggered layout.
export function timelinePresentation(
  node: Evidence,
  index: number,
): { side: TimelineSide; style: TimelineStyle } {
  return {
    side: node.timelineSide ?? (index % 2 === 0 ? 'above' : 'below'),
    style:
      node.timelineStyle ??
      (node.kind === 'Note'
        ? 'note'
        : node.kind === 'Person' || node.kind === 'Location'
          ? 'compact'
          : 'card'),
  };
}
