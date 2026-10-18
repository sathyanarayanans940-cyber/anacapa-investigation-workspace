import { icons } from '@/lib/evidence-display';
import { wallDateLabel as dateLabel } from '@/lib/local-date';
import { titleOf, type Evidence } from '@/lib/case-data';
import { compactCard, cardPreviewLines, cardPreviewText, type CardSize } from '@/lib/card-size';
import { cardTypeTone } from '@/lib/card-type-tone';
import { Pin, ChevronsRight, Link2, ChevronRight, Plus } from 'lucide-react';
export const visualColor = (color: string) =>
  ({
    '#6960d9': '#a58b70',
    '#d99742': '#bea077',
    '#3b9a8d': '#8b9981',
    '#d16978': '#b28d82',
    '#568cc7': '#8c9ba3',
  })[color] || color;
export function Card({
  n,
  count,
  crossCount,
  onRelationships,
  selected,
  interaction,
  onDown,
  onMove,
  onUp,
  onActivate,
  readOnly,
  onExplore,
  onAddChild,
  resizable,
  onResizeDown,
  onResizeMove,
  onResizeUp,
  onResizeCancel,
  onResize,
}: {
  n: Evidence;
  count: number;
  crossCount: number;
  onRelationships: () => void;
  selected: boolean;
  interaction: string;
  onDown: (e: React.PointerEvent) => void;
  onMove: (e: React.PointerEvent) => void;
  onUp: (e: React.PointerEvent) => void;
  onActivate: () => void;
  readOnly: boolean;
  onExplore: () => void;
  onAddChild: () => void;
  resizable: boolean;
  onResizeDown: (e: React.PointerEvent) => void;
  onResizeMove: (e: React.PointerEvent) => void;
  onResizeUp: (e: React.PointerEvent) => void;
  onResizeCancel: () => void;
  onResize: (size?: CardSize) => void;
}) {
  const compact = !!n.boardSize && compactCard(n.boardSize);
  const tone = cardTypeTone(n);
  const Icon = icons[n.kind],
    picture = n.images.find((i) =>
      ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(i.type),
    );
  const lines = n.boardSize
    ? cardPreviewLines(n.boardSize, titleOf(n), n.fields.length > 0, !!picture)
    : 0;
  return (
    <div
      role="button"
      data-node-id={n.id}
      data-confidence={n.confidence.toLowerCase()}
      data-type={tone.type}
      data-priority={n.pinned}
      tabIndex={0}
      aria-label={`${interaction === 'tilt' ? 'Tilt' : interaction === 'pan' ? 'Pan board over' : interaction === 'connect' ? 'Connect' : readOnly ? 'View' : 'Edit'} ${titleOf(n)}`}
      aria-description={`${n.confidence} confidence.${n.pinned ? ' Priority card.' : ''} ${readOnly ? 'Click to view details.' : 'Click to edit details. Drag to move.'} Use the arrow to open sub-events.${resizable ? ' Drag the lower-right corner to resize.' : ''}`}
      aria-pressed={interaction === 'tilt' ? selected : undefined}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onActivate();
        }
      }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      className={`evidence-card ${n.kind === 'Note' ? 'note-card' : ''} ${n.pinned ? 'key-card' : ''} ${selected ? 'connect-selected' : ''} ${n.boardSize ? 'card-sized' : ''} ${compact ? 'card-compact' : ''}`}
      style={
        {
          left: n.x,
          top: n.y,
          width: n.boardSize?.width,
          height: n.boardSize?.height,
          transform: `rotate(${n.rotation ?? (n.kind === 'Note' ? -2 : 0)}deg)`,
          '--node-color': visualColor(n.color),
          '--card-custom-hue': tone.hue,
          '--card-custom-saturation': `${tone.saturation}%`,
          '--card-custom-lift': `${tone.lift}%`,
          '--card-title-lines': n.boardSize && n.boardSize.height < 220 ? 2 : 3,
          '--card-summary-lines': n.boardSize ? lines : undefined,
        } as React.CSSProperties
      }
    >
      <div className="card-pin" />
      <div className="card-type">
        <span>
          <Icon size={14} />
          <i
            className="card-status-mark"
            title={`Confidence: ${n.confidence}`}
            aria-hidden="true"
          />
          <span className="card-kind-label">{n.customKind || n.kind}</span>
        </span>
        <span className="card-stamp">
          {compact && count > 0 && (
            <span className="card-compact-count" title={`${count} sub-events`}>
              {count}
              <ChevronRight size={11} />
            </span>
          )}
          {n.pinned ? (
            <span className="card-priority" title="Pinned as a priority">
              <Pin size={12} />
              <span className="card-priority-label">Priority</span>
            </span>
          ) : (
            <span className="card-id">{n.date ? dateLabel(n.date) : 'Undated'}</span>
          )}
          <button
            className="card-explore"
            aria-label={`Open sub-events of ${titleOf(n)}`}
            title={count ? `Open ${count} sub-events` : 'Open inside this card'}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onExplore();
            }}
          >
            <ChevronsRight size={14} />
          </button>
        </span>
      </div>
      <div className="card-content">
        {!compact && picture && (!n.boardSize || n.boardSize.height >= 320) && (
          <img className="card-image" src={picture.url} alt={n.title} draggable={false} />
        )}
        <h2 title={titleOf(n)}>{titleOf(n)}</h2>
        {!compact && (
          <div className="card-preview">
            <p>
              {n.boardSize
                ? cardPreviewText(n.summary, n.boardSize.width, lines)
                : n.summary.length > 115
                  ? n.summary.slice(0, 115) + '…'
                  : n.summary}
            </p>
            {n.fields[0] && (!n.boardSize || n.boardSize.height >= 240) && (
              <div className="card-field">{n.fields[0].value}</div>
            )}
          </div>
        )}
      </div>
      <div className="card-footer">
        <div className="card-meta">
          {crossCount > 0 && (
            <button
              className="card-crosslink"
              aria-label={`Relationships for ${titleOf(n)}`}
              title="Links to other timelines"
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onRelationships();
              }}
            >
              <Link2 size={11} />
              {crossCount} {crossCount === 1 ? 'link' : 'links'}
            </button>
          )}
          <span className="card-confidence">
            <i className="card-status-mark" aria-hidden="true" />
            {n.confidence}
          </span>
          {n.tags.filter(Boolean).length > 0 && (
            <div className="card-tags">
              {n.tags
                .filter(Boolean)
                .slice(0, 3)
                .map((t, i) => (
                  <span key={i}>{t}</span>
                ))}
            </div>
          )}
        </div>
        <div
          className="card-branch-actions"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          {count > 0 && (
            <button
              className="card-children"
              onClick={(e) => {
                e.stopPropagation();
                onExplore();
              }}
            >
              {count} {count === 1 ? 'sub-event' : 'sub-events'}
              <ChevronRight size={12} />
            </button>
          )}
          <button
            className="card-add-child"
            aria-label={`Add sub-event inside ${titleOf(n)}`}
            title="Add a sub-event inside this card"
            onClick={(e) => {
              e.stopPropagation();
              onAddChild();
            }}
          >
            <span className="card-add-symbol" aria-hidden="true">
              <Plus size={11} />
            </span>
            {count ? '' : <span>Sub-event</span>}
          </button>
        </div>
      </div>
      {resizable && (
        <button
          type="button"
          className="card-resize"
          aria-label={`Resize ${titleOf(n)}`}
          aria-description="Drag to resize. Arrow keys adjust width and height; Shift changes ten pixels. Home resets to automatic size."
          title="Drag to resize · double-click to reset"
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onResizeDown(e);
          }}
          onPointerMove={(e) => {
            e.stopPropagation();
            onResizeMove(e);
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            onResizeUp(e);
          }}
          onPointerCancel={(e) => {
            e.stopPropagation();
            onResizeCancel();
          }}
          onLostPointerCapture={onResizeCancel}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onResize();
          }}
          onKeyDown={(e) => {
            const steps: Record<string, [number, number]> = {
              ArrowLeft: [-1, 0],
              ArrowRight: [1, 0],
              ArrowUp: [0, -1],
              ArrowDown: [0, 1],
            };
            if (e.key === 'Home') {
              e.preventDefault();
              e.stopPropagation();
              onResize();
            }
            const step = steps[e.key];
            if (!step) return;
            e.preventDefault();
            e.stopPropagation();
            const card = e.currentTarget.closest<HTMLElement>('.evidence-card')!;
            onResize({
              width: card.offsetWidth + step[0] * (e.shiftKey ? 10 : 1),
              height: card.offsetHeight + step[1] * (e.shiftKey ? 10 : 1),
            });
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M5 13 13 5M9 13 13 9M13 13h.01"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
