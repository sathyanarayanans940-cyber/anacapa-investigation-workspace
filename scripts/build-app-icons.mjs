// Rasterize the editable SVG icons for browser installation and Apple touch icons.
import sharp from 'sharp';
import { readdir, readFile } from 'node:fs/promises';
const folder = new URL('../public/icons/', import.meta.url);
for (const name of (await readdir(folder)).filter((name) => name.endsWith('.svg'))) {
  const source = await readFile(new URL(name, folder), 'utf8');
  const stem = name.slice(0, -4);
  // Resolve SVG CSS colours explicitly for consistent headless rasterization.
  const tile =
    source.match(/--tile:(#[a-f\d]{6})/i)?.[1] ||
    source.match(/fill="(#[a-f\d]{6})"/i)?.[1] ||
    '#78654d';
  const foreground = source.match(/;color:(#[a-f\d]{6})/i)?.[1] || '#fff9ed';
  const svg = Buffer.from(
    source.replaceAll('var(--tile)', tile).replaceAll('currentColor', foreground),
  );
  for (const size of [180, 192, 512])
    await sharp(svg)
      .resize(size, size)
      .png()
      .toFile(new URL(`${stem}-${size}.png`, folder).pathname);
  const inset = await sharp(svg).resize(384, 384).png().toBuffer();
  await sharp({ create: { width: 512, height: 512, channels: 4, background: tile } })
    .composite([{ input: inset, left: 64, top: 64 }])
    .png()
    .toFile(new URL(`${stem}-maskable-512.png`, folder).pathname);
}
console.log('Built install and touch icons for all 26 variants.');
