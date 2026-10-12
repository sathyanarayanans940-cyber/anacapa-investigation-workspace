import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import sharp from 'sharp';
export async function checkPwa(base) {
  async function manifest(query = '', cookie = '') {
    const response = await fetch(`${base}/manifest.webmanifest${query}`, {
      headers: cookie ? { cookie } : {},
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /application\/manifest\+json/);
    assert.match(response.headers.get('cache-control'), /no-store/);
    const body = await response.json();
    assert.equal(body.id, '/');
    assert.equal(body.scope, '/');
    assert.equal(body.start_url, '/');
    assert.equal(body.display, 'standalone');
    return body;
  }
  const initial = await manifest();
  assert.equal(initial.icons[0].src, '/icons/original-light-192.png');
  const dark = await manifest('?icon=editorial&tone=dark&theme=midnight');
  assert.equal(dark.icons[0].src, '/icons/editorial-dark-192.png');
  assert.equal(dark.theme_color, '#28241f');
  const saved = encodeURIComponent(
    JSON.stringify({ icon: 'ink', tone: 'light', theme: 'midnight' }),
  );
  const updated = await manifest(
    '?icon=editorial&tone=dark&theme=midnight',
    `anacapa-install-appearance=${saved}`,
  );
  assert.equal(updated.icons[0].src, '/icons/ink-light-192.png');
  assert.equal(updated.theme_color, '#28241f');
  const invalid = await manifest(
    '?icon=../../secret&tone=nope&theme=nope',
    'anacapa-install-appearance=broken',
  );
  assert.equal(invalid.icons[0].src, '/icons/original-light-192.png');
  for (const icon of dark.icons) {
    const r = await fetch(base + icon.src);
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /image\/png/);
    const info = await sharp(Buffer.from(await r.arrayBuffer())).metadata();
    assert.equal(`${info.width}x${info.height}`, icon.sizes);
  }
  const folder = new URL('../public/icons/', import.meta.url);
  const files = (await readdir(folder)).filter((f) => f.endsWith('.png'));
  assert.equal(files.length, 104);
  for (const name of files) {
    const size = Number(name.match(/-(\d+)\.png$/)[1]);
    const meta = await sharp(fileURLToPath(new URL(name, folder))).metadata();
    assert.equal(meta.width, size);
    assert.equal(meta.height, size);
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const base = process.argv[2] || process.env.ANACAPA_BASE_URL || 'http://127.0.0.1:5173';
  await checkPwa(base.replace(/\/$/, ''));
  console.log('PWA manifest and all 104 icon assets passed at ' + base);
}
