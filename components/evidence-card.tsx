import { icons } from '@/lib/evidence-display';
import { wallDateLabel as dateLabel } from '@/lib/local-date';
import { titleOf, type Evidence } from '@/lib/case-data';
import { Pin, Pencil, Link2, ChevronRight, Plus } from 'lucide-react';
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
  onOpen,
  onEdit,
  onExplore,
  onAddChild,
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
  onOpen: () => void;
  onEdit: () => void;
  onExplore: () => void;
  onAddChild: () => void;
}) {
  const Icon = icons[n.kind],
    picture = n.images.find((i) =>
      ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(i.type),
    );
  return (
    <div
      role="button"
      data-node-id={n.id}
      tabIndex={0}
      aria-label={`${interaction === 'tilt' ? 'Tilt' : interaction === 'pan' ? 'Pan board over' : 'Open'} ${titleOf(n)}`}
      aria-description="Click to explore inside. Drag to move. Use the pencil to edit."
      aria-pressed={interaction === 'tilt' ? selected : undefined}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      className={`evidence-card ${n.kind === 'Note' ? 'note-card' : ''} ${n.pinned ? 'key-card' : ''} ${selected ? 'connect-selected' : ''}`}
      style={
        {
          left: n.x,
          top: n.y,
          transform: `rotate(${n.rotation ?? (n.kind === 'Note' ? -2 : 0)}deg)`,
          '--node-color': visualColor(n.color),
        } as React.CSSProperties
      }
    >
      <div className="card-pin" />
      <div className="card-type">
        <span>
          <Icon size={14} />
          {n.customKind || n.kind}
        </span>
        <span className="card-stamp">
          {n.pinned ? (
            <Pin size={13} />
          ) : (
            <span className="card-id">{n.date ? dateLabel(n.date) : 'Undated'}</span>
          )}
          <button
            className="card-edit"
            aria-label={`Edit ${titleOf(n)}`}
            title="Edit details"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <Pencil size={12} />
          </button>
        </span>
      </div>
      {picture && <img className="card-image" src={picture.url} alt={n.title} draggable={false} />}
      <h2>{titleOf(n)}</h2>
      <p>{n.summary.length > 115 ? n.summary.slice(0, 115) + '…' : n.summary}</p>
      {n.fields[0] && <div className="card-field">{n.fields[0].value}</div>}
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
          {n.confidence === 'Unverified' && <span className="uncertain">Unverified</span>}
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
    </div>
  );
}
