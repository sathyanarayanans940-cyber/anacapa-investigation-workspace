import { test as base, expect } from '@playwright/test';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
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

async function scrollbarSkin(page) {
  return page.evaluate(() => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--primary)';
    document.body.append(probe);
    const primary = getComputedStyle(probe).color;
    probe.remove();
    const regions = [...document.querySelectorAll('*')]
      .filter((element) => {
        const style = getComputedStyle(element);
        return (
          element.getBoundingClientRect().width > 0 &&
          style.scrollbarWidth !== 'none' &&
          ([style.overflowX, style.overflowY].some((value) => ['auto', 'scroll'].includes(value)) ||
            element.tagName === 'TEXTAREA')
        );
      })
      .map((element) => {
        const style = getComputedStyle(element);
        return {
          name: element.id || element.className || element.tagName,
          colour: style.scrollbarColor,
          width: style.scrollbarWidth,
        };
      });
    return { primary, regions };
  });
}

async function expectThemedScrollbars(page) {
  // Dialogs animate colour changes for 200ms; check the settled palette.
  await expect
    .poll(async () => {
      const skin = await scrollbarSkin(page);
      return (
        skin.regions.length > 0 &&
        skin.regions.every(
          (region) =>
            region.colour === `${skin.primary} rgba(0, 0, 0, 0)` && region.width === 'thin',
        )
      );
    })
    .toBe(true);
  const skin = await scrollbarSkin(page);
  for (const region of skin.regions) {
    expect(region.colour, String(region.name)).toBe(`${skin.primary} rgba(0, 0, 0, 0)`);
    expect(region.width, String(region.name)).toBe('thin');
  }
}

test('editor scroll regions follow every palette, including dialogs and text fields', async ({
  page,
  appURL,
}) => {
  await page.setViewportSize({ width: 390, height: 650 });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(appURL);
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Timeline only', exact: true }).click();
  for (const [mode, palette, theme] of [
    ['Light', 'Linen', 'paper'],
    ['Light', 'Chalk', 'daylight'],
    ['Dark', 'Dusk', 'midnight'],
    ['Dark', 'Slate', 'blueprint'],
  ]) {
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('radio', { name: mode, exact: true }).check();
    await dialog.getByRole('radio', { name: new RegExp(`^${palette} `) }).check();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expectThemedScrollbars(page);
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expectThemedScrollbars(page);
  }
  await page.getByRole('button', { name: 'Add evidence', exact: true }).click();
  const notes = page.getByRole('textbox', { name: 'Notes', exact: true });
  await notes.fill('A fictional line of notes to check scrolling.\n'.repeat(80));
  await expectThemedScrollbars(page);
  expect(await notes.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await notes.hover();
  await page.mouse.wheel(0, 180);
  await expect.poll(() => notes.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
});

test('offline viewer scrollbars follow light/dark appearance and both axes still scroll', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 650 });
  await page.emulateMedia({ colorScheme: 'dark' });
  const bundle = await packInvestigation(
    structuredClone(sample.cases[0]),
    async () => new Uint8Array(),
  );
  await context.setOffline(true);
  await page.setContent(createInvestigationViewer(bundle));
  await page.getByRole('button', { name: 'Timeline', exact: true }).click();
  await page.getByRole('button', { name: /2 sub-events/ }).click();
  await page.getByRole('button', { name: /1 sub-events/ }).click();
  await expectThemedScrollbars(page);
  const horizontal = page.locator('.lane-track').first();
  expect(await horizontal.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
    true,
  );
  await horizontal.hover();
  await page.mouse.wheel(300, 0);
  await expect.poll(() => horizontal.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  const timeline = page.locator('#timeline');
  expect(await timeline.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(
    true,
  );
  await timeline.hover();
  await page.mouse.wheel(0, 120);
  await expect.poll(() => timeline.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await page.screenshot({ path: test.info().outputPath('viewer-dark-scrollbars.png') });
  await page.getByRole('button', { name: 'Toggle light or dark appearance', exact: true }).click();
  await expectThemedScrollbars(page);
  await page.getByRole('button', { name: 'Relationships', exact: true }).click();
  await expectThemedScrollbars(page);
  await page.getByRole('button', { name: 'Close details', exact: true }).click();
  await page.getByRole('button', { name: 'Report', exact: true }).click();
  await expectThemedScrollbars(page);
  await page.emulateMedia({ forcedColors: 'active' });
  await expect
    .poll(() =>
      page.locator('#report').evaluate((element) => getComputedStyle(element).scrollbarColor),
    )
    .toBe('auto');
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

test('each board card resizes at board zoom, saves/reloads, undoes, and keeps evidence intact', async ({
  page,
  appURL,
}) => {
  const seeded = await (await page.request.get(appURL + '/api/workspace')).json();
  seeded.workspace.cases[0].nodes.find((n) => n.id === 'morgan').summary =
    'Fictional interview notes: the shipment was routed through the north gate and the time was checked against the manifest. '.repeat(
      8,
    );
  expect(
    (
      await page.request.put(appURL + '/api/workspace', {
        headers: { 'X-Anacapa-Client': '1' },
        data: seeded,
      })
    ).ok(),
  ).toBe(true);
  await page.goto(appURL);
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
  const card = page.locator('.evidence-card[data-node-id="morgan"]');
  const grip = card.getByRole('button', { name: 'Resize Alex Morgan', exact: true });
  await expect(grip).toBeAttached();
  // Fit has a deferred layout pass; wait for the camera before recording screen movement.
  await expect(page.locator('.zoom > span').first()).not.toHaveText('100%');
  await card.hover();
  const before = await (await page.request.get(appURL + '/api/workspace')).json();
  const initialSize = await card.evaluate((e) => ({
    width: e.offsetWidth,
    height: e.offsetHeight,
  }));
  const initialPreviewHeight = await card
    .locator('.card-preview p')
    .evaluate((e) => e.clientHeight);
  const zoom = await page
    .locator('.canvas')
    .evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).a);
  const handle = await grip.boundingBox();
  const save = page.waitForResponse(
    (r) => r.url().endsWith('/api/workspace') && r.request().method() === 'PUT',
  );
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    handle.x + handle.width / 2 + 70 * zoom,
    handle.y + handle.height / 2 + 60 * zoom,
    { steps: 10 },
  );
  await page.mouse.up();
  expect((await save).ok()).toBe(true);
  const saved = await (await page.request.get(appURL + '/api/workspace')).json();
  const resized = saved.workspace.cases[0].nodes.find((n) => n.id === 'morgan');
  expect(resized.boardSize.width).toBeCloseTo(initialSize.width + 70, 0);
  expect(resized.boardSize.height).toBeCloseTo(initialSize.height + 60, 0);
  expect(saved.workspace.cases[0].nodes.filter((n) => n.id !== 'morgan')).toEqual(
    before.workspace.cases[0].nodes.filter((n) => n.id !== 'morgan'),
  );
  expect(resized.summary).toBe(
    before.workspace.cases[0].nodes.find((n) => n.id === 'morgan').summary,
  );
  const preview = await card.locator('.card-preview p').textContent();
  expect(preview.length).toBeGreaterThan(115);
  expect(preview.length).toBeLessThan(resized.summary.length);
  expect(resized.summary.startsWith(preview.slice(0, -1))).toBe(true);
  expect(await card.locator('.card-preview p').evaluate((e) => e.clientHeight)).toBeGreaterThan(
    initialPreviewHeight,
  );
  if (process.env.ANACAPA_QA_SCREENSHOTS) {
    await mkdir('output/card-resize', { recursive: true });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.evaluate(async () => {
      await Promise.all(
        document.getAnimations().map((animation) => animation.finished.catch(() => {})),
      );
    });
    await page.screenshot({ path: 'output/card-resize/Chrome-Enlarged-Card.png' });
  }
  const path = await page.locator('.threads path').first().getAttribute('d');
  expect(path).toContain(
    `M${resized.x + resized.boardSize.width / 2} ${resized.y + resized.boardSize.height / 2}`,
  );
  const undoSave = page.waitForResponse(
    (r) => r.url().endsWith('/api/workspace') && r.request().method() === 'PUT',
  );
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect((await undoSave).ok()).toBe(true);
  expect(
    (
      await (await page.request.get(appURL + '/api/workspace')).json()
    ).workspace.cases[0].nodes.find((n) => n.id === 'morgan'),
  ).toEqual(before.workspace.cases[0].nodes.find((n) => n.id === 'morgan'));
  const redoSave = page.waitForResponse(
    (r) => r.url().endsWith('/api/workspace') && r.request().method() === 'PUT',
  );
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  expect((await redoSave).ok()).toBe(true);
  await page.reload();
  await expect(card).toHaveClass(/card-sized/);
  expect(await card.evaluate((e) => e.offsetWidth)).toBe(Math.round(resized.boardSize.width));
  await grip.focus();
  await grip.press('Shift+ArrowRight');
  expect(await card.evaluate((e) => e.offsetWidth)).toBe(Math.round(resized.boardSize.width) + 10);
  await grip.press('Home');
  await expect(card).not.toHaveClass(/card-sized/);
  await grip.focus();
  await grip.press('Shift+ArrowRight');
  await grip.dblclick();
  await expect(card).not.toHaveClass(/card-sized/);
  // Shrink to the limits using the grip. Full notes stay accessible through the pencil.
  await card.hover();
  const current = await card.evaluate((e) => ({ width: e.offsetWidth, height: e.offsetHeight }));
  const z = await page
    .locator('.canvas')
    .evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).a);
  const corner = await grip.boundingBox();
  await page.mouse.move(corner.x + corner.width / 2, corner.y + corner.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    corner.x + corner.width / 2 + (160 - current.width) * z,
    corner.y + corner.height / 2 + (100 - current.height) * z,
    { steps: 8 },
  );
  await page.mouse.up();
  await expect(card).toHaveClass(/card-compact/);
  await expect(card.locator('h2')).toBeVisible();
  await expect(card.locator('.card-preview')).not.toBeVisible();
  // Pushing past the minimum is a no-op and must not add an extra Undo step.
  await grip.focus();
  await grip.press('Shift+ArrowLeft');
  await grip.press('Shift+ArrowUp');
  expect(await card.evaluate((e) => ({ width: e.offsetWidth, height: e.offsetHeight }))).toEqual({
    width: 160,
    height: 100,
  });
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(card).not.toHaveClass(/card-sized/);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(card).toHaveClass(/card-compact/);
  if (process.env.ANACAPA_QA_SCREENSHOTS) {
    await mkdir('output/card-resize', { recursive: true });
    await page.screenshot({ path: 'output/card-resize/Chrome-Compact-Card.png' });
  }
  await card.getByRole('button', { name: 'Edit Alex Morgan', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Notes', exact: true })).toHaveValue(
    resized.summary,
  );
  await page.getByText('Card appearance & labels', { exact: true }).click();
  await page.getByRole('button', { name: 'Reset card size', exact: true }).click();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(card).not.toHaveClass(/card-sized/);
  await page.getByRole('button', { name: 'Pan (H)', exact: true }).click();
  await expect(page.locator('.card-resize')).toHaveCount(0);
});

test('rotated note resizing keeps its anchor and pointer cancellation restores its size', async ({
  page,
  appURL,
}) => {
  await page.goto(appURL);
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
  const card = page.locator('.evidence-card[data-node-id="note"]');
  const grip = card.getByRole('button', { name: /^Resize / });
  await expect(page.locator('.zoom > span').first()).not.toHaveText('100%');
  await card.hover();
  const original = await card.evaluate((e) => ({
    x: parseFloat(e.style.left),
    y: parseFloat(e.style.top),
    width: e.offsetWidth,
    height: e.offsetHeight,
  }));
  const z = await page
    .locator('.canvas')
    .evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).a);
  const angle = (-2 * Math.PI) / 180;
  const corner = (n) => ({
    x: n.x + n.width / 2 - (Math.cos(angle) * n.width) / 2 + (Math.sin(angle) * n.height) / 2,
    y: n.y + n.height / 2 - (Math.sin(angle) * n.width) / 2 - (Math.cos(angle) * n.height) / 2,
  });
  let box = await grip.boundingBox();
  const saved = page.waitForResponse(
    (r) => r.url().endsWith('/api/workspace') && r.request().method() === 'PUT',
  );
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + (120 * Math.cos(angle) - 40 * Math.sin(angle)) * z,
    box.y + box.height / 2 + (120 * Math.sin(angle) + 40 * Math.cos(angle)) * z,
    { steps: 10 },
  );
  await page.mouse.up();
  expect((await saved).ok()).toBe(true);
  const changed = await card.evaluate((e) => ({
    x: parseFloat(e.style.left),
    y: parseFloat(e.style.top),
    width: e.offsetWidth,
    height: e.offsetHeight,
  }));
  expect(changed.width).toBeCloseTo(original.width + 120, 0);
  expect(corner(changed).x).toBeCloseTo(corner(original).x, 0);
  expect(corner(changed).y).toBeCloseTo(corner(original).y, 0);
  box = await grip.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 30 * z, box.y + box.height / 2 + 30 * z, {
    steps: 5,
  });
  await expect.poll(() => card.evaluate((e) => e.offsetWidth)).toBeGreaterThan(changed.width);
  await grip.dispatchEvent('pointercancel');
  await page.mouse.up();
  expect(await card.evaluate((e) => e.offsetWidth)).toBe(changed.width);
  expect(await card.evaluate((e) => parseFloat(e.style.left))).toBeCloseTo(changed.x, 4);
});

test('Simple controls resize nested cards and compact cards still open their sub-timelines', async ({
  page,
  appURL,
}) => {
  const state = await (await page.request.get(appURL + '/api/workspace')).json();
  state.workspace.cases[0].controls = 'simple';
  expect(
    (
      await page.request.put(appURL + '/api/workspace', {
        headers: { 'X-Anacapa-Client': '1' },
        data: state,
      })
    ).ok(),
  ).toBe(true);
  await page.goto(appURL);
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open The midnight delivery', exact: true }).click();
  const card = page.getByRole('button', { name: 'Open Container unloaded', exact: true });
  const grip = card.getByRole('button', { name: 'Resize Container unloaded', exact: true });
  await grip.focus();
  // Shrink using the keyboard, without depending on the board's current zoom.
  for (let i = 0; i < 16; i++) await grip.press('Shift+ArrowLeft');
  for (let i = 0; i < 20; i++) await grip.press('Shift+ArrowUp');
  await expect(card).toHaveClass(/card-compact/);
  await expect(card.locator('.card-compact-count')).toHaveText('1');
  await card.locator('h2').click();
  await expect(
    page.getByRole('button', { name: 'Open Seal photographed', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
  const after = await (await page.request.get(appURL + '/api/workspace')).json();
  const child = after.workspace.cases[0].nodes.find((n) => n.id === 'unload');
  expect(child.boardSize).toEqual({ width: 160, height: 100 });
  expect(after.workspace.cases[0].nodes.filter((n) => n.id !== 'unload')).toEqual(
    state.workspace.cases[0].nodes.filter((n) => n.id !== 'unload'),
  );
});

test('HTML snapshots honour individual board sizes and compact previews without resizing timeline cards', async ({
  page,
  context,
}) => {
  const file = structuredClone(sample.cases[0]);
  file.nodes.find((n) => n.id === 'morgan').boardSize = { width: 180, height: 120 };
  file.nodes.find((n) => n.id === 'delivery').boardSize = { width: 420, height: 340 };
  const bundle = await packInvestigation(file, async () => new Uint8Array());
  await context.setOffline(true);
  await page.setContent(createInvestigationViewer(bundle));
  const small = page.locator('#scene .card[data-node-id="morgan"]');
  const large = page.locator('#scene .card[data-node-id="delivery"]');
  expect(await small.evaluate((e) => ({ width: e.offsetWidth, height: e.offsetHeight }))).toEqual({
    width: 180,
    height: 120,
  });
  expect(await large.evaluate((e) => ({ width: e.offsetWidth, height: e.offsetHeight }))).toEqual({
    width: 420,
    height: 340,
  });
  await expect(small.locator('p')).not.toBeVisible();
  await expect(small.locator('h2')).toBeVisible();
  expect(await page.locator('#scene svg path').first().getAttribute('d')).toContain('M168 132');
  await small.click();
  await expect(page.getByRole('dialog')).toContainText(
    file.nodes.find((n) => n.id === 'morgan').summary,
  );
  await page.getByRole('button', { name: 'Close details' }).click();
  await page.getByRole('button', { name: 'Timeline', exact: true }).click();
  await expect(page.locator('#timeline .sized-card')).toHaveCount(0);
  await expect(page.locator('#timeline .compact-card')).toHaveCount(0);
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
