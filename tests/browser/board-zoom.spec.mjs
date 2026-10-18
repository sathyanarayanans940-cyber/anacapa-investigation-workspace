import { test as base, expect } from '@playwright/test';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { startServer } from '../../runtime/server.mjs';

const test = base.extend({
  appURL: async ({}, use) => {
    const directory = await mkdtemp(path.join(tmpdir(), 'anacapa-zoom-'));
    const server = startServer({ port: 0, dataDirectory: directory });
    try {
      await once(server, 'listening');
      await use(`http://127.0.0.1:${server.address().port}`);
    } finally {
      await new Promise((resolve) => server.close(resolve));
      await rm(directory, { recursive: true, force: true });
    }
  },
});
const input = (page) => page.getByRole('textbox', { name: 'Zoom percentage', exact: true });
const camera = (page) =>
  page.locator('.canvas').evaluate((element) => {
    const m = new DOMMatrix(getComputedStyle(element).transform);
    return { x: m.e, y: m.f, z: m.a };
  });
const settle = (page) =>
  page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
async function typeZoom(page, value) {
  await input(page).fill(value);
  await input(page).press('Enter');
}

test('typed zoom and repeated +/- stay exact, keep their anchor, and cannot be overridden by a pending fit', async ({
  page,
  appURL,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(document.fonts, 'ready', {
      value: new Promise((resolve) => {
        window.releaseBoardFonts = resolve;
      }),
    });
  });
  await page.goto(appURL);
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
  const original = (await (await page.request.get(appURL + '/api/workspace')).json()).workspace;
  await typeZoom(page, '73.5%');
  await expect(input(page)).toHaveValue('73.5');
  await page.evaluate(() => window.releaseBoardFonts());
  await settle(page);
  await expect(input(page)).toHaveValue('73.5');
  const before = await camera(page);
  const viewport = await page
    .locator('.board')
    .evaluate((el) => ({ x: el.clientWidth / 2, y: el.clientHeight / 2 }));
  await page.getByRole('button', { name: 'Zoom in', exact: true }).evaluate((button) => {
    for (let i = 0; i < 15; i++) button.click();
  });
  await expect(input(page)).toHaveValue('223.5');
  const after = await camera(page);
  expect((viewport.x - after.x) / after.z).toBeCloseTo((viewport.x - before.x) / before.z, 3);
  expect((viewport.y - after.y) / after.z).toBeCloseTo((viewport.y - before.y) / before.z, 3);
  await page.getByRole('button', { name: 'Zoom out', exact: true }).evaluate((button) => {
    for (let i = 0; i < 15; i++) button.click();
  });
  await expect(input(page)).toHaveValue('73.5');
  await input(page).fill('hello');
  await input(page).press('Enter');
  await expect(page.getByRole('alert')).toContainText('Enter a number');
  await expect(input(page)).toHaveValue('73.5');
  await input(page).fill('150');
  await input(page).press('Escape');
  await expect(input(page)).toHaveValue('73.5');
  await input(page).blur();
  await typeZoom(page, '999');
  await expect(input(page)).toHaveValue('400');
  await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeDisabled();
  await typeZoom(page, '0');
  await expect(input(page)).toHaveValue('5');
  await expect(page.getByRole('button', { name: 'Zoom out', exact: true })).toBeDisabled();
  await typeZoom(page, '80');
  const wheel = await page.locator('.board').evaluate(
    (el) =>
      !el.dispatchEvent(
        new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          deltaY: -20,
          clientX: 400,
          clientY: 400,
        }),
      ),
  );
  expect(wheel).toBe(true);
  expect((await camera(page)).z).toBeGreaterThan(0.8);
  expect((await (await page.request.get(appURL + '/api/workspace')).json()).workspace).toEqual(
    original,
  );
});

test('locked zoom survives branches, filters, timeline, resize, fit, and reopening while allowing pan', async ({
  page,
  appURL,
}) => {
  await page.goto(appURL);
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
  await typeZoom(page, '82.5');
  await page.getByRole('switch', { name: 'Lock zoom', exact: true }).check();
  await expect(input(page)).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Zoom out', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Center board', exact: true }).click();
  expect((await camera(page)).z).toBeCloseTo(0.825, 6);
  const before = await camera(page);
  await page.locator('.board').dispatchEvent('wheel', { deltaX: 80, deltaY: 60 });
  const panned = await camera(page);
  expect(panned.x).toBeCloseTo(before.x - 80, 3);
  expect(panned.y).toBeCloseTo(before.y - 60, 3);
  await page.locator('.board').dispatchEvent('wheel', { ctrlKey: true, deltaY: -100 });
  await expect(input(page)).toHaveValue('82.5');
  // Search finds a nested branch without depending on its current camera position.
  await page
    .getByRole('textbox', { name: 'Find evidence', exact: true })
    .fill('The midnight delivery');
  await page
    .getByRole('button', { name: 'Open sub-events of The midnight delivery', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'The midnight delivery', exact: true }),
  ).toBeVisible();
  await settle(page);
  await expect(input(page)).toHaveValue('82.5');
  await page.getByRole('tab', { name: 'Timeline only', exact: true }).click();
  await page.getByRole('button', { name: 'Back to board', exact: true }).click();
  await settle(page);
  await expect(input(page)).toHaveValue('82.5');
  await page.setViewportSize({ width: 760, height: 700 });
  await page.getByRole('button', { name: 'Expand board', exact: true }).click();
  await settle(page);
  await expect(input(page)).toHaveValue('82.5');
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(input(page)).toHaveValue('82.5');
  await expect(page.getByRole('switch', { name: 'Lock zoom', exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Pan (H)', exact: true }).click();
  await page.getByRole('switch', { name: 'Lock zoom', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(input(page)).toHaveValue('92.5');
  await page.reload();
  await expect(page.getByRole('switch', { name: 'Lock zoom', exact: true })).not.toBeChecked();
});

test('fit uses measured bounds and expanded/mobile controls remain separate and clickable', async ({
  page,
  appURL,
}) => {
  const initial = await (await page.request.get(appURL + '/api/workspace')).json();
  const nodes = initial.workspace.cases[0].nodes;
  nodes.find((node) => node.id === 'note').rotation = 15;
  nodes.find((node) => node.id === 'morgan').x = -400;
  await page.request.put(appURL + '/api/workspace', {
    headers: { 'X-Anacapa-Client': '1' },
    data: initial,
  });
  await page.goto(appURL);
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
  await typeZoom(page, '100');
  await page.getByRole('button', { name: 'Fit board', exact: true }).click();
  const geometry = await page.locator('.board').evaluate((board) => {
    const rect = board.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      cards: [...board.querySelectorAll('.evidence-card,.connection-label')].map((el) => {
        const r = el.getBoundingClientRect();
        return {
          x: r.left - rect.left,
          y: r.top - rect.top,
          right: r.right - rect.left,
          bottom: r.bottom - rect.top,
        };
      }),
    };
  });
  for (const rect of geometry.cards) {
    expect(rect.x).toBeGreaterThanOrEqual(23);
    expect(rect.y).toBeGreaterThanOrEqual(23);
    expect(rect.right).toBeLessThanOrEqual(geometry.width - 23);
    expect(rect.bottom).toBeLessThan(geometry.height - 70);
  }
  const scale = (await camera(page)).z;
  const before = await page.locator('.board').boundingBox();
  await page.getByRole('button', { name: 'Expand board', exact: true }).click();
  await expect(page.locator('.workbar')).not.toBeVisible();
  await expect(page.locator('.timeline-canopy')).not.toBeVisible();
  expect((await page.locator('.board').boundingBox()).height).toBeGreaterThan(before.height + 100);
  expect((await camera(page)).z).toBeCloseTo(scale, 6);
  await page.keyboard.press('Escape');
  await expect(page.locator('.workbar')).toBeVisible();
  for (const width of [320, 390, 760, 850, 1100, 1280]) {
    await page.setViewportSize({ width, height: 850 });
    const toolbar = await page.locator('.canvas-toolbar').boundingBox();
    const zoom = await page.getByRole('group', { name: 'Board zoom', exact: true }).boundingBox();
    expect(zoom.x).toBeGreaterThanOrEqual(0);
    expect(zoom.x + zoom.width).toBeLessThanOrEqual(width);
    const overlap =
      toolbar.x < zoom.x + zoom.width &&
      toolbar.x + toolbar.width > zoom.x &&
      toolbar.y < zoom.y + zoom.height &&
      toolbar.y + toolbar.height > zoom.y;
    expect(overlap, `controls overlap at ${width}px`).toBe(false);
    await typeZoom(page, '100');
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await expect(input(page)).toHaveValue('110');
  }
  if (process.env.ANACAPA_QA_SCREENSHOTS) {
    await mkdir('output/board-zoom', { recursive: true });
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.getByRole('button', { name: 'Fit board', exact: true }).click();
    await page.getByRole('switch', { name: 'Lock zoom', exact: true }).check();
    await settle(page);
    await page.screenshot({ path: 'output/board-zoom/Chrome-locked-dark.png' });
    await page.getByRole('button', { name: 'Expand board', exact: true }).click();
    await page.screenshot({ path: 'output/board-zoom/Chrome-expanded-dark.png' });
  }
});
