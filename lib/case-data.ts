import type { WireStyle } from './connection-path.ts';
export type NodeKind = 'Person' | 'Event' | 'Location' | 'Digital' | 'Document' | 'Note';
export type Citation = {
  id: string;
  source: string;
  reference: string;
  locator: string;
  claim: string;
  collectedBy: string;
  collectedAt: string;
  method: string;
  url: string;
};
export type Attachment = {
  name: string;
  url: string;
  type: string;
  sha256?: string;
  size?: number;
  collectedAt?: string;
  collectedBy?: string;
};
export type CaseSecurity = {
  mode: 'normal' | 'advanced';
  managed: boolean;
  locked: boolean;
  unavailable?: boolean;
  folder?: string;
  role?: 'admin' | 'editor' | 'viewer';
  operator?: string;
  checkpointFolder?: string;
  checkpointFingerprint?: string;
};
export type Field = { id: string; label: string; value: string };
export type TimelineSide = 'above' | 'below';
export type TimelineStyle = 'card' | 'compact' | 'note';
export type Evidence = {
  id: string;
  title: string;
  kind: NodeKind;
  customKind?: string;
  summary: string;
  date: string;
  endDate?: string;
  utcOffset?: string;
  timePrecision?: 'exact' | 'approximate' | 'date-only';
  originalTimestamp?: string;
  citations?: Citation[];
  parentId: string | null;
  x: number;
  y: number;
  rotation?: number;
  boardSize?: { width: number; height: number };
  timelineSide?: TimelineSide;
  timelineStyle?: TimelineStyle;
  color: string;
  pinned: boolean;
  confidence: string;
  fields: Field[];
  titleField: string;
  images: Attachment[];
  tags: string[];
};
export type Thread = {
  id: string;
  source: string;
  target: string;
  label: string;
  color: string;
  dashed: boolean;
  style?: WireStyle;
  labelOffset?: { x: number; y: number };
  citations?: Citation[];
};
export type CaseFile = {
  id: string;
  title: string;
  description: string;
  controls?: 'simple' | 'full';
  nodes: Evidence[];
  threads: Thread[];
  security?: CaseSecurity;
};
export type Workspace = { cases: CaseFile[]; activeCase: string };
export const colors = ['#a58b70', '#bea077', '#8b9981', '#b28d82', '#8c9ba3'];
const node = (
  id: string,
  title: string,
  kind: NodeKind,
  x: number,
  y: number,
  summary: string,
  date: string,
  color: string,
  fields: Field[] = [],
  parentId: string | null = null,
): Evidence => ({
  id,
  title,
  kind,
  x,
  y,
  summary,
  date,
  color,
  fields,
  parentId,
  pinned: false,
  confidence: 'Confirmed',
  titleField: 'title',
  images: [],
  tags: [],
});
export const sample: Workspace = {
  activeCase: 'case-harbor',
  cases: [
    {
      id: 'case-harbor',
      title: 'The Harbor Files',
      description: 'Following the connections behind the midnight delivery.',
      nodes: [
        {
          ...node(
            'delivery',
            'The midnight delivery',
            'Event',
            425,
            176,
            'An unlisted shipment arrives at Pier 14. Three separate leads converge here.',
            '2026-09-18T23:42',
            '#6960d9',
            [
              { id: 'time', label: 'Time', value: '23:42 · local time' },
              { id: 'ref', label: 'Reference', value: 'HBR-0918-04' },
            ],
          ),
          pinned: true,
          tags: ['Key event', 'Open lead'],
        },
        node(
          'morgan',
          'Alex Morgan',
          'Person',
          78,
          72,
          'Logistics coordinator · Harbor Transit',
          '2026-09-17T14:30',
          '#568cc7',
          [
            { id: 'phone', label: 'Phone', value: '+1 (202) 555-0142' },
            { id: 'email', label: 'Email', value: 'alex@harbor.example' },
          ],
        ),
        node(
          'warehouse',
          'Warehouse 04',
          'Location',
          780,
          54,
          'Last known destination of the shipment.',
          '2026-09-19T00:15',
          '#3b9a8d',
          [{ id: 'address', label: 'Address', value: '14 Harbor Way, North Quay' }],
        ),
        {
          ...node(
            'manifest',
            'Shipping manifest',
            'Document',
            77,
            320,
            'Two containers. One missing entry.',
            '2026-09-18T16:10',
            '#d99742',
            [
              { id: 'container', label: 'Container ID', value: 'HBR-2048' },
              { id: 'source', label: 'Source', value: 'Port authority records' },
            ],
          ),
          tags: ['Document #004'],
        },
        {
          ...node(
            'signal',
            'The 11:38 connection',
            'Digital',
            793,
            316,
            'An unknown device connects just before arrival.',
            '2026-09-18T23:38',
            '#d16978',
            [
              { id: 'ip', label: 'IP address', value: '192.0.2.42' },
              { id: 'website', label: 'Website', value: 'https://example.com' },
            ],
          ),
          confidence: 'Unverified',
        },
        node(
          'note',
          'A four-minute window',
          'Note',
          432,
          470,
          'The device went online four minutes before the delivery. Coincidence, or a signal?',
          '',
          '#d99742',
        ),
        node(
          'arrival',
          'Vehicle enters the gate',
          'Event',
          120,
          105,
          'Gate log records an unmarked delivery van.',
          '2026-09-18T23:40',
          '#6960d9',
          [],
          'delivery',
        ),
        node(
          'unload',
          'Container unloaded',
          'Event',
          485,
          175,
          'Container HBR-2048 transferred to the loading area.',
          '2026-09-18T23:44',
          '#3b9a8d',
          [],
          'delivery',
        ),
        node(
          'check',
          'Seal photographed',
          'Document',
          200,
          100,
          'Seal number matches the shipping manifest.',
          '2026-09-18T23:45',
          '#d99742',
          [],
          'unload',
        ),
      ],
      threads: [
        {
          id: 't1',
          source: 'morgan',
          target: 'delivery',
          label: 'coordinated',
          color: '#568cc7',
          dashed: false,
        },
        {
          id: 't2',
          source: 'manifest',
          target: 'delivery',
          label: 'documents',
          color: '#d99742',
          dashed: false,
        },
        {
          id: 't3',
          source: 'delivery',
          target: 'warehouse',
          label: 'delivered to',
          color: '#3b9a8d',
          dashed: false,
        },
        {
          id: 't4',
          source: 'signal',
          target: 'delivery',
          label: 'possible link',
          color: '#d16978',
          dashed: true,
        },
        {
          id: 't5',
          source: 'arrival',
          target: 'unload',
          label: 'followed by',
          color: '#6960d9',
          dashed: false,
        },
      ],
    },
  ],
};
export const titleOf = (n: Evidence) =>
  n.titleField === 'title'
    ? n.title
    : n.fields.find((f) => f.id === n.titleField)?.value || n.title;
export const descendants = (nodes: Evidence[], id: string): string[] => {
  const children = new Map<string, string[]>();
  for (const n of nodes)
    if (n.parentId) {
      const list = children.get(n.parentId) || [];
      list.push(n.id);
      children.set(n.parentId, list);
    }
  const out: string[] = [],
    seen = new Set([id]),
    pending = [...(children.get(id) || [])].reverse();
  while (pending.length) {
    const child = pending.pop()!;
    if (seen.has(child)) continue;
    seen.add(child);
    out.push(child);
    pending.push(...[...(children.get(child) || [])].reverse());
  }
  return out;
};
