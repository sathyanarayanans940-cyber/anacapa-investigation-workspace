import { z } from 'zod';
import { workspaceSchema } from './validation.ts';
import type { CaseFile } from './case-data.ts';

export const attachmentLimit = 10 * 1024 * 1024;
export const packageLimit = 50 * 1024 * 1024;
export const packageFileLimit = 75 * 1024 * 1024;
export const protectedFileLimit = 100 * 1024 * 1024;
const assetSchema = z.object({
  url: z.string().regex(/^\/api\/files\/[a-zA-Z0-9-]+$/),
  name: z.string().max(300),
  type: z.string().max(100),
  data: z
    .string()
    .max(Math.ceil(attachmentLimit / 3) * 4)
    .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
});
const auditRecord = z
  .object({
    sequence: z.number().int().positive(),
    at: z.string().datetime(),
    actor: z.string().max(200),
    role: z.string().max(30),
    action: z.string().max(100),
    reason: z.string().max(20000),
    hash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .passthrough();
const custodyRecord = z.object({
  id: z.string().max(150),
  from: z.string().max(2000),
  to: z.string().max(2000),
  when: z.string().max(2000),
  method: z.string().max(2000),
  note: z.string().max(2000),
  recordedAt: z.string().datetime(),
  recordedBy: z.string().max(200),
});
const packageSchema = z.object({
  format: z.literal('anacapa-investigation'),
  version: z.literal(1),
  exportedAt: z.string().datetime(),
  investigation: workspaceSchema.innerType().shape.cases.element,
  assets: z.array(assetSchema).max(1000),
  integrity: z.record(z.unknown()).optional(),
  history: z.array(auditRecord).max(100).optional(),
  custody: z.array(custodyRecord).max(10000).optional(),
});
export type InvestigationPackage = z.infer<typeof packageSchema>;
export type EncryptedPackage = {
  format: 'anacapa-encrypted';
  version: 1;
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string;
  algorithm: 'AES-256-GCM';
  iv: string;
  data: string;
};
export function bytesToBase64(bytes: Uint8Array) {
  let value = '';
  for (let i = 0; i < bytes.length; i += 32768)
    value += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(value);
}
export function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

export function parseInvestigationPackage(input: unknown): InvestigationPackage {
  const result = packageSchema.safeParse(input);
  if (!result.success) throw Error('This is not a supported Anacapa investigation file.');
  const bundle = result.data;
  if (
    !workspaceSchema.safeParse({
      activeCase: bundle.investigation.id,
      cases: [bundle.investigation],
    }).success
  )
    throw Error('This investigation has invalid evidence or timeline links.');
  const assets = new Map(bundle.assets.map((a) => [a.url, a]));
  if (assets.size !== bundle.assets.length)
    throw Error('This investigation contains duplicate attachments.');
  const referenced = new Set(bundle.investigation.nodes.flatMap((n) => n.images.map((i) => i.url)));
  if (
    [...referenced].some((url) => !assets.has(url)) ||
    [...assets.keys()].some((url) => !referenced.has(url))
  )
    throw Error('Some attachments are missing from this investigation.');
  let total = 0;
  for (const asset of bundle.assets) {
    const bytes = base64ToBytes(asset.data);
    if (!bytes.length || bytes.length > attachmentLimit || bytesToBase64(bytes) !== asset.data)
      throw Error('An attachment is invalid or exceeds 10 MB.');
    total += bytes.length;
  }
  if (total > packageLimit)
    throw Error('Investigation attachments exceed the 50 MB sharing limit.');
  return bundle;
}
export async function packInvestigation(
  investigation: CaseFile,
  readAsset: (url: string) => Promise<Uint8Array>,
): Promise<InvestigationPackage> {
  const file = structuredClone(investigation);
  delete file.security;
  const references = new Map(file.nodes.flatMap((n) => n.images.map((i) => [i.url, i] as const)));
  const assets: InvestigationPackage['assets'] = [];
  let total = 0;
  for (const [url, image] of references) {
    const bytes = await readAsset(url);
    total += bytes.length;
    if (!bytes.length || bytes.length > attachmentLimit || total > packageLimit)
      throw Error('Use attachments up to 10 MB each, with 50 MB total per shared investigation.');
    assets.push({ url, name: image.name, type: image.type, data: bytesToBase64(bytes) });
  }
  return parseInvestigationPackage({
    format: 'anacapa-investigation',
    version: 1,
    exportedAt: new Date().toISOString(),
    investigation: file,
    assets,
  });
}
export function restoreInvestigation(
  bundle: InvestigationPackage,
  id: string,
  urls: ReadonlyMap<string, string>,
): CaseFile {
  const investigation = structuredClone(bundle.investigation);
  investigation.id = id;
  for (const node of investigation.nodes)
    for (const image of node.images) {
      const url = urls.get(image.url);
      if (!url || !/^\/api\/files\/[a-zA-Z0-9-]+$/.test(url))
        throw Error('An attachment could not be imported. Your existing cases are unchanged.');
      image.url = url;
    }
  workspaceSchema.parse({ activeCase: id, cases: [investigation] });
  return investigation;
}
export function packageFilename(title: string, extension: string) {
  let name =
    title
      .replace(/[^\p{L}\p{N}\s._-]/gu, '')
      .trim()
      .replace(/^\.+/, '')
      .replace(/\s+/g, '-')
      .slice(0, 100)
      .replace(/[. ]+$/, '') || 'investigation';
  if (/^(?:CON|PRN|AUX|NUL|COM[1-9¹²³]|LPT[1-9¹²³])(?:\.|$)/i.test(name)) name = 'Case-' + name;
  return name + extension;
}
