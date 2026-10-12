import test from 'node:test';
import assert from 'node:assert/strict';
import { drainSaves } from '../lib/save-queue.ts';
test('an awaited save includes edits made while the first request is in flight', async () => {
  let draft = 'first',
    saved = '',
    release;
  const requests = [];
  const saving = drainSaves(
    async () => {
      const snapshot = draft;
      requests.push(snapshot);
      if (requests.length === 1) await new Promise((resolve) => (release = resolve));
      saved = snapshot;
      return true;
    },
    () => draft !== saved,
  );
  draft = 'second';
  release();
  assert.equal(await saving, true);
  assert.deepEqual(requests, ['first', 'second']);
  assert.equal(saved, draft);
});
test('a failed follow-up save stops the queue and retains the unsaved draft', async () => {
  let draft = 'first',
    saved = '',
    calls = 0;
  assert.equal(
    await drainSaves(
      async () => {
        calls++;
        if (calls === 1) {
          saved = draft;
          draft = 'new edits';
          return true;
        }
        return false;
      },
      () => draft !== saved,
    ),
    false,
  );
  assert.equal(calls, 2);
  assert.equal(draft, 'new edits');
  assert.equal(saved, 'first');
});
