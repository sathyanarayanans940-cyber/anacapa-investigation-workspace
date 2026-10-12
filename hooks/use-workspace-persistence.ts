import { useEffect, useRef, useState, type RefObject } from 'react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import type { Workspace } from '@/lib/case-data';
import { workspaceSchema } from '@/lib/validation';
import { drainSaves } from '@/lib/save-queue';

/** One queue owns autosave, revision conflicts, retry, and unload protection. */
export function useWorkspacePersistence(
  data: Workspace,
  dataRef: RefObject<Workspace>,
  reasonRef: RefObject<string>,
  isDragging: () => boolean,
  apply: (workspace: Workspace) => void,
  accessLost: () => void,
) {
  const onApply = useRef(apply),
    onAccessLost = useRef(accessLost),
    dragging = useRef(isDragging);
  onApply.current = apply;
  onAccessLost.current = accessLost;
  dragging.current = isDragging;
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState('Loading workspace…');
  const revision = useRef(0);
  const saved = useRef('');
  const savingRef = useRef(false);
  const readyRef = useRef(false);
  const conflict = useRef(false);
  const saveTask = useRef<Promise<boolean> | null>(null);
  const [recovering, setRecovering] = useState(false),
    [confirmReload, setConfirmReload] = useState(false);
  function applyServer(reply: { workspace: Workspace; revision: number }) {
    const workspace = workspaceSchema.parse(reply.workspace);
    revision.current = reply.revision;
    saved.current = JSON.stringify(workspace);
    readyRef.current = true;
    conflict.current = false;
    setLoaded(true);
    setSaving('All changes saved');
    setRecovering(false);
    setConfirmReload(false);
    onApply.current(workspace);
  }
  async function load() {
    setSaving('Loading workspace…');
    try {
      const r = await apiFetch('/api/workspace');
      const result = (await r.json()) as { workspace: Workspace; revision: number; error?: string };
      if (!r.ok) throw Error(result.error);
      applyServer(result);
    } catch (e) {
      setSaving('Workspace unavailable · Retry');
      toast.error((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function persist() {
    if (saveTask.current) return saveTask.current;
    const task = drainSaves(flushChanges, () => JSON.stringify(dataRef.current) !== saved.current);
    saveTask.current = task;
    try {
      return await task;
    } finally {
      saveTask.current = null;
    }
  }
  async function flushChanges() {
    if (!readyRef.current || savingRef.current || conflict.current || dragging.current())
      return false;
    const current = JSON.stringify(dataRef.current);
    if (current === saved.current) {
      setSaving('All changes saved');
      return true;
    }
    savingRef.current = true;
    const sentReason = reasonRef.current;
    setSaving('Saving changes…');
    try {
      const r = await apiFetch('/api/workspace', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace: dataRef.current,
          revision: revision.current,
          reason: sentReason,
        }),
      });
      const result = (await r.json()) as {
        workspace: Workspace;
        revision: number;
        error?: string;
        code?: string;
      };
      if (!r.ok) {
        if (r.status === 409 && result.code === 'REVISION_CONFLICT') {
          conflict.current = true;
          setRecovering(true);
        }
        if (r.status === 423 || r.status === 403) {
          onAccessLost.current();
          await load();
        }
        throw Error(result.error);
      }
      revision.current = result.revision;
      saved.current = current;
      if (reasonRef.current === sentReason) reasonRef.current = '';
      setSaving(
        current === JSON.stringify(dataRef.current) ? 'All changes saved' : 'Changes pending…',
      );
      return true;
    } catch (e) {
      setSaving(conflict.current ? 'Save conflict · Recover' : 'Not saved · Retry');
      toast.error((e as Error).message);
      return false;
    } finally {
      savingRef.current = false;
    }
  }
  useEffect(() => {
    if (loaded && JSON.stringify(data) !== saved.current)
      setSaving(conflict.current ? 'Save conflict · Recover' : 'Changes pending…');
    const timer = setTimeout(() => void persist(), 650);
    return () => clearTimeout(timer);
  }, [data, loaded]);
  useEffect(() => {
    const timer = setInterval(() => void persist(), 3500);
    const unload = (e: BeforeUnloadEvent) => {
      if (readyRef.current && JSON.stringify(dataRef.current) !== saved.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', unload);
    return () => {
      clearInterval(timer);
      window.removeEventListener('beforeunload', unload);
    };
  }, []);
  return {
    loaded,
    setLoaded,
    saving,
    setSaving,
    readyRef,
    savingRef,
    conflict,
    recovering,
    setRecovering,
    confirmReload,
    setConfirmReload,
    load,
    persist,
    applyServer,
  };
}
