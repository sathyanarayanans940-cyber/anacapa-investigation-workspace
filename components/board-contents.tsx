import { memo } from 'react';
import { Card } from '@/components/evidence-card';
import { threadLayout } from '@/lib/thread-layout';
import type { Evidence, Thread } from '@/lib/case-data';
import type { BoardActions } from '@/hooks/use-board-actions';

/** Keep the diagram stable while dialogs, status messages, or the camera change. */
export const BoardContents = memo(function BoardContents({
  visible,
  connections,
  nodeById,
  crossCounts,
  childCounts,
  showThreads,
  editable,
  tool,
  connectFrom,
  tiltId,
  actions,
}: {
  visible: Evidence[];
  connections: Thread[];
  nodeById: ReadonlyMap<string, Evidence>;
  crossCounts: ReadonlyMap<string, number>;
  childCounts: ReadonlyMap<string | null, number>;
  showThreads: boolean;
  editable: boolean;
  tool: string;
  connectFrom: string | null;
  tiltId: string | null;
  actions: BoardActions;
}) {
  return (
    <>
      <svg className="threads" width="1" height="1">
        {showThreads &&
          connections.map((t) => {
            const layout = threadLayout(t, nodeById);
            return (
              layout && (
                <path
                  key={t.id}
                  d={layout.path}
                  stroke={t.color}
                  strokeWidth="1.7"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={t.dashed ? '6 6' : ''}
                />
              )
            );
          })}
      </svg>
      {visible.map((n) => (
        <Card
          key={n.id}
          n={n}
          crossCount={crossCounts.get(n.id) || 0}
          onRelationships={() => actions.onRelationships(n.id)}
          count={childCounts.get(n.id) || 0}
          selected={connectFrom === n.id || (tool === 'tilt' && tiltId === n.id)}
          interaction={tool}
          onDown={(e) => actions.onNodeDown(e, n.id)}
          onMove={actions.pointerMove}
          onUp={(e) => actions.onNodeUp(e, n)}
          onOpen={() => actions.onNodeOpen(n)}
          onEdit={() => actions.onNodeEdit(n)}
          onExplore={() => actions.onNodeExplore(n)}
          onAddChild={() => actions.onNodeAddChild(n.id)}
          resizable={editable && tool === 'select'}
          onResizeDown={(e) => actions.pointerDown(e, n.id, 'resize')}
          onResizeMove={actions.pointerMove}
          onResizeUp={actions.pointerUp}
          onResizeCancel={actions.pointerCancel}
          onResize={(size) => actions.resizeNode(n.id, size)}
        />
      ))}
      {showThreads &&
        connections.map((t) => {
          const layout = threadLayout(t, nodeById);
          return (
            layout && (
              <button
                key={t.id}
                className="connection-label"
                style={{ left: layout.labelX, top: layout.labelY, color: t.color }}
                aria-label={`Edit connection: ${t.label}`}
                aria-description="Drag to move the label. Click to edit. Arrow keys move it; Shift moves ten steps."
                title="Drag label to move · click to edit"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  actions.pointerDown(e, t.id, 'label');
                }}
                onPointerMove={(e) => {
                  e.stopPropagation();
                  actions.pointerMove(e);
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  actions.pointerUp(e);
                }}
                onPointerCancel={actions.pointerCancel}
                onClick={(e) => {
                  if (e.detail === 0) actions.onThreadEdit(t);
                }}
                onKeyDown={(e) => {
                  if (tool !== 'select') return;
                  const steps: { [key: string]: [number, number] } = {
                    ArrowLeft: [-1, 0],
                    ArrowRight: [1, 0],
                    ArrowUp: [0, -1],
                    ArrowDown: [0, 1],
                  };
                  const step = steps[e.key];
                  if (step) {
                    e.preventDefault();
                    e.stopPropagation();
                    actions.moveLabel(
                      t.id,
                      (t.labelOffset?.x ?? 0) + step[0] * (e.shiftKey ? 10 : 1),
                      (t.labelOffset?.y ?? 0) + step[1] * (e.shiftKey ? 10 : 1),
                    );
                  }
                }}
              >
                {t.label}
              </button>
            )
          );
        })}
    </>
  );
});
