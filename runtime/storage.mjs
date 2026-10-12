import { readdir, lstat } from 'node:fs/promises';
import path from 'node:path';

/** Measure stored bytes without following links outside the chosen folder. */
export async function folderStorage(folder) {
  const groups = {
    originals: { bytes: 0, files: 0 },
    snapshots: { bytes: 0, files: 0 },
    audit: { bytes: 0, files: 0 },
    other: { bytes: 0, files: 0 },
  };
  let skippedLinks = 0;
  async function visit(directory, group = 'other') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      const info = await lstat(file);
      if (info.isSymbolicLink()) {
        skippedLinks++;
        continue;
      }
      const category =
        directory === folder && Object.hasOwn(groups, entry.name) ? entry.name : group;
      if (info.isDirectory()) await visit(file, category);
      else if (info.isFile()) {
        groups[category].bytes += info.size;
        groups[category].files++;
      }
    }
  }
  await visit(folder);
  return {
    groups,
    totalBytes: Object.values(groups).reduce((sum, value) => sum + value.bytes, 0),
    skippedLinks,
  };
}
