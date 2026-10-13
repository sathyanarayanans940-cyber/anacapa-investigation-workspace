import { wireStyles } from './connection-path.ts';
import { z } from 'zod';
import { isStoredDate, validDateRange } from './local-date.ts';
const id = z.string().min(1).max(150);
const text = z.string().max(20000);
const citation = z.object({
  id,
  source: z.string().min(1).max(300),
  reference: z.string().max(500),
  locator: z.string().max(500),
  claim: z.string().max(1000),
  collectedBy: z.string().max(200),
  collectedAt: z.string().max(100),
  method: z.string().max(500),
  url: z
    .string()
    .max(2000)
    .refine((v) => !v || /^https?:\/\//i.test(v), 'Use an HTTP or HTTPS source URL'),
});
const security = z.object({
  mode: z.enum(['normal', 'advanced']),
  managed: z.boolean(),
  locked: z.boolean(),
  unavailable: z.boolean().optional(),
  folder: z.string().max(4000).optional(),
  role: z.enum(['admin', 'editor', 'viewer']).optional(),
  operator: z.string().max(200).optional(),
  checkpointFolder: z.string().max(4000).optional(),
  checkpointFingerprint: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
});
export const evidenceSchema = z.object({
  id,
  title: z.string().min(1).max(200),
  kind: z.enum(['Person', 'Event', 'Location', 'Digital', 'Document', 'Note']),
  customKind: z.string().trim().min(1).max(80).optional(),
  summary: text,
  date: z.string().max(40).refine(isStoredDate, 'Invalid date'),
  endDate: z.string().max(40).refine(isStoredDate, 'Invalid end date').optional(),
  utcOffset: z
    .string()
    .regex(/^[+-](?:0\d|1[0-3]):[0-5]\d$|^[+-]14:00$/)
    .optional(),
  timePrecision: z.enum(['exact', 'approximate', 'date-only']).optional(),
  originalTimestamp: z.string().max(200).optional(),
  citations: z.array(citation).max(100).optional(),
  parentId: id.nullable(),
  x: z.number().finite().min(-100000).max(100000),
  y: z.number().finite().min(-100000).max(100000),
  rotation: z.number().finite().min(-15).max(15).optional(),
  boardSize: z
    .object({
      width: z.number().finite().min(160).max(720),
      height: z.number().finite().min(100).max(640),
    })
    .optional(),
  timelineSide: z.enum(['above', 'below']).optional(),
  timelineStyle: z.enum(['card', 'compact', 'note']).optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  pinned: z.boolean(),
  confidence: z.enum(['Confirmed', 'Likely', 'Unverified']),
  titleField: id,
  fields: z.array(z.object({ id, label: z.string().max(100), value: text })).max(200),
  images: z
    .array(
      z.object({
        name: z.string().max(300),
        url: z.string().regex(/^\/api\/files\/[a-zA-Z0-9-]+$/),
        type: z.string().max(100),
        sha256: z
          .string()
          .regex(/^[a-f0-9]{64}$/)
          .optional(),
        size: z.number().int().min(0).optional(),
        collectedAt: z.string().max(100).optional(),
        collectedBy: z.string().max(200).optional(),
      }),
    )
    .max(100),
  tags: z.array(z.string().max(100)).max(100),
});
export const workspaceSchema = z
  .object({
    activeCase: id,
    cases: z
      .array(
        z.object({
          id,
          title: z.string().min(1).max(200),
          description: text,
          controls: z.enum(['simple', 'full']).optional(),
          security: security.optional(),
          nodes: z.array(evidenceSchema).max(3000),
          threads: z
            .array(
              z.object({
                id,
                source: id,
                target: id,
                label: z.string().max(200),
                color: z.string().regex(/^#[0-9a-f]{6}$/i),
                dashed: z.boolean(),
                style: z.enum(wireStyles).optional(),
                citations: z.array(citation).max(100).optional(),
                labelOffset: z
                  .object({
                    x: z.number().finite().min(-100000).max(100000),
                    y: z.number().finite().min(-100000).max(100000),
                  })
                  .optional(),
              }),
            )
            .max(6000),
        }),
      )
      .min(1)
      .max(100),
  })
  .superRefine((w, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
    if (new Set(w.cases.map((c) => c.id)).size !== w.cases.length) fail('Duplicate case IDs');
    if (!w.cases.some((c) => c.id === w.activeCase)) fail('Missing active case');
    for (const c of w.cases) {
      const byId = new Map(c.nodes.map((n) => [n.id, n])),
        checked = new Set<string>();
      if (byId.size !== c.nodes.length) fail('Duplicate node IDs');
      if (new Set(c.threads.map((t) => t.id)).size !== c.threads.length)
        fail('Duplicate connection IDs');
      for (const item of [...c.nodes, ...c.threads])
        if (new Set((item.citations || []).map((s) => s.id)).size !== (item.citations || []).length)
          fail('Duplicate citation IDs');
      for (const n of c.nodes) {
        if (!validDateRange(n.date, n.endDate || '', n.utcOffset))
          fail('End date must follow start date');
        if (new Set(n.fields.map((f) => f.id)).size !== n.fields.length)
          fail('Duplicate field IDs');
        // Resolve each ancestor once, without recursion, even for a 3,000-event chain.
        let p: string | null = n.id;
        const path = new Set<string>();
        while (p && !checked.has(p)) {
          const parent = byId.get(p);
          if (path.has(p) || !parent) {
            fail('Invalid timeline hierarchy');
            break;
          }
          path.add(p);
          p = parent.parentId;
        }
        for (const id of path) checked.add(id);
        if (n.titleField !== 'title' && !n.fields.some((f) => f.id === n.titleField))
          fail('Invalid title field');
      }
      for (const t of c.threads)
        if (!byId.has(t.source) || !byId.has(t.target) || t.source === t.target)
          fail('Invalid connection');
    }
  });
