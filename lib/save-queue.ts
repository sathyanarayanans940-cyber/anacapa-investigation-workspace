// A caller awaiting Save/Export/Lock must wait for edits made during an earlier save too.
export async function drainSaves(flush: () => Promise<boolean>, dirty: () => boolean) {
  do {
    if (!(await flush())) return false;
  } while (dirty());
  return true;
}
