import { test as base, expect } from '@playwright/test';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
import path from 'node:path';
import { startServer } from '../../runtime/server.mjs';
import { sample, packInvestigation, createInvestigationViewer } from '../../runtime/model.mjs';

const test = base.extend({
  appURL: async ({}, use) => {
    const directory = await mkdtemp(path.join(tmpdir(), 'anacapa-card-tones-'));
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

function paletteCase() {
  const file = structuredClone(sample.cases[0]);
  const prototype = file.nodes[0];
  const kinds = ['Person', 'Event', 'Location', 'Digital', 'Document', 'Note'];
  file.title = 'Fictional colour study';
  file.nodes = kinds.flatMap((kind, column) =>
    ['Unverified', 'Likely', 'Confirmed'].map((confidence, row) => ({
      ...structuredClone(prototype),
      id: `${kind.toLowerCase()}-${row}`,
      title: `${kind} · ${confidence}`,
      kind,
      customKind: undefined,
      confidence,
      pinned: false,
      fields: [],
      tags: row === 2 ? ['Palette demo'] : [],
      summary: 'Fictional evidence to compare type, confidence and priority.',
      x: 90 + (column % 3) * 335,
      y: 90 + Math.floor(column / 3) * 265,
    })),
  );
  const custom = (id, title, customKind, x, pinned = false) => ({
    ...structuredClone(prototype),
    id,
    title,
    kind: 'Event',
    customKind,
    confidence: 'Confirmed',
    pinned,
    fields: [],
    tags: ['Palette demo'],
    summary: 'Custom types keep their own consistent colour.',
    x,
    y: 620,
  });
  file.nodes.push(custom('interview', 'Interview record', 'Interview', 90));
  file.nodes.push({
    ...custom('interview-copy', 'Interview copy', 'ＩＮＴＥＲＶＩＥＷ', 440, true),
    tags: [],
    boardSize: { width: 180, height: 120 },
  });
  file.nodes.push(custom('transaction', 'Transaction record', 'Transaction', 425));
  file.threads = [];
  return file;
}

async function cardSkin(page, selector) {
  return page.locator(selector).evaluateAll((cards) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d');
    const rgba = (colour) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = colour;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data];
    };
    return cards.map((card) => {
      const style = getComputedStyle(card);
      const probe = document.createElement('span');
      probe.style.cssText = 'position:absolute;color:var(--card-type-ink)';
      card.append(probe);
      const ink = rgba(getComputedStyle(probe).color);
      probe.remove();
      const copy = card.querySelectorAll('h2,p,.card-type,.stage-kind,.kind');
      return {
        id: card.dataset.nodeId,
        type: card.dataset.type,
        confidence: card.dataset.confidence,
        priority: card.dataset.priority,
        background: rgba(style.backgroundColor),
        ink,
        copy: [...copy].map((element) => rgba(getComputedStyle(element).color)),
        border: style.borderColor,
      };
    });
  });
}

function luminance(rgb) {
  return rgb
    .slice(0, 3)
    .map((v) => v / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((sum, v, index) => sum + v * [0.2126, 0.7152, 0.0722][index], 0);
}
function expectReadable(skins) {
  for (const skin of skins) {
    expect(skin.background[3], skin.id).toBe(255);
    for (const copy of skin.copy) {
      const [low, high] = [luminance(skin.background), luminance(copy)].sort((a, b) => a - b);
      expect(
        (high + 0.05) / (low + 0.05),
        JSON.stringify({ ...skin, copy }),
      ).toBeGreaterThanOrEqual(4.5);
    }
  }
}

test('type families, confidence shades and independent priority stay readable in all four palettes', async ({
  page,
  appURL,
}) => {
  const state = await (await page.request.get(appURL + '/api/workspace')).json();
  state.workspace.cases[0] = paletteCase();
  const seeded = await page.request.put(appURL + '/api/workspace', {
    headers: { 'X-Anacapa-Client': '1' },
    data: state,
  });
  expect(seeded.ok()).toBe(true);
  const expected = (await (await page.request.get(appURL + '/api/workspace')).json()).workspace
    .cases[0];
  await page.goto(appURL);
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
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
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    const skins = await cardSkin(page, '.evidence-card');
    expectReadable(skins);
    expect(
      new Set(
        skins
          .filter((s) => s.confidence === 'confirmed' && s.type !== 'custom')
          .map((s) => s.background.join(',')),
      ).size,
    ).toBe(6);
    for (const type of ['person', 'event', 'location', 'digital', 'document', 'note']) {
      const levels = ['unverified', 'likely', 'confirmed'].map((confidence) =>
        skins.find((s) => s.type === type && s.confidence === confidence),
      );
      expect(new Set(levels.map((s) => s.background.join(','))).size).toBe(3);
      const values = levels.map((s) => luminance(s.background));
      expect(
        mode === 'Dark'
          ? values[0] < values[1] && values[1] < values[2]
          : values[0] > values[1] && values[1] > values[2],
      ).toBe(true);
    }
    const a = skins.find((s) => s.id === 'interview'),
      b = skins.find((s) => s.id === 'interview-copy');
    expect(a.ink).toEqual(b.ink);
    expect(a.background).toEqual(b.background);
    expect(a.border).not.toEqual(b.border);
    expect(a.ink).not.toEqual(skins.find((s) => s.id === 'transaction').ink);
    await expect(page.locator('[data-node-id="interview-copy"]')).toHaveAttribute(
      'aria-description',
      /Confirmed confidence\. Priority card\./,
    );
    await page.getByRole('tab', { name: 'Timeline only', exact: true }).click();
    expectReadable(await cardSkin(page, '.stage-card'));
    await page.getByRole('button', { name: 'Back to board', exact: true }).click();
  }
  expect(
    (await (await page.request.get(appURL + '/api/workspace')).json()).workspace.cases[0].nodes,
  ).toEqual(expected.nodes);
  // A confidence edit must leave the type's hue intact and persist after reload.
  const search = page.getByRole('textbox', { name: 'Find evidence', exact: true });
  await search.fill('Interview record');
  await page.getByRole('button', { name: 'Edit Interview record', exact: true }).click();
  await page.getByText('Card appearance & labels', { exact: true }).click();
  await page.getByRole('combobox', { name: 'Confidence', exact: true }).click();
  await page.getByRole('option', { name: 'Likely', exact: true }).click();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
  await page.reload();
  const saved = (await (await page.request.get(appURL + '/api/workspace')).json()).workspace
    .cases[0];
  expect(saved.nodes.find((n) => n.id === 'interview').confidence).toBe('Likely');
  expect(saved.nodes.find((n) => n.id === 'interview').customKind).toBe('Interview');
  expect(saved.nodes.find((n) => n.id === 'interview').pinned).toBe(false);
  await page.getByRole('tab', { name: 'Timeline only', exact: true }).click();
  expectReadable(await cardSkin(page, '.stage-card'));
});

test('custom colours, confidence and priority survive standalone HTML viewing offline', async ({
  page,
  context,
}) => {
  const file = paletteCase();
  const bundle = await packInvestigation(file, async () => new Uint8Array());
  await context.setOffline(true);
  for (const mode of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: mode });
    await page.setContent(createInvestigationViewer(bundle));
    const skins = await cardSkin(page, '#scene .card');
    expect(skins.length).toBe(file.nodes.length);
    expectReadable(skins);
    const a = skins.find((s) => s.id === 'interview'),
      b = skins.find((s) => s.id === 'interview-copy');
    expect(a.ink).toEqual(b.ink);
    expect(a.background).toEqual(b.background);
    expect(a.border).not.toEqual(b.border);
    expect(a.ink).not.toEqual(skins.find((s) => s.id === 'transaction').ink);
    await page.getByRole('button', { name: 'Timeline', exact: true }).click();
    expectReadable(await cardSkin(page, '.event-body'));
  }
  if (process.env.ANACAPA_QA_SCREENSHOTS) {
    const demo = structuredClone(file);
    demo.nodes = demo.nodes.filter((n) => n.tags.includes('Palette demo'));
    demo.nodes.find((n) => n.kind === 'Event' && !n.customKind).pinned = true;
    const example = await packInvestigation(demo, async () => new Uint8Array());
    await page.setViewportSize({ width: 1600, height: 1120 });
    await mkdir('output/card-tones', { recursive: true });
    for (const mode of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: mode });
      await page.setContent(createInvestigationViewer(example));
      await page.screenshot({ path: `output/card-tones/Chrome-${mode}-types.png` });
    }
  }
});
