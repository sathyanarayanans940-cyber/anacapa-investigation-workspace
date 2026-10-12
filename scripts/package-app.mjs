import { cp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
execFileSync(process.execPath, ['scripts/build.mjs'], { stdio: 'inherit' });
const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const folder = path.join(root, 'release/Anacapa');
await rm(folder, { recursive: true, force: true });
await mkdir(folder, { recursive: true });
await mkdir(path.join(folder, 'docs'), { recursive: true });
for (const name of [
  'dist',
  'runtime',
  'README.md',
  'docs/Architecture.md',
  'docs/Verification.md',
  'docs/Performance.md',
  'docs/performance-results.json',
  'docs/Review-Readiness.md',
  'Start Anacapa.command',
  'Start Anacapa.bat',
  'start-anacapa.sh',
])
  await cp(name, path.join(folder, name), { recursive: true });
await writeFile(
  path.join(folder, 'package.json'),
  JSON.stringify(
    {
      name: 'anacapa',
      version,
      type: 'module',
      engines: { node: '>=22.13.0' },
      scripts: { start: 'node runtime/server.mjs --open' },
    },
    null,
    2,
  ),
);
const archive = path.join(root, 'release/Anacapa.zip');
await rm(archive, { force: true });
execFileSync('zip', ['-qr', archive, 'Anacapa'], { cwd: path.join(root, 'release') });
console.log(
  'Ready to share: ' +
    archive +
    '\nNo investigations, uploads, credentials, or node_modules are included.',
);
