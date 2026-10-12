import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import {
  appIcons,
  defaultAppearance,
  readAppearance,
  loadAppearance,
  resolveAppearance,
} from '../lib/appearance.ts';
test('automatic icon follows light, dark, and system appearance', () => {
  for (const mode of ['light', 'dark', 'system'])
    for (const systemDark of [false, true]) {
      const actual = resolveAppearance({ ...defaultAppearance, mode }, systemDark);
      const dark = mode === 'dark' || (mode === 'system' && systemDark);
      assert.equal(actual.dark, dark);
      assert.equal(actual.tone, dark ? 'dark' : 'light');
    }
});
test('explicit icon override survives theme changes and persisted reload', () => {
  for (const iconTone of ['light', 'dark'])
    for (const mode of ['light', 'dark', 'system']) {
      const saved = readAppearance(
        JSON.stringify({ ...defaultAppearance, iconId: 'editorial', mode, iconTone }),
        null,
      );
      const actual = resolveAppearance(saved, true);
      assert.equal(actual.iconSrc, `/icons/editorial-${iconTone}.svg`);
    }
});
test('legacy palette migrates and invalid storage falls back safely', () => {
  assert.equal(readAppearance(null, 'blueprint').darkTheme, 'blueprint');
  assert.equal(readAppearance(null, 'blueprint').mode, 'dark');
  assert.deepEqual(readAppearance('{oops', null), defaultAppearance);
  assert.deepEqual(
    readAppearance('{"iconId":"../../oops","iconTone":"wrong","mode":null}', null),
    defaultAppearance,
  );
});
test('every icon has both deployable colour variants', () => {
  for (const icon of appIcons)
    for (const tone of ['light', 'dark'])
      assert.ok(existsSync(new URL(`../public/icons/${icon.id}-${tone}.svg`, import.meta.url)));
});

test('system migration keeps icon and palette choices; later manual overrides persist', () => {
  const old = {
    ...defaultAppearance,
    mode: 'dark',
    iconId: 'ink',
    iconTone: 'light',
    darkTheme: 'blueprint',
  };
  const migrated = loadAppearance(null, JSON.stringify(old), null);
  assert.equal(migrated.mode, 'system');
  assert.equal(migrated.iconId, 'ink');
  assert.equal(migrated.iconTone, 'light');
  assert.equal(migrated.darkTheme, 'blueprint');
  const manual = { ...migrated, mode: 'light' };
  assert.equal(loadAppearance(JSON.stringify(manual), JSON.stringify(old), null).mode, 'light');
  assert.equal(loadAppearance(null, null, 'midnight').mode, 'system');
});
