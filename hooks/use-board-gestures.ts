import type { Dispatch, SetStateAction, RefObject, PointerEvent } from 'react';
import type { Workspace, CaseFile, Evidence, Thread } from '@/lib/case-data';
type Camera = { x: number; y: number; z: number };
export type BoardDrag = {
  id: string | null;
  kind: 'node' | 'label' | 'camera';
  x: number;
  y: number;
  ox: number;
  oy: number;
  moved: boolean;
  before: Workspace;
};
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
/** Pointer capture, cancelling a drag, undo boundaries, pan, and zoom. */
export function useBoardGestures({
  c,
  tool,
  editable,
  camera,
  cameraRef,
  boardRef,
  drag,
  dataRef,
  setData,
  setCamera,
  setHistory,
  setFuture,
  navigate,
  selectNode,
  setThread,
}: {
  c: CaseFile;
  tool: string;
  editable: boolean;
  camera: Camera;
  cameraRef: RefObject<Camera>;
  boardRef: RefObject<HTMLDivElement | null>;
  drag: RefObject<BoardDrag | null>;
  dataRef: RefObject<Workspace>;
  setData: Dispatch<SetStateAction<Workspace>>;
  setCamera: Dispatch<SetStateAction<Camera>>;
  setHistory: Dispatch<SetStateAction<Workspace[]>>;
  setFuture: Dispatch<SetStateAction<Workspace[]>>;
  navigate: (id: string | null) => void;
  selectNode: (node: Evidence) => void;
  setThread: Dispatch<SetStateAction<Thread | null>>;
}) {
  const pointerDown = (
    e: PointerEvent,
    id: string | null,
    kind: 'node' | 'label' | 'camera' = 'node',
  ) => {
    if (e.button !== 0) return;
    if (id && kind === 'node' && (tool === 'connect' || tool === 'tilt')) return;
    if (!id && (e.target as HTMLElement).closest('button,a,input') && kind !== 'label') return;
    if (tool === 'pan') {
      id = null;
      kind = 'camera';
    }
    if (id && !editable) {
      if (kind === 'node') {
        const node = c.nodes.find((n) => n.id === id);
        if (node) navigate(node.id);
      }
      return;
    }
    const n = c.nodes.find((n) => n.id === id),
      t = c.threads.find((t) => t.id === id);
    drag.current = {
      id,
      kind: id ? kind : 'camera',
      x: e.clientX,
      y: e.clientY,
      ox: kind === 'label' ? (t?.labelOffset?.x ?? 0) : n ? n.x : camera.x,
      oy: kind === 'label' ? (t?.labelOffset?.y ?? 0) : n ? n.y : camera.y,
      moved: false,
      before: clone(dataRef.current),
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const pointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x,
      dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    if (!d.moved) return;
    if (d.id) {
      const x = Math.max(-100000, Math.min(100000, d.ox + dx / cameraRef.current.z)),
        y = Math.max(-100000, Math.min(100000, d.oy + dy / cameraRef.current.z));
      setData((w) => {
        const next = {
          ...w,
          cases: w.cases.map((c) =>
            c.id === w.activeCase
              ? d.kind === 'label'
                ? {
                    ...c,
                    threads: c.threads.map((t) =>
                      t.id === d.id ? { ...t, labelOffset: { x, y } } : t,
                    ),
                  }
                : { ...c, nodes: c.nodes.map((n) => (n.id === d.id ? { ...n, x, y } : n)) }
              : c,
          ),
        };
        dataRef.current = next;
        return next;
      });
    } else setCamera((v) => ({ ...v, x: d.ox + dx, y: d.oy + dy }));
  };
  const pointerUp = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    if (d.moved && d.id) {
      setHistory((h) => [...h.slice(-39), d.before]);
      setFuture([]);
    } else if (!d.moved && d.id) {
      if (d.kind === 'label') {
        const t = c.threads.find((t) => t.id === d.id);
        if (t) setThread(clone(t));
      } else {
        const n = c.nodes.find((n) => n.id === d.id);
        if (n) selectNode(n);
      }
    }
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const pointerCancel = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.id) {
      setData(d.before);
      dataRef.current = d.before;
    } else setCamera((v) => ({ ...v, x: d.ox, y: d.oy }));
  };
  const zoom = (factor: number) => {
    const el = boardRef.current;
    const cx = (el?.clientWidth || 800) / 2,
      cy = (el?.clientHeight || 400) / 2;
    setCamera((v) => {
      const z = Math.max(0.2, Math.min(2, v.z * factor));
      return { z, x: cx - ((cx - v.x) * z) / v.z, y: cy - ((cy - v.y) * z) / v.z };
    });
  };
  return { pointerDown, pointerMove, pointerUp, pointerCancel, zoom };
}
