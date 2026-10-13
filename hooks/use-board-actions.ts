import { useMemo, useRef, type PointerEvent } from 'react';
import type { Evidence, Thread } from '@/lib/case-data';
import type { CardSize } from '@/lib/card-size';
import type { BoardDrag } from './use-board-gestures';

export type BoardActions = {
  onRelationships: (id: string) => void;
  onNodeDown: (event: PointerEvent, id: string) => void;
  onNodeUp: (event: PointerEvent, node: Evidence) => void;
  onNodeOpen: (node: Evidence) => void;
  onNodeEdit: (node: Evidence) => void;
  onNodeExplore: (node: Evidence) => void;
  onNodeAddChild: (id: string) => void;
  onThreadEdit: (thread: Thread) => void;
  pointerDown: (event: PointerEvent, id: string | null, kind?: BoardDrag['kind']) => void;
  pointerMove: (event: PointerEvent) => void;
  pointerUp: (event: PointerEvent) => void;
  pointerCancel: () => void;
  moveLabel: (id: string, x: number, y: number) => void;
  resizeNode: (id: string, size?: CardSize) => void;
};

/** Stable scene handlers read current tool and case state on every interaction. */
export function useBoardActions(actions: BoardActions): BoardActions {
  const latest = useRef(actions);
  latest.current = actions;
  return useMemo(
    () => ({
      onRelationships: (id) => latest.current.onRelationships(id),
      onNodeDown: (event, id) => latest.current.onNodeDown(event, id),
      onNodeUp: (event, node) => latest.current.onNodeUp(event, node),
      onNodeOpen: (node) => latest.current.onNodeOpen(node),
      onNodeEdit: (node) => latest.current.onNodeEdit(node),
      onNodeExplore: (node) => latest.current.onNodeExplore(node),
      onNodeAddChild: (id) => latest.current.onNodeAddChild(id),
      onThreadEdit: (thread) => latest.current.onThreadEdit(thread),
      pointerDown: (event, id, kind) => latest.current.pointerDown(event, id, kind),
      pointerMove: (event) => latest.current.pointerMove(event),
      pointerUp: (event) => latest.current.pointerUp(event),
      pointerCancel: () => latest.current.pointerCancel(),
      moveLabel: (id, x, y) => latest.current.moveLabel(id, x, y),
      resizeNode: (id, size) => latest.current.resizeNode(id, size),
    }),
    [],
  );
}
