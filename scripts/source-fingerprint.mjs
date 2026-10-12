import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

/** Both validation and performance results identify the exact authored source. */
export async function sourceFingerprint() {
  const files = [];
  async function walk(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const file = folder + '/' + entry.name;
      if (entry.isDirectory()) await walk(file);
      else if (/\.(?:ts|tsx|mjs|css|yml)$/.test(file) && file !== 'runtime/model.mjs')
        files.push(file);
    }
  }
  for (const folder of [
    'app',
    'components',
    'hooks',
    'lib',
    'runtime',
    'scripts',
    'tests',
    '.github',
  ])
    await walk(folder);
  files.push(
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'vite.config.ts',
    'index.html',
    'main.tsx',
    'playwright.config.mjs',
    '.prettierrc.json',
    '.prettierignore',
  );
  const unique = [...new Set(files)].sort(),
    hash = createHash('sha256');
  for (const file of unique) {
    hash.update(file + '\0');
    hash.update(await readFile(file));
    hash.update('\0');
  }
  return { sha256: hash.digest('hex'), sourceFiles: unique.length };
}
