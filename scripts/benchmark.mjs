import { sourceFingerprint } from './source-fingerprint.mjs';
import { performance } from 'node:perf_hooks';
import { cpus, totalmem, platform, arch, tmpdir } from 'node:os';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { once } from 'node:events';
import { chromium, expect } from '@playwright/test';
import { startServer } from '../runtime/server.mjs';
import { workspaceSchema } from '../runtime/model.mjs';
import { threadLayout } from '../lib/thread-layout.ts';
import { scaleCase } from '../tests/fixtures/scale-case.mjs';

const sizes = (process.env.ANACAPA_BENCH_SIZES || '100,500,1000,3000').split(',').map(Number);
if (sizes.some((n) => !Number.isInteger(n) || n < 3 || n > 3000))
  throw Error('Benchmark sizes must be 3–3000.');
const summary = (values) => {
  const ordered = [...values].sort((a, b) => a - b);
  return {
    samples: values.length,
    medianMs: +ordered[Math.floor(ordered.length / 2)].toFixed(2),
    p95Ms: +ordered[Math.ceil(ordered.length * 0.95) - 1].toFixed(2),
  };
};
const measured = (fn) => {
  const values = [];
  for (let i = 0; i < 10; i++) {
    const start = performance.now();
    fn();
    values.push(performance.now() - start);
  }
  return summary(values);
};
const report = {
  measuredAt: new Date().toISOString(),
  sourceSha256: (await sourceFingerprint()).sha256,
  runtime: process.version,
  host: {
    platform: platform(),
    arch: arch(),
    cpu: cpus()[0].model,
    logicalCpus: cpus().length,
    memoryGiB: Math.round(totalmem() / 1024 ** 3),
  },
  method:
    'Built production app, Chromium headless 1280×900, Normal folder-backed cases, 2 links/card. Ten CPU samples; five real browser edit/save/reload cycles per shape. Save timing includes the 650ms autosave delay and Playwright overhead. No CPU throttling. Originals fixture: 1 MiB. Browser cold-load is a single observation.',
  limitation:
    'This host is not a typical low-end laptop. Results establish tested sizes on this machine only; no average-hardware latency, battery, or memory guarantee. Flat 3,000-card boards are a stress case, not a recommended investigation arrangement.',
  cases: [],
};
const directory = await mkdtemp(path.join(tmpdir(), 'anacapa-benchmark-'));
const server = startServer({ port: 0, dataDirectory: path.join(directory, 'registry') });
let browser;
try {
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
  for (const count of sizes)
    for (const layout of ['branched', 'flat']) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      try {
        const first = await context.request.get(base + '/api/workspace');
        await first.json();
        const created = await context.request.post(base + '/api/cases', {
          headers: { 'X-Anacapa-Client': '1' },
          data: { mode: 'normal', title: 'Fictional scale measurement', parentFolder: directory },
        });
        if (!created.ok()) throw Error(await created.text());
        const state = await created.json(),
          id = state.workspace.activeCase;
        const file = {
          ...state.workspace.cases.find((c) => c.id === id),
          ...scaleCase(count, layout),
          id,
        };
        state.workspace.cases = state.workspace.cases.map((c) => (c.id === id ? file : c));
        const byId = new Map(file.nodes.map((n) => [n.id, n]));
        const cpu = {
          validate: measured(() => workspaceSchema.parse(state.workspace)),
          serialize: measured(() => JSON.stringify(state.workspace)),
          clone: measured(() => structuredClone(state.workspace)),
          allWireGeometry: measured(() => file.threads.forEach((t) => threadLayout(t, byId))),
        };
        const save = await context.request.put(base + '/api/workspace', {
          headers: { 'X-Anacapa-Client': '1' },
          data: state,
        });
        if (!save.ok()) throw Error(await save.text());
        const upload = await context.request.post(base + '/api/files', {
          headers: { 'X-Anacapa-Client': '1' },
          multipart: {
            caseId: id,
            file: {
              name: 'fictional-original.bin',
              mimeType: 'application/octet-stream',
              buffer: Buffer.alloc(1024 * 1024, 1),
            },
          },
        });
        if (!upload.ok()) throw Error(await upload.text());
        const storageBefore = await (
          await context.request.get(base + '/api/cases/' + id + '/storage')
        ).json();
        const page = await context.newPage(),
          rootCount = file.nodes.filter((n) => !n.parentId).length;
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        const start = performance.now();
        await page.goto(base);
        await expect(page.locator('.evidence-card')).toHaveCount(rootCount, { timeout: 60000 });
        await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
        const loadMs = +(performance.now() - start).toFixed(2),
          editOpen = [],
          saveReload = [];
        for (let i = 0; i < 5; i++) {
          let start = performance.now();
          await page.locator('[data-node-id="scale-0"] .card-edit').click({ timeout: 60000 });
          const input = page.getByRole('textbox', { name: 'Name', exact: true });
          await expect(input).toBeVisible();
          editOpen.push(performance.now() - start);
          const title = 'Fictional event 0 · revision ' + i;
          await input.fill(title);
          const written = page.waitForResponse(
            (r) => r.url().endsWith('/api/workspace') && r.request().method() === 'PUT',
            { timeout: 60000 },
          );
          start = performance.now();
          await page.getByRole('button', { name: 'Save changes', exact: true }).click();
          const response = await written;
          if (!response.ok()) throw Error(await response.text());
          await page.reload();
          await expect(page.locator('[data-node-id="scale-0"] h2')).toHaveText(title, {
            timeout: 60000,
          });
          saveReload.push(performance.now() - start);
        }
        if (errors.length) throw Error(errors.join('\n'));
        const storageAfter = await (
          await context.request.get(base + '/api/cases/' + id + '/storage')
        ).json();
        const result = {
          nodes: count,
          links: file.threads.length,
          layout,
          visibleRootCards: rootCount,
          workspaceBytes: Buffer.byteLength(JSON.stringify(state.workspace)),
          cpu,
          browser: {
            coldLoadMs: loadMs,
            openEditor: summary(editOpen),
            saveAndReload: summary(saveReload),
          },
          storage: {
            beforeBytes: storageBefore.totalBytes,
            afterBytes: storageAfter.totalBytes,
            revisionIncrease: storageAfter.revisions - storageBefore.revisions,
            snapshotGrowthBytes:
              storageAfter.groups.snapshots.bytes - storageBefore.groups.snapshots.bytes,
            originalsBytes: storageAfter.groups.originals.bytes,
          },
        };
        report.cases.push(result);
        console.log(
          `${count} ${layout}: ${rootCount} visible, load ${loadMs}ms, editor p95 ${result.browser.openEditor.p95Ms}ms, save/reload p95 ${result.browser.saveAndReload.p95Ms}ms`,
        );
      } finally {
        await context.close();
      }
    }
  await mkdir('docs', { recursive: true });
  await writeFile('docs/performance-results.json', JSON.stringify(report, null, 2) + '\n');
  console.log('Measured results: docs/performance-results.json');
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
  await rm(directory, { recursive: true, force: true });
}
