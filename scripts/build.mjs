import { build as bundle } from 'esbuild';
import { build } from 'vite';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('../', import.meta.url)));
await bundle({
  entryPoints: ['scripts/model-entry.ts'],
  outfile: 'runtime/model.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  minify: true,
});
if (!process.argv.includes('--model-only')) await build();
