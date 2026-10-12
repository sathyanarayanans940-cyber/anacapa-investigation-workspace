import { test as base, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
import path from 'node:path';
import { startServer } from '../../runtime/server.mjs';
import { sample, createInvestigationViewer, packInvestigation } from '../../runtime/model.mjs';

// Each test owns its own loopback server and fictional registry. Never reuse a live case.
const test = base.extend({
  caseFolder: async ({}, use) => {
    const directory = await mkdtemp(path.join(tmpdir(), 'anacapa-browser-'));
    try {
      await use(directory);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
  appURL: async ({ caseFolder }, use) => {
    const server = startServer({ port: 0, dataDirectory: path.join(caseFolder, 'registry') });
    try {
      await once(server, 'listening');
      await use(`http://127.0.0.1:${server.address().port}`);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  },
});

test('narrow evidence search, clear, keyboard shortcut, and timeline controls', async ({
  page,
  appURL,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(appURL);
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Search evidence', exact: true }).click();
  const search = page.getByRole('dialog');
  await search.getByRole('textbox', { name: 'Find evidence' }).fill('Seal photographed');
  await expect(search.getByRole('status')).toHaveText('1 item found');
  await search.getByRole('button', { name: 'Show results' }).click();
  await expect(page.locator('.evidence-card')).toHaveCount(1);
  await expect(
    page.getByRole('button', { name: 'Open Seal photographed', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Control+k');
  await expect(search).toBeVisible();
  await search.getByRole('button', { name: 'Clear search' }).click();
  await search.getByRole('button', { name: 'Show results' }).click();
  await page.getByRole('tab', { name: 'Timeline only', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Back to board', exact: true })).toBeVisible();
  await expect(
    page.locator('.timeline-focus-actions').getByRole('button', { name: 'Add event', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await expect(page.locator('.timeline-list')).toBeVisible();
  await page.getByRole('button', { name: 'Back to board', exact: true }).click();
  await expect(page.locator('.board')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('nested navigation, pencil editing, autosave, reload, and independent wire styles', async ({
  page,
  appURL,
}) => {
  await page.goto(appURL);
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open The midnight delivery', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Open Container unloaded', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Open Container unloaded', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Open Seal photographed', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Edit Seal photographed', exact: true }).click();
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Seal photograph reviewed');
  await page.getByRole('combobox', { name: 'Evidence type', exact: true }).click();
  await page.getByRole('option', { name: 'Custom type…', exact: true }).click();
  await page.getByRole('textbox', { name: 'Custom type', exact: true }).fill('Exhibit photograph');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
  const state = await (await page.request.get(appURL + '/api/workspace')).json();
  expect(state.workspace.cases[0].nodes.find((n) => n.id === 'check').title).toBe(
    'Seal photograph reviewed',
  );
  expect(state.workspace.cases[0].nodes.find((n) => n.id === 'check').customKind).toBe(
    'Exhibit photograph',
  );
  await page.getByRole('button', { name: 'Edit connection: coordinated', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Spring wire', exact: true }).click();
  await dialog.getByRole('button', { name: 'Blue connection', exact: true }).click();
  await dialog.getByRole('button', { name: 'Save connection', exact: true }).click();
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Edit connection: coordinated', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Spring wire', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Blue connection', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const saved = await (await page.request.get(appURL + '/api/workspace')).json();
  expect(saved.workspace.cases[0].threads.slice(1)).toEqual(
    state.workspace.cases[0].threads.slice(1),
  );
});

test('desktop search, card drag, undo, and switching between pan and select', async ({
  page,
  appURL,
}) => {
  await page.goto(appURL);
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
  const search = page.getByRole('textbox', { name: 'Find evidence', exact: true });
  await search.fill('Seal photographed');
  await expect(page.locator('.evidence-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Clear search', exact: true }).click();
  const card = page.getByRole('button', { name: 'Open Alex Morgan', exact: true });
  const box = await card.boundingBox();
  const save = page.waitForResponse(
    (r) => r.url().endsWith('/api/workspace') && r.request().method() === 'PUT',
  );
  await page.mouse.move(box.x + 70, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + 110, box.y + 125, { steps: 6 });
  await page.mouse.up();
  expect((await save).ok()).toBe(true);
  let state = await (await page.request.get(appURL + '/api/workspace')).json();
  const moved = state.workspace.cases[0].nodes.find((n) => n.id === 'morgan');
  expect(moved.x).toBeGreaterThan(78);
  expect(moved.y).toBeGreaterThan(72);
  const undone = page.waitForResponse(
    (r) => r.url().endsWith('/api/workspace') && r.request().method() === 'PUT',
  );
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect((await undone).ok()).toBe(true);
  state = await (await page.request.get(appURL + '/api/workspace')).json();
  expect(state.workspace.cases[0].nodes.find((n) => n.id === 'morgan').x).toBe(78);
  await page.getByRole('button', { name: 'Pan (H)', exact: true }).click();
  const panCard = page.getByRole('button', { name: 'Pan board over Alex Morgan', exact: true });
  const panBox = await panCard.boundingBox();
  await page.mouse.move(panBox.x + 70, panBox.y + 100);
  await page.mouse.down();
  await page.mouse.move(panBox.x + 90, panBox.y + 120);
  await page.mouse.up();
  expect(await panCard.count()).toBe(1);
  await page.getByRole('button', { name: 'Select (V)', exact: true }).click();
  await page.getByRole('button', { name: 'Open The midnight delivery', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Open Vehicle enters the gate', exact: true }),
  ).toBeVisible();
});

test('folder-backed cases expose storage totals without changing their records', async ({
  page,
  appURL,
  caseFolder,
}) => {
  await page.goto(appURL);
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
  const created = await page.request.post(appURL + '/api/cases', {
    headers: { 'X-Anacapa-Client': '1' },
    data: { mode: 'normal', title: 'Fictional storage preview', parentFolder: caseFolder },
  });
  expect(created.ok()).toBe(true);
  const reply = await created.json();
  await page.reload();
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Case records', exact: true }).click();
  await page.getByRole('tab', { name: 'Storage', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Case storage', exact: true })).toContainText(
    '1 saved revisions',
  );
  await expect(page.getByRole('region', { name: 'Case storage', exact: true })).toContainText(
    'Recovery snapshots',
  );
  const after = await (
    await page.request.get(appURL + '/api/cases/' + reply.workspace.activeCase + '/storage')
  ).json();
  expect(after.revisions).toBe(1);
});

for (const width of [320, 390, 650, 1280])
  test(`standalone HTML viewer controls and branches work offline at ${width}px`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    const bundle = await packInvestigation(
      structuredClone(sample.cases[0]),
      async () => new Uint8Array(),
    );
    await context.setOffline(true);
    await page.setContent(createInvestigationViewer(bundle));
    for (const name of ['Board', 'Timeline', 'Report', 'Relationships']) {
      const control = page.getByRole('button', { name, exact: true });
      await expect(control).toBeVisible();
      const box = await control.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
    await page.getByRole('button', { name: 'Relationships', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Close details' }).click();
    await page.locator('#scene .card').filter({ hasText: 'The midnight delivery' }).click();
    await page.locator('#branch').click();
    await expect(page.locator('#scene .card')).toHaveCount(2);
    await page.getByRole('button', { name: 'Timeline', exact: true }).click();
    await expect(page.locator('#timeline')).toBeVisible();
    await page.getByRole('button', { name: 'Report', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Print / save as PDF', exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
